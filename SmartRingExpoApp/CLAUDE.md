# Claude Code Project Guide

This document provides context for Claude Code when working on this Expo/React Native project.

> **📝 MANDATORY:** After completing ANY implementation (feature, fix, refactor — anything that changes code), you MUST automatically update `catchup.md` with a concise entry of what was implemented. Do NOT ask the user — just do it. Also add a summary to the "Recent Changes" section below. This is non-negotiable and applies to every task, including plans that were executed.
>
> **Source tagging & pull rule:** Every catchup entry MUST include a `**Source:**` line (e.g. `Claude Code — Macbook Pro`, `Claude App — iPhone`, `Claude.ai — web`). Before writing the entry, read the most recent entry's `**Source:**` field. If it differs from the current session's source, run `git pull origin main` first to avoid overwriting changes made from another device.

> **🔍 MANDATORY — Code Quality Gate:** After completing a code-changing task, review for reuse, quality, and efficiency before updating catchup.md.
> - **Small changes (1-2 files):** Do a quick inline review yourself — check for duplicated utilities, unused imports, missing cleanup. No agent needed.
> - **Large changes (3+ files):** Run `/simplify` which spawns a single Sonnet reviewer agent.
> - The flow is: **implement → review/simplify → catchup.md**
> - Do NOT skip the review. Do NOT ask the user. Just do it.

## Project Overview

Smart Ring Expo App - A React Native app using Expo SDK 54 for health monitoring via the **Jstyle/X3 SDK only**.

## Active SDK

> **CRITICAL: Only the Jstyle/X3 SDK is used.** QCBand SDK is present in the repo but is NOT active and must NEVER be used, referenced, imported, or called. All ring communication goes through `JstyleBridge.m` (native) → `JstyleService.ts` → `UnifiedSmartRingService.ts`.
>
> **BLOCKLIST — never use any of these:**
> - `QCBandService` / `QCBandBridge` / `QCBandSDK`
> - Any file in `ios/Frameworks/QCBandSDK.framework`
> - Any import or reference to QCBand anywhere in new code

## SDK Reference Rule

> **IMPORTANT:** When implementing SDK features, fixing data issues, or adding new ring data types, **ALWAYS check the X3 demo project** at `IOS (X3)/Ble SDK Demo/` and the native bridge files at `ios/JstyleBridge/` for reference implementation patterns before writing code. The demo project contains working examples for all data types (sleep, steps, heart rate, HRV, SpO2, temperature, battery).

## Figma

> **IMPORTANT:** When implementing UI from Figma, always use the **Figma MCP** (`claude.ai Figma` / `mcp__claude_ai_Figma__*`) tools — NOT any other Figma integration. Use `get_design_context` with the fileKey and nodeId extracted from the Figma URL.

## Animations

> **IMPORTANT:** For stagger/entrance animations, use `react-native-reanimated` — NOT RN's built-in `Animated` API. Follow this pattern (see `connect.tsx` welcome screen as reference):
> - `useSharedValue` for opacity (0→1) and translateY (80→0)
> - `useAnimatedStyle` to create animated style objects
> - `withDelay` + `withTiming` for staggered entrances
> - Easing: `Easing.bezier(0.4, 0, 0, 1)` (custom bezier)
> - Duration: 600ms
> - Stagger delays: 200ms, 225ms, 235ms (tight stagger)
> - Use `Reanimated.Text`, `Reanimated.View` (default export from `react-native-reanimated`)

## Design Conventions

- **Feature inspiration:** Reference Oura Ring and Ultrahuman for design and feature patterns
- **Design system:** Always check `design-system.md` for color tokens, spacing, and component patterns before creating UI
- **Background colors:** Use `colors.background` (#0D0D0D), `colors.surface` (#1A1A2E), `colors.card` (#1E1E32) from `src/theme/colors.ts`
- **Bottom sheets:** Use `@gorhom/bottom-sheet` for all modal/overlay content
- **Cards:** Glass-morphism style — `rgba(255,255,255,0.07)` bg, `rgba(255,255,255,0.12)` border, `borderRadius.xl` (16px)
- **Collapsible cards:** Use the same expand/collapse pattern as ReadinessCard, IllnessWatchCard
- **No green accents:** Do NOT use `#00D4AA` / `colors.primary` (teal/green) for UI accents, highlights, chips, or progress elements. Use `colors.tertiary` (`#6B8EFF`, blue) instead. The teal/green tone was rejected by the user.
- **Component consistency:** Always reuse existing components before creating new ones. Extend existing components with special props (e.g. `accentColor`, `variant`, `gradientColors`) rather than duplicating similar UI. When a new screen needs a card, check `src/components/home/` first. Consistency across screens is a hard requirement.

## Data Architecture

- **Supabase is source of truth** for historical data. Ring data is fallback when Supabase has no data.
- **User ID:** Never use `authService.currentUser` (it's always undefined). Always use `supabase.auth.getUser()` directly.
- **Sync services** must handle: no user ID, no data, JSON parse errors gracefully.
- **Native bridge calls** must always use `withNativeTimeout()` wrapper to prevent hanging promises.
- **Sleep quality enum:** SDK values are 1=awake, 2=light, 3=deep (not the reverse).

## i18n Rules

- All user-facing strings MUST use `t()` from `react-i18next`
- Supported locales: `en`, `es` (fallback: `en`)
- Keys use dot notation by domain: `sleep.title`, `activity.no_data`, `settings.language`
- After any new feature, run `/translate` to audit for missed hardcoded strings
- Spanish translations should be natural Latin American Spanish

## File Naming Conventions

- Components: `PascalCase.tsx` in `src/components/{domain}/`
- Hooks: `useCamelCase.ts` in `src/hooks/`
- Services: `PascalCaseService.ts` in `src/services/`
- Types: `camelCase.types.ts` in `src/types/`
- Migrations: `YYYYMMDD_description.sql` in `supabase/migrations/`

## TestFlight / xcodebuild Rule

> **RECURRING BUG:** `xcodebuild` fails with "Workspace SmartRing.xcworkspace does not exist at SmartRingExpoApp/ios/SmartRing.xcworkspace". **Root cause:** Xcode's Organizer window stays open in the background and re-triggers an archive using a relative path whenever a new archive lands. **Fix: always run `killall Xcode 2>/dev/null || true` before any xcodebuild archive command.**
>
> Additionally, **always use absolute paths** for `-workspace`, `-archivePath`, `-exportPath`, and `-exportOptionsPlist`. Never use relative paths with xcodebuild.
>
> Correct pre-archive sequence (always):
> ```bash
> killall Xcode 2>/dev/null || true
> xcodebuild \
>   -workspace /Users/mataldao/Local/Focus/SmartRingExpoApp/ios/SmartRing.xcworkspace \
>   -archivePath /Users/mataldao/Local/Focus/SmartRingExpoApp/ios/build/SmartRing.xcarchive \
>   ...
> ```

## Native Rebuild Rule

> After ANY change to files in `ios/JstyleBridge/`, `ios/SmartRing/`, `ios/Podfile`, or native plugins in `app.json`: notify the user that a native rebuild is needed, then automatically run `open ios/SmartRing.xcworkspace` to open Xcode. Hot reload does NOT pick up native changes.

## Workflow

- **ALWAYS** update `catchup.md` after completing any implementation. Do not skip this. Do not ask — just write the entry automatically.
- Use conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- When debugging data issues, trace the full pipeline: Native Bridge → JstyleService → useHomeData → UI Component
- **Migrations:** After creating any Supabase migration file, ALWAYS run `npx supabase db push` immediately. Do NOT tell the user to run it — just run it yourself.
- **Explain changes from a frontend perspective.** When summarizing what was done, describe the user-visible result (what the user will see, how the UI behaves) — not just which files or functions changed.

## Recent Changes

### 2026-04-10: Sleep Hypnogram — Continuous Gradient Step Figure

**Design:** The hypnogram figure (`src/components/home/SleepHypnogram.tsx`) is now a continuous step chart using a single figure-wide vertical `LinearGradient` (`gradientUnits="userSpaceOnUse"`). All blocks and connectors share `fill="url(#sleepGradient)"` — no per-stage colors on the figure.

**Gradient palette (awake top → deep bottom):**
- Awake: `#FFFFFF` (pure white)
- REM: `#F5DEDE` (near-white pink)
- Core: `#CC3535` (medium maroon)
- Deep: `#8C0B0B` (dark maroon)

**Structure:** Per-segment `<Rect>` blocks (no rounded corners) + 0.75px-wide `<Rect>` connector bars spanning top-of-higher-lane to bottom-of-lower-lane. Header row shows SLEPT / BEDTIME / WAKE stats (no chips).

> **INVARIANT:** `styles.summaryRow.height` and `styles.tooltipReplacement.height` in `SleepHypnogram.tsx` must always be equal — they occupy the same vertical slot and the tooltip swaps in place of the stat row on drag. Currently both are `50`. Comments in the stylesheet enforce this.

### 2026-03-22: Apple Health Full Rewrite (New Architecture)

**Implemented:** Replaced `react-native-health` with `@kingstinct/react-native-healthkit` v13 (Nitro Modules). Modular sub-services: HealthKitPermissions, HealthKitDataFetchers, HealthKitSleepProcessor, HealthKitSubscriptions. Fixed onboarding connect, redesigned Apple Health screen (glassmorphism + i18n), added HealthKit fallback in useHomeData when ring disconnected. Code quality pass via `/simplify` fixed 8 issues.

**Files created:** `src/services/HealthKit/` (4 sub-services), `app/(tabs)/settings/apple-health.tsx`, `.claude/agents/` (4 agents)
**Files modified:** `app.config.js`, `package.json`, `HealthKitService.ts`, `useHealthKit.ts`, `AppleHealthScreen.tsx`, `integrations.tsx`, `SettingsScreen.tsx`, `useHomeData.ts`, `en.json`, `es.json`, `CLAUDE.md`

### 2026-03-05: Full App i18n Translation Pass

**Completed:** All remaining hardcoded user-visible strings replaced with `t()` calls.

**New locale keys:** `strava.button_sync_athlete`, alert keys, `strava_detail.col_pace/go_back/label_activity`, `sleep_trend.value_none/status_no_data`, `hr_live.value_na`

**Files updated:** `DailyTimelineCard`, `StravaScreen`, `StravaActivityDetailScreen`, `AuthScreen`, `OnboardingScreen`, `LiveHeartRateCard`, `DailyHeartRateCard`, `DailySleepTrendCard`, `CalorieDeficitCard`, `ChatFAB` — plus `en.json` + `es.json`.

Also in this session:
- **Strava DB fix:** `npx supabase db push` applied `20260304_strava_detail_columns.sql` (missing `detail_fetched_at` column)
- **Focus Realtime:** Added Supabase Realtime subscription in `useFocusData.ts` to bust cache on new `strava_activities` INSERT

### 2026-03-04: Design System Docs + Profile Redesign + i18n

**Implemented:**

1. **`design-system.md`** — Comprehensive design system reference extracted from the codebase: color tokens, typography, spacing, border radius, shadows, glass card patterns, gradient presets, opacity hierarchy, and component patterns.

2. **i18n Infrastructure** — Full internationalization (English + Spanish):
   - Packages: `expo-localization`, `i18next`, `react-i18next`
   - `src/i18n/locales/en.json` — English translations for all key screens
   - `src/i18n/locales/es.json` — Spanish translations
   - `src/i18n/index.ts` — i18next init with AsyncStorage persistence + device locale detection
   - `src/hooks/useLanguage.ts` — `changeLanguage(lang)` hook with AsyncStorage persist
   - `app/_layout.tsx` — side-effect import `'../src/i18n'` at top

3. **Profile Screen Redesign** (`src/screens/SettingsScreen.tsx`) — Rewritten with glassmorphism design:
   - 60×60 avatar with `shadows.glow(colors.primary)` ring
   - Glass cards: `rgba(255,255,255,0.07)` bg + `rgba(255,255,255,0.12)` border + `borderRadius.xl`
   - Row separators: `rgba(255,255,255,0.06)` 1px bottom border
   - Language picker row with teal `EN`/`ES` chip → ActionSheet Alert
   - Goal preset chips with teal-tinted active state
   - Destructive sign-out button with glass-red border
   - All strings via `useTranslation()`

4. **t() Applied Across Screens:**
   - `src/components/home/HomeHeader.tsx` — greeting, reconnect, syncing, connecting
   - `src/components/home/SyncStatusSheet.tsx` — all phase labels, metric messages, count
   - `app/(tabs)/_layout.tsx` — tab labels (Today/Health/Coach)
   - `src/screens/FocusScreen.tsx` — title, all insight headlines/bodies

**Files Created:**
- `design-system.md`
- `src/i18n/index.ts`
- `src/i18n/locales/en.json`
- `src/i18n/locales/es.json`
- `src/hooks/useLanguage.ts`

**Files Modified:**
- `src/screens/SettingsScreen.tsx` (full rewrite as ProfileScreen)
- `app/_layout.tsx` (i18n import)
- `app/(tabs)/_layout.tsx` (translated tab labels)
- `src/components/home/HomeHeader.tsx` (translated strings)
- `src/components/home/SyncStatusSheet.tsx` (translated strings)
- `src/screens/FocusScreen.tsx` (translated title + insight copy)

**Key notes:**
- Language key: `app_language_v1` in AsyncStorage
- Supported langs: `en`, `es` (fallback: `en`)
- i18next init is synchronous with `'en'`, then async switches to saved/device lang
- Zero new TS errors introduced (all pre-existing errors in other files unchanged)

### 2026-03-04: Fix Strava Auth + Sync (authService.currentUser bug)

**Root cause:** `AuthService` class has no `currentUser` property — it's always `undefined`. All 4 `authService.currentUser?.id` calls in `StravaService.ts` returned `undefined`, causing:
- `loadTokensFromDatabase` → returns early → `isConnected` always `false` → shows "Connect" screen even after OAuth
- `saveTokensToDatabase` → never saved token to Supabase after OAuth
- `syncActivitiesToSupabase` → returns `{ success: false, count: 0 }` silently
- `disconnect` → always returns `false`

**Fix:** Added `private async getCurrentUserId()` helper that calls `supabase.auth.getUser()` directly. Replaced all 4 occurrences. Also removed stale `authService` import. Added comprehensive console logging to sync pipeline for debugging.

**Files Modified:** `src/services/StravaService.ts`, `src/screens/StravaScreen.tsx`

### 2026-03-04: Strava Full Activity Fetch + Visualization

**Implemented:** Complete Strava detail pipeline — fetch per-activity splits/zones/best efforts, redesigned activity list, activity detail screen, and Today tab integration.

**Files Created:**
- `supabase/migrations/20260304_strava_detail_columns.sql` — Adds `suffer_score, average_cadence, average_speed, max_speed, pr_count, elev_high, elev_low, zones_json, splits_metric_json, laps_json, best_efforts_json, detail_fetched_at` to `strava_activities`
- `src/screens/StravaActivityDetailScreen.tsx` — Detail screen: Hero, Summary Stats, HR Zones bars, Km Splits, Best Efforts, Laps
- `app/(tabs)/settings/strava-detail.tsx` — Route shell for detail screen

**Files Modified:**
- `src/types/strava.types.ts` — Added `StravaSplit, StravaLap, StravaBestEffort, StravaHRZone, StravaHRZones, StravaActivityDetail, StravaActivitySummary` interfaces
- `src/types/supabase.types.ts` — Added new detail columns to `strava_activities` Row/Insert/Update types
- `src/services/StravaService.ts` — Added `getActivityDetail(id)` (parallel fetch of `/activities/{id}` + `/activities/{id}/zones`), `syncAllActivityDetails(userId, onProgress)` (rate-limited 1 req-pair/sec, skips already-fetched), `syncActivitiesToSupabase` default days: 30→60
- `src/screens/StravaScreen.tsx` — Full redesign: dark glass-morphism, "Training" header, all-time stats GlassCard, filter tabs (All/Runs/Rides/Hikes), activity list with sport-color left border, pace/elev/suffer badges, tap→detail navigation, sync shows detail progress "Syncing details… X/Y"
- `src/hooks/useHomeData.ts` — Added `stravaActivities: StravaActivitySummary[]` to HomeData, Supabase query for last 7 days, Strava suffer_score blended into strain formula (65% Strava / 35% cal when today has Strava data)
- `src/screens/home/ActivityTab.tsx` — Added `StravaWorkoutCard`, fallback to Strava activities in "Recent Workouts" when ring has no workouts
- `src/components/home/DailyTimelineCard.tsx` — Added `strava_activity` event kind (Strava orange #FC4C02), `distanceLabel` chip, `stravaActivities` prop — today's Strava runs appear in Cronología timeline
- `src/screens/home/OverviewTab.tsx` — Passes `stravaActivities={homeData.stravaActivities}` to DailyTimelineCard

**Key implementation notes:**
- Run: `npx supabase db push` to apply migration before testing
- Strava detail sync caches via `detail_fetched_at` — re-runs are no-ops for already-fetched activities
- Sport colors: Run/TrailRun = `#FC4C02`, Ride = `#6B8EFF`, Hike = `#FFB84D`, Swim = `#B16BFF`
- Strava activities query: selects only needed columns (no `raw_data`) for performance

### 2026-03-04: Sync Status Bottom Sheet

**Implemented:**

Non-blocking bottom sheet that slides up during ring connection/sync. Today screen remains fully scrollable and interactive underneath (no backdrop). Auto-dismisses 1.5s after sync completes.

**Files Created:**
- `src/types/syncStatus.types.ts` — SyncPhase, MetricKey, MetricStatus, MetricSyncState, SyncProgressState types

- `src/components/home/SyncStatusSheet.tsx` — BottomSheetModal with BlurView background, animated Reanimated SVG progress arc (pulsing/filling), phase label crossfade, 7 metric rows with spring checkmark animation

**Files Modified:**
- `src/hooks/useHomeData.ts` — Added `syncProgress: SyncProgressState` to HomeData, INITIAL_METRICS constant, `updateMetric` helper, full instrumentation of `fetchData()` (connecting → connected → syncing → complete phases + per-metric loading/done/error states)
- `src/screens/NewHomeScreen.tsx` — Added `syncSheetRef`, auto-present/dismiss effect on `syncProgress.phase`, renders `<SyncStatusSheet>` as last child

**Key implementation notes:**
- Phase transitions: connecting (pulsing 5→12%) → connected (12%, 200ms pause) → syncing (fills per completed metric) → complete (100%)
- Auto-dismiss: `setTimeout(dismiss, 1500)` when phase === 'complete'
- Cloud sync updates metric asynchronously via `.then()/.catch()` on `dataSyncService.syncAllData()`
- No backdrop — sheet renders above content, touches pass through to Today screen
- `isReconnecting` local state in NewHomeScreen untouched (still drives HomeHeader reconnect spinner)

### 2026-03-04: Focus/Readiness Screen (Coach Tab)

**Implemented:**

Replaced the Coach tab (previously `app/(tabs)/settings.tsx` → AIChatScreen) with a full Focus/Readiness screen. The Coach tab is now a Stack with:
- Root: FocusScreen (readiness score ring + 3 cards)
- FAB → push to AIChatScreen (`settings/chat`)

**Files Created:**
- `src/types/focus.types.ts` — ReadinessScore, IllnessWatch, LastRunContext, FocusBaselines, FocusState types
- `src/services/ReadinessService.ts` — Pure calculation: baseline persistence (AsyncStorage), readiness scoring (HRV/sleep/HR/training load), illness watch (5 signals), last run context (Supabase queries)
- `src/hooks/useFocusData.ts` — Supabase-only data orchestration, 6-hour cache, pull-to-refresh
- `src/components/focus/FocusScoreRing.tsx` — SVG circular gauge, teal/amber/red by score
- `src/components/focus/ReadinessCard.tsx` — Collapsible, 4 component bars with relative labels
- `src/components/focus/IllnessWatchCard.tsx` — Collapsible, 5 signal rows (CLEAR/WATCH/SICK)
- `src/components/focus/LastRunContextCard.tsx` — Collapsible, effort verdict + body state retrospective
- `src/components/focus/ChatFAB.tsx` — Floating pill button → router.push('/(tabs)/settings/chat')
- `src/screens/FocusScreen.tsx` — Main screen, SafeAreaView + ScrollView + FAB overlay
- `app/(tabs)/settings/_layout.tsx` — Stack layout (headerShown: false)
- `app/(tabs)/settings/index.tsx` — FocusScreen entry
- `app/(tabs)/settings/chat.tsx` — AIChatScreen entry

**Files Deleted:**
- `app/(tabs)/settings.tsx` — replaced by settings/ directory

**Key implementation notes:**
- Supabase column names: `hrv_readings.recorded_at`, `sleep_sessions.start_time + sleep_score`, `strava_activities.distance_m + moving_time_sec + sport_type`
- Baselines stored in AsyncStorage key `focus_baselines_v1` (rolling 14-day window)
- Cache key: `focus_state_cache_v1` (6-hour TTL)
- TypeScript `data: never` errors from Supabase are pre-existing in the codebase (not introduced here)

### 2026-03-04: Battery Charging State in Header Indicator

**Implemented:**

Added ⚡ charging indicator next to battery % in `HomeHeader` when ring is charging.

1. **Native bridge** (`ios/JstyleBridge/JstyleBridge.m`): `handleBatteryData:` now extracts `charging`/`chargeStatus`/`isCharging` key from X3 SDK `dicData` and includes `isCharging` in the resolved dict (defaults to `@NO` if key absent).

2. **JstyleService** (`src/services/JstyleService.ts`): `getBattery()` now reads `isCharging`/`charging` from native result and returns it in the `BatteryData` object.

3. **useHomeData** (`src/hooks/useHomeData.ts`): Added `isRingCharging: boolean` to `HomeData`, `CachedData`, default state, battery fetch block, `setData` payload, and both cache normalization passes.

4. **NewHomeScreen** (`src/screens/NewHomeScreen.tsx`): Passes `isCharging={homeData.isRingCharging}` to `HomeHeader`.

5. **HomeHeader** (`src/components/home/HomeHeader.tsx`): Added `isCharging?` prop, `ChargingBoltIcon` SVG component (8×12 lightning bolt), wraps battery text in `batteryValueRow` row with bolt shown when charging, added `batteryValueRow` style.

**Files Modified:**
- `ios/JstyleBridge/JstyleBridge.m`
- `src/services/JstyleService.ts`
- `src/hooks/useHomeData.ts`
- `src/screens/NewHomeScreen.tsx`
- `src/components/home/HomeHeader.tsx`
- `CLAUDE.md`

### 2026-02-24: Live HR Last Reading Persistence + BUSY/Reconnect Spiral Fixes

**Implemented:**

1. **Native pending-request timeout recovery (Jstyle bridge)**
   - Added native pending-data watchdog timer (`20s`) in `JstyleBridge.m`.
   - Added explicit JS-callable `cancelPendingDataRequest()` method to force release stale pending resolver state.
   - Added pending cleanup on connection transitions (connect success, disconnect, connect failure).
   - Added `DataError_X3` handling to reject pending requests and clear accumulated buffers.

2. **JS timeout/busy recovery in queued native calls**
   - Enhanced `enqueueNativeCall()` in `JstyleService.ts`:
     - On timeout/BUSY for pending-resolver operations, calls native `cancelPendingDataRequest()`.
     - Adds bounded BUSY retry (1 retry) only for read-only idempotent operations.
   - Keeps existing serialized queue and bounded timeout behavior.

3. **Reconnect dedupe in Unified service**
   - Added `autoReconnectInFlight` guard in `UnifiedSmartRingService.ts` to dedupe concurrent reconnect attempts.
   - Added short-circuit for already-connected state (Jstyle/QCBand) before reconnect attempts.

4. **Home sync hardening**
   - Updated `useHomeData.ts` to:
     - Skip `autoReconnect()` when already connected.
     - Wrap fetch flow in `try/finally` so `isFetchingData` always resets.
     - Preserve bounded sleep retries while reducing reconnect churn.

5. **Removed background BLE contention**
   - `ActivityTab` and `SleepTab` no longer auto-reconnect/fetch while inactive or while home sync is running.
   - Added `isActive` gating from `NewHomeScreen` tab index to run tab-specific fetches only when tab is visible.

6. **Settings screen background contention fix**
   - Replaced `useEffect` settings load with `useFocusEffect` in `SettingsScreen.tsx`.
   - On Jstyle (or unknown type), load only step goal (skip unsupported profile fetch) to avoid hidden BLE contention.

7. **Live HR persistence for instant idle display**
   - `LiveHeartRateCard.tsx` now stores last successful live reading in AsyncStorage:
     - key: `live_hr_last_measurement_v1`
     - payload: `{ heartRate, measuredAt, deviceId? }`
   - Loads and displays last value/time in idle state instead of defaulting to `"Ready"`.
   - Only persists non-zero successful readings (end-of-countdown or manual stop with valid sample).

**Files Modified:**
- `ios/JstyleBridge/JstyleBridge.m`
- `src/services/JstyleService.ts`
- `src/services/UnifiedSmartRingService.ts`
- `src/hooks/useHomeData.ts`
- `src/screens/home/ActivityTab.tsx`
- `src/screens/home/SleepTab.tsx`
- `src/screens/NewHomeScreen.tsx`
- `src/screens/SettingsScreen.tsx`
- `src/components/home/LiveHeartRateCard.tsx`
- `CLAUDE.md`

### 2026-02-23: X3 HR Reliability + Live HR Demo Parity

**Implemented:**

1. **Native bridge busy guard + pending request safety**
   - Added strict `BUSY` rejection in `JstyleBridge.m` when a data request is already in flight.
   - Applied to all pending-resolver methods (`getBatteryLevel`, `getStepsData`, `getSleepData`, `getHeartRateData`, `getSpO2Data`, `getTemperatureData`, `getHRVData`, `syncTime`, `getDeviceTime`, `getStepGoal`, `setStepGoal`, `getMacAddress`, `factoryReset`).
   - Added centralized pending-request helpers and cleanup.
   - Pending requests are now rejected/cleared on disconnect to avoid stale hangs.

2. **Live HR sequencing now mirrors demo behavior**
   - In native `startHeartRateMeasurement`, realtime stream (`RealTimeDataWithType:1`) is sent before manual HR command.
   - `LiveHeartRateCard` now starts in this order:
     1. `autoReconnect()`
     2. `startRealTimeData()`
     3. `startHeartRateMeasuring()`
   - Primary live HR source is now `onRealTimeData.heartRate` (demo-consistent), with `onMeasurementResult` as fallback.
   - Card cleanup now explicitly stops both manual measurement and realtime data.

3. **Serialized Jstyle native call queue with bounded timeouts**
   - Added `enqueueNativeCall()` in `JstyleService.ts` to enforce one-at-a-time native data calls.
   - Routed Jstyle data pulls through queue (battery, firmware, steps, sleep, continuous HR, HRV, SpO2, temperature, time/goal/mac/factory reset commands that use pending resolvers).
   - Preserved bounded timeout behavior; queue wait occurs before per-call timeout starts.
   - Added normalized native error surface (`BUSY`, `NOT_CONNECTED`) for predictable fallbacks.

4. **Continuous HR normalization fixed for X3 packet shape**
   - `getContinuousHeartRate()` now correctly flattens:
     - `arrayContinuousHR: [{ date, arrayHR }]`
     - into records with `arrayDynamicHR`, `startTimestamp`, `date`.
   - Added robust local-time parsing for `YYYY.MM.DD HH:mm:ss`.
   - Kept backward compatibility when `arrayDynamicHR` already exists.

5. **Reduced competing BLE requests from home sleep trend card**
   - Replaced 7-day loop fetch in `DailySleepTrendCard` with context-first data usage.
   - Added optional one-time day-0 fallback native fetch only when context data is missing.
   - Prevents repeated concurrent BLE calls during home sync.

6. **Compatibility and typing updates**
   - Updated `DailyHeartRateCard` and `useHomeData` to tolerate both normalized and raw HR packet shapes.
   - Added `heartRate?` and `stress?` to `HRVData` in `sdk.types.ts` to match existing usage.

7. **HR card touch/drag interaction parity with hypnogram**
   - Added `PanResponder`-based drag interaction to `DailyHeartRateCard`.
   - Dragging across the chart now updates selected hour range continuously (same interaction model as sleep hypnogram).
   - Selection/cursor resets on release/terminate to match hypnogram behavior.

**Files Modified:**
- `ios/JstyleBridge/JstyleBridge.m`
- `src/services/JstyleService.ts`
- `src/components/home/LiveHeartRateCard.tsx`
- `src/components/home/DailySleepTrendCard.tsx`
- `src/components/home/DailyHeartRateCard.tsx`
- `src/hooks/useHomeData.ts`
- `src/types/sdk.types.ts`

### 2026-02-15: Fixed Multiple App Issues (Sleep Chart, Overlay, HealthKit, Navigation)

**Issues Fixed:**

1. **Sleep stages hypnogram chart now renders** - Previously `segments: []` was hardcoded in `useHomeData.ts`. Now raw `arraySleepQuality` data from the X3 SDK is parsed into `SleepSegment[]` for the hypnogram. Also fixed inverted deep/awake mapping in `JstyleService.getSleepByDay()` (SDK: 1=awake, 3=deep, not vice versa).

2. **Add overlay no longer appears on app load** - Changed `add.tsx` from `useEffect` (fires on mount) to `useFocusEffect` (fires only when tab is focused). Added `router.canGoBack()` safety check to prevent GO_BACK navigation error.

3. **HealthKit error silenced** - Disabled HealthKit integration (set `AppleHealthKit = null`) since `react-native-health` module has API compatibility issues. Cleaned up all debug `fetch()` calls to `127.0.0.1:7242`.

4. **ring.tsx warning fixed** - Added minimal default export to silence "missing required default export" warning.

**Files Modified:**
- `src/types/sdk.types.ts` - Added `SleepQualityRecord` interface and `rawQualityRecords` to `SleepData`
- `src/services/JstyleService.ts` - Fixed sleep quality enum mapping (1=awake, 3=deep), returns raw quality records
- `src/hooks/useHomeData.ts` - Added `buildSleepSegments()` function to parse raw quality arrays into hypnogram segments
- `src/services/HealthKitService.ts` - Disabled HealthKit, cleaned debug logs
- `app/(tabs)/add.tsx` - Changed to `useFocusEffect`, added `canGoBack()` check
- `app/(tabs)/ring.tsx` - Added default export

### 2026-02-15: Fixed UI Data Display Issue (Native Bridge Timeout Protection)

**Problem:** Sleep data was successfully fetched from X3 ring (65 score, 5h 49m) but nothing displayed in UI. Investigation revealed `Promise.allSettled()` was hanging indefinitely because native bridge calls had no timeout mechanism.

**Root Cause:**
- `JstyleBridge.getStepsData()` and `JstyleBridge.getBatteryLevel()` native calls could hang forever if iOS SDK failed to invoke callbacks
- This blocked `Promise.allSettled()` from completing, preventing `setData()` from being called
- Without state updates, React components showed empty/zero values despite successful data fetching

**Solution Implemented:**
1. Added `withNativeTimeout()` helper function in `src/services/JstyleService.ts`
   - Wraps native promises with `Promise.race()` and timeout rejection
   - Ensures all promises settle within 5-10 seconds (succeed or timeout)

2. Wrapped **11 critical native bridge methods** with timeout protection:
   - `getSteps()` - 5s timeout (was blocking Promise.allSettled)
   - `getBattery()` - 5s timeout (was blocking Promise.allSettled)
   - `getSleepData()` - 10s timeout (pagination needs more time)
   - `getContinuousHeartRate()` - 10s timeout
   - `getHRVData()` - 10s timeout
   - `getSpO2Data()` - 10s timeout
   - `getTemperatureData()` - 10s timeout
   - `getFirmwareInfo()` - 5s timeout
   - `setTime()` - 5s timeout
   - `getGoal()` - 5s timeout
   - `setGoal()` - 5s timeout

**Impact:**
- ✅ `Promise.allSettled()` now always completes, even if individual fetches timeout
- ✅ `setData()` is always called, triggering React re-renders
- ✅ UI displays available data (sleep shows real values even if steps/battery fail)
- ✅ Graceful degradation: failed fetches show zeros instead of blocking everything

**Files Modified:**
- `src/services/JstyleService.ts` - Added timeout wrapper + wrapped all bridge calls

**Testing:**
- Expo logs now show complete fetch flow: "All parallel fetches done" → "setData() called"
- Overview tab displays real sleep score (65), time asleep (5h 49m), bed/wake times
- Sleep tab shows detailed sleep data
- Partial data works: if steps timeout, sleep data still displays

### 2026-02-15: BLE Connection Stability Improvements

**Changes:**
- Added native-side automatic reconnection with repeating timer (6-second intervals) in `JstyleBridge.m`
- Implemented connection state tracking (`isDisconnecting` flag) to distinguish intentional vs accidental disconnects
- Added `withNativeTimeout()` protection and connection options:
  - `CBConnectPeripheralOptionNotifyOnDisconnectionKey: YES`
  - `CBConnectPeripheralOptionEnableTransportBridgingKey: YES` (iOS 13+)
- Updated `NewBle.m` to use connection options for improved reliability
- Added reconnection helper methods: `startReconnectionTimer:`, `stopReconnectionTimer`, `attemptReconnectionWithTimer:`

**Files Modified:**
- `ios/JstyleBridge/JstyleBridge.m` - Connection stability, auto-reconnect
- `ios/JstyleBridge/NewBle.m` - Connection options

## Expo MCP Integration

This project uses **Expo MCP** (Model Context Protocol) to give Claude Code direct access to Expo tooling and documentation.

### Setup

1. Install the expo-mcp package (already done):
   ```bash
   npx expo install expo-mcp --dev
   ```

2. Authenticate with Expo:
   ```bash
   npx expo login
   ```

3. Start Expo with MCP enabled:
   ```bash
   EXPO_UNSTABLE_MCP_SERVER=1 npx expo start
   ```

4. Configure Claude Code to connect:
   ```bash
   claude mcp add expo-mcp --transport http https://mcp.expo.dev/mcp
   ```

5. Restart Claude Code to load the MCP tools.

### Available MCP Tools

When the Expo MCP is connected, Claude Code has access to:

| Tool | Description |
|------|-------------|
| `search_documentation` | Search official Expo docs for any topic |
| `add_library` | Install Expo libraries with `expo install` |
| `expo_router_sitemap` | Query all routes in the expo-router app |
| `collect_app_logs` | Collect logs from device (logcat/syslog/console) |
| `automation_tap` | Tap on device by coordinates or testID |
| `automation_take_screenshot` | Take screenshot of app or specific view |
| `automation_find_view` | Find and inspect views by testID |
| `workflow` | Create/manage EAS workflow YAML files |
| `learn` | Load detailed docs on specific topics (e.g., expo-router) |
| `open_devtools` | Open React Native DevTools |
| `generate_claude_md` | Auto-generate this file |
| `generate_agents_md` | Generate AGENTS.md for other AI tools |

### Usage Examples

**Search documentation:**
```
"How do I set up push notifications in Expo?"
→ Claude will use search_documentation to find relevant docs
```

**Add a library:**
```
"Add expo-camera to the project"
→ Claude will use add_library to run expo install
```

**Debug the app:**
```
"Take a screenshot of the current screen"
→ Claude will use automation_take_screenshot
```

**Check routes:**
```
"What routes are defined in this app?"
→ Claude will use expo_router_sitemap
```

## Project Structure

```
SmartRingExpoApp/
├── app/                    # Expo Router pages
│   ├── (tabs)/            # Tab navigator screens
│   ├── (auth)/            # Auth flow screens
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # Screen implementations
│   ├── services/          # SDK and API services
│   ├── hooks/             # Custom React hooks
│   ├── theme/             # Colors and styling
│   └── types/             # TypeScript definitions
├── ios/
│   ├── Frameworks/        # Native SDK frameworks
│   └── SmartRing/         # Native bridge code
└── supabase/              # Supabase configuration
```

## Key Services

- **JstyleService** - Active SDK service for all ring communication (Jstyle/X3)
- **UnifiedSmartRingService** - Thin wrapper that routes to JstyleService
- **AuthService** - User authentication via Supabase
- **DataSyncService** - Cloud data synchronization
- **SupabaseService** - Database operations
- **BackgroundSleepTask** - Background fetch task (5 AM–11 PM): syncs sleep data from ring, schedules "Sleep Ready" local notification, runs full DataSyncService.syncAllData() at most once every 2 hours
- ~~QCBandService~~ - **NOT USED. Do not call.**

## Push Notifications

### Local notifications (device-side)
- Registered via `src/services/BackgroundSleepTask.ts` + foreground fallback `maybeSendSleepNotificationFromForeground()`
- "Your Sleep Analysis is Ready 🌙" — fires ~30 min after detected wake time
- Requires iOS notification permission; deeplinks to `smartring:///?tab=sleep`

### Server-side push (Supabase pg_cron → Edge Function)
Edge function: `supabase/functions/daily-summary-push/index.ts`
Auth: `Authorization: Bearer focus-notify-2026`

| Cron job | UTC | ART | Notification |
|----------|-----|-----|-------------|
| `daily-summary-push-morning` | 12:00 | 9 AM | Sleep summary (rich if synced, fallback "Your sleep summary is ready" if not) |
| `daily-summary-push-evening` | 23:00 | 8 PM | Activity summary (steps + avg HR); skipped if no data |
| `daily-wind-down-push` | 01:00 | 10 PM | Wind-down reminder based on last wake time → 8h sleep target |

**How cron calls edge function:**
- `trigger_daily_summary_push(type TEXT)` PL/pgSQL function in DB
- Reads `edge_function_url` and `notification_secret` from `app_config` table
- Calls `net.http_post` via `pg_net` extension
- `app_config` seeded by migration `20260416_wire_daily_push_via_app_config.sql`

**To add a new scheduled notification type:**
1. Add `type: "your-type"` branch to `daily-summary-push/index.ts`
2. Add `SELECT cron.schedule(...)` calling `trigger_daily_summary_push('your-type')` in a new migration
3. Deploy: `/deploy-functions daily-summary-push` then `npx supabase db push`

**To test immediately (skip the cron):**
```bash
curl -X POST https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1/daily-summary-push \
  -H "Authorization: Bearer focus-notify-2026" \
  -H "Content-Type: application/json" \
  -d '{"type": "morning"}'
```

### WhatsApp Daily Check-In (Twilio + Claude AI)
Edge function: `supabase/functions/whatsapp-checkin/index.ts`
Accepts `{ "type": "morning" | "evening" | "night" }` — 3 messages per day.

| Cron job | UTC | ART | Message type |
|----------|-----|-----|-------------|
| `whatsapp-morning` | 12:03 | 9:03 AM | Sleep recap + HRV + coaching tip |
| `whatsapp-evening` | 23:03 | 8:03 PM | Activity recap (steps, HR, trends) |
| `whatsapp-night` | 01:33 | 10:33 PM | Wind-down nudge + sleep deficit |

Each message ends with a tappable link from `app_config.whatsapp_app_link`.

**app_config keys:**
- `whatsapp_recipient` — e.g. `whatsapp:+5491169742032`
- `whatsapp_user_id` — (optional) override user_id; falls back to most recent daily_summaries user
- `whatsapp_app_link` — tappable link appended to each message (e.g. App Store URL)

**Required Supabase secrets (set once):**
```bash
npx supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxx \
  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
```
ANTHROPIC_API_KEY already set.

**Twilio sandbox note:** Recipient must opt in by sending `join <keyword>` to the sandbox number. Session expires after 72h of inactivity — re-send to reactivate.

**To test:**
```bash
# Test each type:
curl -X POST https://pxuemdkxdjuwxtupeqoa.supabase.co/functions/v1/whatsapp-checkin \
  -H "Authorization: Bearer focus-notify-2026" \
  -H "Content-Type: application/json" \
  -d '{"type":"morning"}'   # or "evening" or "night"
```

**Scaling path:** Add `whatsapp_numbers` table (user_id, phone, opted_in) + Settings toggle, then update edge function to loop over opted-in users.

## Development Commands

```bash
# Start with MCP enabled (for AI tooling)
EXPO_UNSTABLE_MCP_SERVER=1 npx expo start

# Standard start
npx expo start

# iOS build
npx expo run:ios

# Clear cache
npx expo start --clear

# Install Expo-compatible packages
npx expo install <package-name>
```

## Native SDK Integration

The app uses the **Jstyle/X3 BLE SDK** exclusively. Bridge: `ios/JstyleBridge/JstyleBridge.m`.

Frameworks present in `ios/Frameworks/` (only the X3 ones are active):
- CRPSmartBand.framework ✅ active (X3/Jstyle)
- RTKLEFoundation.framework ✅ active (X3/Jstyle)
- RTKOTASDK.framework ✅ active (X3/Jstyle)
- QCBandSDK.framework ❌ NOT used

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Testing Notes

- Mock mode available for testing without physical ring device
- iOS simulator cannot test Bluetooth features (requires physical device)
- Use `automation_take_screenshot` and `automation_find_view` for UI verification
