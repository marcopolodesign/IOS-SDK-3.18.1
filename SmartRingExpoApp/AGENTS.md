# Agent Guidance

## General Rules

- Do **not** introduce demo or mock fallback data in production UI. If the SDK/ring does not return data, surface an empty/"None/No data" state instead of synthetic values.
- When working with sleep history (e.g., "Some Days Sleep" from the demo project), rely on the real SDK sleep APIs and mirror their behavior without adding placeholder totals.
- If a requirement seems to need sample data, ask the user first before adding any fallback.

## Dual-SDK Architecture

The app supports two smart ring models, each using a different native BLE SDK:

| Ring | SDK | Native Bridge | JS Service | BLE Service UUID |
|---|---|---|---|---|
| **Focus R1** | QCBandSDK | `QCBandBridge` | `QCBandService.ts` | Managed by QCBandSDK |
| **Focus X3** | Jstyle BleSDK_X3 | `JstyleBridge` | `JstyleService.ts` | `FFF0` |

### How It Works

1. **`UnifiedSmartRingService`** is the single entry point for all SDK operations.
2. During **scanning**, both SDKs scan in parallel. Each discovered device is tagged with `sdkType: 'qcband' | 'jstyle'` in the `DeviceInfo`.
3. When the user **connects** to a device, `useSmartRing` reads `device.sdkType` and calls `UnifiedSmartRingService.setConnectedSDKType(sdkType)`.
4. All subsequent **data commands** (getSteps, getSleepData, getBattery, etc.) are routed to the correct SDK based on `connectedSDKType`.
5. On **disconnect**, `connectedSDKType` resets to `'none'`.

### Device Identification

- **R1 devices**: BLE name starts with `R10_` → displayed as "FOCUS R1"
- **X3 devices**: Tagged with `sdkType: 'jstyle'` by the native bridge → displayed as "FOCUS X3"
- The `isRingDevice()` and `formatDeviceName()` functions in `useSmartRing.ts` handle both patterns.

### Data Normalization

Both SDKs return data in slightly different formats. Normalization happens in the JS service layer:

- **Steps distance**: QCBand returns meters; X3 returns km (multiplied by 1000 in `JstyleService`)
- **Sleep quality**: QCBand uses type 0-5 (None/Awake/Light/Deep/REM/Unweared); X3 uses `arraySleepQuality` + `sleepUnitLength`
- **Gender**: QCBand uses `0=male, 1=female`; X3 uses `0=female, 1=male` (normalized in `JstyleBridge.m`)
- **Calories**: QCBand reports scaled by 1000; X3 reports directly
- **HRV**: X3 HRV data includes blood pressure values (`HighPressure`, `LowPressure`)

### Key Files

- `src/services/UnifiedSmartRingService.ts` — Dual SDK router (all app code goes through this)
- `src/services/QCBandService.ts` — JS wrapper for R1/QCBandSDK
- `src/services/JstyleService.ts` — JS wrapper for X3/JstyleBleSDK
- `src/hooks/useSmartRing.ts` — React hook with device detection and connection logic
- `src/types/sdk.types.ts` — Shared type definitions (`DeviceInfo.sdkType` field)
- `ios/QCBandBridge/` — Native R1 bridge
- `ios/JstyleBridge/` — Native X3 bridge (NewBle.m + JstyleBridge.m + SDK headers + libBleSDK.a)
