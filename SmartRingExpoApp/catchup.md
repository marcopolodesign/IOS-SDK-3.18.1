# Catchup — Implementation Log

Reverse-chronological record of completed implementations. Updated after every successful feature/fix.

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
