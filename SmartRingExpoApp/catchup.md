# Catch-Up Log

Append-only task log for agent code changes.

## Entry Format

- Date/Time:
- Summary:
- Files Changed:
- Follow-up/Risk:

---

- Date/Time: 2026-02-25 13:56:59 -03
- Summary: Created catch-up log and added mandatory instruction for agents to append this file after any code change.
- Files Changed: `AGENTS.md`, `catchup.md`
- Follow-up/Risk: Enforce this rule consistently in future tasks.

- Date/Time: 2026-02-25 13:59:18 -03
- Summary: Fixed `+` tab behavior so add overlay opens and user returns to the tab they triggered from instead of defaulting to Today.
- Files Changed: `src/context/AddOverlayContext.tsx`, `app/(tabs)/add.tsx`, `catchup.md`
- Follow-up/Risk: Route restore relies on tracked last non-add pathname; validate on all tab routes after navigation refactors.

- Date/Time: 2026-02-25 14:34:40 -03
- Summary: Improved Health vitals availability by adding resting HR fallback paths and extracting respiratory rate/resting HR from raw sleep payload fields when present.
- Files Changed: `src/hooks/useHomeData.ts`, `src/screens/StyledHealthScreen.tsx`, `catchup.md`
- Follow-up/Risk: Respiratory rate depends on SDK payload fields being present; if device firmware omits them, Health will still show no respiratory data.

- Date/Time: 2026-02-25 21:23:47 -0300
- Summary: Replaced iOS app icon with `Frame 91` from Downloads (resized to 1024x1024), backed up the previous icon, and validated builds. Generic simulator build fails due existing device-only `ios/JstyleBridge/libBleSDK.a` linkage; device build succeeds.
- Files Changed: `ios/SmartRing/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`, `ios/SmartRing/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.backup.png`, `catchup.md`
- Follow-up/Risk: Simulator builds will continue failing until `libBleSDK.a` includes simulator slices (or simulator excludes that binary path).

- Date/Time: 2026-02-25 22:49:32 -0300
- Summary: Added ring SDK fallbacks to `useMetricHistory` for all 6 metric types (sleep, heartRate, hrv, spo2, temperature, activity). When Supabase returns 0 rows (no sync has run yet), the hook now fetches directly from the ring SDK and returns the same Map shape. Sleep score is calculated locally using `calculateSleepScore()` from `src/utils/ringData/sleep.ts` (duration + deep % + efficiency + REM %). Activity fallback is today-only (ring has no historical step data). All fallbacks are try/catch guarded so a disconnected ring returns an empty map gracefully.
- Files Changed: `src/hooks/useMetricHistory.ts`, `catchup.md`
- Follow-up/Risk: HR fallback relies on `getScheduledHeartRateRaw` returning timestamp fields — verify field names match actual SDK output. HRV/SpO2/Temperature call JstyleService directly (bypassing UnifiedSmartRingService). Once Supabase sync populates data, the fallback path is skipped automatically.

- Date/Time: 2026-02-25 22:58:24 -0300
- Summary: Replaced app icon and splash with `~/Downloads/Frame 91.png` for Expo assets and iOS native asset catalog, exported a fresh iOS JS bundle to `dist-ios`, and opened the iOS workspace in Xcode (no local build run).
- Files Changed: `assets/icon.png`, `assets/splash.png`, `ios/SmartRing/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`, `ios/SmartRing/Images.xcassets/SplashScreenLegacy.imageset/image.png`, `ios/SmartRing/Images.xcassets/SplashScreenLegacy.imageset/image@2x.png`, `ios/SmartRing/Images.xcassets/SplashScreenLegacy.imageset/image@3x.png`, `catchup.md`, `dist-ios/*`
- Follow-up/Risk: iOS simulator binary builds remain affected by the existing device-only `ios/JstyleBridge/libBleSDK.a` linkage issue.

- Date/Time: 2026-02-27 11:45:45 -0300
- Summary: Implemented additive X3 parity updates without changing tab structure: added contributor/feature/session models to home data, added new X3 capability fetch paths (activity mode, sleep HRV, OSA/EOV, PPI) across JS + native bridge, wired respiratory-rate/session availability into data flow, and added contributor/recommendation UI blocks in Overview/Sleep/Activity plus a Recent Sessions section in Activity.
- Files Changed: `src/types/sdk.types.ts`, `src/services/JstyleService.ts`, `src/services/UnifiedSmartRingService.ts`, `ios/JstyleBridge/JstyleBridge.m`, `src/hooks/useHomeData.ts`, `src/screens/home/OverviewTab.tsx`, `src/screens/home/SleepTab.tsx`, `src/screens/home/ActivityTab.tsx`, `catchup.md`
- Follow-up/Risk: Native payload field names for sleep HRV/OSA/EOV/PPI may vary by firmware; normalization is defensive but should be validated on real X3 packets. Full `npx tsc --noEmit` still fails due pre-existing project-wide TypeScript/config issues unrelated to this change.

- Date/Time: 2026-03-03 16:06:53 -0300
- Summary: Updated Sleep tab insight metrics so the first metric shows sleep duration instead of sleep score.
- Files Changed: `src/screens/home/SleepTab.tsx`, `catchup.md`
- Follow-up/Risk: Duration display uses `sleep.timeAsleep`; if sleep data is missing it falls back to `--` as expected.

- Date/Time: 2026-03-03 17:04:43 -0300
- Summary: Fixed Daily Sleep Trend card reliability by preventing one-shot fallback lock-in: wait for home sync completion before ring fetch, deduplicate bars by day, use SDK sleep timestamp when available, and add controlled retries when only current-day sleep is returned.
- Files Changed: `src/components/home/DailySleepTrendCard.tsx`, `catchup.md`
- Follow-up/Risk: If the ring truly contains only one day of sleep history, the card will still show one bar after retry budget is exhausted.

- Date/Time: 2026-03-03 17:05:24 -0300
- Summary: Added stale-data guard for Daily Sleep Trend fallback: clear bars when disconnected/no context sleep minutes instead of retaining previous values.
- Files Changed: `src/components/home/DailySleepTrendCard.tsx`, `catchup.md`
- Follow-up/Risk: None.
