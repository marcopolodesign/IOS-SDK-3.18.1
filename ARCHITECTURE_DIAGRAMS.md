# Smart Ring iOS SDK - Visual Architecture Diagrams

This document contains visual diagrams that can be rendered using Mermaid.js (supported in GitHub, GitLab, and many markdown viewers).

---

## 1. Complete System Architecture

```mermaid
graph TB
    subgraph "Physical Layer"
        Ring[📱 Smart Ring Device<br/>Sensors: HR, SpO2, Accelerometer]
        BLE[📡 Bluetooth Low Energy<br/>BLE Communication]
    end

    subgraph "iOS Native Layer"
        CoreBT[iOS CoreBluetooth<br/>Framework]
        CRPSDK[CRPSmartBand.framework<br/>Main SDK]
        RTKLE[RTKLEFoundation.framework<br/>BLE Abstraction]
        RTKOTA[RTKOTASDK.framework<br/>OTA Updates]
        Bridge[SmartRingBridge.m<br/>Native Module]
    end

    subgraph "React Native Layer"
        RNModule[NativeModules.SmartRingBridge<br/>RN Bridge]
        Service[SmartRingService.ts<br/>Service Layer]
        Hooks[useSmartRing Hook<br/>State Management]
        Components[React Components<br/>UI Components]
        Screens[React Screens<br/>Views]
    end

    subgraph "External Services"
        HealthKit[🍎 Apple HealthKit<br/>Health Data Store]
        Supabase[☁️ Supabase<br/>Cloud Backend]
        Strava[🏃 Strava API<br/>Fitness Platform]
    end

    Ring -->|BLE Protocol| BLE
    BLE -->|iOS Bluetooth| CoreBT
    CoreBT --> CRPSDK
    CRPSDK --> RTKLE
    RTKLE --> Bridge
    RTKOTA --> Bridge
    Bridge -->|RCTBridgeModule| RNModule
    RNModule --> Service
    Service --> Hooks
    Hooks --> Components
    Components --> Screens
    
    Service -->|Read/Write| HealthKit
    Service -->|Sync Data| Supabase
    Service -->|Export Data| Strava

    style Ring fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff
    style CRPSDK fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style Bridge fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style Service fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Hooks fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
    style Screens fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
    style HealthKit fill:#ff8787,stroke:#fa5252,stroke-width:2px,color:#fff
    style Supabase fill:#51cf66,stroke:#37b24d,stroke-width:2px,color:#fff
    style Strava fill:#ff922b,stroke:#fd7e14,stroke-width:2px,color:#fff
```

---

## 2. Data Flow - Device Connection

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 User
    participant UI as 📱 React UI
    participant Hook as 🪝 useSmartRing
    participant Service as 🔧 SmartRingService
    participant Bridge as 🌉 SmartRingBridge
    participant SDK as 📦 CRPSmartBand SDK
    participant Device as 💍 Smart Ring

    User->>UI: Tap "Scan Devices"
    UI->>Hook: scan()
    Hook->>Service: scan(10)
    Service->>Bridge: scan(duration)
    Bridge->>SDK: CRPSmartBand.sharedInstance.scan()
    SDK->>Device: 🔍 Start BLE Scan
    Device-->>SDK: 📡 Advertisement Data
    SDK-->>Bridge: onDeviceDiscovered(device)
    Bridge-->>Service: Event: 'onDeviceDiscovered'
    Service-->>Hook: Device list updated
    Hook-->>UI: Update device list
    
    User->>UI: Tap device to connect
    UI->>Hook: connect(device)
    Hook->>Service: connect(macAddress)
    Service->>Bridge: connect(macAddress)
    Bridge->>SDK: connet(discovery)
    SDK->>Device: 🔗 Initiate BLE Connection
    Device-->>SDK: ✅ Connection established
    SDK-->>Bridge: onConnectionStateChanged(connected)
    Bridge-->>Service: Event: 'onConnectionStateChanged'
    Service-->>Hook: Connection state = 'connected'
    Hook-->>UI: Show connected status
    UI-->>User: ✅ Device Connected!
```

---

## 3. Data Flow - Heart Rate Monitoring

```mermaid
sequenceDiagram
    autonumber
    participant User as 👤 User
    participant UI as 📱 React UI
    participant Hook as 🪝 useSmartRing
    participant Service as 🔧 SmartRingService
    participant Bridge as 🌉 SmartRingBridge
    participant SDK as 📦 CRPSmartBand SDK
    participant Device as 💍 Smart Ring
    participant HealthKit as 🍎 HealthKit

    User->>UI: View Heart Rate
    UI->>Hook: startHeartRateMonitoring()
    Hook->>Service: startHeartRateMonitoring()
    Service->>Bridge: startHeartRateMonitoring()
    Bridge->>SDK: Start HR monitoring
    SDK->>Device: 📡 Request HR data
    
    loop Every 1 second
        Device->>SDK: ❤️ HR reading (72 bpm)
        SDK->>Bridge: Heart rate callback
        Bridge->>Service: Event: 'onHeartRateReceived'
        Service->>HealthKit: Write to HealthKit
        Service->>Hook: HR data updated
        Hook->>UI: Update HR display
        UI-->>User: Show HR: 72 bpm
    end
```

---

## 4. Component Hierarchy - Home Screen

```mermaid
graph TD
    App[App.tsx<br/>Root Application] --> Router[Expo Router<br/>Navigation]
    Router --> TabLayout[TabLayout<br/>Bottom Tabs]
    
    TabLayout --> TodayTab[Today Tab<br/>index.tsx]
    TabLayout --> HealthTab[Health Tab<br/>health.tsx]
    TabLayout --> RingTab[Ring Tab<br/>ring.tsx]
    TabLayout --> SettingsTab[Settings Tab<br/>settings.tsx]
    
    TodayTab --> HomeScreen[HomeScreen.tsx<br/>Main Dashboard]
    
    HomeScreen --> OverviewTab[OverviewTab.tsx<br/>Overview View]
    HomeScreen --> ActivityTab[ActivityTab.tsx<br/>Activity View]
    HomeScreen --> SleepTab[SleepTab.tsx<br/>Sleep View]
    HomeScreen --> NutritionTab[NutritionTab.tsx<br/>Nutrition View]
    
    OverviewTab --> HomeHeader[HomeHeader<br/>User Info & Date]
    OverviewTab --> StatsRow[StatsRow<br/>Key Metrics]
    OverviewTab --> SemiCircularGauge[SemiCircularGauge<br/>Progress Ring]
    OverviewTab --> InsightCard[InsightCard<br/>Health Insights]
    OverviewTab --> GlassCard[GlassCard<br/>Glassmorphism Card]
    OverviewTab --> AnimatedGradientBackground[AnimatedGradientBackground<br/>Animated BG]
    
    ActivityTab --> HeartRateChart[HeartRateChart<br/>24h HR Chart]
    ActivityTab --> MetricCard[MetricCard<br/>Steps, Distance, Calories]
    
    SleepTab --> SleepStagesChart[SleepStagesChart<br/>Sleep Stages]
    SleepTab --> MetricCard2[MetricCard<br/>Sleep Duration, Quality]
    
    style App fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff
    style HomeScreen fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style OverviewTab fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style ActivityTab fill:#f38181,stroke:#e85a5a,stroke-width:2px
    style SleepTab fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
```

---

## 5. Service Layer Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        Components[React Components]
        Hooks[React Hooks]
    end

    subgraph "Service Interface"
        Interface[ISmartRingService<br/>TypeScript Interface]
    end

    subgraph "Service Implementations"
        RealService[SmartRingService.ts<br/>Real SDK Implementation<br/>📍 Native Bridge]
        MockService[SmartRingMockService.ts<br/>Mock Implementation<br/>🧪 Development/Testing]
        UnifiedService[UnifiedSmartRingService.ts<br/>Facade Pattern]
    end

    subgraph "Supporting Services"
        HealthKit[HealthKitService.ts<br/>Apple Health Integration]
        Supabase[SupabaseService.ts<br/>Cloud Backend]
        DataSync[DataSyncService.ts<br/>Synchronization Logic]
        Strava[StravaService.ts<br/>Export to Strava]
    end

    subgraph "Native Layer"
        Bridge[SmartRingBridge.m<br/>Native Module]
        SDK[CRPSmartBand SDK<br/>Framework]
    end

    Components --> Hooks
    Hooks --> Interface
    Interface --> UnifiedService
    
    UnifiedService --> RealService
    UnifiedService --> MockService
    
    RealService --> Bridge
    Bridge --> SDK
    
    RealService --> HealthKit
    RealService --> Supabase
    RealService --> DataSync
    DataSync --> Strava

    style Interface fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff
    style UnifiedService fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style RealService fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style MockService fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Bridge fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
    style SDK fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
```

---

## 6. State Management Flow

```mermaid
graph LR
    subgraph "Device State"
        Device[Smart Ring Device]
    end

    subgraph "Native Layer"
        SDK[CRPSmartBand SDK]
        Bridge[SmartRingBridge]
    end

    subgraph "React Native"
        Service[SmartRingService]
        Hook[useSmartRing Hook]
        State[React State]
    end

    subgraph "UI Layer"
        Components[React Components]
        UI[User Interface]
    end

    Device -->|BLE Events| SDK
    SDK -->|Callbacks| Bridge
    Bridge -->|Native Events| Service
    Service -->|State Updates| Hook
    Hook -->|React State| State
    State -->|Props| Components
    Components -->|Render| UI
    
    UI -->|User Actions| Components
    Components -->|Callbacks| Hook
    Hook -->|Service Calls| Service
    Service -->|Bridge Calls| Bridge
    Bridge -->|SDK Calls| SDK
    SDK -->|BLE Commands| Device

    style Device fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff
    style SDK fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style Bridge fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style Service fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Hook fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
    style State fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
```

---

## 7. File Structure Visualization

```mermaid
graph TD
    Root[IOS-SDK-3.18.1/]
    
    Root --> Framework[Framework/<br/>SDK Zip Files]
    Root --> OCDemo[OC-SDKDemo/<br/>Objective-C Demo]
    Root --> SwiftDemo[swift-SdkDemo/<br/>Swift Demo]
    Root --> ExpoApp[SmartRingExpoApp/<br/>React Native App]
    
    Framework --> SDKFiles[CRPSmartBand.framework.zip<br/>RTKLEFoundation.framework.zip<br/>RTKOTASDK.framework.zip<br/>OTAFramework.framework.zip<br/>SpeexKit.framework.zip]
    
    ExpoApp --> App[app/<br/>Expo Router Pages]
    ExpoApp --> Src[src/<br/>Source Code]
    ExpoApp --> IOS[ios/<br/>Native iOS Code]
    ExpoApp --> Assets[assets/<br/>Images & Icons]
    
    App --> Tabs[app/tabs/<br/>index.tsx<br/>health.tsx<br/>ring.tsx<br/>settings.tsx]
    
    Src --> Components[src/components/<br/>UI Components]
    Src --> Screens[src/screens/<br/>Screen Views]
    Src --> Services[src/services/<br/>Business Logic]
    Src --> Hooks[src/hooks/<br/>React Hooks]
    Src --> Types[src/types/<br/>TypeScript Types]
    Src --> Theme[src/theme/<br/>Styling]
    
    IOS --> Native[ios/SmartRing/<br/>Native Module]
    IOS --> Frameworks[ios/Frameworks/<br/>SDK Frameworks]
    
    Native --> BridgeH[SmartRingBridge.h<br/>Bridge Header]
    Native --> BridgeM[SmartRingBridge.m<br/>Bridge Implementation]
    
    style Root fill:#ff6b6b,stroke:#c92a2a,stroke-width:3px,color:#fff
    style ExpoApp fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style Src fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style Services fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Hooks fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
    style BridgeM fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
```

---

## 8. Event Flow - Real-time Data

```mermaid
graph LR
    subgraph "Device"
        Sensors[Sensors<br/>HR, SpO2, Steps]
    end

    subgraph "Native Layer"
        SDK[SDK Callbacks]
        Bridge[Bridge Events]
    end

    subgraph "React Native"
        Events[NativeEventEmitter]
        Listeners[Event Listeners]
        Service[Service State]
    end

    subgraph "React"
        Hook[useSmartRing Hook]
        State[React State]
        Effects[useEffect Hooks]
    end

    subgraph "UI"
        Components[Components]
        Render[UI Re-render]
    end

    Sensors -->|Continuous Data| SDK
    SDK -->|onHeartRateReceived| Bridge
    SDK -->|onSpO2Received| Bridge
    SDK -->|onStepsReceived| Bridge
    
    Bridge -->|Native Events| Events
    Events -->|Add Listeners| Listeners
    Listeners -->|Update State| Service
    Service -->|State Change| Hook
    Hook -->|React State| State
    State -->|Trigger Effects| Effects
    Effects -->|Update Components| Components
    Components -->|Re-render| Render

    style Sensors fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff
    style SDK fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style Bridge fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style Service fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Hook fill:#aae5e0,stroke:#95e1d3,stroke-width:2px
    style Components fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
```

---

## 9. Build and Deployment Flow

```mermaid
graph TB
    subgraph "Development"
        Dev[Development Code<br/>TypeScript/React Native]
        Expo[Expo Development Server]
        Simulator[iOS Simulator<br/>Mock Mode]
    end

    subgraph "Native Build"
        Prebuild[expo prebuild<br/>Generate iOS Project]
        PodInstall[pod install<br/>Install Dependencies]
        Xcode[Xcode Project<br/>SmartRing.xcodeproj]
    end

    subgraph "Native Integration"
        Frameworks[Add SDK Frameworks]
        BridgeCode[SmartRingBridge.m<br/>Native Module]
        Config[Configure Permissions<br/>Info.plist]
    end

    subgraph "Production Build"
        Archive[Archive Build<br/>Xcode]
        Sign[Code Signing<br/>Developer Certificate]
        Store[App Store Connect<br/>Distribution]
    end

    subgraph "Testing"
        Device[Physical Device<br/>Bluetooth Testing]
        TestFlight[TestFlight<br/>Beta Testing]
    end

    Dev --> Expo
    Expo --> Simulator
    
    Dev --> Prebuild
    Prebuild --> PodInstall
    PodInstall --> Xcode
    
    Xcode --> Frameworks
    Xcode --> BridgeCode
    Xcode --> Config
    
    Xcode --> Archive
    Archive --> Sign
    Sign --> Store
    
    Xcode --> Device
    Store --> TestFlight

    style Dev fill:#ff6b6b,stroke:#c92a2a,stroke-width:2px,color:#fff
    style Xcode fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style BridgeCode fill:#95e1d3,stroke:#4ecdc4,stroke-width:2px
    style Store fill:#f38181,stroke:#e85a5a,stroke-width:2px,color:#fff
    style Device fill:#fff9c4,stroke:#e8e07f,stroke-width:2px
```

---

## 10. Technology Stack Diagram

```mermaid
graph TB
    subgraph "Frontend"
        React[React 19.1.0]
        RN[React Native 0.81.5]
        Expo[Expo ~54.0.0]
        Router[Expo Router ~6.0.21]
        TS[TypeScript ~5.3.0]
    end

    subgraph "UI Libraries"
        SVG[react-native-svg]
        Reanimated[react-native-reanimated]
        Gradients[expo-linear-gradient]
        Navigation[React Navigation]
    end

    subgraph "Native iOS"
        ObjC[Objective-C]
        Swift[Swift]
        CocoaPods[CocoaPods]
        Xcode[Xcode]
    end

    subgraph "SDK Frameworks"
        CRPSDK[CRPSmartBand.framework]
        RTKLE[RTKLEFoundation.framework]
        RTKOTA[RTKOTASDK.framework]
        OTA[OTAFramework.framework]
        Speex[SpeexKit.framework]
    end

    subgraph "External Services"
        HealthKit[Apple HealthKit]
        Supabase[Supabase]
        Strava[Strava API]
    end

    React --> RN
    RN --> Expo
    Expo --> Router
    Expo --> TS
    
    RN --> SVG
    RN --> Reanimated
    RN --> Gradients
    Router --> Navigation
    
    RN --> ObjC
    RN --> Swift
    Swift --> CocoaPods
    CocoaPods --> Xcode
    
    ObjC --> CRPSDK
    Swift --> CRPSDK
    CRPSDK --> RTKLE
    CRPSDK --> RTKOTA
    RTKOTA --> OTA
    CRPSDK --> Speex
    
    RN --> HealthKit
    RN --> Supabase
    RN --> Strava

    style React fill:#61dafb,stroke:#20232a,stroke-width:2px,color:#fff
    style RN fill:#00d4ff,stroke:#0066cc,stroke-width:2px,color:#fff
    style Expo fill:#000020,stroke:#4630eb,stroke-width:2px,color:#fff
    style CRPSDK fill:#4ecdc4,stroke:#2d8e86,stroke-width:2px,color:#fff
    style HealthKit fill:#ff8787,stroke:#fa5252,stroke-width:2px,color:#fff
```

---

## How to View These Diagrams

### Option 1: GitHub/GitLab
These diagrams will automatically render when viewing the markdown file on GitHub or GitLab.

### Option 2: VS Code
Install the "Markdown Preview Mermaid Support" extension to view diagrams in VS Code.

### Option 3: Online Mermaid Editor
1. Go to https://mermaid.live/
2. Copy any diagram code block
3. Paste and view the rendered diagram

### Option 4: CLI Tool
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i ARCHITECTURE_DIAGRAMS.md -o diagrams.pdf
```

---

## Diagram Legend

- 🔴 **Red** - Physical/Device Layer
- 🟢 **Green** - Native iOS Layer  
- 🔵 **Blue** - React Native Layer
- 🟡 **Yellow** - UI/Components
- 🟣 **Purple** - External Services
- ⚪ **White** - Configuration/State

---

## Summary

These diagrams illustrate:

1. **System Architecture** - Complete overview of all layers
2. **Data Flow** - How data moves from device to UI
3. **Component Hierarchy** - React component structure
4. **Service Layer** - Business logic organization
5. **State Management** - State flow and updates
6. **File Structure** - Project organization
7. **Event Flow** - Real-time event handling
8. **Build Process** - Development to deployment
9. **Technology Stack** - All technologies used

Use these diagrams to understand the complete architecture and data flow of the Smart Ring iOS SDK integration.

