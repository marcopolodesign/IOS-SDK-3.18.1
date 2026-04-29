# Catchup — Implementation Log

Reverse-chronological record of completed implementations. Updated after every successful feature/fix.

---

## 2026-04-28: Performance fix — Today-tab lag (FocusScreen offscreen animations)

**Source:** Claude Code — Macbook Pro

**Change:** Diagnosed and fixed a severe Today-tab lag caused by two infinite Reanimated `withRepeat` loops driving a 90%-screen-height blurred SVG in `FocusScreen` — running continuously in the background because `NativeTabs` (UIKit `UITabBarController`) sibling-mounts all tabs. Replaced the mount-only `useEffect` with `useFocusEffect` + `cancelAnimation` cleanup so the animations pause when the Coach tab is off-screen and resume on re-focus. Also removed three debug `console.log` calls (stages block + override logs) that ran on every sync, and made `IllnessWatchCard` properly memoized with a value-equality comparator so `React.memo` actually works despite `illness` being a new object reference each render.

**Files modified:**
- `src/screens/FocusScreen.tsx` — replaced `useEffect` (no cleanup) with `useFocusEffect(useCallback(...))` + `cancelAnimation(blobFloat)` / `cancelAnimation(overlayOpacity)` in the cleanup return; added `cancelAnimation` + `useFocusEffect` imports; removed `useEffect` import
- `src/hooks/useHomeData.ts` — removed stages debug block (4-pass filter+reduce + console.log on every sync at ~line 1600), removed `✏️ [override]` console.log inside `pushSleepOverrideToSupabase`, removed `✏️ [useHomeData] Sleep override:` console.log in fetchData
- `src/components/focus/IllnessWatchCard.tsx` — renamed function to `IllnessWatchCardInner`; added `useMemo` for `edgeColors` (stops 4 new array allocations per render); wrapped export in `React.memo` with custom `areEqual` comparator (checks `status`, `score`, `stale` by value — prevents re-renders when `illness` object is recreated with same data)

**Key notes:**
- Root cause confirmed: `NativeTabs` in `app/(tabs)/_layout.tsx` is UIKit `UITabBarController` — all tab screens are mounted simultaneously on first render, so `FocusScreen` runs even while user is on Today
- `withRepeat(..., -1, true)` with no cleanup = infinite animation driving a `feGaussianBlur stdDeviation="50"` SVG blob (CoreGraphics rasterises on every frame) = heavy GPU + JS work offscreen
- `cancelAnimation` leaves shared value at its current position; `withTiming(1, ...)` on re-focus starts from that frozen value — visually seamless, no reset needed
- `React.memo` custom comparator on `IllnessWatchCard` compares `illness.status`, `illness.score`, `illness.stale` — sufficient since visual output only changes when these change; `details.hrDelta` etc. only change with status/score
- No native rebuild required — JS-only changes, OTA-eligible

---

### 2026-04-28: AskCoachButton — replay animation on every Coach tab focus

**Source:** Claude Code — Macbook Pro

**Change:** Animation now replays every time the user navigates back to the Coach tab, not just on first mount. Added `useFocusEffect` (from `expo-router`) with a stable callback that reads dims via `dimsRef` to avoid stale closure. `runAnimation` extracted as a stable `useCallback` that resets `cardOpacity` to 0 before each play — required for re-runs since the simplify pass had removed the reset (correct for first mount, but needed for replays).

**Files modified:**
- `src/components/focus/AskCoachButton.tsx` — added `useCallback`, `useRef`, `useFocusEffect`; extracted `runAnimation`; added `dimsRef` + sync effect; `useFocusEffect` guard skips if dims not yet known (first layout handled by existing `useEffect`)

**Key notes:**
- `useFocusEffect` fires before layout on initial mount → `dimsRef.current` is null → early return; `useEffect([dims])` handles the first play
- On re-focus dims is stable → only `useFocusEffect` fires (not `useEffect`), no double-play
- `cardOpacity.value = 0` is now inside `runAnimation` (load-bearing for replays even though redundant on first mount)

---

### 2026-04-28: AskCoachButton — colored comet animation + card materialise effect

**Source:** Claude Code — Macbook Pro

**Change:** Replaced the white SVG comet border animation with a blue→violet→lavender colored gradient comet. The card now starts fully transparent on mount; the colored comet sweeps around the border for ~4.2 s, then fades out while the black card background simultaneously fades in — the card "materialises" as the animation resolves. BlurView removed (was 95% opaque anyway). Mode selector (Coach / Analyst) added to toolbar with ActionSheet.

**Files modified:**
- `src/components/focus/AskCoachButton.tsx` — new `CometLayerConfig` type; LAYERS updated with hex colors; `cardOpacity` shared value drives black-bg fade-in; JSX restructured (bg layer + content separated); BlurView dropped; ChevronDownIcon + openModeSelector added; styles for `cardBg` / `content` / `toolbar` / `modeGroup` / `modeBtn`

**Key notes:**
- `wrapper` has `overflow: hidden` + `borderRadius: R` — `cardBg` does not need its own `borderRadius`
- `cardOpacity` initialises to 0 via `useSharedValue(0)`; no reset inside useEffect (was redundant)
- Reanimated cancels previous animation automatically when a new `withTiming` is assigned to a shared value — dims-change mid-animation is safe

---

### 2026-04-28: Sleep override — score recalculation + hypnogram boundary labels

**Source:** Claude Code — Macbook Pro

**Score recalculation**: Added `scoreFromSegments(segs)` helper (uses `calculateSleepScoreFromStages`) — recomputes score from all segment stage minutes including the inferred gap. Both the `fetchData` gap-fill path and `applyOverrideNow` now set `score: newScore` and `sleepScore: newScore` so the sleep score card updates immediately alongside the hypnogram.

**Hypnogram boundary labels**: The dashed vertical "RING ON" separator now shows "Estimated" (right-aligned) on the left side and "Recorded data" (left-aligned) on the right side, both at `fontSize=8` and 35% opacity.

**Files:** `src/hooks/useHomeData.ts`, `src/components/home/SleepHypnogram.tsx`

---

### 2026-04-28: Sleep edit UX — instant hypnogram update + drag timeline

**Source:** Claude Code — Macbook Pro

**Hypnogram instant update** (`src/hooks/useHomeData.ts`, `src/context/HomeDataContext.tsx`):
Added `applyOverrideNow()` — reads the saved override from AsyncStorage, strips existing inferred segments, re-applies `fillSleepGap`, calls `setData` immediately (no BLE). Rebuilds `unifiedSleepSessions` in the same call. `SleepTab.onSaved` now calls `applyOverrideNow()` first (instant hypnogram), then `homeData.refresh()` (background ring sync). Also fixed `loadFromCache` to preserve `isInferred` on segments (was dropped on hot restart).

**Drag timeline modal** (`src/components/sleep/SleepTimeEditModal.tsx` — full rewrite):
Replaced +/− pickers with horizontal drag timeline (6 PM → 2 PM, 20h). Moon/sun thumb handles; snaps to 15-min; 30-min minimum gap; live readouts update on drag; PanResponder per handle with refs for stale-closure safety.

**Supabase**: overrides are local-only (AsyncStorage). Supabase keeps original ring data unmodified.

**Files:** `src/hooks/useHomeData.ts`, `src/context/HomeDataContext.tsx`, `src/components/sleep/SleepTimeEditModal.tsx`, `src/screens/home/SleepTab.tsx`

---

### 2026-04-28: FocusScreen — AskCoachButton pinned above tab bar

**Source:** Claude Code — Macbook Pro

`AskCoachButton` removed from the `ScrollView` and repositioned as `position: absolute` inside the `LinearGradient` container. Uses `useBottomTabBarHeight()` from `@react-navigation/bottom-tabs` to measure the exact tab bar height at runtime, then sets `bottom: tabBarHeight + 24` so the button always clears the tab bar by ~24px regardless of device. `scrollContent.paddingBottom` set to 160px to prevent cards from hiding behind the fixed bar.

**Files:** `src/screens/FocusScreen.tsx`

---

### 2026-04-28: LastRunContextCard — title restructure + HR range body text

**Source:** Claude Code — Macbook Pro

Header collapsed to a single inline row: "**Last Run**  ·  5.2 km  ·  Yesterday  ·  As expected  ›" — using nested `<Text>` spans (demiBold title + regular dimmer meta on the same line). Body text now built from run fields, format: *"A solid run at 4:54/km. Your effort of 148 BPM matched your expected range of 140–156 BPM"* with harder/easier variants. HR range is `expectedHR ± 8 BPM` (the verdict threshold). `hrRangeLow`/`hrRangeHigh` added to `LastRunContext` type and `ReadinessService`. Translation keys `body_as_expected/harder/easier` added to en/es. Removed `hrComparison` row and unused `verdictColor`.

**Files:** `src/types/focus.types.ts`, `src/services/ReadinessService.ts`, `src/components/focus/LastRunContextCard.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

### 2026-04-28: Fix false nap detection from adjacent 2-hour ring chunks

**Source:** Claude Code — Macbook Pro

**Root cause:** The X3 ring stores sleep in 2-hour paginated chunks. Each chunk has `totalSleepTime` = net sleep minutes (excluding awake). `deriveFromRaw` was using `totalSleepTime` to compute block end times, which undershot the actual chunk boundary. Example: chunk 1 (2:41–4:41 AM) with 60 min net sleep → block end = 3:41 AM → 60-min gap to chunk 2 (4:41 AM) → separate blocks. Both blocks were <180 min → neither was a night candidate → previous night chosen as "night", today's chunks became ring naps.

**Fix 1 (primary):** Changed `durationMin` in `normalizedAll` to always use `arr.length × unit` (recording period length) instead of `totalSleepTime`. The quality array already encodes awake minutes per-minute, so period length is always `arr.length × unit`. With correct period lengths, adjacent chunks have 0-min gaps and merge into one ≥180 min night block.

**Fix 2 (guard):** Added early-morning sleep-tail guard to ring nap filter: blocks with `startHour < 9 && endHour < 9` are never classified as naps (they're sleep fragments, not daytime naps). Belt-and-suspenders in case period-length fix doesn't cover an edge case.

**Verified via Supabase:** Only one sleep session exists for Apr 28 — a single night session from 2:41–6:40 AM (239 min). No nap sessions stored. The false nap was purely from ring-derived misclassification.

**File modified:** `src/hooks/useHomeData.ts`

---

### 2026-04-28: Sleep gap-fill — ultradian model for missing ring data

**Source:** Claude Code — Macbook Pro

When the ring fails to record the beginning of the night (hardware miss), and the user corrects their bedtime via the edit modal, the app now fills the unrecorded gap with estimated sleep stages using a standard ultradian architecture model.

**SleepGapFillService** (`src/services/SleepGapFillService.ts` — new):
Pure function `fillSleepGap(gapStart, gapEnd)` generates per-minute stages from an ultradian model (3 cycle templates: deep-heavy → balanced → REM-heavy). Groups consecutive same-stage minutes into `SleepSegment[]` objects, each with `isInferred: true`. Returns empty array if gap < 10 minutes.

**useHomeData.ts** wiring:
After applying a sleep time override, if the corrected bedtime is ≥10 minutes before the first real ring segment, calls `fillSleepGap` and prepends inferred segments. Also adds `gapMinutes` to `timeAsleepMinutes`/`timeAsleep` so the total sleep display is correct. Score is not recomputed — it remains based on real ring data only.

**SleepHypnogram.tsx** rendering:
- `SleepSegment.isInferred?: boolean` added to the interface
- Inferred rect blocks and connectors render at `opacity={0.4}` (visually distinct from confirmed data)
- A dashed vertical "RING ON" separator line appears at the boundary between inferred and real data
- BEDTIME stat shows `~11:00 PM` (tilde prefix) when estimated data is present
- `getXPosition` refactored to `useCallback` so `inferredBoundaryX` memoization works correctly

**SleepStagesChart.tsx**: Added `isInferred?: boolean` to its `SleepSegment` interface (same type used by useHomeData).

**Files modified:** `src/hooks/useHomeData.ts`, `src/components/home/SleepHypnogram.tsx`, `src/components/home/SleepStagesChart.tsx`
**Files created:** `src/services/SleepGapFillService.ts`

---

### 2026-04-28: Sleep time edit + stage verification + confirmed X3 sleep mapping

**Source:** Claude Code — Macbook Pro

Investigated why ring reported 2:41 AM bedtime (root cause: hardware didn't capture before that — not a code bug). Added two mitigations + permanent diagnostics:

**Manual sleep time editor** (`src/components/sleep/SleepTimeEditModal.tsx` — new):
Bottom-sheet modal with +/− hour/minute pickers for bed and wake time. Pencil icon in the hypnogram card header (`SleepTab.tsx`) opens it. Uses `SleepOverrideService` to persist overrides keyed by local date (`sleep_time_override_v1` in AsyncStorage). On save, calls `homeData.refresh()` to re-derive sleep from ring data with the corrected times applied.

**SleepOverrideService** (`src/services/SleepOverrideService.ts` — new):
AsyncStorage CRUD for `{ bedTime, wakeTime }` overrides. `dateKey()` uses local `getFullYear/getMonth/getDate` (not UTC `.toISOString()`) to avoid midnight-timezone bug. Applied in `useHomeData.ts` after ring sync — patches `finalSleepData.bedTime/wakeTime/inBedTime` if an override exists for today.

**Sleep stage mapping confirmed** (`src/hooks/useHomeData.ts`, `X3_JSTYLE_SDK.md`, `CLAUDE.md`, `src/utils/ringData/sleep.ts`):
Definitive confirmation from SDK demo `infoView.m`: 1=Deep, 2=Light, 3=REM, other=Awake. `mapSleepType` in `useHomeData.ts` updated to reflect this (was previously wrong for case 3). Metro log added: `🛏️ [stages] deep=Xm light=Ym rem=Zm awake=Wm` — confirmed 51m REM on first real run.

**Permanent Xcode NSLog** (`ios/JstyleBridge/JstyleBridge.m`):
`handleSleepData:` now logs last 3 records' raw quality arrays when pagination completes (`🛏️ [raw][N] startTime Nmin unit=N stages=1,2,3,...`). Permanent — not a one-off.

**Type 82 investigation + removal**: Temporarily added `getSleepAndActivityData` / `handleSleepAndActivityData` to compare type 82 vs type 27. Confirmed type 82 has identical 2-hour chunking — no advantage for missing bedtime data. All type82 diagnostic code removed.

**CoachMode deduplication** (`src/types/focus.types.ts`): `CoachMode = 'coach' | 'analyst'` moved to shared types file; removed duplicate definitions from `AskCoachButton.tsx` and `AIChatScreen.tsx`.

**Files modified:** `ios/JstyleBridge/JstyleBridge.m`, `src/hooks/useHomeData.ts`, `src/screens/home/SleepTab.tsx`, `src/types/focus.types.ts`, `src/components/focus/AskCoachButton.tsx`, `src/screens/AIChatScreen.tsx`, `X3_JSTYLE_SDK.md`, `CLAUDE.md`, `src/utils/ringData/sleep.ts`
**Files created:** `src/services/SleepOverrideService.ts`, `src/components/sleep/SleepTimeEditModal.tsx`
**Xcode rebuild required** for NSLog to appear in Console.app.

---

### 2026-04-28: Coach UI polish — bold input, chip spacing, conversational LastRunContextCard

**Source:** Claude Code — Macbook Pro

Three visual changes to the coach interface:

1. **Input bold** (`AIChatScreen.tsx`): `styles.input.fontFamily` changed from `regular` to `demiBold` — applies to both the typed text and the placeholder ("Ask your coach anything...").

2. **Chip-to-input spacing** (`AIChatScreen.tsx`): `inputContainer.marginTop` increased from 8 → 20, creating more breathing room between the suggestion chips and the input field.

3. **LastRunContextCard conversational rewrite** (`LastRunContextCard.tsx`): Explanation text is now plain voice (no italic, no quotes), 17px to match the input placeholder size. Added "Talk this through →" chip that deep-links to the coach with the explanation pre-filled as a query. HR comparison line kept as a dimmer supporting detail. Translation keys `last_run.talk_through` added to `en.json` + `es.json`.

**Files:** `src/screens/AIChatScreen.tsx`, `src/components/focus/LastRunContextCard.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

### 2026-04-28: AskCoachButton — dark BlurView card + clean toolbar

**Source:** Claude Code — Macbook Pro

Card background replaced with `BlurView intensity=60 tint="dark"` + `rgba(0,0,0,0.35)` overlay — gives a frosted dark glass look. Border moved to `wrapper` so `overflow: hidden` clips the blur correctly to the border radius. AI icon and mode selector grouped in a single `modeGroup` row (no borders, no bg on either element). Send button unchanged.

**Files:** `src/components/focus/AskCoachButton.tsx`

---

### 2026-04-28: Sleep — Stage mapping fix + manual bedtime editor

**Source:** Claude Code — Macbook Pro

**What changed:**

**Bug fix — sleep stage enum was wrong (3↔4 swapped):**
The `mapSleepType` function in `useHomeData.ts` had `3 → 'rem'` and `4 → 'awake'` (falls to default), but X3 SDK docs (`X3_JSTYLE_SDK.md`) say `3 = Awake`, `4 = REM`. This caused every awake period to render as REM and every REM period to show as awake in the hypnogram. Fixed to `3 → 'awake'`, `4 → 'rem'`. Also corrected the stale comment in `sleep.ts` (was documenting QCBand enum, not X3) and the wrong line in `CLAUDE.md`.

**Diagnosis — why ring showed 2:30 AM as bedtime:**
From Metro logs: the ring only synced 2 records for last night (2:41 AM and 4:41 AM), nothing before that. The prior night block ends at 6:45 AM Apr 27, and there is a 20-hour gap to the next record at 2:41 AM Apr 28 — the ring simply didn't capture (or lost) the earlier part of the night. Bridge pagination and `parseStart` were confirmed correct. This is a hardware data-capture issue, not a parsing bug.

**New feature — manual sleep time editor:**
Pencil icon added to the sleep hypnogram card header (next to the info button). Tapping opens a bottom-sheet modal with +/− time pickers for "In Bed" and "Wake Up" times. Override is persisted to AsyncStorage (`sleep_time_override_v1`, keyed by local date). On next sync, `useHomeData` reads the override and replaces `bedTime`/`wakeTime`/`inBedTime` in `finalSleepData` before committing to state. "Reset to Ring Data" button clears the override.

**Simplify fixes applied:**
- `CoachMode` type was duplicated in `AskCoachButton.tsx` and `AIChatScreen.tsx` — moved to `focus.types.ts`, imported in both files
- `clamp()` dead function removed from `SleepTimeEditModal.tsx`
- `handleSave` wrapped in try/catch/finally so `saving` always resets even on AsyncStorage error
- `dateKey()` in `SleepOverrideService` was using `toISOString().slice(0,10)` (UTC) — switched to local `getFullYear/getMonth/getDate` to avoid wrong date at midnight in UTC+ timezones
- Empty `catch {}` on override read replaced with `console.warn`

**Files created:**
- `src/services/SleepOverrideService.ts` — AsyncStorage CRUD for per-day sleep time overrides
- `src/components/sleep/SleepTimeEditModal.tsx` — Bottom-sheet modal with +/− hour/minute pickers for bed and wake time

**Files modified:**
- `src/hooks/useHomeData.ts` — Fixed `mapSleepType` (3=awake, 4=rem), added `getSleepOverride` import + apply after ring sync, `console.warn` on catch
- `src/screens/home/SleepTab.tsx` — Added `editModalVisible` state, pencil icon in hypnogram card `headerRight`, `SleepTimeEditModal` mount
- `src/types/focus.types.ts` — Added `export type CoachMode`
- `src/components/focus/AskCoachButton.tsx` — Removed local `CoachMode` type, imports from `focus.types`
- `src/screens/AIChatScreen.tsx` — Removed local `CoachMode` type, imports from `focus.types`
- `src/utils/ringData/sleep.ts` — Corrected enum comment (was QCBand, now X3)
- `CLAUDE.md` — Corrected sleep quality enum note

**Key notes:**
- The stage mapping bug (3↔4) was present since the hypnogram was built — all historical sleep hypnograms had awake/REM swapped
- Record [0] in the logs (`arraySleepQuality.length=undefined`, 119 min) is the active/unsettled session — those minutes fill as `awake` (stage 0 → default). Normal behavior
- Bridge/SDK fetching confirmed correct: `handleSleepData` paginates on `parsed.dataEnd`, 69 records returned across 2 pages, matches demo pattern
- Manual override applies only to `bedTime`/`wakeTime`/`inBedTime` display fields — segments and score still come from ring data

---

### 2026-04-28: IllnessWatchCard — Siri-style multi-hue gradient border

**Source:** Claude Code — Macbook Pro

**What changed:**
- Card border is now a 1.5px `LinearGradient` wrapper (diagonal, top-left → bottom-right) with a 4-stop per-state palette: CLEAR → green/teal/blue, WATCH → amber/orange/gold, SICK → red/crimson/rose. This replaces the flat `rgba(255,255,255,0.15)` border.
- Outer shadow (`glowWrap`) now uses the live status color instead of white, so the ambient glow is also state-colored.
- Inner edge fades dialed back from 80% to 20% opacity — subtle inward bleed rather than a strong tint.
- Status dot in the card header uses the live status color.

**Files modified:** `src/components/focus/IllnessWatchCard.tsx`

---

### 2026-04-27: Coach mode selector — AskCoachButton toolbar + ActionSheet

**Source:** Claude Code — Macbook Pro

Redesigned the coach input area into two rows: text input ("Hey coach...") on top, then a toolbar row: **AI icon** (left) | **Mode + chevron** (center) | **Send arrow** (right). Tapping the mode button opens a native iOS dark `ActionSheetIOS` (`userInterfaceStyle: 'dark'`) to choose Coach or Analyst. Removed `ModePill`. Added `ChevronDownIcon`. `inputContainer` is now a plain text wrapper; toolbar lives below it inside the same `inputWrapper`.

Backend (`coach-chat`): `mode` field added — Analyst uses `claude-sonnet-4-6` + extended thinking (10k budget, `interleaved-thinking-2025-05-14` beta), Coach keeps Haiku. `TypingIndicator` shows "Thinking deeply..." for Analyst.

---

### 2026-04-28: IllnessWatchCard — moved below timeline + all-edge status color

**Source:** Claude Code — Macbook Pro

**What changed:**
- Card moved to the bottom of the overview scroll, below the Daily Chronology Timeline.
- All four edge gradients (`edgeLeft`, `edgeRight`, `edgeTop`, `edgeBottom`) now use `collarColor + 'CC'` → `collarColor + '00'`, so the full perimeter glows in the illness state color (green/amber/red).

**Files modified:** `src/components/focus/IllnessWatchCard.tsx`, `src/screens/home/OverviewTab.tsx`

---

### 2026-04-28: IllnessWatchCard — added to Today overview + status-colored collar

**Source:** Claude Code — Web

**What changed:**
- **Today overview now includes the illness card.** `IllnessWatchCard` is mounted in `OverviewTab` between the Sleep Score and the Daily Heart Rate sections, fed from the existing `useFocusDataContext()` (no extra fetch). Tapping it still navigates to `/(tabs)/coach/illness-detail`.
- **Card "collar" follows the illness state.** The top-edge `LinearGradient` in `IllnessWatchCard` no longer uses a hard-coded white tint; it now reads `statusColor(status)` and renders a tinted-to-transparent gradient — green for `CLEAR`, amber for `WATCH`, red for `SICK`. The other three edges remain white for chrome consistency, but the top "collar" makes the illness state legible at a glance from the overview.
- **components.md updated** to document the new mount location and the status-colored collar.

**Files modified:** `src/components/focus/IllnessWatchCard.tsx`, `src/screens/home/OverviewTab.tsx`, `components.md`

---

### 2026-04-27: Coach tab — scroll-opacity cards + border beam animation + border radius polish

**Source:** Claude Code — Macbook Pro

**What changed:**
- **Scroll-driven opacity (FocusScreen):** IllnessWatchCard and LastRunContextCard start at 0.15 opacity and animate to full opacity as the user scrolls (~160px), matching Overview tab behavior. Uses `Reanimated.ScrollView` + `interpolate`.
- **Border beam (AskCoachButton):** SVG `strokeDashoffset` animation loops a 90px beam segment around the input's rounded border. Two layers — a wide soft glow (`strokeWidth 8, opacity 0.22`) and a crisp sharp beam (`strokeWidth 1.5, opacity 0.9`). Dimensions measured via `onLayout`; animation starts once layout is known.
- **AI input border radius:** Changed from 50 (pill) to 20 to match the metric cards.
- **Both focus cards get `borderWidth: 1` border** (`rgba(255,255,255,0.15)`).
- **LastRunContextCard:** Whole card pressable → navigates to Strava activity detail page; `stravaActivityId` added to `LastRunContext` type + `ReadinessService`.

**Files modified:** `src/screens/FocusScreen.tsx`, `src/components/focus/AskCoachButton.tsx`, `src/components/focus/IllnessWatchCard.tsx`, `src/components/focus/LastRunContextCard.tsx`, `src/types/focus.types.ts`, `src/services/ReadinessService.ts`

---

### 2026-04-27: FocusScoreRing — Deeper fade, subtitle bigger, body inline, metrics up

**Source:** Claude Code — Macbook Pro

Arc fade extended: transparent zone widened to offset 0.22 before any opacity starts, peak reduced to 0.88 — arc stays much closer to transparent at both endpoints. "Take it easy" bumped to `fontSize.xl` / `fontFamily.demiBold` / white. Body text moved from `metricsBlock` into the `hero` section, immediately below the subtitle (centered). `metricsBlock.marginTop` tightened from `spacing.xl` → `spacing.md`.

**Files modified:** `src/components/focus/FocusScoreRing.tsx`

---

### 2026-04-27: FocusScoreRing — All Content Inside Arc + Bi-Directional Fade

**Source:** Claude Code — Macbook Pro

All content now lives inside a single component: SVG arc is `position: absolute` behind a naturally flowing content column (`paddingTop: CY−66` to align the hero with the circle centre). Body text and all four metric rows are part of the same block — no separate `metricsSection` outside the arc. Arc gradient switched to a vertical gradient (from `y = CY+0.5R` transparent → `y = CY−R` bright): since both arc endpoints share the same y-level, they both fade to transparent simultaneously — start AND finish fade.

**Files modified:** `src/components/focus/FocusScoreRing.tsx`

---

### 2026-04-27: LastRunContextCard — Glassmorphic Chrome (parity with IllnessWatchCard)

**Source:** Claude Code — Macbook Pro

**What changed:** Applied identical glassmorphic treatment as IllnessWatchCard — `BlurView systemUltraThinMaterialDark`, 4 edge `LinearGradient` fades (outer 15%, opacity 0.22), outer white shadow glow wrapper. Icon removed. Title "Last Run" is now 22px demiBold, no uppercase, with distance + date as subtitle below. Body text lifted to white. CTA button now white bg + black text per design rule. Collapse chevron uses `Ionicons chevron-up/down` instead of text glyphs.

**Files modified:** `src/components/focus/LastRunContextCard.tsx`

---

### 2026-04-27: FocusScoreRing — Subtitle Inside Arc, Score Bigger, Metrics Below

**Source:** Claude Code — Macbook Pro

Restructured the coach ring layout: "Take it easy" (subtitle) now lives inside the arc directly below the score number. Score bumped 68 → 82px (`digitHeight: 84`). `CONTENT_TOP` recalculated for taller block (READINESS + score + subtitle ≈ 132px → `CY - 66`). `metricsSection` now shows body explanation + metric rows only.

**Files modified:** `src/components/focus/FocusScoreRing.tsx`

---

### 2026-04-27: HR Trends — Cover Card on Trends Tab + Detail Screen

**Source:** Claude Code — Macbook Pro

**Change:** Added Heart Rate trends end-to-end: `HRTrendCover` card on the Trends tab (same pattern as Sleep/Recovery/Activity/Running covers) + `/detail/hr-trends` full detail screen with three metrics (Resting HR line, Average HR bar, HRV SDNN bar) and daily/weekly/monthly range switching. Entry point is the Trends tab, not the HR detail screen.

**Files created:**
- `app/detail/hr-trends.tsx` — Route shell: `<TrendsDetailScreen domain="hr" />`
- `src/components/trends/HRTrendCover.tsx` — Cover card for the Trends tab; shows today's resting HR, 30-day line chart, baseline comparison subtitle, trend status line ("↓ Resting HR trending down"), sub-stats: RHR / Avg HR / HRV; taps to `/detail/hr-trends`
- `src/components/detail/TrendsNavRow.tsx` — Reusable bordered row with label + chevron (for future wiring of other detail screens to their trend pages)

**Files modified:**
- `src/screens/TrendsScreen.tsx` — Added `<HRTrendCover baselines={baselines} />` after `RecoveryTrendCover`
- `src/screens/trendsDetail/domains.ts` — Added `'hr'` to `DomainKey`, `HR_METRICS` (restingHR/avgHR/sdnn), `HR_DOMAIN`
- `src/hooks/useTrendsData.ts` — Added `hrHistory` + `hrvHistory` hooks (gated by `enabled: isHRDomain`), merged into `Map<dateKey, DayHRTrendsData>`; updated `isLoading`
- `src/hooks/useMetricHistory.ts` — Added `DayHRTrendsData` interface; added `enabled` option (default `true`) to skip fetches for inactive domains
- `src/screens/TrendsDetailScreen.tsx` — Added `hr: HR_DOMAIN` to `DOMAIN_MAP`
- `src/i18n/locales/en.json` — Added `trends.hr_title/hr_improving/hr_declining/hr_stable/avg_hr_label/hrv_label` + `trends_detail.domain.hr` + metric keys
- `src/i18n/locales/es.json` — Same keys in Spanish

**Key notes:**
- Trend direction for HR is inverted vs HRV: `dir === 'down'` → improving (lower resting HR = better cardiovascular fitness)
- `enabled` gate prevents HR/HRV Supabase queries when user is on Sleep/Activity/Recovery trends screens
- `DayHRTrendsData` merges `DayHRData` + `DayHRVData` per-dateKey at the `rawData` level in `useTrendsData`

---

### 2026-04-27: FocusScoreRing — Add Recommendation Body Text

**Source:** Claude Code — Macbook Pro

Added a one-line explanation below the recommendation title (e.g., "Recovery is partial. Keep today's effort light to let your body finish the repair."). Added `body_go`, `body_easy`, `body_rest` keys to `en.json` and `es.json`. Rendered as `styles.metricBody` (`fontSize.sm`, `rgba(255,255,255,0.45)`, `lineHeight: 20`) between the title and the metric rows.

**Files modified:** `src/components/focus/FocusScoreRing.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

### 2026-04-27: IllnessWatchCard — Glassmorphic Chrome + Title Refinement

**Source:** Claude Code — Macbook Pro

**What changed:** Card chrome replaced with true glassmorphism — `BlurView intensity={60} tint="dark"` lets the Coach tab's red background bleed through. Added a dark overlay (`rgba(8,8,20,0.45)`) to deepen the glass, a double-border effect (outer `rgba(255,255,255,0.18)` + inner inset ring `rgba(255,255,255,0.10)` at 1px inset) to reproduce the glowing-border look from the reference screenshot. Top-edge `LinearGradient` inner glow retained. Shield icon removed. Title is now 18px, semibold (`fontFamily.demiBold`), no uppercase.

**Files modified:** `src/components/focus/IllnessWatchCard.tsx`

---

### 2026-04-27: IllnessWatchCard — Always Expanded + Dark-Navy Chrome + White Content

**Source:** Claude Code — Macbook Pro

**What changed (user-visible):**
- Card is now always expanded — all 5 signal rows (Nocturnal HR, HRV, SpO₂, Skin Temp, Sleep) are visible immediately, no expand toggle.
- Tapping anywhere on the card opens the Illness Detail screen. The "View full analysis →" CTA is removed (redundant).
- New visual chrome: dark-navy background (`colors.surface` / `#1A1A2E`), hairline white border (`rgba(255,255,255,0.08)`), and a subtle white top-edge inner glow (linear gradient `rgba(255,255,255,0.10)` → transparent).
- Header chevron is now `Ionicons chevron-forward` (visual only); status score/dot/CLEAR-WATCH-SICK keep their color.
- All body text is white. Severity pills for `normal` signals are white; `mild`/`moderate`/`severe` pills keep yellow/orange/red as warning flags.

**Files modified:** `src/components/focus/IllnessWatchCard.tsx`

---

### 2026-04-27: FocusScoreRing — Full Redesign: Metrics Inside Ring + White Arc

**Source:** Claude Code — Macbook Pro

Redesigned `FocusScoreRing` with two modes: full (when `readiness` prop is provided) and compact (AIChatScreen artifact — unchanged interface).

**Inside the arc**: "READINESS" label (uppercase, letterSpacing 1, `rgba(255,255,255,0.6)`) + `RollingNumber` score at 68px/digitHeight 72 — same rolling-digit animation as overview hero.

**Gradient fix**: extended the full-transparent zone with two zero-opacity stops at offsets 0 and 0.15 before the fade begins (0 → 0 → 0.35 → 0.72 → 0.95), ensuring a complete fade to transparent at the arc start.

**Below the arc** (full mode): recommendation subtitle title (e.g., "Take it easy") + 4 `MetricRow` components — HRV, Sleep, Resting HR, Training — each with white track/fill bars (`rgba(255,255,255,0.1)` track / `rgba(255,255,255,0.7)` fill) and muted white status labels. Loading skeleton rows shown when `isLoading`.

**FocusScreen**: passes `readiness={focusData.readiness}` to ring, `ReadinessCard` removed from the scroll view (still exists for AIChatScreen artifacts).

**Files modified:** `src/components/focus/FocusScoreRing.tsx`, `src/screens/FocusScreen.tsx`

---

### 2026-04-27: FocusScoreRing — Semicircle Arc with White Gradient

**Source:** Claude Code — Macbook Pro

Rebuilt `FocusScoreRing` from scratch. Full-circle ring replaced with a 240° semicircle arc (open gap of 120° at the bottom, endpoints at 8 o'clock and 4 o'clock). Track is barely visible (`rgba(255,255,255,0.08)`). Filled arc uses a `linearGradient` from transparent at the start edge (bottom-left) to `rgba(255,255,255,0.95)` at the top, fading in as progress increases. Glow at the tip: 3 nested circles (dim halo → mid ring → bright dot). Score text bumped to 68px, "Readiness" label below in muted white, pill changed to border-only (white border + white text). SVG sized to full usable width (`SCREEN_W - 48`), arc geometry computed from first principles using SVG clockwise angles.

**Files modified:** `src/components/focus/FocusScoreRing.tsx`

---

### 2026-04-27: FocusScreen — Remove Title and Date from Coach Tab

**Source:** Claude Code — Macbook Pro

Removed the header block (title + date subtitle) from FocusScreen entirely. Coach tab now goes straight into the score ring with no text header. Cleaned up `useTranslation`, `getTodayLabel`, `Text`, `fontFamily`, `fontSize` — all now unused.

**Files modified:** `src/screens/FocusScreen.tsx`

---

### 2026-04-27: FocusScreen + AskCoachButton — Dark Input Style, Bolder Header

**Source:** Claude Code — Macbook Pro

Restyled `AskCoachButton` to match `AIChatScreen`'s input bar: translucent dark background (`rgba(255,255,255,0.1)`), white border (`rgba(255,255,255,0.25)`), pill radius (50), white text/placeholder, white icon (70% opacity), circular dark send button (`rgba(0,0,0,0.45)`) with up-arrow instead of right-arrow. Fixed Coach screen header not registering visually — bumped title to `fontFamily.demiBold` / `fontSize.xxl` (was `regular`/`lg`) and subtitle to `fontSize.md` at 45% white opacity.

**Files modified:** `src/components/focus/AskCoachButton.tsx`, `src/screens/FocusScreen.tsx`

---

### 2026-04-27: FocusScreen — Simplified Header, Removed BaselineJourneyCard

**Source:** Claude Code — Macbook Pro

Replaced the two-column header (bold title left + date right) with a centered minimal header matching the AIChatScreen style: "Coach" title centered in `fontFamily.regular`/`fontSize.lg`, today's date as a muted subtitle below. Removed `BaselineJourneyCard` (the "To reach…" tips block) and its loading skeleton — they no longer render on the Coach tab. Cleaned up `daysLogged` variable and `BaselineJourneyCard` import.

**Files modified:** `src/screens/FocusScreen.tsx`

---

### 2026-04-27: TrendsDetailScreen — Purple Radial Gradient Background

**Source:** Claude Code — Macbook Pro

Added the same SVG-based radial gradient background used on all detail pages to `TrendsDetailScreen`. Wrapped root in a `View` (`#0A0A0F` bg) with an absolute `Reanimated.View` (FadeIn 600ms, height 480) containing two `RadialGradient`s (purple `#5B21B6` top-center, deep indigo `#1E1B4B` top-right) plus a vertical `LinearGradient` fade to solid at the bottom. `SafeAreaView` sits on top of the gradient layer.

**Files modified:** `src/screens/TrendsDetailScreen.tsx`

---

### 2026-04-27: Caffeine Gauge — Raw mg Display + Inline Bar Chart on Overview

**Source:** Claude Code — Macbook Pro

**Change:** When the overview gauge is in the caffeine phase, the center now shows the raw mg value in system ("112 mg") instead of the abstract "72% clearance" percentage. A compact adenosine bar chart (160px) with a colored phase strip appears directly below the gauge, and the insight text slot switches from the generic recovery message to a caffeine-specific line showing the window close time and top available beverages (e.g. "Window open until 2:30 PM. You can still have an Espresso or Green tea."). The `CaffeineWindowCard` bezier-curve cover is hidden when this phase is active to avoid duplication.

**Files created:**
- `src/components/detail/CaffeineBarChart.tsx` — Shared `CaffeineBarChart` (PK-modeled bar chart), `CaffeineWindowPhaseBar` (colored pre/open/closed strip), and `DrinkSuggestions` components extracted for reuse across OverviewTab and adenosine-detail

**Files modified:**
- `src/components/home/SemiCircularGauge.tsx` — Added optional `displayValue?: number` and `displayUnit?: string` props; center text shows these when provided instead of the animated score + `%`
- `src/utils/overviewGaugePhase.ts` — Added `displayValue` and `displayUnit` to `GaugePhase` interface; caffeine phase sets `displayValue = Math.round(caffeineCurrentMg)` and `displayUnit = 'mg'`
- `src/screens/home/OverviewTab.tsx` — Expanded `useCaffeineTimeline` destructuring; added caffeine window computations (`getSleepHours`, `clearanceHour`, `recommendedWindow`, `activePhase`); inserted caffeine bar chart section below gauge; updated `insightText` for caffeine phase; hides `CaffeineWindowCard` when phase is caffeine; passes `caffeineEntries` to `DailyTimelineCard`
- `src/components/home/CaffeineWindowCard.tsx` — Replaced inline `validDate` + wakeHour/bedHour pattern with `getSleepHours()`
- `src/utils/time.ts` — Added `getSleepHours(wakeTime?, bedTime?)` utility that handles post-midnight bedtimes and missing data defaults (eliminates a repeated 3-site pattern)
- `src/i18n/locales/en.json` — `overview.caffeine_clearance` → "IN YOUR SYSTEM" (gauge label)
- `src/i18n/locales/es.json` — `overview.caffeine_clearance` → "EN TU SISTEMA"

**Key notes:**
- Arc fill still uses clearance % (72%) — high = mostly cleared, which matches "good = high" gauge semantics. Only the center number and unit change.
- `caffeineActivePhase` is time-based (window.start/end), same logic as in adenosine-detail. Phase bar uses `clearHour ?? window.end` for the open segment end.
- `CaffeineBarChart.tsx` is the shared component; `adenosine-detail.tsx` retains its own inline versions (they differ slightly — the detail uses `totalBars * 4` at 0.25h resolution vs the original 0.5h; the new shared component uses 0.25h resolution matching adenosine-detail).

---

### 2026-04-27: Trends Detail Template — Sleep Trends Screen (Phase 1)

**Source:** Claude Code — Macbook Pro

**Change:** Added a new "trends-over-time" layer to the Trends tab. Tapping any cover card now opens a new full-screen trends page for that domain, showing Daily / Weekly / Monthly views for every key metric. Built as a single generic `TrendsDetailScreen` parameterized by a `TrendsDomain` config — all 4 covers (Sleep, Recovery, Activity, Running) route to it. Phase 1 fully implements the Sleep domain (9 metrics); Recovery/Activity/Running show a "Coming soon" empty state until Phases 2–4.

**Files created:**
- `src/utils/sleepDerivations.ts` — Pure functions: `deriveLatencyMin`, `deriveSleepOnset`, `deriveEfficiency`, `deriveTimeInBedMin`, `toNightDecimalHour`, `toDecimalHour`, `formatClockHour`, `formatMinutes`
- `src/screens/trendsDetail/domains.ts` — `TrendsDomain` + `MetricDefinition` types; `SLEEP_DOMAIN` (9 metrics with extract functions), stub domains for Recovery/Activity/Running
- `src/hooks/useTrendsData.ts` — Unified data hook: wraps `useMetricHistory('sleep')`, builds 14-day / 8-week / 6-month buckets, aggregates per-metric series (mean / sum / medianClockTime)
- `src/components/trendsDetail/RangeModeTabs.tsx` — 3-pill segmented control (Daily / Weekly / Monthly)
- `src/components/trendsDetail/ClockTimeBarChart.tsx` — Wraps `TrendBarChart` for clock-time metrics (bedTime, sleepOnset, wakeTime); decimal-hour Y axis with domain-specific range
- `src/components/trendsDetail/MetricSection.tsx` — Per-metric card: label + current value header, bar/clockTime chart, avg/min/max sub-stats row; borders only (no bg fill)
- `src/screens/TrendsDetailScreen.tsx` — Generic screen: gradient bg matching domain color, nav row with `BackArrow` + domain chip, hero title, `RangeModeTabs`, stacked `MetricSection` list
- `app/detail/sleep-trends.tsx` — Route shell → `<TrendsDetailScreen domain="sleep" />`
- `app/detail/recovery-trends.tsx` — Route shell → `<TrendsDetailScreen domain="recovery" />`
- `app/detail/activity-trends.tsx` — Route shell → `<TrendsDetailScreen domain="activity" />`
- `app/detail/running-trends.tsx` — Route shell → `<TrendsDetailScreen domain="running" />`

**Files modified:**
- `app/_layout.tsx` — Registered 4 new `Stack.Screen`s: `detail/sleep-trends`, `detail/recovery-trends`, `detail/activity-trends`, `detail/running-trends` (all `slide_from_right`)
- `src/components/trends/SleepTrendCover.tsx` — `router.push` changed to `/detail/sleep-trends`; removed local `formatMinutes` copy, now imports from `sleepDerivations`
- `src/components/trends/RecoveryTrendCover.tsx` — `router.push` changed to `/detail/recovery-trends`
- `src/components/trends/ActivityTrendCover.tsx` — `router.push` changed to `/detail/activity-trends`
- `src/components/trends/RunningTrendCover.tsx` — `router.push` changed to `/detail/running-trends` (was `/(tabs)/coach/strava`)
- `src/i18n/locales/en.json` — Added `trends_detail` block: screen_title, coming_soon, domain labels, range labels + descriptions, 9 metric labels, stat labels (avg/min/max), trend direction labels
- `src/i18n/locales/es.json` — Full Spanish translation of `trends_detail` block

**Key notes:**
- Sleep 9 metrics: BedTime, DeepSleep, LatencyMin, SleepScore, Efficiency (Oura formula), TimeInBed, SleepOnset, WakeTime, TotalSleep
- Latency and SleepOnset derived from `DaySleepData.segments` (first non-awake segment marks sleep onset; sum of leading awake duration = latency)
- Clock-time metrics (BedTime, SleepOnset, WakeTime) use `toNightDecimalHour` (hours < 12 mapped to +24 to handle midnight crossover); Y range [18, 30] for bed/onset, [3, 13] for wake
- Daily = last 14 days, Weekly = last 8 Monday-anchored weeks, Monthly = last 6 months
- Existing `/detail/sleep-detail` (single-day deep-dive) stays untouched and remains reachable from Today/Overview cards
- `useTrendsData` always calls `useMetricHistory('sleep', { fullDays: 180 })` regardless of domain (React hook rules); non-sleep domains return empty series until Phase 2–4 adds their data branches
- Phase 2–4 only need: add `MetricDefinition[]` to the relevant domain stub + extend `useTrendsData` branch + wire i18n keys

---

### 2026-04-27: Coach → AI Chat — fade transition

**Source:** Claude Code — Macbook Pro

**Change:** Replaced the `fullScreenModal` (slide-up) presentation on `/chat` with `animation: 'fade'`. Since both FocusScreen and AIChatScreen share the same gradient background, the crossfade makes the background appear continuous — only the content elements fade in/out.

**Files modified:**
- `app/_layout.tsx` — `chat` Stack.Screen: removed `presentation: 'fullScreenModal'`, added `animation: 'fade'`

**Key notes:**
- All other routes unaffected (detail screens keep `slide_from_right`, settings/profile keep `slide_from_bottom`)
- Swipe-down dismiss is replaced by left-edge back gesture; close button on AIChatScreen handles dismissal anyway

---

### 2026-04-27: Coach tab — matching gradient background

**Source:** Claude Code — Macbook Pro

**Change:** The Coach tab (FocusScreen) now uses the same animated dark-red gradient background as the AI Chat screen — identical `LinearGradient`, animated overlay, and floating blob SVG that gently drifts in the top-right corner.

**Files modified:**
- `src/screens/FocusScreen.tsx` — Replaced plain `View` + `colors.background` with `LinearGradient` (`#000000` → `rgba(127,10,10,0.73)`), added `Reanimated` animated overlay gradient (breathing opacity 0→0.55 over 9.8s) and animated blob SVG (slow float translate over 7.2s). Removed unused `colors` import.

**Key notes:**
- Blob SVG, gradient stops, animation durations, and easing are identical to `AIChatScreen` for visual continuity.

---

### 2026-04-27: Custom heart icon SVG — replaced all Ionicons heart instances

**Source:** Claude Code — Macbook Pro

Replaced all `<Ionicons name="heart" />` and `heart-outline` icon usages with a custom SVG heart icon. Created `src/components/common/HeartIcon.tsx` (takes `size` and `color` props, uses react-native-svg). Applied to:
- `StyledRingScreen` — live HR icon (size 32, white)
- `AppleHealthScreen` — non-iOS placeholder and connect card (size 48, #FF375F), and the Heart Rate GlassDataCard header (size 20, via heart-outline string)
- `integrations.tsx` — Apple Health integration row icon (size 20, white)
- `DailyTimelineCard` — heart-outline chip icon for avg HR chips (size 10)

**Files modified:** `src/components/common/HeartIcon.tsx` (new), `src/screens/StyledRingScreen.tsx`, `src/screens/AppleHealthScreen.tsx`, `app/(onboarding)/integrations.tsx`, `src/components/home/DailyTimelineCard.tsx`

---

### 2026-04-27: Adenosine window — always wake-time based, never drink-based

**Source:** Claude Code — Macbook Pro

Fixed: logging a caffeine drink was shifting the adenosine window boundaries (pre/open/closed phases). Root cause: `openEnd` in both the cover card and detail screen was computed as `clearHour ?? win.end` — when drinks were logged `clearHour` (PK-model clearance time) replaced `win.end` as the boundary between "open" and "closed" phases, visually shrinking or expanding the colored blocks.

Fix: `openEnd` is now always `win.end` (derived purely from wake time via `recommendedWindow`). The caffeine clearance time (`clearHour`) is still shown as informational text ("Caffeine clears at X") but has zero effect on window boundaries or phase calculation. Also removed the now-unused `clearHour` prop from `WindowPhaseBar` and the dead `openEnd` local in `CaffeineBarChart`.

**Files modified:** `src/components/home/CaffeineWindowCard.tsx`, `app/detail/adenosine-detail.tsx`

---

### 2026-04-27: Timeline — caffeine drink events

**Source:** Claude Code — Macbook Pro

Added caffeine consumption to the Daily Chronology timeline. Each drink logged today appears as a green `cafe-outline` event in chronological order alongside sleep, naps, and activities. Label = drink name (or `drink_type`), detail = `"${mg}mg"`. Realtime updates propagate via `useCaffeineTimeline` already running in `OverviewTab`.

**Files modified:** `src/components/home/DailyTimelineCard.tsx` (new `caffeine` kind + `caffeineEntries` prop), `src/screens/home/OverviewTab.tsx` (hook call + prop)

---

### 2026-04-27: Adenosine detail — ghost bars, icon replace, cover Realtime fix

**Source:** Claude Code — Macbook Pro

Three visual/data fixes on the adenosine (caffeine) detail screen and its cover card:

1. **Ghost reference bars always visible** (`app/detail/adenosine-detail.tsx` — `CaffeineBarChart`): The ideal 400mg-at-window-open bar curve now renders persistently behind the real coffee bars as a dim ghost (`opacity: 0.10`). When drinks are logged, bright white real bars sit on top; the ghost bars are visible in slots not yet reached by actual caffeine. When nothing is logged the bars stay at `opacity: 0.22` (prior behavior). `placeholderBars` early-returns `bars` when `isPlaceholder=true` to avoid double PK computation.

2. **Emoji → Ionicons everywhere** (`adenosine-detail.tsx`): Removed the `drinkEmoji()` helper and all emoji `Text` elements. Three sites replaced with `<Ionicons name="cafe-outline" />`: drink marker icons above chart spikes (size 14), "what you can have now" suggestion cards (size 24), and the logged drink list rows (size 22). `DRINK_ICON_SIZE = 14` constant eliminates the magic half-size offset.

3. **Cover Realtime update fix** (`src/hooks/useCaffeineTimeline.ts`): Both the cover card (`CaffeineWindowCard` on Overview) and the detail screen instantiate `useCaffeineTimeline()`. They previously shared the hardcoded channel name `'caffeine-drinks-timeline'`, causing the cover's subscription to be shadowed when the detail screen mounted. Fixed with a module-level counter (`_subCounter`) that gives each hook instance a unique channel name (`caffeine-drinks-1`, `caffeine-drinks-2`, …). Cover now reacts to drinks logged in the detail screen in real time.

**Files modified:** `app/detail/adenosine-detail.tsx`, `src/hooks/useCaffeineTimeline.ts`

---

### 2026-04-27: Overview tab — background blur layer

Added a single `BlurView` (intensity 20, tint "dark", `absoluteFillObject`) inside `NewHomeScreen`'s `container` View, scoped to the overview tab only (`activeIndex === 0`). Rendered as the **first** child before `HomeHeader` and `contentWrapper` so it's naturally behind all UI without any explicit z-index. Only shown on overview — unmounts cleanly when switching to Sleep/Activity tabs.

**Why not inside OverviewTab**: The tab content lives inside a clipped horizontal `Animated.ScrollView` (`contentScroll`). On iOS, `UIVisualEffectView` (expo-blur) cannot capture the background image through a clipped scroll view ancestor, so the blur had no effect. Moving it to the `container` level (outside all scroll views) fixes this — it blurs the `ImageBackground` from `AnimatedGradientBackground` correctly across the full screen.

**Files modified:** `src/screens/NewHomeScreen.tsx` (blur added), `src/screens/home/OverviewTab.tsx` (reverted earlier attempt)

**Source:** Claude Code — Macbook Pro

### 2026-04-27: Readiness — Fix HRV baseline outliers + delete future-dated HR data

**Problem 1 (HRV baseline):** `bootstrapBaselinesFromSupabase` took the first HRV reading of the day by timestamp. If that first reading was an artifact (ring occasionally emits 110–145ms SDNN spikes), it baked a false "great HRV" day into the 14-day baseline, inflating the baseline median and making subsequent real readings score lower than they should.

**Fix:** Collect all `sdnn` values per day into `hrvValues[]`, then resolve to per-day median before building the rolling baseline. Median naturally ignores single outlier readings regardless of when in the day they occur. Bumped storage key to `focus_baselines_v3` so the on-device cache is invalidated and rebuilt on next open.

**Problem 2 (future-dated HR data):** Ring clock drift caused ~2,500 `heart_rate_readings` rows to be stored with timestamps from 2026-04-28 through 2026-08-17 (HR values 60–145 bpm). These were outside the 14-day baseline window today, but would have started entering it on May 11 and progressively corrupted the resting HR baseline through August. **Deleted all rows where `recorded_at > NOW()`.** Ring clock sync (wired in last session) prevents new bad rows.

**Files modified:** `src/services/ReadinessService.ts`
**DB change:** Deleted future-dated `heart_rate_readings` for user `b4cd394d-...`

**Source:** Claude Code — Macbook Pro

### 2026-04-26: Activity Detail — Upgraded to Standard Detail Template

**What changed:** Rewrote `app/detail/activity-detail.tsx` to match the established detail-screen template (same as HR, HRV, Recovery, Sleep).

- **Gradient background:** Added full-screen `RadialGradient` SVG background in activity blue (`#3B82F6`) via `Reanimated.View` with `FadeIn`.
- **TrendBarChart replaces DayNavigator:** 30-day interactive horizontal bar chart at top. User scrolls to select any of the last 30 days; bars are color-coded green/amber/blue by goal progress. `showValueLabels={false}` (step counts too wide for bar labels).
- **Animated headline:** Steps count (formatted as `8.2k`) collapses from 88px → 40px font as user scrolls down. Activity level badge fades out; compact chip slides in from the right — identical collapse pattern to HR detail.
- **Reanimated.ScrollView:** Replaced plain `ScrollView` with Reanimated version wired to `useAnimatedScrollHandler` for scroll-linked collapse.
- **No background fills:** Removed `backgroundColor` from all containers (insightBlock, chart wrapper, stats). Insight is now plain text matching HR pattern. No border-colored insight box.
- **Removed redundant StepsBarChart:** The embedded 7-day bar chart inside the scroll was removed — the `TrendBarChart` above already covers historical data.
- **`{ fullDays: 30 }` option:** Hook now fetches 30 days of activity history to populate the full trend chart.

**Source:** Claude Code — Macbook Pro

---

### 2026-04-26: Illness Watch Detail — Signal Card Redesign (Chart Baseline Pattern)

**What changed:** Rewrote all 5 SignalCard components on the Illness Watch detail screen to establish the new chart pattern that will be applied app-wide.

- **No card chrome:** Removed `backgroundColor`, `borderWidth`, `borderColor`, `padding`, `borderRadius` from `signalCard` — cards now sit flat on the dark screen background with only vertical spacing between them.
- **New header hierarchy:** Title (regular, 70% white) above a big bold white value + dimmed unit (e.g. "63 BPM"), replacing the former title+SeverityPill row.
- **Chart flush with title:** `CHART_PAD.left` set to 0 so the SVG left edge aligns with the card title.
- **Removed solid grid lines:** The 3 hardcoded horizontal lines (e.g. 122 / 88 / 55 on Nocturnal HR) and their Y-axis numeric labels are gone. The dashed baseline line is the only horizontal marker inside the chart.
- **Baseline legend below chart:** Three small dashes + "Baseline: 101 bpm" rendered below each chart, explaining what the dashed line represents.
- **Conditional warning:** A colored warning sentence appears below the legend only when that signal's severity is `mild | moderate | severe` (i.e. `rawSub > 0`). For `normal` severity it's hidden. Color matches `severityColor(severity)`.
- **Removed "Your value | Baseline" row:** That section below the chart is gone — the big value above + baseline legend replace it.
- 5 new i18n warning keys added to `en.json` + `es.json` with directionality-correct wording per signal.

**Source:** Claude Code — Macbook Pro

**Files modified:** `src/screens/IllnessDetailScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

### 2026-04-26: Health / Activity — Fix chip wording when activity is 0

**Problem:** Activity chip on the Health screen showed "NEEDS REST" (red) when activity score was 0, i.e. no data synced yet for today. The score function `getScoreTier(0)` correctly maps 0 to `needs_rest` for a real score, but 0 here means *no data*, not a poor performance day.

**Fix:** In `StyledHealthScreen.tsx`, special-cased `activityScore === 0`: chip label uses the new `health.no_data` key ("NO DATA" / "SIN DATOS") and chip color is a neutral dim white (`rgba(255,255,255,0.35)`) instead of red. Sleep and recovery chips are unaffected (they can legitimately score 0).

**Files modified:** `src/screens/StyledHealthScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

**Source:** Claude Code — Macbook Pro

## 2026-04-26: Sleep Hypnogram Cover — Show In-Bed Time in Header

**Source:** Claude Code — Macbook Pro

Added `inBedTime?: Date` to `SleepData` — the raw ring block start (when user got into bed), preserved before `trimAwakeEdges` strips the leading awake segments. Set in `buildBlockResult` as `new Date(block.start)`. Serialized/deserialized in the AsyncStorage cache alongside `bedTime`. The hypnogram `GradientInfoCard` `titleCaption` now shows `inBedTime` (falls back to `bedTime` if absent, e.g. Supabase-only sessions).

**Files modified:** `src/hooks/useHomeData.ts`, `src/screens/home/SleepTab.tsx`

---

## 2026-04-26: Sleep Hypnogram Cover — Show Bedtime in Header

**Source:** Claude Code — Macbook Pro

Added `titleCaption` to the hypnogram `GradientInfoCard` in `SleepTab` showing the bedtime (sleep onset time) formatted as a locale time string (e.g. "10:30 PM"). Uses `sleep.bedTime.toLocaleTimeString`.

**Files modified:** `src/screens/home/SleepTab.tsx`

---

## 2026-04-26: Sleep Hypnogram — Persist Segments in Cache

**Source:** Claude Code — Macbook Pro

**Problem:** After a successful ring sync, the sleep hypnogram was hidden during subsequent syncs on cold start because segments were explicitly cleared (`segments: []`) when loading from the `home_data_cache`.

**Fix:** Sleep segments are now cached alongside other sleep data in `AsyncStorage`. In `saveToCache()`, non-empty segments are serialized as ISO strings. In `loadFromCache()`, they are deserialized back into `SleepSegment` objects (with `Date` instances). If no segments were cached (e.g., Supabase-only fallback from a prior session), it falls back to `[]` as before.

**User-visible:** After the first successful ring sync, re-opening the app and waiting for the next sync will show the hypnogram immediately (using cached segments) rather than showing a blank space during the sync period.

**Files modified:** `src/hooks/useHomeData.ts` (CachedData interface, saveToCache, loadFromCache)

---

## 2026-04-25: Behavior-driven Overview Gauge (phase switching)

**Source:** Claude Code — Macbook Pro

**What changed:** The main semi-circular gauge on the Overview tab no longer shows a static "Overall Score." It now switches dynamically to the most relevant metric based on what's happening right now:

| Phase | Trigger | Metric shown |
|-------|---------|-------------|
| Wind-down (bedtime gate) | 120 min before → 6h past target bedtime | Debt + late-penalty score |
| Sleep | Within 2h of last wake-up | Last night's sleep score |
| Caffeine | Active caffeine ≥ 100 mg | Clearance % (how close to clean) |
| Strain | EWMA strain ≥ 60 | Strain score |
| Wind-down (evening gate) | After 20:00 if no other phase active | Pure debt score (readiness is meaningless at night) |
| Readiness | Default (daytime only) | Focus readiness score |

A 250 ms Reanimated crossfade hides the label/score swap when the phase changes. The `InfoButton` now opens the correct metric explainer for whichever phase is active (fixes the pre-existing `overall_score` label vs. `recovery_score` info-key mismatch).

**User-visible:** Morning after waking up → SLEEP SCORE. Afternoon coffee → CAFFEINE CLEARANCE. Evening near bedtime → WIND DOWN. Active training day → STRAIN. Otherwise → READINESS. Tapping the `i` button always opens the right explainer.

**Files created:**
- `src/utils/overviewGaugePhase.ts` — pure phase resolver + `deriveTargetBedtime()`
- `src/hooks/useOverviewGaugePhase.ts` — hook: composes contexts, ticks every 60s, guards against no-op re-renders
- `src/components/home/WindDownHero.tsx` — wind-down specific hero: moon icon + large bedtime + countdown + debt pill

**Files modified:**
- `src/components/home/SemiCircularGauge.tsx` — added `phaseKey` prop + Reanimated crossfade
- `src/screens/home/OverviewTab.tsx` — phase-conditional hero: `WindDownHero` when `gauge.key === 'wind_down'`, `SemiCircularGauge` otherwise
- `src/data/metricExplanations.ts` — added `wind_down` + `caffeine_clearance` to `MetricKey` union and `getMetricExplanations()`
- `src/i18n/locales/en.json` + `es.json` — added `overview.wind_down`, `overview.caffeine_clearance`, `overview.sleep_score` (uppercase) + explainer strings for both new keys

---

## 2026-04-25: Detail pages — gradient background fade-in animation

**Source:** Claude Code — Macbook Pro

**Change:** All 8 detail pages now animate their full-screen gradient background in with a 600ms Reanimated `FadeIn` on mount. The gradient was previously a static absolute-positioned SVG; it is now wrapped in a `Reanimated.View` with `entering={FadeIn.duration(600)}` and `pointerEvents="none"`, giving every detail page a subtle color bloom entrance.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Added `FadeIn` import, wrapped gradientBg SVG in Reanimated.View
- `app/detail/hrv-detail.tsx` — Same
- `app/detail/recovery-detail.tsx` — Same
- `app/detail/sleep-detail.tsx` — Same
- `app/detail/sleep-debt-detail.tsx` — Same
- `app/detail/spo2-detail.tsx` — Same
- `app/detail/temperature-detail.tsx` — Same
- `app/detail/adenosine-detail.tsx` — Same

**Key notes:**
- `pointerEvents="none"` on the wrapper ensures the absolutely-positioned View does not intercept any touch events from the scroll content beneath it.
- SVG changed from `style={styles.gradientBg}` to `width="100%" height="100%"` to fill the wrapper View; the `gradientBg` style (absolute positioning + height 480) now lives on the `Reanimated.View`.

---

## 2026-04-25: Adenosine detail — 15-min bar slots + full border radius

**Source:** Claude Code — Macbook Pro

- Doubled bar resolution from 30-min to 15-min slots (`* 2` → `* 4`, slot midpoint `0.5/0.25` → `0.25/0.125`).
- Reduced gap from 4px to 2px to keep bars visible at the narrower width.
- Replaced top-only rounded `Path` bars with `Rect rx={2} ry={2}` for equal radius on all corners.
- Removed now-dead `topRoundedRect` helper function.

**Files modified:** `app/detail/adenosine-detail.tsx`

---

## 2026-04-25: Fix MNaN SVG crash — validDate() guard on wakeTime/bedTime

**Source:** Claude Code — Macbook Pro

Fixed `InvalidNumber: MNaN,75.0` SVG crash caused by NaN propagating from invalid Date objects into chart path coordinates.

**Root cause:** When `lastNightSleep.wakeTime` or `bedTime` is an invalid Date (e.g. ring not yet synced), calling `.getHours()` returns `NaN`. `Math.max(NaN, 1) === NaN` in JS, so `timeSpan` becomes NaN, which propagates into every X coordinate in the SVG path (`MNaN,75.0`).

**Fixes applied (3 layers):**
1. `src/utils/caffeinePk.ts` — `buildMultiDoseCurvePath` now guards `if (!Number.isFinite(timeSpan) || timeSpan <= 0) return ''` before iterating.
2. `src/components/home/CaffeineWindowCard.tsx` — Added `validDate(d) = d instanceof Date && !isNaN(d.getTime())` helper; fallback to 7 (wake) and 23 (bed) when Date is invalid.
3. `app/detail/adenosine-detail.tsx` — Same `validDate()` guard applied to the main screen's `wakeHour`/`bedHour` derivation (this was the unpatched half that was still crashing).

**Files modified:** `src/utils/caffeinePk.ts`, `src/components/home/CaffeineWindowCard.tsx`, `app/detail/adenosine-detail.tsx`

---

## 2026-04-25: Adenosine — Dynamic Wake→Bed Time Axis (cover + detail)

**Source:** Claude Code — Macbook Pro

Both the cover chart and the detail bar chart now span exactly from `wakeHour` to `bedHour` instead of the fixed 6 AM → 11 PM window.

**Cover (`CaffeineWindowCard`):** Replaced module-level `TIME_START/END/SPAN` constants with `timeStart = wakeHour`, `timeEnd = bedHour`, `timeSpan = bedHour - wakeHour` computed inside the component. `tx()`, `buildMultiDoseCurvePath`, `peakMgForDoses`, and `clampedNow` all use these dynamic values. Time labels (`12PM`, `3PM`, etc.) are now filtered to only show hours that fall within the dynamic range.

**Detail bar chart (`CaffeineBarChart`):** Added `timeStart` and `timeEnd` props. `totalBars = ceil((timeEnd - timeStart) * 2)`, `slotW`, bar positions, `nowX`, and drink marker positions all computed from the dynamic span. Bars outside the window are filtered.

**Phase bar (`WindowPhaseBar`):** Added `bedHour` prop. `preFrac`, `openFrac`, `closedFrac` now use `timeSpan = bedHour - wakeHour`. Pre segment spans wakeHour → win.start; closed segment ends at bedHour. Since `wakeHour === timeStart`, the ☀ sun label is always at the left edge of the pre segment (simplified `wakeOffsetFrac = 0`).

**Files modified:** `src/components/home/CaffeineWindowCard.tsx`, `app/detail/adenosine-detail.tsx`

---

## 2026-04-25: CaffeineWindowCard — Self-Contained via Context + Full Phase Coverage

**Source:** Claude Code — Macbook Pro

- **Removed prop drilling** — `CaffeineWindowCard` now reads `wakeHour`/`bedHour` directly from `useHomeDataContext()`. Removed `CaffeineWindowCardProps` interface; `OverviewTab` no longer passes sleep-time props to the card.
- **Phase blocks span full chart** — Pre block restored to `bx1` (6 AM left edge). `"6AM"` label replaced with `"☀ {wakeTime}"` rendered at the actual wake-time X position, keeping full-width phase coverage while surfacing the correct reference point.

**Files modified:** `src/components/home/CaffeineWindowCard.tsx`, `src/screens/home/OverviewTab.tsx`

---

## 2026-04-25: Sleep Notification — Dedup Fix + Correct Duration in Push

**Source:** Claude Code — Macbook Pro

**Change:** Fixed two bugs: (1) multiple "sleep ready" notifications firing in the same morning due to concurrent scheduling paths racing past the AsyncStorage dedup check, and (2) the 9 AM server push showing total sleep window duration (including awake) instead of actual sleep time.

**Files modified:**
- `src/services/BackgroundSleepTask.ts` — Added `_schedulingInProgress` in-memory mutex (synchronous guard before the first async read); replaced the cancel-loop with a fixed `identifier: 'focus_sleep_ready'` on `scheduleNotificationAsync` so any subsequent schedule call atomically replaces the pending notification
- `supabase/functions/daily-summary-push/index.ts` — Added `deep_min, light_min, rem_min` to the morning session SELECT; compute `totalMin` from stage minutes (actual sleep) with `end_time - start_time` as fallback; deployed to production

**Key notes:**
- The server push was using `end_time - start_time` for the "You slept Xh Ym" body, which includes pre-sleep awake time in bed — now uses the same stage-sum calculation as the local notification
- Fixed identifier means scheduling from background task, MorningSleepReconnect, and NewHomeScreen foreground path all converge to one pending notification — last writer wins, no stacking
- `_schedulingInProgress` resets only if `scheduleSleepNotification` returns false (fire time past), so it stays locked for the rest of the day once scheduled — AsyncStorage handles cross-session persistence

---

## 2026-04-25: Adenosine — Huberman Window Timing + Phase Fix

**Source:** Claude Code — Macbook Pro

Three root-cause fixes for the broken phase windows:

1. **`recommendedWindow` updated to Huberman protocol** (`src/utils/caffeinePk.ts`):
   - Pre-window delay: `wakeHour + 1.5h` → `wakeHour + 2h` (120 min; Huberman: 90-120 min for cortisol peak to clear)
   - Window close: `bedHour - 10.75h` → `bedHour - 8h` (Huberman: 8-10h before bed; pharmacokinetically ~25 mg remains — well below 100 mg threshold)

2. **Phase zones now time-based, not dose-based** (both cover + detail):
   - Root bug: `clearanceHour` was called on `effectiveDoses` (which includes a 95 mg default baseline dose). Since 95 mg < 100 mg `SLEEP_THRESHOLD_MG`, clearance was reported as immediate — making the "open" window only 45 min wide.
   - Fix: `clearanceHour` now uses actual `doses` only. When no drinks are logged, `clearHour = null` and `win.end` is used as the fallback.
   - `activePhase` is now purely time-based (`nowHour < win.start → pre`, `≤ openEnd → open`, else `closed`), not dependent on which doses are present.

3. **Cover no longer shows phantom 95 mg curve** (`CaffeineWindowCard`):
   - Removed `withDefaultDose` / `effectiveDoses` entirely from the cover.
   - Curve renders only when real drinks are logged; empty state shows clean window zones with the 400 mg reference line.

**Terminology:** "cover" = overview-tab card component; "detail" = full-screen page. Saved to CLAUDE.md + memory.

**Files modified:** `src/utils/caffeinePk.ts`, `src/components/home/CaffeineWindowCard.tsx`, `app/detail/adenosine-detail.tsx`, `CLAUDE.md`

---

## 2026-04-24: Adenosine — Windows Use Actual Wake + Bed Time Per Day

**Source:** Claude Code — Macbook Pro

Both the overview card (`CaffeineWindowCard`) and the detail screen now derive the caffeine window from actual sleep data instead of hardcoded defaults.

- **`OverviewTab.tsx`**: passes `bedHour` computed from `sleep.bedTime` to `CaffeineWindowCard`. Post-midnight bedtimes (hour < 6) are offset by +24 so the pharmacokinetic formula stays consistent.
- **`adenosine-detail.tsx`**: replaces `bedHour = 23` with `homeData.lastNightSleep?.bedTime`, applying the same +24 offset for post-midnight values. Fixed the stale `[wakeHour]` dep in the `win` useMemo to include `bedHour`.

**Files modified:** `src/screens/home/OverviewTab.tsx`, `app/detail/adenosine-detail.tsx`

**Also fixed:** Supabase migration history orphan entries (`20260422`, `20260423`) repaired. Table `caffeinated_drinks` confirmed healthy (2 rows, correct schema + RLS). In-app "caffeine errors" were a Metro cache issue from component rewrites — clear cache with `npx expo start --clear`.

---

## 2026-04-24: Adenosine Detail — Bar Chart, Drink Markers, Y-Axis, Window Sync

**Source:** Claude Code — Macbook Pro

Rewrote the adenosine detail screen's main chart and supporting UI:

1. **Overview card Y-axis fixed at 400mg** — `CaffeineWindowCard` now uses `MIN_Y_SCALE = MAX_CAFFEINE_MG (400)` so the curve is always shown relative to the 400mg tolerance ceiling, not scaled to the peak value.

2. **Bar chart replaces line chart** — `CaffeineCurveChart` (line + drag-to-scrub) replaced with `CaffeineBarChart` showing PK-modeled caffeine per 30-min slot:
   - Phase-colored bars (orange = pre-window, teal = open, red = closed)
   - 2px floor bars at 18% opacity so the chart never appears empty with 0 caffeine
   - Y-axis gridlines + labels at 100, 200, 300mg
   - 400mg dashed tolerance line
   - Now-line marker

3. **Drink spike markers** — for each logged drink, a white dashed vertical line is drawn at the intake hour, and the drink's emoji is overlaid just above the spike via absolute positioning.

4. **Window phase bar below chart** — the 3-segment phase indicator (pre/open/closed) from the overview card is reused below the bar chart, proportionally sized to the day's time ranges.

5. **Drink suggestions** — below the phase bar, shows drinks from `CAFFEINE_PRESETS` that fit within the remaining caffeine budget (400 − currentMg). Closed window and limit-reached states show an empty state card. Border-only, no background.

6. **Log button** — white background (`#FFFFFF`) + black text (`#000000`) per design rule.

7. **Design rule documented** — "no background on components, borders only" added to CLAUDE.md Design Conventions + saved as feedback memory.

8. **Simplify fixes** — removed unused imports (`ActivityIndicator`, `SLEEP_THRESHOLD_MG`), removed unused `isLoading` destructure, lifted `win`/`clearHour` computation to parent (eliminating duplicate `recommendedWindow`/`clearanceHour` calls in child components), collapsed duplicate `DrinkSuggestions` early-return branches, memoized `peak`/`yScale`.

**Files modified:** `src/utils/caffeinePk.ts`, `src/components/home/CaffeineWindowCard.tsx`, `app/detail/adenosine-detail.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`, `CLAUDE.md`

---

## 2026-04-24: All Detail Screens — Full-Screen Gradient Background with Fade-to-Black

**Source:** Claude Code — Macbook Pro

Applied the gradient treatment from `spo2-detail` to all 7 remaining detail screens. Each screen's gradient SVG was moved from inside `gradientZone` (clipped by `overflow: hidden`) to a root-level absolute element (`gradientBg: position absolute, top 0, height 480`) that sits behind the header, bar chart, headline, and ScrollView.

**Changes per screen:**
- Radial gradient center shifted from `cy="-86%"` → `"-20%"` so the glow is visible inside the view
- Primary gradient: `rx/ry` widened, opacity raised to 1.0, fade stop extended to 70%
- Secondary gradient: `rx/ry` widened, opacity raised to 0.75
- Added `LinearGradient` fade overlay (transparent @ 40% → `#0A0A0F` @ 100%) applied as third Rect
- `gradientZone` style: removed `overflow: 'hidden'`
- Added `gradientBg` style to each screen's StyleSheet
- Added `LinearGradient` to SVG imports where missing (hrv, recovery, sleep-debt, adenosine)

**Files modified:** `sleep-detail.tsx`, `heart-rate-detail.tsx`, `hrv-detail.tsx`, `adenosine-detail.tsx`, `temperature-detail.tsx`, `recovery-detail.tsx`, `sleep-debt-detail.tsx`

---

## 2026-04-24: SpO2 Detail Chart — Fix Green Background, White Dots, Extended History

**Source:** Claude Code — Macbook Pro

Three fixes to `app/detail/spo2-detail.tsx` and `src/hooks/useMetricHistory.ts`:

1. **Removed green background** — Deleted the `<Rect fill="rgba(74,222,128,0.04)">` above the 95% threshold line in `SpO2LineChart`. The dashed green threshold line itself remains.
2. **White dots** — Reading dots in the intra-day chart now use `fill="#FFFFFF"` instead of the per-value `spo2Color()` (green/amber/red).
3. **Extended SpO2 history to 30 days** — `fetchSpO2History()` was hardcoded to `nDaysAgo(7)`. Added a `days` parameter (default 7) and updated the `spo2` switch case in `useMetricHistory` to pass `fullDays` (30), matching the 30-day bar chart range.

**Files modified:** `app/detail/spo2-detail.tsx`, `src/hooks/useMetricHistory.ts`

---

## 2026-04-24: Adenosine Curve — Dynamic Y-Scale (curve always reaches the top)

**Source:** Claude Code — Macbook Pro

**Change:** Fixed the curve appearing tiny in the chart. The Y-axis was fixed at 400 mg but the effective peak (default 95 mg baseline) only reached ~24% of the chart height. Now the Y-scale is computed dynamically from the peak of the effective doses, so the curve always fills the chart. Minimum scale is 150 mg so the 100 mg sleep-limit line is always visible.

**Files modified:**
- `src/utils/caffeinePk.ts` — Added `peakMgForDoses(doses, timeStart, timeEnd)` helper that samples `totalMgAt` across the day and returns the peak value.
- `src/components/home/CaffeineWindowCard.tsx` — Replaced fixed `Y_SCALE_MG = 400` constant with `yScale = max(ceil(peakMgForDoses(effectiveDoses)), 150)` computed via `useMemo`. `mgToY` now takes `yScale` as a parameter. Y-axis tick labels are dynamic: `[yScale, yScale/2, 0]`.
- `app/detail/adenosine-detail.tsx` — Same dynamic `yScale` applied to `CaffeineCurveChart`: gridlines, sleep threshold, NOW dot, and curve path all use `mgToY(mg, yScale)`.

**Key notes:**
- With only the 95 mg default baseline: `yScale = 150`, curve peaks at ~63% height, sleep limit at 67%. Visual accurately shows that a single 95 mg coffee stays just under the sleep threshold.
- When logged drinks push total above 150 mg: `yScale` equals the actual peak and the curve always reaches the chart top.
- Y-axis labels update live as drinks are logged (e.g., 95 → 190 when a second coffee is added).

---

## 2026-04-24: Adenosine Curve — Always-Present Baseline + Superposition

**Source:** Claude Code — Macbook Pro

**Change:** The adenosine curve now always shows a default baseline (wake time + 90 min, 95 mg) so it's never empty. When you log drinks they stack on top of that baseline via pharmacokinetic superposition — pushing the descending portion of the curve upward. Metrics (current mg, total today) still reflect only actual logged drinks, not the predicted baseline.

**Files modified:**
- `src/utils/caffeinePk.ts` — Added `DEFAULT_DOSE_MG = 95` constant and `withDefaultDose(loggedDoses, wakeHour)` helper that prepends a virtual 95 mg dose at `max(wakeHour + 1.5, 6.5)` to the logged dose array.
- `src/components/home/CaffeineWindowCard.tsx` — Replaced `doses` with `effectiveDoses = withDefaultDose(doses, wakeHour)` for chart path, clearance hour, phase blocks, and NOW dot. `hasDoses` still uses raw `doses.length > 0` for the "log first drink" footer hint. Removed the `curvePath !== ''` guard since there's always a curve now.
- `app/detail/adenosine-detail.tsx` — Added `effectiveDoses = withDefaultDose(doses, wakeHour)`, computes `clearHour` from `effectiveDoses`. `CaffeineCurveChart` receives `effectiveDoses`; `activePhase` derived from `effectiveDoses`. Headline current mg and MetricsGrid total/peak still come from logged `doses` only.

**Key notes:**
- Default dose intake hour is clamped to at least 6:30 AM so it never renders before the chart starts at 6 AM.
- "Superposition" is the natural result of the linear PK model — each dose's contribution sums independently, so the baseline + logged drinks are just `totalMgAt(t, effectiveDoses)`.

---

## 2026-04-23: Fix Adenosine Detail — Worklet Crash (phaseColor on UI thread)

**Source:** Claude Code — Macbook Pro

**Change:** Fixed crash on opening the Adenosine Details screen. `phaseColor(activePhase)` was called directly inside a `useAnimatedStyle` worklet, which runs on the UI thread and cannot call non-worklet JS functions.

**Files modified:**
- `app/detail/adenosine-detail.tsx` — Moved `const pColor = phaseColor(activePhase)` to before the `useAnimatedStyle` calls (line 364). The worklet now closes over the pre-computed plain string `pColor` instead of calling the function on the UI thread. Also removed a stale `const pColor` declaration that had ended up after the JSX return.

**Key notes:**
- Root cause: any regular function called inside `useAnimatedStyle`/`useAnimatedScrollHandler` must be decorated `'worklet'` or its result must be pre-computed in JS before the hook runs.
- The "adenosine curve broke" report was a consequence of the same crash — the screen never rendered, so the curve chart never appeared.

---

## 2026-04-23: Adenosine Log Sheet — Flat White + Scroll-Wheel Time Picker

**Source:** Claude Code — Macbook Pro

**Change:** Added "Flat White" to the drink presets (130 mg, double-ristretto-based) and replaced the ±15-min stepper for time input with a native-style 3-column scroll-wheel picker (hour / minute / AM·PM), implemented entirely in RN without extra dependencies.

**Files modified:**
- `src/utils/caffeinePk.ts` — Added `flat_white` preset (emoji ☕, 130 mg) between coffee and black_tea.
- `src/components/home/LogDrinkSheet.tsx` — Added `WheelCol` (snap-scroll column with momentum + drag-end handlers, `selectedIndex` scroll-to effect) and `TimeWheelPicker` (3-column layout with selection highlight band). Replaced old stepper with `<TimeWheelPicker value={consumedAt} onChange={setConsumedAt} />`. Removed unused `formatDecimalHour` import.
- `src/i18n/locales/en.json` + `es.json` — Added `adenosine.preset.flat_white` ("Flat white" / "Flat white").

**Key notes:**
- Wheel rows snap to `ROW_H = 44px` via `snapToInterval` + `decelerationRate="fast"`.
- Both `onMomentumScrollEnd` and `onScrollEndDrag` fire `handleScrollEnd` so slow drags without a flick also commit the selection.
- `useEffect` on `selectedIndex` calls `scrollTo` (animated after first mount, instant on mount) to keep the wheel in sync when external state changes (e.g., period switch flips the hour).
- `nestedScrollEnabled` on each column allows gesture coexistence with the BottomSheetModal.
- 9 presets (3×3 grid) still fit cleanly at `width: '30%'` tiles.

---

## 2026-04-23: SpO₂ Detail — HRDetail Structure (Gradient Zone + TrendBarChart)

**Source:** Claude Code — Macbook Pro

Rewrote `app/detail/spo2-detail.tsx` to match the HR/Temperature detail page structure.

- **Gradient zone**: blue radial gradient (`#3B82F6` / `#1D4ED8`) with `DetailPageHeader` + 30-day `TrendBarChart`. Bars colored green/amber/red by level (≥95% / 90–94% / <90%). Dynamic scale compresses to actual data range (SpO2 clusters 95–100% so fixed 0–100 scale wastes space). Guide line drawn at 95% when it falls within the displayed range.
- **Animated headline**: 72→36px avg SpO₂, label "% SpO₂", expanding quality badge + scroll-in chip, height 100→44px.
- **Scatter chart**: rebuilt to match HR chart frame (self-contained SVG, PAD_LEFT y-axis, dashed guide lines, 95% threshold line + green band, hour labels). Removed `DetailChartContainer` wrapper.
- **Layout**: insight → scatter chart → legend → MetricsGrid → stats rows.
- **30-day history**: `useMetricHistory('spo2', { initialDays: 7, fullDays: 30 })`.
- No personal baseline line — SpO₂ is absolute physiological (95%+ is universal normal).

**File:** `app/detail/spo2-detail.tsx`

---

## 2026-04-23: Adenosine Details Page + Drink Logging + Real-Time Caffeine Curve

**Source:** Claude Code — Macbook Pro

**Change:** Turned the static "Adenosine Window Clearance" home card into a live, personal caffeine model. Users can now log caffeinated drinks (espresso, coffee, tea, energy drinks, custom) and see a real-time multi-dose pharmacokinetic curve that updates on both the Home card and a new full Detail screen via Supabase Realtime. The detail screen mirrors the HRDetails template with a collapsing headline, 30-day trend bar chart, scrub-to-inspect curve, today's drink list, and a recommended safe intake window derived from wake time.

**Files created:**
- `supabase/migrations/20260423150000_caffeinated_drinks.sql` — New table with `user_id`, `drink_type`, `name`, `caffeine_mg`, `consumed_at`; RLS FOR ALL; Realtime publication added.
- `src/utils/caffeinePk.ts` — Pure PK model utilities: `doseMgAt`, `totalMgAt`, `clearanceHour`, `recommendedWindow`, `buildMultiDoseCurvePath`, `CAFFEINE_PRESETS` (8 presets with default mg + emoji).
- `src/hooks/useCaffeineTimeline.ts` — Supabase hook: loads today's entries, subscribes to Realtime postgres_changes, exposes `addDrink`/`deleteDrink`, computes `currentMg`, `peakMgToday`, `clearanceHour`.
- `src/components/home/LogDrinkSheet.tsx` — `@gorhom/bottom-sheet` BottomSheetModal with preset grid (8 tiles), name input, mg stepper, ±15-min time stepper. Exposed via `forwardRef<LogDrinkSheetHandle>`.
- `app/detail/adenosine-detail.tsx` — Full detail screen: green radial gradient zone + `TrendBarChart` (30-day mg totals), collapsing headline (current mg, phase badge), scrub-to-inspect PK curve chart with window band + sleep-limit dashed line, `MetricsGrid` (4 cells), today's drink list (long-press to delete), log-drink button.

**Files modified:**
- `src/components/home/CaffeineWindowCard.tsx` — Replaced hardcoded single-dose PK with `useCaffeineTimeline()` hook; multi-dose `buildMultiDoseCurvePath`; empty state when no drinks logged; wrapped in `Pressable` → `/detail/adenosine-detail`; chevron indicator; clearance label now computed live.
- `src/services/SupabaseService.ts` — Added `insertCaffeineEntry`, `getCaffeineEntriesForRange`, `deleteCaffeineEntry`.
- `src/types/supabase.types.ts` — Added `caffeinated_drinks` Row/Insert/Update; exported `CaffeinatedDrink`, `CaffeinatedDrinkInsert`.
- `src/utils/time.ts` — Added `formatDecimalHour(hour: number | null): string` (shared by card, detail screen, log sheet; replaces 3 duplicate formatters).
- `src/screens/home/OverviewTab.tsx` — Passes `wakeHour` derived from `sleep.wakeTime` to `CaffeineWindowCard`.
- `app/_layout.tsx` — Registered `detail/adenosine-detail` route.
- `src/i18n/locales/en.json` + `es.json` — Added full `adenosine.*` key group (30+ keys: phase labels, metric labels, preset names, log form, insight texts).

**Key notes:**
- PK model: linear absorption (45 min ramp) + exponential decay (5h half-life), multi-dose superposition (PK is linear). `clearanceHour` = first hour total mg drops below 100 mg sleep threshold.
- Recommended window: `wakeHour + 1.5h → bedHour − 10.75h` (so 100 mg clears by bedtime). Default bedHour = 23.
- Realtime: single `postgres_changes` subscription per hook instance; channel fires `load()` on any INSERT/UPDATE/DELETE.
- 30-day trend: historical (past 29 days) loaded once on mount; today's aggregate derived from live `entries` state — no extra Supabase round-trips on each drink log.
- Migration applied to remote via `npx supabase db push --include-all` (had to repair stale remote-only migration history entries 20260422 and 20260423 before push succeeded).
- All OTA-eligible — no native changes.

---

## 2026-04-23: Sleep Debt Detail — Full Redesign (Line Charts + Tonight Recommendation)

**Source:** Claude Code — Macbook Pro

**Change:** Redesigned `sleep-debt-detail.tsx` to match the HR/Sleep detail page structure (gradient zone + collapsing headline + ScrollView scaffolding). Replaced the old segmented gauge + 7-bar chart with two new SVG line graphs and a computed "Sleep tonight" recommendation card. The screen now answers two questions at a glance: how is my debt trending over 30 nights, and how much should I sleep tonight to start recovering.

**Files created:**
- `src/components/detail/SleepDebtLine.tsx` — Main line chart: 30-night running sleep debt (7-day trailing window), monotone cubic path, gradient area fill, PanResponder scrub tooltip.
- `src/components/detail/SleepVsTargetOverlay.tsx` — Two-line overlap chart for last 7 nights: actual sleep (accent color) vs target (dashed blue). Data-point circles color green if on/above target.
- `src/components/detail/TonightRecommendationCard.tsx` — Glass card showing computed nightly recommendation: target + debt/3 nights, capped at +90 min, max 10h.

**Files modified:**
- `app/detail/sleep-debt-detail.tsx` — Full rewrite: gradient zone (dynamic color per debt category) with `TrendBarChart` showing 30-day nightly deficits; collapsing headline (72→28px) with category chip; ScrollView with insight → recommendation card → SleepDebtLine → SleepVsTargetOverlay → MetricsGrid → target edit row → small gauge recap.
- `src/services/SleepDebtService.ts` — Extended `computeSleepDebt` to fetch 30 days (was 7); added `gradientForCategory`, `computeTonightRecommendation` (pure, exported); computes `last30`, `last7`, `tonight` on every call. Cache key bumped to `v2`.
- `src/types/sleepDebt.types.ts` — Added `NightlyPoint`, `TonightRecommendation` interfaces; extended `SleepDebtState` with optional `last30?`, `last7?`, `tonight?`.
- `src/utils/time.ts` — Added `formatSleepTime(minutes)` (compact: "1h 30m", omits zero-minute component). Replaces three duplicate inline formatters across the new components.
- `src/i18n/locales/en.json` + `es.json` — Added 13 new `sleep_debt.*` keys: `chart_debt_title/subtitle`, `chart_overlap_title/subtitle`, `recommendation_title/extra`, `rec_rationale_none/maintain/moderate/aggressive`, `tap_to_edit`, `legend_actual/target`.

**Key notes:**
- Dynamic gradient: `none`→green, `low`→yellow, `moderate`→orange, `high`→red. Drives gradient zone, headline color, chart accent, and recommendation card value color.
- Recovery algorithm: `target + min(90, debt/3)`, capped at 600 min (10h). Spread = 3 nights (Oura-like aggressive recovery).
- Running debt = trailing 7-day sum of deficits at each nightly data point — line naturally drops after good sleep, rises after poor sleep.
- Old 7-bar chart removed; `SleepDebtGauge` kept as a small demoted recap at the bottom.
- All new components are OTA-eligible — no native changes.

---

## 2026-04-23: Body Temperature Detail — Fix Bar Height (Dynamic Scale)

**Source:** Claude Code — Macbook Pro

Fixed TrendBarChart bars appearing too low on the body temperature detail page. Root cause: the fixed `minValue=35 / maxValue=38.5` scale is too wide for body temperature, which clusters in a ~0.3–0.8°C range — all bars rendered at ~40% height and looked identical.

Fix: compute `chartMinVal` / `chartMaxVal` dynamically from the actual 30-day temp data (`min - 0.2°C` to `max + 0.3°C`), with a minimum 0.8°C span enforced. This compresses the scale to the data's actual range so variation between days is visually clear.

**File:** `app/detail/temperature-detail.tsx`

---

## 2026-04-23: Body Temperature Detail — HRDetail Structure + Personal Baseline Chart

**Source:** Claude Code — Macbook Pro

Rewrote `app/detail/temperature-detail.tsx` to match the Heart Rate detail page structure, and updated the intra-day chart to anchor readings to the user's personal 30-day baseline instead of the hardcoded 36.1–37.2°C population range.

**Layout changes (matches HRDetail):**
- Gradient zone at top (orange/amber radial gradient): contains `DetailPageHeader` + scrollable `TrendBarChart` spanning 30 days of daily avg temperature.
- Animated collapsing headline (72→36px font) with status badge (expands below number) and scroll-in chip on the right. Height collapses from 100→44px as user scrolls.
- ScrollView body: insight prose → intra-day line chart → MetricsGrid → stats rows.

**Chart changes:**
- Removed hardcoded "normal band" (36.1–37.2°C).
- Added personal baseline: 30-day unweighted mean of `dayData.avg` across all days in `useMetricHistory`, excluding the currently viewed day. Returns `null` if fewer than 3 days have data.
- Chart draws a dashed white baseline line at the personal mean + faint tinted ±0.3°C tolerance band.
- Dot coloring: green (within ±0.3°C of baseline), red (above), blue (below). Falls back to NORMAL_LOW/HIGH for new users.
- Area gradient fill under the readings line (orange, HR-style).

**Status logic pivot:** "Normal / Elevated / Low" now based on deviation from personal baseline (±0.3°C threshold), not population range. Falls back to population range when baseline is null.

**TrendBarChart enhancement:** Added optional `minValue` prop (default `0`) so narrow-range metrics like temperature (35–38.5°C) scale correctly. Bars, trend path, and guide lines all use `(v - minValue) / (maxValue - minValue)` scaling. Backwards-compatible — HR and other consumers unaffected.

**Files modified:**
- `app/detail/temperature-detail.tsx` (full rewrite)
- `src/components/detail/TrendBarChart.tsx` (additive `minValue` prop)

---

## 2026-04-22: TestFlight 1.0.30 (build 31)

**Source:** Claude Code — Macbook Pro

Bumped version to 1.0.30 (build 31) and uploaded to App Store Connect via TestFlight. No code changes in this session — version bump only.

---

## 2026-04-22: X6 Ring — Route to Jstyle/X3 SDK

**Source:** Claude Code — Macbook Pro

**Change:** X6 ring now uses the Jstyle/X3 SDK instead of the V8 SDK.

- `onDeviceDiscovered` (V8 scanner path): X6 devices (`name.includes('x6')`) now get `sdkType: 'jstyle'` instead of `'v8'`
- `getPairedDevice`: V8-returned X6 paired device stamped with `sdkType: 'jstyle'`
- `autoReconnect` — "V8 already connected" path: X6 reclassified to `sdkType: 'jstyle'` without clearing Jstyle pairing
- `autoReconnect` — "V8 reconnect" path: if paired device is X6, clears V8 pairing and skips V8 reconnect (Jstyle path handles it)
- `DeviceSheet.tsx`: `isX6` now detected by device name regex (`/x6/i`) rather than `sdkType === 'v8'`
- `useSmartRing.ts`: `formatDeviceName` X6 branch now matches by name only (not SDK type)

**Note:** Existing users paired via V8 will need to re-pair — V8 NSUserDefaults entry is cleared on next reconnect attempt.

**Files modified:** `src/services/UnifiedSmartRingService.ts`, `src/components/home/DeviceSheet.tsx`, `src/hooks/useSmartRing.ts`

---

## 2026-04-22: Wind-down Notification — Fix Local Time Display

**Source:** Claude Code — Macbook Pro

The wind-down push notification was showing wake time and bedtime in UTC (e.g. "10:00 AM") instead of the user's local time (e.g. "7:00 AM" for ART UTC-3).

**Root cause:** `avgWakeUtcMin` is derived from `sleep_sessions.end_time` which is stored as UTC. The edge function formatted it directly into 12h time without applying any timezone offset.

**Fix (3 parts):**
1. **Migration** `20260422120000_push_tokens_tz_offset.sql` — adds `tz_offset_min INTEGER` column to `push_tokens`
2. **`NotificationService.ts`** — includes `tz_offset_min: -new Date().getTimezoneOffset()` in the push_tokens upsert payload on every token registration
3. **`daily-summary-push/index.ts`** — selects `tz_offset_min` from push_tokens, converts `avgWakeUtcMin` → `avgWakeLocalMin` via `(utcMin + tzOff + 2880) % 1440`, formats wake and bedtime strings from local minutes. Falls back to 0 if offset is null (no regression for tokens registered before this fix).

**Deployed:** migration pushed, edge function redeployed.

---

## 2026-04-22: CaffeineWindowCard — Replace Union shape with 3 window blocks

**Source:** Claude Code — Macbook Pro

**Change:** Replaced the single Figma-derived Union SVG path in `CaffeineWindowCard.tsx` with 3 side-by-side rounded `<Rect>` blocks representing the adenosine window timeframes:
- **Pre** (25% width): amber (#FFAC3F) → teal (#00D7A9) horizontal gradient
- **Open** (37% width): solid teal (#00D7A9)
- **Closed** (38% width): teal (#00D7A9) → rose (#FD8D8F) horizontal gradient

Dark top vignette (`#000 → transparent`) overlays all 3 blocks. Each block has `rx=10` border radius — no gap between blocks, rounded corners create natural visual separation at junctions.

Removed `UNION_PATH` string constant (no longer needed). `UNION_H=89` retained to preserve `LABEL_Y` calculation (time axis labels).

**Files modified:** `src/components/home/CaffeineWindowCard.tsx`

---

## 2026-04-22: Ring Clock Strategy — TZ-aware sync + parser standardization

**Source:** Claude Code — Macbook Pro

**Problem:** Three ring data parsers (HRV, SpO2, Temperature) used `Date.parse` on non-ISO strings — implementation-defined per spec, highest-risk silent-drift path. Also, `setTime()` fired fire-and-forget on every reconnect with no telemetry, and timezone changes (travel, DST) could silently skew ring data until next reconnect.

**Fix 1 — `src/services/JstyleService.ts`:**
- HRV (line 876), SpO2 (line 947), Temperature (line 1002): replaced `Date.parse(...)` with `this.parseX3DateTime(rawDate) ?? result.timestamp` — the same canonical local-time parser used everywhere else in the service.

**Fix 2 — `src/services/UnifiedSmartRingService.ts`:**
- Replaced fire-and-forget `JstyleService.setTime()` in `autoReconnect` with `this.maybeSyncRingClock()`.
- Added `maybeSyncRingClock()`: reads last-synced TZ from AsyncStorage key `ring_clock_last_tz_v1`, no-ops if TZ unchanged, otherwise calls `setTime()` + persists new TZ + Sentry breadcrumb. Errors go to `reportError` and do not update stored TZ (so next trigger retries). Concurrency guard (`syncClockInFlight`) prevents dual `setTime()` if autoReconnect and AppState fire simultaneously.

**Fix 3 — `app/_layout.tsx`:**
- Added AppState foreground listener calling `maybeSyncRingClock()` on `inactive→active` transitions — catches timezone changes while app is backgrounded (air travel, DST) before the next ring data read.

**Architecture contract locked in:** Ring RTC = phone local time. Supabase writes UTC ISO via `.toISOString()`. Reads recover local hour via `new Date(iso).getHours()`.

**Fix 4 — `src/services/UnifiedSmartRingService.ts` (follow-up):**
- `isConnected()`: when native reports connected but `connectedSDKType === 'none'`, heals the state by inferring the SDK type. Fixes cascading `No device connected` errors from `DataSyncService.syncAllData` when iOS background BLE reconnect restores the native connection without JS `autoReconnect()` completing.

**Files modified:** `src/services/JstyleService.ts`, `src/services/UnifiedSmartRingService.ts`, `app/_layout.tsx`

---

## 2026-04-22: Fix X3 HR — Remove ringOffsetMs Double-Correction + HR Detail Sparse Coverage

**Source:** Claude Code — Macbook Pro

**Root cause (confirmed by commit-trace):**
`795e6eb` (Apr 21 OTA) introduced `getRingOffsetMs()` and applied it to `parseX3DateToMinutes` and `tsToMinutes` in `useHomeData.ts` and `DataSyncService.ts`. Since `setTime()` is now called on every reconnect (`973415d`), the ring clock drift is < seconds. The cached 5-min `ringOffsetMs` held a phantom pre-sync offset and shifted every X3 HR point into the wrong minute/hour — producing "all over the place" bars on Overview and wrong-day-filtered points on HR Detail.

**Fix 1 — `src/hooks/useHomeData.ts`:**
- Deleted `getRingOffsetMs()` call (line 1623)
- Restored `tsToMinutes` and `parseX3DateToMinutes` to plain local-time math (no offset added)

**Fix 2 — `src/services/DataSyncService.ts` (`syncHeartRateData`):**
- Removed `ringOffsetMs` from timestamp computation
- Extended to also write `getSingleHeartRateRaw()` (`source: 'smart_ring_single'`) and HRV-derived 24 hourly HR points (`source: 'smart_ring_hrv'`) to `heart_rate_readings` Supabase table so HR Detail has enough points (≥2) to render the line

**Fix 3 — `src/services/UnifiedSmartRingService.ts`:**
- Deleted `getRingOffsetMs()` method and its cache fields (no remaining callers)

**Fix 4 — `app/detail/heart-rate-detail.tsx`:**
- Lowered render threshold to `>= 1 point` for today (was `>= 2`) so X3's single spot-check renders
- Added single-point circle marker + axis label fallback in `ContinuousHRLine` when `filtered.length === 1`

**What was NOT changed:** V8 HR pipeline (`V8Bridge.m`, `V8Service.ts`, `29c40ca` pagination fix), `Promise.allSettled` parallel HR fetch, HRV fallback logic.

**Result:** Overview HR bars appear at correct hours matching real clock. HR Detail shows a line (or single marker) for today via HRV-derived hourly readings written to Supabase. V8 unchanged.

---

## 2026-04-22: Fix X3 Ring HR Chart — Robust BLE Disconnect + HRV Fallback

**Source:** Claude Code — Macbook Pro

**Root causes (confirmed via Xcode logs):**
1. Continuous HR (type 28) always returns `dataEnd: 1` immediately — X3 ring stores no DynamicHR data
2. Single HR (type 29) paginates 52+ packets and disconnects mid-fetch — kills HRV fetch too
3. `hrChartData.length > 0` (even 1 spot-check) blocked the HRV-derived 24-point fallback

**Fixes in `src/hooks/useHomeData.ts`:**
- `Promise.allSettled` for continuous + single HR so a disconnect during single HR pagination doesn't throw
- Threshold raised: ring HR only used when `>= 3` points; otherwise prefers HRV-derived (24 hourly) if richer

**Result:** Chart shows 24 HRV-derived points when HRV succeeds. Cached fallback when everything fails.

---

## 2026-04-22: CaffeineWindowCard — Built Live in App

**Source:** Claude Code — Macbook Pro

**What was built:** New `CaffeineWindowCard` component (`src/components/home/CaffeineWindowCard.tsx`) rendered in OverviewTab after the HR card.

**Visual design (from Figma node 757:399):**
- Two-zone layout: green gradient top section + black chart section
- Top: 34px glass icon circle (☕) + "CAFFEINE WINDOW" label, large 28px title, subtitle body text
- Chart (185px tall, full card width): three radial-gradient zone blobs (amber left / teal center / rose right) rising from the bottom via SVG `RadialGradient` on `Rect` fills. White exponential decay curve as SVG `Path`. Dashed NOW vertical line + white glow dot. Time axis labels (6AM / 12PM / 3PM / 11PM) inside SVG.
- Footer: `rgba(255,255,255,0.10)` strip with clearance label text.
- Background: two stacked SVG radial gradients — green spotlight from above-center + warm amber accent top-left

**Props:**
- `intakeHour` — decimal hour of last caffeine intake (default 8.0 = 8 AM)
- `currentHour` — decimal hour for NOW dot (defaults to `new Date()`)
- `clearanceLabel` — footer string (default "9:30 PM tonight")

**Key technique:** `useWindowDimensions` minus `spacing.md * 2` (the OverviewTab wrapper margins) gives exact card width — no `onLayout` needed. Chart SVG sizes itself accordingly.

**Pharmacokinetics:** Half-life 5h. `conc(t) = 0.5^((t-intake)/5)`, y-position inverted so high concentration = top of chart.

**Architecture (final):** Standalone card (no GradientInfoCard). Full-card absoluteFill SVG provides the amber/teal/rose blob bg (same zone colors as chart, anchored at bottom). Chart section has a `rgba(0,0,0,0.55)` dark overlay so the curve reads cleanly against the blobs. Curve uses a 2-phase PK model: linear absorption rise (45 min to peak) → exponential elimination (5h half-life). Y-axis shows 200/100/0 mg labels (assumes 200mg standard dose) with subtle dashed gridlines. `CHART_PAD_L=38` reserves left space for the Y labels.

**Files created:** `src/components/home/CaffeineWindowCard.tsx`
**Files modified:** `src/screens/home/OverviewTab.tsx`

---

## 2026-04-22: Figma — Caffeine Window / Adenosine Clearance Component (3 States)

**Source:** Claude Code — Macbook Pro

Designed and pushed an Ultrahuman-style "plug" card for caffeine/adenosine window tracking to Figma (V1 page, x≈3050, y≈-750). Three states ready for iteration:

- **Optimal** (84% clear, green badge, NOW at 12:30 PM) — standard morning window
- **Caution** (52% clear, amber badge, NOW at 3:30 PM) — window closing
- **Avoid** (18% clear, red badge, NOW at 8 PM) — too late, disrupts sleep

Each card includes: metric + badge, color-coded timeline bar (skip/optimal/caution/avoid zones), NOW indicator with glow, stats row (Last Intake / Half-life Left / Clear By), and amber/red coach tip. Font fell back to Inter since TT Interphases Pro isn't available in plugin context — needs manual swap in Figma.

**Figma node IDs:** `740:120` (Optimal), `741:120` (Caution), `741:159` (Avoid)

Added 2 curve variants (y≈-350):
- **Variant A — Decay Curve** (`746:120`): exponential concentration drop from intake, sleep threshold line, green CLEAR zone
- **Variant B — Adenosine Pressure** (`746:163`): dual-line — dashed natural buildup vs amber caffeine-masked line, amber shading in the "block" zone, green dot where curves converge

Added **Hero-style card** (`758:120`, x≈3050, y≈120) replicating node 757:399 sketch — two-zone layout:
- **Top half:** VERTICAL auto-layout with a large green radial glow (gradient center at (0.515, -0.15) above the frame, matching original sketch spotlight). Coffee icon, title (28px Inter), subtitle text.
- **Bottom chart (375×185px):** Three colored zone blobs (amber/teal/rose) created via `figma.createNodeFromSvg()` with SVG `<feGaussianBlur>` filter — GRADIENT_RADIAL fills on ELLIPSE/RECT nodes are invisible in plugin context so SVG-blur approach is required. White exponential decay curve as polyline. Dashed NOW indicator at 12PM.
- Footer frame with `bottomRadius=12` appended before card so it slides under (z-order trick).
- Font: Inter (TT Interphases Pro unavailable in plugin context — needs manual swap).

**Key gotcha:** `GRADIENT_RADIAL` fills set programmatically on child nodes inside a nested frame do NOT render in the Figma screenshot API (even with correct transforms, visible=true, opacity=1). Use `figma.createNodeFromSvg()` with SVG blur filters instead.

---

## 2026-04-22: Fix HR Chart — Restore Continuous HR as Primary Source

**Source:** Claude Code — Macbook Pro

**Problem:** HR card showed "None" / 1 data point despite 1464 raw records from ring.

**Root cause:** Commit `7aa8270` (TestFlight 1.0.25 session) swapped continuous HR → single HR as primary source. Single HR is manual spot-checks — it has 1464 historical records but only 1 from today. Continuous HR (minute-by-minute) was never fetched because `hasSingleData` was always `true`.

**Fix:** `useHomeData.ts` — restored continuous HR as primary. Now fetches both in parallel via `Promise.all`; continuous fills `allRecords` for the chart, single HR stays as the fallback when continuous has no data.

**Files modified:** `src/hooks/useHomeData.ts`

---

## 2026-04-22: AI Coach — Persistent User Memory

**Source:** Claude Code — Macbook Pro

**What was built:** The AI coach now remembers facts about the user across sessions — training goals, coaching preferences, recurring patterns — similar to how `catchup.md` captures project context.

**Architecture:**

1. **`coach_memories` table** (migration `20260423_coach_memories.sql`) — Supabase table with `(user_id, key)` primary key, RLS enabled. Each row is a `key: value` fact like `training_goal: "marathon in October 2026"`.

2. **`coach-memory-extract` edge function** — Called fire-and-forget when the user leaves the Coach screen (if ≥2 AI responses exchanged). Sends the conversation to Claude Haiku with an extraction prompt, gets back up to 3 key-value facts, and upserts them to `coach_memories`.

3. **`coach-chat` updated** — Loads `coach_memories` for the user in the existing `Promise.all` block (11th parallel query, zero added latency). Injects memories as a "What I know about you from past conversations" section in the system prompt, above the biometric data.

4. **`AIChatScreen.tsx` updated** — Added memory extraction trigger in `useFocusEffect` cleanup: fires `coach-memory-extract` if the session had ≥2 AI responses. Uses a ref set synchronously during render (not via `useEffect`) to safely read messages at cleanup time.

**Simplify fixes applied:**
- Moved memories query from sequential (before `req.json()`) into the `Promise.all` block — eliminates ~100ms per-request waterfall.
- Removed `useEffect` syncing `messagesRef` — set ref synchronously in render body instead.

**Files created:** `supabase/functions/coach-memory-extract/index.ts`, `supabase/migrations/20260423_coach_memories.sql`
**Files modified:** `supabase/functions/coach-chat/index.ts`, `src/screens/AIChatScreen.tsx`
**Deployed:** `coach-chat`, `coach-memory-extract` (both on project `pxuemdkxdjuwxtupeqoa`)

---

## 2026-04-22: V8 HR Fetch — Date-Scoped Query + Timeout Fix

**Source:** Claude Code — Macbook Pro

**Problem:** `getContinuousHR` timed out every sync (`V8 getContinuousHR timed out after 10000ms`). The ring was dumping its full HR history (2800+ records) because `withStartDate:nil` requests all-time data. At 7 records/packet the transfer took well over 10 seconds.

**Root cause:** `V8Bridge.m` called `GetContinuousHRDataWithMode:0 withStartDate:nil` — the V8 SDK sends all stored records from the beginning of time. V8 SDK supports a `withStartDate:` filter (confirmed in `V8 IOS/Ble SDK Demo/heartRateHistoryData.m:173`).

**Fix:**
- `ios/V8Bridge/V8Bridge.m`: Pass `withStartDate:` = 2 days ago (formatted `YYYY.MM.dd`). Limits transfer to ~2880 records max instead of open-ended history.
- `src/services/V8Service.ts`: Increased `getContinuousHR` timeout from 10s → 30s as a safety buffer.

**Also:** Updated `CLAUDE.md` SDK Reference Rule — added a table clearly separating V8 Band (`V8 IOS/Ble SDK Demo/`) from Jstyle/X3 Ring (`IOS (X3)/Ble SDK Demo/`) reference folders. These must never be cross-referenced.

**Requires native rebuild** (V8Bridge.m changed).

---

## 2026-04-22: AI Coach Screen — Animated Background

**Source:** Claude Code — Macbook Pro

**Changes:**

Added subtle continuous background animation to the AI Coach screen (`src/screens/AIChatScreen.tsx`):
- **Floating blob:** The Figma blob SVG now drifts slowly (±22px X, ±16px Y) on a 7.2s `withRepeat` loop using `Easing.inOut(Easing.sin)` — wrapped in `Reanimated.View`.
- **Gradient overlay pulse:** A second `LinearGradient` (diagonal, deep red ↔ black) fades in/out on a 9.8s loop (opacity 0 → 0.55), cross-fading with the base gradient to create an organic shifting color effect.
- Both animations start immediately on mount and run indefinitely with `withRepeat(-1, true)`.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-04-21: AI Coach Chat — Expanded Artifacts + Generative UI + Follow-Up Grounding

**Source:** Claude Code — Macbook Pro

**Changes:**

1. **Markdown rendering in chat** — `AnimatedAIText` now parses `**bold**` spans inline and renders list items (`1. 2. 3.`) with animated number prefix. Scroll errors fixed by removing `TouchableWithoutFeedback` wrapper and using `keyboardDismissMode="on-drag"` instead.

2. **Follow-up question chips** — After each AI response, Claude now returns `follow_ups: string[]` (max 3). Chips render in an animated row below the AI bubble, using `AnimatedFadeIn` timed to appear after text animation completes.

3. **Follow-up grounding fix** — Added CRITICAL constraint to system prompt: Claude may only suggest follow-ups about data it has (HRV, sleep, HR, SpO2, body temp, steps, Strava, readiness, illness, naps). Never pain/aches/mood/nutrition/hydration.

4. **Generative artifacts (Track B)** — Claude can now emit a typed `artifact` field with a data payload in its JSON response. New file `src/components/chat/GenerativeArtifacts.tsx` wraps existing chart primitives:
   - `bar_chart` → SVG bar chart with tap-select
   - `line_chart` → `HeartRateChart` wrapper
   - `stat_grid` → `MetricsGrid` wrapper
   - `gauge` → `HeroLinearGauge` wrapper

5. **Named artifact types (Track A)** — Wired 6 new pre-built cards: `illness_watch`, `readiness_breakdown`, `last_run`, `training_insights`, `daily_timeline`, `nap`. Added keyword triggers in edge function `artifactChecks`. Dual-path: Claude-emitted artifact trusted first; keyword fallback preserved.

6. **Artifact + footer animation** — All artifacts, the AI icon, and follow-up chips animate in via `AnimatedFadeIn` after `textAnimationDelay(text)` — computed from actual word count to fire precisely when the last word lands.

7. **Artifact styling** — Unified `rgba(255,255,255,0.2)` background, no borders, `borderRadius: 16`, same frame across all artifact types.

8. **Input style in chat mode** — After first message: removed outer `inputWrapper` border, reduced border-radius to `20`.

**Files modified:**
- `src/screens/AIChatScreen.tsx` — `parseInline`, `AnimatedFadeIn`, `AnimatedAIText` rewrite, `Artifact` union type, `ArtifactView` switch, `FollowUpChips`, input style split, `MessageBubbleProps` extended
- `src/components/chat/GenerativeArtifacts.tsx` — **NEW** — 4 generative artifact components
- `supabase/functions/coach-chat/index.ts` — system prompt extended (JSON schema, follow-up grounding), `follow_ups` parsing, generative artifact schema, extended `artifactChecks`, dual-path artifact selection

---

## 2026-04-22: Console.log + NSLog Cleanup — All Debug Logging Removed

**Source:** Claude Code — Macbook Pro

**Change:** Removed all `console.log` calls from 35 JS/TS files (leaving `src/utils/ringData/heartRate.ts` untouched) and removed all `NSLog` statements from 3 native iOS files, keeping only the 6 `[V8HR]` and `[V8HRV]` tagged NSLogs in `V8Bridge.m` for ongoing HR pagination debugging.

**Files modified:**
- `src/services/V8Service.ts` — removed [V8Sleep], [V8SleepActivity], [V8PPI] logs and cancelled-request log
- `src/services/UnifiedSmartRingService.ts` — removed all debug/status logs (scan errors, reconnect warnings, method entry logs)
- `src/services/JstyleService.ts` — removed module load, cancelPendingDataRequest, autoReconnect timing, and steps history error logs
- `src/services/StravaService.ts` — removed all OAuth debug and sync status logs (46 lines)
- `src/services/DataSyncService.ts` — removed all periodic sync and per-record sync logs
- `src/services/HealthKitService.ts` — removed initialization error log
- `src/services/ReadinessService.ts` — removed `__DEV__` readiness/illness score logs
- `src/services/MorningSleepReconnectTrigger.ts` — removed multi-line reconnect complete log
- `src/services/NotificationService.ts` — removed push token verification/token logs
- `src/services/TodayCardVitalsService.ts` — removed hydration start, retry attempt, and result logs
- `src/services/AuthService.ts` — removed all auth flow logs (sign in/up/out/profile)
- `src/services/HealthKit/HealthKitDataFetchers.ts` — removed 6 error logs
- `src/services/HealthKit/HealthKitSleepProcessor.ts` — removed sleep fetch error log
- `src/services/HealthKit/HealthKitPermissions.ts` — removed authorization error log
- `src/services/HealthKit/HealthKitSubscriptions.ts` — removed subscription error log
- `src/services/HealthKit/HealthKitWorkoutFetcher.ts` — removed workout fetch error log
- `src/hooks/useHealthData.ts` — removed HRV/stress/temperature unavailable logs
- `src/hooks/useAuth.ts` — removed auth state change logs (commented-out lines left as-is)
- `src/hooks/useFocusData.ts` — removed all [FocusData] debug logs and removed unused logQueryError helper
- `src/hooks/useMetricHistory.ts` — removed sleep history query logs and ring fallback error logs
- `src/hooks/useSmartRing.ts` — removed raw device bridge log and all metric fetch status logs
- `src/utils/ringData/sleep.ts` — removed fetch and stage breakdown logs
- `src/utils/ringData/spo2.ts` — removed fetch log
- `src/utils/ringData/battery.ts` — removed fetch log
- `src/utils/ringData/steps.ts` — removed fetch log
- `src/utils/ringData/bloodGlucose.ts` — removed fetch log
- `src/utils/ringData/customSleepAnalysis.ts` — removed analysis start logs
- `src/screens/StyledRingScreen.tsx` — removed HR measurement, sleep fetch, battery/steps, and connect logs
- `src/context/OnboardingContext.tsx` — removed debug useEffect that logged full context state on every change
- `app/(onboarding)/connect.tsx` — removed all step/scan/device debug logs and multi-line state dumps
- `app/(auth)/login.tsx` — removed navigation log
- `app/detail/sleep-detail.tsx` — removed selectedIndex/data debug logs
- `app/testing.tsx` — removed RAW_HEART and RAW_HRV logs
- `scripts/backfill-sleep-scores.ts` — removed all backfill progress logs
- `ios/V8Bridge/V8Bridge.m` — removed idle timeout NSLog, all [V8Sleep] NSLogs (packet/raw/complete/next-page), all [V8SleepActivity] NSLogs, all [V8PPI] NSLogs; kept the 6 [V8HR] and [V8HRV] tagged NSLogs
- `ios/JstyleBridge/JstyleBridge.m` — removed [SLEEP_RAW] dataEnd and arrayDetailSleepData NSLogs, removed notification error NSLog
- `ios/JstyleBridge/NewBle.m` — removed [BLE] writeLogs NSLog, all 7 "Could not find service/characteristic" and CoreBluetooth state NSLogs

**Key notes:**
- `src/utils/ringData/heartRate.ts` was intentionally left untouched (8 console.logs preserved)
- `console.error` and `console.warn` calls were NOT removed — only `console.log`
- Multi-line console.log calls (spanning multiple lines) were handled individually to avoid breaking surrounding logic

---

## 2026-04-22: Coach Chat — Artifacts Animate After Text + Unified Style

**Source:** Claude Code — Macbook Pro

Artifacts now fade in after the word-by-word text animation finishes — wrapped in `<AnimatedFadeIn delay={footerDelay}>` just like the AI icon and follow-up chips. All artifact card styles unified: `backgroundColor: 'rgba(255,255,255,0.2)'`, no border, `borderRadius: 16`. Applied to `artifactStyles.card`, `artifactStyles.selfContained` in `AIChatScreen.tsx` and `styles.card` in `GenerativeArtifacts.tsx`.

**Files modified:** `src/screens/AIChatScreen.tsx`, `src/components/chat/GenerativeArtifacts.tsx`

---

## 2026-04-22: V8 HR Fix — Same Pagination Bug as Sleep (DynamicHR_V8 + HRVData_V8)

**Source:** Claude Code — Macbook Pro

**Problem:** No HR readings from last night — no HR card data, no resting HR, no HRV. `DynamicHR_V8` and `HRVData_V8` handlers in `V8Bridge.m` used `items.count < 50` to decide when to resolve. Since the ring sends 1 item per packet (1 day of continuous HR per BLE callback), `items.count = 1 < 50` always fires on the first packet. We'd resolve with only 1 day's data — whichever day the ring sends first (oldest). After date filtering, this showed as no data for last night.

**Root cause confirmed from V8 SDK demo (`heartRateHistoryData.m`):** Same `count==50 && end==NO` → mode:2 pattern as sleep. Ring sends each day as a separate packet; client must track accumulated count and send mode:2 after every 50 packets, then await `dataEnd=YES`.

**Fix (V8Bridge.m):**
- `DynamicHR_V8`: removed `items.count < 50` early resolve; wait for `dataEnd=1`; send `GetContinuousHRDataWithMode:2` after every 50 accumulated items; 3s idle timer as safety net
- `HRVData_V8`: same fix → `GetHRVDataWithMode:2` after 50 items; idle timer
- `sleepActivityIdleTimerFired` updated to handle DynamicHR_V8 and HRVData_V8 in addition to DetailSleepAndActivityData_V8 (all share one idle timer since only one data request runs at a time)

**User-visible:** HR card now shows last night's data. Resting HR in readiness score populates. HRV history loads.

**Files modified:** `ios/V8Bridge/V8Bridge.m`

---

## 2026-04-21: V8 Sleep Fix — Correct SDK Pagination Protocol (mode:2 after page of 50)

**Source:** Claude Code — Macbook Pro

**Problem:** `getSleepWithActivity` timed out on every sync. The ring sends 50 sleep windows (one per BLE packet, all `dataEnd=0`) then goes silent — `dataEnd=1` never arrives and the 20s watchdog fires.

**Root cause (confirmed from V8 SDK demo `sleepHistoryData.m`):** The SDK uses explicit two-phase pagination. After receiving a full page of 50 items with `end==NO`, the client must send `getSleepDetailsAndActivityWithMode:2` to request the next page (or signal readiness). The ring then responds with `dataEnd=1` (or more data). Our `V8Bridge.m` handler only waited for `dataEnd=1` passively and never sent `mode:2` — the ring was waiting for us while we waited for it.

**Fix:**
- After each `DetailSleepAndActivityData_V8` packet, when `accumulatedSleepActivityData.count % 50 == 0 && !dataEnd`, send `getSleepDetailsAndActivityWithMode:2` (mirrors exact SDK demo logic)
- `dataEnd=1` resolves immediately as before
- Added a 3s idle timer as a safety net (fires if ring goes silent after `mode:2` or sends a partial page without `dataEnd`)
- Idle timer and watchdog both call `clearPendingDataRequest` which cancels all timers atomically

**User-visible:** Sleep data now populates on every sync. Expected log: `page complete (50 items) — requesting mode:2` → `fetch complete (dataEnd=1) — total records=50`.

**Files modified:** `ios/V8Bridge/V8Bridge.m`

---

## 2026-04-21: Coach Chat — Expanded Artifacts (Track A + Track B)

**Source:** Claude Code — Macbook Pro

**Feature:** The AI Coach can now render 6 new pre-built card artifacts and 4 new generative visualization types, chosen by Claude per-response (only when a visual genuinely adds value).

**Track A — New named artifact types (reuse existing cards):**
- `illness_watch` → `IllnessWatchCard` (5-signal illness watch)
- `readiness_breakdown` → `ReadinessCard` (HRV/sleep/HR/load component bars)
- `last_run` → `LastRunContextCard` (effort verdict + body state retrospective)
- `training_insights` → `TrainingInsightsCard` (HR zone donut + load)
- `daily_timeline` → `DailyTimelineCard` (today's full chronology)
- `nap` → `NapCard` (today's nap session)

**Track B — Generative artifact types (Claude emits structured data, app renders via generic primitives):**
- `bar_chart` → `BarChartArtifact` (SVG bar chart with tap-to-select)
- `line_chart` → `LineChartArtifact` (wraps `HeartRateChart`)
- `stat_grid` → `StatGridArtifact` (wraps `MetricsGrid`)
- `gauge` → `GaugeArtifact` (wraps `HeroLinearGauge`)

**Keyword fallback preserved:** If Claude doesn't emit an `artifact` field, the existing keyword-matching logic fires as a fallback (so behavior is never worse than before).

**Files created:** `src/components/chat/GenerativeArtifacts.tsx`
**Files modified:** `src/screens/AIChatScreen.tsx`, `supabase/functions/coach-chat/index.ts`

---

## 2026-04-21: Ring Clock Offset Correction for HR Timestamps

**Source:** Claude Code — Macbook Pro

**Change:** HR spikes were appearing ~1.5h later than their actual time because the ring's RTC was drifting fast before the `setTime()` sync fix (April 20). Implemented clock-offset correction in both the Supabase sync path and the live chart path so drifted ring timestamps are corrected using the ring's reported current time.

**Files created:** none

**Files modified:**
- `src/services/UnifiedSmartRingService.ts` — Added `getRingOffsetMs()`: calls `JstyleService.getDeviceTime()`, parses "YYYY.MM.DD HH:mm:ss", returns `Date.now() - ringNow`. Cached for 5 minutes so both `DataSyncService` and `useHomeData` reuse one BLE call per sync session
- `src/services/DataSyncService.ts` — Removed duplicate `computeRingOffsetMs()` helper; `syncHeartRateData` now calls `service.getRingOffsetMs()` and applies offset when computing `recorded_at` for each HR reading written to Supabase
- `src/hooks/useHomeData.ts` — Replaced 8-line inline offset block with a single `await UnifiedSmartRingService.getRingOffsetMs().catch(() => 0)`. `tsToMinutes()` and `parseX3DateToMinutes()` both apply the offset before converting epoch ms → minutes-of-day for the live HR chart

**Key notes:**
- If the ring clock is already synced correctly (offset ≈ 0), no correction is applied — the fix is a no-op for healthy clocks
- The cache TTL (5 min) means a ring that drifts slowly will still get corrected on every reconnect/sync cycle
- Old Supabase HR data written before the fix has wrong timestamps and will remain wrong until the ring buffer rolls over and re-syncs — this self-corrects within ~24h as new correctly-timestamped data overwrites the day's records

---

## 2026-04-21: Coach Chat — AI Icon + Follow-up Chips Animate After Text

**Source:** Claude Code — Macbook Pro

**Problem:** The AI icon and follow-up chips appeared immediately when the message mounted, while the word-by-word text animation was still running.

**Fix:** Added `countAnimatedWords(text)` + `textAnimationDelay(text)` helpers that mirror the word-parsing logic in `AnimatedAIText` to compute exactly when the last word finishes. Added `AnimatedFadeIn` reusable component (opacity + translateY, 400ms, `withDelay`). AI icon wrapped in `<AnimatedFadeIn delay={footerDelay}>` inside `MessageBubble`. `FollowUpChips` accepts a `delay` prop and wraps its row in `AnimatedFadeIn`. Chips render site passes `textAnimationDelay(last.text)` as the delay.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-04-21: Coach Chat — Follow-up Question Chips

**Source:** Claude Code — Macbook Pro

**Feature:** After every AI response, 2–3 contextual follow-up question chips appear below the last message. Tapping one sends it as the next message. Chips disappear as soon as the user sends anything (their own or a chip), and reappear after the next AI reply.

**Implementation:**
- `coach-chat` edge function: system prompt now instructs Claude to respond as JSON `{ "message": "...", "follow_ups": [...] }`. Parsed after the API call with code-fence stripping and a try/catch fallback so the chat never breaks on non-JSON replies.
- `callCoach()`: return type extended with `followUps?: string[]`.
- `Message` type: added `followUps?: string[]` field, stored on each AI message.
- `FollowUpChips` component: `flexWrap: 'wrap'` row of pill chips (`rgba(255,255,255,0.08)` bg, `rgba(255,255,255,0.2)` border, 20px radius, 13px text).
- Chips rendered inside the messages `ScrollView`; visible only when last message is an AI message and Claude is not currently typing.
- Edge function deployed to `pxuemdkxdjuwxtupeqoa`.

**Files modified:** `supabase/functions/coach-chat/index.ts`, `src/screens/AIChatScreen.tsx`

---

## 2026-04-21: Activity Icons on HR Card + HR Detail Chart

**Source:** Claude Code — Macbook Pro

**Change:** Added sport-type icons (Ionicons, colored by activity type) to both the HR Overview card and HR Detail line chart. Tapping a bar with an activity or tapping an icon opens a bottom-sheet popup showing the workout's name, start time, duration, avg/max HR, and distance. Strava activities get a "View full activity" button; Apple Health and ring workouts show info only. When dragging on the HR Detail chart, the tooltip also reveals the active workout name and icon when the cursor falls inside an activity's time range. All three sources (Strava, Apple Health, on-ring) are shown for today; past days show Strava-only via Supabase.

**Files created:**
- `src/utils/activityMatching.ts` — Pure utilities: `findActivitiesForDay`, `findActivitiesStartingInHour`, `findActivityAtTime` (range-based lookup)
- `src/components/home/ActivityInfoSheet.tsx` — `@gorhom/bottom-sheet` modal showing activity details; Strava-only "View full activity" nav button
- `src/hooks/useHistoricalStravaActivities.ts` — Fetches 30 days of Strava activities from Supabase, returns `Map<YYYY-MM-DD, UnifiedActivity[]>` for the detail chart day navigator

**Files modified:**
- `src/components/home/DailyHeartRateCard.tsx` — Replaced Strava-only orange-dot pin with unified `activitiesByHour` map (all sources). Pin renders real Ionicon in activity color with +N badge for multi-activity hours. Pan release tap detection uses `lastSetHrIndexRef` + `activitiesByHourRef` to avoid stale closure; tap opens `ActivityInfoSheet`
- `app/detail/heart-rate-detail.tsx` — `ContinuousHRLine` gains `activities`, `dayDateISO`, `onActivityPress` props. Adds absoluteFill pin overlay with `pointerEvents="box-none"` so Pressable icons work without breaking pan drag. Tooltip extended to show activity icon+name when drag cursor is within a workout range. `HeartRateDetailScreen` wires `useHistoricalStravaActivities` + merges with today's `unifiedActivities`
- `src/i18n/locales/en.json` / `es.json` — Added `activity_popup` namespace (start_time, duration, avg_hr, max_hr, distance, view_full)

**Key notes:**
- Pan responder on HR overview card: removed `onStartShouldSetPanResponderCapture` so child Pressables aren't swallowed; kept `onMoveShouldSetPanResponderCapture` so drags still work
- Activity tap in the overview card is detected via `lastSetHrIndexRef` (written synchronously in `handleTouchRef`) to avoid stale-closure issues with pan responder created in `useRef`
- `formatDuration`/`formatDistance` in `ActivityInfoSheet` use existing utils: `formatDurationHm` from `src/utils/time.ts` and `formatDistance` from `src/utils/ringData/steps.ts`
- Historical HK/ring workouts are only available for today — not stored in Supabase; past-day chart shows Strava only (acceptable gap, documented)

---

## 2026-04-21: Coach Chat — Markdown Rendering + Scroll Fix

**Source:** Claude Code — Macbook Pro

**Problems:**
1. AI responses with `**bold**` markers rendered as literal `**text**` instead of bold.
2. Numbered lists and multi-paragraph responses (containing `\n`) ran together as a single word-wrapped line with no visual structure.
3. Dragging to scroll the chat message list produced errors (caused by `TouchableWithoutFeedback` wrapping the entire screen including the `ScrollView`).

**Fixes:**
- Added `parseInline(line)` helper that splits a text line into `InlineSpan[]` objects (bold/plain), detecting `**...**` patterns.
- Rewrote `AnimatedAIText` to split the full response on `\n` first, then per-line detect numbered list prefixes (`1. `, `2. `, etc.) and parse inline spans. Words are flattened from spans with a sequential `wordIndex` so the stagger animation flows continuously across the whole response.
- Updated `AnimatedWord` to accept a `bold` prop; applies `fontWeight: '700'` when set.
- Added `listLine`, `aiTextInner`, `boldText` style entries to `msgStyles`.
- Removed `TouchableWithoutFeedback` wrapper around the full screen. The header is now a `TouchableOpacity` (pressing it dismisses keyboard). Added `keyboardDismissMode="on-drag"` to the messages `ScrollView` so the keyboard dismisses naturally on scroll.

**User-visible:** Bold text in Coach responses renders in bold. Numbered lists are visually separated with proper line breaks. Scrolling the chat works without errors.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-04-20: Sleep Detail — Stage Rows Redesign + Chart Reorder

**Source:** Claude Code — Macbook Pro

**Change:** Redesigned sleep stage rows to match Oura's pill-label structure (colored pill on left, "Xh Ym • Z%" on right, no progress bar), reordered the scroll content so stages appear first then the HR/temp charts below, and removed the glass card background from both charts (now render on the plain dark background).

**Files modified:**
- `app/detail/sleep-detail.tsx` — Replaced `SleepStageBar` + `stageStyles` + `STAGE_RANGES` with `SleepStageRow` + `stageRowStyles`; pill uses `${color}28` (semi-transparent) background and color-matched text; stat shows `"Xh Ym • Z%"` format. Render order changed to: hypnogram → stages → MetricsGrid → HR chart → Temp chart → Naps. Chart wrappers changed from `styles.chartCard` (glass card) to `styles.chartSection` (no bg, no border, just top padding). Stage order updated to Awake / REM Sleep / Light Sleep / Deep Sleep to match reference layout.

---

## 2026-04-20: Sleep Detail — Oura-Style Resting HR Chart Redesign

**Source:** Claude Code — Macbook Pro

**Change:** Redesigned the Resting HR chart in Sleep detail to match the Oura Ring visual style: hot pink sharp polyline (no smooth spline), dashed resting-HR reference line, "Lowest HR Zone" vertical band highlighting the 30-min sleep window with the lowest average HR, and bed/wake time pill labels at the x-axis edges.

**Files modified:**
- `app/detail/sleep-detail.tsx` — Replaced `SleepHRLine` component: removed monotone cubic path + gradient fill; added sharp polyline (`#FF2D78`), dashed white reference line at `minHR`, "Lowest HR Zone" band (semi-transparent pink rect + vertical center line + label + dot marker), round 10-bpm y-axis ticks, pill-shaped bed/wake time labels at x-axis edges (intermediate hours only rendered where they don't collide with pills). New component-scoped constants: `HR_CHART_H=200`, `HR_XAXIS_H=26`, `HR_PAD_LEFT=30`, `PILL_W=58`, `PILL_H=18`.

**Key notes:**
- Sharp polyline chosen intentionally (vs cubic spline) — shows minute-by-minute HR variability that the Oura reference chart emphasizes
- Lowest HR Zone: scans each sample with a ±15-min window, picks the center with the minimum window average; zone width is always 30 min
- Pill x-axis labels use exact bed/wake timestamps (lowercase, e.g. "12:52 am"); intermediate hour ticks are suppressed if within 8px of a pill

---

## 2026-04-20: Sleep Detail — Resting HR + Skin Temperature Charts

**Source:** Claude Code — Macbook Pro

**Change:** Added two new charts to the Sleep detail screen so it now shows three visualizations: the existing hypnogram, a Resting Heart Rate line chart, and a Skin Temperature line chart — all scoped to the sleep window (bedTime → wakeTime). Mirrors the drag-to-scrub, gradient-fill, monotone cubic pattern from the HR detail page.

**Files modified:**
- `app/detail/sleep-detail.tsx` — Added `SleepHRLine` and `SleepTempLine` inline chart components; `buildSleepWindowHourTicks` helper (shared by both); `buildTodaySleepFromContext` now accepts `hrChartData` and injects `hrSamples`; added `useEffect` that Supabase-fetches today's temperature samples (since live overlay doesn't hit the batch query); `activeTempSamples` merges live and batch paths; two new chart card render blocks inserted after hypnogram; `chartCard/chartHeader/chartTitle/chartSubtitle` styles added; new imports: `monotoneCubicPath`, `supabase`, `useTranslation`, `PanResponder`, `Dimensions`, extended SVG imports
- `src/hooks/useMetricHistory.ts` — `DaySleepData` extended with `hrSamples` and `tempSamples`; `fetchSleepHistory` fires two parallel Supabase queries (HR + temperature) spanning the full session range, then distributes samples per session; pre-converts rows to `timeMs` before per-session filter loop (avoids duplicate `.map()` per session); `fetchSleepFromRing` initializes both fields to `[]`
- `src/i18n/locales/en.json` — Added `sleep.chart_hr_title`, `sleep.chart_hr_subtitle`, `sleep.chart_temp_title`, `sleep.chart_temp_subtitle`
- `src/i18n/locales/es.json` — Same four keys in Spanish

**Key notes:**
- X-axis spans bedTime → wakeTime (not a full 24h day) so both charts are dense and readable for typical 6–9h windows
- HR chart: monotone cubic path, red gradient fill, peak/trough dot markers, drag-to-scrub tooltip — identical visual language to `heart-rate-detail.tsx`
- Temperature chart: orange line, green normal-band (36.1–37.2°C) with dashed reference lines, drag-to-scrub tooltip
- Data strategy: Supabase batch (2 queries covering full date range → distributed per session) avoids N+1; today's temperature uses a direct Supabase fetch in a `useEffect` since the live overlay path bypasses the batch
- Both charts render hidden when `samples.length < 2` — no blank cards on days without HR/temp sync
- `buildSleepWindowHourTicks` extracted as shared helper after simplify pass found the 16-line block was verbatim duplicated in both chart components

---

## 2026-04-20: Live HR Card — Full Layout Redesign (State-Specific, No #222 Body)

**Source:** Claude Code — Macbook Pro

Removed the dark `#222` body and redesigned all states within the gradient area:
- **Idle**: number + "Last Measured X" inline, static heart on right, "Start" pill in body
- **Measuring**: body owns full-width row — big number (or "...") + "Xs remaining" on left, pulsing heart on right; no stop button
- **Done**: "98 BPM" in header, static heart on right; body = "Tap to re-measure" + status chip only
- **Error**: "Try Again" pill

Removed `CountdownRing` SVG component and unused `Circle` import. Added `hr_live.tap_to_remeasure` to `en.json` + `es.json`.

**Files modified:** `src/components/common/GradientInfoCard.tsx`, `src/components/home/LiveHeartRateCard.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

## 2026-04-20: Fix HR Detail — Today Bar Jumps When Navigating to Yesterday

**Source:** Claude Code — Macbook Pro

**Change:** Fixed a bug where today's resting HR in the trend bar chart would jump from the live ring value (e.g. 45) to the Supabase-stored value (e.g. 65) whenever the user scrolled to a different day. Root cause: `todayLive` was gated on `selectedIndex === 0`, so navigating away from today set it to `null` and `hrValues` fell back to Supabase data for today's bar. Fix: split into `todayLiveData` (always computed from ring context, drives the bar chart) and `todayLive` (only active when today is selected, drives the detail section display).

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Split `todayLive` into `todayLiveData` + `todayLive`; `hrValues` now uses `todayLiveData`

---

## 2026-04-20: HR Detail — Drag-to-Scrub + Truncate Future Timeline

**Source:** Claude Code — Macbook Pro

**Change:** Replaced tap-to-freeze-scroll with a PanResponder drag-to-scrub interaction identical to the overview HR card and sleep hypnogram. Also dropped the horizontal ScrollView entirely (no more 1344px canvas — chart now fits to screen width), and truncated today's x-axis at the current minute so no empty future grid is shown.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Removed `ScrollView` import + horizontal scroll wrapper; removed `HOUR_WIDTH`/`TOTAL_CHART_W`/`CONTENT_W` constants; removed `scrollRef`/`scrollOffsetRef`/auto-scroll `useEffect`; removed separate fixed y-axis SVG overlay; removed tap-toggle `handleSvgPress`. Added `layoutWidthRef` + `handleTouchRef` ref pattern (mirrors `DailyHeartRateCard`); added `PanResponder` with grant/move/release/terminate; added `maxMinute = isToday ? nowMinutes : 1440` for x-scale; merged y-axis labels into the single `<Svg width="100%" viewBox="...">`. Hour ticks filtered to `≤ ceil(maxMinute/60)` so no empty future labels render.

**Key notes:**
- `handleTouchRef.current` is mutated on every render (not inside a `useEffect`) — same stale-closure avoidance pattern as `DailyHeartRateCard.tsx:160`
- Drag converts screen px → SVG units via `touchPx * (CHART_W / layoutWidth)` since SVG uses `width="100%"` with a fixed `viewBox`
- `maxMinute` is memoized with `useMemo([isToday])` — recomputed only on day change, not every render
- Tooltip dismissed on `onPanResponderRelease` and `onPanResponderTerminate` (mirrors both reference components exactly)

---

## 2026-04-20: HR Detail — Remove Minimap, Freeze Scroll on Tooltip, Gradient Fill

**Source:** Claude Code — Macbook Pro

**Change:** Three UX refinements to the HR detail chart: (1) removed the minimap strip below the chart — it added visual clutter with no meaningful value; (2) tapping the chart now freezes horizontal scrolling while the tooltip is pinned (tap again anywhere to dismiss and resume scrolling); (3) replaced the flat red area fill with a `LinearGradient` that fades from red at the top to transparent black at the baseline, giving a more polished depth effect.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Removed `MINI_H` constant, `miniScrollX` state, `miniToX`/`miniToY`/`miniPath`/`maxScroll`/`viewportW`/`viewportX` variables, and the minimap `<View>` block. Added `scrollEnabled={!tooltip}` to the `ScrollView` (replaces `onScrollBeginDrag` dismiss). Added `LinearGradient` to SVG import; added `<Defs><LinearGradient id="hrAreaGrad">` inside the scrollable SVG canvas; changed area `<Path>` fill from `rgba(171,13,13,0.18)` to `url(#hrAreaGrad)`. Simplified `onScroll` handler to only track offset (no minimap state update).

**Key notes:**
- Scroll freeze is implemented via `scrollEnabled={!tooltip}` — simpler and more reliable than PanResponder conflicts
- Gradient uses `gradientUnits="userSpaceOnUse"` with `y1={PAD_V}` / `y2={baselineY}` so it maps to the actual chart content area regardless of data range
- `LinearGradient` was added to the existing `react-native-svg` named import (same import line as `RadialGradient`)

---

## 2026-04-20: HR Detail — Scrollable Continuous Chart + Per-Minute Sync

**Source:** Claude Code — Macbook Pro

**Change:** The HR detail chart was showing hourly averages, hiding the true 107 bpm peak that the home card correctly reported. Replaced the fixed hourly line chart with a horizontally scrollable, minute-resolution continuous curve. The chart is 1344px wide (56px/hour × 24 hours) — roughly 4× the screen width — so per-minute wiggle is clearly visible. Changed the Supabase sync pipeline to write one row per minute (instead of one per hour), so historical days get the same resolution as today on the next sync. Also added a minimap strip below the chart showing the full 24h at a glance with a sliding viewport indicator.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Replaced `HourlyHRLine` (hourly-bucket averages, PanResponder) with `ContinuousHRLine`: horizontal `ScrollView` wrapping a 1344px SVG, fixed y-axis overlay, `monotoneCubicPath` smooth curve, peak (red) + trough (white) labeled markers, tap-to-tooltip (dismisses on scroll), auto-scroll to current time on mount, minimap strip with animated viewport rectangle. Added `HOUR_WIDTH`, `TOTAL_CHART_W`, `MINI_H`, `CONTENT_W` constants. Added `formatTimeFromMinutes` helper. `useMemo` for the expensive path + extremes computation. Removed `PanResponder` import; added `ScrollView`, `useEffect`.
- `src/hooks/useMetricHistory.ts` — Added `minutePoints: Array<{ timeMinutes, heartRate }>` to `DayHRData` interface. `fetchHRHistory` now stores `minute = d.getMinutes()` per row so `minutePoints` carries sub-hour precision when Supabase has it. `fetchHRFromRing` similarly maps `timeMinutes` directly from the raw ring result.
- `src/services/DataSyncService.ts` — `syncHeartRateData` now calls `getContinuousHeartRateRaw()` (per-minute array) instead of `get24HourHeartRate()` (24 averages). Flattens `arrayDynamicHR[i]` into rows with `recorded_at = startTimestamp + i * 60_000`. Deletes today's existing rows first (clears stale hourly-rounded rows) then bulk-upserts the new per-minute set.
- `src/services/SupabaseService.ts` — Added `deleteHeartRateReadingsForRange(userId, from, to)` helper (range delete on `heart_rate_readings`).

**Key notes:**
- Today's chart is minute-resolution immediately (data lives in `homeData.hrChartData`); historical days upgrade naturally the next time each day becomes "today" under the new sync path — no backfill needed
- Supabase schema already supports arbitrary `recorded_at` precision; `(user_id, recorded_at)` unique constraint handles idempotent re-syncs
- DB growth: ~1440 rows/day/user (~525k/year) — acceptable for current user count
- The minimap `viewportX` is derived from `miniScrollX` state (updated at 100ms intervals via `scrollEventThrottle`), so the indicator moves smoothly without per-frame re-renders
- `areaPath` now uses `${linePath} L lastX baseline L firstX baseline Z` (no `.slice()` string hack)
- Tap on chart shows tooltip for nearest sample; swiping to scroll auto-dismisses tooltip via `onScrollBeginDrag`

---

## 2026-04-15: Morning Sleep Sync — Targeted BLE Reconnect Trigger + Enriched Notifications

**Source:** Claude Code — Macbook Pro

**Change:** Added a fast-path for pushing last night's sleep into Supabase shortly after wake-up — so the 9:03 AM WhatsApp cron and local "Sleep Ready" notification have real data. Two triggers now handle this: (1) the existing `BackgroundSleepTask` background-fetch fires a sleep-only Supabase sync once per day when it detects today's wake time, and (2) a new `MorningSleepReconnectTrigger` fires the same sync immediately when the ring reconnects between 05:00–10:00 (often seconds after the user puts the ring back on — beating iOS's fetch cadence). The local notification body now includes actual sleep duration and score (e.g. "Slept 7h 12m · Score 84") instead of the static placeholder text.

**Files created:**
- `src/services/MorningSleepReconnectTrigger.ts` — Subscribes to `onConnectionStateChanged`; on morning reconnect, debounces 30s then calls `syncSleepOnly()` + `maybeSendSleepNotificationFromForeground()`; guarded by per-day AsyncStorage dedupe flag and 05:00–10:00 window

**Files modified:**
- `src/services/DataSyncService.ts` — Added public `syncSleepOnly()`: auth + connection check, calls private `syncSleepData()` + `updateDailySummary()`, reads back latest night session from Supabase and returns `{ totalMin, sleepScore, wakeTime }` for notification enrichment
- `src/services/BackgroundSleepTask.ts` — Removed local `extractWakeTime` (moved to sleep utils); added `sleepSyncedKey()` helper + `@focus_sleep_synced_for_<YYYY-MM-DD>` dedupe flag; task now calls `syncSleepOnly()` before scheduling notification and skips the 2h full-sync when a sleep-only sync was just done; `scheduleSleepNotification` + `maybeSendSleepNotificationFromForeground` both accept optional session for enriched body
- `src/utils/ringData/sleep.ts` — Extracted `extractWakeTime(rawRecords)` as a shared export (was private to BackgroundSleepTask); added `MIN_NIGHT_DURATION_MS` + `MIN_WAKE_HOUR` module constants
- `src/utils/time.ts` — Added `formatDurationHm(totalMin)` utility ("Xh Ym" format); reused in BackgroundSleepTask
- `src/services/NotificationService.ts` — Calls `initMorningSleepReconnectTrigger()` at app startup alongside bg task registration

**Key notes:**
- `syncSleepOnly()` calls `updateDailySummary()` which reads all Supabase columns (HR/steps/etc.) in parallel — safe because it reads from Supabase (not ring), and already-stored data for other metrics won't be zeroed out
- The `@focus_sleep_synced_for_<date>` and `@focus_sleep_notif_scheduled_v2` keys are intentionally separate — sync dedupe is per-day; notification dedupe is per-day via `.toDateString()`. Both BackgroundSleepTask and MorningSleepReconnectTrigger share the sync dedupe key via the exported `sleepSyncedKey()` helper
- MorningSleepReconnectTrigger debounces 30s to let the BLE stack settle after reconnect before issuing BLE reads
- Double ring fetch eliminated: trigger no longer pre-fetches raw records to check wake time — it delegates entirely to `syncSleepOnly()` and checks `latestSession` on the result

---

## 2026-04-15: Detail Pages — Chip Above Title, Bigger Number, Borderless Insight Block

**Source:** Claude Code — Macbook Pro

**Change:** Visual polish across all three detail pages (Sleep, Heart Rate, Recovery). The quality chip (e.g. "Excellent", "Fair") now appears **above** the main number when expanded, then transitions to the right of the collapsed header on scroll — same animation as before but repositioned in the layout. The main score number grew from 72 → 88px. The insight text block at the bottom lost its border/padding box and became plain flowing text with bigger font (16px / 24 lineHeight), flush with the card margins.

**Files modified:**
- `app/detail/sleep-detail.tsx` — Moved `badgeRow` above `headlineRow` in JSX; updated `numberAnimStyle` [72→88, 28], `labelAnimStyle` translateY [24→32, 0], `headlineHeightStyle` [100→120, 44]; `badgeRow` margin changed from `marginTop` to `marginBottom: 4`; `insightBlock` border/padding removed, `marginHorizontal` lg→md; `insightText` fontSize sm→16, lineHeight 22→24
- `app/detail/heart-rate-detail.tsx` — Same chip repositioning, animation, and insight block changes as sleep-detail
- `app/detail/recovery-detail.tsx` — Same chip repositioning, animation, and insight block changes as sleep-detail

**Key notes:**
- Chip element order in JSX: badge (fades out on scroll) is now first child of `headlineLeft`, above the number row — achieves the "chip above title" expanded layout without any absolute positioning
- The right-side chip (`chipSlideStyle`) is unchanged — it still slides up from below on scroll for the collapsed header state
- `headlineHeightStyle` expanded height bumped to 120 (was 100) to accommodate chip + larger number fitting within the animated container

---

## 2026-04-15: Recovery Detail — Explainer Sheet Overhaul (Charts, No Handle, Monochrome Rule)

**Source:** Claude Code — Macbook Pro

**Change:** Three improvements to the Recovery Detail explainer bottom sheet: (1) removed the handle pill that was rendering above the sheet title, (2) added 14-day monochrome bar charts with dashed personal-baseline lines for HRV, Sleep Score, and Resting HR inside the sheet, (3) moved the explainer ⓘ trigger to the main "Recovery" page header (right side) and wired the Score Breakdown ⓘ to `MetricExplainerContext` instead. Also documented the no-color rule for explainer sheets in `design-system.md` and `CLAUDE.md`.

**Files modified:**
- `app/detail/recovery-detail.tsx` — Removed handle pill (`<View style={eStyles.handle} />`) and its style; added `MiniBarChart` SVG component (monochrome bars, opacity fade oldest→newest, dashed `rgba(255,255,255,0.45)` baseline line); updated `ScoreExplainerSheetContent` to accept `sleepData`, `hrData`, `hrvData` Maps and render a chart + caption after each `ExplainerComponent`; hoisted `CHART_DAYS` (14-day key array, oldest→newest) to module level; moved explainer ⓘ to `DetailPageHeader` `rightElement`; Score Breakdown ⓘ now uses `<InfoButton metricKey="score_breakdown" />`; added `sheetBackground` style; added `paddingTop` to sheet content
- `design-system.md` — Added "Bottom Sheet / Explainer Sheet Color Rule" section: monochrome-only inside explainer/formula sheets, no accent colors
- `CLAUDE.md` — Added no-color rule to Design Conventions section referencing `design-system.md`

**Key notes:**
- `MiniBarChart` uses `useWindowDimensions()` so chart fills the sheet width minus padding (`screenWidth - spacing.lg * 2`)
- `invertY` prop on RHR chart: bars fill from top (high RHR = tall bar) since high HR is worse — visual direction matches the "lower is better" mental model
- Charts only render when the history array has at least one non-zero value (guard: `values.some(v => v > 0)`)
- `CHART_DAYS` is derived once at module init from the same `DAY_ENTRIES` constant used for the trend chart
- Handle pill was `handleComponent={null}` on the `BottomSheetModal` but a manual pill `<View>` was still rendered in JSX — now fully gone

## 2026-04-15: Recovery Detail — Score Explainer BottomSheet with ⓘ Trigger

**Source:** Claude Code — Macbook Pro

**Change:** Replaced the always-visible "How this score was calculated" card at the bottom of the Recovery Detail screen with a `BottomSheetModal` triggered by a new ⓘ info icon in the Score Breakdown header. Sheet opens with haptic feedback, shows each component at large scale (weight in 28px, pts earned/available, formula), and uses the baseline-relative ReadinessService formula (HRV 35% / Sleep 25% / RHR 20% / Load 20%).

**Files modified:**
- `app/detail/recovery-detail.tsx` — Full redesign: removed `ScoreExplainerCard` static render; added `ExplainerComponent` + `ScoreExplainerSheetContent` for the sheet; wired `BottomSheetModal` ref + `openExplainer` callback with `Haptics.impactAsync(Light)`; added ⓘ `TouchableOpacity` button in Score Breakdown title row; upgraded all `eStyles` to larger font sizes (title 22px, subtitle 15px, weight value 28px `fontSize.xxl`, pts earned 20px `fontSize.xl`); shows `earnedPts / maxPts` per component and `totalScore / totalAvail` at bottom

**Key notes:**
- Sheet uses `enableDynamicSizing` + `maxDynamicContentSize={680}` — no fixed snap points
- `totalAvail` is 80 when Training Load absent (35+25+20), 100 when present
- `componentPts` outer Text wrapper style removed — dead code in RN (nested Text fontSizes always override parent)
- Memory rule saved: always make UI text/elements bigger by default — titles ≥18px, key values ≥28px, labels ≥14px

---

## 2026-04-15: Score Breakdown — InfoButton SVG + title style upgrade

**Source:** Claude Code — Macbook Pro

- **Info icon**: Replaced the Unicode `ⓘ` character in the Score Breakdown header with the proper SVG info icon (same circle + dot + stem as `InfoButton`). Tapping it opens the `ScoreExplainerSheetContent` bottom sheet already wired in the screen.
- **Title style**: Both "Score Breakdown" and "Strain Accumulation" section titles changed from `fontSize.md / fontFamily.demiBold` to `fontSize.lg / fontFamily.regular` — bigger, not semi-bold.
- **MetricKey `score_breakdown`** added to `metricExplanations.ts` with explanation covering HRV 35% / Sleep 25% / RHR 20% / Training Load 20% weights, baseline-relative scoring, and HRV population context. Added i18n strings to `en.json` and `es.json`.

**Files modified:** `app/detail/recovery-detail.tsx`, `src/data/metricExplanations.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

## 2026-04-15: Fix readiness score mismatch + contribution bar raw values

**Source:** Claude Code — Macbook Pro

Two bugs fixed after centralizing metrics:

**Bug 1 — Readiness score mismatch (overview 92 vs Recovery Detail 70):**
`homeData.readiness` (computed in `useHomeData.ts`) used the old flat formula (`sleep×0.50 + rhr×0.30 + strain×0.20` with a fixed `(90-rhr)/50` scorer) — consistently giving ~92. Recovery Detail now uses `focusData.readiness` (baseline-relative ReadinessService formula) — giving 70. Both numbers were simultaneously visible on screen.

Fix: `OverviewTab.tsx` now reads `focusData.readiness?.score ?? homeData.readiness` (falls back to homeData only while FocusDataContext is still loading).

**Bug 2 — Contribution bars showed component scores as raw values:**
The Score Breakdown bars for HRV and Resting HR were showing `readiness.hrvScore` / `readiness.restingHRScore` (0-100 component scores) as the value text. Since HRV SDNN was 38ms and the component score happened to also be ~38 (coincidence from baseline formula), it looked like the bar was showing "38ms as 38% of 100ms". Same confusion for Resting HR.

Fix: bars now show raw metric in the label (`38 ms`, `57 bpm`) while `pct` still reflects the component score (baseline-relative fill). Sleep bar unchanged (score is already the natural unit).

**Files modified:**
- `src/screens/home/OverviewTab.tsx` — import `useFocusDataContext`, use `focusData.readiness?.score` for readiness metric
- `app/detail/recovery-detail.tsx` — ContributionBars: HRV shows `hrv.raw ms`, Resting HR shows `restingHR bpm`

---

## 2026-04-15: Centralized Metrics — Unified `DayMetrics` / `useDayMetrics` (ReadinessService as app-wide single source of truth)

**Branch:** `feat/ring-sync-ux-followup`

**Source:** Claude Code — Macbook Pro

### What changed

Eliminated three independent readiness implementations. The Coach tab's `ReadinessService` (baseline-relative formula) is now the single source of truth for every screen.

**New types** (`src/types/focus.types.ts`):
- `DayMetricValue` — raw reading + 0-100 score + baseline median + deviation label
- `DayMetrics` — unified per-day record (readiness, HRV, RHR, sleep, resp rate, etc.)

**New service function** (`src/services/ReadinessService.ts`):
- `buildDayMetrics()` — pure, testable; reuses existing `scoreHRVComponent` / `scoreSleepComponent` / `scoreRestingHRComponent` scorers; computes deviation labels (e.g. "+3 bpm vs norm") consistently

**New hook** (`src/hooks/useDayMetrics.ts`):
- `useDayMetrics({ sleepData, hrData, hrvData, todayKey })` — returns `resolve(dateKey) → DayMetrics | null`
- Today: raw values from `homeData` (ring BLE), ReadinessScore from `FocusDataContext` (includes training load, matches Coach tab exactly)
- Past days: raw values from Supabase via `useMetricHistory` maps, ReadinessScore computed synchronously without training load

**Recovery Detail refactored** (`app/detail/recovery-detail.tsx`):
- Deleted local `computeReadiness` (flat formula with fixed thresholds)
- Deleted all fallback construction (`todaySleepFallback`, `todayHRFallback`, `getActivity`, `getSleep` calls)
- Added `toDisplayReadiness(m: DayMetrics | null): DayReadiness` mapper
- `allScores` trend chart now resolves from `useDayMetrics` for all 30 days
- `ScoreExplainerCard` now takes `dayMetrics: DayMetrics | null` instead of `steps`/`sleepMinutes`; shows baseline-relative formula note, conditional Training Load row when Strava data is present
- Contribution bars: HRV 35% + Sleep Quality 25% + Resting HR 20% (aligned to ReadinessService weights)

**MetricsGrid generalized** (`src/components/detail/MetricsGrid.tsx`):
- `metrics` prop changed from fixed 4-tuple `[MetricCell, MetricCell, MetricCell, MetricCell]` to `MetricCell[]`; rows rendered dynamically (pairs of 2)

**Supporting changes**:
- `src/hooks/useMetricHistory.ts`: added `respiratoryRate` to `DaySleepData`, populated from `detail_json`
- `src/services/DataSyncService.ts`: destructures `respiratoryRate` from `extractSleepVitalsFromRaw`, saves it in `detail_json`

### Result

Coach tab readiness score and Recovery Detail readiness score now use the same formula. RHR is baseline-relative everywhere. Respiratory rate shows actual ring data or `--` honestly (X3 ring does not reliably report it in sleep payload).

---

## 2026-04-15: Sync Speed — Defer Respiratory Rate + Single-First HR

**Branch:** `feat/ring-sync-ux-followup`

**Source:** Claude Code — Macbook Pro

Two critical-path native calls moved off the main sync, targeting ~4s total savings:

1. **Respiratory rate deferred** (`getRespiratoryRateNightly`): was 3.6s blocking. Now fires as fire-and-forget after `setData`, patches `lastNightSleep.respiratoryRate` + re-saves cache on resolve. Cached previous value preserved in `newData.lastNightSleep` (via `prev.lastNightSleep?.respiratoryRate`).

2. **Single HR is now the primary HR source**: `getSingleHeartRateRaw` called first; `getContinuousHeartRateRaw` skipped entirely when single HR has records (which it always does on this device). One native call removed from the 6s HR stage, saving ~300-500ms.

**Files modified:** `src/hooks/useHomeData.ts`

---

## 2026-04-15: Recovery Detail — Score Explainer Card + "Activity Load" → "Recovery" Rename

**Branch:** `feat/ring-sync-ux-followup`

**Source:** Claude Code — Macbook Pro

### What changed
Added a "How this score was calculated" card at the bottom of the Recovery Detail screen that shows the exact formula, each component's raw input, derived subscore, weight, and contribution points — totalling to the headline readiness number. Also renamed the "Activity Load" Score Breakdown bar to "Recovery" (its inverse-steps meaning is now self-explanatory in context).

### Key finding
The readiness formula on this screen is **fixed-threshold** (not baseline-driven): Sleep 50% (ring score), Resting HR 30% (anchored 40–90 bpm), Recovery 20% (inverse of steps vs 10k target). It differs from `ReadinessService.computeReadiness` which uses 14-day dynamic baselines — documented as known gap for future unification.

### Changes

**`app/detail/recovery-detail.tsx`**
- Added `ExplainerRow` inline component: label + weight chip + raw-input text + mini progress bar + optional italic formula note + contribution pts
- Added `ScoreExplainerCard` inline component: uses `sStyles.card` shell (matches StrainAccumulationCard), renders three `ExplainerRow`s (Sleep/RHR/Recovery) + weighted-total row + two footnotes clarifying the Strain Accumulation separation and fixed-threshold nature
- Added `eStyles` StyleSheet for explainer-specific styles
- Renamed `ContributionBar label="Activity Load"` → `label="Recovery"` in the Score Breakdown section
- `ScoreExplainerCard` is placed after the insight block, passes `readiness`, `steps` (from `getActivity`), and `sleepMinutes` (from `getSleep`) from existing in-scope data — no new hooks or fetches

**Key notes:**
- Math shown matches the headline exactly: `sleepScore × 0.5 + restingHRScore × 0.3 + strainScore × 0.2 = readiness.score`
- Contribution values rounded to 1 decimal (e.g. `45.0 pts`) via `Math.round(x * 10) / 10`
- Card renders for all days (today and past) — uses same `getActivity/getSleep` Map lookups as the rest of the screen
- `StrainAccumulationCard` footnote clarifies it's a separate 7-day Strava EWMA, not an input to the readiness score

---

## 2026-04-15: Recovery Detail — Respiratory Rate Restored + MetricsGrid Flexible

**Branch:** `feat/ring-sync-ux-followup`

**Source:** Claude Code — Macbook Pro

### What changed
Respiratory rate was previously removed from the Recovery Detail MetricsGrid because it was showing `--` for today. The coach app (StyledHealthScreen) shows it regardless, so it was added back.

### Changes

**`src/components/detail/MetricsGrid.tsx`**
- Changed `metrics` prop type from fixed 4-tuple to `MetricCell[]`
- Renders rows of 2 dynamically, so any even/odd number of metrics works

**`src/hooks/useMetricHistory.ts`**
- Added `respiratoryRate: number` to `DaySleepData` interface
- `fetchSleepHistory`: reads `row.detail_json?.respiratoryRate || 0`
- `fetchSleepFromRing`: populates `respiratoryRate: 0` (ring fallback path)

**`src/services/DataSyncService.ts`**
- Now destructures `respiratoryRate` alongside `restingHR` from `extractSleepVitalsFromRaw`
- Saves it into `detail_json` at sync time (persists for future reads)

**`app/detail/recovery-detail.tsx`**
- `todaySleepFallback`: added `respiratoryRate: homeData.lastNightSleep.respiratoryRate ?? 0`
- MetricsGrid now shows 5 metrics: Readiness, Sleep Score, Resting HR, Resp Rate, Recommended
- Resp Rate sourced from `getSleep(selectedDateKey)?.respiratoryRate` (shows `--` when unavailable)

**EAS Update:** `dec7e1ae-7b87-4132-a6a7-c609039f8044` — iOS + Android, channel: production

---

## 2026-04-15: Ring Sync UX Follow-up — Battery Deferral, Last Sync Labels, Sleep Empty Warning

**Branch:** `feat/ring-sync-ux-followup`

**Source:** Claude Code — Macbook Pro

### 1. Battery deferred off critical path
`getBattery()` was awaited inline in `fetchData`, timing out every sync (~5s lost). Moved to fire-and-forget after the main `setData` (alongside cloud sync). On success, patches `ringBattery`/`isRingCharging` via a second `setData` and re-saves the cache. On timeout, previous cached battery remains displayed — no flash to 0.

### 2. "Last sync" caption on all 5 ring-data GradientInfoCards
Added `formatRelativeTime(ts)` helper (`src/utils/time.ts`) and `useRelativeTime(ts)` hook (`src/hooks/useRelativeTime.ts`). Hook runs a 60s self-refreshing interval so the label ages without a re-sync. Caption shows `"Now"` → `"Xm ago"` → `"Xh ago"` → `"Xd ago"`. Applied to:
- Overview: Sleep Score
- Sleep: HRV & Stress, Blood Oxygen
- Activity: Temperature, Min SpO2

`GradientInfoCard` extended with `titleCaption?: string | null` — renders a subtle muted line below the title. `titleColumn` wrapper applies `flexShrink: 1` so the side-by-side vitals row (Temperature + Min SpO2) doesn't overflow.

### 3. Sleep zero-records warning
When all 3 ring retries return 0 sleep records, logs `console.warn('[sync] sleep ring returned 0 records…')` and files a Sentry `warning` event with tag `op: sync.sleep.empty`. Supabase fallback still runs — no UI regression.

**Files created:**
- `src/utils/time.ts`
- `src/hooks/useRelativeTime.ts`

**Files modified:**
- `src/hooks/useHomeData.ts`
- `src/components/common/GradientInfoCard.tsx`
- `src/screens/home/OverviewTab.tsx`
- `src/screens/home/SleepTab.tsx`
- `src/screens/home/ActivityTab.tsx`

---

## 2026-04-15: Recovery Detail — Resting HR Root Cause Fix + Respiratory Rate

**Root cause of past-day resting HR = 0 (confirmed via SQL):**
`heart_rate_readings` stores ALL data ~4 months in the future (July-August 2026) with HR values of 82-131 bpm — these are daytime activity readings with broken timestamps. This table is completely useless for computing resting HR. The only valid source is the ring's sleep payload (`extractSleepVitalsFromRaw`), which produces `homeData.lastNightSleep.restingHR = 40` but was never persisted to Supabase.

**Fix (3 parts):**
1. **`DataSyncService`**: now saves `resting_hr` to `sleep_sessions` during every sync. Extracts it by calling `extractSleepVitalsFromRaw` on the raw records for each sleep block. Also back-fills `resting_hr` on already-saved sessions during the skip/overlap guard path. Going forward, every ring sync populates `resting_hr` for the past 7 days.
2. **`extractSleepVitalsFromRaw` moved to shared utility** (`src/utils/ringData/sleep.ts`). Removed duplicate from `useHomeData.ts`. Updated `useHomeData` and `DataSyncService` imports. Max HR cap tightened from 130 to 90 bpm to reject daytime readings.
3. **Recovery Detail — Respiratory Rate added**: `homeData.lastNightSleep.respiratoryRate` now shown in the MetricsGrid (today only; `--` for past days until persisted). Matches the Oura readiness screen layout.

**What happens next sync:** when the user syncs their ring, `DataSyncService` will back-fill `resting_hr` on the past 7 sleep sessions. `fetchSleepHistory` already reads `resting_hr || detail_json?.restingHR`. The client-side patch in `recovery-detail.tsx` will then find it via `getSleep(dateKey)?.restingHR` and display the correct value.

**Files modified:** `src/services/DataSyncService.ts`, `src/utils/ringData/sleep.ts`, `src/hooks/useHomeData.ts`, `app/detail/recovery-detail.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-15: Recovery Detail — Past-Day Resting HR Fix

**Problem:** Past days in Recovery Detail showed Resting HR = 0, causing underscored readiness scores.

**Root causes (two):**
1. `compute_daily_readiness` used a fixed midnight–8am local window to find overnight HR. Ring readings stored under slightly different timestamps (or from sessions starting before midnight) were missed. When no readings were found, `readiness_resting_hr` was stored as NULL.
2. The client-side patch only triggered when `base.restingHR === 0` but not when it was a bad value > 90 (like 104bpm from a daytime reading the cron accidentally picked up).

**Fix (3 parts):**
1. **New SQL function** (`20260422_fix_readiness_hr_sleep_window.sql`): `compute_daily_readiness` now tries the sleep session's actual `start_time → end_time` window first (joining `heart_rate_readings` to the sleep session), then falls back to midnight–8am, then full-day min. This anchors the HR lookup to when the user was actually asleep, making it immune to timestamp bucketing issues. Backfill ran immediately for the past 30 days.
2. **Client-side patch widened**: now also patches when `base.restingHR > 90` (clearly a bad daytime reading). Falls back through: hrData overnight → sleep_sessions.resting_hr → nothing.
3. **`fetchSleepHistory`**: now reads `resting_hr` column from `sleep_sessions` (populated by cron backfill) as a source: `row.resting_hr || row.detail_json?.restingHR || 0`.

**Files modified:** `app/detail/recovery-detail.tsx`, `src/hooks/useMetricHistory.ts`, `supabase/migrations/20260422_fix_readiness_hr_sleep_window.sql`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-15: Recovery Detail — Today Always Computed Client-Side

**Root cause (diagnosed via logs):** `compute_daily_readiness` cron ran at 12:15 AM ART for today before any ring data was synced. It stored `score:20, sleepScore:0, restingHR:104, restingHRScore:0` — completely wrong. The 104 came from a stray HR reading, not overnight resting HR. The persisted row was then used instead of the correct ring values (sleepScore=90, restingHR=40, readiness=93).

**Fix (3 parts):**
1. `recovery-detail.tsx` — today always bypasses the persisted row and computes client-side using `sleepData` + `hrData` + `homeData`. Past days still use persisted data with the rHR null patch from the previous session.
2. `allScores` trend chart — also excludes today from the persisted path for the same reason.
3. New migration `20260421_fix_readiness_cron_exclude_today.sql` — changed cron range from `CURRENT_DATE-2 → CURRENT_DATE` to `CURRENT_DATE-3 → CURRENT_DATE-1`, so the cron never writes a garbage row for the current day again.

**Files modified:** `app/detail/recovery-detail.tsx`, `supabase/migrations/20260421_fix_readiness_cron_exclude_today.sql`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-15: Fix SyncStatusSheet Show Timing (precheck regression)

**Source:** Claude Code — Macbook Pro

After the precheck was moved before `setData(isSyncing:true)`, cold-start logs showed `[sync] precheck 1522ms` — the header spinner was delayed by 1.5s due to a token refresh during `supabase.auth.getUser()`.

**Fix:** Reverted the order — `setData(isSyncing:true)` fires immediately again (instant header spinner), then the precheck runs async. After it resolves, `showSheet` is flipped via `updateSP({ showSheet: true })` if conditions are met (cold-start + disconnected). Updated `SyncStatusSheet` effect to watch for the "both syncing AND showSheet" combined state going false→true (using `prevShowSheet` ref alongside `prevIsSyncing`), so the sheet opens correctly even when `showSheet` is set slightly after `isSyncing`.

**Files modified:** `src/hooks/useHomeData.ts`, `src/components/home/SyncStatusSheet.tsx`

---

## 2026-04-14: Component Reference Docs + CLAUDE.md Update

**Source:** Claude Code — Macbook Pro

**Change:** Created `components.md` — a comprehensive reference for every component in the app (58 total). Added a rule to `CLAUDE.md` requiring it to be kept in sync whenever components change.

**Files created:**
- `components.md` — Full reference: every component's file path, props, render output, data sources, and invariants. Organized by category (root, ui, common, detail, explainer, focus, home, sleep) with component hierarchy trees for Today and Focus tabs.

**Files modified:**
- `CLAUDE.md` — Added component reference rule under Design Conventions: read `components.md` before touching any component; update it in the same task before writing the `catchup.md` entry.

**Key notes:**
- `components.md` lives at the project root alongside `design-system.md`
- The `SleepHypnogram` invariant (summaryRow.height === tooltipReplacement.height === 50) is documented there
- `GradientInfoCard` usage note included — prefer extending it over creating new card shells
- No skill created — the update rule is inline in `CLAUDE.md` (same pattern as the catchup rule), so Claude handles it automatically without a separate slash command
## 2026-04-20: Sleep Hypnogram — Trim Leading/Trailing Awake + Sync Ring Clock

**Problem:** Two related Sleep-tab bugs:
1. The hypnogram always showed inflated per-stage minute labels (e.g. "20 / 30 min" in the Awake lane) because leading in-bed awake minutes were counted before sleep onset.
2. The BEDTIME label appeared ~20 min earlier than actual bedtime (user went to bed 12:44 AM, app showed 12:21 AM), with the offset varying night-to-night.

**Root cause:** The ring emits sleep records whose `startTimestamp` is when it *started recording* (user donned the ring / moved around in bed before sleep), not when sleep actually began. `buildBlockResult` (and `blockToRingNap`) returned `bedTime = block.start` / `wakeTime = block.end` without trimming the leading/trailing awake segments, so: (a) BEDTIME was earlier than real sleep onset, and (b) the Awake lane count included pre-sleep in-bed minutes. Secondary issue: `JstyleService.setTime()` existed but was never called, so any ring-clock drift compounded over time.

**Fix:**
1. **`src/hooks/useHomeData.ts`** — Added `trimAwakeEdges(segments)` helper that slices off leading + trailing `'awake'` segments while preserving mid-night awakenings (real disturbances). Used in `buildBlockResult` (returns `null` if the block was entirely awake — caller at `~line 882` already handles `null`) and `blockToRingNap` (returns a zeroed `RingNapBlock` so the existing `.filter(n => n.totalMin > 0)` drops it naturally). `timeAsleepMinutes` and the `calculateSleepScore` inputs are unchanged — they still derive from full-timeline stage totals, so sleep score and efficiency scoring stay correct.
2. **`src/services/UnifiedSmartRingService.ts`** — In the Jstyle success branch of `autoReconnect()`, added fire-and-forget `JstyleService.setTime().catch(...)` right after the `connected` state emit. Runs once per physical reconnection (the natural "align clocks" boundary); does not block connection.

**User-visible behaviour:** BEDTIME now equals the first non-awake minute of the hypnogram (sleep onset) — matching Oura/Ultrahuman convention. The Awake lane total no longer includes the minutes spent fidgeting before sleep, so the displayed number is noticeably smaller and matches what was actually slept. Nap card start/end times also reflect first/last non-awake minute. Sleep score and `timeAsleep` are unchanged. Ring clock re-syncs on every reconnect, so BEDTIME drift relative to the phone clock no longer compounds over time.

**Files modified:** `src/hooks/useHomeData.ts`, `src/services/UnifiedSmartRingService.ts`

**Source:** Claude.ai — web

---

## 2026-04-18: HR Card — Restore From Cache on Cold Start

**Problem:** While the app is loading and the ring is still connecting/syncing on cold start, the Heart Rate card on the Overview tab showed **"None"** / **"No data"**. Sleep, Activity, Readiness, etc. already render cached values instantly in the same window.

**Root cause:** `hrChartData` (and its companion `hrDataIsToday`) were **not** included in the `CachedData` persisted to `home_data_cache`. On mount, `useHomeData` initialises `hrChartData: []`, so `DailyHeartRateCard` received `preloadedData=[]` → `noData === true` → rendered `hr_daily.value_none`. The existing preserve-last-good-fetch fallback at `useHomeData.ts` only kicks in after the first successful in-session fetch, so it did nothing on cold start.

**Fix (single file — `src/hooks/useHomeData.ts`):**
1. Added optional `hrChartData` and `hrDataIsToday` fields to the `CachedData` interface.
2. `saveToCache()` now persists both alongside sleep/activity/battery etc.
3. `loadFromCache()` restores them, gated on an `isSameCalendarDay(cachedAt)` check. If the cache was written on a prior calendar day, HR falls back to `[]` / `false` instead of rendering yesterday's hourly buckets as today's.

**User-visible behaviour:** On cold start (force-quit → relaunch while ring connects), the HR card now renders the last known hourly bars + range immediately, matching Sleep/Activity instant-display. Once the fresh BLE fetch completes, the bars update in place. Cross-day launches still show "None" until fresh today-data lands, which is correct.

**Files modified:** `src/hooks/useHomeData.ts`

**Source:** Claude.ai — web

---

## 2026-04-14: Recovery Detail — Resting HR Null Patch

**Problem:** Resting HR showed `--` (0) in the Recovery detail page for today and past days.

**Root cause:** `compute_daily_readiness` pg_cron runs at 12:15 AM ART — before the ring has synced overnight HR data. It stores `readiness_resting_hr = NULL` in `daily_summaries`. `fromPersisted()` mapped `null → 0`, so the metric displayed `--`.

**Fix:** In the `readiness` useMemo (`app/detail/recovery-detail.tsx`), when a persisted record has `restingHR === 0`, patch it from `getHR(selectedDateKey)` — which uses overnight readings from `heart_rate_readings` (past days) or `homeData.lastNightSleep?.restingHR` (today). The `restingHRScore` is also patched to keep the Score Breakdown bar accurate.

**Files modified:** `app/detail/recovery-detail.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-14: Ring Connection UX — Sheet Gate + Stage Timing + Cached Score Animation

Three improvements to the Today screen ring sync flow:

**1. SyncStatusSheet only opens on cold-start + disconnected**
The bottom sheet now has a `showSheet` flag in `SyncProgressState`. It is `true` only when `hydrationReason === 'initial'` AND the ring was not already connected at app launch. Foreground resumes (every 10 min), manual pull-to-refresh, and already-connected cold starts use the existing header spinner only — no sheet interruption.

**2. Per-stage timing instrumentation**
Each sync stage now logs elapsed ms to the console: `[sync] precheck Xms`, `[sync] autoReconnect Xms`, `[sync] sleep Xms`, `[sync] battery Xms`, `[sync] heartRate Xms`, `[sync] hrv Xms`, `[sync] steps+sport Xms`, `[sync] vitals Xms`, `[sync] TOTAL Xms`. The native Jstyle reconnect path also logs `[sync] jstyle.native.autoReconnect Xms`. No behavior change — logs only.

**3. Animated numbers start from cached value, not 0**
`SemiCircularGauge` (used for the Overview overall score and Sleep score) now seeds its `Animated.Value` and `displayScore` state from the incoming `score` prop instead of hardcoded 0. Since the cache is hydrated before mount, the gauge immediately shows the previous day's score and then tweens to the fresh value — no 0→score flash.

**Files modified:**
- `src/types/syncStatus.types.ts` — added `showSheet: boolean` to `SyncProgressState`
- `src/components/home/SyncStatusSheet.tsx` — gate show-trigger on `syncProgress.showSheet`
- `src/components/home/SemiCircularGauge.tsx` — seed `Animated.Value(score)` + `useState(score)`, remove `setValue(0)`
- `src/hooks/useHomeData.ts` — precheck moved before `setData(isSyncing:true)`, `showSheet` added, `logStage` timing markers throughout
- `src/services/JstyleService.ts` — timing wrapper around native `autoReconnect`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-14: HR Chart Gap Auto-Retry

When the HR chart shows empty hours between hours that have data (interior gaps, e.g. 4am-6am missing during sleep), the app now automatically retries the BLE fetch to fill those gaps.

**Logic:**
1. After the initial continuous HR fetch, the app checks for interior gaps (hours with no data flanked by hours with data)
2. If gaps are found, waits 2s for the ring to flush buffers, then re-fetches continuous HR and merges any new readings (dedup by minute)
3. Also fetches single HR readings and merges those for any still-uncovered hours
4. Resting HR calculation includes all newly added readings

**Files modified:** `src/hooks/useHomeData.ts`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-14: WhatsApp Check-In — 3× Daily + App Link + i18n

Upgraded `whatsapp-checkin` from 1 message/day to 3, each with a distinct Claude prompt and data focus. Messages are generated in the user's language (`app_config.whatsapp_language`, supports `en`/`es`):

| Type | Time (ART) | Content |
|------|-----------|---------|
| morning | 9:03 AM | Sleep recap (score, deep sleep, 7-day avg) + HRV + coaching tip |
| evening | 8:03 PM | Activity recap (steps, HR, trends) |
| night | 10:33 PM | Wind-down nudge, sleep deficit vs 8h target |

Each message appends a tappable `📲 https://apps.apple.com/app/com.focusring.app` link from `app_config.whatsapp_app_link` (swap to real App Store URL when published).

**Migration** `20260420_whatsapp_3x_daily_cron.sql`: unscheduled old single cron, created `trigger_whatsapp_checkin(msg_type TEXT)` with `jsonb_build_object('type', msg_type)` body, scheduled 3 new cron jobs.

Also fixed wrong user_id bug (push_tokens returned stale user with no data) and sleep fallback (now uses `.find()` across all 7 daily_summaries rows, matching coach-chat).

**Source:** Claude Code — Macbook Pro

---

## 2026-04-14: Recovery Metric — Server-Persisted Readiness Score

**Source:** Claude Code — Macbook Pro

**Change:** Recovery/readiness was computed on-the-fly in the component with restingHR always being 0 for past days (never persisted), causing every past day to show a distorted score. Moved computation to a server-side pg_cron SQL function that writes into `daily_summaries`, and updated the UI to consume persisted scores with a client-side fallback for today-not-yet-rolled-up.

**Files created:**
- `supabase/migrations/20260419_persist_resting_hr_and_readiness.sql` — Adds `resting_hr` to `sleep_sessions`; adds `readiness_score/sleep_score/hr_score/strain_score/resting_hr/computed_at` to `daily_summaries`; creates `compute_daily_readiness(user UUID, date DATE)` PL/pgSQL function; schedules `daily-readiness-rollup` pg_cron at 03:15 UTC for last 3 days

**Files modified:**
- `src/hooks/useMetricHistory.ts` — Added `'readiness'` MetricType, `DayReadinessData` interface, `fetchReadinessHistory()` querying `daily_summaries.readiness_*` columns, and `case 'readiness'` in hook switch
- `app/detail/recovery-detail.tsx` — Added `fromPersisted()` adapter, `sleepQualityLabel()`/`restingHRLabel()` pure helpers (extracted from inline ternaries), `useMetricHistory('readiness')` hook call, updated `allScores` memo to prefer persisted scores with client-side fallback for today

**Key notes:**
- Formula: `sleep_score × 0.50 + restingHRScore × 0.30 + strainScore × 0.20` — identical to the old client-side `computeReadiness()`
- Server function queries `heart_rate_readings` for midnight–8am min HR (overnight resting HR), with full-day min as fallback
- Production backfill run immediately after migration for last 30 days — all April dates now have real `readiness_resting_hr` values
- Three readiness implementations (`recovery-detail`, `useHomeData`, `ReadinessService`) not consolidated yet — deferred for a dedicated refactor

---

## 2026-04-14: WhatsApp Check-In — Wrong User ID + Sleep Fallback

**Root cause 1 (wrong user):** `push_tokens.limit(1)` returned user `28da220c` (stale/test account with 0 health data). The real user with all health data is `4128d5f7`. Fix: resolve user_id from `app_config.whatsapp_user_id` first, then fall back to `daily_summaries ORDER BY date DESC LIMIT 1` — guaranteed to get the user who has data.

**Root cause 2 (sleep fallback):** Fallback from `sleep_sessions` → `daily_summaries.sleep_total_min` was checking only `[0]` (today's row, which has null sleep since the day isn't over). Coach-chat checks ALL rows via `.find(d => d.sleep_total_min)`. Fixed to use `.find()`.

**Root cause 3 (redundant query + wrong filter type):** `weekSummaries` queried `daily_summaries` with a full ISO timestamp against a `date` column. Merged into single `dailies` query using `sevenDaysAgoDate` (date-only string).

**Result:** Snapshot now shows real data — "slept 7h 52m (score 70/100), deep sleep 120m, 7-day avg 7h 33m". Message references actual numbers.

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: WhatsApp Check-In — Sleep Fallback Fix

**Problem:** `whatsapp-checkin` always showed "no sleep data synced yet" because it only looked at `sleep_sessions`, which was empty for the user.

**Fix:** Added `daily_summaries.sleep_total_min` as fallback (matches `coach-chat` approach). When `sleep_sessions` has no row, `sleepMin` now falls back to `todaySummary?.[0]?.sleep_total_min`. Also removed the 48h time filter on `sleep_sessions` (now just `ORDER BY start_time DESC LIMIT 1`) and expanded `daily_summaries` query to 7 rows with `sleep_total_min` included.

Deployed and tested — message sent (`SM70d3902d41dd2a1f98d70e97090bc334`), Claude generated coaching from illness watch data since sleep was null in both tables.

**Source:** Claude Code — Macbook Pro

---

## 2026-04-14: Daily WhatsApp Check-In via Twilio + Claude AI

New edge function `supabase/functions/whatsapp-checkin/index.ts` + migration `20260418_whatsapp_checkin_cron.sql`.

**Flow:** pg_cron fires at 12:03 UTC daily → `trigger_whatsapp_checkin()` → edge function runs 5 parallel Supabase queries (sleep_sessions, daily_summaries, hrv_readings, illness_scores) → assembles health snapshot → calls Claude Haiku to generate a coaching sentence → sends via Twilio WhatsApp REST API to `whatsapp:+5491169742032`.

**Recipient** seeded in `app_config.whatsapp_recipient`. To add multi-user support later: `whatsapp_numbers` table + Settings opt-in flow.

**Pending:** User must set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` as Supabase secrets and join the Twilio sandbox from their phone before the first message can deliver.

**Test:** `curl -X POST .../whatsapp-checkin -H "Authorization: Bearer focus-notify-2026" -d '{}'`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Wind-down Notification — Per-User Dynamic Delivery Time

**Problem:** Wind-down was sent at a fixed UTC time (01:00), accurate only for ART users with average wake times.

**Fix:** Cron changed to `0 * * * *` (every hour). The edge function computes each user's 7-day average wake time, derives their personal wind-down UTC hour (`avg_wake - 8h 30min`), and only sends to users whose wind-down hour matches the current UTC hour. Everyone else is skipped.

**Example:** User wakes at 6:30 AM UTC → bedtime 10:30 PM → wind-down at 10:00 PM, precisely.

**Files:** `supabase/functions/daily-summary-push/index.ts`, migration `20260417_wind_down_hourly_cron.sql`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: HR Detail — Scroll-Animated Collapsing Header

**Source:** Claude Code — Macbook Pro

**Change:** The heart rate detail page now has a scroll-linked collapsing headline section outside the ScrollView. As the user scrolls down, the big resting HR number (72px) shrinks to 28px and fades from the metric color to white; the "Resting BPM" label shrinks from 24px to 14px; the quality badge (e.g. "Excellent") below the number fades out while an identical badge slides up from below on the right edge — creating a compact justify-between row at full collapse (44px).

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Replaced `ScrollView` import with `Reanimated.ScrollView`; added Reanimated imports (`useSharedValue`, `useAnimatedScrollHandler`, `useAnimatedStyle`, `interpolate`, `interpolateColor`, `Extrapolation`); added `COLLAPSE_END = 80` constant; moved headline block outside `ScrollView` into a `Reanimated.View` with animated height (100→44px) and `overflow: hidden`; added 5 animated styles for number fontSize/lineHeight/color, label fontSize/marginBottom, badge fade, chip translateY+opacity, and container height; replaced `scrollEventThrottle` with Reanimated's native UI-thread scroll handler; added `chipRight` and `headlineLeft`/`headlineSection` styles

**Key notes:**
- Two badge instances are intentional: `badgeRow` fades out (opacity 1→0 by scroll 32px), `chipRight` slides up (translateY 30→0 by scroll 80px) — they cross-fade smoothly
- `useAnimatedScrollHandler` runs on the UI thread natively; `scrollEventThrottle` was removed as redundant
- `headlineSection` uses `overflow: 'hidden'` to clip the chip before it slides in — no conditional rendering needed
- `color` in `numberAnimStyle` worklet closes over the JS-side `color` value; re-renders when `selectedIndex` changes so day-switching updates the gradient endpoints correctly

---

## 2026-04-13: Go Live — Wire pg_cron to Edge Function + CLAUDE.md docs

**Problem:** `trigger_daily_summary_push()` read from PostgreSQL DB-level settings (`current_setting('app.edge_function_url')`) which require superuser to set — cron jobs silently no-oped.

**Fix (`20260416_wire_daily_push_via_app_config.sql`):** Rewrote the function to read `edge_function_url` and `notification_secret` from the existing `app_config` table. Seeded both values in the same migration. Full pipeline now works end-to-end.

**CLAUDE.md updated** with full push notification system docs: local vs server-side, cron schedule table, how pg_cron → edge function wiring works, curl test command.

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Fix Sleep Data Mismatch — Overlap Guard + Trend Card Day-of-Week

**Source:** Claude Code — Macbook Pro

**Change:** Two bugs causing wrong sleep values in the UI. (1) Supabase was storing 5h26m when the ring showed 7h26m — the overlap guard in `DataSyncService` unconditionally skipped any new sync block that overlapped an existing session, so a partial mid-sleep sync permanently blocked the full-night update. Fixed by comparing actual sleep minutes: only skip if existing ≥ new, otherwise delete and replace. (2) The home screen weekly sleep trend card showed wrong durations for specific days (e.g. 4h Saturday, 9h27m yesterday) — it was fetching from `UnifiedSmartRingService.getSleepByDay()` which buckets sessions by start date, splitting overnight sessions across two calendar days. Replaced with a Supabase `daily_summaries` query keyed by wake-up date.

**Files modified:**
- `src/services/DataSyncService.ts` — Changed overlap guard from `some()` skip to `find()` + minutes comparison; if new session has more sleep minutes, deletes old session (if `start_time` differs) and splices it from in-memory list before upserting; caches `startTimeIso` to avoid redundant `.toISOString()` calls
- `src/services/SupabaseService.ts` — Added `deleteSleepSession(userId, startTime)` method used when replacing a session with a different `start_time`
- `src/components/home/DailySleepTrendCard.tsx` — Replaced ring-based 7-day `getSleepByDay()` polling with Supabase `daily_summaries` query; removed `retryNonce` state, `retryCountRef`, `retryTimerRef`, `hasCompletedLiveFetchRef`, `toMinutes()` helper, and `loadedRef` gate (was blocking re-fetch after new sync); now re-fetches whenever `homeData.lastNightSleep?.timeAsleepMinutes` changes; uses `parseLocalDate()` from `chartMath.ts` for correct local-midnight day-of-week
- `src/utils/chartMath.ts` — Added `parseLocalDate(dateStr)` utility to parse YYYY-MM-DD strings as local midnight (avoids UTC offset shifting the day)
- `src/components/detail/TrendBarChart.tsx` — Updated to import and use `parseLocalDate` from `chartMath.ts`, eliminating duplicate inline date parsing

**Key notes:**
- Root cause of wrong day bars: a session starting at 10:18 PM Saturday was placed on the Saturday bar instead of Sunday because `getSleepByDay` uses start date; `daily_summaries` is already keyed by wake-up date (correct anchor)
- `deleteSleepSession` is only called when start_times differ; when they match, the existing `upsert` with `onConflict: 'user_id,start_time'` handles the update automatically
- Overlap guard logs `[Sync] Sleep day N: replacing existing (Xmin) with new (Ymin)` on replacement and `skipping` on keep — useful for verifying the fix in Expo console

---

## 2026-04-13: HR Detail Chart — Always 24h + Filter Future Data

**Source:** Claude Code — Macbook Pro

**Change:** The HR chart now always spans the full 24-hour day (midnight to midnight) instead of compressing the X-axis to the current hour. Future hours show as blank space. Also filters out any ring data points labeled at `hour > currentHour` for today — the Jstyle ring end-of-hour buckets a reading collected during 5PM–6PM as "hour 18", making it appear as a 6PM reading at 5:47 PM local time. Filtering prevents these from rendering in the future portion of the chart.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — `endHour` changed from dynamic `Math.min(currentHour + 1, 24)` to constant `24`; `HourlyHRLine` gains `isToday?: boolean` prop and filters out `hour > currentHour` points when true; time axis labels changed from dynamic fractions of endHour to fixed `[0, 6, 12, 18, 24]` (always `12AM / 6AM / 12PM / 6PM / 12AM`); `isToday={selectedIndex === 0}` passed from screen

**Key notes:**
- Ring end-of-hour bucket behavior: a reading collected between 5PM–6PM is stored with hour=18, appearing as "6PM". Filtering `hour > currentHour` prevents these from showing on today's chart
- Past days always show all data across the full 24h axis

---

## 2026-04-13: HR Detail Chart — Straight Lines + Right-Edge Padding Fix

**Source:** Claude Code — Macbook Pro

**Change:** The HR intraday chart was still rendering smooth bezier curves via `monotoneCubicPath` (Fritsch-Carlson monotone cubic spline). Replaced with a straight polyline so line segments between hourly data points are sharp/angular. Also fixed two visual issues: the last data point was cramped at the extreme right edge (fixed by adding +1 to `endHour`), and the area fill only started at the first data point (~4AM) rather than at midnight (fixed by starting the area path at `PAD_LEFT` at baseline, drawing horizontally to the first data point, then up through all data points).

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — Removed `monotoneCubicPath` import; replaced cubic spline with `'M ' + linePts.map(p => \`${p.x} ${p.y}\`).join(' L ')` polyline; rewrote `areaPath` to start at `PAD_LEFT` (midnight) at baseline; changed `endHour` from `currentHour || 24` to `Math.min(currentHour + 1, 24)` for today and `24` (was `23`) for past days; removed `strokeLinecap="round"` and `strokeLinejoin="round"` from line Path for sharp joins

**Key notes:**
- Past-day charts now use `endHour = 24` (was 23) so the X axis always spans the full day
- Area fill path: `M PAD_LEFT baselineY → L firstX baselineY → L` through all data pts `→ L lastX baselineY → Z` — ensures shaded region spans from midnight even when first reading is hours after midnight

---

## 2026-04-13: HR Detail — Y-axis Labels, Chart Padding, Live HR Card Margin

**Source:** Claude Code — Macbook Pro

**Change:** Three final polish items on the HR detail chart: Y-axis BPM indicators added at the three horizontal grid lines, slight horizontal padding added to the chart container so the line doesn't sit flush against the edges, and the embedded live HR card now has the correct `marginHorizontal` to align with the rest of the content.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — `PAD_LEFT = 34` / `PAD_RIGHT = 8` replace symmetric `PAD_H`; `toX` updated to use asymmetric padding; `CHART_W` reduced by `spacing.sm * 2` to account for container `paddingHorizontal`; each of the 3 grid lines now renders a paired `SvgText` Y label (BPM value at `x=2`, muted `rgba(255,255,255,0.3)`); `chartContainer` gains `paddingHorizontal: spacing.sm`; `LiveHeartRateCard` wrapped in `liveCardWrapper` with `marginHorizontal: spacing.md`

**Key notes:**
- Y labels use `textAnchor="start"` at `x=2` so they sit in the 34px left gutter without overlapping the plotted line area
- BPM value at each grid line computed as `Math.round(minY + (1 - frac) * range)` — matches the actual scale for that day's data range
- No vertical axis line — labels only, keeping the chart visually clean

---

## 2026-04-13: HR Detail — Chart Polish, 24h X-axis, Live HR Card, Border Cleanup

**Source:** Claude Code — Macbook Pro

**Change:** Polished the HR detail page (thinner line, white dots, press-to-inspect tooltip, chart height ×1.3, dynamic X-axis), fixed a bug where yesterday's Peak HR (130 BPM) appeared as today's, and introduced a reusable 2×2 `MetricsGrid` component adopted across all 8 detail pages.

**Files created:**
- `src/components/detail/MetricsGrid.tsx` — Reusable 2×2 metrics grid with `MetricCell` interface (`label`, `value`, `unit?`, `accent?`, `onPress?`); subtle `rgba(255,255,255,0.06)` dividers; 24px demiBold values; optional `TouchableOpacity` per cell

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — `CHART_H` 180→234 (×1.3); line `strokeWidth` 2→1.2; dots `r=4.5 fill="#FFFFFF"`; `PanResponder` tooltip overlay (floating `View` + vertical cursor `<Line>` + highlighted dot); dynamic X-axis: `minHour`/`maxHour`/`hourSpan` so partial-day data fills full chart width; `todayLive` gated on `homeData.hrDataIsToday` to prevent yesterday's data contaminating today's display; MetricsGrid replaces old `statsContainer` rows (Resting HR / Avg HR / Peak HR / Hours Tracked)
- `src/hooks/useHomeData.ts` — Added `hrDataIsToday: boolean` to `HomeData` interface, default state, HR fetch block, and `setData` payload; true only when ring's target date equals today's date
- `app/detail/recovery-detail.tsx` — MetricsGrid for Readiness / Sleep Score / Resting HR / Recommended; remaining conditional rows kept as `DetailStatRow`
- `app/detail/sleep-detail.tsx` — MetricsGrid for Sleep Efficiency / Bed Time / Wake Time / Resting HR
- `app/detail/hrv-detail.tsx` — MetricsGrid for SDNN / RMSSD / pNN50 / Stress Level with accent colors
- `app/detail/spo2-detail.tsx` — MetricsGrid for Overnight Avg / Min / Max / Status
- `app/detail/temperature-detail.tsx` — MetricsGrid for Current / Average / Min / Max with accent colors
- `app/detail/activity-detail.tsx` — MetricsGrid for Steps / Distance / Calories / Avg HR
- `app/detail/sleep-debt-detail.tsx` — MetricsGrid for Avg Sleep / Target Sleep / Days Tracked / Total Debt

**Key notes:**
- Peak HR fix root cause: `useHomeData` falls back to yesterday's ring data when today's ring buffer is empty (ring last synced at 11:26 AM → yesterday's data from 11:26 AM onward is in the buffer). `hrDataIsToday` flag prevents `buildTodayHRFromContext` from treating this as today's data.
- Dynamic X-axis: chart maps `minHour`–`maxHour` (actual recorded range) so a sync at 11:26 AM shows data starting from left edge, not stranded at 48% of the width.
- PanResponder uses `handleRef.current` reassignment pattern: PanResponder created once (avoids recreation), handler reassigned every render to capture fresh `sorted`/`toX` closures.
- `formatHourCompact()` and `formatHourLabel()` extracted as module-level helpers (not inline IIFEs).
- `touchableCell` style lives in `StyleSheet`, not inline.

---

## 2026-04-13: HR Detail — Chart Polish, 24h X-axis, Live HR Card, Border Cleanup

**Source:** Claude Code — Macbook Pro

**Change:** Three visual/UX improvements to the HR detail page and all detail pages with line charts: (1) HR chart now spans midnight → current time rather than just the recorded data range; (2) chart containers lose their border and get tighter corner radius (16→8); (3) the live heart-rate measurement card from the Health tab is embedded below the metrics grid on the HR detail page.

**Files modified:**
- `app/detail/heart-rate-detail.tsx` — `endHour` prop added to `HourlyHRLine`; X-axis always starts at 0 (midnight) and ends at current hour (or 23 for past days); midnight edge case handled with `|| 24`; `endHour` memoized in screen component; `chartContainer` border removed, `borderRadius` 16→8; `LiveHeartRateCard` rendered after MetricsGrid; `chartStyles.chartWrapper` extracted from inline `position: 'relative'`
- `app/detail/sleep-detail.tsx` — `hypnogramWrapper` border removed, `borderRadius` 16→8
- `src/components/detail/DetailChartContainer.tsx` — wrapper `borderRadius` 16→8 (applies to temperature and SpO₂ pages)

**Key notes:**
- `endHour = new Date().getHours() || 24` — `|| 24` prevents the chart collapsing to a single pixel column at midnight (hour 0)
- `LiveHeartRateCard` is self-contained with its own cleanup; safe to embed — listeners unsubscribe on unmount
- Removed border only from chart containers that are the primary/first chart on the page; `statsContainer` and insight cards keep their borders

---

## 2026-04-13: Fix Sleep Sync Overlap Guard Dropping Full-Night Data

**Source:** Claude Code — Macbook Pro

**Change:** The Supabase sleep sync was permanently stuck on a partial session (5h 26m) even after the ring had the full night's data (7h 26m). The overlap guard in `syncSleepData` unconditionally skipped any new block that overlapped an existing session by >30 min — so once a partial sync ran (e.g. mid-sleep), the full night was blocked forever. Fixed by comparing actual sleep minutes: if the new block has strictly more `deep+light+rem` minutes than the stored session, it replaces it.

**Files modified:**
- `src/services/DataSyncService.ts` — overlap guard changed from binary skip to a minutes-comparison; caches `startTimeIso` to avoid redundant `.toISOString()` calls per loop iteration
- `src/services/SupabaseService.ts` — added `deleteSleepSession(userId, startTime)` for the case where the replacement block has a different `start_time` than the stored one

**Key notes:**
- Same-`start_time` replacements are handled automatically by the existing `upsert` with `onConflict: 'user_id,start_time'`
- Different-`start_time` replacements delete the old row first, then upsert the new one
- The in-memory `nightSessions` array is spliced after replacement so subsequent loop iterations (day 1, day 2…) don't re-match the deleted session
- `daily_summaries.sleep_total_min` is refreshed automatically by `updateDailySummary()` which runs after `syncSleepData()` completes

---

## 2026-04-13: Wind-down Notification + Morning Fallback Push

**Morning fallback (`daily-summary-push`, type=`morning`):**
Users who haven't synced by 9 AM now receive a generic "Your sleep summary is ready 🌙 — See how you slept last night. Tap to view your analysis." instead of being silently skipped. Users who did sync get the rich version with actual duration and score.

**Wind-down notification (`daily-summary-push`, type=`wind-down`):**
New notification type. At 10 PM ART (01:00 UTC), reads each user's most recent `sleep_sessions.end_time` from the last 7 days. Computes `bedtime = wake_time - 8h` and sends: "Time to wind down 🌙 To wake at 6:45 AM well-rested, aim to be asleep by 10:45 PM." Skips users with no sleep history.

**Migration `20260414_wind_down_push_cron.sql`:** Added `daily-wind-down-push` pg_cron at `0 1 * * *` calling `trigger_daily_summary_push('wind-down')`. Both deployed to Supabase.

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Detail Pages — Color Cleanup (Sleep Stages + Recovery Breakdown)

**Sleep detail:**
- Restored stage-specific colors on `SleepStageBar` fill bars and dots (Deep `#7C6CC0`, REM `#60A5FA`, Light `#93C5FD`, Awake `#F87171`)
- Removed confusing range overlay from the progress bar track
- Added `target X–Y%` text label per row (muted, replaces the visual band) — turns green when in range

**Recovery detail:**
- `ContributionBar` (Sleep Quality, Resting HR, Activity Load) fill and value text now white — removed purple/blue/green per-metric colors

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Sleep Detail — Score Breakdown Decolored

- `SleepStageBar` dots and fill bars are now white (`rgba(255,255,255,0.45)` / `0.6`) — removed per-stage colors (purple/blue/red)
- Removed `color` prop from `SleepStageBar` entirely
- Removed `accent="#8B5CF6"` from Total Nap Time stat row
- Headline score and quality badge keep their color

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Detail Page Refactor — TrendBarChart, DetailPageHeader, Resting HR Fix

**What changed (user-visible):**
- All 9 detail pages now share a consistent back-button header (centered title, correct safe-area handling)
- Heart Rate detail: spacing added between title and trend chart; stat rows are now white (no colored accents)
- Recovery detail: sub-metric rows (sleep HR, sleep quality, strain) now white
- Resting HR on HR detail now shows real values instead of 0 — was a UTC vs local date mismatch in `toDateStr`

**Shared components created:**
- `src/utils/chartMath.ts` — `roundedBar`, `rollingAvg`, `monotoneCubicPath` extracted from 4 duplicated chart files
- `src/components/detail/TrendBarChart.tsx` — Generic scrollable bar chart replacing `HRTrendChart`, `SleepTrendChart`, `HRVTrendChart`, `ReadinessTrendChart` (~900 lines reduced)
- `src/components/detail/DetailPageHeader.tsx` — Shared header with `useSafeArea` flag for Group A (header owns insets) vs Group B (container owns insets) pages

**Bug fixed:**
- `toDateStr` in `useMetricHistory.ts` used `toISOString().split('T')[0]` (UTC date). Users in UTC-offset zones saw resting HR = 0 because overnight readings (local hours 0–7) were assigned to the wrong dateKey. Fixed by using `getFullYear()/getMonth()/getDate()` (local date components).

**Files deleted:** `HRTrendChart.tsx`, `SleepTrendChart.tsx`, `HRVTrendChart.tsx`, `ReadinessTrendChart.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-13: Background Fetch Expansion + Daily Summary Push Notifications

**Phase 2 — Expanded Background Fetch (`src/services/BackgroundSleepTask.ts`):**
- Extended active time window from `5 AM–2 PM` to `5 AM–11 PM` so the background task keeps the data fresh throughout the day, not just the morning
- Added a full data sync (via `dataSyncService.syncAllData()`) on each background wake, rate-limited to once every 2 hours via `@focus_bg_sync_last_at` AsyncStorage key. Result is logged to `background_logs` table. This means Supabase data stays fresh even when the user hasn't opened the app

**Phase 3 — Daily Summary Push Notifications:**

New edge function `supabase/functions/daily-summary-push/index.ts`:
- **Morning** (12:00 UTC = 9 AM ART): queries `sleep_sessions` for each user (24-hour lookback to avoid UTC timezone cutoff bugs) and sends "You slept 7h 32m · Score: 85. Tap to see your full analysis." → deeplinks to Sleep tab
- **Evening** (23:00 UTC = 8 PM ART): queries `daily_summaries` for today and sends "8,234 steps · avg HR 72 bpm. Tap to see your full day." → deeplinks to Activity tab
- Bulk-fetches all users' data upfront (not N+1) then fans out to push tokens
- Sends to Expo Push API in batches of 100 with error checking per batch

New migration `20260413_daily_summary_push_cron.sql`:
- `trigger_daily_summary_push(type)` PL/pgSQL function calls the edge function via `net.http_post`
- Two pg_cron schedules: `daily-summary-push-morning` (0 12 * * *) and `daily-summary-push-evening` (0 23 * * *)

Both deployed to Supabase (edge function + migration applied).

**Source:** Claude Code — Macbook Pro

---

## 2026-04-12: Instant Cached Data on App Open + "Last Synced" in Device Sheet

**Problem:** Users saw a blank screen for 12-14s every time they opened the app while the ring reconnected. This happened because the disconnect handler called `getEmptyData()`, wiping all cached values from the previous sync.

**Changes:**

1. **`src/hooks/useHomeData.ts`** — Disconnect handler no longer clears data. Instead it preserves all existing state and only flips `isRingConnected: false`. Added `lastSyncedAt: number | null` to `HomeData` + `CachedData`. Set on each successful `fetchData()` call and persisted in AsyncStorage cache (falls back to `cachedAt` for old cache entries).

2. **`src/components/home/DeviceSheet.tsx`** — Added `lastSyncedAt` prop and `formatSyncedAt()` helper. Shows "Synced just now / Xm ago / Xh ago / yesterday" below the connected/disconnected badge.

3. **`src/screens/NewHomeScreen.tsx`** — Passes `lastSyncedAt={homeData.lastSyncedAt}` to `DeviceSheet`.

4. **`app/_layout.tsx`** — Moved `Notifications.setNotificationHandler` from inside a lazy async `import()` to module scope (synchronous). Fixed deprecated `shouldShowAlert` → `shouldShowBanner` + `shouldShowList`. Simplifies deeplink `useEffect` to use the synchronous import.

5. **`ios/JstyleBridge/JstyleBridge.m`** — Removed all background-test code (scheduleTestNotification, appDidEnterBackground/Foreground observers). Kept the `EnableCommunicate` bug fix (moves `enableAutomaticHRMonitoring` to after characteristic discovery completes).

**User-visible result:** Data is visible instantly on app open. Device sheet shows how long ago the ring last synced.

**Source:** Claude Code — Macbook Pro

---

## 2026-04-12: Fix HR Detail Page Crash (undefined `todayFallback`)

**Bug:** HR detail page crashed immediately on open. Root cause: `hrValues` useMemo referenced `todayFallback` (undefined) instead of `todayLive` (the correct variable name used earlier in the component). This caused a `ReferenceError` at render time.

**Fix:** Renamed `todayFallback` → `todayLive` in both the condition and dependency array of the `hrValues` useMemo in `app/detail/heart-rate-detail.tsx`.

**EAS Update:** `40966c71-62b0-48b3-a0f6-12373d38056f` (production, iOS + Android)

---

## 2026-04-12: HR Detail Page Redesign + Activity Markers on Home Card

**Changes:**

1. **`src/components/detail/HRTrendChart.tsx`** (new): Scrollable 30-day resting HR trend bar chart for the HR detail header. Same pattern as Sleep/Readiness trend charts. Bar height = raw resting HR / 120bpm. Color: green ≤55, yellow ≤65, orange ≤75, red >75. Dotted guides at 30/60/90 bpm.

2. **`app/detail/heart-rate-detail.tsx`** (full rewrite): Now mirrors sleep-detail layout:
   - Gradient zone header (red `#AB0D0D` + deep red `#7B0000` radial gradients) with back button, title, and `HRTrendChart`
   - Headline: resting HR big number (72px) + "Resting BPM" label + quality chip (EXCELLENT/GOOD/FAIR/ELEVATED) — same badge pattern as sleep/recovery
   - Main chart: **line chart** (SVG monotone cubic path) connecting hourly HR readings with area fill, data-point dots, and hour axis labels
   - Border-only stats card + insight block (no background fills)
   - Extended to 30-day history (`buildDayNavigatorLabels(30)`)

3. **`src/components/home/DailyHeartRateCard.tsx`**: Added Strava activity markers.
   - `useHomeDataContext()` to read today's `stravaActivities`
   - Maps each activity to its start hour (local time)
   - Renders a small orange pin (`#FC4C02` dot + stem) at the top of each bar column that has an activity
   - Tapping the pin navigates to `/detail/heart-rate-detail`

**Files modified/created:**
- `src/components/detail/HRTrendChart.tsx` (new)
- `app/detail/heart-rate-detail.tsx`
- `src/components/home/DailyHeartRateCard.tsx`

---

## 2026-04-12: Fix HR Chart Bar Positioning (Inverted Top Calculation)

**Bug:** Bars in the daily HR chart were positioned upside-down. The `top` offset was calculated from `barMin` (low HR = top of chart), so a 5am reading of 44–92 appeared as one of the highest bars despite having a lower peak than a 12pm reading of 66–128.

**Fix:** Changed `topPct` from `(barMin - hrMin) / hrRange` to `(hrMax - barMax) / hrRange`. Now the bar's top edge correctly maps to its peak value — higher HR peak = bar starts closer to the top of the chart.

**File:** `src/components/home/DailyHeartRateCard.tsx` line 222

---

## 2026-04-12: Detail Pages — Border-Only Cards + Recovery Headline Sync

**Changes:**

1. **Border-only cards (both sleep-detail + recovery-detail):** Removed `backgroundColor: 'rgba(255,255,255,0.04)'` from all card containers below the score headline. Replaced with `borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'`. Also removed insight block background fills (kept their accent border colors). Affected: `statsContainer`, `hypnogramWrapper`, `insightBlock` in sleep-detail; `statsContainer`, `contribContainer`, `sStyles.card` (StrainAccumulationCard), `insightBlock` in recovery-detail.

2. **Recovery headline synced to sleep-detail pattern:**
   - Restructured JSX: `headlineOuter` (column) → `headlineRow` (row: score + label) + `badgeRow` (row wrapper for badge)
   - `headlineScore`: `lineHeight: 80` → `lineHeight: 0`
   - `headlineLabel`: `fontSize: 18` → `fontSize: 24`, added `marginBottom: 12`
   - `badgeRow`: `flexDirection: 'row', alignSelf: 'flex-start'` (fixes badge overflow)
   - `badge`: `paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10`
   - `badgeText`: added `textTransform: 'uppercase'`
   - `gradientZone`: removed `paddingBottom: spacing.md`

**Files modified:** `app/detail/sleep-detail.tsx`, `app/detail/recovery-detail.tsx`

---

## 2026-04-12: Sleep Detail — Badge Overflow Fix + Label Margin Tweak

**Change:** Fixed the quality badge (Excellent/Fair/Poor) on the sleep detail header still stretching to full width. Added `alignSelf: 'flex-start'` to `badgeRow` so the flex-row wrapper explicitly collapses to content width. Also reduced `headlineLabel` marginBottom from 16 → 12 for tighter vertical spacing between "Sleep Score" and the badge.

**Files modified:** `app/detail/sleep-detail.tsx`

---

## 2026-04-12: Disable Vercel Plugin for Focus Project

**Change:** Added `enabledPlugins: { "vercel@claude-plugins-official": false }` to `SmartRingExpoApp/.claude/settings.local.json`. This prevents the vercel/nextjs PostToolUse hooks from firing false-positive "use client" suggestions on Expo Router files — this is an Expo project, not Next.js.

**Files modified:** `SmartRingExpoApp/.claude/settings.local.json`

---

## 2026-04-12: Comprehensive Sentry Instrumentation (All Services, Hooks, UI + Daily Agent)

**Change:** Added full Sentry error reporting across the entire Focus app — ~140 previously invisible error-handling sites now report to Sentry. Created a centralized `src/utils/sentry.ts` utility, enhanced `Sentry.init()` config, wired user identification, and added BLE breadcrumbs. Also set up a daily remote Claude Code agent (cron `0 12 * * *`) that queries Sentry via REST API, analyzes stack traces, and auto-creates fix PRs for the `focus-app-1` project.

**Files created:**
- `src/utils/sentry.ts` — Central wrapper: `reportError`, `reportMessage`, `addBreadcrumb`, `setUserContext`, `setRingContext`. Fast path skips `withScope` when no context needed.

**Files modified:**
- `app/_layout.tsx` — Enhanced `Sentry.init()`: added `environment`, lowered sample rates to 0.3/0.1 for production, added `beforeSend` to strip token/secret keys from breadcrumb data
- `src/hooks/useAuth.ts` — `setUserContext` called on both initial session load (`getSession()`) and every auth state change so Sentry always knows which user is affected
- `src/services/SupabaseService.ts` — All 28 DB methods (insert/upsert/select/update across every table) now call `reportError` with `{ method, table }` context
- `src/services/DataSyncService.ts` — 9 sites: `syncAllData` top-level, per-metric syncs (HR, steps, sleep, vitals, BP, sport), daily/weekly summary updates, battery/version fetches. Added `addBreadcrumb` on sync completion.
- `src/services/BackgroundSleepTask.ts` — 2 sites: reconnect failure and top-level task crash (`'fatal'` level — runs without UI, invisible otherwise)
- `src/services/AuthService.ts` — OAuth flow catch
- `src/services/UnifiedSmartRingService.ts` — 8 sites: `getPersistedSDKType`, AsyncStorage persist/remove, autoReconnect failures (jstyle/v8) with `reason` tag, BLE breadcrumbs (connect/disconnect/reconnect), `setRingContext` on connection
- `src/services/JstyleService.ts` — 5 sites: module load, `cancelPendingDataRequest`, `enqueueNativeCall` timeout (breadcrumb), `getAllDailyStepsHistory`, `enableAutoHRMonitoring`
- `src/services/V8Service.ts` — 4 sites: queue tail, `stopScan` ×2, `disconnect`, `cancelPendingDataRequest` (all warning — inactive SDK)
- `src/services/StravaService.ts` — 9 sites: connect, token exchange/refresh/load, API request, sync detail query, per-activity fetch, Supabase sync, background sync
- `src/services/HealthKit/HealthKitDataFetchers.ts` — 7 sites across all fetch functions
- `src/services/HealthKit/HealthKitPermissions.ts` — 3 sites: inner loop, fatal outer, auth request
- `src/services/HealthKit/HealthKitSleepProcessor.ts` — 1 site
- `src/services/HealthKit/HealthKitSubscriptions.ts` — 1 site
- `src/services/NotificationService.ts` — background task registration
- `src/services/BaselineModeService.ts` — AsyncStorage + Supabase persist
- `src/services/TodayCardVitalsService.ts` — 6 sites across all fetch/cache operations
- `src/hooks/useSleepBaseline.ts`, `useSleepDebt.ts`, `useHealthData.ts`, `useFocusData.ts`, `useMetricHistory.ts`, `useSmartRing.ts`, `useHomeData.ts` — 35 total sites across all hooks
- `src/context/OnboardingContext.tsx` — 5 sites
- `src/components/home/LiveHeartRateCard.tsx`, `DailySleepTrendCard.tsx`, `DailyHeartRateCard.tsx` — 6 sites
- `src/components/sleep/SleepStageTimeline.tsx` — **Removed** 3 dead `fetch('http://127.0.0.1:7244/ingest/...')` debug blocks
- `src/screens/NewHomeScreen.tsx`, `SettingsScreen.tsx` — 4 sites
- `app/(onboarding)/connect.tsx` — 2 sites

**Key notes:**
- `'fatal'` used only for `BackgroundSleepTask` top-level crash (no UI, fully invisible without this)
- `'warning'` for all BLE/recoverable errors; `'error'` (default) for unexpected failures
- `setUserContext` called on both app-launch session restore AND auth state changes — fixes the common case where Sentry had no user ID on first launch
- `withScope` fast path added: skips scope allocation when no context tags needed (efficiency fix)
- Noisy `addBreadcrumb` on every BLE native call removed from `enqueueNativeCall` — only breadcrumb on timeout now
- Daily scheduled agent: trigger ID `trig_016Md61YY21bVnYkcMoPZP4U`, runs at 12:00 UTC (9 AM Buenos Aires), hits `GET /api/0/projects/sparring-10/focus-app-1/issues/`, filters last 24h, auto-creates `sentry/fix-{id}` branches + PRs for fixable issues, appends to `sentry-report.md`

---

## 2026-04-12: Sentry Error Reporting — UI Files + SleepStageTimeline Debug Cleanup

**Change:** Added `reportError` from `src/utils/sentry.ts` to 8 UI files (context, components, screens, hook, and onboarding screen), and removed all `fetch('http://127.0.0.1:7244/...')` dead debug instrumentation from `SleepStageTimeline.tsx`. All existing `console.log`/`console.error` calls preserved unchanged; `reportError` is added alongside each catch site.

**Files modified:**
- `src/context/OnboardingContext.tsx` — Added import; 5 sites: `onboarding.autoReconnect` (silent catch → named), `onboarding.deviceCheck` (warning, SDK check inner catch), `onboarding.loadDeviceState` (outer catch), `onboarding.forgetDevice` (warning, `clearDevicePairing` catch), `onboarding.reset.forgetDevice` (warning, `resetOnboarding` silent `catch (_) {}` → named)
- `src/components/home/LiveHeartRateCard.tsx` — Added import; 3 sites: `liveHR.bleStart` (warning, `startMeasurement` outer catch), `liveHR.measure` (warning, retry `startHeartRateMeasuring` catch), `liveHR.persist` (info, `AsyncStorage.setItem` catch in `persistLastMeasurement`)
- `src/components/home/DailySleepTrendCard.tsx` — Added import; 2 sites: `sleepTrend.fetch` (warning, inner per-day catch), `sleepTrend.fetch` (warning, outer `fetchSleep().catch` — converted from silent `() =>` to named `e =>`)
- `src/components/home/DailyHeartRateCard.tsx` — Added import; 1 site: `dailyHR.fetchHourly` (warning, silent `.catch(() => setHourlyHrRanges([]))` → named with `reportError` + same state reset)
- `src/components/sleep/SleepStageTimeline.tsx` — **No Sentry added.** Removed all 3 `fetch('http://127.0.0.1:7244/ingest/...')` debug blocks (entry, ringData, customData, and error catch) plus their `// #region agent log` / `// #endregion` wrappers — dead code from a previous debugging session
- `src/screens/NewHomeScreen.tsx` — Added import; 3 sites: `homeScreen.topLevel` (reconnect catch), `homeScreen.notificationSetup` (NotificationService.setup silent catch → named block), `homeScreen.sleepNotification` (warning, maybeSendSleepNotification silent catch → named block)
- `src/screens/SettingsScreen.tsx` — Added import; 1 site: `settings.load` (warning, `loadSettings` silent `catch {}` → named `catch (e)`)
- `app/(onboarding)/connect.tsx` — Added import (`../../src/utils/sentry`); 2 sites: `onboarding.scan` (warning, `scan(7).catch` inline block), `onboarding.connect` (default error, `handleConnect` outer catch before Alert)
- `src/hooks/useHomeData.ts` — Added import; 2 sites only: `homeData.syncAllData` (`.catch` on `dataSyncService.syncAllData()` — named `e`, added alongside existing state update), `homeData.fetchData` (`'fatal'` level, `fetchData` outer catch before `setData`)

**Key notes:**
- `'fatal'` level used only for `homeData.fetchData` — the outermost catch of the main data sync loop
- `'info'` level for AsyncStorage persist failures in LiveHeartRateCard (non-critical, best-effort)
- `'warning'` for all recoverable/expected failures; default `'error'` for unexpected paths
- connect.tsx Next.js "use client" suggestions from the validator are inapplicable — this is Expo Router, not Next.js
- SleepStageTimeline cleanup removed exactly 3 fetch blocks (10 lines of dead code) with zero behavior change to the component

---

## 2026-04-12: Sentry Error Reporting — Secondary Service Files

**Change:** Added `reportError` from `src/utils/sentry.ts` to 8 secondary service files (Strava, HealthKit sub-services, NotificationService, BaselineModeService, TodayCardVitalsService). All existing `console.log`/`console.error`/`console.warn` calls are preserved unchanged; `reportError` is added alongside each catch block so errors surface in Sentry in production without altering runtime behavior.

**Files modified:**
- `src/services/StravaService.ts` — Added import + 9 `reportError` sites: `strava.connect`, `strava.exchangeCode`, `strava.refreshToken` (expanded silent `catch {}` to named param), `strava.loadTokens`, `strava.apiRequest`, `strava.syncDetails.query`, `strava.fetchActivityDetail` (warning, before `failed++`), `strava.syncToSupabase`, `strava.backgroundSync` (warning)
- `src/services/HealthKit/HealthKitDataFetchers.ts` — Added import + 7 `reportError` sites: `healthKit.fetchHeartRateData`, `healthKit.fetchStepsData` (outer), `healthKit.fetchStepsData.fallback` (inner — expanded silent `catch {}` to named param), `healthKit.fetchHRVData`, `healthKit.fetchSpO2Data`, `healthKit.fetchActiveCaloriesData`, `healthKit.fetchDistanceData`; all at `'warning'` level
- `src/services/HealthKit/HealthKitPermissions.ts` — Added import + 3 `reportError` sites: `healthKit.checkPermissions.inner` (warning, in permission loop catch after NSSortDescriptor rethrow), `healthKit.checkPermissions` (default `'error'`, fatal outer catch), `healthKit.requestAuth` (warning)
- `src/services/HealthKit/HealthKitSleepProcessor.ts` — Added import + 1 `reportError` site: `healthKit.fetchLatestSleep` (warning) in `fetchSleepData` outer catch
- `src/services/HealthKit/HealthKitSubscriptions.ts` — Added import + 1 `reportError` site: `healthKit.subscription.setup` (warning) in per-type subscription catch
- `src/services/NotificationService.ts` — Added import + 1 `reportError` site: `notification.registerBackgroundTask` (default `'error'`) — expanded one-liner `.catch(e => console.warn(...))` to a block to accommodate both calls
- `src/services/BaselineModeService.ts` — Added import + 2 `reportError` sites: `baselineMode.persistLocal` (warning, AsyncStorage save failure), `baselineMode.persistSupabase` (warning, Supabase upsert failure)
- `src/services/TodayCardVitalsService.ts` — Added import + 6 `reportError` sites: `todayCard.fetchTemperature`, `todayCard.fetchSpO2`, `todayCard.connectionCheck`, `todayCard.loadCache`, `todayCard.saveCache`, `todayCard.hydrationCheck`; all at `'warning'` level

**Key notes:**
- All sites use `{ op: 'domain.operation' }` context tag for easy Sentry filtering/grouping
- `'warning'` level used for recoverable failures (BLE reads, cache ops, best-effort network calls); default `'error'` reserved for unexpected or fatal paths
- Two previously silent `catch {}` blocks (Strava `refreshToken`, HealthKit steps fallback) were expanded to named-param catches — behavior unchanged, errors now reported
- HealthKit sub-services use `../../utils/sentry` relative path (two levels up from `src/services/HealthKit/`)
- All other service files use `../utils/sentry` relative path

---

## 2026-04-12: Sentry Error Reporting — BLE Service Instrumentation

**Change:** Added Sentry error reporting, breadcrumbs, and ring context tagging to three BLE service files using the existing `src/utils/sentry.ts` utility. All existing `console.log`/`console.error` calls are preserved; Sentry calls are added alongside them.

**Files modified:**
- `src/services/UnifiedSmartRingService.ts` — Added `reportError` on AsyncStorage failures (`getPersistedSDKType`, `persistSDKType.setItem`, `persistSDKType.removeItem`); `reportError` on Jstyle and V8 autoReconnect failure (both non-success result and thrown exception paths); `addBreadcrumb` at autoReconnect start/success and disconnect; `setRingContext` on successful Jstyle connection (already-connected path and post-reconnect path)
- `src/services/JstyleService.ts` — Added `reportError` on native module load failure, `cancelPendingDataRequest` failure, final `enqueueNativeCall` failure (after retries exhausted), `getAllDailyStepsHistory` failure, and `enableAutoHRMonitoring` failure; `addBreadcrumb` when a native call is enqueued and when it times out
- `src/services/V8Service.ts` — Added `reportError` on `stopScan` failures (setTimeout and direct), `disconnect` failure, and `cancelPendingDataRequest` failure; import is `reportError` only (inactive SDK — minimal changes)

**Key notes:**
- `src/utils/sentry.ts` (new untracked file) exports `reportError`, `addBreadcrumb`, `setRingContext`, `reportMessage`, `setUserContext` — all backed by `@sentry/react-native`; Sentry is a no-op in `__DEV__` mode
- The V8 queue tail `.catch(() => {})` was intentionally kept as a silencer — replacing it with `reportError` would cause double-reporting since call errors already propagate to callers via `next`
- Simplify pass fixed a copy-paste bug: V8 autoReconnect success was calling `setRingContext(deviceId, 'jstyle')` — corrected to `'v8'`
- `String(operationName || '')` redundant coercions in breadcrumb data simplified to `operationName` (already typed `string`)

---

## 2026-04-12: Sentry Error Reporting — Hook Files

**Change:** Added `reportError` from `src/utils/sentry.ts` to all six hook files that had silent or console-only error handling. All existing `console.log`/`console.warn` calls are preserved unchanged; `reportError` is added alongside them so errors surface in Sentry in production without altering runtime behavior.

**Files modified:**
- `src/hooks/useSleepBaseline.ts` — Added import; `reportError` on Supabase sync `.catch` and outer load catch (`sleepBaseline.supabaseSync`, `sleepBaseline.compute`)
- `src/hooks/useSleepDebt.ts` — Added import; `reportError` on load catch and `updateTarget` catch (`sleepDebt.calculate`, `sleepDebt.fallback`)
- `src/hooks/useHealthData.ts` — Added import; `reportError` on HRV, stress, and temperature refresh catch blocks (`healthData.fetchHeartRate`, `healthData.fetchSteps`, `healthData.fetchSleep`)
- `src/hooks/useFocusData.ts` — Added import; `reportError` on `loadBaselines` silent catch, background refresh silent catch, outer fetch catch, and Strava `backgroundSync` silent `.catch(() => null)` (`focusData.loadBaselines`, `focusData.backgroundRefresh`, `focusData.fetch`, `focusData.isConnected`)
- `src/hooks/useMetricHistory.ts` — Added import; `reportError` on all six ring SDK fallback catches (sleep, hr, hrv, spo2, temperature, activity) and the hook's outer `load()` catch (`metricHistory.ringFallback` with `metric` tag, `metricHistory.loadAll`)
- `src/hooks/useSmartRing.ts` — Added import; `reportError` on per-metric fetch inner catches (battery, steps, hr, spo2), outer `fetchMetrics` catch, `connect` catch, `checkForPairedDevice` catch, `autoConnect` catch, `measureHeartRate` catch, `measureSpO2` catch

**Key notes:**
- All calls pass `{ op: 'domain.operation' }` context for Sentry filtering; ring fallback catches also include `{ metric: '...' }` tag
- Silent `.catch(() => {})` blocks are converted to named-param catches that still return the same value (e.g. `return null`) — no behavior change
- Warning-level severity for expected/recoverable failures (BLE errors, network fallbacks); default `'error'` for unexpected outer catches

---

## 2026-04-12: Detail Page Charts — Visual Polish (Recovery + Sleep)

**Change:** Enhanced the bar charts and header gradients on the recovery and sleep detail pages.

1. **Second header gradient** — Each detail page now has two layered radial gradients for depth:
   - Recovery: primary `#10B981` (top-center) + secondary `#065F46` deep emerald (bottom-right)
   - Sleep: primary `#7100C2` (top-center) + secondary `#3B0764` deep indigo (bottom-left)

2. **Rounded bars** — Added `rx={4} ry={4}` to all bar `<Rect>` elements for a subtle pill shape.

3. **Active-only color** — Only the selected bar shows its score-based color; all other bars render as `rgba(255,255,255,0.4)` (40% white), making the selected day stand out clearly.

4. **Per-bar score labels** — Each bar now shows its numeric score above it (via `SvgText`). Active bar = white, inactive = 80% white. Zero-value days show no label. `CHART_H` bumped from 100→115 and `PAD_V` from 8→20 to accommodate labels.

5. **Dotted guide lines** — Three horizontal dotted lines at score thresholds 25/50/75 (strokeDasharray `3,4`, `rgba(255,255,255,0.08)`) provide subtle visual reference without clutter.

**Files modified:**
- `app/detail/recovery-detail.tsx` — added `recoveryGrad2` radial gradient
- `app/detail/sleep-detail.tsx` — added `sleepGrad2` radial gradient
- `src/components/detail/ReadinessTrendChart.tsx` — rounded bars, active color logic, score labels, dotted guide lines, CHART_H/PAD_V bump
- `src/components/detail/SleepTrendChart.tsx` — same changes as ReadinessTrendChart

---

## 2026-04-10: Activity Tab — Workout Card Flex Row Layout + Cleanup

**Change:** Redesigned the Recent Workouts horizontal cards in the Activity tab. Removed the old vertical stack layout (icon on top, text below with `marginTop: 60`) in favor of a flex row: icon circle + source badge on the left, name/date/meta text block on the right. Also removed the "Recent Sessions" section entirely, removed card gradients (replaced with border-only), and removed the `#222` background from cards.

**Files modified:**
- `src/screens/home/ActivityTab.tsx` — Removed "Recent Sessions" section + `GlassCard` import; rewrote `HorizontalWorkoutCard` as flex row (icon + text side by side); updated `hCardStyles`: `card` now `flexDirection: row`, `iconWrap` no longer absolutely positioned, added `textBlock` style (`flex: 1, marginLeft: spacing.md`), removed `marginTop: 60` from `name`; added `SourceBadge` component with Strava/Apple Health/Ring logos; added `formatWorkoutDate` helper

**Key notes:**
- Cards are border-only (`rgba(255,255,255,0.12)`) with no background fill — transparent over the tab background
- Source badge sits bottom-right of the icon circle (absolute positioned within `iconWrap`)
- EAS OTA update published: group `71940d71-d09c-4be2-892e-ce7778cdf896`, iOS + Android, channel `production`

---

## 2026-04-11: TestFlight 1.0.23 (build 24)

V8 sleep merge fixes: full-night stitching, correct stride-based window assembly, 3h session gap.

---

## 2026-04-11: V8 Band — Fix full-night sleep stitching (overlapping 4-hour windows)

**Root cause discovered:** `getSleepDetailsAndActivityWithMode` (type 81) streams the full night as multiple overlapping 4-hour window packets — one packet per BLE response. The band sends:
- Packet 1: 05:36 → 07:48 (144 min, most recent fragment)
- Packet 2: 03:36 → 07:36 (240 min)
- Packet 3: 01:36 → 05:36 (240 min)
- Packet 4: 23:36 → 03:36 (240 min, true bedtime)
- …then `dataEnd=1` signals end of stream

The bridge was resolving after the FIRST packet because `items.count=1 < 50` triggered early exit, discarding all subsequent packets with the full night data.

**Fixes:**

1. **`V8Bridge.m` — correct pagination for `DetailSleepAndActivityData_V8`:** Changed `if (dataEnd || items.count < 50)` to `if (dataEnd)`. Removed the `else` branch that sent mode=2 (not needed — SDK streams all records automatically). Now the bridge accumulates all packets and resolves only when `dataEnd=1`.

2. **`V8Service.ts` — `mergeV8SleepWindows()`:** New pure function that merges overlapping windows into a single night record per calendar night. Sort by `startTimestamp` → group by <8h gap → for each window after the first, compute actual timestamp overlap and skip already-covered entries → return stitched `arraySleepQuality` spanning the full night (e.g. 23:36 → 07:48 ≈ 8h12m).

3. **`V8Service.ts` — timeouts increased to 30s:** All `getSleepWithActivity` calls increased from 10000ms to 30000ms. The band now streams 4–5 packets before signalling `dataEnd` — 10s was too short to receive all of them.

**Expected result for gcovos@gmail.com:** Sleep will now show ~8h12m with true bedtime at 23:36, not a 72-min nap starting at 5:36.

**Files modified:**
- `ios/V8Bridge/V8Bridge.m` — `DetailSleepAndActivityData_V8` delegate case
- `src/services/V8Service.ts` — `mergeV8SleepWindows()` + wired into `getSleepDataRaw()` + `getSleepByDay()` + timeouts

**Native rebuild required:** Yes — `pod install` done, Xcode opened. Build to device manually.

---

## 2026-04-11: V8 Band — Fix sleep classification (morning wake phase + better SDK method)

**Problem:** V8 band records only the last fragment before waking (~5:36 AM → 7:48 AM). All SDK methods (`GetDetailSleepDataWithMode` and `getSleepDetailsAndActivityWithMode`) return this morning tail. The existing classifier saw `startHour=5` → daytime → nap. Father (`gcovos@gmail.com`) saw all nights recorded as naps.

**Fixes (3 changes):**
1. **Switch V8 primary sleep to `getSleepDetailsAndActivityWithMode` (type 81)** in `V8Service.ts` — returns 144 min vs the legacy 72 min (confirmed via Supabase debug_logs). Both `getSleepByDay()` and `getSleepDataRaw()` updated.
2. **`NapClassifierService.classifySleepSession()`** — new step 4: if session starts AND ends in early morning (3–9 AM, ends before 9 AM) → `early_morning_wake_phase` → `night`. This catches V8 band tail captures without affecting true daytime naps.
3. **`useHomeData.deriveFromRaw()`** — same early-morning check added to the `isNapLike` heuristic. Sessions ending before 9 AM that start in early morning are now treated as disrupted nights, not naps.

**Files modified:**
- `src/services/V8Service.ts`
- `src/services/NapClassifierService.ts`
- `src/hooks/useHomeData.ts`

---

## 2026-04-09: V8 Band — Add getSleepWithActivity + GetPPIData debug fetches

**Change:** The V8 band records only ~72 min per night for `gcovos@gmail.com`. Confirmed via Supabase `debug_logs` and Metro console that `GetDetailSleepDataWithMode` genuinely returns only the last fragment. Added two new V8-only data fetches to diagnose whether alternative SDK methods carry the full night.

**What was added (V8 only — no X3/Jstyle code touched):**
- `getSleepDetailsAndActivityWithMode` (type 81) — combined sleep+activity dataset. May be populated differently from the legacy method.
- `GetPPIDataWithMode` (type 82) — raw beat-to-beat PPI data, chunked. PPI is recorded continuously so it likely covers the whole night.

Both methods are fire-and-forget debug-only: they log to the `debug_logs` Supabase table with events `sleep_with_activity` and `ppi_data`. No changes to sleep classification logic.

**Files modified:**
- `ios/V8Bridge/V8Bridge.m` — Added `accumulatedSleepActivityData` + `accumulatedPPIData` properties and init; two new `RCT_EXPORT_METHOD`s (`getSleepWithActivity`, `getPPIData`) with watchdog timeout and pagination; two new delegate cases (`DetailSleepAndActivityData_V8`, `ppiData_V8`).
- `src/services/V8Service.ts` — Added `getSleepWithActivityRaw()` and `getPPIDataRaw()` methods.
- `src/services/DataSyncService.ts` — After existing `sleep_raw_records` debug log, gate on `service.getV8Service()` and call both new methods, logging results to `debug_logs`.

**Verification:**
```sql
SELECT event, payload, created_at
FROM debug_logs
WHERE user_id = '4128d5f7-51e1-43ac-993f-e475934cd3ca'
  AND event IN ('sleep_with_activity', 'sleep_with_activity_error', 'ppi_data', 'ppi_data_error')
ORDER BY created_at DESC LIMIT 20;
```

---

## 2026-04-10: Sleep Baseline Tier — fix always-empty state, backfill existing rows

**Change:** The Sleep Baseline Tier card showed `low / 0 / 0 days` for all users forever. Root cause: `DataSyncService` hardcoded `sleep_score: null` on every sleep session insert, so the 14-day rolling `sleepScore[]` baseline array was perpetually empty. Verified for mateoaldao@gmail.com: 47 `sleep_sessions` rows, 0 with non-null `sleep_score`. Fix: compute and persist a real 0-100 score at insert time (night sessions only), backfill all existing rows via Supabase SQL, and bump three cache keys so all clients re-bootstrap on next open.

**Files created:**
- `scripts/backfill-sleep-scores.ts` — One-shot TS backfill script. Reads `.env.local` via dotenv, paginates `sleep_sessions WHERE sleep_score IS NULL AND session_type='night' AND total_min>=60` in batches of 500, applies `calculateSleepScoreFromStages`, updates each row. Idempotent.

**Files modified:**
- `src/utils/ringData/sleep.ts` — Extracted internal `computeSleepBreakdown(deep, light, rem, awake)` function (single CASE logic pass). Exported new `calculateSleepScoreFromStages({deep, light, rem, awake}): number` — pure, takes raw minutes. Refactored `calculateSleepScore(SleepInfo)` to delegate to both — no CASE duplication.
- `src/services/DataSyncService.ts` — Imported `calculateSleepScoreFromStages`; compute `sleepScore` at insert time for `session_type='night'` sessions (null for naps, which keep `nap_score`). Replaced `sleep_score: null` with real value.
- `src/services/ReadinessService.ts` — Bumped `BASELINES_KEY` `v1→v2` (forces re-bootstrap on all clients). Added `.eq('session_type', 'night')` to `bootstrapBaselinesFromSupabase` sleep query to exclude naps from the rolling array. Removed stale "sleep_score is not persisted" comment.
- `src/hooks/useFocusData.ts` — Bumped `focus_state_cache_v5→v6`. Added `.eq('session_type', 'night')` to the daily sleep query so a daytime nap can't override last night's session.
- `src/hooks/useSleepBaseline.ts` — Bumped `CACHE_KEY` `v1→v2` (invalidates 6h tier cache).

**Key notes:**
- Backfill ran directly via Supabase MCP SQL (no script execution needed): updated 48 night rows across all users. 2 rows remain null — both have `total_min < 60` (30 and 50 min, likely sensor artifacts), correctly excluded.
- mateoaldao@gmail.com result: 42 night sessions now have scores 38–97. Profile `sleep_baseline_tier` will auto-populate on next app open via `useSleepBaseline` after cache key forces re-bootstrap.
- Cache key bumps (`v2`) are one-shot: every user re-bootstraps once on next open, fetching 14-day night history from Supabase. Cost: ~1 small query per user.
- `calculateSleepScore` return type (`SleepScore`) is unchanged — callers unaffected. No callers use the `breakdown` field but it remains in the type for forward compatibility.
- Deployment: EAS Update only (no native changes).

---

## 2026-04-10: Strain — EWMA multi-day accumulation (7-day window)

**Change:** Strain is no longer today-only. It now uses an Exponentially Weighted Moving Average (α = 0.35) over the last 7 days: today ~35%, yesterday ~23%, 2 days ago ~15%, and so on, decaying over ~5 days. A hard workout echoes forward; a rest day no longer resets strain to zero instantly.

**Model:**
- Per-day load = same formula as before (calories + Strava suffer_score blend, 0–100 scale)
- Today's load: from `activity.adjustedActiveCalories`, `activity.steps`, today's Strava entries (already in scope)
- Prior 6 days: small Supabase query on `daily_summaries` (date, total_calories, total_steps) + Strava suffer_score grouped by date
- `ewmaStrain([todayLoad, ...priorLoads], 0.35)` produces the final 0–100 value
- Falls back to today-only when no history exists (new users, query errors) — no regression

**Files modified:**
- `src/hooks/useHomeData.ts` — added `computeDailyLoad` + `ewmaStrain` pure helpers; replaced 10-line today-only strain block with EWMA block + prior-days Supabase query
- `src/data/metricExplanations.ts` — corrected chart zones to 0–24/25–49/50–74/75–100 (was 0–9/10–13/14–17/18–21 which matched Whoop's scale, not the app's 0–100 output)
- `src/i18n/locales/en.json` — subtitle updated to "Cumulative cardiovascular load over the last 7 days"; range labels updated to match 0–100 scale
- `src/i18n/locales/es.json` — same updates in Spanish

---

## 2026-04-10: Activity tab — workout cards use radial gradient, no border

**Change:** Replaced the diagonal `LinearGradient` (expo) and white border on horizontal workout cards with an SVG `RadialGradient` bleeding from the top-center off-canvas (`cx=51%, cy=-86%`, same parameters as the temperature/SpO2 GradientInfoCard). Background changed from `#1A1A2E` to `#000`. Each card gets a unique gradient ID (`wg-${activity.id}`) to prevent SVG ID conflicts in the scroll list.

**Files modified:**
- `src/screens/home/ActivityTab.tsx` — swapped `expo-linear-gradient` import for SVG `Defs/RadialGradient/Rect/Stop`; removed `borderWidth`/`borderColor` from `hCardStyles.card`; updated background to `#000`

---

## 2026-04-10: Activity tab — remove Recent Sessions section

**Change:** Removed the "Recent Sessions" section (X3 ring-native activity sessions) from the bottom of the Activity tab. The section was conditionally rendered behind `homeData.featureAvailability.activitySessions`. Also removed the now-unused `GlassCard` import.

**Files modified:**
- `src/screens/home/ActivityTab.tsx` — deleted sessions section JSX and `GlassCard` import

---

## 2026-04-10: Hypnogram — gradient palette shifted up one stop

**Change:** Shifted the figure-wide gradient one level lighter so Awake is pure white, and the bottom (deep) no longer uses the darkest burgundy. Also restored rounded corners on summary chips and updated their border colors to match the new palette.

**Gradient (updated):**
- Awake (0%): `#FFFFFF`
- REM (33%): `#F5DEDE`
- Core (66%): `#CC3535`
- Deep (100%): `#8C0B0B`

**Files modified:**
- `src/components/home/SleepHypnogram.tsx` — updated `<LinearGradient>` stops; added `stageChipColors` map matching the new palette; restored `borderRadius: 12` on summary chips; chips now use `stageChipColors` for border color

---

## 2026-04-10: Sleep subtab — dashed avg line + amber pill label

**Change:** Replaced the broken `borderStyle: 'dashed'` avg line with repeating `View` dashes (RN-compatible). The avg duration is now an amber pill (`#f2a500` background, dark text, `borderRadius: 10`) at the right edge of the line. Chart has `marginTop` for breathing room.

**Files modified:** `src/components/home/DailySleepTrendCard.tsx`

---

## 2026-04-10: Hypnogram — single gradient + seamless connectors

**Change:** Replaced per-stage block colors with a single vertical `LinearGradient` (`gradientUnits="userSpaceOnUse"`) spanning the full chart height — near-white at awake lane top → dark burgundy at deep lane bottom. All blocks and connector bars share `fill="url(#sleepGradient)"` so the color ramp is continuous. Connectors are 0.75px `<Rect>` elements spanning from the top edge of the higher lane to the bottom edge of the lower lane. Blocks have `rx=2`.

**Files modified:**
- `src/components/home/SleepHypnogram.tsx` — removed `stageBlockColors`; added `<Defs><LinearGradient>` with 4 stops (`#F5DEDE` → `#CC3535` → `#8C0B0B` → `#4A0606`); connectors switched from `Path` to `Rect` with gradient fill; connector span covers full zone-to-zone extent; width 0.75px

---

## 2026-04-10: Sleep subtab — fix average display + add per-day sleep amounts

**Changes:**
1. **"Avg. Sleep" now correctly gates behind ≥2 days of data.** When only today's night is available the card title switches to "Last Night" and the subtitle reads "Last recorded night", avoiding the misleading "average = today" label. Once a second day of data fills in, it reverts automatically to "Avg. Sleep" with the true mean.
2. **Orange average line** is now only rendered when there are ≥2 days of data, positioned via `bottom` percentage inside `barsRow` (fixes the previous padding-mismatch that pinned it to the chart top).
3. **Per-day sleep duration** (e.g. `7h32`) now appears under each day letter in the bar chart. Days with no data show `—` to keep the layout balanced.

**Files modified:**
- `src/components/home/DailySleepTrendCard.tsx` — `hasEnoughForAverage` flag, dynamic title/subtitle/headerValue, avgLine moved inside barsRow with `bottom` positioning, `dayValue` text + style added
- `src/i18n/locales/en.json` — added `sleep_trend.card_title_last`, `sleep_trend.subtitle_last_night`
- `src/i18n/locales/es.json` — added same keys in Spanish

---

## 2026-04-10: Hypnogram — continuous maroon step line

**Change:** Replaced the per-segment colored `<Rect>` blocks and vertical `<Line>` transition connectors in the sleep hypnogram with a single continuous maroon step polyline. The figure now walks across the four lane center-lines as a connected step curve instead of separate colored bars per stage.

**Files modified:**
- `src/components/home/SleepHypnogram.tsx` — swapped `Rect` import for `Path`; deleted `connectors` computation and render block; added `stepPaths` memo that builds one SVG step-path string per session (two points per segment at lane center y); renders as `<Path stroke="#AC0D0D" strokeWidth={2.25} strokeLinejoin="miter" strokeLinecap="square" fill="none" />`; removed dead `BLOCK_RADIUS` constant

**Key notes:**
- All other chart elements unchanged: lane layout, y-axis labels + durations, top summary chips, grid lines, x-axis time labels, `PanResponder` tooltip, and multi-session gap separators
- One path per session — the step line never crosses the dashed night/nap gap separator
- Maroon `#AC0D0D` matches the Coach screen's existing hero gradient color (no new token added)
- `stageColors` kept for chip border colors and tooltip; `stageLabels` and `stageTooltipLabel` untouched

---

## 2026-04-09: V8 band sleep debug — remote logging to Supabase

Diagnosed why gcovos@gmail.com's V8 band classifies all sleep as naps. Found only 3 sessions in DB (all naps, 26-97 min), too short to exceed the 180-min night threshold. Root cause unclear — suspect `sleepUnitLength` defaulting to 1 when the band may use 5-min intervals.

Added fire-and-forget remote debug logging to capture raw SDK values before any `|| 1` fallback processing:
- New `debug_logs` Supabase table (with RLS)
- `supabaseService.debugLog()` helper in SupabaseService
- Logs `sleepUnitLength`, `totalSleepTime`, `arraySleepQuality.length`, and timestamps per record in `DataSyncService.syncSleepData()`

**Files modified:** `src/services/SupabaseService.ts`, `src/services/DataSyncService.ts`
**Files created:** `supabase/migrations/20260409_debug_logs.sql`
**Build:** 1.0.21 (build 22) — uploaded to TestFlight

**Next step:** Once father syncs the band, query `debug_logs` for user `4128d5f7-51e1-43ac-993f-e475934cd3ca` to see actual SDK values.

---

## 2026-04-06: HRV detail page — redesigned to match sleep detail structure

Applied the same layout structure from sleep-detail to hrv-detail:

- **Violet radial gradient** (`#8B5CF6`) behind header + chart, bleeding from the top of the screen (same pattern as sleep's purple `#7100C2` gradient).
- **HRVTrendChart**: new scrollable 30-day bar chart component (mirroring `SleepTrendChart`). Bars colored by SDNN thresholds (green >=50, yellow >=30, red <30), 5-day rolling average trendline, haptic feedback on scroll, snap-to-column day selection. Replaces the old `DayNavigator` pill buttons + inline `HRV7DayChart`.
- **30-day history**: extended from 7 to 30 days with progressive loading (7 days instant, then 30 silently in background — same two-phase pattern as sleep).
- **Gradient zone wrapping**: header + chart wrapped in gradient zone; safe area applied only to header so gradient bleeds to screen top.
- Removed: `DayNavigator` import, `HRV7DayChart` inline component, `Dimensions` import, old chart/band constants.

**Files created:** `src/components/detail/HRVTrendChart.tsx`
**Files modified:** `app/detail/hrv-detail.tsx`, `src/hooks/useMetricHistory.ts`

## 2026-04-05: Activity tab — horizontal gradient training cards

Replaced the vertical GlassCard workouts list with a horizontal snap FlatList of gradient cards.

- **Layout**: Each card is 60vw wide, snaps to origin (`snapToInterval`, `decelerationRate="fast"`), next card peeks to hint scrollability.
- **Gradient**: `LinearGradient` fills the card diagonally using the sport's color (`color+'50'` → `color+'18'` → transparent). Each sport type gets a visually distinct color wash.
- **Source badge**: 22px circle overlapping the main sport icon at bottom-right (offset: bottom -2, right -8). Contains the source logo — Strava chevron SVG (orange bg), heart SVG for Apple Health (pink bg), RingIcon for ring (dark surface bg). 2px border matching card bg creates a cutout separation effect.
- **Content**: sport Ionicons icon, activity name (demiBold), date (Today / Yesterday / short date), meta line (distance · duration · kcal).
- **Navigation**: Strava cards navigate to `/(tabs)/settings/strava-detail` with the numeric activity ID. Ring/Apple Health cards are no-op (no detail screen).
- **Dead code removed**: `UnifiedWorkoutCard`, `WorkoutCard`, `WorkoutIcon`, `SOURCE_COLORS`, `SOURCE_LABEL_KEYS`, old workout styles.

**Files modified:** `src/screens/home/ActivityTab.tsx`

## 2026-04-05: OTA update — sleep sync fix + OTA version in profile

Pushed EAS OTA update to production channel.

- **Update group:** `5b84fd9d-1d8e-47aa-8cfd-6f5a50aa781f`
- **iOS update ID:** `019d6080-8ca7-7ce8-b4c5-bb2a1af7c1f6`
- **Platforms:** iOS + Android
- **Channel:** production / runtime 1.0.0

Includes: sleep sync raw pipeline fix + OTA version row in profile.

**Profile OTA row:** Added `expo-updates` import to `SettingsScreen.tsx`. New row between App Version and SDK Version shows the first 8 chars of `Updates.updateId` (or "Built-in" when running the embedded bundle). Added `profile.about.ota_version` and `profile.about.ota_embedded` to `en.json` / `es.json`.

**Files modified:** `src/screens/SettingsScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

## 2026-04-05: Fix sleep sync — use raw + block-merge pipeline (same as hypnogram)

Root cause of coach showing wrong sleep values: `DataSyncService.syncSleepData()` was calling `getSleepByDay(dayIndex)` which filters raw records by `start_time` date and sums minutes independently — it doesn't merge fragmented ring records. The home screen hypnogram was using `getSleepDataRaw()` + `deriveFromRaw()` which merges all records with ≤60 min gaps into continuous blocks.

**Fix:** Rewrote `syncSleepData()` to:
1. Call `getSleepDataRaw()` once to get all raw records
2. Parse and sort records by `start` timestamp
3. Merge consecutive records with ≤60 min gap into blocks (same algorithm as `deriveFromRaw()`)
4. For each of the 7 target dates, find the block whose `end` time falls on that date (wake-up day)
5. Pick the longest block for that date (same as choosing the main sleep session)
6. Compute stage minutes (deep/light/rem/awake) by building a per-minute timeline from `arraySleepQuality`
7. Insert with the same duration gate + overlap guard as before

Result: Supabase now stores the exact same complete merged session that the hypnogram renders. Coach will see `~7h` instead of `4h55m` for nights where the ring reported multiple fragments.

**Files modified:** `src/services/DataSyncService.ts`

## 2026-04-05: DB cleanup — remove bad sleep sessions + recompute sleep debt

Ran two-pass cleanup on Supabase `sleep_sessions` for all users:
1. Deleted sessions with same `(user_id, end_time)` keeping the one with most sleep minutes — removed 39 duplicates
2. Deleted all night sessions where `end_time - start_time > 15 hours` (ring cumulative re-sync artifacts) — removed 28 bad records across two passes

Then recomputed `daily_summaries.sleep_total_min` for all users from the cleaned sessions using `end_time::date` grouping. Dates with no clean session now correctly show NULL instead of inflated values from bad 20-25h records. Sleep debt card will reflect accurate data after 2-hour AsyncStorage cache expiry or pull-to-refresh.

## 2026-04-05: Fix sleep sync — duration gate + night overlap guard

Two guards added to `syncSleepData()` in `DataSyncService.ts` to prevent duplicate sleep sessions from accumulating:

1. **Duration gate**: sessions where `end_time - start_time > 14 hours` are skipped before insert. The ring reports 20-25h cumulative sessions with bad timestamps — these are now rejected at sync time.
2. **Overlap guard**: before inserting any session, check if an already-stored session of the same type overlaps by >30 min. Prevents duplicates when the ring re-reports the same night with a slightly different `start_time` (which bypasses the upsert's `user_id+start_time` conflict key).
3. **In-memory tracking**: newly inserted sessions are pushed into `nightSessions[]` during the loop so subsequent iterations can overlap-check against them.

Also ran a one-time DB cleanup: deleted 39 duplicate records (same end_time) + 22 implausible-duration records (20-25h), removing 61 bad rows total.

**Files modified:** `src/services/DataSyncService.ts`

## 2026-04-05: TestFlight Build 1.0.20 (build 21)

Bumped version → 1.0.20, buildNumber → 21. Key fix in this build: `Expo.plist` channel changed from `'development'` to `'production'` so OTA updates via `eas update --channel production` now actually reach the app. Archive succeeded, uploaded to App Store Connect — build is processing in TestFlight.

**Files modified:** `app.config.js`, `ios/SmartRing.xcodeproj/project.pbxproj`, `ios/SmartRing/Supporting/Expo.plist`

## 2026-04-05: Fix sleep date grouping — key by wake-up time not start time

Sleep sessions were being keyed by `start_time` date, so a night that starts at 11 PM Apr 3 and ends at 7 AM Apr 4 appeared under Apr 3. Changed `fetchSleepHistory` to key by `end_time` (wake-up date) instead. Extended the query window by +1 day (`nDaysAgo(days + 1)`) so sessions that started the night before still get fetched.

**Files modified:** `src/hooks/useMetricHistory.ts`

## 2026-04-05: Fix "Ask Coach" typewriter — i18n translations

The rotating placeholder questions in the coach input ("How did I sleep?", "Should I train today?", etc.) were hardcoded in English. Rewrote `useTypewriter.ts` to pull all strings from i18n via `t()`. Uses refs (`askCoachRef`, `questionsRef`) so timer callbacks always read the current language. Added 4 new translation keys (`overview.coach_q_sleep/train/hrv/run`) to both `en.json` and `es.json`.

**Files modified:** `src/hooks/useTypewriter.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

## 2026-04-05: Sleep stages — horizontal bars with recommended range overlay

Replaced the four stage `DetailStatRow` entries (Deep/REM/Light/Awake) with `SleepStageBar` — a custom component showing: colored dot + label + minutes + percentage in a header row, and below it a horizontal bar with the actual % fill and a recommended range overlay (min–max markers from `customSleepAnalysis.ts` THRESHOLDS: Deep 13–23%, REM 20–25%, Light 50–65%, Awake 0–5%). The range is a subtle `rgba(255,255,255,0.1)` zone with thin edge markers. Other stats (efficiency, bed/wake time, HR) moved to a separate card below.

**Files modified:** `app/detail/sleep-detail.tsx`

## 2026-04-04: SleepTrendChart — snap-to-column + fix today centering

`snapToOffsets` per column (`i * COL_W + COL_W/2 - SCREEN_WIDTH/2`, clamped). `decelerationRate="fast"` + `disableIntervalMomentum`. `GHOST_COLS` fixed to `Math.ceil(SCREEN_WIDTH/COL_W/2)+1` — was 3 (too few), now ~8, so today can actually reach its centered scroll position.

**Files modified:** `src/components/detail/SleepTrendChart.tsx`

## 2026-04-04: TestFlight Build 1.0.19 (build 20)

Bumped `version` → `1.0.19`, `buildNumber` → `20` in `app.config.js` and `project.pbxproj`. Archived and uploaded to App Store Connect. Upload succeeded (dSYM symbol warnings for React/Hermes are non-blocking). Build is processing in TestFlight.

**Files modified:** `app.config.js`, `ios/SmartRing.xcodeproj/project.pbxproj`

---

## 2026-04-04: HR Zones — Fix Incorrect BPM Ranges and Zone Assignment

**Problem:** HR zone BPM ranges were off for two reasons:
1. `hrToZoneIndex` mapped both "Rest" (<50%) and "Light" (50-60%) → Z1, but the display said Z1 started at 50% — so Z1 showed "95-113 bpm" but actually caught everything below 114 bpm
2. BPM range labels were always from the age formula even when Strava's `zones_json` already stores actual athlete-specific `{ min, max }` per zone from the `/activities/{id}/zones` API

**Fix:**
- Replaced `getHeartRateZone()` string mapping with direct percentage thresholds: Z1 <60%, Z2 60-70%, Z3 70-80%, Z4 80-90%, Z5 ≥90% — now internally consistent
- Added `extractStravaBpmRanges()`: reads actual zone `min`/`max` from `zones_json` of week activities — athlete-specific Strava boundaries, used when available
- Falls back to age-based calculation (220 - 30 = 190 maxHR) when no Strava data
- Fixed Z5 label from `>170 bpm` to `>171 bpm` (was subtracting 1 incorrectly)

**Files modified:** `src/utils/activity/trainingInsights.ts`, `src/components/home/TrainingInsightsCard.tsx`

---

## 2026-04-04: SleepTrendChart — two-line date labels (day + month)

Label cells now show day number (13px, bold when selected) on top and month abbreviation (9px, dimmer) below, stacked vertically. Replaced single `shortDate()` string with `parseDateParts()` returning `{ day, month }` separately.

**Files modified:** `src/components/detail/SleepTrendChart.tsx`

## 2026-04-04: SleepTrendChart — scroll-driven day selection + haptics

Scrolling the timeline now drives day selection. `onScroll` calculates the centered column (`Math.round((offsetX + halfScreen - halfCol) / COL_W)`), clamps to valid range, maps back to `origIndex`, calls `onSelectDay`. A `lastHapticColRef` tracks the previous column — one `Haptics.impactAsync(Light)` fires per column crossed. `scrollEventThrottle` set to 32ms. No tap-to-select removed (still works for direct taps).

**Files modified:** `src/components/detail/SleepTrendChart.tsx`

## 2026-04-04: Sleep history — progressive two-phase loading

`useMetricHistory` now accepts `{ initialDays?, fullDays? }`. For sleep with `fullDays > initialDays`: phase 1 fetches `initialDays` (7) → renders immediately, `isLoading` clears. Phase 2 fetches `fullDays` (30) silently in background → older bars fill in as user scrolls left. A `cacheIsCompleteRef` flag prevents redundant extended fetches on repeat visits. All other metric types unchanged.

**Files modified:** `src/hooks/useMetricHistory.ts`, `app/detail/sleep-detail.tsx`

## 2026-04-04: HR Zones — Oura-Style Redesign (Donut + Horizontal Bars)

**What changed (user-visible):** The Training Insights card's HR zone section now displays like Oura — a bold headline showing the dominant zone percentage (e.g. "81% in Z2 Endurance"), a small inline donut chart showing all zones proportionally, and 5 horizontal bar rows (Z5→Z1) each with its percentage and BPM range. All 5 zones are always shown even when they have 0%.

**Files modified:**
- `src/utils/activity/trainingInsights.ts` — Exported `ZONE_COLORS`, extended `ZoneEntry` with `bpmMin`/`bpmMax`/`percentage`, added `dominantZoneIndex` to `zoneSummary`, added `getZoneBpmRanges()` helper, removed filter so all 5 zones always returned
- `src/components/home/TrainingInsightsCard.tsx` — Full redesign of HR zones section: inline SVG donut chart (`DonutChart` component), header text with dominant zone, Z5→Z1 horizontal bar rows with percentages and BPM ranges; dominant zone highlighted at full opacity
- `src/i18n/locales/en.json` — Added `training_insights.dominant_zone`, `training_insights.past_7_days`
- `src/i18n/locales/es.json` — Spanish translations for same keys

---

## 2026-04-04: Fix Activity Detail — Historical Days Show Real Data

**Problem:** Activity detail page showed 0 steps/calories/distance for all past days (today was fixed in a previous session).

**Root cause (3 layers):**
1. `JstyleService.getSteps()` only extracted today's entry from the SDK, discarding 6 days of history the SDK returns
2. `DataSyncService.syncStepsData()` only wrote today's hourly steps to Supabase; `updateDailySummary()` was only called for today
3. `useMetricHistory` fell back to the ring only when Supabase had 0 rows — but past days HAD rows (from sleep/HR syncs) with `total_steps=0`, so the fallback never triggered

**Fix:**
- `JstyleService.ts`: Added `getAllDailyStepsHistory()` — parses all entries from the SDK's `arrayTotalActivityData`, returns `{dateKey, steps, distanceM, calories}[]` for all days
- `UnifiedSmartRingService.ts`: Exposed `getAllDailyStepsHistory()`
- `DataSyncService.ts`: `syncStepsData()` now writes one daily-total reading per historical day to `steps_readings`; `syncAllData()` now calls `updateDailySummary()` for all 7 days instead of just today
- `useMetricHistory.ts`: `fetchActivityFromRing()` now iterates all historical entries; fallback now triggers when all Supabase rows have `steps=0` (not only when there are no rows)

**Files modified:**
- `src/services/JstyleService.ts`
- `src/services/UnifiedSmartRingService.ts`
- `src/services/DataSyncService.ts`
- `src/hooks/useMetricHistory.ts`

---

## 2026-04-04: Sleep Detail Chart — taller header, thicker bars, tighter spacing

`COL_W` 44→32, `BAR_W` 14→22, `CHART_H` 68→100. Gap between bars reduced from 30px to 10px. Gradient zone `paddingBottom` bumped sm→md.

**Files modified:** `src/components/detail/SleepTrendChart.tsx`, `app/detail/sleep-detail.tsx`

## 2026-04-04: Fix Activity Detail Page Showing Zero Data

**Problem:** Activity detail page showed 0 steps/calories/distance even though the home screen displayed real values.

**Root cause:** The page queries `daily_summaries` for activity data, but that table often has rows with `total_steps=0` (sync wrote sleep/HR data before ring step sync ran). The existing context fallback only triggered when no row existed — not when a row had all zeros.

**Fix:** Changed fallback logic in `app/detail/activity-detail.tsx` to always prefer live ring/HealthKit data from context for today's view, regardless of whether `daily_summaries` has a (possibly zero-value) row. Also injected live today data into the bar chart map so the today bar also reflects current values. Fixed missing `hrMin: null` field in `buildTodayActivityFromContext`.

**Files modified:**
- `app/detail/activity-detail.tsx`

---

## 2026-04-04: Illness Watch Detail Screen + Rename

**Change:** Renamed "Body Stress" card back to "Illness Watch". Added a full detail screen reachable by tapping "View full analysis →" inside the expanded card. Shows: hero (large score + status badge + date), 5 signal cards each with an **SVG line chart** (14-day history with data points + dashed baseline reference line + gradient area fill, color-coded per signal) plus your value vs baseline numbers + severity pill + medical context from Stanford/Mount Sinai research, overall score trend bar chart, and status-dependent recommendations.

**Files created:**
- `app/(tabs)/settings/illness-detail.tsx` — thin route re-export
- `src/screens/IllnessDetailScreen.tsx` — full detail screen

**Files modified:**
- `src/components/focus/IllnessWatchCard.tsx` — exports shared utilities, adds "View full analysis →" link
- `app/(tabs)/settings/_layout.tsx` — registered `illness-detail` Stack.Screen
- `src/i18n/locales/en.json` + `es.json` — renamed card_title, ~25 new detail keys

---

## 2026-04-04: Move Coach Text Input to Top — Remove Bottom ChatBar

**Change:** Removed the `ChatBar` dark input bar from the bottom of Overview, Sleep, and Activity tabs and upgraded the `MetricInsightCard`'s "Ask Coach" pill (below the 3 metrics) to a full text input. Users can now type directly into the white pill and send a message to the coach from the top of each screen.

**Files deleted:**
- `src/components/focus/ChatFAB.tsx` — `ChatBar` and deprecated `ChatFAB` were dead code with no remaining consumers; deleted

**Files modified:**
- `src/components/home/MetricInsightCard.tsx` — Added `TextInput` with typewriter placeholder, `text` state, `handleSend` (navigates to `/chat` with query param), `handleOpenChat` (direct nav, `useCallback`). When not scrolled: shows text input + send button. When scrolled/collapsed: shows "Ask Coach" label via `display: 'none'` toggle (avoids TextInput mount/unmount thrash). FocusIcon no longer has a separate tap handler.
- `src/screens/home/OverviewTab.tsx` — Removed `ChatBar` import, JSX block, and `chatBarSection` style
- `src/screens/home/SleepTab.tsx` — Same removals
- `src/screens/home/ActivityTab.tsx` — Same removals

**Key notes:**
- `display: 'none'` used instead of conditional rendering to keep TextInput mounted across scroll transitions — avoids native text field teardown/recreate
- `handleOpenChat` uses `useCallback` (no deps); `handleSend` is a plain function (depends on `text` state, `useCallback` would re-create on every keystroke anyway)

---

## 2026-04-04: Sleep Detail Chart — 30 days, avg trendline, X axis, thicker bars

**Change:**
- **30 days history**: `fetchSleepHistory` now queries `nDaysAgo(30)`. `buildDayNavigatorLabels(30)` in sleep-detail.tsx. Scroll left to see up to a month of data.
- **X axis line**: `<Line>` at the baseline of the chart (`rgba(255,255,255,0.12)`).
- **Rolling average trendline**: The connecting line now plots a 5-day centered rolling average score per column (window ±2 days, zero-score days excluded). Shows trend direction, not per-night volatility.
- **Thicker bars**: `BAR_W` increased 8→14px.
- **No rounded corners**: `rx` removed from all bars (sharp edges).

**Files modified:** `src/hooks/useMetricHistory.ts`, `app/detail/sleep-detail.tsx`, `src/components/detail/SleepTrendChart.tsx`

## 2026-04-04: Sleep Detail Page — Polish (gradient edge, thin bars, today centered)

**Change:** Three UI fixes to the sleep detail redesign:
- **Gradient from screen edge**: Moved `paddingTop: insets.top` off the container and onto the header view only, so the purple gradient now starts from the very top of the screen.
- **Thinner bars**: Fixed bar width to 8px centered in each 44px column.
- **Today centered via scrollable timeline**: Converted to a horizontal `ScrollView` with fixed 44px columns. 3 ghost columns appended to the right of today. On mount, scroll position is set so today is centered in the viewport. Scrolling left reveals older days.

**Files modified:** `src/components/detail/SleepTrendChart.tsx`, `app/detail/sleep-detail.tsx`

## 2026-04-04: Sleep Detail Page — Timeline + Bar Chart + Gradient Header

**Change:** Redesigned the sleep detail page with three visual improvements:

1. **Purple gradient header**: A `RadialGradient` SVG (matching GradientInfoCard's technique) is placed absolutely behind the header + chart zone, creating a purple glow (`#7100C2`) that fades downward — consistent with the sleep theme used in the insight block.

2. **Day timeline replaces pill chips**: The `DayNavigator` pill chips are gone. Instead, a date text row shows short dates (e.g. "Apr 2") with today on the **right** and older days extending to the left — natural past-to-present reading direction. Selected day is white/bold; others are dimmed. Tapping any label selects that day.

3. **Sleep score bar chart + trendline**: A 7-bar SVG chart sits below the date labels, one bar per day, color-coded green/gold/red by score. The selected day's bar is full opacity; others are at 33%. A monotone cubic bezier trendline connects the tops of all non-zero bars with a subtle white stroke. Tapping any column also selects that day.

**Files created:** `src/components/detail/SleepTrendChart.tsx`
**Files modified:** `app/detail/sleep-detail.tsx`

## 2026-04-04: Server-Side Illness Score — Client Integration

**Change:** Completed the client-side integration for the server-computed illness score feature. The `useFocusData` hook now reads from the `illness_scores` Supabase table (populated daily by `compute_illness_scores()` pg_cron job) instead of calling `computeIllnessWatch()` client-side. A mapper converts the DB row to `IllnessWatch`. The old client-side function is kept as fallback before the first cron run. The `IllnessWatchCard` now shows a continuous 0–100 score in the header, severity pills (Normal/Mild/Moderate/Severe) per signal instead of ✓/✕, a stale indicator when data is >48h old, SpO2 row replacing the old breathing rate row, and signal labels updated to match the server model (Nocturnal HR, Blood Oxygen, etc.).

**Files modified:**
- `src/types/supabase.types.ts` — Added `illness_scores` and `user_baselines` table types; convenience exports `IllnessScore`, `UserBaseline`
- `src/types/focus.types.ts` — Added `score`, `stale`, `computedAt` to `IllnessWatch`; replaced `respiratoryRateElevated` with `spo2Low` in `IllnessSignals`; added `spo2Delta`, `sleepDelta` to `IllnessWatchDetails`; added `spo2Min[]`, `sleepAwakeMin[]`, `nocturnalHR[]` to `FocusBaselines`
- `src/services/DataSyncService.ts` — Added `spo2_min`, `sleep_awake_min`, `hr_nocturnal_avg` computation and upsert in `updateDailySummary()`
- `src/services/ReadinessService.ts` — Replaced `respiratoryRateElevated` with `spo2Low: false` in client fallback; removed `respiratoryRate` param from `IllnessParams`; added `score: 0` to fallback return; added `spo2Min`, `sleepAwakeMin`, `nocturnalHR` to `emptyBaselines()` and `updateBaselines()`; updated summary strings
- `src/hooks/useFocusData.ts` — Queries `illness_scores` table, maps server row via `mapServerScoreToIllnessWatch()`, falls back to client-side computation; imports `IllnessScore` type
- `src/components/focus/IllnessWatchCard.tsx` — Full rewrite: score number in header, severity pills with 4 tiers, stale warning banner, SpO2 row replacing breathing rate, `getSeverityFromDelta()` helper for client fallback tier estimation
- `src/i18n/locales/en.json` — Updated `illness_watch` namespace: card title → "Body Stress", new signal/severity/stale keys
- `src/i18n/locales/es.json` — Same keys in Latin American Spanish

**Key notes:**
- Card title changed from "Illness Watch" → "Body Stress"
- Server score takes priority; client fallback only fires before pg_cron has run once
- Severity pills: green=Normal, amber=Mild, orange=Moderate, red=Severe
- `spo2Low` severity is always 'moderate' from client fallback (no absolute threshold available without raw SpO2 readings)

---

## 2026-04-04: Fix Coach Page Showing Stale Last Run

**Change:** The coach/focus tab was serving a 6-hour cached readiness state even after a newer run was in Supabase. The Realtime subscription only fires on new DB inserts — if the run was already synced before the user opened the tab, no event fired and the stale cache was never busted. Fixed by firing a background Strava sync + silent reload on every tab focus. A `hasDataRef` prevents the reload from showing a spinner when data is already rendered.

**Files modified:**
- `src/hooks/useFocusData.ts` — Imported `stravaService`; added `hasDataRef` to gate `setIsLoading(true)` so background reloads don't flash a spinner; set `hasDataRef.current = true` in both cache-hit and fresh-fetch paths; `useFocusEffect` now fires `stravaService.backgroundSync(3).then(() => load(true))` after the initial `load()` call

---

## 2026-04-04: Strava Sync Reliability + Coach Activity Context

**Change:** Fixed two related issues: (1) Strava activities weren't syncing when opening the Training page or sending a coach message — only the home tab had an auto-sync, rate-limited to 30 minutes. (2) The AI coach was missing ring-tracked workouts (`sport_records`) entirely and showed stale/zero steps when `daily_summaries` hadn't rolled up yet. All five root causes addressed.

**Files modified:**
- `src/screens/StravaScreen.tsx` — Added `backgroundSync(7)` inside `loadData()`, run in parallel with `getAthlete()` + `getAthleteStats()` via `Promise.all`, so the activity list is always fresh on page open without extra delay
- `src/screens/AIChatScreen.tsx` — Imported `stravaService`; added fire-and-forget `backgroundSync(3)` before each coach call so the edge function reads fresh Strava data
- `src/hooks/useHomeData.ts` — Reduced home-tab auto-sync cooldown from 30 min → 10 min (`STRAVA_SYNC_INTERVAL_MS`)
- `supabase/functions/coach-chat/index.ts` — Added `sport_records` query (last 5 ring workouts, 14-day window) and a `steps_readings` fallback query (last 24h rolling window) to the parallel fetch; coach prompt now includes a "Ring-tracked workouts" section; steps use `??` nullish coalesce so 0 is a valid value; `RingWorkout` interface extracted; deployed

**Key notes:**
- `backgroundSync` in `AIChatScreen` is fire-and-forget (not awaited) — avoids blocking the coach response on Strava API latency; the edge function reads from the DB which is already populated from prior syncs
- Steps fallback uses a 24-hour rolling window (`gte('recorded_at', now - 24h)`) rather than a calendar date string — avoids UTC vs. local-date mismatch for users in early-morning timezones
- `||` → `??` fix: `latestDay.total_steps === 0` is a valid value and should not fall through to the readings fallback
- `sport_records` are ring-tracked workouts (walks, runs, gym sessions not on Strava); coach now sees both sources

---

## 2026-04-04: Recovery Detail + useFocusData Resting HR Fallback

**Change:** Fixed resting HR showing wrong value (0 score, 103 bpm daytime min) on the Recovery Detail screen. Root cause: `fetchHRHistory` computes restingHR as `Math.min(all heart_rate_readings)`, which includes daytime activity (80–110 bpm) — not the true overnight resting HR. Also fixed a race condition in `useFocusData` where readiness had null restingHR on first coach tab open.

**Files modified:**
- `app/detail/recovery-detail.tsx` — `getHR()` now overrides today's `restingHR` with `homeData.lastNightSleep.restingHR` (ring's accurate overnight value) regardless of what Supabase returns; `todayHRFallback` gained a Tier 2 using `lastNightSleep.restingHR` when `hrChartData` is empty; `computeReadiness()` also falls back to `sleep?.restingHR` for historical days
- `src/hooks/useMetricHistory.ts` — `fetchHRHistory`/`fetchHRFromRing` compute `restingHR` from overnight window (hours 0–7) only; `DayActivityData` gains `hrMin: number | null` from `daily_summaries.hr_min` — the authoritative per-day min HR; `fetchActivityHistory` selects `hr_min`; ring fallback sets `hrMin: null`
- `app/detail/recovery-detail.tsx` — `computeReadiness` fallback chain: ring overnight HR → `activity.hrMin` (daily_summaries) → overnight min → 0; `todayActivityFallback` includes `hrMin: null`
- `src/hooks/useFocusData.ts` — After serving a valid cache, checks if `readiness.components.restingHR` is null; if so, reads `home_data_cache` and triggers a background `load(true)` if a valid `restingHR` is now available there; `bgRefreshInFlight` ref guard prevents concurrent background refreshes

---

## 2026-03-31: TestFlight build 1.0.18 (build 19)

**Change:** Bumped version to 1.0.18 (build 19) and published to App Store Connect via TestFlight.

**Files modified:**
- `app.config.js` — version `1.0.17` → `1.0.18`, buildNumber `18` → `19`
- `ios/SmartRing.xcodeproj/project.pbxproj` — MARKETING_VERSION and CURRENT_PROJECT_VERSION updated (both configs)

**Result:** Archive succeeded, upload to App Store Connect succeeded (build 19 processing).

---

## 2026-03-30: Training Insights card on Activity tab

**Change:** Added a "Training This Week" card above Recent Workouts on the Activity tab, showing weekly session count, total time, total distance, HR zone distribution (with a segmented bar), and a sport breakdown with color-coded chips. Strava activities contribute exact zone seconds; ring/Apple Health activities fall back to zone estimation from average HR.

**Files created:**
- `src/utils/activity/trainingInsights.ts` — Pure aggregation function `deriveTrainingInsights()` that filters to last 7 days, computes weekly stats, aggregates HR zones (Strava-exact + estimated fallback), and groups duration by sport type
- `src/components/home/TrainingInsightsCard.tsx` — Card component rendering the 3-column stats row, segmented HR zone bar with legend, and sport chips with overflow count

**Files modified:**
- `src/screens/home/ActivityTab.tsx` — Inserted `<TrainingInsightsCard>` section above Recent Workouts; added `trainingInsightsSection` style
- `src/services/ActivityDeduplicator.ts` — Exported `getSportConfig()` so sport color mapping is shared (no duplicate maps)
- `src/i18n/locales/en.json` — Added `training_insights.*` keys
- `src/i18n/locales/es.json` — Added `training_insights.*` keys (Spanish)

**Key notes:**
- Zone colors Z1–Z5: `#6B8EFF`, `#8AAAFF`, `#FFD700`, `#FC4C02`, `#FF2D2D` (avoids forbidden `#00D4AA` accents)
- Zone labels reuse existing `strava_detail.zone_z1`–`zone_z5` i18n keys
- If no Strava zones available, shows "Zone times estimated from avg HR" caption
- `overflowCount` returned as a separate field (not mixed into the sport array) to keep the data shape clean
- `stravaZoneMap` only built from week-window Strava activities to avoid unnecessary map entries

---

## 2026-03-30: Coach chat bar as real input on all tabs + auto-send from query

**Change:** The "Ask Coach" prompt on every tab is now a real `TextInput`. The typewriter-animated questions become the placeholder text; users can type a question directly and tap send (or press return) from Overview, Sleep, Activity, and Coach tabs. The query is passed to the AI chat screen via `?q=` route param and auto-sent on mount so the answer loads immediately without any extra tap.

**Files modified:**
- `src/components/focus/AskCoachButton.tsx` — Converted from a `TouchableOpacity` display button to a `TextInput` + send button. Typewriter result is now the `placeholder` prop. Send navigates to `/chat?q=<text>` when text is present, else plain `/chat`.
- `src/components/focus/ChatFAB.tsx` — Same conversion for `ChatBar`. Added `SendIcon`, replaced static placeholder with `useTypewriter()`, added `TextInput` + send button. Navigates to `/chat?q=<text>` on submit.
- `src/screens/AIChatScreen.tsx` — Added `useLocalSearchParams` + `useEffect` to read `q` param and call `sendMessage(q)` on mount (fires once via `initialQueryFired` ref). Added `useEffect` to imports.
- `src/screens/home/OverviewTab.tsx` — Added `ChatBar` import and renders it before the bottom spacer. Added `chatBarSection` style.
- `src/screens/home/SleepTab.tsx` — Same: added `ChatBar` import, renders it before the bottom spacer, added `chatBarSection` style.
- `src/screens/home/ActivityTab.tsx` — Same: added `ChatBar` import, renders it before the bottom spacer, added `chatBarSection` style.

**Key notes:**
- `useTypewriter` hook is now used in both components — placeholder animates only when the field is empty (standard TextInput behavior)
- `initialQueryFired` ref prevents double-send on re-renders
- 120ms `setTimeout` before auto-send gives the component time to mount and context to hydrate
- Coach tab already covered by `AskCoachButton` in `FocusScreen` — no duplicate bar added there

---

## 2026-03-30: AI Coach chat lifted to global root modal

**Change:** The AI coach chat screen (`AIChatScreen`) was nested inside `(tabs)/settings/chat` and could only be reached via the Coach/Focus tab. It is now a global root-stack modal (`/chat`) accessible from any tab or screen via `router.push('/chat')`.

**Files created:**
- `app/chat.tsx` — New global entry point; renders `<AIChatScreen />`

**Files deleted:**
- `app/(tabs)/settings/chat.tsx` — Removed (replaced by root-level `app/chat.tsx`)

**Files modified:**
- `app/_layout.tsx` — Added `FocusDataProvider` wrapper (moved up from settings layout) + registered `Stack.Screen name="chat"` with `presentation: 'fullScreenModal'`
- `app/(tabs)/settings/_layout.tsx` — Removed `FocusDataProvider` and the `chat` `Stack.Screen` entry; now a plain Stack with only the `index` screen
- `src/components/focus/AskCoachButton.tsx` — `router.push` path updated to `/chat`
- `src/components/focus/ChatFAB.tsx` — `router.push` path updated to `/chat`
- `src/components/home/MetricInsightCard.tsx` — `router.push` path updated to `/chat`

**Key notes:**
- `FocusDataProvider` now lives at root level so `useFocusDataContext()` inside `AIChatScreen` is satisfied regardless of which tab the user was on when they opened chat
- Chat still presents as a native iOS `fullScreenModal` (slides up, swipe-down to dismiss)
- All three call sites (`AskCoachButton`, `ChatFAB`/`ChatBar`, `MetricInsightCard`) updated — no orphaned references remain

---

## 2026-03-29: Score label moved above big number in gauge components

**Change:** The score label text ("OVERALL SCORE", "LAST NIGHT", "ACTIVE CALORIES") now appears directly above the large percentage/number instead of at the very top of the component above the arc or bar. Arc and bar animations are unaffected.

**Files modified:**
- `src/components/home/SemiCircularGauge.tsx` — Removed label from top of container; placed it inside `scoreContainer` above `scoreRow`
- `src/components/home/HeroLinearGauge.tsx` — Removed label from top of container; placed it inside `valueWrapper` above the big number

---

## 2026-03-29: HomeHeader cleanup — remove greeting, show initials, bigger icons

**Change:** Decluttered the home screen header by removing the time-of-day greeting ("Good Evening") and user name text. The avatar button now shows the user's first-name initial instead of a generic person icon. The user's name is surfaced in the insight text beneath the overview score gauge ("Mat — Your recovery is excellent."). Ring and reconnect icons are larger for better visibility. About section now shows the live app version dynamically.

**Files modified:**
- `src/components/home/HomeHeader.tsx` — Removed `getGreeting()`, removed `greetingContainer`/`userName` text blocks, removed `DefaultAvatar` SVG component, replaced with initial letter from `userName[0]`, removed `useBaselineMode` and `Constants` imports, removed `useCallback`, increased `DeviceIcon` size 12→16, increased `ReconnectIcon` 14→20
- `src/screens/home/OverviewTab.tsx` — `insight` prop on `MetricInsightCard` now prepends `homeData.userName` (e.g. "Mat — Your recovery is good.")
- `src/screens/SettingsScreen.tsx` — Added `import Constants from 'expo-constants'`, About section app version changed from hardcoded `'1.0.0'` to `Constants.expoConfig?.version ?? '—'`

**Key notes:**
- `userName` prop is still passed to `HomeHeader` (needed for the initial letter display)
- The `useTranslation` hook is retained — still used for reconnect/syncing/connecting labels
- Baseline chip (shown during onboarding) was removed from the header along with the name row; baseline state is shown elsewhere (BaselineProgressCard)

---

### 2026-03-29: Fix V8 sleep fragmentation — date-grouped aggregation

**Root cause:** `V8Service.getSleepByDay(dayIndex)` used a raw array index (`items[dayIndex]`) instead of filtering by calendar date. The V8 band reports sleep as multiple separate sessions per night. Each fragment was synced independently — the last one (e.g. 07:48–09:34) was only 5 min after the prior night session ended, triggering the proximity guard in `NapClassifierService` and inserting it as a nap.

**Fix:** Rewrote `getSleepByDay` to mirror `JstyleService` — fetch all records once (cached), filter by local calendar date (`YYYY-MM-DD`), then aggregate all same-day sessions into one `SleepData` (earliest start, latest end, summed deep/light/rem/awake, merged `rawQualityRecords`). With the fragments merged, the total duration exceeds 180 min → classified as night.

Also: added `_sleepRecordsCache` so the SDK is only called once across the 7-day sync loop (was calling `V8Bridge.getSleepData()` 7 times). Cache is cleared on `disconnect()` so each new sync gets fresh data. `getSleepDataRaw` also shares the cache.

**Files modified:** `src/services/V8Service.ts`

---

### 2026-03-29: Ask Coach button — layout, padding, active indicator

- `MetricInsightCard.tsx`: Button layout changed to `justifyContent: 'space-between'` — left group holds AI icon + "Ask Coach" text, right group holds green "Active" dot + label + send arrow.
- `paddingVertical` is now animated: 22px when expanded (not scrolled), shrinks to 14px as user scrolls (was always 14px).
- New "Active" indicator (6px green dot + "Active" text in muted black) is visible by default and fades out with the send icon as the user scrolls.

Files modified: `src/components/home/MetricInsightCard.tsx`

---

## 2026-03-29: Refactor — extract useTabScroll hook

**What changed:**
- Extracted repeated scroll-tracking boilerplate (`scrollRef`, `scrollY` SharedValue, `handleScroll`, `isActive` reset) that was duplicated across all three home tabs into a single `useTabScroll(isActive, onScroll)` hook.
- Each tab previously had ~12 lines of identical scroll setup; those are now replaced with a single `useTabScroll` call.

**Files created:**
- `src/hooks/useTabScroll.ts`

**Files modified:**
- `src/screens/home/OverviewTab.tsx`
- `src/screens/home/SleepTab.tsx`
- `src/screens/home/ActivityTab.tsx`

---

## 2026-03-29: Ask Coach button animation — slower + extended to Sleep/Activity tabs

**What changed:**
- **`MetricInsightCard.tsx`:** Widened collapse scroll range from 60px (10→70) to 150px (10→160), making the button collapse ~2.5× slower as the user scrolls.
- **`SleepTab.tsx`:** Added `useSharedValue` scroll tracking (`scrollY`), intercepts `onScroll` via `handleScroll`, resets scrollY when tab becomes active, passes `scrollY` to `MetricInsightCard`.
- **`ActivityTab.tsx`:** Same changes as SleepTab — the ask coach button now collapses on scroll in all three tabs consistently.

**Files modified:**
- `src/components/home/MetricInsightCard.tsx`
- `src/screens/home/SleepTab.tsx`
- `src/screens/home/ActivityTab.tsx`

---

## 2026-03-30: Fix baseline_completed_at — wrong table name

**Bug:** `BaselineModeService` was reading/writing `baseline_completed_at` to a table called `user_profiles`, which doesn't exist. The real table is `profiles` with PK `id`. The old migration `20260323_baseline_completed_at.sql` also targeted the wrong table. As a result, baseline completion was never persisted to Supabase — only AsyncStorage — so reinstalling the app resets baseline mode.

**Fix:**
- Added migration `20260330_fix_baseline_completed_at_profiles.sql` (`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS baseline_completed_at`)
- Applied migration to production (pxuemdkxdjuwxtupeqoa)
- Fixed `BaselineModeService.ts`: `.from('user_profiles').eq('user_id', ...)` → `.from('profiles').eq('id', ...)` (both read and upsert)
- Backfilled `baseline_completed_at` for matmarcopolo@gmail.com

**Files modified:**
- `src/services/BaselineModeService.ts`
- `supabase/migrations/20260330_fix_baseline_completed_at_profiles.sql` (new)

---

## 2026-03-29: Baseline Copy + Gradient Cards + Consistency Rule

**What changed:**
- **Baseline card copy:** "Building Your Baseline" → "Welcome to Focus. We're building your baseline metrics." (en.json + es.json `baseline.title`)
- **Baseline detail gradient cards:** Each metric card in `app/detail/baseline-detail.tsx` now uses `LinearGradient` (from `expo-linear-gradient`) instead of a flat `rgba(255,255,255,0.04)` background. Gradient goes from `accentColor` at 15% opacity → 3% opacity diagonally, giving each card (Sleep/HR/HRV/Temp/SpO₂/Activity) its own colour-tinted identity.
- **CLAUDE.md consistency rule:** Added "Component consistency" design convention — reuse and extend existing components with special props before creating new ones.

**Files modified:**
- `src/i18n/locales/en.json`
- `src/i18n/locales/es.json`
- `app/detail/baseline-detail.tsx`
- `CLAUDE.md`

---

## 2026-03-29: Fix Today Screen Freeze — Add Timeout to JstyleService.autoReconnect()

**What changed:**
The Today screen would intermittently freeze (showing the sync spinner indefinitely) when the ring was previously paired but not nearby. Root cause: `JstyleService.autoReconnect()` was calling `JstyleBridge.autoReconnect()` without any timeout. The native implementation stores a `pendingConnectResolver` and only resolves when CoreBluetooth fires `didConnectPeripheral` — which never fires if the ring is out of range. This left `isFetchingData.current = true` permanently, blocking all future syncs for the session.

Fix: wrapped the call with `withNativeTimeout(…, 12000)` and a `.catch()` fallback that returns `{ success: false }`. The screen now shows "Ring not connected" within 12 seconds instead of hanging forever. Note: V8Service already had this timeout (15s); Jstyle was the only one missing it.

**Files modified:** `src/services/JstyleService.ts`

---

## 2026-03-29: Word-by-word AI response animation + TestFlight 1.0.15 (build 16)

**What changed:**
AI coach responses now animate in word by word with a staggered entrance (opacity 0→1, translateY 6→0, 30ms stagger per word). Each word is an `AnimatedWord` component using `useSharedValue` + `withDelay` + `withTiming` (500ms, bezier 0.4,0,0,1). Words laid out via `flexDirection:'row', flexWrap:'wrap'`.

TestFlight build 1.0.15 (build 16) uploaded and processing.

**Files modified:** `src/screens/AIChatScreen.tsx`, `app.config.js`, `ios/SmartRing.xcodeproj/project.pbxproj`

---

## 2026-03-28: Fix Coach Screen Keyboard — Replace useAnimatedKeyboard with KeyboardAvoidingView

**What changed:**
The Coach/Chat screen input bar now correctly slides up with the keyboard. Previously, `useAnimatedKeyboard` + `Reanimated.View` was used but the animation was broken — the content stayed pinned to the bottom even when the keyboard appeared.

**Fix:**
Removed `useAnimatedKeyboard`, `useAnimatedStyle`, and the `Reanimated` default import entirely. Replaced `<Reanimated.View style={inputAnimStyle}>` with `<KeyboardAvoidingView behavior="padding">` (iOS). The `insets.bottom + 12` offset previously applied via `marginBottom` is now an inline `paddingBottom` on the `inputWrapper` View.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-29: X6 Ring Detection + Correct Image + SDK Routing

**What changed:**
X6 ring devices (BLE name `X6F …`, V8 SDK) are now properly recognized as rings throughout the app — shown with the `x6-mock-connect.png` image, labeled "FOCUS X6", and tracked as `deviceType: 'ring'` so SDK routing is correct.

**Root cause:**
All V8 SDK devices were hardcoded as `deviceType: 'band'` in three layers (V8Service, UnifiedSmartRingService, useSmartRing), causing the X6 ring to show the band image and be treated as a band internally.

**Fix:**
- Device type now inferred from the BLE device name at discovery time (`/x6/i` check).
- `setConnectedSDKType` accepts an optional `deviceType` override so connect/autoReconnect can propagate the correct ring/band distinction.
- `connect()` in `useSmartRing` passes `device.deviceType` through to the unified service.
- `autoReconnect` looks up the paired device name to determine device type on reconnect.

**Files modified:**
- `src/services/V8Service.ts` — `onDeviceDiscovered`: X6 sets `deviceType: 'ring'`
- `src/services/UnifiedSmartRingService.ts` — `setConnectedSDKType` accepts `deviceType?`; `connect()` forwards it; `autoReconnect` infers from paired device name; `onDeviceDiscovered` V8 path adds `isX6` check
- `src/hooks/useSmartRing.ts` — passes `device.deviceType` to `setConnectedSDKType` and `connect()`; `formatDeviceName` returns 'FOCUS X6' for v8 ring devices
- `src/components/home/DeviceSheet.tsx` — adds `X6_MOCK_IMG`; shows correct image per device type
- `src/screens/SettingsScreen.tsx` — adds `X6_MOCK_IMG`; shows correct image + name per device type
- `app/(onboarding)/connect.tsx` — adds `X6_MOCK_IMG` + `isX6Device()`/`getDeviceImage()` helpers; device card shows correct image + name

**Key notes:**
- X6 still communicates via V8Service/V8Bridge (same BLE protocol) — only the semantic type is corrected to `'ring'`
- All three images are now distinct: `connect-mock.png` (X3), `x6-mock-connect.png` (X6), `v8-mock-connect.png` (Band)

---

## 2026-03-29: Auto Strava Sync on Home Load

**What changed:**
Strava activities now sync automatically when the home screen loads, so new runs appear in the Activity tab without needing a manual sync tap.

**Root cause of the bug:**
`backgroundSync()` was fire-and-forget — it started in parallel with the Supabase `strava_activities` query, which almost always won the race and read stale data. New runs done hours ago never appeared until the user manually tapped Sync in the Strava screen.

**Fix:**
Changed the background Strava sync to an **awaited, rate-limited** call (30-min interval). The sync now runs before the Supabase query, so the DB always has fresh data by the time it's read. Rate limiting means it only adds ~1–2s of latency on the first load or after 30 min idle — all other loads are instant.

The sync still runs **in parallel with ring reconnect** (which was already fire-and-forget above it), so wall-clock time is unchanged on most app opens.

**Files modified:** `src/hooks/useHomeData.ts`

---

## 2026-03-28: "Ask Coach" Button Scroll-Driven Animation

**What changed:**
The "Ask Coach" pill is always in its expanded state (90% width, send icon, extra padding) and collapses as the user scrolls — exactly like the header. Scrolling back to top re-expands it.

**Architecture:**
- `OverviewTab` creates a Reanimated `useSharedValue(0)` for `scrollY`
- `handleScroll` callback intercepts the scroll event: updates `scrollY.value` and forwards to the existing `onScroll` (header animation), so nothing else breaks
- `scrollY` is reset to 0 when the tab re-activates (so button re-expands on tab switch)
- `scrollY` is passed as a new optional prop to `MetricInsightCard`

**MetricInsightCard:**
- All timer/sync/phase logic removed
- `animatedBtnStyle` and `sendIconStyle` derive directly from `scrollY.value` via `interpolate` (scroll 10–70px maps 1→0)
- `fallbackScrollY = useSharedValue(0)` used when no `scrollY` prop (SleepTab / ActivityTab stay expanded)
- No separate `expandProgress` needed — purely scroll-driven

**Files modified:** `src/screens/home/OverviewTab.tsx`, `src/components/home/MetricInsightCard.tsx`

---

## 2026-03-28: Extended Artifact System + Full Coach Health Context

**What changed:**
The AI coach now has access to all available health data and can render 6 artifact types inline in chat.

**Health data context (edge function):**
- Readiness score breakdown with raw baseline values — e.g. "HRV 42ms vs 14-day median 58ms" instead of vague "below baseline"
- Full sleep history (7+ sessions), HRV/SpO2/temp readings, steps, Strava last run, strain score all passed as system prompt context
- `max_tokens` bumped 600→1000 for richer responses
- Medians computed server-side from already-fetched data (no new Supabase queries)

**Artifact types (keyword-triggered, rendered inline below coach message):**
| Artifact | Trigger keywords |
|---|---|
| `sleep_hypnogram` | sleep, slept, rem, deep sleep, bedtime… |
| `readiness_score` | readiness, focus score, ready to train… |
| `heart_rate` | heart rate, bpm, pulse, resting heart… |
| `sleep_trend` | sleep trend, weekly sleep, 7 day sleep… |
| `sleep_debt` | sleep debt, sleep deficit, catch up on sleep… |
| `steps` | steps today, step count, how many steps… |

**FocusDataContext:** Shared context wraps the settings stack so `FocusScreen` and `AIChatScreen` share one `useFocusData()` fetch instead of two.

**Fixes from simplify pass:**
- `ReadinessArtifactCard` now takes explicit `score`/`recommendation` props (no hidden context dependency)
- Removed dead `chipStyles.container: {}`
- `StepsArtifactCard` pct capped at 100 with `Math.min`
- `readiness` prop wired through `MessageBubble` render call

**Files modified:** `src/screens/AIChatScreen.tsx`, `supabase/functions/coach-chat/index.ts`, `src/context/FocusDataContext.tsx` (new), `src/screens/FocusScreen.tsx`, `app/(tabs)/settings/_layout.tsx`

---

## 2026-03-28: Fix NOT_CONNECTED Cascade on Sync After Connect

**Problem:** Right after the ring connected, 5 separate `Error syncing X data: NOT_CONNECTED` errors appeared in logs — one per sub-sync (vitals, heart rate, sport, blood pressure, steps).

**Root cause:** `fetchData` in `useHomeData` fires `dataSyncService.syncAllData()` immediately after completing. BLE can drop momentarily as the SDK settles post-connection, so by the time `syncAllData` runs its ring calls, the connection reads as NOT_CONNECTED. Each sub-sync logged its own error independently.

**Fix:** Added a single `UnifiedSmartRingService.isConnected()` guard at the top of `syncAllData()` before setting `isSyncing = true` or touching the ring. If not connected, returns early with a silent log — no cascading errors.

**Files modified:** `src/services/DataSyncService.ts`

---

## 2026-03-27: Coach Screen — Layout & Style Refinements

**Changes (5 items):**
- **AI footer vertical stack:** Copy icon (24×24, full white) now sits on top, AI icon (22×22, full white) below — `flexDirection:'column'` with `gap:8`. Previously side-by-side.
- **Header removed:** The menu icon + "Coach" title + X close button header has been deleted entirely. The gradient + blob design now fills the full screen from top.
- **Metrics card restyled:** Exact same styles as `MetricInsightCard` in OverviewTab — no card background, `fontSize:32` values, `rgba(255,255,255,0.6)` labels, `height:48` dividers. Removed the old glassy card wrapper.
- **Suggestion chips repositioned:** Moved from inside the hero section (near metrics) to directly above the input bar, 20px gap. Appear as a sibling between hero/messages and the input panel.
- **Input bar redesigned (Figma 647-543):** Full-width frosted glass panel `rgba(255,255,255,0.3)` with rounded top corners only (20px), no side margins. Inner pill row `borderRadius:100` with same translucent bg. Removed old bordered wrapper.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-28: Chat Bubble UI Redesign

**Changes:** Cleaned up the AI chat message layout significantly:
- Removed the AI avatar circle that was sitting to the left of every AI response
- AI responses now render as plain text — no background, no border, no padding (fully transparent)
- AI icon (brain SVG) moved to below the response text, left-aligned in the footer row
- Copy button moved outside the bubble to the footer row (right side), icon only (no "Copy" label text)
- Font size increased from 14 → 17px with lineHeight 26 for both user and AI messages

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-28: AI Coach — Baseline Raw Values in Readiness Context

**Change:** Coach now cites actual numbers when explaining the readiness score. Previously it could say "HRV is below baseline (58/100)" but not *why*. Now it says "today 42ms vs 14-day median 58ms". Computed directly from already-fetched data (no new queries). Also bumped max_tokens 600 → 1000 to prevent cut-off on detailed answers.

**Context now includes per-component raw values:**
- HRV: today Xms vs 14-day median Xms
- Sleep: last night Xh Xm vs 7-night median Xh Xm
- Resting HR: today Xbpm vs 7-day median Xbpm

**Files modified:** `supabase/functions/coach-chat/index.ts`

---

## 2026-03-28: AI Coach — Readiness Score Context + FocusDataContext

**Change:** The AI coach now knows why your readiness score is what it is. When you ask "why is my score 69?" the coach can explain the component breakdown, which metric is dragging the score down, and what each factor means.

**What users see:**
- Coach answers score breakdown questions accurately: "Your HRV is below your 14-day baseline (58/100, 35% of score), which is the primary drag pulling your score down from the sleep component which is solid at 72/100"
- If illness watch is active (WATCH or SICK), the coach mentions the active signals and deltas vs baseline
- Readiness context includes confidence level so the coach can caveat when there's not enough baseline data yet

**Technical:** Readiness is computed client-side (uses AsyncStorage baselines) so it's passed in the request body rather than re-computed in the edge function. Created `FocusDataContext` to avoid double-fetching — both `FocusScreen` and `AIChatScreen` were calling `useFocusData()` independently, causing duplicate Supabase queries on every chat open. Now a single `FocusDataProvider` at the settings stack layout level shares one data instance.

**Score breakdown in context:**
- HRV: X/100 (good/near baseline/below baseline, 35% weight)
- Sleep quality: X/100 (25% weight)
- Resting HR: X/100 (20% weight)
- Training load: X/100 (20% weight)
- Primary drag identified as the lowest-scoring component below 60

**Files created:** `src/context/FocusDataContext.tsx`
**Files modified:** `src/screens/AIChatScreen.tsx`, `src/screens/FocusScreen.tsx`, `app/(tabs)/settings/_layout.tsx`, `supabase/functions/coach-chat/index.ts`

---

## 2026-03-27: AI Coach — Full Health Data Context + Copy Response

**Change:** Fully rewrote the `coach-chat` Supabase Edge Function to give Claude access to all available health data. Previously the coach only had basic sleep/steps data and couldn't answer questions like "how many hours did I sleep?" or "what was my HRV this week?". Now it fetches 8 data sources in parallel and builds a structured 4-section context.

**What users see:**
- Coach now accurately answers questions about sleep duration, sleep debt, HRV (RMSSD/SDNN), resting HR (uses `hr_min` not `hr_avg`), SpO2, body temp trend, daily steps, and Strava training
- Added copy button to AI responses — taps open the iOS share sheet with the reply text
- Suggestion chips now work: tapping them sends the message instantly

**Data sources added:**
1. Sleep history — last 7 nights with per-night breakdown (deep/light/REM/awake minutes + score) + sleep debt vs target
2. Today's metrics — HRV (RMSSD + SDNN), resting HR, SpO2, steps, stress level, body temp with 7-day delta
3. 7-day trends — avg sleep duration, avg HRV, avg daily steps
4. Training — last 5 Strava activities (14-day window) with pace, elevation, avg HR, suffer score

**Key fixes in edge function:**
- Sleep duration now computed from `deep_min + light_min + rem_min` (not a `sleep_score` that's often null)
- Resting HR uses `hr_min` (daily minimum, proxy for resting HR) not `hr_avg` (full-day avg inflated by activity)
- HRV prefers raw `rmssd`/`sdnn` from `hrv_readings` table, falls back to `hrv_avg` in `daily_summaries`
- Profiles table queried for `sleep_target_min` to compute accurate sleep debt

**Files modified:** `supabase/functions/coach-chat/index.ts`, `src/screens/AIChatScreen.tsx`

---

## 2026-03-27: Coach Screen Full Redesign (Figma Match)

**Change:** Complete visual redesign of the AIChatScreen to match the Figma mockup (node 647-486). The Coach tab now opens to a cinematic warm-gradient hero screen instead of a plain dark chat UI.

**What users see:**
- Warm red-burgundy gradient background (fades to black at bottom) with two soft decorative glow blobs
- New header: circular menu icon (left) + "Coach" title (center) + X close button (right, navigates back)
- Hero section (before any conversation): centered AI icon → personalized insight text built from real Strain/Sleep/Readiness data → glassmorphic metrics card showing Strain | Readiness | Sleep → 3 white translucent suggestion chip pills
- Once a message is sent, the hero disappears and chat messages appear on the same gradient background
- Redesigned input bar: glassmorphic container, "Ask your coach anything..." placeholder, dark circular up-arrow send button

**Key details:** `LinearGradient` from `expo-linear-gradient`; hero shown when `messages.length === 0`; `buildInsightText()` memoized via `useMemo`; close button wired to `router.back()`; message bubbles updated to work on gradient bg. Gradient corrected to match Figma CSS exactly (`105deg, #000 1.12%, rgba(172,13,13,0.99) 135.8%` → `start:{x:0,y:0.37} end:{x:1,y:0.63}`). Blob decoration replaced with the exact Figma SVG (`SvgXml`, two ellipses at #AC0D0D + #FF753F with Gaussian blur, 90% screen height, top-right anchored).

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-27: Remove handle indicator and top border from all bottom sheets

**Change:** Removed the drag handle pill and top border from all 5 bottom sheets for a cleaner, borderless look. `handleComponent={null}` replaces `handleIndicatorStyle` on all sheets; `borderWidth`/`borderColor` removed from dark sheet background styles.

**Files modified:** `DeviceSheet.tsx`, `FirmwareUpdateSheet.tsx`, `TroubleshootSheet.tsx`, `ExplainerSheet.tsx`, `AuthScreen.tsx`

---

## 2026-03-27: Suggested Questions Chips in Coach Chat

**Change:** Added pre-made question chips to the Coach chat screen. When the conversation is fresh (only the welcome message showing), a horizontal scrollable row of 6 shortcut chips appears below the AI greeting. Tapping any chip instantly sends that question to the coach — no typing needed. Chips disappear once the conversation starts.

**Questions offered:** "How did I sleep?", "Am I recovered?", "My HRV trend", "Improve sleep", "Activity today?", "Weekly summary"

**Design:** Blue-tinted chips (`#6B8EFF`, 10% opacity bg, 30% border) matching the tertiary color convention. Horizontal scroll handles overflow without wrapping.

**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-27: Sleep Hypnogram Artifact in Coach Chat

**Change:** Coach chat now renders the sleep hypnogram chart inline when the user asks about sleep. The edge function checks if the user message is sleep-related (keywords: sleep, slept, last night, rem, deep sleep, nap, woke, bedtime, hypnogram) and returns `artifact: { type: 'sleep_hypnogram' }` alongside the text reply. The app reads the artifact and renders the existing `SleepHypnogram` component directly below the AI text bubble using live data already loaded in `useHomeDataContext` — no extra fetch needed. Also fixed suggestion chips to send on tap and fixed the sleep data and resting HR values in the health context.

**Files modified:** `src/screens/AIChatScreen.tsx`, `supabase/functions/coach-chat/index.ts`

---

## 2026-03-27: Real AI Coach Chat (Claude via Supabase Edge Function)

**Change:** Replaced the mock AI chat in the Coach tab with a real Claude-powered conversation. The chat now reads the user's actual health data from Supabase and responds with personalized coaching.

**How it works:**
- New Supabase Edge Function `coach-chat` authenticates the user via JWT, fetches their latest sleep score/duration, HRV, resting HR, and 7-day trends from `sleep_sessions` and `daily_summaries`, builds a health-context system prompt, and calls `claude-haiku-4-5-20251001`
- `AIChatScreen.tsx` now calls `supabase.functions.invoke('coach-chat')` passing the message + last 20 messages of history (windowed to control token costs)
- Error handling shows a friendly "Couldn't reach Coach" message on failure

**Setup required:** `npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (one-time, no rebuild needed)

**Files created:** `supabase/functions/coach-chat/index.ts`
**Files modified:** `src/screens/AIChatScreen.tsx`

---

## 2026-03-27: EAS OTA Deploy — Resting HR + Coach Page Fixes

**Change:** Deployed all Coach/Focus page fixes via EAS OTA update to production channel (`ceb88fd3-d610-433e-9ae0-62c3f58bb6a4`). This includes: cache key v4 to evict stale readiness data, `home_data_cache` fallback for restingHR, population-norm HR scoring, sleep minutes fallback, illness watch optional chaining, last run timezone fix, and HR reserve expected HR model.

**Files modified:** (no new changes — deploy only)

**Key notes:**
- Previous EAS update deployed before cache key v4 + restingHR fallback were written — this deploy gets them live
- App must be fully killed and relaunched (not just backgrounded) to pick up the OTA update
- iOS update ID: `019d2f38-f421-796a-9d6f-e9004656d52d`

---

## 2026-03-27: Fix Resting HR Still Empty in Readiness (Ring Data Fallback)

**Root cause:** The `scoreRestingHRComponent` fix (population-norm fallback) only helps when `hr` is non-null. The actual problem is that `restingHR` from Supabase `heart_rate_readings` is `null` — either the ring hasn't synced to Supabase yet when the coach page loads, or continuous HR data wasn't written for today. With `hr = null`, the scorer returns null → 0% bar, regardless of the formula.

**Fix:** After the Supabase HR query, fall back to `home_data_cache` (AsyncStorage key written by `useHomeData`) to read `lastNightSleep.restingHR` — the ring-computed value used by the health tab. This value is always populated after a ring sync. Also bumped cache key to `v4` to evict stale cached readiness that had null restingHR baked in.

**Files modified:**
- `src/hooks/useFocusData.ts` (cache key v4, ring fallback for restingHR)

---

## 2026-03-26: Fix "Sleep score: --" in Last Run Body State

**Root cause:** `computeLastRunContext` queried `sleep_score` from `sleep_sessions`, but `sleep_score` is always `null` in the DB (DataSyncService hardcodes `sleep_score: null` on insert). Result: `bodyStateAtRun.sleepScore` was always `null` → card showed "--".

**Fix:** Changed query to select `deep_min, light_min, rem_min` and compute total sleep minutes. Renamed field from `sleepScore` to `sleepMinutes` in `LastRunContext.bodyStateAtRun`. Card now displays e.g. "6h 20m" instead of a score. Label changed from "Sleep score" → "Sleep time" in en/es.json.

**Files modified:**
- `src/types/focus.types.ts` (sleepScore → sleepMinutes)
- `src/services/ReadinessService.ts` (query + field)
- `src/components/focus/LastRunContextCard.tsx` (format display)
- `src/i18n/locales/en.json`, `es.json`

---

## 2026-03-26: Fix Resting HR Bar Empty + Illness Watch False Positive

**Changes:**

1. **Resting HR bar was always 0%** — `scoreRestingHRComponent` returned `null` when `baselines.restingHR` was empty (no Supabase historical HR data to bootstrap from). Null score renders as 0% bar. Fixed: when no personal baseline exists, score against population norms instead (`100 - (hr - 40) * 2.5`). For 43 bpm → score ≈ 92 ("Excellent"). Bar is now visible and meaningful even before enough history exists.

2. **Illness watch "elevated HR" false positive** — Added a minimum absolute threshold (`restingHR > 52`) to the elevated-HR check so truly low resting HR (≤52 bpm, i.e. athletic baseline) can never trigger the signal even if the personal baseline gets temporarily skewed by bad data. The primary cause was stale cached illness data (now evicted by cache v3); this guard prevents recurrence.

**Files modified:**
- `src/services/ReadinessService.ts`

---

## 2026-03-26: Fix Coach Page Crash + Sleep/RestingHR Missing From Readiness

**Changes:**

1. **Crash: `illness.details` undefined** — Old cached `IllnessWatch` objects (from `focus_state_cache_v2`) don't have the `details` field added in the previous fix. Accessing `.details.tempDelta` crashed. Fixed with optional chaining (`illness.details?.tempDelta`) in all three delta signal rows. Bumped cache key to `focus_state_cache_v3` to force eviction of broken cached data.

2. **Sleep component always null** — `sleep_score` is stored as `null` in `sleep_sessions` (DataSyncService line 304 hardcodes `sleep_score: null`). `scoreSleepComponent` was returning null immediately when sleepScore was null. Fixed to fall back to minutes-only scoring: when `sleepScore == null` but `sleepMinutes` is available, computes score as `clamp(minutes / baselineMinutes × 100, 0, 100)`. Sleep sessions do store `deep_min + light_min + rem_min`, so this now produces a real score.

3. **Baselines null on cache hit** — `CachedFocusState` doesn't include baselines. The cache path returned early without calling `setBaselines`, so `baselines` stayed `null`. Fixed by calling `loadBaselines().then(setBaselines)` even on cache hit (AsyncStorage read, non-blocking).

**Files modified:**
- `src/components/focus/IllnessWatchCard.tsx` (optional chaining)
- `src/hooks/useFocusData.ts` (cache key bump v3, baseline load on cache hit)
- `src/services/ReadinessService.ts` (scoreSleepComponent minutes fallback)

---

## 2026-03-26: Fix 4 Coach Page Bugs (HRV label, illness delta, last run date, expected HR)

**Changes:**

1. **Illness Watch: HRV shows "Suppressed" + actual delta** — `SignalRow` for HRV previously showed generic "Elevated" (wrong — HRV being flagged means it's suppressed, not elevated). Now shows the actual percentage delta e.g. "−22%". Resting HR and temp rows similarly show "+7 bpm" and "+0.8°C" instead of just "Elevated". Added `details: IllnessWatchDetails` to `IllnessWatch` type, computed in `computeIllnessWatch`.

2. **Last run shows "Yesterday" instead of "Today"** — Timezone bug in `useFormatRunDate`. `new Date("2026-03-26")` parses as UTC midnight, which in UTC-5 is ~7 hours before local noon, making the ms-diff round to 1 = "Yesterday". Fixed by comparing YYYY-MM-DD strings in local timezone directly. Also reuses the `runNoon` Date object to avoid constructing it twice.

3. **Expected HR = 77 (nonsensical)** — Formula anchored at resting HR (43) and produced completely wrong running HR estimates (43 + pace_offset ≈ 55–79 bpm). Replaced with HR reserve model: `easyRunHR = restingHR + hrReserve × 0.65`, anchored at 5:30/km easy pace. For resting=43: expected HR at 5:30/km ≈ 139, at 6:00/km ≈ 135. Much more realistic.

4. **Code quality:** Added explicit `IllnessWatchDetails` import to `ReadinessService.ts`. Structured delta computation into a typed `details` object.

**Files modified:**
- `src/types/focus.types.ts`
- `src/services/ReadinessService.ts`
- `src/components/focus/IllnessWatchCard.tsx`
- `src/components/focus/LastRunContextCard.tsx`
- `src/i18n/locales/en.json` (added `value_suppressed`)
- `src/i18n/locales/es.json` (added `value_suppressed: "Suprimido"`)

---

## 2026-03-26: Fix Resting HR Wrong on Coach Page

**Root cause:** `useFocusData.ts` queried `heart_rate_readings` from midnight today → end of today. Resting HR is recorded during sleep (9pm–7am), which happens before midnight — so the query missed the sleep window entirely and fell back to daytime readings (higher/wrong values). The health tab correctly uses sleep-derived `restingHR`, which is why it showed the accurate 43 bpm while the coach page showed off values.

**Fix:** Changed the `heart_rate_readings` query start from `todayStart` (midnight) to `sleepLookbackStart` (6pm yesterday), matching the same lookback window already used for sleep session queries. The minimum HR over the overnight window is now the actual resting HR during sleep.

**File modified:**
- `src/hooks/useFocusData.ts` (1-line change: `.gte('recorded_at', todayStart)` → `.gte('recorded_at', sleepLookbackStart)`)

---

## 2026-03-26: Fix Nap Re-creation + Sleep Detail Shows Night Only

**Changes:**

1. **DataSyncService** (`src/services/DataSyncService.ts`) — `syncSleepData()` now fetches existing night sessions from Supabase once before the 7-day loop. For any block classified as a nap, it checks if that block's time range overlaps any stored night session. If it does, the insert is skipped entirely. This permanently prevents the ring's "last hour of the night" block from being re-inserted as a nap on every sync.

2. **useMetricHistory** (`src/hooks/useMetricHistory.ts`) — `fetchSleepHistory()` now filters to `session_type = 'night'` only. This ensures the sleep detail screen shows the correct single night session per day, and prevents a nap (which may share the same UTC dateKey as the night it follows) from displacing the night entry in the history map.

**Files modified:**
- `src/services/DataSyncService.ts`
- `src/hooks/useMetricHistory.ts`

**Key notes:**
- Overlap detection uses `startTime < nightEnd && endTime > nightStart` (standard interval overlap)
- Night sessions are fetched once for all 7 days (1 extra query per sync, not 7)
- The sleep detail nap section (today only) still works — it reads from `homeData.todayNaps`, not from the history map

---

## 2026-03-26: Fix ConnectScreen SDK Delegate Theft (X3 ring connection timeout)

**Change:** After fixing auth, the Coach tab crashed before computing readiness: `"Cannot convert undefined value to object"`. Root cause: `sleepMinutes: []` was added to `FocusBaselines` recently, but old baselines stored in AsyncStorage under `focus_baselines_v1` don't have this field. When `updateBaselines()` received `readings.sleepMinutes=3` (truthy), it called `pushRolling(undefined, 3)` which tried `[...undefined, 3]` — that's a JSC TypeError.

**Files modified:**
- `src/services/ReadinessService.ts` — `loadBaselines()` now merges parsed data over `emptyBaselines()` so any field missing from old stored versions gets a default (`[]` for arrays). `pushRolling()` parameter typed as `number[] | undefined` with `?? []` guard as a second safety net.

**Key notes:**
- This is a schema migration pattern — whenever a new field is added to `FocusBaselines`, `loadBaselines()` auto-heals old stored values via the `{ ...emptyBaselines(), ...parsed }` merge
- No need to bump the storage key — the merge handles it gracefully

---

## 2026-03-26: Fix Coach Tab Always Showing "--" (Auth + Cache)

**Change:** Coach tab ring showed "--" and cards were empty. Root cause: `supabase.auth.getUser()` makes a server round-trip to verify the JWT — if the token is expired or the network is slow, it returns null and `load()` bails early before computing readiness. Secondary: stale `v2` cache could hold null readiness from a prior broken run and serve it immediately on cache HIT.

**Files modified:**
- `src/hooks/useFocusData.ts` — Replaced `supabase.auth.getUser()` with `supabase.auth.getSession()` (reads AsyncStorage, no network round-trip, always returns user if signed in). Added `cache.readiness != null && cache.illness != null` guard on cache HIT to prevent serving nulls from a broken prior run.

**Key notes:**
- `getSession()` is the correct approach for mobile — the Supabase client handles token refresh automatically on subsequent queries
- Cache guard ensures a partially-written cache (from a session that auth-failed) doesn't get served as a valid hit
- The `[FocusData]` debug logs already in place will confirm the fix: `Auth user=<uuid>` should now appear in Metro on every Coach tab open

---

## 2026-03-26: Baseline UI Improvements

**Changes:**

1. **BaselineProgressCard (Overview tab)** — Removed border (`borderWidth`/`borderColor`), enlarged title font from `fontSize.xl` (20px) to `fontSize.xxl` (28px), removed the per-metric dot progress rows entirely, added a "View Baseline" teal outline button at the bottom that navigates to the new `/detail/baseline-detail` screen.

2. **SleepTab baseline state** — Replaced the teal pill (small colored badge with tracking text) with a plain title + subtitle layout matching the overview card: large white `fontSize.xxl` bold title showing nights tracked, with the subtitle in muted `rgba(255,255,255,0.45)` below.

3. **New baseline detail screen** (`app/detail/baseline-detail.tsx`) — Full scrollable screen accessible via "View Baseline" button. Shows per-metric cards for all 6 metrics (Sleep, Heart Rate, HRV, Temperature, Blood Oxygen, Activity) with: current value, 7-day rolling average, progress toward baseline (X/Y nights), and a 7-day mini trend bar chart. Includes an overall progress bar at the top.

4. **i18n** — Added `baseline.view_baseline` key to `en.json` ("View Baseline") and `es.json` ("Ver Baseline").

**Files modified:**
- `src/components/home/BaselineProgressCard.tsx`
- `src/screens/home/SleepTab.tsx`
- `src/i18n/locales/en.json`
- `src/i18n/locales/es.json`

**Files created:**
- `app/detail/baseline-detail.tsx`

---

## 2026-03-26: Add Debug Logging to Coach Tab Data Pipeline

**Change:** The Coach tab (`FocusScreen`) was non-responsive with no visibility into where the pipeline was failing. Added `console.log` statements at every meaningful checkpoint across the full data pipeline so Metro logs can pinpoint the exact failure point.

**Files modified:**
- `src/hooks/useFocusData.ts` — Logs at: `load()` entry (skipCache value), cache HIT/MISS with `cachedAt` timestamp, auth user result (null = not signed in), bootstrap trigger, per-query Supabase errors (via extracted `logQueryError()` helper), final metric values (hrv/sleepScore/sleepMin/restingHR/temps), computed readiness score + illness status + lastRun date, cache save, ERROR catch, and load() complete
- `src/services/ReadinessService.ts` — Logs at: `computeReadiness` inputs + output score/components (guarded with `__DEV__`), `computeIllnessWatch` status + signals (guarded with `__DEV__`), `computeLastRunContext` Strava result, `bootstrapBaselinesFromSupabase` daysLogged

**Key notes:**
- All logs prefixed `[FocusData]`, `[Readiness]`, `[Illness]`, `[LastRun]`, or `[Bootstrap]` — filter in Metro to isolate
- `JSON.stringify` calls for components/signals are wrapped in `if (__DEV__)` to avoid serialization cost in production
- 4 duplicate Supabase per-query error-check blocks extracted into local `logQueryError()` helper
- Diagnostic flow: auth null → no data fetched; all metrics null → score stays null → ring shows "–"; cache stuck → repeated HIT logs; compute error → surfaces in ERROR catch

---

## 2026-03-26: TestFlight Build 1.0.12 (build 13)

**Bumped** version from 1.0.11 (build 12) → 1.0.12 (build 13). Updated `app.config.js`, `project.pbxproj` (MARKETING_VERSION + CURRENT_PROJECT_VERSION). Ran pod install, committed, pushed, archived, and uploaded to App Store Connect successfully.

---

## 2026-03-26: Fix SDK Misdetection (X3B Ring Showing as V8 Band)

**Change:** After an onboarding reset on a device that had previously connected a V8 band, the app was incorrectly routing all ring calls through the V8 SDK. The user saw the V8 band image in DeviceSheet/SettingsScreen, and all V8 native calls timed out because the X3B ring doesn't implement the V8 protocol.

**Root causes fixed:**

1. **`JstyleService.hasPairedDevice()` attempted a BT connection** — it was calling `JstyleBridge.autoReconnect()` instead of just reading NSUserDefaults. If BT wasn't ready, it returned `success: false` → the unified service concluded no Jstyle device was paired, and fell through to V8's check.

2. **Stale V8 NSUserDefaults** — `kV8PairedDeviceUUIDKey` persisted from the old V8 session. After onboarding reset (which only cleared AsyncStorage, not native NSUserDefaults), `V8Bridge.hasPairedDevice()` still returned `true`. The unified service then set SDK type to `v8`.

3. **No SDK type persistence** — every cold start re-derived SDK type from fragile `hasPairedDevice()` checks; a single race or stale key corrupted the whole session.

**Fixes applied:**

- **`ios/JstyleBridge/JstyleBridge.m`**: Added `hasPairedDevice` native method (reads NSUserDefaults without attempting BT connection, mirroring V8Bridge's existing implementation). Added `forgetPairedDevice` native method (clears NSUserDefaults + disconnects if needed).

- **`src/services/JstyleService.ts`**: `hasPairedDevice()` now calls the new native method directly instead of `autoReconnect()`. `forgetPairedDevice()` now calls the new native `forgetPairedDevice` instead of `disconnect()`.

- **`src/services/UnifiedSmartRingService.ts`**:
  - Added `getPersistedSDKType()` private helper (reads `connectedSDKType` from AsyncStorage).
  - `setConnectedSDKType()` now persists the SDK type to AsyncStorage (`connectedSDKType` key).
  - `autoReconnect()` reads the persisted type at startup: if 'jstyle' is stored, the V8 `hasPairedDevice` check is skipped entirely (and vice versa). After any successful connection, the other SDK's paired device is cleared (fire-and-forget) to remove stale NSUserDefaults.
  - `forgetPairedDevice()` now clears both SDKs' native pairings unconditionally (not just the active SDK), preventing stale NSUserDefaults from surviving SDK switches.
  - `getPairedDevice()` uses the new `JstyleService.hasPairedDevice()` (NSUserDefaults-based) instead of `getPairedDevice()` (connection-based), and respects the persisted SDK type.

- **`src/context/OnboardingContext.tsx`**: `resetOnboarding()` now also calls `UnifiedSmartRingService.forgetPairedDevice()` to clear both SDKs' native NSUserDefaults on full reset.

**Files modified:**
- `ios/JstyleBridge/JstyleBridge.m`
- `src/services/JstyleService.ts`
- `src/services/UnifiedSmartRingService.ts`
- `src/context/OnboardingContext.tsx`

**Native rebuild required** (JstyleBridge.m has new exported methods).

---

## 2026-03-26: Fix Sleep Nap Misclassification (deriveFromRaw Oura-style nap guard)

**Change:** The V8/X3B ring was returning a single 63-min sleep record starting at 5:41 AM. `deriveFromRaw` was blindly picking it as "night sleep" (the old fallback chose the most-recent block regardless of start time), which caused `finalSleepData` to be non-null and suppressed the Supabase fallback that would have loaded the real prior-night sleep. The user saw a 63-min "night" and no nap card.

**Fix:** Applied Oura-style nap detection logic in `deriveFromRaw`: short blocks (< 180 min) that start during daytime hours (4 AM–8 PM) are classified as naps, not night sleep. `nightBlock` is set to `null` in that case, which propagates as `derived.night = null` → `finalSleepData` stays null → the existing Supabase fallback runs and loads the real night sleep. The daytime blocks are returned as `ringNaps` instead. Short blocks starting in nighttime hours (8 PM–4 AM) are still treated as disrupted night sleep.

**Files modified:**
- `src/hooks/useHomeData.ts` — `deriveFromRaw` return type changed to `{ night: SleepData | null; ringNaps: RingNapBlock[] } | null`; block selection logic replaced with Oura-style guard; null-night early-return path added; `blockToRingNap` helper extracted to eliminate duplicate `.map()` logic; double filter pass on `unifiedActs` combined into single `todayActs` array; `todayStartNullPath` redundant variable eliminated (reuses shared `todayStartMs`); `derived.night?.score` safe-access in fetchData log

**Key notes:**
- When `nightBlock` is null, `finalSleepData = derived.night` = null, which already triggers the Supabase fallback at the `!finalSleepData` check — no change needed in `fetchData()`
- Daytime threshold: `startHour >= 4 && startHour < 20` (4 AM–8 PM = nap-like)
- Short disrupted night sleep at e.g. 2 AM still works (startHour < 4, so `isNapLike = false` → kept as night)
- Long blocks (≥ 180 min) are unaffected — always picked as night via `nightCandidates`
- Supabase already had the session classified as `session_type='nap'` via DataSyncService (that was already correct); only the UI display was wrong
- `blockToRingNap` helper added after `RingNapBlock` interface — used by both the null-night path and the normal ringNap collection, eliminating ~18 lines of duplicate code

---

## 2026-03-26: Fix Connect Screen Hanging on "Connecting" Forever

**Change:** The onboarding connect screen froze indefinitely on the "connecting" step when pairing a new X3 ring. Root cause: `JstyleBridge.connectToDevice()` stores a `pendingConnectResolver` then calls `connectDevice:` on the native peripheral. When iOS CoreBluetooth skips the `didConnectPeripheral` callback (e.g. the peripheral was already connecting/connected from a background `autoReconnect` call), the resolver is never called and the JS promise hangs forever — even though the `onConnectionStateChanged: connected` event fires correctly.

**Fix:** Wrapped `JstyleBridge.connectToDevice()` in a `Promise.race` against the `onConnectionStateChanged` event listener with a 15-second timeout fallback. As soon as the native "connected" event fires, the promise resolves — regardless of whether `pendingConnectResolver` was called. Used a `try/finally` block with a `settled` guard to ensure the timer and event listener are always cleaned up regardless of which race leg wins, preventing listener leaks and orphaned timer rejections.

**Files modified:**
- `src/services/JstyleService.ts` — `connect()` method replaced simple `JstyleBridge.connectToDevice()` with a `Promise.race` + `onConnectionStateChanged` event + 15s timeout fallback, with cleanup via `try/finally`

**Key notes:**
- `withNativeTimeout()` helper in the same file was NOT used because this fix needs to race against an event, not just a bare timeout
- `settled` flag prevents double-resolve/reject if multiple race legs fire simultaneously
- `finally` block runs `clearTimeout(timer)` and `unsub?.()` in all paths (native resolves first, event fires first, or timeout fires)
- This same pattern may be worth applying to `V8Service.connect()` if similar hangs are observed with the band

---

## 2026-03-25: Fix V8 Sleep Score = 0 + Data Sync Error

**What:** V8 band sleep data was fetched successfully (1 record) but sleep score showed 0. Separately, cloud sync failed with "V8 data parse error".

**Root cause 1 — Sleep score 0:** `UnifiedSmartRingService.getSleepDataRaw()` wrapped V8's processed `SleepData` (with `deep`/`light`/`rem` fields) into `records`, but `deriveFromRaw()` expects raw SDK records with `arraySleepQuality`, `startTimestamp`, `sleepUnitLength`, `totalSleepTime`. All fields were missing → `deriveFromRaw` returned null → score 0.

**Fix:** Added `V8Service.getSleepDataRaw()` that returns raw sessions directly from native bridge in the format `deriveFromRaw` expects. Updated `UnifiedSmartRingService.getSleepDataRaw()` to use it.

**Root cause 2 — Sync error:** `DataSyncService.syncAllData()` called `getBattery()` and `getVersion()` outside individual try/catches. A `DataError_V8` from either call crashed the entire sync.

**Fix:** Wrapped both calls in their own try/catch so sync continues even if metadata fails.

**Root cause 3 — Cascading BUSY errors:** V8 `enqueueNativeCall` didn't call `cancelPendingDataRequest()` on timeout/BUSY. When HRV request hung (band had no data), the JS timeout fired but native bridge stayed stuck with `pendingDataType = 41` (HRVData_V8). Every subsequent BLE call saw "V8 bridge is busy" and failed.

**Fix:** Enhanced `enqueueNativeCall` in V8Service to call `V8Bridge.cancelPendingDataRequest()` on timeout or BUSY errors (mirroring the Jstyle pattern). After cancel, the native pending state is cleared and the next queued call can proceed.

**Files modified:** `src/services/V8Service.ts`, `src/services/UnifiedSmartRingService.ts`, `src/services/DataSyncService.ts`

---

## 2026-03-25: Remove Loading Spinner Between Splash and Home

**What:** Eliminated the `ActivityIndicator` spinner that briefly flashed after the native splash screen while auth/device state was resolving. Users now see only the native splash screen until the app knows where to navigate (login, onboarding, or home tabs).

**Root cause:** `app/_layout.tsx` was hiding the native splash as soon as fonts loaded, but `app/index.tsx` still needed time for `useOnboarding()` to resolve auth + device state — showing a spinner in the gap.

**Fix:** Deferred `SplashScreen.hideAsync()` from `_layout.tsx` to `index.tsx`, called only after `isLoading` is false and right before `router.replace()`. The index screen renders a blank view (invisible behind the native splash) instead of a spinner.

**Files:** `app/_layout.tsx`, `app/index.tsx`

---

## 2026-03-24: Apple Health Metrics Blended into Activity

**What:** HealthKit steps, active calories, and walking/running distance now contribute to the Activity tab's top-line metrics using `max(ring, healthKit)` — the same no-duplication approach Oura and Ultrahuman use. Previously, only the ring's passive step counter fed steps/calories/distance, even when Apple Watch had more accurate data.

**Key changes:**
- New `fetchActiveCaloriesData()` and `fetchDistanceData()` methods in HealthKitDataFetchers (queries `ActiveEnergyBurned` and `DistanceWalkingRunning` for today)
- HealthKit steps/calories/distance fetched in parallel with ring data (adds ~10-50ms)
- `max()` blending after ring data returns — picks higher source per metric
- Activity score recalculated after blending so it reflects the true step count
- Unified workout calories/distance (Strava + HK + ring, already deduplicated) also blended into hero gauge
- HealthKit-only fallback path (ring disconnected) now includes calories + distance
- Added step-to-distance estimation fallback (~0.75m/step) when no distance source available
- Distance display now shows 1 decimal for values under 10 km (was rounding to integer, showing 0 for short distances)

**Files created:** none

**Files modified:**
- `src/services/HealthKit/HealthKitDataFetchers.ts` — Added `fetchActiveCaloriesData()`, `fetchDistanceData()`, types
- `src/services/HealthKitService.ts` — Exposed new methods + exported types
- `src/hooks/useHomeData.ts` — Parallel HK fetches, max() blending, workout cal blending, score recalc, distance estimation fallback
- `src/screens/home/ActivityTab.tsx` — Distance display uses 1 decimal under 10km

---

## 2026-03-24: Battery Circular Indicator + Device Bottom Sheet

**What:** Replaced the battery percentage text in HomeHeader with a compact circular progress ring (28px SVG donut) containing the device icon. Tapping it opens a bottom sheet showing the full device card (image, name, MAC, battery %, connection status). Battery % also appears in the top-right corner of the device card on the Settings/Profile screen, fetched directly from the service on focus.

**Files created:**
- `src/components/home/DeviceSheet.tsx` — BottomSheetModal with device image, name, MAC, battery %, connected badge

**Files modified:**
- `src/components/home/HomeHeader.tsx` — Added `BatteryCircle` component, `onBatteryPress` prop, wrapped circle in TouchableOpacity
- `src/screens/NewHomeScreen.tsx` — Added `DeviceSheet` + `deviceSheetVisible` state, passes `onBatteryPress` to header
- `src/screens/SettingsScreen.tsx` — Added `deviceBattery` state fetched via `UnifiedSmartRingService.getBattery()` on focus, battery corner in device card

---

## 2026-03-24: V8 vs X3 SDK Comparison & Documentation

**What:** Performed a deep-dive comparison of the V8 BLE SDK (`V8 IOS/BleSDK/`) vs the X3 BLE SDK (`IOS (X3)/Ble SDK Demo/BleSDK/`) to understand what's new and what changes are needed for V8 band support.

**Key findings:**
- Both SDKs share identical architecture: same BLE UUIDs (`FFF0`/`FFF6`/`FFF7`), same singleton pattern, same pagination model (50 records, mode 0/2/0x99), same `DeviceData` response wrapper.
- V8 is a **superset** of X3 — all existing data types and formats are unchanged.
- V8 adds 5 new data types: **Sleep HRV**, **OSA (sleep apnea detection)**, **EOV (energy of vitality)**, **Continuous SpO2**, and **real-time ECG streaming during HRV**.
- Migration is mechanical: rename `_X3` → `_V8` suffixes on classes, structs, and enums.
- No breaking changes to existing data dictionary keys or array formats.

**Docs created:** `V8_VS_X3_SDK_COMPARISON.md` — full reference with API diffs, new data types, migration checklist.

---

## 2026-03-24: Add realtime HR streaming to V8 band (Live HR fix)

**What:** Live Heart Rate on the V8 band was broken — measurement started successfully but no HR samples came back. The V8 bridge only had manual measurement (single-source), while the X3/Jstyle bridge uses dual-source HR (realtime stream + manual measurement fallback).

**Fix:** Added `startRealTimeData` / `stopRealTimeData` to V8Bridge.m using the same `RealTimeDataWithType:1/0` command (identical BLE protocol). Wired it through V8Service → UnifiedSmartRingService → LiveHeartRateCard. The card now listens to `V8RealTimeData` (primary) and `V8MeasurementResult` (fallback), matching the Jstyle pattern.

**User impact:** Tapping the heart icon on the V8 band now streams live HR readings during the 30-second measurement window.

**Files modified:** `ios/V8Bridge/V8Bridge.m`, `src/services/V8Service.ts`, `src/services/UnifiedSmartRingService.ts`, `src/components/home/LiveHeartRateCard.tsx`

**Note:** Requires native Xcode rebuild.

---

## 2026-03-24: Fix V8 scan misclassifying X3B ring

**What:** The V8 BLE scanner was picking up the X3B ring and blindly tagging it as `sdkType: 'v8'`. When the user tapped to connect, it routed to V8Service instead of JstyleService — wrong SDK, broken connection.

**Fix:** Added name-based classification to the V8 discovery callback in `UnifiedSmartRingService.ts`. If the device name contains "x3", it's classified as `jstyle`/`ring`; otherwise it stays `v8`/`band`. This mirrors the logic already present in the Jstyle discovery path.

**User impact:** X3B ring now correctly connects via JstyleService. Two distinct scan entries appear: "FOCUS X3" (ring) and "FOCUS BAND" (V8 band).

**Files modified:** `src/services/UnifiedSmartRingService.ts`

---

## 2026-03-24: Fix Coach Page — Sleep Data, Illness Watch False Positives

**What:** Fixed several data accuracy issues on the Coach/Focus page:
1. **Sleep query now finds last night's data** — the sleep query was filtering `start_time >= midnight today`, but sleep sessions start the previous evening (9-11pm). Changed to look back to 6pm yesterday, so "last night's sleep" is correctly found.
2. **Temperature illness watch no longer false-positives** — raised thresholds from 0.3/0.8°C to 0.5/1.0°C, and removed `Math.abs()` so only temperature *increases* (not cold hands) trigger the signal.
3. **HRV suppression threshold relaxed** — changed from 10% below baseline to 15% below, reducing noise from normal daily HRV variability.
4. **Sleep minutes tracked in baselines** — added `sleepMinutes` to `FocusBaselines` so sleep scoring uses the user's actual sleep duration baseline instead of a hardcoded 480-minute benchmark.
5. **Cache key bumped** to `focus_state_cache_v2` to force fresh computation after these fixes.

**User impact:** Readiness card will now show real sleep scores instead of "no data". Illness Watch will stop showing false "WATCH" status from normal sensor noise. Pull-to-refresh on Coach page to see updated results.

**Files modified:** `src/hooks/useFocusData.ts`, `src/services/ReadinessService.ts`, `src/types/focus.types.ts`

---

## 2026-03-24: Google Profile Picture in Header Avatar

**What:** The home header avatar now shows the user's Google profile picture when signed in with Google OAuth. Added `avatarUrl` to `HomeData`, resolved from Supabase `user_metadata.avatar_url` or `user_metadata.picture` (set by Google OAuth). Passed through to `HomeHeader` which already supported the `avatarUrl` prop but was never receiving it.

**User impact:** Users who sign in with Google will see their Google profile picture in the top-left avatar circle instead of the default placeholder.

**Files modified:** `src/hooks/useHomeData.ts`, `src/screens/NewHomeScreen.tsx`

---

## 2026-03-24: Onboarding-style Device Card in Profile Screen

**What:** Replaced the generic `DeviceCard` component in the Profile/Settings screen with an onboarding-style centered layout. Now shows the product image (ring or band), device name, MAC address, and a white "Connected" pill badge — matching the visual style from the onboarding connect screen. Band vs ring image is auto-detected from `sdkType`/`deviceType`. Demo badge and action buttons (Find/Disconnect/Forget) preserved below.

**User impact:** The device section in the Profile page now has a polished, centered design with the product image prominently displayed, matching the first-time connect experience.

**Files modified:** `src/screens/SettingsScreen.tsx`

---

## 2026-03-24: Use DeviceCard Component in Profile Screen

**What:** Replaced the custom inline device display in the Profile/Settings screen with the reusable `DeviceCard` component (same one used in the connect/devices screen). This shows the device name, MAC address, version, and signal strength in a consistent card format.

**User impact:** The connected device section in the Profile page now matches the device card style from the connection flow — consistent look with signal strength indicator and "Connected" badge.

**Files modified:** `src/screens/SettingsScreen.tsx`

---

## 2026-03-24: Show User Name in Header When No Nickname Set

**What:** The overview header greeting now falls back to the user's full name or email prefix when no nickname (display_name) is set. Previously it showed an empty name.

**User impact:** Users who signed up without setting a nickname will see their name (or email username) in the "Good morning, ..." greeting instead of a blank.

**Changes:** Added `resolveUserName()` helper in `useHomeData.ts` with fallback chain: `display_name → full_name → name → email prefix`. Updated all 4 places that resolve userName.

**Files modified:** `src/hooks/useHomeData.ts`

---

## 2026-03-24: Route All Data Fetches Through UnifiedSmartRingService for V8 Band Support

**What:** Fixed V8 band data not appearing on home screen by routing all data fetches through `UnifiedSmartRingService` instead of calling `JstyleService` directly. Previously, sleep, HR, HRV, SpO2, and temperature data never showed for V8 bands because `useHomeData`, `useMetricHistory`, `TodayCardVitalsService`, `BackgroundSleepTask`, `DailyHeartRateCard`, and `LiveHeartRateCard` all called `JstyleService` directly — bypassing V8 routing.

**User impact:** V8 band users will now see all health data (sleep, heart rate, HRV, SpO2, temperature) on the home screen, metric history screens, and daily cards. Live heart rate measurement also works for V8 bands. Zero behavioral change for Jstyle ring users.

**Changes:**
- Added 10 new SDK-routing methods to `UnifiedSmartRingService`: `getSleepDataRaw`, `getContinuousHeartRateRaw`, `getSingleHeartRateRaw`, `getHRVDataNormalizedArray`, `getSpO2DataNormalizedArray`, `getTemperatureDataNormalizedArray`, `getSpO2DataRaw`, `startHeartRateMeasuring`, `stopHeartRateMeasuring`, `stopRealTimeData`
- V8 continuous HR adapter groups flat records into Jstyle-compatible `{date, arrayDynamicHR, startTimestamp}` shape
- `LiveHeartRateCard` now listens to both Jstyle and V8 native event emitters for measurement results
- Deduplicated `measureHeartRate` → delegates to `startHeartRateMeasuring`; `getHRVData`/`getTemperature`/`getSpO2` → delegate to `*NormalizedArray` methods; `isConnected` → single service selection; `setProfile` → passes profile directly

**Files modified:** `UnifiedSmartRingService.ts`, `useHomeData.ts`, `useMetricHistory.ts`, `TodayCardVitalsService.ts`, `BackgroundSleepTask.ts`, `DailyHeartRateCard.tsx`, `LiveHeartRateCard.tsx`

---

## 2026-03-24: Remove Nutrition Tab, Calorie Deficit Card, and Meal Actions

**What:** Removed three nutrition-related features that were placeholder/not ready: the Nutrition subtab from the home screen material top tabs (now 3 tabs: Overview, Sleep, Activity), the Caloric Deficit card from the Overview tab, and the "Log Meal" / "Capture Meal" action buttons from the add overlay. Also cleaned up all related dead code: `NutritionTab.tsx`, `CalorieDeficitCard.tsx`, `NutritionIcon.tsx` (deleted), meal mode from `LogEntrySheet`, `MealSubtype` type, meal timeline entries, nutrition gradient/theme entries, `AnimatedGradientBackground` nutrition background, orphaned route in today layout, and all nutrition/calorie/meal i18n keys from both `en.json` and `es.json`.

**Files deleted:** `NutritionTab.tsx`, `CalorieDeficitCard.tsx`, `NutritionIcon.tsx`
**Files modified:** `NewHomeScreen.tsx`, `OverviewTab.tsx`, `AddOverlayContext.tsx`, `home/index.ts`, `gradients.ts`, `icons/index.ts`, `AnimatedGradientBackground.tsx`, `LogEntrySheet.tsx`, `InsightCard.tsx`, `DailyTimelineCard.tsx`, `timeline.types.ts`, `useHomeData.ts`, `today/_layout.tsx`, `en.json`, `es.json`

---

## 2026-03-24: Troubleshoot Guide Bottom Sheet

**What:** Added a troubleshoot guide bottom sheet to the onboarding connect screen. Users can now tap "Troubleshoot guide" from the scanning screen, "No devices found" screen, or "Devices found" footer to open a dark glass bottom sheet with 5 numbered BLE troubleshooting tips. The sheet follows the same `@gorhom/bottom-sheet` pattern as FirmwareUpdateSheet, with full i18n support (English + Spanish).

**User impact:** When users can't find their ring/band during onboarding, they now get actionable troubleshooting steps (toggle Bluetooth, charge ring, keep close, restart ring, restart app) instead of a dead link.

**Files created:** `src/components/home/TroubleshootSheet.tsx`
**Files modified:** `app/(onboarding)/connect.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

## 2026-03-24: Full i18n Pass — Terminology + Score Messages + Health Tab + Workout Cards

**What:** Comprehensive i18n update across three phases:

1. **ring/anillo → device/dispositivo:** Updated ~35 English and ~35 Spanish i18n values across sync, onboarding, battery, readiness, sleep, activity, profile, explainer, and recovery timeline. Fixed 3 hardcoded strings in DevicesScreen.tsx, replaced hardcoded alert in connect.tsx with `t()` calls, and updated 3 troubleshoot tips.

2. **Score messages translated:** Moved all hardcoded English score interpretation strings from `useHomeData.ts` to i18n. Added 20 new keys under `overview.*` (score_msg, sleep_msg, activity_msg, insight). Updated `getScoreMessage`, `getSleepMessage`, `getActivityMessage` to accept `t` parameter. Fixed hardcoded sleep insight fallback in SleepTab.

3. **Health tab + workout cards + day navigator:** Translated "Ask Coach" button (MetricInsightCard), health tab card titles (Sleep/Activity/Recovery), score pills (OPTIMAL/GOOD/FAIR/NEEDS REST), sub-metric labels (Total Sleep, Resting HR, Resp. Rate, Steps, Calories, etc.), "Today"/"Yesterday" in detail screen day navigators. Added workout source labels (Health/Ring) to i18n. Fixed tempColor bug where translated status string was compared against English.

**User impact:** The entire app now renders in the user's selected language (EN/ES). No more hardcoded English in score cards, health tab, workout source badges, or detail screen navigators. Temperature status color now works correctly in Spanish.

**Files modified:** `en.json`, `es.json`, `DevicesScreen.tsx`, `connect.tsx`, `useHomeData.ts`, `OverviewTab.tsx`, `SleepTab.tsx`, `ActivityTab.tsx`, `MetricInsightCard.tsx`, `StyledHealthScreen.tsx`, `useMetricHistory.ts`

---

## 2026-03-24: `/remove-user` Slash Command

**What:** Created a new Claude Code slash command (`/remove-user <email|uuid>`) for permanently deleting a user and all their data from Supabase. The command looks up the user, shows data counts across all tables (HR readings, sleep sessions, steps, Strava, summaries, push tokens), requires typing the exact email to confirm, then deletes from `auth.users` which cascades to all dependent tables.

**User impact:** Admin can now quickly remove test accounts or handle account deletion requests without manually writing SQL.

**Files created:** `.claude/commands/remove-user.md`
**Files modified:** `.claude/projects/.../memory/MEMORY.md` (added command to index)

---

## 2026-03-24: Auth Screen — Language Selector + Button Icons

**What:** Added a language toggle pill (globe icon + "EN"/"ES") in the top-right corner of the auth screen, positioned with safe area insets. Tapping cycles between English and Spanish using the existing `useLanguage` hook. Also added `Ionicons` icons to both auth buttons — Google "G" logo on the Google button and mail icon on the Continue with Email button, each in a horizontal row layout.

**User impact:** Users can now switch language before signing in (previously only accessible from Settings). Auth buttons are more visually distinct with their respective icons.

**Files modified:** `src/screens/AuthScreen.tsx`

---

## 2026-03-24: Add V8Bridge to Xcode build — fix "V8Bridge not available" runtime error

**What:** The V8Bridge native module source files existed in `ios/V8Bridge/` but were not included in the Xcode project. At runtime, `NativeModules.V8Bridge` was `undefined`, causing V8 band connections to fail with "V8Bridge not available". Added all necessary entries to `project.pbxproj`: PBXBuildFile (V8Bridge.m in Sources, libBleSDK_V8.a in Frameworks), PBXFileReference (6 files), PBXGroup, root group reference, and HEADER_SEARCH_PATHS + LIBRARY_SEARCH_PATHS for both Debug and Release configurations.

**User impact:** FOCUS BAND (V8) devices can now connect after a native rebuild. Previously, scanning found them but tapping "Connect" failed immediately.

**Files modified:** `ios/SmartRing.xcodeproj/project.pbxproj`

**Note:** Requires native rebuild — Xcode workspace opened automatically.

---

## 2026-03-24: Fix SleepTab crash — `homeData.sleep.deep` undefined

**What:** `SleepTab` line 175 referenced `homeData.sleep.deep` which doesn't exist — `HomeData` has `lastNightSleep` (a `SleepData` interface), not `sleep`, and `SleepData` has no `deep` field. Fixed by computing deep sleep minutes from `sleep.segments` (filtering for `stage === 'deep'` and summing durations).

**User impact:** App no longer crashes when navigating to the Sleep tab.

**Files modified:** `src/screens/home/SleepTab.tsx`

---

## 2026-03-24: Gate useHomeData during onboarding — eliminate noisy startup logs

**What:** `HomeDataProvider` wraps the entire app (including onboarding), so `useHomeData` was mounting and running the full data sync pipeline (autoReconnect, 3 sleep retries, 232 HR records, HRV, steps, battery, Strava token queries, connection listeners) even while the user was on the welcome/connect screen. Added an `enabled` parameter to `useHomeData(enabled)` that gates all 8 useEffect hooks (cache loading, listeners, initial fetch). `HomeDataProvider` now passes `isAuthenticated && hasConnectedDevice` from `useOnboarding()`. Also fixed a stale `hasLoadedCache` ref bug (reset on disable so cache reloads on re-enable) and removed an unnecessary `homeData.refresh()` call in `success.tsx` (the initial-fetch effect auto-fires when `enabled` flips to true).

**User impact:** Clean console during onboarding — no more 100+ log lines of data fetching. App launches faster to the welcome screen since no BLE/network work runs until the user has authenticated and connected a device.

**Files modified:** `src/context/HomeDataContext.tsx`, `src/hooks/useHomeData.ts`, `app/(onboarding)/success.tsx`

---

## 2026-03-24: Fix device name display — both devices showing "Focus X3"

**What:** During BLE scanning, both the X3 ring and V8 band showed "Focus X3" as their name because the fallback was hardcoded. Now uses per-device `sdkType`/`deviceType` to show "FOCUS BAND" for V8 devices and "FOCUS X3" for Jstyle devices. Also fixed device image selection and connecting subtitle to use per-device checks instead of the route-level `isBand` param.

**User impact:** When scanning for a V8 band, discovered devices correctly show "FOCUS BAND" name and band image. Ring devices show "FOCUS X3" name and ring image.

**Files modified:** `app/(onboarding)/connect.tsx` (extracted `isBandDevice()` helper, fixed 4 fallback locations)

---

## 2026-03-24: Fix broken sleep score formula in buildBlockResult

**What:** The inline sleep score formula in `buildBlockResult()` (useHomeData.ts) was treating deep/REM percentages as raw 0-1 ratios instead of proper percentages, producing scores ~20-30 points lower than they should be (e.g. 66 instead of 88). Replaced with the existing, well-tested `calculateSleepScore()` utility from `utils/ringData/sleep.ts` which uses research-based stepped thresholds for duration, deep %, REM %, and efficiency. Also cleaned up: single-pass stage counting (was 4 separate filter passes), removed `as any` cast by providing complete `SleepInfo` shape.

**User impact:** Sleep scores now match the correct algorithm — users will see accurate scores reflecting their actual sleep quality.

**Files modified:** `src/hooks/useHomeData.ts` (import + buildBlockResult function)

---

## 2026-03-24: Replace "Resp" with "Deep Sleep" in Sleep MetricInsightCard

**What:** The sleep tab's MetricInsightCard previously showed "Resp" (respiratory rate), which always displayed `--` because the X3 ring doesn't provide that data. Replaced with Deep Sleep duration formatted as "Xh Ym", using the existing `sleep.deep` field and i18n key. Shows `--` when no sleep data is available.

**Files modified:** `src/screens/home/SleepTab.tsx` (1 line)

---

## 2026-03-23: V8 Smart Band Integration (Phases 1-3)

**What:** Full integration of the V8 smart band as a second device type alongside the Jstyle/X3 ring. Users can now choose between a ring or band during onboarding, and the app routes all BLE commands to the correct SDK.

**Phase 1 — Foundation:**
- **Type system** (`sdk.types.ts`): Added `DeviceType = 'ring' | 'band'`, expanded `SDKType` to `'jstyle' | 'v8'`, added 13 V8 sport types
- **Native bridge** (`ios/V8Bridge/V8Bridge.m`, `.h`): Full Obj-C native module mirroring JstyleBridge — scan, connect, disconnect, auto-reconnect, battery, firmware, steps, sleep, HR, HRV, SpO2, temperature, activity modes, manual measurement. Paginated data retrieval, BUSY guard, watchdog timer, reconnection timer.
- **V8 SDK files** (`ios/V8Bridge/`): Copied BleSDK_V8.h, BleSDK_Header_V8.h, DeviceData_V8.h, libBleSDK_V8.a (arm64)
- **V8Service.ts**: JS wrapper with timeout protection, serialized call queue, data normalization to existing types
- **UnifiedSmartRingService.ts**: Major rewrite — routes all data/connection methods via `isV8()` check, dual-SDK scan, sequential auto-reconnect

**Phase 2 — Onboarding:**
- **Device select screen** (`app/(onboarding)/device-select.tsx`): Two glass-morphism cards (ring/band) with stagger animations
- **Connect screen** updated to filter devices by `sdkType` based on `deviceType` param
- **useSmartRing.ts**: `isFocusDevice()` now matches both ring and V8 band patterns
- **i18n**: Added en/es keys for device selection and device slots

**Phase 3 — Storage & Data:**
- **storage.ts**: Added `PAIRED_RING_DEVICE`, `PAIRED_BAND_DEVICE`, `ACTIVE_DEVICE_TYPE` keys
- **Supabase migration**: `20260324_device_type_column.sql` adds `device_type` to hrv_readings, sleep_sessions, daily_metrics

**Code quality pass (/simplify):** Fixed 8 issues:
- Bug: `Number() ?? -1` → `|| -1` (NaN not caught by nullish coalescing)
- Bug: `disconnect()` was clearing pairing keys (breaks auto-reconnect)
- Bug: `getRespiratoryRateNightly` called Jstyle directly for V8 devices
- Bug: `getBloodPressure` made unnecessary BLE call for V8
- Hoisted activity mode map to module scope
- Deduplicated `getVersion` unwrap, image styles, time-sync code

**Files created:** `ios/V8Bridge/V8Bridge.h`, `ios/V8Bridge/V8Bridge.m`, `src/services/V8Service.ts`, `app/(onboarding)/device-select.tsx`, `supabase/migrations/20260324_device_type_column.sql`
**Files modified:** `src/types/sdk.types.ts`, `src/services/UnifiedSmartRingService.ts`, `src/hooks/useSmartRing.ts`, `app/(onboarding)/_layout.tsx`, `app/(onboarding)/connect.tsx`, `src/utils/storage.ts`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

**Note:** V8Bridge files and libBleSDK_V8.a still need to be added to the Xcode project. Native rebuild required.

---

## 2026-03-23: Remove Sync from Success + Restyle Integrations Screen

**Change:**
1. **Success screen**: Removed background sync logic (`getBattery`/`getSteps`) that was causing "Connection reset" errors. The home screen handles sync on its own.
2. **Integrations screen**: Full restyle to match onboarding design system — `LinearGradient` background (#000 → #5A112A), step bars at top (all 5 active), matching typography (32px/18px titles), glass-morphism integration cards, white primary "Continue" button with #5a112a text, underlined "Skip" link. Removed old green glow and teal color scheme.

**Files modified:** `app/(onboarding)/success.tsx`, `app/(onboarding)/integrations.tsx`

---

## 2026-03-23: Success Screen — Full Redesign to Match Figma

**Change:** Rewrote `success.tsx` to match Figma 543:683. Old screen had checkmark icon, stats card, and HR measurement UI. New screen:
- `LinearGradient` background (#000 → #5A112A), same as "Ring found" screen
- "All set" title + "{{name}} has connected successfully." subtitle, centered
- `all-set-mock.png` hand-with-ring image below text
- White "Continue" button (rounded 12px, #5a112a text)
- "Reset" underlined link below — shows confirmation alert, then navigates back to connect screen
- Background data sync (battery + steps) still runs silently on mount
- Added i18n keys: `title_all_set`, `subtitle_all_set`, `button_reset` (en + es)

**Files modified:** `app/(onboarding)/success.tsx`, `en.json`, `es.json`

---

## 2026-03-23: Blue Glow — Centered + No Clipping

**Change:** Moved blue radial glow out of `carouselWrap` into `devicesContent` as an absolute-positioned sibling. Centered horizontally (`left: 0`, same width as screen). Positioned at `top: 18%` of screen height to align with the ring. Increased SVG radial gradient radii from 44%/42% to 50%/50% for a smoother fade that doesn't clip at edges.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Ring Found — Gradient BG + Smaller/Higher Blue Glow

**Change:**
1. **Gradient background**: Replaced `connect-bg.jpg` `ImageBackground` with `LinearGradient` (`#000` at 39.14% → `#5A112A` at 95.91%). Removed unused `CONNECT_BG` constant.
2. **Blue glow**: Reduced from 1.4× to 1× screen width, repositioned upward (`top: -15%` of screen width) to align with the ring image.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Connect Button + Blue Glow Fix + Tighter Ring Layout

**Change:**
1. **"Connect to this device" button**: Added white primary button beneath device MAC in the card. Device card changed from `TouchableOpacity` to `View` — tap target is now the button only.
2. **Blue glow fix**: Removed `zIndex: -1` (unreliable in RN), added `pointerEvents="none"` so glow doesn't block touches.
3. **Tighter subtitle-to-ring distance**: Device card changed from `justifyContent: center` to `paddingTop: 16` so the ring sits closer to the subtitle.

**Files modified:** `app/(onboarding)/connect.tsx`, `en.json`, `es.json`

---

## 2026-03-23: Glow Alignment + Tighter Title/Subtitle Spacing

**Change:**
1. **Blue glow repositioned**: Moved inside `carouselWrap` so it's centered behind the ring image (was at screen bottom, now `top: 10%` within carousel, `zIndex: -1`).
2. **Title-subtitle gap reduced**: `scanTitle.marginBottom` 18→8, `welcomeTitle.marginBottom` 10→8 across all screens.
3. **Subtitle max-width**: Added `maxWidth: 260` to both `scanSubtitle` and `welcomeSubtitle` for tighter text wrapping on all screens.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Devices Found — Blue Radial Glow + Layout Tightening

**Change:** On the "Ring found" screen:
1. Removed `marginTop: 20` from `carouselWrap` so the FlatList sits closer to the subtitle.
2. Added a blue radial glow element beneath the carousel — SVG `RadialGradient` (#0042A8 center → transparent edge, 44%/42% radii) matching Figma node 543:656. Positioned absolutely at bottom, 1.4× screen width, offset downward.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Spinner Blur + No Devices Cleanup + Scan Again Button Style

**Change:** Three updates to the scanning/no-devices screens:
1. **Spinner blur fill**: Added `BlurView` (expo-blur, intensity 40, light tint) inside the spinner circle, matching the same width as the circle with no rounded corners — creates a frosted glass effect over the background.
2. **No devices screen**: Removed the spinner entirely. Now shows title + subtitle + "Scan again" primary button at the bottom.
3. **Scan again button**: Updated to `borderRadius: 20` to match the Figma reference (pill-like rounded corners).

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Scanning Screen — Add Ring Image + No Devices "Scan Again" Button

**Change:** Added `scan-ring.png` as a standalone image between the subtitle and troubleshoot footer on the scanning screen (positioned with `marginTop: auto` to fill available space). On the no-devices screen, replaced the troubleshoot text link with a full-width white "Scan again" primary button matching the welcome screen button style.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Fix Scanning Screen Layout — Remove scan-ring.png from Spinner

**Change:** Removed `scan-ring.png` `<Image>` from inside the spinner SVG wrapper in `renderSpinner()`. The ring-on-charger visual comes from the `scanning_bg.jpg` background image, not a separate element. Also removed the unused `SCAN_RING_IMG` constant and `scanRingImg` style. Spinner now correctly shows only the SVG circle + rotating arc glow.

**Files modified:** `app/(onboarding)/connect.tsx`

---

## 2026-03-23: Device Screens — Full Redesign (Scanning + Found + No Devices + Connecting)

**Change:** Complete overhaul of all post-welcome onboarding screens:

- **Scanning screen**: Full-screen `scanning_bg.jpg`, white circle ring (194px) with spinning arc segment (15% of circle, not a dot), `scan-ring.png` image centered inside the ring. Arc spins with bezier easing, 1s duration, 1.5s pause. Content staggers in. "Can't find your ring? Troubleshoot guide" footer.
- **Devices found screen** (Figma 543:654): `connect-bg.jpg` background, `connect-mock.png` ring image. Horizontal `FlatList` carousel with paging — if multiple rings found, shows right arrow hint and page indicator dots below. Device name + MAC displayed. "Not your ring? Scan again" footer links back to scanning.
- **No devices found screen**: Same `scanning_bg.jpg` + spinner as scanning screen. "Can't find your ring? Troubleshoot guide" footer with scan-again action.
- **Connecting screen**: Reuses scanning bg + spinner with connecting text.

**Code quality fixes (via /simplify):** Fixed spinner not animating on no-devices step (added `'devices'` to effect trigger), typed scroll event handler (removed `any`), moved `activeDeviceIndex` state and `onDeviceScroll` to top of component with other hooks.

**Files modified:** `app/(onboarding)/connect.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

## 2026-03-23: Scanning Screen — Full Redesign with Spinner Animation

**Change:** Scanning screen now uses full-screen `scanning_bg.jpg` background matching Figma frame 542:628. Old green pulse ripple animation replaced with a white circle ring (194px, 50% opacity stroke) and a spinning glow dot (white, blur 8) that orbits the ring — 1s spin with `Easing.bezier(0.4, 0, 0, 1)`, 1.5s pause between spins, via Reanimated `withRepeat`/`withSequence`. Content staggers in (title → subtitle → footer at 200/225/250ms). Bottom footer shows "Can't find your ring? Troubleshoot guide" placeholder link. Connecting screen reuses same background + spinner.

**Code quality fixes (via /simplify):** Removed unused `RING_CIRCUMFERENCE`, extracted `renderSpinner()` to eliminate copy-paste between scanning/connecting, fixed spinner restart flash on step transition, replaced spacer View with `marginTop: 'auto'`, extracted `fullScreen` style for three `ImageBackground` components.

**Files modified:** `app/(onboarding)/connect.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`

---

## 2026-03-23: Onboarding Welcome Screen — Layout + Animation Overhaul

**Change:** Welcome screen now has full-screen background (`welcome-bg.jpg`) covering the entire device, with title+subtitle centered vertically and the "Start scan" button pinned near the bottom — matching the attached design reference. Switched from RN `Animated` stagger to `react-native-reanimated` pattern (sparring app style): `useSharedValue` for opacity (0→1) + translateY (80→0), `withDelay` + `withTiming` with `Easing.bezier(0.4, 0, 0, 1)`, 600ms duration, tight stagger delays (200/225/235ms).

**CLAUDE.md updates:** Added Animations section documenting the Reanimated stagger pattern as the project standard.

**Code quality fixes (via /simplify):** Fixed variable shadow (`t` → `timer`), moved `resizeMode` from inline style to proper prop (removed `as any` cast), added unmount cleanup for scan timeout ref.

**Files modified:** `app/(onboarding)/connect.tsx`, `CLAUDE.md`

---

## 2026-03-23: Auth Screen — SVG Logo + Onboarding Background

**Change:** Replaced the hardcoded "FOCUS" text on the auth landing screen with an SVG `FocusLogo` component matching the brand wordmark from Figma. Swapped background image from `splash.jpg` to `onboarding-bg.jpg`.

**Files created:** `src/components/common/FocusLogo.tsx` — Reusable SVG logo component with configurable `width`, `height`, and `color` props
**Files modified:** `src/screens/AuthScreen.tsx`

---

## 2026-03-23: Baseline Mode for New Users

**Change:** New users now see a "Building Your Baseline" experience instead of empty/random scores. The app needs ~3 days of sleep + HR + HRV data before composite scores (readiness, strain, sleep score) become meaningful. During baseline mode: Overview tab shows a progress card with per-metric readiness indicators, Sleep tab shows a "X/3 nights tracked" pill instead of the score gauge, and the HomeHeader shows a "Day X/3" chip. When baseline completes, a celebration overlay appears. Existing users with sufficient data auto-complete silently.

**Files created:**
- `src/types/baseline.types.ts` — `BaselineModeState`, `BaselineMetrics`, `MetricBaselineProgress` types
- `src/services/BaselineModeService.ts` — Pure computation (`computeBaselineState`), persistence (`loadBaselineCompletedAt`, `persistBaselineCompletion`)
- `src/context/BaselineModeContext.tsx` — React context + `useBaselineMode()` hook, derived from FocusBaselines + MetricBaselines
- `src/components/home/BaselineProgressCard.tsx` — Glass card with animated progress ring, 6 metric rows with day-dot progress bars
- `src/components/home/BaselineCompleteOverlay.tsx` — Full-screen celebration overlay with check animation, auto-dismiss after 4s
- `supabase/migrations/20260323_baseline_completed_at.sql` — Adds `baseline_completed_at` column to `user_profiles`

**Files modified:**
- `app/_layout.tsx` — Added `BaselineModeProvider` to provider tree
- `src/screens/home/OverviewTab.tsx` — Replaced `isOnboarding` logic with `useBaselineMode().isInBaselineMode`, swapped welcome section for `BaselineProgressCard`
- `src/screens/home/SleepTab.tsx` — Added baseline-aware rendering: shows tracking pill when sleep baseline not ready
- `src/components/home/HomeHeader.tsx` — Consumes `useBaselineMode()` directly, shows teal "Day X/3" chip during baseline
- `src/screens/NewHomeScreen.tsx` — Renders `BaselineCompleteOverlay`
- `src/i18n/locales/en.json` + `es.json` — Added `baseline.*` keys (17 strings each)

**Also in this session:**
- Fixed onboarding connect.tsx to use i18n translations (was hardcoded English)
- Fixed duplicate `onboarding` key in en.json/es.json (JSON last-key-wins was losing `welcome_title`/`welcome_subtitle`/`tip`)

**Code quality fixes (via /simplify):**
- Removed `isLoading`/`isSyncing` from context deps (caused 4+ redundant recomputes per sync)
- Added `statesAreEqual` guard + `useMemo` on context value to prevent unnecessary re-renders
- Parallelized baseline storage reads with `Promise.all`
- Added race condition guard (`cancelled` flag) on async recompute
- Fixed mutation of pure function return — now uses object spread
- Animation cleanup: reset values on re-entry, track composite refs, stop on unmount
- Removed parameter sprawl on HomeHeader (3 props → uses hook directly)
- Aligned glass card style with design system conventions

---

## 2026-03-23: Unified Activity Feed (Apple Health + Strava + Ring)

**Change:** Merged workouts from Apple Health, Strava, and the ring into a single deduplicated activity feed. Apple Health workouts are now fetched via `queryWorkoutSamples` (7-day window). Strava syncs in the background on every app load (non-blocking). Activities are deduplicated by time overlap (>70%) + sport category, with Strava winning when both sources have the same workout.

**Files created:**
- `src/types/activity.types.ts` — `UnifiedActivity` and `HKWorkoutResult` interfaces
- `src/services/HealthKit/HealthKitWorkoutFetcher.ts` — Fetches workouts from Apple Health via `queryWorkoutSamples`, maps 30+ `WorkoutActivityType` enum values to normalized sport strings, generates time-of-day workout names
- `src/services/ActivityDeduplicator.ts` — Pure merge+dedup service: priority-based (Strava > Apple Health > Ring), 70% time-overlap threshold with sport category matching, sport color/icon mapping for 25+ activity types

**Files modified:**
- `src/services/HealthKitService.ts` — Added `fetchWorkouts()` and `fetchWeekWorkouts()` methods, composing the new `HealthKitWorkoutFetcher`
- `src/services/StravaService.ts` — Added `backgroundSync(days)` public method: loads tokens if needed, syncs recent activities, never throws (safe for fire-and-forget)
- `src/hooks/useHomeData.ts` — Fire-and-forget background Strava sync at top of `fetchData()`, HealthKit workout fetch in parallel with Supabase queries, `mergeActivities()` call to build `unifiedActivities` on `HomeData`. Added `unifiedActivities: UnifiedActivity[]` to HomeData interface.
- `src/components/home/DailyTimelineCard.tsx` — Replaced separate Strava + ring activity rendering with unified activities. Added `iconOverride`/`colorOverride` on timeline events so each activity renders with its sport-specific icon and color (not hardcoded Strava orange). Removed now-unused `stravaActivities` prop and `StravaActivitySummary` import.
- `src/screens/home/OverviewTab.tsx` — Passes `unifiedActivities` to DailyTimelineCard, removed `stravaActivities` prop
- `src/screens/home/ActivityTab.tsx` — New `UnifiedWorkoutCard` component with sport icon, name, meta, and source badge (Strava/Health/Ring). Replaced old Strava-only fallback with unified activities list. Deleted dead `StravaWorkoutCard` and `formatStravaWorkoutMeta`. Uses `formatSleepDuration` from utils for duration formatting.

**Code quality fixes (via /simplify):**
- Removed dead `stravaActivities` prop from DailyTimelineCard (was unused after unified switch)
- Deleted dead `StravaWorkoutCard`, `formatStravaWorkoutMeta`, and unused `StravaActivitySummary` import from ActivityTab
- Fixed duplicate ring timeline entries (ring sessions were rendered twice: once raw, once via unified)
- Fixed hardcoded Strava orange icon/color for non-Strava activities in timeline — now uses per-activity sport color
- Typed `ringToUnified` parameter as `X3ActivitySession` instead of `any`
- Reused `formatSleepDuration` utility instead of inline duration formatting
- Capped HealthKit workout query to 50 results to bound memory for heavy auto-detection users

**Key notes:**
- Background Strava sync fires before the Supabase query, so newly-synced activities appear on next refresh (not current load) — acceptable trade-off for non-blocking behavior
- Dedup uses sport categories (e.g., Run+TrailRun both map to "run") so trail runs from Strava won't duplicate with generic runs from Apple Health
- Apple Health workout types mapped: running, cycling, hiking, swimming, walking, yoga, pilates, HIIT, weight training, boxing, rowing, climbing, dance, and 15+ more
- Source badge on workout cards: orange "Strava", pink "Health", teal "Ring"
- Native rebuild required for HealthKit workout queries to work (new `queryWorkoutSamples` API)

---

## 2026-03-23: SyncStatusSheet Connection Timeout

**Change:** Added a 40-second timeout to the sync bottom sheet's "connecting" phase. If the ring doesn't connect within 40s, the sheet shows "Could not connect" with a teal "Find Rings" button that navigates to the onboarding ring scan screen. Sheet height and button fade in smoothly using Reanimated animations.

**Code quality fixes (via /simplify):** Eliminated redundant `connectionTimerRef` (timeout ID lives in effect closure only), guarded `setConnectionTimedOut(false)` with functional updater to prevent spurious re-renders on normal phase transitions, animated sheet height expansion and button opacity for smooth UX.

**Files modified:** `src/components/home/SyncStatusSheet.tsx`, `src/screens/NewHomeScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`
**New i18n keys:** `sync.connection_timeout`, `sync.find_rings`

---

## 2026-03-23: Auth Email Bottom Sheet — Figma White Theme + Dynamic Height

**Change:** Redesigned the "Continue with Email" bottom sheet to match Figma frame 524:548. White-themed sheet with `enableDynamicSizing` (height adapts to content per mode), gray-bordered inputs, black submit button, and "First time? Create an account" inline link pattern. Sheet title shows "Continue with Mail" in sign-in mode. Built-in keyboard avoidance via `keyboardBehavior="interactive"`.

**Code quality fixes (via /simplify):** Fixed `renderBackdrop` typing (`any` → `BottomSheetBackdropProps`), added `disabled={isSubmitting}` to mail button (UX bug — was clickable during Google sign-in), replaced triple `{mode === X && ...}` conditionals with `SHEET_TITLES`/`SUBMIT_LABELS` lookup maps, extracted `PLACEHOLDER_COLOR` constant (was hardcoded 5×), replaced magic `borderRadius: 12` and `fontSize: 16` with theme tokens `borderRadius.md`/`fontSize.lg`.

**Files modified:** `src/screens/AuthScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`
**New i18n keys:** `auth.first_time`, `auth.already_have_account`

---

## 2026-03-23: Auth Screen Redesign — Figma Parity

**Change:** Redesigned AuthScreen to match Figma design. Full-screen `splash.jpg` background image, large "FOCUS" branding text, two white rounded buttons ("Continue with Google" / "Continue with Mail"), and "Contact us" link at bottom. Email/password form now opens in a `@gorhom/bottom-sheet` instead of inline ScrollView. Google sign-in continues directly from the landing screen.

**Code quality fixes (via /simplify):** Removed unused `Dimensions`/`width`/`height` imports, memoized `snapPoints` with `useMemo`, added `pressBehavior="close"` to backdrop, replaced hardcoded `#1A1A2E` with `colors.surface`, added `finally` blocks for consistent `isSubmitting` cleanup in all auth handlers.

**Files modified:** `src/screens/AuthScreen.tsx`, `src/i18n/locales/en.json`, `src/i18n/locales/es.json`
**New i18n keys:** `auth.button_continue_google`, `auth.button_continue_mail`, `auth.login_trouble`, `auth.contact_us`

---

## 2026-03-22: Apple Health Full Rewrite — New Architecture Compatible

**Change:** Replaced `react-native-health` (Obj-C, incompatible with RN 0.81 New Architecture) with `@kingstinct/react-native-healthkit` v13 (Nitro Modules). Rewrote HealthKitService as a modular facade with 4 sub-services. Fixed broken onboarding connect, redesigned Apple Health screen with glassmorphism, added HealthKit as fallback data source when ring is disconnected, and added full i18n support (en + es).

**Files created:**
- `src/services/HealthKit/HealthKitPermissions.ts` — Availability checks and authorization requests using v13 probe-read pattern
- `src/services/HealthKit/HealthKitDataFetchers.ts` — Heart rate, steps, HRV, SpO2 fetching with step deduplication (Apple Watch > iPhone source precedence)
- `src/services/HealthKit/HealthKitSleepProcessor.ts` — Sleep data processing: 6pm→12pm query window, session grouping (90min gap), best-session scoring, stage breakdown
- `src/services/HealthKit/HealthKitSubscriptions.ts` — Real-time HealthKit change listeners for HR, steps, sleep
- `app/(tabs)/settings/apple-health.tsx` — Route shell for Apple Health detail screen
- `.claude/agents/coordinator.md` — Orchestrator agent (opus)
- `.claude/agents/researcher.md` — Read-only investigation agent (haiku)
- `.claude/agents/implementer.md` — Code writing agent (sonnet)
- `.claude/agents/reviewer.md` — Quality review agent (sonnet, runs /simplify)

**Files modified:**
- `app.config.js` — Swapped `react-native-health` plugin for `@kingstinct/react-native-healthkit` with NSHealth descriptions
- `package.json` / `package-lock.json` — Replaced `react-native-health` with `@kingstinct/react-native-healthkit`
- `src/services/HealthKitService.ts` — Complete rewrite as facade composing 4 sub-services. Singleton with initialize/isConnected/fetchAll/checkPermissions/setupSubscriptions/cleanup. Probes permissions before re-requesting auth dialog on cold start.
- `src/hooks/useHealthKit.ts` — Simplified to use new HealthKitService. `isAvailable` is now a module-level constant (not state). Added subscription cleanup on unmount.
- `src/screens/AppleHealthScreen.tsx` — Full redesign: glassmorphism cards, Ionicons, all strings via `t()`. Removed dead `!isAvailable` branch (unreachable after Platform guard). Uses `formatSleepDuration` from utils instead of inline formatting.
- `app/(onboarding)/integrations.tsx` — All hardcoded strings replaced with `t('integrations.*')`. Connect flow calls working HealthKitService.initialize().
- `src/screens/SettingsScreen.tsx` — Fixed hardcoded "Apple Health" → `t('profile.account.apple_health')`
- `src/hooks/useHomeData.ts` — Added HealthKit fallback when ring disconnected: fills sleep (efficiency/duration/bed-wake), steps, HRV from Apple Health. Fixed operator precedence bug in permission check. Uses `formatSleepDuration` utility.
- `src/i18n/locales/en.json` — Added ~40 keys: `integrations.*` (11), `apple_health.*` (30+), `profile.account.apple_health`
- `src/i18n/locales/es.json` — Matching Spanish translations for all new keys
- `CLAUDE.md` — Added mandatory `/simplify` code quality gate rule

**Key notes:**
- **Native rebuild required** — package swap from `react-native-health` to `@kingstinct/react-native-healthkit` requires `pod install` + Xcode rebuild
- v13 API uses `filter: { date: { startDate, endDate } }` pattern (not `{ from, to }`)
- `requestAuthorization({ toRead: [...] as any })` — type cast needed because library's string union type is narrower than the identifiers we use
- HealthKit subscriptions return `{ remove: () => boolean }`, not `() => void`
- Step dedup uses O(n) sorted-cursor approach instead of O(n²) overlap scan
- Sleep processor sorts once in `groupIntoSessions` and passes sorted arrays downstream (no redundant re-sorts)
- AsyncStorage key `apple_health_connected_v1` persists connection state across app restarts
- `/simplify` review completed: fixed 8 issues (dead code, reuse of `formatSleepDuration`, constant vs state, subscription leak, O(n²) dedup, redundant sorts, operator precedence, unused setter)

---

## 2026-03-22: Onboarding Welcome State for New Users

**Change:** When a user has no sleep record yet (new user, first day with the ring), the Overview tab now shows a "Welcome to Focus" banner instead of the recovery score gauge, metrics card, and sleep card. The banner explains what to expect and prompts the user to wear the ring overnight. Once sleep data exists, the normal score view appears automatically.

**Files modified:**
- `src/screens/home/OverviewTab.tsx` — Added `isOnboarding` derived boolean (`!isLoading && !isSyncing && !sleepScore && timeAsleepMinutes === 0`). Conditionally renders either the welcome banner or the existing gauge+metrics+sleep card block. Welcome banner uses: teal radial gradient glow SVG (absolute positioned, `react-native-svg`), large title, subtitle, `RingIcon` badge in a teal-tinted circle, and a tip pill. Removed `<Text>◯</Text>` placeholder in favour of `RingIcon` component (simplify pass). Simplified redundant `(sleepScore === 0 || !sleepScore)` to `!sleepScore`.
- `src/i18n/locales/en.json` — Added `onboarding` namespace with keys: `welcome_title`, `welcome_subtitle`, `tip`.
- `src/i18n/locales/es.json` — Added same keys in natural Latin American Spanish.

**Key notes:**
- Detection is purely client-side: no separate onboarding flag or Supabase column needed.
- HR chart, calorie deficit, and daily timeline cards still render during onboarding (they may have day-1 step/HR data).
- Banner disappears automatically once the first night's sleep syncs — no user action required.
- `isOnboarding` is `false` while loading or syncing, preventing a flash of the welcome screen on subsequent opens.

---

## 2026-03-22: Apple Health / HealthKit Integration — Implementation Plan

**Change:** Produced a detailed implementation plan to fix all 8 Apple Health issues across the app. Key research findings:
- `react-native-health` v1.7.0 (Podfile.lock) does not support New Architecture (enabled by default in RN 0.81). This is why `AppleHealthKit = null` — the module fails to load.
- Recommended replacement: `@kingstinct/react-native-healthkit` v13.2.3 — Nitro Modules based, full New Arch support, actively maintained.
- Entitlements (`com.apple.developer.healthkit`) and Info.plist keys are already in place — no entitlement work needed.
- Zero i18n keys exist for Apple Health or integrations screens — ~30 keys need adding in en.json/es.json.
- Plan covers 8 phases: package swap, service rewrite, onboarding fix, health screen redesign, settings fix, home screen data merge (read HealthKit + write ring data back), hook cleanup, and app.config.js update.
- Data priority follows Oura/Ultrahuman pattern: ring data is primary, HealthKit fills gaps, ring data is written back to Apple Health for other apps.

**No code changes — plan only.**

---

## 2026-03-22: Firmware Update Prompt (Informational Bottom Sheet)

**Change:** Added a dismissible bottom sheet that appears once per 72 hours when the ring's firmware is behind the latest known version stored in Supabase.

- **`supabase/migrations/20260321_app_config.sql`**: New `app_config` table (key/value store). Seeded with `latest_firmware_version = '1.0.0'`. Applied to production via MCP.
- **`src/utils/storage.ts`**: Added `FIRMWARE_UPDATE_DISMISSED_AT` constant and added key to `STORAGE_KEYS`.
- **`src/services/FirmwareUpdateService.ts`**: New service — `checkShouldShow(currentVersion)` fetches latest version from Supabase `app_config`, falls back to `'1.0.0'`, compares semver, and checks 72h dismiss cooldown in AsyncStorage. `markDismissed()` saves timestamp.
- **`src/components/home/FirmwareUpdateSheet.tsx`**: New `BottomSheetModal` (same pattern as `ExplainerSheet`). Shows ring emoji icon, current and latest version strings, and an "Update Later" button. Fully dismissible — no blocking.
- **`app/(tabs)/_layout.tsx`**: After ring connects (`hasConnectedDevice`), runs firmware check once per session via `useRef` guard. If update available, renders `FirmwareUpdateSheet`; dismiss calls `markDismissed()` and hides the sheet.

**User-visible behavior:** When a ring is connected and its firmware is behind, a bottom sheet slides up from the bottom instructing the user to update via the Jstyle companion app. Dismissing saves a 72-hour cooldown — the sheet won't reappear until the cooldown expires.

---

## 2026-03-22: Apple Health Connect — Onboarding + Profile

**Change:** Made Apple Health connection functional in both the onboarding integrations screen and the profile page.

- **`HealthKitService.ts`**: Re-enabled — now imports `react-native-health` (lazily, iOS-only). Added `isConnected()` async method that reads from AsyncStorage (`apple_health_connected_v1`). `initialize()` now persists `true` to AsyncStorage on success. `checkIsAvailable()` restores initialized state from storage on app restart.
- **`app/(onboarding)/integrations.tsx`**: Apple Health card is now a tappable `TouchableOpacity` (was a disabled `View` with "Soon" badge). Tapping calls `HealthKitService.initialize()`, which shows the iOS HealthKit permissions sheet. Shows spinner while connecting, teal checkmark when connected, red "Connect" chip when not connected.
- **`src/screens/SettingsScreen.tsx`**: Account section now has an Apple Health row (below Strava). Tapping navigates to `/(tabs)/settings/apple-health`. Row shows "Connected" in green or "Not connected" in muted text. Status refreshes on screen focus via `useFocusEffect`.
- **`app/(tabs)/settings/apple-health.tsx`**: New route shell — renders existing `AppleHealthScreen`.

## 2026-03-22: Background Sleep Notification (wake time + 30 min)

**Change:** Replaced the foreground-only "Sleep Analysis Ready" notification (which fired instantly when the user opened the app) with a background-fetch-powered system that detects wake time from sleep data and schedules the notification for 30 minutes after waking up. Works even when the app is closed.

**Files created:**
- `src/services/BackgroundSleepTask.ts` — Background fetch task (`BACKGROUND_SLEEP_CHECK`): connects to ring via BLE in background, fetches sleep data, extracts latest wake time (≥3hr blocks, after 7 AM only), schedules local notification for wakeTime + 30 min via `Notifications.scheduleNotificationAsync`. Includes foreground fallback (`maybeSendSleepNotificationFromForeground`) for when background fetch didn't fire.

**Files modified:**
- `app.config.js` — Added `'fetch'` to `UIBackgroundModes` (alongside `bluetooth-central`)
- `ios/SmartRing/Info.plist` — Added `fetch` to `UIBackgroundModes` array
- `app/_layout.tsx` — Added top-level import of `BackgroundSleepTask` (task must be defined before app renders)
- `src/services/NotificationService.ts` — Removed `maybeSendSleepReadyNotification()` (old immediate-fire approach). Added `registerBackgroundSleepTask()` call in `setup()`.
- `src/screens/NewHomeScreen.tsx` — Replaced `NotificationService.maybeSendSleepReadyNotification()` with `maybeSendSleepNotificationFromForeground(homeData.lastNightSleep.wakeTime)` as foreground fallback.

**Dependencies added:**
- `expo-background-fetch`
- `expo-task-manager`

**Key notes:**
- 7 AM guard: wake times before 7 AM are ignored to avoid false triggers from fragmented sleep (user wakes at 3 AM, goes back to sleep)
- Always uses the **latest** wake time from night-length blocks (≥180 min)
- Once-per-day dedup via AsyncStorage key `@focus_sleep_notif_scheduled_v2`
- Background task runs in 5 AM – 2 PM window only
- BLE stays connected in background thanks to `bluetooth-central` mode — ring must be on wrist
- Requires native rebuild (`/xcode-rebuild`) — `UIBackgroundModes` changed in Info.plist

---

## 2026-03-21: Fix Ring Disconnected After First Onboarding

**Change:** The home screen showed no ring data after completing onboarding for the first time. Ring appeared connected but all metrics (sleep, HR, steps, HRV) were empty. On app restart everything worked fine.

**Root cause:** `HomeDataProvider` runs `fetchData('initial')` at app start — before onboarding. With no paired ring, `autoReconnect()` fails and the provider exits early with `isRingConnected: false`. When the ring connects during onboarding, `onConnectionStateChanged` fires and calls only `refreshMissingCardData` (vitals only), never a full `fetchData`. So by the time the user reaches the home screen, all metrics are empty.

**Fix:** Single change in `success.tsx` — import `useHomeDataContext` and call `void homeData.refresh()` (fire-and-forget) inside `handleContinue` before navigating. This kicks off a full ring data sync while the user is on the integrations screen. By the time they reach the home screen, data is loading or already populated.

**Files modified:**
- `app/(onboarding)/success.tsx` — Added `useHomeDataContext` import + hook call + `void homeData.refresh()` in `handleContinue`

---

## 2026-03-21: TestFlight Build 1.0.4 (build 5)

**Change:** Bumped version to 1.0.4 (build 5) and successfully uploaded to App Store Connect. Fixed several blocking issues discovered during the process: wrong bundle ID in Release config, expired Xcode sessions, and a restricted entitlement.

**Files modified:**
- `app.config.js` — Version bumped `1.0.3` → `1.0.4`, buildNumber `4` → `5`
- `ios/SmartRing.xcodeproj/project.pbxproj` — `MARKETING_VERSION` → `1.0.4`, `CURRENT_PROJECT_VERSION` → `5`; Release config `PRODUCT_BUNDLE_IDENTIFIER` fixed from `com.focusring.app.dev` → `com.focusring.app`, `PRODUCT_NAME` fixed from `FocusDEV` → `Focus`
- `ios/SmartRing/SmartRing.entitlements` — Removed `com.apple.developer.healthkit.access` (health-records requires special Apple approval); changed `aps-environment` from `development` → `production`
- `ios/ExportOptions.plist` — Added `authenticationKeyPath`, `authenticationKeyID`, `authenticationKeyIssuerID` for App Store Connect API key auth (bypasses expired Xcode sessions permanently)

**Key notes:**
- App Store Connect API key `A93H45TYS3` is now stored at `~/.appstoreconnect/private_keys/AuthKey_A93H45TYS3.p8` — future builds use this instead of Xcode account sessions which expire
- Issuer ID: `befadbf1-4e14-4f57-b39f-0ca58dce537b`
- Export must use `-allowProvisioningUpdates` flag so xcodebuild can register HealthKit + Push Notifications capabilities automatically
- The Release config in `project.pbxproj` was previously hardcoded to `.dev` bundle ID — this caused the first archive to upload the wrong app
- `/testflight` skill updated to reflect all of the above fixes

---

## 2026-03-20: Onboarding — Integrations Step (Strava + Apple Health)

**Change:** Added a new `/(onboarding)/integrations` screen that appears after the ring connection success screen. Users can connect Strava (and eventually Apple Health) before entering the main app. Strava is fully functional using the existing `stravaService.connect()` flow. Apple Health shows as "Coming soon" on iOS.

**Flow:** `connect.tsx` → `success.tsx` → **`integrations.tsx`** → `/(tabs)`

**Files created:**
- `app/(onboarding)/integrations.tsx` — New screen: Strava card (orange, tappable, shows connected checkmark after OAuth), Apple Health card (iOS only, disabled/soon). "Continue" and "Skip for now" both call `completeOnboarding()` then navigate to tabs.

**Files modified:**
- `app/(onboarding)/_layout.tsx` — Registered `integrations` route in Stack
- `app/(onboarding)/success.tsx` — `handleContinue` now routes to integrations instead of calling `completeOnboarding` + `/(tabs)` directly. `completeOnboarding` removed from destructure.

**Key notes:**
- `stravaService.reload()` is called on mount to check existing connection state from DB
- Apple Health card only renders on `Platform.OS === 'ios'` and is styled as disabled (opacity 0.5)
- The integrations screen is where `completeOnboarding()` is now called (was previously in success.tsx)

---

## 2026-03-20: Auth — Replace GitHub OAuth with Google only

**Change:** Removed GitHub OAuth and replaced with Google OAuth only. Fixed OAuth redirect URI scheme mismatch (`com.smartring.testapp` → `smartring`). Strava is NOT an auth provider — it's handled via the existing data integration flow in the new onboarding integrations step instead.

**Files modified:**
- `src/services/AuthService.ts` — Removed `signInWithGitHub`. Added shared `oAuthSignIn()` helper (fixes redirect scheme), `signInWithGoogle()`. URL token extraction handles both query params and URL fragment.
- `src/hooks/useAuth.ts` — Replaced `signInWithGitHub` with `signInWithGoogle`.
- `src/screens/AuthScreen.tsx` — Replaced GitHub button with Google button (Google multicolor icon, white border).
- `src/i18n/locales/en.json` / `es.json` — Added `auth.button_sign_in_google`.

**Key notes:**
- Redirect URI: `smartring://auth/callback` (was `com.smartring.testapp://auth/callback`)
- Supabase dashboard prerequisite (manual): Enable Google provider (Client ID + Secret) under Authentication → Providers. Redirect URL: `https://pxuemdkxdjuwxtupeqoa.supabase.co/auth/v1/callback`

---

## 2026-03-20: Fix xcodebuild "Workspace does not exist" (Recurring Bug)

**Change:** Documented and fixed a recurring xcodebuild failure caused by using relative paths. xcodebuild resolves paths relative to its own working directory, not the shell's, so relative paths like `ios/SmartRing.xcworkspace` silently resolve to the wrong location.

**Fix:** Always use absolute paths for all xcodebuild arguments.

**Files modified:**
- `CLAUDE.md` — Added "TestFlight / xcodebuild Rule" section with the absolute-path requirement and correct example
- `~/.claude/commands/testflight.md` — Added explicit RULE: "ALWAYS use absolute paths"; removed `xcpretty` pipe (not installed); steps 8 & 9 already use absolute paths after the earlier fix in this session

**Key notes:**
- Root cause: xcodebuild ignores the shell `cd` and resolves relative paths from an internal working directory
- Error message: "Workspace SmartRing.xcworkspace does not exist at SmartRingExpoApp/ios/SmartRing.xcworkspace"
- All four xcodebuild path args must be absolute: `-workspace`, `-archivePath`, `-exportPath`, `-exportOptionsPlist`

---

## 2026-03-19: Remote Push Notifications via Expo Push API

**Change:** Added full remote push infrastructure — device registers for an Expo push token on first authenticated launch and saves it to Supabase, a deployed Edge Function accepts manual or server-triggered pushes, and `_layout.tsx` handles notification taps to deeplink into any sub-tab (including when app is killed).

**Files created:**
- `supabase/migrations/20260319_push_tokens.sql` — `push_tokens` table (user_id, token, platform), RLS policy (users manage own tokens), auto-updated `updated_at` trigger. Applied to production via `npx supabase db push`.
- `supabase/functions/send-notification/index.ts` — Deno edge function deployed to `pxuemdkxdjuwxtupeqoa`. Accepts `{ user_id?, title, body, data? }` POST body. Requires `Authorization: Bearer <SERVICE_ROLE_KEY>`. Fetches all matching tokens from `push_tokens`, forwards to Expo Push API (`exp.host/--/api/v2/push/send`), returns `{ sent, result }`. Omit `user_id` to broadcast to all users.

**Files modified:**
- `src/services/NotificationService.ts` — Rewrote to use `expo-notifications`: `setup()` requests permission + calls `Notifications.getExpoPushTokenAsync({ projectId })` + upserts token into Supabase `push_tokens`; `maybeSendSleepReadyNotification()` unchanged (still gates on time + date before calling native JstyleBridge)
- `app/_layout.tsx` — Added `Notifications.setNotificationHandler` at module level (foreground banners/sound); added `useEffect` with `addNotificationResponseReceivedListener` (app running) + `getLastNotificationResponseAsync` (app killed) — both parse `data.url` and call `router.navigate({ pathname: '/', params: { tab } })`
- `app.json` — Added `expo-notifications` plugin with `{ "iosDisplayInForeground": true }`
- `src/types/supabase.types.ts` — Added `push_tokens` Row/Insert/Update types to `Database`
- `ios/SmartRing/AppDelegate.swift` — Removed `UNUserNotificationCenterDelegate` extension and `UNUserNotificationCenter.current().delegate = self` (expo-notifications manages its own delegate; our extension conflicted)
- `src/screens/NewHomeScreen.tsx` — Changed `NotificationService.requestPermissions()` → `NotificationService.setup()` on mount
- `package.json` / `package-lock.json` — Added `expo-notifications`

**Key notes:**
- **Manual send example:**
  ```bash
  curl -X POST https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1/send-notification \
    -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
    -H "Content-Type: application/json" \
    -d '{"title":"Check your sleep 🌙","body":"Last night recap is ready","data":{"url":"smartring:///?tab=sleep"}}'
  ```
- Deeplink `data.url = "smartring:///?tab=sleep"` → opens app → navigates to Sleep sub-tab (works from killed state too via `getLastNotificationResponseAsync`)
- Token is saved to Supabase on first authenticated app launch; subsequent launches are no-ops (upsert on conflict)
- Native-fired local notifications (HR alert, battery alert) still work via `JstyleBridge.m` — they appear as banners because `setNotificationHandler` enables foreground display
- **Native rebuild required** — `expo-notifications` plugin added to `app.json`

---

## 2026-03-19: Background Notifications (HR Alert, Battery Alert, Sleep Ready + Deeplink)

**Change:** Added three native-backed background push notifications that fire from the native BLE layer even when the app is suspended — no JS bridge required for the alerts. Also added a "Sleep Analysis Ready" notification that fires after sync and deeplinks directly to the Sleep sub-tab.

**Files created:**
- `src/services/NotificationService.ts` — JS wrapper: `requestPermissions()` calls native, `maybeSendSleepReadyNotification()` gates on time-of-day (4 AM–2 PM) + per-day AsyncStorage deduplication before calling native

**Files modified:**
- `ios/JstyleBridge/JstyleBridge.m` — Added `#import <UserNotifications/UserNotifications.h>`; new ivars `lastHRAlertTime` + `lastBatteryAlertThreshold`; added `#pragma mark - Background Notifications` section with `sendLocalNotification:body:userInfo:`, `maybeSendHighHRAlert:` (10-min debounce, fires at ≥150 BPM), `maybeSendLowBatteryAlert:` (thresholds 20/10/5%, re-arms above 30%); wired both into `handleRealTimeData:` and `handleBatteryData:` respectively; added `RCT_EXPORT_METHOD(requestNotificationPermissions:rejecter:)` and `RCT_EXPORT_METHOD(scheduleSleepAnalysisNotification:rejecter:)` — the latter fires with `userInfo.url = "smartring:///?tab=sleep"`
- `ios/SmartRing/AppDelegate.swift` — Added `import UserNotifications`, set `UNUserNotificationCenter.current().delegate = self` on launch; added `extension AppDelegate: UNUserNotificationCenterDelegate` with `willPresent` (shows banner+sound in foreground) and `didReceive` (on tap, extracts `url` from `userInfo` and calls `RCTLinkingManager.application(_:open:options:)` to trigger Expo Router deeplink)
- `src/screens/NewHomeScreen.tsx` — Added `useURL` from `expo-linking` + `NotificationService` import; new `prevSyncPhaseRef`; three new `useEffect` hooks: (1) request notification permissions on mount, (2) parse `?tab=sleep|activity|nutrition` from incoming URL and call `handleTabPress`, (3) after sync phase transitions to `complete` with valid `sleepScore`, call `maybeSendSleepReadyNotification()`

**Key notes:**
- HR and battery alerts are **100% native** — they fire in `handleRealTimeData:` / `handleBatteryData:` which execute in the native BLE thread even when the JS bridge is suspended (app backgrounded)
- Battery alert uses a descending threshold ladder (20% → 10% → 5%) and re-arms automatically when battery recovers above 30%
- Sleep notification only fires once per calendar day, between 4 AM and 2 PM, and only if `sleepScore > 0` after sync
- Deeplink URL `smartring:///?tab=sleep` is handled by Expo Router via `useURL()` hook → calls `handleTabPress(1)` to scroll the horizontal tab view to Sleep
- **Native rebuild required** — changes touch `JstyleBridge.m` and `AppDelegate.swift`

---

## 2026-03-18: Ring Connection Speed Optimizations

**Change:** Reduced onboarding scan time from ~11.5s to ~1.8–3s, and auto-reconnect lag by ~1s+.

**Fixes:**
1. **Early scan stop in onboarding** (`app/(onboarding)/connect.tsx`) — Replaced `await scan(10)` + 1.5s delay with fire-and-forget `scan(7)`. A `useEffect` watching `[devices, step]` stops the scan 800ms after the first device appears, then transitions immediately to the device list. A 7s fallback timeout handles the no-device case.
2. **Removed redundant `isConnected` check in `autoConnect`** (`src/hooks/useSmartRing.ts`) — Eliminated the second `isConnected()` native round-trip (lines 441–449) that ran right before `autoReconnect()`. Saves ~500ms–1s per auto-reconnect.
3. **Reduced `emitConnectionState` delay from 500ms → 50ms** (`src/services/UnifiedSmartRingService.ts`) — The artificial post-reconnect delay before emitting `'connected'` state is now 50ms instead of 500ms.
4. **Early scan stop in DevicesScreen** (`src/screens/DevicesScreen.tsx`) — Added the same `useEffect` pattern: when `devices.length > 0 && isScanning`, call `stopScan()` immediately so manual re-scans end as soon as the ring is found.

**Files modified:**
- `app/(onboarding)/connect.tsx`
- `src/hooks/useSmartRing.ts`
- `src/services/UnifiedSmartRingService.ts`
- `src/screens/DevicesScreen.tsx`

---

## 2026-03-18: Coach Tab Loading Performance Optimizations

**Change:** Fixed 4 concrete bugs that caused the Coach tab to do a full Supabase fetch on every navigation, ignoring its own 6-hour cache.

**Fixes:**
1. **Cache bypass fixed** — `useFocusEffect` was calling `load(true)` (skipCache=true) on every tab focus. Changed to `load()` so the 6-hour cache is respected. Repeat visits now render instantly (~50ms vs ~1-2s).
2. **Duplicate `loadBaselines()` removed** — Baselines were loaded twice sequentially. Replaced with a single `Promise.all([loadBaselines(), supabase.auth.getUser()])` call that runs both in parallel, saving ~100-200ms.
3. **Training load queries parallelized** — `scoreTrainingLoadComponent` was awaiting the 7-day and 28-day Strava queries back-to-back. Replaced with `Promise.all`, saving ~150-300ms.
4. **HRV + sleep queries parallelized** — `computeLastRunContext` fetched HRV and sleep for the run date sequentially. Replaced with `Promise.all`, saving ~100-200ms.

**Files modified:**
- `src/hooks/useFocusData.ts` — Fix 1 (cache bypass) + Fix 2 (parallel auth+baselines)
- `src/services/ReadinessService.ts` — Fix 3 (parallel training load) + Fix 4 (parallel HRV+sleep)

**Key notes:**
- Pull-to-refresh still calls `load(true)`, so manual refresh always bypasses cache
- Supabase Realtime subscription still busts cache on new strava_activities inserts

---

## 2026-03-18: TestFlight Setup & Build Fixes

**Change:** Full TestFlight pipeline established — registered bundle ID `com.focusring.app`, fixed two App Store validation errors (icon alpha channel + missing BGTask plist key), hardcoded production Supabase credentials as fallback to fix network error in distributed builds, bumped to v1.0.1 build 2, and created `/testflight` skill for future releases.

**Files created:**
- `~/.claude/commands/testflight.md` — Skill: auto-increments 1.0.N patch version + build number, updates app.json + pbxproj, commits, pushes, opens Xcode

**Files modified:**
- `app.json` — Bundle ID changed to `com.focusring.app`, added `ios.buildNumber: "2"`, version bumped to `1.0.1`
- `ios/SmartRing.xcodeproj/project.pbxproj` — Updated `MARKETING_VERSION` to `1.0.1`, `CURRENT_PROJECT_VERSION` to `2`, bundle ID to `com.focusring.app`
- `ios/SmartRing/Info.plist` — Bundle ID updated to `com.focusring.app`, added `BGTaskSchedulerPermittedIdentifiers` array (required by Apple when `processing` background mode is declared)
- `assets/icon.png` — Stripped alpha channel (Apple rejects transparent icons)
- `ios/SmartRing/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png` — Stripped alpha channel from the actual asset catalog icon used by Xcode
- `src/services/SupabaseService.ts` — Changed fallback values from localhost (`127.0.0.1:54331`) to production Supabase URL + anon key so Xcode archive builds work without `.env` being loaded

**Key notes:**
- Apple rejected icon with alpha — fix was `sips` JPEG round-trip on the asset catalog PNG, not just `assets/icon.png`
- `processing` background mode was already in the native `Info.plist` (added by a plugin), which requires `BGTaskSchedulerPermittedIdentifiers` — added `com.focusring.app.refresh` as the identifier
- `EXPO_PUBLIC_*` vars from `.env` are not reliably embedded during Xcode Archive builds — hardcoded production fallbacks are the reliable fix (anon key is public by design)
- Use `/testflight` for all future TestFlight releases — handles version bump, commit, push, and Xcode open automatically

---

## 2026-03-18: ngrok Skill + Expo Hosting Deployment

**Change:** Created a `/ngrok-web` slash command skill and deployed the app to EAS Hosting, giving it a permanent `*.expo.app` public URL.

**Files created:**
- `~/.claude/commands/ngrok-web.md` — Skill: checks ngrok version, starts Expo web on port 8081, kills stale tunnel, starts ngrok, and reports the public URL
- `~/Downloads/ngrok-web-skill.md` — Reference doc saved to Downloads explaining the skill, requirements, and usage
- `web/` (untracked) — Static export output directory generated by `expo export -p web`

**Files modified:**
- `app.json` — Added `"owner": "mateoaldao"` required by EAS Hosting deploy

**Key notes:**
- Production URL: **https://smart-ring-expo-app.expo.app** (permanent, tied to `@mateoaldao/smart-ring-expo-app`)
- Deployment preview URL: `https://smart-ring-expo-app--caa9066q6t.expo.app`
- ngrok was upgraded from 3.19.1 → 3.20.0+ via `brew upgrade ngrok` (free tier requires ≥ 3.20.0)
- Future web deploys: `npx expo export -p web && eas deploy --prod --non-interactive`
- ngrok inspector UI always at http://localhost:4040 while tunnel is running

---

## 2026-03-16: Onboarding & Auth Screen Redesign (Ultrahuman-inspired)

**What changed:** Full visual redesign of all three sign-in / onboarding screens to match a premium dark aesthetic inspired by the Ultrahuman reference moodboard in Figma (node 432:202).

**Design direction:**
- True black `#000000` backgrounds throughout (replacing the previous blue/purple gradients)
- Ring hero image (`assets/images/ring-hero.png` — gold X3 ring with amber glow, sourced from Figma) as the primary visual on the auth and connect welcome screens
- Pill-shaped CTA buttons (`borderRadius: 50`) using app teal `#00D4AA` on black
- Minimal glass-card inputs (`rgba(255,255,255,0.07)` bg, `rgba(255,255,255,0.12)` border, no floating labels)
- Teal ripple-pulse animation for scanning/connecting states (replacing indigo)
- Animated entry check mark on success screen with ambient teal glow

**Files added:**
- `assets/images/ring-hero.png` — downloaded from Figma MCP asset (1.7MB, gold X3 ring hero)

**Files modified:**
- `src/screens/AuthScreen.tsx` — ring hero at top 38% of screen with gradient fade to black; brand + tagline below; minimal form; pill CTA; kept all auth logic & i18n
- `app/(onboarding)/connect.tsx` — welcome step now shows ring hero; scanning/connecting use teal ripple pulse rings; device list and troubleshoot UI updated; all BLE logic unchanged
- `app/(onboarding)/success.tsx` — black bg with ambient glow; animated check circle (teal, spring-in); flat stats card; HR card; bottom-anchored pill CTA; fixed QCBandService → UnifiedSmartRingService.onHeartRateReceived()

---

## 2026-03-16: Remove All QCBand SDK Traces

**What changed:** Full removal of QCBand SDK from the codebase — all references, imports, branches, and the framework binary itself.

**Files deleted:**
- `src/services/QCBandService.ts`
- `ios/Frameworks/QCBandSDK.framework/` (entire directory)
- `QCBANDSDK_INTEGRATION.md`

**Files refactored:**
- `src/services/UnifiedSmartRingService.ts` — Rewrote from "Dual SDK" to Jstyle-only. `SDKType` union is now `'jstyle' | 'none'`. All QCBand branches, imports, and QCBand-only methods (`getQCBandService`, `startWearCalibration`, `getFlipWristInfo`, `startSportMode`, `stopSportMode`, `switchToPhotoMode`, `startBloodPressureMonitoring`, `stopBloodPressureMonitoring`) removed.
- `src/utils/ringData/heartRate.ts` — Removed QCBandService import; `stopHeartRateMeasurement` → `UnifiedSmartRingService.stopHeartRateMonitoring()`; `onHeartRateData` → `UnifiedSmartRingService.onHeartRateReceived()`; `getOvernightHeartRate` → `UnifiedSmartRingService.getScheduledHeartRateRaw()`.
- `src/utils/ringData/customSleepAnalysis.ts` — Removed unused QCBandService import.
- `app/(onboarding)/success.tsx` — Removed QCBandService import; HR listener switched to `UnifiedSmartRingService.onHeartRateReceived()`.
- `src/screens/StyledRingScreen.tsx` — Removed QCBandService import; HR listener and stop call use UnifiedSmartRingService.
- `src/services/TodayCardVitalsService.ts` — Removed `fetchQcbandVitals`, renamed to `fetchRingVitals`; routing logic simplified to Jstyle-only.
- `src/types/sdk.types.ts` — `sdkType` narrowed from `'qcband' | 'jstyle'` to `'jstyle'`.
- `src/hooks/useSmartRing.ts` — Default sdkType fallback changed from `'qcband'` to `'jstyle'`; QCBand comment removed from connect logic.
- `src/hooks/useHealthData.ts` — `startBloodPressureMonitoring`/`stopBloodPressureMonitoring` now no-ops (X3 has no dedicated BP measurement).
- `src/services/JstyleService.ts` — Removed "Key differences from QCBandService:" comment.

**User-visible result:** No user-visible change — the app already only used the Jstyle/X3 SDK. Codebase is now clean with no dead QCBand code paths.

---

## 2026-03-16: Fix UTC/Local Timezone Bug in HR Chart & Sleep Date Filter

**Root cause:** All timestamp-to-minutes conversions used `ts % 86400000` which gives milliseconds since **UTC midnight**, not local midnight. For non-UTC timezones this shifts all chart timestamps by the UTC offset — e.g. a UTC-2 user sees data at 14:00 when the real local time is 11:44.

**Fixes applied:**

1. **`src/hooks/useHomeData.ts`** — `parseX3DateToMinutes` helper: replaced `ts % 86400000 / 60000` with `dt.getHours() * 60 + dt.getMinutes()` (local time).
2. **`src/hooks/useHomeData.ts`** — two `startTimestamp`-to-`startMin` conversions for continuous HR and single HR: same fix.
3. **`src/hooks/useHomeData.ts`** — HRV fallback HR points: `h.timestamp % 86400000` → `new Date(h.timestamp).getHours() * 60 + getMinutes()`.
4. **`src/hooks/useHomeData.ts`** — Supabase nap query window: `new Date(todayStr)` (UTC midnight) → `new Date().setHours(0,0,0,0)` (local midnight).
5. **`src/components/home/DailyHeartRateCard.tsx`** — both timestamp-to-minutes conversions: same UTC→local fix.
6. **`src/services/JstyleService.ts`** — sleep record date filter in `getSleepByDay`: `new Date(startMs).toISOString().split('T')[0]` → local date string using `getFullYear()/getMonth()/getDate()`.

**User-visible result:** HR bars and sleep hypnogram time labels now align with local clock time, not UTC time.

---

## 2026-03-16: Fix HR Chart Horizontal Scroll Blocking (full fix)

**Change:** Dragging anywhere inside the HR chart now prevents tab switches, using the same `lockTabScroll`/`unlockTabScroll` mechanism as `SleepHypnogram`.

**Root cause:** The original `panHandlers`-only approach wasn't enough because the tab navigator (react-native-gesture-handler) can intercept gestures before PanResponder fires. `SleepHypnogram` works because it calls `onTouchStart`/`onTouchEnd` callbacks that disable `scrollEnabled` on the horizontal ScrollView in `NewHomeScreen`.

**Fix:**
1. `DailyHeartRateCard` — added `onTouchStart`/`onTouchEnd` props with `useRef` pattern (same as hypnogram); calls them in `onPanResponderGrant` and `onPanResponderRelease/Terminate`.
2. `OverviewTab` — added `onChartTouchStart`/`onChartTouchEnd` props, passes them to `DailyHeartRateCard`.
3. `NewHomeScreen` — passes `lockTabScroll`/`unlockTabScroll` to `OverviewTab` (same as `SleepTab`).

**Files modified:**
- `src/components/home/DailyHeartRateCard.tsx`
- `src/screens/home/OverviewTab.tsx`
- `src/screens/NewHomeScreen.tsx`

---

## 2026-03-16: Fix HR Chart Horizontal Scroll Blocking

**Change:** `DailyHeartRateCard` now blocks horizontal tab swipes across the entire chart area, not just the bars sub-view.

**Root cause:** `panHandlers` were attached to the `hrBars` View (positioned with `left/right/top/bottom` margins for axis labels), so horizontal drags starting on the axis label margins fell through to `MaterialTopTabs` and triggered tab switches.

**Fix:** Moved `{...pan.panHandlers}` from `hrBars` up to `hrChart` (the full-height parent). `onLayout` stays on `hrBars` so `chartWidthRef` still measures the bars width and bar-index calculation remains correct.

**Files modified:**
- `src/components/home/DailyHeartRateCard.tsx` (line 192: panHandlers moved to hrChart; line 208: removed from hrBars)

---

## 2026-03-16: HR Chart — Filter to Today Only + Clean Up Logs

**Change:** The HR chart no longer shows yesterday's data. Added proper HR logging. Removed verbose logs from JstyleService.

**Root cause:** `parseX3DateToMinutes` used `ts % 86400000` to convert timestamps to minutes-since-midnight, which stripped the date — so yesterday's 11 PM data plotted at hour 23 on today's chart, indistinguishable from today's 11 PM.

**Fix:** Added `isRecordFromToday()` check in `useHomeData.ts` before including any record in `hrChartData`. Checks epoch ms timestamps directly; falls back to comparing the `YYYY.MM.DD` date string prefix. Applied to both continuous and single HR paths.

**Log changes:**
- `useHomeData.ts`: replaced `RAW_HR records:` log with structured per-record log showing `date`, `ts`, `dynLen` for all records
- `JstyleService.ts`: removed `RAW_BATTERY`, 3× sleep debug logs, Single HR count log, Auto HR monitoring enabled log (JS-only changes, no Xcode rebuild needed)

**Files modified:**
- `src/hooks/useHomeData.ts`
- `src/services/JstyleService.ts`

---

## 2026-03-16: HR Chart — Clamp to Current Hour

**Change:** The daily heart rate chart now only shows hours that have actually passed, instead of always rendering all 24 hours.

**What the user sees:**
- At 9 AM → chart shows 10 bars (hours 0–9), x-axis ends at `9`
- At midnight → chart shows 1 bar, x-axis shows `0` only
- At 11 PM → chart shows 24 bars with full `0 6 12 18 24` axis (same as before)
- Scrubber cursor stays precisely aligned with the selected bar at all times of day

**Files modified:**
- `src/components/home/DailyHeartRateCard.tsx` — Three changes:
  1. `buildRanges`: array length changed from `24` to `currentHour + 1`
  2. Marker overlay `left` position: `24 - 1` → `hourlyHrRanges.length - 1`
  3. X-axis labels: replaced static `[0,6,12,18,24]` with dynamic filtered subset via `useMemo`

---

## 2026-03-16: Fix Sleep Detail — Score Always 0 & Hypnogram Not Rendering

**Change:** Historical sleep days in the Sleep Detail screen now show a real score (not 0) and render the hypnogram correctly.

**Root causes fixed:**
1. **Score always 0** — `row.sleep_score` is `null` in Supabase (DataSyncService never writes it). The `|| 0` fallback made every past day show "0 / Poor". Fix: when `sleep_score` is null/0, calculate it inline from `deepMin + lightMin + remMin` using the existing `calculateSleepScore` helper.
2. **Hypnogram never renders** — `parseSegmentsFromJson()` had no branch for the `{ rawQualityRecords: [...] }` shape that DataSyncService stores in `detail_json`. Fix: added a third branch that delegates to `buildSegmentsFromRawQuality()` (already present in the file).

**Files modified:**
- `src/hooks/useMetricHistory.ts` — Two changes:
  - `parseSegmentsFromJson`: added `rawQualityRecords` branch (delegates to `buildSegmentsFromRawQuality`)
  - `fetchSleepHistory`: replaced `score: row.sleep_score || 0` with inline `calculateSleepScore` call when score is missing

**Key notes:**
- Today's data (index 0) was already correct — it reads from ring context via `buildTodaySleepFromContext`
- No DB migration or re-sync needed — client-side repair only
- No native rebuild needed — JS-only change

---

## 2026-03-10: Sync Cooldown — Skip Foreground Sync Within 10 Minutes

**Change:** The SyncStatusSheet bottom sheet no longer appears every time the app is foregrounded. A 10-minute cooldown prevents redundant BLE syncs when the user briefly switches apps and returns. Manual pull-to-refresh and initial mount always bypass the cooldown.

**Files modified:**
- `src/hooks/useHomeData.ts` — Added `SYNC_COOLDOWN_MS` constant (10 min), `lastSyncCompletedAt` ref (set on successful sync), cooldown guard in AppState `'active'` listener that skips full sync and only runs `refreshMissingCardData()` when within cooldown

**Key notes:**
- No other files changed — guard lives entirely in the hook's AppState handler
- Console logs elapsed time when foreground sync is skipped for debugging
- No native rebuild needed — JS-only change

---

## 2026-03-10: Naps in Daily Timeline (Cronología)

**Change:** Nap events now appear in the DailyTimelineCard on the Overview tab, rendered chronologically with a purple moon icon and duration chip.

**Files modified:**
- `src/components/home/DailyTimelineCard.tsx` — Added `'nap'` to `TimelineEventKind`, purple moon icon config (`#B16BFF`), `todayNaps` prop, nap event builder in `useMemo`, added `'nap'` to `isMetricKind` for duration chip rendering
- `src/screens/home/OverviewTab.tsx` — Passes `todayNaps={homeData.todayNaps}` to `<DailyTimelineCard>`
- `src/i18n/locales/en.json` — Added `timeline.event_nap`: "Nap"
- `src/i18n/locales/es.json` — Added `timeline.event_nap`: "Siesta"

**Key notes:**
- Nap data was already computed in `useHomeData` (`todayNaps` array) but never passed to the timeline
- No native rebuild needed — JS-only change

---

## 2026-03-10: Nap Detection & Differentiation

**Change:** Added heuristic-based nap vs night classification for sleep sessions, inspired by Oura & Ultrahuman. Naps are now scored, stored with `session_type`, displayed in SleepTab, and counted toward sleep debt reduction.

**Algorithm:** `classifySleepSession()` — <15min→nap, >180min→night, within 4hr of prior night→nap, start 20:00–03:59→night, else daytime→nap.

**Files created:**
- `supabase/migrations/20260310_sleep_session_type.sql` — Adds `session_type`, `nap_score` to `sleep_sessions`, `nap_total_min` to `daily_summaries`, index, backfill
- `src/services/NapClassifierService.ts` — Pure functions: `classifySleepSession()`, `calculateNapScore()`, `getNapLabel()`
- `src/components/home/NapCard.tsx` — GradientInfoCard with time range, duration, nap score label, stage breakdown mini-bar

**Files modified:**
- `src/types/supabase.types.ts` — Added `session_type`, `nap_score` to sleep_sessions; `nap_total_min` to daily_summaries
- `src/services/SupabaseService.ts` — Added `getLatestNightSessionEndTime()`, `getNapSessionsForDate()`
- `src/services/DataSyncService.ts` — Sleep sync now classifies sessions and computes nap scores; daily summary includes `nap_total_min`
- `src/services/SleepDebtService.ts` — Nap minutes added to actual sleep for debt calculation
- `src/hooks/useHomeData.ts` — Added `todayNaps`, `totalNapMinutesToday` to HomeData; fetches nap sessions alongside Strava
- `src/screens/home/SleepTab.tsx` — Renders NapCard between sleep stages and HRV card when naps exist
- `src/i18n/locales/en.json` — Added `naps_today`, `nap_count`, `nap_score_great/okay/poor`, `nap_contributed`
- `src/i18n/locales/es.json` — Spanish translations for nap keys

---

## 2026-03-08: Sleep Debt Card Redesign + Detail Screen

**Change:** Redesigned SleepDebtCard from stats-row + mini-bars layout to an Oura-style horizontal gauge with positioned marker dot. Card now navigates on tap to a new detail screen with daily breakdown, stats, and recovery insights.

**Files created:**
- `src/components/home/SleepDebtGauge.tsx` — Reusable horizontal gauge with 4 color segments (None/Low/Moderate/High), white marker dot positioned via `onLayout` + linear interpolation
- `app/detail/sleep-debt-detail.tsx` — Detail screen: headline debt in category color, gauge, stats glass card (7-day avg, target with edit, days tracked, total debt), daily breakdown with per-day color coding, blue insight block

**Files modified:**
- `src/components/home/SleepDebtCard.tsx` — Simplified body to gauge only, added `showArrow` + `onHeaderPress` for navigation, removed `handleEditTarget` + `TARGET_PRESETS` (moved to detail screen)
- `app/_layout.tsx` — Registered `detail/sleep-debt-detail` route with `slide_from_right` animation
- `src/i18n/locales/en.json` — Added `detail_title`, `period_label`, `gauge_none/high`, `daily_breakdown`, `days_tracked`, `total_debt`, `on_target`, `insight_none/low/moderate/high`
- `src/i18n/locales/es.json` — Spanish translations for all above keys

---

## 2026-03-08: Sleep Baseline Tier System

**Change:** Added 4-tier sleep baseline classification (Low → Developing → Good → Optimal) based on the 14-day rolling average of `sleepScore` from `focus_baselines_v1`. Surfaced in Sleep tab (after 7-Day Trend) and Health tab (after Sleep score card). Tier persists to Supabase `profiles` table with 6h local cache.

**Tiers:** Low 0–49 (red), Developing 50–64 (amber), Good 65–79 (blue), Optimal 80–100 (teal). Each tier shows an advancement tip via i18n.

**Files created:**
- `supabase/migrations/20260309_sleep_baseline_tier.sql` — adds `sleep_baseline_tier TEXT` + `sleep_baseline_avg_score REAL` to profiles
- `src/types/sleepBaseline.types.ts` — SleepBaselineTier, SleepBaselineState types
- `src/hooks/useSleepBaseline.ts` — loads baselines from AsyncStorage, computes tier, 6h cache, fires-and-forgets Supabase persist
- `src/components/home/SleepBaselineTierCard.tsx` — GradientInfoCard with 4-zone tier bar, score dot, tier badge, days tracked, advancement tip

**Files modified:**
- `src/services/ReadinessService.ts` — added `computeSleepBaselineTier(baselines)` function
- `src/services/SupabaseService.ts` — added `updateSleepBaselineTier(userId, tier, avgScore)` method
- `src/types/supabase.types.ts` — added `sleep_baseline_tier` + `sleep_baseline_avg_score` to profiles Row/Insert/Update
- `src/screens/home/SleepTab.tsx` — card inserted after DailySleepTrendCard, before SleepDebtCard
- `src/screens/StyledHealthScreen.tsx` — card inserted after Sleep GradientInfoCard, before Activity card
- `src/i18n/locales/en.json` — added `sleep_baseline` namespace + explainer keys
- `src/i18n/locales/es.json` — Spanish translations for all above keys
- `src/data/metricExplanations.ts` — added `sleep_baseline` metric key with score_arc chart

## 2026-03-08: Sleep Debt Feature

**Change:** Added 7-day accumulated sleep debt tracking. Shows how much sleep deficit has built up over the past week, categorized by severity (None/Low/Moderate/High), with recovery suggestions and user-configurable sleep target.

**Calculation:** Daily deficit = max(0, target − actual). Surplus not banked. 7-day sum. Min 3 nights before showing. Target stored in `profiles.sleep_target_min` (default 8h).

**Files created:**
- `supabase/migrations/20260308_sleep_debt.sql` — adds `sleep_target_min` column to profiles
- `src/types/sleepDebt.types.ts` — SleepDebtCategory, DailyDeficit, SleepDebtState types
- `src/services/SleepDebtService.ts` — pure calculation service with 2h AsyncStorage cache
- `src/hooks/useSleepDebt.ts` — hook with cache, refresh, updateTarget
- `src/components/home/SleepDebtCard.tsx` — GradientInfoCard with avg/target stats, 7 mini bars, category badge, recovery suggestion, target edit via Alert presets

**Files modified:**
- `src/types/supabase.types.ts` — added `sleep_target_min` to profiles Row/Insert/Update
- `src/screens/home/SleepTab.tsx` — added SleepDebtCard between 7-day trend and tips
- `src/screens/home/OverviewTab.tsx` — added compact debt badge row with color dot inside sleep card
- `src/data/metricExplanations.ts` — added `sleep_debt` MetricKey and explainer entry
- `src/i18n/locales/en.json` — added `sleep_debt.*` and `explainer.sleep_debt_*` keys
- `src/i18n/locales/es.json` — added Spanish translations for all sleep debt keys

**Notes:**
- Migration applied via `npx supabase db push` on 2026-03-08
- Data source: `daily_summaries.sleep_total_min` from Supabase

---

## 2026-03-06: Baseline Journey Timeline Card

**Change:** Replaced the "construyendo tu línea base" text pill in the Coach tab with a visual 4-stage journey card (`BaselineJourneyCard`).

**Design:** Glass card with a horizontal stepper timeline (First Sync → Calibrating → Coach Active → Optimized). Done stages show teal filled dots with checkmarks, current stage has an outlined ring with a core dot, future stages are dimmed. A teal progress line fills from stage 0 to current.

Below the timeline: a "You're here" status row, signal presence pills (✓ HRV / ✓ Sleep / ○ Resting HR / ○ Temp), and an actionable tips block listing 2–3 specific steps to reach the next stage.

**Files created:**
- `src/components/focus/BaselineJourneyCard.tsx`

**Files modified:**
- `src/screens/FocusScreen.tsx` — imports card, computes `isBaselineMode`, renders journey card instead of insight text when `allNull || daysLogged < 3`

---

## 2026-03-06: Bootstrap Coach Baselines from Historical Supabase Data

**Problem:** Coach tab showed "construyendo tu línea base" despite 1+ month of ring use. `daysLogged` lived only in AsyncStorage (incremented once per app-open day), so a screen built 2 days ago only had `daysLogged = 2 < 3`.

**Fix:**

1. **`src/services/ReadinessService.ts`** — Added `bootstrapBaselinesFromSupabase(userId)` export. On first call it queries the last 14 days of `hrv_readings`, `sleep_sessions`, `temperature_readings`, and `heart_rate_readings` from Supabase, groups them by calendar day, replays them through `pushRolling` to build a proper rolling baseline, sets `daysLogged` to the actual number of days with data, marks `updatedAt` as today, and persists to AsyncStorage. Returns the populated `FocusBaselines`.

2. **`src/hooks/useFocusData.ts`** — After `loadBaselines()` in the `load` callback, added a one-time bootstrap gate: if `daysLogged === 0 && updatedAt === null` (meaning AsyncStorage has never been written), calls `bootstrapBaselinesFromSupabase(userId)` before proceeding. Subsequent opens skip bootstrap and use the existing `updateBaselines` daily-increment path normally.

**Result:** On next app open after clearing `focus_baselines_v1` (or a fresh install), the Coach tab will immediately exit baseline mode if the user has ≥3 days of historical Supabase data.

**Files modified:**
- `src/services/ReadinessService.ts` — added `bootstrapBaselinesFromSupabase()`
- `src/hooks/useFocusData.ts` — import + bootstrap gate after `loadBaselines()`

---

## 2026-03-05: Fix Supabase DB + Sync Bugs (4 fixes)

**Fixed:**

1. **UNIQUE constraints for BP + sport** — New migration `20260305_add_missing_unique_constraints.sql` adds `bp_readings_user_recorded_unique` and `sport_records_user_start_unique` indexes. Run `npx supabase db push` to apply.

2. **Auth bug in `syncAllData()`** — `authService.currentUser?.id` was always `undefined` (no such property on AuthService), silently killing every sync. Replaced with `await supabase.auth.getUser()`. Removed stale `authService` import.

3. **BP + sport use upsert** — `insertBloodPressureReadings` and `insertSportRecords` were calling `.insert()`, accumulating duplicates on every sync. Changed both to `.upsert(…, { onConflict: …, ignoreDuplicates: true })`.

4. **Sleep window extended -12h** — `updateDailySummary` queried sleep from `startOfDay`, missing sessions that start the prior evening. Now queries from `startOfDay - 12h`, so `sleep_total_min` in `daily_summaries` is populated correctly.

**Files modified:**
- `supabase/migrations/20260305_add_missing_unique_constraints.sql` (NEW)
- `src/services/DataSyncService.ts` — auth fix + sleep window fix
- `src/services/SupabaseService.ts` — BP + sport upsert

---

## 2026-03-05: Coach Tab — Strava Link + Verdict Explanation Always Visible

**Completed:** Two UX gaps in the Coach (Focus) tab fixed.

**Change 1 — "View Strava" link in `LastRunContextCard`:**
- When `hasStrava` is true and a run is shown → "View Strava →" link appears at the bottom of the card
- When `hasStrava` is true but no runs found → link still appears below the empty state
- Taps navigate to `/(tabs)/settings/strava`
- When Strava not connected → unchanged (no link)

**Change 2 — Explanation + HR comparison always visible:**
- `lastRun.explanation` text promoted out of the expand gate, now always visible below the verdict chip
- New HR comparison line: "Avg HR: X bpm · Expected: ~Y bpm" (uses `lastRun.expectedHR`)
- Expanded section retains sleep score + HRV vs norm rows only
- `expectedHR` added to `LastRunContext` type and returned from `computeLastRunContext()`

**Files modified:**
- `src/types/focus.types.ts` — Added `expectedHR: number` to `LastRunContext`
- `src/services/ReadinessService.ts` — Returns `expectedHR` in result object
- `src/components/focus/LastRunContextCard.tsx` — Explanation + HR row always shown; View Strava link; new styles
- `src/i18n/locales/en.json` — Added `last_run.view_strava`, `last_run.hr_comparison`
- `src/i18n/locales/es.json` — Added `last_run.view_strava`, `last_run.hr_comparison`

---

## 2026-03-05: i18n Audit Round 2 — NutritionTab, LogEntrySheet, Zone Names, BPM, Day Labels

**Completed:** Second comprehensive i18n audit pass covering 5 files that were missed in Round 1.

**New locale keys added:**
- `nutrition.*` — 12 keys: `coming_soon`, `tracking_title`, `description`, 4 feature title/desc pairs, `notify_button`
- `log_entry.*` — 29 keys: modal headers, field labels, placeholders, save button, all subtype labels for recovery/meal/activity
- `strava_detail.zone_z1`–`zone_z5` — HR zone names
- `hr_live.bpm_unit` — "BPM" / "PPM"
- `sleep_trend.day_sun`–`day_sat` — 7 day abbreviations

**Files modified:**
- `src/i18n/locales/en.json` + `es.json` — all keys above
- `src/screens/home/NutritionTab.tsx` — added `useTranslation`, replaced all 12 hardcoded strings
- `src/components/home/LogEntrySheet.tsx` — added `useTranslation`, replaced modal header, field labels, placeholders, save button, chip labels, subtype label objects, activity fallback title
- `src/screens/StravaActivityDetailScreen.tsx` — replaced `ZONE_NAMES` constant with `ZONE_KEYS` + `t()` lookup in `HRZonesCard`
- `src/components/home/LiveHeartRateCard.tsx` — replaced standalone `'BPM'` with `t('hr_live.bpm_unit')`
- `src/components/home/DailySleepTrendCard.tsx` — moved `DAY_LABELS` from module-level constant to component-scoped `t()` array

---

## 2026-03-05: Full App i18n Translation Pass

**Completed:** Replaced all remaining hardcoded user-visible strings across the app with `t()` calls using the existing react-i18next setup.

**New locale keys added** (`en.json` + `es.json`):
- `strava.button_sync_athlete`, `strava.alert_connect_failed_title/message`, `strava.alert_connect_error_message`
- `strava_detail.col_pace`, `strava_detail.go_back`, `strava_detail.label_activity`
- `sleep_trend.value_none`, `sleep_trend.status_no_data`
- `hr_live.value_na`

**Components/screens updated with `useTranslation()`:**
- `src/components/home/DailyTimelineCard.tsx` — timeline header, event labels, add button
- `src/screens/StravaScreen.tsx` — all sub-components (ActivityCard, ComputedStatsCard, FilterTabs, StravaScreen)
- `src/screens/StravaActivityDetailScreen.tsx` — all sub-components (HRZonesCard, SplitsCard, BestEffortsCard, LapsCard, main)
- `src/screens/AuthScreen.tsx` — all strings
- `src/screens/OnboardingScreen.tsx` — all strings (with `{{name}}` interpolation)
- `src/components/home/LiveHeartRateCard.tsx` — all states, buttons, interpolated subtitles
- `src/components/home/DailyHeartRateCard.tsx` — card title, subtitles, empty state
- `src/components/home/DailySleepTrendCard.tsx` — card title, headerValue, headerSubtitle
- `src/components/home/CalorieDeficitCard.tsx` — card title, status message, legend labels
- `src/components/focus/ChatFAB.tsx` — "Ask your coach…" placeholder

**Key pattern:** Sub-components need their own `const { t } = useTranslation()`. Module-level arrays that use translated strings must be moved inside the component function.

---

## 2026-03-05: Strava Detail Fix — Missing DB Column

**Fix:** Ran `npx supabase db push` to apply `20260304_strava_detail_columns.sql` (adds `detail_fetched_at` + other detail columns to `strava_activities`).

---

## 2026-03-05: Focus Screen Realtime Cache Bust

**Fix:** Added Supabase Realtime `postgres_changes` subscription (INSERT on `strava_activities`) in `useFocusData.ts` to bust `focus_state_cache_v1` and trigger reload after Strava sync.

---

## 2026-03-04: Design System + i18n Infrastructure + Profile Redesign

- Created `design-system.md` — full token reference
- Set up i18next with AsyncStorage persistence + device locale detection (`src/i18n/`)
- Created `en.json` + `es.json` for core screens
- Rewrote `SettingsScreen.tsx` as glassmorphism ProfileScreen
- Applied `t()` to HomeHeader, SyncStatusSheet, tab labels, FocusScreen

---

## 2026-03-04: Strava Auth Fix (`authService.currentUser` always undefined)

Root cause: `AuthService` has no `currentUser` property. Fixed by replacing 4 usages with `await supabase.auth.getUser()`.

---

## 2026-03-04: Strava Full Activity Detail Pipeline

Per-activity fetch (splits/zones/best efforts/laps), redesigned activity list, detail screen, Today tab integration. Run `npx supabase db push` for migration.

---

## 2026-03-04: Sync Status Bottom Sheet

Non-blocking animated bottom sheet for ring connection/sync progress with per-metric checkmarks.

---

## 2026-03-04: Focus/Readiness Screen (Coach Tab)

Readiness score ring, illness watch, last run context cards. FAB → AIChatScreen.

---

## 2026-03-04: Battery Charging State in Header

Native bridge extracts `isCharging` from X3 SDK `dicData`. ⚡ bolt shown in HomeHeader when charging.

---

## 2026-04-21: Sentry monitor — optimized routine + auto-merge + EAS update skill

**What changed:**

1. **PR #2 merged to main** — `Array.isArray` guard on `event.breadcrumbs?.values` in `beforeSend` (`app/_layout.tsx:21`). Fixes Sentry issues 7406743701 and 7408046962.

2. **`sentry-fixes` integration branch created** — all future Sentry auto-fixes flow through `sentry/fix-{id}` → `sentry-fixes` → `main` instead of directly to main. Blocked by a Git namespace constraint: `sentry/fix-7408046962` (old branch) prevents creating `refs/heads/sentry`; using `sentry-fixes` until that stale branch is deleted from GitHub.

3. **`scripts/sentry-monitor.sh`** — new optimised monitoring script:
   - Server-side 24 h filter (`lastSeen:>yesterday`) — no client-side filtering
   - Hard-coded slug `focus-app` — slug discovery step removed
   - Idempotency: skips branch creation if `sentry/fix-{id}` already exists remotely
   - `git pull --rebase` before every report commit — prevents merge conflicts
   - **Connection/sleep issues** (matching `connect|disconnect|ble|sleep|hypnogram|…`) flagged only, never auto-merged
   - Clean fixes: create branch → commit → push → `gh pr create --base sentry-fixes` → `gh pr merge --squash --auto`
   - After all fixes, if no flagged issues: merge `sentry-fixes` → `main`, run `eas update`

4. **`.claude/skills/eas-update.md`** — new `/eas-update` skill. Installs `eas-cli` if missing, checks `EXPO_TOKEN`, runs `eas update --branch production --non-interactive`. Includes full setup instructions for adding `EXPO_TOKEN` to `.claude/settings.json` for remote (web) sessions.

**Files created:**
- `scripts/sentry-monitor.sh`
- `.claude/skills/eas-update.md`

**Source:** Claude Code — automated sentry monitor session

---

## 2026-04-27: Trends Tab — replaces Health tab

**What changed:**

The Health tab is replaced by a new **Trends** tab. Instead of single-day score cards, the tab is a single scroll of three chart-first covers, each tapping into the existing detail pages.

**New covers:**

- **Sleep** — 7-day bar chart of sleep duration with personal baseline band (±1σ); sub-stats: avg score · avg deep · avg REM. Navigates to `/detail/sleep-detail`.
- **Recovery** — 30-day HRV line chart (monotone cubic) with personal baseline band; sub-stats: RHR · SpO₂ · temperature. Navigates to `/detail/recovery-detail`.
- **Activity** — 7-day steps bar chart (no band — activity is goal-relative, not baseline-relative); sub-stats: strain · workouts · avg steps. Navigates to `/detail/activity-detail`.

**Baseline band:** `bandFromBaseline(arr)` returns `{ min, max, mean }` (±1σ) or `null` when < 3 samples. Covers show "still calibrating" subtitle in that case. Baseline key in AsyncStorage is `focus_baselines_v3` (not v1 as stale docs suggested).

**Files created:**
- `src/utils/baselineStats.ts` — `mean`, `stdDev`, `bandFromBaseline`
- `src/components/trends/TrendLineChart.tsx` — SVG line+area+band chart (memoized)
- `src/components/trends/TrendSubStat.tsx` — shared `TrendSubStat` + `TrendSubStatDivider`
- `src/components/trends/trendLayout.ts` — shared `TREND_CHART_W` constant
- `src/components/trends/SleepTrendCover.tsx`
- `src/components/trends/RecoveryTrendCover.tsx`
- `src/components/trends/ActivityTrendCover.tsx`
- `src/screens/TrendsScreen.tsx`
- `app/(tabs)/trends.tsx`

**Files modified:**
- `app/(tabs)/_layout.tsx` — health → trends tab (SF symbol: chart.bar)
- `src/components/detail/TrendBarChart.tsx` — added optional `bandRange` prop
- `src/i18n/locales/en.json` + `es.json` — added `tabs.trends` + `trends.*` namespace

**Files deleted:**
- `app/(tabs)/health.tsx`
- `src/screens/StyledHealthScreen.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-27: Trends — edge-to-edge cards + trend status line

- Removed `paddingHorizontal: 20` from TrendsScreen scroll content — cards now go edge-to-edge. Title keeps its own `paddingHorizontal: 20`.
- Added a one-line trend status description inside each cover above the chart (hidden while loading). Examples: "↑ More sleep than usual", "↓ HRV declining", "→ Consistent effort".
- Added `trendDirection(values, recentCount)` to `src/utils/baselineStats.ts` — compares avg of most-recent N values vs older values; returns `'up' | 'down' | 'stable'` (5% threshold, most-recent-first input).
- Added 9 i18n keys (`trends.sleep_improving/declining/stable`, `recovery_*`, `activity_*`) to `en.json` and `es.json`.

**Files modified:**
- `src/screens/TrendsScreen.tsx`
- `src/utils/baselineStats.ts`
- `src/components/trends/SleepTrendCover.tsx`
- `src/components/trends/RecoveryTrendCover.tsx`
- `src/components/trends/ActivityTrendCover.tsx`
- `src/i18n/locales/en.json` + `es.json`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-27: Trends — header alignment + blue/violet background

- **Baseline % moved to `headerRight`**: now space-between with the title in the gradient card header row (icon · title ········ baseline% ›). Used `showArrow={false}` + custom `TrendHeaderRight` component (muted text + chevron icon) added to `TrendSubStat.tsx`.
- **`headerSubtitle` simplified** to just the unit: `"7-day avg"` (Sleep), `"ms"` (Recovery), `"steps"` (Activity).
- **Blue/violet gradient background** on `TrendsScreen` — two stacked `LinearGradient` layers (same technique as AIChatScreen): deep navy base (`#06060F → #0C0C28 → rgba(22,8,55)`) + a violet crossfade overlay.

**Files modified:**
- `src/components/trends/TrendSubStat.tsx` — added `TrendHeaderRight`
- `src/components/trends/SleepTrendCover.tsx`
- `src/components/trends/RecoveryTrendCover.tsx`
- `src/components/trends/ActivityTrendCover.tsx`
- `src/screens/TrendsScreen.tsx`
- `src/i18n/locales/en.json` + `es.json` — added `trends.avg_label`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-27: Trends — bg fix + card margin

- Fixed gradient background not rendering: inner `SafeAreaView` had `backgroundColor: colors.background` covering the gradient layers. Changed it to a transparent `safeArea` style (`flex: 1` only).
- Added `paddingHorizontal: 5` to scroll content — cards now have a 5px margin on each side.

**Files modified:** `src/screens/TrendsScreen.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-27: Trends — glass blur cards + 10px margins

- Each cover card wrapped in `BlurView` (intensity 22, tint "dark") for frosted glass effect. `GradientInfoCard` set to `backgroundColor: transparent` so the blur shows through; content container uses `rgba(255,255,255,0.07)`.
- Shared `CARD_BLUR_STYLE` (borderRadius 20, overflow hidden, 1px white border) exported from `trendLayout.ts`.
- `paddingHorizontal` increased from 5 to 10; title padding aligned to 10.

**Files modified:**
- `src/components/trends/trendLayout.ts`
- `src/components/trends/SleepTrendCover.tsx`
- `src/components/trends/RecoveryTrendCover.tsx`
- `src/components/trends/ActivityTrendCover.tsx`
- `src/screens/TrendsScreen.tsx`

**Source:** Claude Code — Macbook Pro

---

## 2026-04-27: Trends — Running cover (4th card)

Added a **Running** cover as the 4th card on the Trends tab. Only renders when Strava run data exists (returns `null` otherwise).

**Data:** `useRunningHistory` hook — queries `strava_activities` for the last 8 weeks, filters for Run/TrailRun/VirtualRun/Treadmill, groups by calendar week (Monday key), returns `WeekRunData[]` most-recent-first.

**Cover:**
- Header value: this week's km (e.g. "24.5 km")
- `headerRight`: "this week ›" label
- 8-week bar chart of weekly km (Strava orange `#FC4C02`)
- Status line: "↑ More km than usual" / "↓ Less mileage lately" / "→ Consistent mileage"
- Sub-stats: avg pace (min:sec /km) · total runs · longest run
- Taps into `/(tabs)/coach/strava`

**Files created:**
- `src/hooks/useRunningHistory.ts`
- `src/components/trends/RunningTrendCover.tsx`

**Files modified:**
- `src/screens/TrendsScreen.tsx`
- `src/i18n/locales/en.json` + `es.json`

**Source:** Claude Code — Macbook Pro
