# Smart Ring SDK & Demo vs App Comparison

**Purpose:** Reference for a Claude Agent working on the Focus/SmartRingExpoApp codebase. Compares the official QCBandSDKDemo with the SmartRingExpoApp SDK integration, connection flow, and data fetching.

---

## 1. SDK Stacks

| Aspect | **Demo (QCBandSDKDemo)** | **SmartRingExpoApp** |
|--------|---------------------------|----------------------|
| **SDK** | **QCBandSDK** only (`QCSDKManager`, `QCSDKCmdCreator`) | **Two paths** via `UnifiedSmartRingService`: |
| | | 1. **QCBand** → `QCBandService` → `QCBandBridge` → **QCBandSDK** (same as demo) |
| | | 2. **CRP** → `SmartRingService` → `SmartRingBridge` → **CRPSmartBand** + RTKLEFoundation + RTKOTASDK |
| **Frameworks** | `QCBandSDK.framework` (from `Demo Files/`) | `SmartRingExpoApp/ios/Frameworks/`: QCBandSDK, CRPSmartBand, RTKLEFoundation, RTKOTASDK, OTAFramework, SpeexKit |
| **Preferred** | N/A | `UnifiedSmartRingService` prefers **qcband** if available, else **crp** |

**Demo** = QCBandSDK only. **App** = QCBandSDK **or** CRPSmartBand (runtime detection).

---

## 2. Project Structure & Key Paths

### Demo
- **Root:** `Demo Files/`
- **App:** `Demo Files/QCBandSDKDemo/` (ViewController, QCScanViewController, CollectionViewFeatureCell)
- **BLE/Connection:** `Demo Files/QCBandSDKDemo/QCCentralManager.{h,m}`
- **SDK:** `Demo Files/QCBandSDK.framework/`
- **Docs:** `Demo Files/README.md`

### App
- **Root:** `SmartRingExpoApp/`
- **Services:** `src/services/UnifiedSmartRingService.ts`, `QCBandService.ts`, `SmartRingService.ts`
- **Hooks:** `src/hooks/useHomeData.ts`, `useSmartRing.ts`
- **Native bridges:** `ios/QCBandBridge/QCBandBridge.{h,m}`, `ios/SmartRingBridge/SmartRingBridge.{h,m}`
- **QCCentralManager (QCBand path):** `ios/QCBandBridge/QCCentralManager.{h,m}` (same design as demo)
- **Frameworks:** `ios/Frameworks/` (QCBandSDK, CRPSmartBand, RTK*, etc.)
- **Docs:** `SDK_INTEGRATION.md`, `QCBANDSDK_INTEGRATION.md`, `INITIAL_LOAD_OPTIMIZATION.md`

---

## 3. Connection Flow

| | **Demo** | **App** |
|--|----------|---------|
| **Scan** | "Search" → `QCScanViewController` → `[QCCentralManager scan]` | Onboarding / Ring UI → `UnifiedSmartRingService` → bridge `scan` (or CRP equivalent) |
| **Connect** | Tap device → `[QCCentralManager connect:peripheral]` → `QCSDKManager addPeripheral` | `connect(peripheralId)` via bridge → same underlying connect |
| **Persistence** | `QCLastConnectedIdentifier` in UserDefaults | QCBand: same + OnboardingContext "has paired device"; CRP: SDK-specific |
| **Reconnect** | BT on / app restore → `startToReconnect` if bound | TabLayout "wait 1.5s then auto-reconnect", `useSmartRing` auto-connect |
| **Unbind** | "Unbind" → `[QCCentralManager remove]` | Settings / onboarding disconnect |

---

## 4. Data Fetching: Demo vs App

### Demo
- **Trigger:** User taps a feature cell (e.g. "Get Battery", "One day Sleep", "Get Steps").
- **Flow:** Direct `QCSDKCmdCreator` call → callback with data. No cache, no pull-to-refresh, no delayed initial load.

### App
- **Trigger:**  
  - **Initial load:** `useHomeData` mount → load cache → **1.8s delay** → `UnifiedSmartRingService.isConnected()` → if connected and `!hasLoadedRealData`, `fetchData(true)`.  
  - **Ongoing:** Connection state `"connected"` (+800ms debounce), pull-to-refresh (`homeData.refresh()` → `fetchData(true)`), app foreground.
- **Flow:** `useHomeData` / `useSmartRing` → `UnifiedSmartRingService` → `QCBandService` or `SmartRingService` → native bridge → **same** `QCSDKCmdCreator` (or CRP) APIs.
- **Cache:** AsyncStorage; instant display from cache, then refresh from ring.
- **Debounce:** 3s `MIN_FETCH_INTERVAL` in `fetchData` (bypassed when `forceRefresh`).

**Important:** When **not connected**, pull-to-refresh still "completes" quickly (~300–600 ms) because `fetchData` exits early ("Ring not connected - preserving cached data"). The UI shows **cached/stale** data, not fresh ring data.

---

## 5. Initial Load vs Pull-to-Refresh (App Only)

| Aspect | **App open (initial load)** | **Pull-to-refresh** |
|--------|-----------------------------|---------------------|
| **Trigger** | `useHomeData` mount + 1.8s timeout | User pull → `homeData.refresh()` |
| **Delay** | **1.8s** before first connection check | **None**; `fetchData` runs immediately |
| **Connection check** | **Before** `fetchData`: only fetch if `connected && !hasLoadedRealData` | **Inside** `fetchData`; always invoke fetch flow, then check connection |
| **When fetch runs** | Only after 1.8s **and** connected (or via connection-event listener later) | As soon as user pulls |
| **Cache** | Explicit `loadFromCache()` on mount for instant UI | No separate cache load; keeps existing state, then overwrites when fetch completes |
| **Debounce** | Both use `fetchData(true)` → debounce skipped | Same |

See `INITIAL_LOAD_OPTIMIZATION.md` for full rationale (SDK detection timing, etc.).

---

## 6. API Mapping (QCBand Path vs Demo)

When the app uses **QCBand**, the bridge calls the **same** QCBandSDK APIs as the demo:

| Data | **Demo** | **App (QCBandBridge)** |
|------|----------|-------------------------|
| **Battery** | `[QCSDKCmdCreator readBatterySuccess:... failed:...]` | Same in `getBattery` |
| **Sleep** | `[QCSDKCmdCreator getFulldaySleepDetailDataByDay:0 sleepDatas:... fail:...]` | Same in `getSleepData` |
| **Steps (summary)** | `getSportDetailDataByDay:0` + `getCurrentSportSucess` | `getSteps` → `getCurrentSportSucess`; `getStepsDetail` → `getSportDetailDataByDay` |
| **Time sync** | `setTime` on connect in `ViewController` | Handled in connect flow |

---

## 7. Feature Scope

| | **Demo** | **App** |
|--|----------|---------|
| **Scope** | Full QCSDKCmdCreator surface: battery, sleep, steps, HR (manual/scheduled/real-time), SpO2, BP, temp, stress, HRV, sedentary, DFU, UUID, etc. | Subset used by `UnifiedSmartRingService`: steps, sleep, battery, HR, SpO2, etc. |
| **UI** | Grid of ~20+ feature buttons | Tabs (Ring, Home, Health, etc.), pull-to-refresh, connection status |

---

## 8. References for Agents

- **INITIAL_LOAD_OPTIMIZATION.md** – Why 1.8s delay, initial vs pull-to-refresh, connection handling.
- **SDK_INTEGRATION.md** – App SDK setup, bridge API, frameworks.
- **QCBANDSDK_INTEGRATION.md** – QCBand connection, battery, steps, sleep, state machine.
- **Demo:** `Demo Files/QCBandSDKDemo/`, `Demo Files/QCBandSDK.framework/` – canonical QCBandSDK usage.
