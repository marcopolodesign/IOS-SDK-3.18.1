---
name: eas-update
description: Push an EAS OTA update to the production channel. Use after merging Sentry fixes or any JS-only change that should ship immediately without a full native build.
---

# EAS Update — Push OTA to Production

Pushes an over-the-air (OTA) JS bundle update via Expo Application Services to the `production` channel. Only touches the JS layer — no native rebuild required.

## Pre-flight checks

1. Confirm the current branch is `main` and the working tree is clean:
   ```bash
   git status && git branch --show-current
   ```
   If not on main, ask the user before proceeding.

2. Check `eas-cli` is available:
   ```bash
   eas --version 2>/dev/null || npm install -g eas-cli
   ```

3. Check `EXPO_TOKEN` is set (required for non-interactive auth):
   ```bash
   echo "${EXPO_TOKEN:?EXPO_TOKEN is not set — see setup instructions below}"
   ```
   If missing, print the setup instructions (see bottom of this file) and stop.

## Run the update

```bash
cd SmartRingExpoApp
eas update \
  --branch production \
  --message "${MESSAGE:-Sentry auto-fixes $(date +%Y-%m-%d)}" \
  --non-interactive
```

After the command completes, report:
- The update ID and URL from the EAS output
- Which branch/channel was updated
- The commit SHA that was bundled (`git rev-parse --short HEAD`)

## After update

Append a one-liner to `sentry-report.md` under the current date section:
```
- EAS OTA update pushed: {update-id} (production channel, {commit-sha})
```

Then commit and push:
```bash
git add SmartRingExpoApp/sentry-report.md
git commit -m "chore: EAS OTA update $(date +%Y-%m-%d)"
git push origin main
```

---

## Setup instructions (first-time / remote sessions)

`EXPO_TOKEN` must be available as an environment variable. To configure it:

### 1. Generate a token
1. Go to [expo.dev](https://expo.dev) → Account Settings → Access Tokens
2. Create a new token named `claude-code-ci`
3. Copy the token value

### 2. Add to Claude Code environment

**Option A — project settings (recommended for web sessions):**
Add to `SmartRingExpoApp/.claude/settings.json`:
```json
{
  "env": {
    "EXPO_TOKEN": "your-token-here"
  }
}
```
Run `/update-config` to do this safely.

**Option B — shell profile (local sessions):**
```bash
echo 'export EXPO_TOKEN=your-token-here' >> ~/.zshrc
```

### 3. Verify
```bash
eas whoami
```
Should print your Expo username without prompting for a password.

### EAS channels in eas.json
| Channel | Audience | When to update |
|---|---|---|
| `production` | App Store users | After any auto-fix merge to main |
| `preview` | Internal TestFlight | After larger feature merges |
| `development` | Dev client builds | Freely during development |
