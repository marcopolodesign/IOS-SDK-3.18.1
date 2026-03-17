# Catchup — Implementation Log

Reverse-chronological record of completed implementations. Updated after every successful feature/fix.

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
