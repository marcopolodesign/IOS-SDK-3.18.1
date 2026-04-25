#!/usr/bin/env bash
# =============================================================================
# sentry-monitor.sh — Daily Sentry error monitor for Focus smart ring app
#
# Branch strategy:
#   sentry/fix-{id}  →  PR into `sentry`  →  auto-merged into `sentry`
#   sentry           →  PR into `main`     →  merged only when no flagged issues
#   main             →  eas update (production OTA) if sentry merged cleanly
#
# Never auto-merge issues touching: connection/BLE, sleep pipeline
# =============================================================================
set -euo pipefail

# ── Config ────────────────────────────────────────────────────────────────────
# Set SENTRY_TOKEN in .claude/settings.json env block or export before running:
#   export SENTRY_TOKEN=sntryu_...
SENTRY_TOKEN="${SENTRY_TOKEN:?SENTRY_TOKEN env var is required — set it in .claude/settings.json or export it}"
ORG="sparring-10"
PROJECT="focus-app"
SENTRY_BASE="https://sentry.io/api/0"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPORT_FILE="$REPO_ROOT/sentry-report.md"
CATCHUP_FILE="$REPO_ROOT/catchup.md"
TODAY=$(date -u '+%Y-%m-%d')
SENTRY_BRANCH="sentry-fixes"

# Keywords that force flag-only (never auto-merge)
SENSITIVE_PATTERNS="connect|disconnect|bluetooth|ble|peripheral|autoReconnect|JstyleBridge|UnifiedSmartRing|sleep|hypnogram|bedtime|wakeTime|getSleep|SleepData|trimAwake"

# ── Helpers ───────────────────────────────────────────────────────────────────
sentry_get() { curl -sf -H "Authorization: Bearer $SENTRY_TOKEN" "$SENTRY_BASE$1"; }

log()  { echo "▸ $*"; }
warn() { echo "⚠ $*" >&2; }

require_clean_main() {
  git fetch origin main --quiet
  git checkout main --quiet
  git pull origin main --rebase --quiet
}

ensure_sentry_branch() {
  if ! git ls-remote --exit-code origin "$SENTRY_BRANCH" &>/dev/null; then
    log "Creating remote '$SENTRY_BRANCH' branch from main"
    git checkout -b "$SENTRY_BRANCH" origin/main
    git push -u origin "$SENTRY_BRANCH"
  else
    git fetch origin "$SENTRY_BRANCH" --quiet
    git checkout "$SENTRY_BRANCH" --quiet
    git pull origin "$SENTRY_BRANCH" --rebase --quiet
  fi
}

issue_is_sensitive() {
  local title="$1" culprit="$2" stacktrace="$3"
  echo "${title}${culprit}${stacktrace}" | grep -qiE "$SENSITIVE_PATTERNS"
}

branch_exists_remote() { git ls-remote --exit-code origin "$1" &>/dev/null; }

append_report() {
  # Pull before writing to avoid conflicts
  git fetch origin main --quiet
  git checkout main --quiet
  git pull origin main --rebase --quiet
  printf '%s\n' "$1" >> "$REPORT_FILE"
}

commit_and_push_main() {
  local msg="$1"
  git add "$REPORT_FILE" "$CATCHUP_FILE" 2>/dev/null || git add "$REPORT_FILE"
  git commit -m "$msg" || true
  git push -u origin main
}

# ── Step 1: Fetch issues (server-side 24 h filter) ────────────────────────────
log "Fetching Sentry issues for project: $PROJECT"
YESTERDAY=$(python3 -c "
from datetime import datetime, timedelta, timezone
print((datetime.now(timezone.utc)-timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%S'))
")

ISSUES_JSON=$(sentry_get "/projects/$ORG/$PROJECT/issues/?query=is:unresolved+lastSeen:>$YESTERDAY&limit=25")
ISSUE_COUNT=$(echo "$ISSUES_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))")

if [[ "$ISSUE_COUNT" -eq 0 ]]; then
  log "No new issues in the last 24 h"
  require_clean_main
  echo -e "\n## $TODAY — No new issues" >> "$REPORT_FILE"
  commit_and_push_main "chore: Sentry daily report $TODAY — no new issues"
  exit 0
fi

log "Found $ISSUE_COUNT issue(s) in the last 24 h"

# ── Step 2: Process each issue ────────────────────────────────────────────────
ensure_sentry_branch

REPORT_ROWS=""
FIXED_IDS=""
FLAGGED_IDS=""
SENTRY_HAS_CHANGES=0

process_issue() {
  local issue_id="$1" title="$2" level="$3" first_seen="$4" last_seen="$5" culprit="$6"

  local fix_branch="sentry/fix-${issue_id}"
  local sentry_url="https://sparring-10.sentry.io/issues/${issue_id}/"

  # Fetch event details
  local event
  event=$(sentry_get "/issues/${issue_id}/events/latest/") || { warn "Could not fetch event for $issue_id"; return; }

  local stack
  stack=$(echo "$event" | python3 -c "
import sys, json
e = json.load(sys.stdin)
frames = []
for entry in e.get('entries', []):
    if entry['type'] == 'exception':
        for exc in entry['data'].get('values', []):
            for f in (exc.get('stacktrace') or {}).get('frames', []):
                fn = f.get('filename','') or ''
                func = f.get('function','') or ''
                frames.append(fn + ' ' + func)
print(' '.join(frames[:20]))
" 2>/dev/null || true)

  # Sensitivity check
  if issue_is_sensitive "$title" "$culprit" "$stack"; then
    warn "Flagged (connection/sleep scope): $issue_id — $title"
    FLAGGED_IDS="$FLAGGED_IDS $issue_id"
    REPORT_ROWS="$REPORT_ROWS
| $issue_id | $title | $level | $first_seen | $last_seen | Flagged — connection/sleep scope, needs manual review |"
    return
  fi

  # Skip if branch already exists with a fix
  if branch_exists_remote "$fix_branch"; then
    log "Branch $fix_branch already exists — skipping"
    REPORT_ROWS="$REPORT_ROWS
| $issue_id | $title | $level | $first_seen | $last_seen | Fix branch already exists ($fix_branch) |"
    return
  fi

  # ── Auto-fix logic ──────────────────────────────────────────────────────────
  # Add new fix patterns here. Each block should:
  #   1. Detect the specific issue
  #   2. Apply the minimal patch
  #   3. Set APPLIED=1 and ACTION description

  local APPLIED=0 ACTION="" FILE="" PR_NUM=""

  # Pattern: breadcrumbs.values.map crash in beforeSend
  if echo "$title $culprit" | grep -qi "breadcrumbs.*values.*map\|beforeSend.*undefined"; then
    FILE="$REPO_ROOT/app/_layout.tsx"
    if grep -q "if (event.breadcrumbs?.values)" "$FILE" 2>/dev/null; then
      sed -i 's/if (event\.breadcrumbs?\.values)/if (Array.isArray(event.breadcrumbs?.values))/' "$FILE"
      APPLIED=1
      ACTION="Auto-fixed: Array.isArray guard on event.breadcrumbs.values"
    fi
  fi

  # Pattern: unhandled null/undefined with clear optional-chain fix
  # (Add more patterns here following the same structure)

  if [[ $APPLIED -eq 1 ]]; then
    git checkout -b "$fix_branch" "$SENTRY_BRANCH"
    git add "$FILE"
    git commit -m "fix: resolve Sentry issue $issue_id — $(echo "$title" | head -c 60)"$'\n\n'"Sentry: $sentry_url"$'\n\nhttps://claude.ai/code/session_013PL7XxzrTjAtR4qoEXpZLL'
    git push -u origin "$fix_branch"

    # Create PR targeting sentry branch
    PR_BODY="Sentry issue: $sentry_url

$ACTION

Auto-generated by \`scripts/sentry-monitor.sh\`."
    PR_NUM=$(gh pr create \
      --base "$SENTRY_BRANCH" \
      --head "$fix_branch" \
      --title "fix: $title" \
      --body "$PR_BODY" \
      --label "sentry-auto-fix" 2>/dev/null | grep -o '[0-9]*$' || echo "")

    # Auto-merge into sentry
    if [[ -n "$PR_NUM" ]]; then
      gh pr merge "$PR_NUM" --squash --auto 2>/dev/null || true
      git checkout "$SENTRY_BRANCH"
      git pull origin "$SENTRY_BRANCH" --rebase --quiet
    fi

    SENTRY_HAS_CHANGES=1
    FIXED_IDS="$FIXED_IDS $issue_id"
    ACTION="${ACTION}${PR_NUM:+ (PR #$PR_NUM → sentry)}"
    REPORT_ROWS="$REPORT_ROWS
| $issue_id | $title | $level | $first_seen | $last_seen | $ACTION |"

    # Return to sentry branch for next issue
    git checkout "$SENTRY_BRANCH"
  else
    REPORT_ROWS="$REPORT_ROWS
| $issue_id | $title | $level | $first_seen | $last_seen | Needs manual review — no auto-fix pattern matched |"
  fi
}

# Parse and process each issue
echo "$ISSUES_JSON" | python3 -c "
import sys, json
issues = json.load(sys.stdin)
for i in issues:
    print('|'.join([
        i['id'],
        i['title'].replace('|','\\\\|'),
        i.get('level','error'),
        i.get('firstSeen',''),
        i.get('lastSeen',''),
        (i.get('culprit') or '').replace('|','\\\\|'),
    ]))
" | while IFS='|' read -r id title level first_seen last_seen culprit; do
  process_issue "$id" "$title" "$level" "$first_seen" "$last_seen" "$culprit"
done

# ── Step 3: Merge sentry → main if clean ──────────────────────────────────────
if [[ $SENTRY_HAS_CHANGES -eq 1 && -z "$FLAGGED_IDS" ]]; then
  log "No flagged issues — merging sentry → main"
  require_clean_main
  git merge --no-ff origin/"$SENTRY_BRANCH" -m "chore: merge sentry fixes into main ($TODAY)"
  git push -u origin main

  # ── Step 4: EAS OTA update ──────────────────────────────────────────────────
  if command -v eas &>/dev/null && [[ -n "${EXPO_TOKEN:-}" ]]; then
    log "Running EAS update (production channel)"
    cd "$REPO_ROOT"
    eas update --branch production \
               --message "Sentry auto-fixes $TODAY:$(echo $FIXED_IDS)" \
               --non-interactive
    EAS_STATUS="EAS update pushed to production"
  else
    warn "eas CLI or EXPO_TOKEN not available — skipping OTA update"
    EAS_STATUS="EAS update skipped (eas CLI / EXPO_TOKEN not set)"
  fi
else
  EAS_STATUS="EAS update skipped — flagged issues pending manual review or no fixes applied"
fi

# ── Step 5: Write sentry-report.md + catchup.md ───────────────────────────────
require_clean_main

{
  echo ""
  echo "## $TODAY"
  echo ""
  echo "| Issue ID | Title | Severity | First Seen | Last Seen | Action Taken |"
  echo "|---|---|---|---|---|---|"
  echo "$REPORT_ROWS"
  echo ""
  echo "### $TODAY Notes"
  echo "- Issues fetched: $ISSUE_COUNT"
  [[ -n "$FIXED_IDS" ]] && echo "- Auto-fixed:$FIXED_IDS"
  [[ -n "$FLAGGED_IDS" ]] && echo "- Flagged (manual review):$FLAGGED_IDS"
  echo "- $EAS_STATUS"
} >> "$REPORT_FILE"

# catchup.md entry
{
  echo ""
  echo "### $TODAY: Sentry daily monitor"
  echo ""
  echo "**Issues ($ISSUE_COUNT in last 24 h):**"
  [[ -n "$FIXED_IDS" ]] && echo "- Auto-fixed:$FIXED_IDS → merged sentry → main"
  [[ -n "$FLAGGED_IDS" ]] && echo "- Flagged for manual review:$FLAGGED_IDS (connection/sleep scope)"
  echo "- $EAS_STATUS"
  echo ""
  echo "**Source:** Claude Code — automated sentry monitor"
} >> "$CATCHUP_FILE"

commit_and_push_main "chore: Sentry daily report $TODAY"
log "Done."
