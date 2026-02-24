# Claude Code Project Guide

This document provides context for Claude Code when working on this Expo/React Native project.

> **📝 Important:** When completing tasks, **always update this file** with a summary of what was done/changed/implemented in the "Recent Changes" section below. This keeps the project history clear and helps future context.

## Project Overview

Smart Ring Expo App - A React Native app using Expo SDK 54 for health monitoring via CRPSmartBand SDK integration.

## SDK Reference Rule

> **IMPORTANT:** When implementing SDK features, fixing data issues, or adding new ring data types, **ALWAYS check the X3 demo project** at `IOS (X3)/Ble SDK Demo/` and the native bridge files at `ios/JstyleBridge/` for reference implementation patterns before writing code. The demo project contains working examples for all data types (sleep, steps, heart rate, HRV, SpO2, temperature, battery).

## Recent Changes

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

- **SmartRingService** - Main SDK interface for ring communication
- **QCBandService** - QCBand SDK integration
- **UnifiedSmartRingService** - Unified interface across SDK variants
- **AuthService** - User authentication via Supabase
- **DataSyncService** - Cloud data synchronization
- **SupabaseService** - Database operations

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

The app integrates with CRPSmartBand iOS SDK via a native bridge. Key frameworks in `ios/Frameworks/`:
- CRPSmartBand.framework
- RTKLEFoundation.framework
- RTKOTASDK.framework
- QCBandSDK.framework

Bridge files are in `ios/SmartRing/` and `ios/QCBandBridge/`.

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
