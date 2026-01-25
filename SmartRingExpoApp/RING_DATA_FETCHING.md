# Ring Data Fetching Guide

This document explains how sleep data is fetched from the smart ring and displayed in the Today tab's Sleep sub-tab.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        UI Layer                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ OverviewTab │  │  SleepTab   │  │ ActivityTab │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │  HomeDataContext      │  (shared state)          │
│              │  useHomeDataContext() │                          │
│              └───────────┬───────────┘                          │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │    useHomeData()      │  (single hook instance)  │
│              └───────────┬───────────┘                          │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    Service Layer                                 │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │ UnifiedSmartRingService│                          │
│              └───────────┬───────────┘                          │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │    QCBandService      │                          │
│              └───────────┬───────────┘                          │
│                          ▼                                       │
│              ┌───────────────────────┐                          │
│              │    QCBandBridge       │  (Native iOS Module)     │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/context/HomeDataContext.tsx` | Provides shared data to all tabs |
| `src/hooks/useHomeData.ts` | Fetches and transforms ring data |
| `src/utils/ringData/sleep.ts` | Sleep-specific data fetching utilities |
| `src/services/UnifiedSmartRingService.ts` | Service facade for multiple SDKs |
| `src/services/QCBandService.ts` | QCBandSDK wrapper |
| `src/screens/home/SleepTab.tsx` | Sleep UI component |

---

## Step-by-Step Data Flow

### 1. Context Setup (HomeDataContext.tsx)

The `HomeDataProvider` wraps the Today screen and calls `useHomeData()` once, sharing the data with all child tabs:

```typescript
import { useHomeData, HomeData } from '../hooks/useHomeData';

export function HomeDataProvider({ children }: HomeDataProviderProps) {
  const homeData = useHomeData();

  return (
    <HomeDataContext.Provider value={homeData}>
      {children}
    </HomeDataContext.Provider>
  );
}

// Used by child components
export function useHomeDataContext(): HomeDataContextValue {
  const context = useContext(HomeDataContext);
  if (!context) {
    throw new Error('useHomeDataContext must be used within a HomeDataProvider');
  }
  return context;
}
```

### 2. Data Fetching Hook (useHomeData.ts)

The hook handles:
- Initial fetch on mount
- Re-fetch when ring connects
- Re-fetch when app comes to foreground
- Debouncing to prevent rapid fetches

```typescript
// Listen for ring connection state changes
useEffect(() => {
  const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
    if (state === 'connected' && !hasLoadedRealData.current) {
      setTimeout(() => {
        fetchData(true); // Force refresh after connection
      }, 1500);
    }
  });
  return () => unsubscribe();
}, [fetchData]);

// Listen for app foreground
useEffect(() => {
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      hasLoadedRealData.current = false;
      fetchData(true);
    }
    appState.current = nextAppState;
  });
  return () => subscription.remove();
}, [fetchData]);
```

### 3. Fetching Real Sleep Data

```typescript
async function fetchRealSleepData(): Promise<SleepData | null> {
  // Check connection first
  const connectionStatus = await UnifiedSmartRingService.isConnected();
  if (!connectionStatus.connected) {
    return null; // Will fall back to mock data
  }

  // Fetch from ring (dayIndex 0 = last night)
  const sleepInfo: SleepInfo = await getSleep(0);

  if (!sleepInfo || sleepInfo.totalSleepMinutes === 0) {
    return null;
  }

  // Transform SDK data to UI format
  const segments: SleepSegment[] = (sleepInfo.segments || [])
    .filter(s => s.type >= 1 && s.type <= 4)
    .map(s => ({
      stage: mapSleepType(s.type),
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime),
    }));

  return {
    score: calculateSleepScore(sleepInfo).score,
    timeAsleep: `${hours}h ${minutes}m`,
    timeAsleepMinutes: sleepInfo.totalSleepMinutes,
    segments,
    bedTime,
    wakeTime,
    // ...
  };
}
```

### 4. Sleep Type Mapping

The SDK returns numeric sleep types that need to be mapped to UI stages:

```typescript
// SDK SLEEPTYPE enum:
// 0 = None
// 1 = Awake
// 2 = Light
// 3 = Deep
// 4 = REM
// 5 = Unweared

function mapSleepType(type: number): SleepStage {
  switch (type) {
    case 1: return 'awake';
    case 2: return 'core';  // Light sleep = "Core" in UI
    case 3: return 'deep';
    case 4: return 'rem';
    default: return 'core';
  }
}
```

### 5. Low-Level SDK Call (sleep.ts)

```typescript
export async function getSleep(dayIndex: number = 0): Promise<SleepInfo> {
  const rawData = await UnifiedSmartRingService.getSleepData(dayIndex);

  // Process segments and calculate totals
  const segments = rawData.sleepSegments || [];

  return {
    totalSleepMinutes: rawData.totalSleepMinutes,
    deepMinutes: segments.filter(s => s.type === 3).reduce((sum, s) => sum + s.duration, 0),
    lightMinutes: segments.filter(s => s.type === 2).reduce((sum, s) => sum + s.duration, 0),
    remMinutes: segments.filter(s => s.type === 4).reduce((sum, s) => sum + s.duration, 0),
    awakeMinutes: segments.filter(s => s.type === 1).reduce((sum, s) => sum + s.duration, 0),
    segments,
    // ...
  };
}
```

### 6. Using Data in UI (SleepTab.tsx)

```typescript
import { useHomeDataContext } from '../../context/HomeDataContext';

export function SleepTab() {
  const homeData = useHomeDataContext();
  const sleep = homeData.lastNightSleep;

  return (
    <ScrollView>
      {/* Syncing indicator */}
      {homeData.isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" />
          <Text>Syncing with ring...</Text>
        </View>
      )}

      {/* Sleep score gauge */}
      <SemiCircularGauge score={sleep.score} label="LAST NIGHT" />

      {/* Sleep stats */}
      <SleepStatsRow
        timeAsleep={sleep.timeAsleep}
        restingHR={sleep.restingHR}
        respiratoryRate={sleep.respiratoryRate}
      />

      {/* Sleep stages chart */}
      {sleep.segments.length > 0 && (
        <SleepStagesChart
          segments={sleep.segments}
          bedTime={sleep.bedTime}
          wakeTime={sleep.wakeTime}
        />
      )}
    </ScrollView>
  );
}
```

---

## Data Types

### SleepData (UI Format)

```typescript
interface SleepData {
  score: number;              // 0-100 sleep quality score
  timeAsleep: string;         // "7h 32m"
  timeAsleepMinutes: number;  // 452
  restingHR: number;          // 55
  respiratoryRate: number;    // 14
  segments: SleepSegment[];   // Array of sleep stages
  bedTime: Date;              // When sleep started
  wakeTime: Date;             // When sleep ended
}

interface SleepSegment {
  stage: 'awake' | 'rem' | 'core' | 'deep';
  startTime: Date;
  endTime: Date;
}
```

### SleepInfo (SDK Format)

```typescript
interface SleepInfo {
  totalSleepMinutes: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  segments: Array<{
    startTime: string;   // ISO date string
    endTime: string;
    duration: number;    // minutes
    type: number;        // 0-5 SDK type
  }>;
  bedTime?: number;      // timestamp
  wakeTime?: number;     // timestamp
}
```

---

## Fetching Other Data Types

The same pattern can be used for other ring data:

### Steps
```typescript
const steps = await UnifiedSmartRingService.getSteps();
// Returns: { steps, calories, distance }
```

### Heart Rate
```typescript
const hr = await UnifiedSmartRingService.get24HourHeartRate();
// Returns: Array of hourly HR readings
```

### Battery
```typescript
const battery = await UnifiedSmartRingService.getBattery();
// Returns: { battery: number }
```

### SpO2
```typescript
const spo2 = await UnifiedSmartRingService.getSpO2();
// Returns: { spo2: number }
```

---

## Key Patterns

1. **Shared Context** - Use `HomeDataContext` to avoid multiple simultaneous fetches
2. **Connection Listener** - Re-fetch when ring connects using `onConnectionStateChanged`
3. **App State Listener** - Re-fetch when app comes to foreground
4. **Debouncing** - Prevent rapid fetches with minimum interval (3 seconds)
5. **Fallback to Mock** - If ring not connected, show mock data
6. **Loading States** - Show `isSyncing` indicator while fetching
