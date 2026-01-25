# Smart Ring SDK Integration Guide

This guide explains how to integrate the QCBandSDK (demo SDK) with the React Native app for real device connectivity. The native QCBand bridge files are already part of the Xcode project; you only need to copy and embed the frameworks.

## Current Status

| Component | Status |
|-----------|--------|
| ✅ Native Bridge Header | `ios/QCBandBridge/QCBandBridge.h` |
| ✅ Native Bridge Implementation | `ios/QCBandBridge/QCBandBridge.m` |
| ✅ Bridging Header | `ios/SmartRing/SmartRing-Bridging-Header.h` |
| ✅ React Native Service | `src/services/QCBandService.ts` |
| ✅ Unified Service | `src/services/UnifiedSmartRingService.ts` |
| ✅ Mock Data Service | `src/services/SmartRingMockService.ts` |
| ⚠️ SDK Frameworks | QCBandSDK.framework must be copied from Demo Files |

## Quick Setup (When Ready)

### 1. Run the Setup Script

```bash
cd SmartRingExpoApp
./scripts/setup-sdk.sh
```

This script will:
- Copy SDK frameworks from `../Demo Files` into `ios/Frameworks/`
- Verify the installation

### 2. Add Frameworks in Xcode

1. Open `ios/SmartRing.xcworkspace` in Xcode
2. Select the SmartRing target
3. Go to **General** → **Frameworks, Libraries, and Embedded Content**
4. Click **+** and add each framework (Embed & Sign):
   - `QCBandSDK.framework` (from `ios/Frameworks`)
5. Set each framework to **Embed & Sign**

### 3. Update Build Settings

In Xcode, update these build settings:

```
Framework Search Paths: $(PROJECT_DIR)/Frameworks
Header Search Paths: $(PROJECT_DIR)/Frameworks/**
Other Linker Flags: -ObjC
```

### 4. Run Pod Install

```bash
cd ios
pod install
```

### 5. Enable QCBandSDK

Edit `src/services/SmartRingService.ts`:

```typescript
// Change this:
const USE_MOCK_DATA = __DEV__ && true;

// To this:
const USE_MOCK_DATA = __DEV__ && false;
```

### 6. Build and Run

```bash
# Build for device
cd ios
xcodebuild -workspace SmartRing.xcworkspace -scheme SmartRing -configuration Debug -destination 'generic/platform=iOS'
```

## Native Bridge API

The bridge exposes these methods to JavaScript:

### Connection
- `scan(duration)` - Scan for devices (returns Promise<DeviceInfo[]>)
- `stopScan()` - Stop scanning
- `connect(mac)` - Connect to device
- `disconnect()` - Disconnect
- `reconnect()` - Reconnect to last device

### Data Retrieval
- `getSteps()` - Get step data
- `getSleepData()` - Get sleep data
- `getBattery()` - Get battery level
- `getVersion()` - Get firmware version
- `get24HourHeartRate()` - Get 24h heart rate data
- `get24HourSteps()` - Get 24h step data
- `getProfile()` - Get user profile
- `getGoal()` - Get step goal
- `getSportData()` - Get workout data
- `getAllData()` - Sync all historical data

### History Data
- `getHistoryStepData(day)` - Get steps from X days ago
- `getHistorySleepData(day)` - Get sleep from X days ago
- `getHistoryHrData(day)` - Get heart rate from X days ago

### Real-time Monitoring
- `startHeartRateMonitoring()` / `stopHeartRateMonitoring()`
- `startSpO2Monitoring()` / `stopSpO2Monitoring()`
- `startBloodPressureMonitoring()` / `stopBloodPressureMonitoring()`
- `startStressMonitoring()` / `stopStressMonitoring()`

### Settings
- `setGoal(goal)` - Set step goal
- `setProfile(profile)` - Set user profile
- `setTimeFormat(is24Hour)` - Set 12/24 hour format
- `setUnit(isMetric)` - Set metric/imperial

### Device
- `findDevice()` - Make device vibrate/beep

## Events

The bridge emits these events:

```javascript
import { NativeEventEmitter, NativeModules } from 'react-native';

const eventEmitter = new NativeEventEmitter(NativeModules.SmartRingBridge);

// Connection state changes
eventEmitter.addListener('onConnectionStateChanged', (event) => {
  // event.state: 'disconnected' | 'connecting' | 'connected' | 'syncing' | 'syncSuccess' | 'syncError'
});

// Bluetooth state changes
eventEmitter.addListener('onBluetoothStateChanged', (event) => {
  // event.state: 'poweredOn' | 'poweredOff' | 'unauthorized' | 'unsupported'
});

// Real-time data
eventEmitter.addListener('onHeartRateReceived', (data) => {
  // data.heartRate, data.rri
});

eventEmitter.addListener('onStepsReceived', (data) => {
  // data.steps, data.distance, data.calories
});

eventEmitter.addListener('onSpO2Received', (data) => {
  // data.spo2
});

eventEmitter.addListener('onBloodPressureReceived', (data) => {
  // data.systolic, data.diastolic, data.heartRate
});
```

## Troubleshooting

### "CRPSmartBand SDK is not installed"

This error means the SDK frameworks are not in the project. Run:
```bash
./scripts/setup-sdk.sh
```

### Build errors about missing headers

Make sure Framework Search Paths includes `$(PROJECT_DIR)/Frameworks`

### Bluetooth not working

1. Check `Info.plist` has Bluetooth permissions
2. Ensure `UIBackgroundModes` includes `bluetooth-central`
3. Test on a real device (simulator doesn't support BLE)

### Mock mode still active

Make sure you changed `USE_MOCK_DATA` to `false` in `SmartRingService.ts`

## Architecture

```
React Native App
       │
       ▼
SmartRingService.ts  ──► (if mock mode) ──► SmartRingMockService.ts
       │
       ▼ (if real mode)
NativeModules.SmartRingBridge
       │
       ▼
SmartRingBridge.m (Objective-C)
       │
       ▼
CRPSmartBand.framework (Native SDK)
       │
       ▼
Smart Ring Device (via Bluetooth)
```

## Files

```
ios/SmartRing/
├── SmartRingBridge.h          # Bridge header
├── SmartRingBridge.m          # Bridge implementation
├── SmartRing-Bridging-Header.h # Swift bridging header
└── Frameworks/                 # SDK frameworks (after setup)
    ├── CRPSmartBand.framework
    ├── RTKLEFoundation.framework
    ├── RTKOTASDK.framework
    ├── OTAFramework.framework
    ├── SpeexKit.framework
    └── libopus.a

src/services/
├── SmartRingService.ts        # Main service (switches mock/real)
└── SmartRingMockService.ts    # Mock implementation
```
