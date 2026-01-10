# Smart Ring iOS SDK 3.18.1 - Project Overview

## 📋 Quick Summary

This repository contains a **complete iOS SDK integration** for a Smart Ring device, including:

- **Native iOS SDK** (CRPSmartBand.framework v3.18.1) - Vendor-provided SDK
- **React Native/Expo App** - Modern cross-platform UI application
- **Native Bridge** - Objective-C module connecting SDK to React Native
- **Demo Projects** - Reference implementations in Objective-C and Swift

---

## 🏗️ Project Structure

```
IOS-SDK-3.18.1/
│
├── 📦 Framework/              # Original SDK framework files (zip)
│   ├── CRPSmartBand.framework.zip
│   ├── RTKLEFoundation.framework.zip
│   ├── RTKOTASDK.framework.zip
│   ├── OTAFramework.framework.zip
│   └── SpeexKit.framework.zip
│
├── 📱 OC-SDKDemo/             # Objective-C Demo App
│   └── OC-SDKDemo/            # Reference implementation
│       ├── ViewController.m   # Main demo controller
│       └── SetViewController.m # Settings controller
│
├── 🍎 swift-SdkDemo/          # Swift Demo App
│   └── TestSdk/               # Swift reference implementation
│       ├── ViewController.swift
│       └── SetViewController.swift
│
└── ⚛️ SmartRingExpoApp/       # React Native/Expo App (Main App)
    ├── app/                   # Expo Router pages
    ├── src/                   # Source code
    │   ├── components/        # UI components
    │   ├── screens/           # Screen views
    │   ├── services/          # Business logic
    │   ├── hooks/             # React hooks
    │   └── types/             # TypeScript types
    └── ios/                   # Native iOS code
        ├── SmartRing/         # Native bridge module
        └── Frameworks/        # SDK frameworks
```

---

## 🔄 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Physical Layer                       │
│            Smart Ring Device (Hardware)                 │
└────────────────────┬────────────────────────────────────┘
                     │ Bluetooth Low Energy (BLE)
┌────────────────────▼────────────────────────────────────┐
│                   iOS Native Layer                      │
│  CoreBluetooth → CRPSmartBand SDK → SmartRingBridge    │
└────────────────────┬────────────────────────────────────┘
                     │ RCTBridgeModule
┌────────────────────▼────────────────────────────────────┐
│                React Native Layer                       │
│  NativeModules → SmartRingService → React Hooks        │
└────────────────────┬────────────────────────────────────┘
                     │ React State/Props
┌────────────────────▼────────────────────────────────────┐
│                    UI Layer                             │
│           React Components → User Interface             │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Key Features

### Health Monitoring
- ✅ **Real-time Heart Rate** - Live HR monitoring with RR intervals
- ✅ **Sleep Tracking** - Deep, light, REM sleep analysis
- ✅ **Steps & Activity** - Step count, distance, calories
- ✅ **Blood Oxygen (SpO2)** - Oxygen saturation levels
- ✅ **Blood Pressure** - Systolic/diastolic readings
- ✅ **Stress Monitoring** - Stress level measurements
- ✅ **HRV** - Heart Rate Variability
- ✅ **24-Hour Data** - Historical heart rate and steps

### Device Management
- ✅ **Bluetooth Scanning** - Find nearby devices
- ✅ **Connection Management** - Connect, disconnect, reconnect
- ✅ **Battery Monitoring** - Device battery level
- ✅ **Firmware Updates** - Over-the-air updates
- ✅ **Find Device** - Trigger device vibration
- ✅ **Settings** - User profile, goals, preferences

### Integration
- ✅ **Apple HealthKit** - Health data synchronization
- ✅ **Supabase** - Cloud backend integration
- ✅ **Strava** - Fitness platform export

---

## 📱 App Structure

### Tab Navigation
1. **Today** - Home dashboard with overview metrics
2. **Health** - Detailed health metrics and charts
3. **Ring** - Device connection and management
4. **Settings** - User preferences and app settings

### Main Screens
- **HomeScreen** - Main dashboard with tabs (Overview, Activity, Sleep, Nutrition)
- **HealthScreen** - Comprehensive health metrics visualization
- **DevicesScreen** - Device scanning and connection
- **SettingsScreen** - User profile and app preferences
- **RingScreen** - Ring-specific UI and connection status

---

## 🔌 Native Bridge API

### Connection Methods
```typescript
scan(duration: number): Promise<DeviceInfo[]>
connect(macAddress: string): Promise<void>
disconnect(): Promise<void>
reconnect(): Promise<void>
```

### Data Retrieval
```typescript
getSteps(): Promise<StepsData>
getSleepData(): Promise<SleepData>
getBattery(): Promise<BatteryData>
getHeartRate(): Promise<HeartRateData>
get24HourHeartRate(): Promise<HeartRateData[]>
get24HourSteps(): Promise<StepsData[]>
getProfile(): Promise<ProfileData>
```

### Real-time Monitoring
```typescript
startHeartRateMonitoring(): Promise<void>
stopHeartRateMonitoring(): Promise<void>
startSpO2Monitoring(): Promise<void>
stopSpO2Monitoring(): Promise<void>
startBloodPressureMonitoring(): Promise<void>
stopBloodPressureMonitoring(): Promise<void>
```

### Events
- `onConnectionStateChanged` - Connection status updates
- `onDeviceDiscovered` - New device found
- `onHeartRateReceived` - Real-time heart rate
- `onSpO2Received` - SpO2 readings
- `onBloodPressureReceived` - Blood pressure readings
- `onStepsReceived` - Step updates
- `onBatteryReceived` - Battery level updates

---

## 🛠️ Technology Stack

### Frontend
- **React Native** 0.81.5
- **Expo** ~54.0.0
- **React** 19.1.0
- **TypeScript** ~5.3.0
- **Expo Router** ~6.0.21

### Native iOS
- **Objective-C** - Native bridge
- **Swift** - App delegate
- **CRPSmartBand.framework** - Main SDK
- **RTKLEFoundation.framework** - BLE abstraction
- **RTKOTASDK.framework** - OTA updates
- **CocoaPods** - Dependency management

### External Services
- **Apple HealthKit** - Health data store
- **Supabase** - Cloud backend
- **Strava API** - Fitness platform

---

## 📊 Data Flow

### 1. Device Connection
```
User → UI → Hook → Service → Bridge → SDK → Device
```

### 2. Data Retrieval
```
Device → SDK → Bridge → Service → Hook → UI
```

### 3. Real-time Monitoring
```
Device (continuous) → SDK → Bridge → Events → Service → Hook → UI (updates)
```

---

## 🎨 UI Design

### Theme
- **Dark Mode** - Premium dark theme
- **Color Palette**:
  - Primary: `#00D4AA` (Teal)
  - Heart Rate: `#FF6B6B` (Red)
  - Sleep: `#6B8EFF` (Blue)
  - SpO2: `#B16BFF` (Purple)
  - Background: `#0D0D0D` (Dark)

### Components
- **Glassmorphism** - Frosted glass effect cards
- **Gradient Backgrounds** - Animated gradients
- **Circular Progress** - Ring indicators
- **Charts** - Heart rate, sleep stages
- **Cards** - Metric cards, device cards

---

## 🧪 Development Modes

### Mock Mode
- **Purpose**: Development without physical device
- **Features**: Realistic mock data generation
- **Enable**: `USE_MOCK_DATA = true` in SmartRingService.ts

### Real SDK Mode
- **Purpose**: Testing with physical device
- **Requirements**: Physical iOS device with Bluetooth
- **Enable**: `USE_MOCK_DATA = false` in SmartRingService.ts

---

## 📚 Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Complete architecture documentation
- **[ARCHITECTURE_DIAGRAMS.md](./ARCHITECTURE_DIAGRAMS.md)** - Visual diagrams (Mermaid)
- **[SDK_ANALYSIS.md](./SDK_ANALYSIS.md)** - SDK analysis and capabilities
- **[SmartRingExpoApp/README.md](./SmartRingExpoApp/README.md)** - App-specific documentation

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Xcode 15+
- iOS 15.0+ device (for real device testing)
- CocoaPods

### Installation
```bash
# Navigate to app directory
cd SmartRingExpoApp

# Install dependencies
npm install

# iOS setup
cd ios
pod install
cd ..

# Start development server
npx expo start

# Run on iOS
npx expo run:ios
```

---

## 🏗️ Build Process

1. **Development** - Expo development server with mock data
2. **Native Build** - Generate iOS project with `expo prebuild`
3. **Native Integration** - Add SDK frameworks to Xcode project
4. **Production Build** - Archive and sign for App Store
5. **Distribution** - Submit to TestFlight/App Store

---

## 🔑 Key Concepts

### Native Bridge Pattern
- Connects React Native JavaScript to native iOS SDK
- Uses `RCTBridgeModule` protocol
- Events via `NativeEventEmitter`

### Service Layer Pattern
- Abstracts SDK calls
- Provides consistent API
- Supports mock and real implementations

### Hook Pattern
- Encapsulates service logic
- Manages React state
- Handles event subscriptions

### Facade Pattern
- UnifiedSmartRingService provides simple interface
- Hides complexity of multiple services
- Easy switching between real and mock

---

## 📈 Project Statistics

- **Total Files**: 500+ files
- **Lines of Code**: 500,000+ lines
- **Components**: 15+ React components
- **Screens**: 16+ screen views
- **Services**: 9 service modules
- **Hooks**: 6 React hooks
- **TypeScript Types**: 4 type definition files

---

## 🔍 Code Organization

### Components
- Reusable UI components
- Organized by feature (home, health, device)
- Glassmorphism and gradient effects

### Screens
- Full-screen views
- Screen-specific logic
- Navigation integration

### Services
- Business logic layer
- SDK integration
- External API integration

### Hooks
- State management
- Service integration
- Event handling

### Types
- TypeScript definitions
- SDK type definitions
- External service types

---

## 🎯 Design Patterns

1. **Bridge Pattern** - Native bridge between SDK and RN
2. **Facade Pattern** - Unified service interface
3. **Observer Pattern** - Event-driven updates
4. **Repository Pattern** - Data access abstraction
5. **Hook Pattern** - State and logic encapsulation

---

## 🐛 Debugging

### Native Logs
- Check Xcode console for SDK logs
- Enable debug logging in SmartRingBridge.m

### React Native Logs
- `console.log` in JavaScript/TypeScript
- React Native Debugger
- Flipper integration

### Mock Data
- Use mock mode for UI development
- Test data flow without device

---

## 📝 Next Steps

1. **Review Architecture** - Read ARCHITECTURE.md
2. **View Diagrams** - Check ARCHITECTURE_DIAGRAMS.md
3. **Explore Code** - Browse src/ directory
4. **Run App** - Start development server
5. **Connect Device** - Test with physical device

---

## 📞 Support

For issues or questions:
1. Check documentation in SmartRingExpoApp/
2. Review SDK demo projects (OC-SDKDemo, swift-SdkDemo)
3. Check SDK documentation (IOS-SDK Development Guide.pdf)

---

## 📄 License

Proprietary - Smart Ring SDK

---

**Last Updated**: January 2025
**SDK Version**: 3.18.1
**App Version**: 1.0.0

