# Smart Ring React Native App

A modern React Native app for the CRPSmartBand SDK, featuring a premium dark theme with comprehensive health monitoring capabilities.

## Features

### Dashboard
- **Steps Tracking** - Daily step count with progress ring, distance, and calories
- **Real-time Heart Rate** - Live heart rate monitoring with RR interval data
- **24-Hour Charts** - Visualize heart rate trends throughout the day
- **Sleep Summary** - Deep, light, and REM sleep breakdown

### Health Monitoring
- **Heart Rate** - Real-time monitoring, 24-hour history, HRV metrics
- **Sleep Tracking** - Sleep quality analysis with detailed breakdowns
- **Blood Oxygen (SpO2)** - Oxygen saturation measurements
- **Blood Pressure** - Systolic/diastolic readings with normal range indicators
- **Stress Level** - Stress monitoring with visual indicators
- **Body Temperature** - Temperature readings with status

### Device Management
- **Bluetooth Scanning** - Find nearby Smart Ring devices
- **Connection Status** - Real-time connection indicators
- **Battery Monitoring** - Device battery level display
- **Find Device** - Trigger device vibration

### Settings
- **User Profile** - Height, weight, age, gender
- **Daily Goals** - Customizable step goals
- **Preferences** - Time format, measurement units

## Project Structure

```
SmartRingExpoApp/
├── App.tsx                    # Main app with navigation
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── MetricCard.tsx
│   │   ├── RingIndicator.tsx
│   │   ├── HeartRateChart.tsx
│   │   ├── BatteryIndicator.tsx
│   │   ├── ConnectionStatus.tsx
│   │   └── DeviceCard.tsx
│   ├── screens/              # App screens
│   │   ├── HomeScreen.tsx
│   │   ├── DevicesScreen.tsx
│   │   ├── HealthScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/             # SDK services
│   │   ├── SmartRingService.ts
│   │   └── SmartRingMockService.ts
│   ├── hooks/                # Custom React hooks
│   │   ├── useSmartRing.ts
│   │   └── useHealthData.ts
│   ├── theme/                # Styling
│   │   └── colors.ts
│   └── types/                # TypeScript definitions
│       └── sdk.types.ts
└── ios/
    └── SmartRingBridge/      # Native bridge module
        ├── SmartRingBridge.h
        └── SmartRingBridge.m
```

## Getting Started

### Prerequisites
- Node.js 18+
- Xcode 15+ (for iOS development)
- iOS Simulator or physical device

### Installation

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on web (for testing UI)
npx expo start --web

# Run on iOS (requires development build)
npx expo run:ios
```

### Mock Mode

The app includes a comprehensive mock data service for testing without a physical device:

1. Mock mode is **enabled by default** in development
2. To disable, edit `src/services/SmartRingService.ts`:
   ```typescript
   const USE_MOCK_DATA = __DEV__ && false; // Set to false
   ```
3. Mock data includes:
   - 3 simulated Smart Ring devices
   - Realistic step, sleep, and heart rate data
   - Real-time heart rate simulation
   - SpO2, blood pressure, HRV, and stress data

## Native Bridge (iOS)

The app includes a native bridge module that wraps the CRPSmartBand SDK:

### Exposed Methods

**Connection:**
- `scan(duration)` - Scan for devices
- `connect(mac)` - Connect to a device
- `disconnect()` - Disconnect current device
- `reconnect()` - Reconnect to last device

**Data Retrieval:**
- `getSteps()` - Current step data
- `getSleepData()` - Sleep metrics
- `getBattery()` - Battery level
- `getVersion()` - Firmware version
- `get24HourHeartRate()` - 24-hour HR data
- `get24HourSteps()` - 24-hour step data
- `getProfile()` - User profile
- `getSportData()` - Sport activity data

**Real-time Monitoring:**
- `startHeartRateMonitoring()` / `stopHeartRateMonitoring()`
- `startSpO2Monitoring()` / `stopSpO2Monitoring()`
- `startBloodPressureMonitoring()` / `stopBloodPressureMonitoring()`

**Settings:**
- `setProfile(profile)` - Update user profile
- `setGoal(steps)` - Set daily step goal
- `setTimeFormat(is24Hour)` - Set time format
- `setUnit(isMetric)` - Set measurement units
- `findDevice()` - Trigger device vibration

### Events

The bridge emits the following events:
- `onConnectionStateChanged` - Connection state updates
- `onBluetoothStateChanged` - Bluetooth state changes
- `onDeviceDiscovered` - New device found during scan
- `onHeartRateReceived` - Real-time heart rate data
- `onSpO2Received` - SpO2 measurements
- `onBloodPressureReceived` - Blood pressure readings
- `onStepsReceived` - Step updates
- `onBatteryReceived` - Battery level updates
- `onUpgradeProgress` - Firmware upgrade progress

## Building for iOS

1. **Copy SDK Frameworks:**
   ```bash
   # Copy frameworks from OC-SDKDemo
   cp -R ../OC-SDKDemo/*.framework ios/Frameworks/
   ```

2. **Generate iOS project:**
   ```bash
   npx expo prebuild
   ```

3. **Install CocoaPods:**
   ```bash
   cd ios && pod install
   ```

4. **Open in Xcode:**
   ```bash
   open ios/SmartRingTestApp.xcworkspace
   ```

5. **Build and run** on a physical device (Bluetooth requires real hardware)

## Theme

The app uses a premium dark theme with vibrant accents:

| Color | Hex | Usage |
|-------|-----|-------|
| Background | `#0D0D0D` | Main background |
| Primary | `#00D4AA` | Steps, accents |
| Heart Rate | `#FF6B6B` | Heart rate metrics |
| Sleep | `#6B8EFF` | Sleep metrics |
| SpO2 | `#B16BFF` | Blood oxygen |
| Calories | `#FFB84D` | Calorie data |

## Dependencies

- `expo` ~50.0.0
- `react-native` 0.73.0
- `@react-navigation/native` ^6.1.9
- `@react-navigation/bottom-tabs` ^6.5.11
- `react-native-svg` ^14.1.0
- `react-native-safe-area-context` 4.8.2
- `react-native-gesture-handler` ~2.14.0
- `gsap` ^3.12.5 (for animations)

## License

Proprietary - Smart Ring SDK
