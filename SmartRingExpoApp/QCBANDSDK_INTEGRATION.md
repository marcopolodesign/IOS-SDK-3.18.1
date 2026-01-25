# QCBandSDK Integration Guide

This document explains how the QCBandSDK (smart ring SDK) works, based on the official Demo project patterns. It covers connection, battery, steps, and sleep data fetching.

---

## Table of Contents

1. [Connection Flow](#connection-flow)
2. [Battery Data](#battery-data)
3. [Steps Data](#steps-data)
4. [Sleep Data](#sleep-data)
5. [State Machine](#state-machine)
6. [Data Models](#data-models)

---

## Connection Flow

### Overview

The connection process is **asynchronous** and follows these steps:

```
1. Scan for devices
2. Select device & initiate BLE connection
3. BLE connects → SDK registers peripheral
4. SDK syncs time → Connection is "complete"
5. App can now fetch data
```

### Step 1: Scan for Devices

```typescript
// In React Native
await scan(15); // Scan for 15 seconds
```

```objc
// Native (Objective-C)
[[QCCentralManager shared] scanWithTimeout:15];
```

**What happens:**
- The SDK scans for BLE peripherals with specific service UUIDs
- Discovered devices are emitted via `onDeviceDiscovered` events
- Each device has: `id`, `mac`, `name`, `rssi`

### Step 2: Connect to Device

```typescript
// In React Native
const result = await connect(device.mac);
if (result.success) {
  // Connected!
}
```

```objc
// Native (Objective-C)
[[QCCentralManager shared] connect:peripheral deviceType:QCDeviceTypeRing];
```

**What happens internally:**
1. `connect()` is called with the device MAC address
2. BLE connection is initiated
3. On BLE connect: `didConnectPeripheral:` fires
4. SDK calls `[[QCSDKManager shareInstance] addPeripheral:peripheral finished:^...]`
5. On success: State changes to `QCStateConnected`
6. Time is synced with `[QCSDKCmdCreator setTime:]`
7. Promise resolves with `{ success: true }`

### Step 3: Time Sync (Required)

After connection, you **must** sync time to get device features:

```objc
[QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
    // `info` contains feature flags:
    // - QCBandFeatureBloodPressure
    // - QCBandFeatureBloodOxygen
    // - QCBandFeatureTemperature
    // - etc.
} failed:^{
    // Handle failure
}];
```

---

## Battery Data

### One-Shot Read

```typescript
// React Native
const battery = await UnifiedSmartRingService.getBattery();
console.log(battery.battery); // e.g., 85
console.log(battery.isCharging); // true/false
```

```objc
// Native (Objective-C)
[QCSDKCmdCreator readBatterySuccess:^(int battery, BOOL charging) {
    NSLog(@"Battery: %d%%, charging: %d", battery, charging);
} failed:^{
    NSLog(@"Failed to get battery");
}];
```

### Real-Time Notifications

```objc
// Set up callback for real-time battery updates
[QCSDKManager shareInstance].currentBatteryInfo = ^(NSInteger battery, BOOL charging) {
    NSLog(@"Battery changed: %ld%%, charging: %d", (long)battery, charging);
};
```

### Response Format

| Field | Type | Description |
|-------|------|-------------|
| `battery` | `number` | Battery percentage (0-100) |
| `isCharging` | `boolean` | Whether device is charging |

---

## Steps Data

### Current Steps Summary

```typescript
// React Native
const steps = await UnifiedSmartRingService.getSteps();
console.log(steps.steps);     // Total step count
console.log(steps.calories);  // Calories burned
console.log(steps.distance);  // Distance in meters
```

```objc
// Native (Objective-C)
[QCSDKCmdCreator getCurrentSportSucess:^(QCSportModel * _Nonnull sport) {
    NSLog(@"Steps: %ld, Calories: %lf, Distance: %ld",
          (long)sport.totalStepCount,
          sport.calories,
          (long)sport.distance);
} failed:^{
    NSLog(@"Failed to get steps");
}];
```

### Detailed Steps by Day

```objc
// dayIndex: 0 = today, 1 = yesterday, etc. (0-6)
[QCSDKCmdCreator getSportDetailDataByDay:0 sportDatas:^(NSArray<QCSportModel *> * _Nonnull sports) {
    for (QCSportModel *sport in sports) {
        NSLog(@"Time: %@, Steps: %ld, Cal: %lf, Dist: %ld",
              sport.happenDate,
              (long)sport.totalStepCount,
              sport.calories,
              (long)sport.distance);
    }
} fail:^{
    NSLog(@"Failed");
}];
```

### Real-Time Step Updates

```objc
// Set up callback for real-time step updates
[QCSDKManager shareInstance].currentStepInfo = ^(NSInteger step, NSInteger calorie, NSInteger distance) {
    NSLog(@"Steps: %ld, Calories: %ld, Distance: %ld (meters)",
          (long)step, (long)calorie, (long)distance);
};
```

### Response Format

| Field | Type | Description |
|-------|------|-------------|
| `steps` | `number` | Total step count |
| `calories` | `number` | Calories burned |
| `distance` | `number` | Distance in meters |
| `timestamp` | `number` | Unix timestamp (ms) |

---

## Sleep Data

### Sleep Types

```objc
typedef NS_ENUM(NSInteger, SLEEPTYPE) {
    SLEEPTYPENONE = 0,    // No data
    SLEEPTYPESOBER = 1,   // Awake
    SLEEPTYPELIGHT = 2,   // Light sleep
    SLEEPTYPEDEEP = 3,    // Deep sleep
    SLEEPTYPEREM = 4,     // REM sleep
    SLEEPTYPEUNWEARED = 5 // Not worn
};
```

### Get One Day Sleep (Full Day with Naps)

This is the **recommended method** - it returns both night sleep and daytime naps.

```typescript
// React Native
const sleep = await UnifiedSmartRingService.getSleepData();
console.log(sleep.totalSleepMinutes);
console.log(sleep.totalNapMinutes);
console.log(sleep.fallAsleepDuration);
console.log(sleep.sleepSegments); // Array of sleep periods
console.log(sleep.napSegments);   // Array of nap periods
```

```objc
// Native (Objective-C)
// dayIndex: 0 = today, 1 = yesterday, etc.
[QCSDKCmdCreator getFulldaySleepDetailDataByDay:0 
    sleepDatas:^(NSArray<QCSleepModel *> * _Nullable sleeps, 
                 NSArray<QCSleepModel *> * _Nullable naps) {
    
    // Night sleep segments
    for (QCSleepModel *sleep in sleeps) {
        NSLog(@"Start: %@, End: %@, Duration: %ld min, Type: %ld",
              sleep.happenDate,
              sleep.endTime,
              (long)sleep.total,
              (long)sleep.type);
    }
    
    // Calculate totals using helper methods
    NSInteger fallAsleepDuration = [QCSleepModel fallAsleepDuration:sleeps];
    NSInteger totalSleep = [QCSleepModel sleepDuration:sleeps];
    NSInteger totalNaps = [QCSleepModel sleepDuration:naps];
    
    NSLog(@"Fall asleep time: %ld min", (long)fallAsleepDuration);
    NSLog(@"Total sleep: %ldh %ldm", totalSleep/60, totalSleep%60);
    NSLog(@"Total naps: %ldh %ldm", totalNaps/60, totalNaps%60);
    
} fail:^{
    NSLog(@"Failed to get sleep");
}];
```

### Get Multiple Days Sleep

```objc
// startDayIndex: 1 = from yesterday to today
[QCSDKCmdCreator getSleepDetailDataFromDay:1 
    sleepDatas:^(NSDictionary<NSString*,NSArray<QCSleepModel*>*>* _Nonnull sleeps) {
    
    for (NSString *dayText in sleeps.allKeys) {
        NSLog(@"Day: %@", dayText);
        NSArray *daySleeps = [sleeps valueForKey:dayText];
        
        for (QCSleepModel *sleep in daySleeps) {
            NSLog(@"  %@ - %@ (%ld min, type %ld)",
                  sleep.happenDate,
                  sleep.endTime,
                  (long)sleep.total,
                  (long)sleep.type);
        }
        
        NSInteger total = [QCSleepModel sleepDuration:daySleeps];
        NSLog(@"  Total: %ldh %ldm", total/60, total%60);
    }
} fail:^{
    NSLog(@"Failed");
}];
```

### QCSleepModel Fields

| Field | Type | Description |
|-------|------|-------------|
| `type` | `SLEEPTYPE` | Sleep stage (0-5, see enum above) |
| `happenDate` | `string` | Start time (`yyyy-MM-dd HH:mm:ss`) |
| `endTime` | `string` | End time (`yyyy-MM-dd HH:mm:ss`) |
| `total` | `number` | Duration in **minutes** |

### Helper Methods

```objc
// Calculate total sleep duration from array of segments
+ (NSInteger)sleepDuration:(NSArray<QCSleepModel*>*)sleepModels;

// Calculate time to fall asleep
+ (NSInteger)fallAsleepDuration:(NSArray<QCSleepModel*>*)sleepModels;
```

### Sleep Response Format (React Native)

```typescript
interface SleepData {
  totalSleepMinutes: number;      // Total night sleep in minutes
  totalNapMinutes: number;        // Total daytime naps in minutes
  fallAsleepDuration: number;     // Time to fall asleep in minutes
  sleepSegments: SleepSegment[];  // Night sleep periods
  napSegments: SleepSegment[];    // Daytime nap periods
  timestamp: number;              // Unix timestamp (ms)
}

interface SleepSegment {
  startTime: string;   // "yyyy-MM-dd HH:mm:ss"
  endTime: string;     // "yyyy-MM-dd HH:mm:ss"
  duration: number;    // Duration in minutes
  type: number;        // SLEEPTYPE enum value
}
```

---

## State Machine

### QCState (Connection States)

| Value | Name | Description |
|-------|------|-------------|
| 0 | `QCStateUnkown` | Unknown state |
| 1 | `QCStateUnbind` | No device bound |
| 2 | `QCStateConnecting` | Connection in progress |
| 3 | `QCStateConnected` | Successfully connected |
| 4 | `QCStateDisconnecting` | Disconnection in progress |
| 5 | `QCStateDisconnected` | Disconnected |

### QCBluetoothState (Bluetooth States)

| Value | Name | Description |
|-------|------|-------------|
| 0 | `QCBluetoothStateUnkown` | Unknown |
| 1 | `QCBluetoothStateResetting` | Resetting |
| 2 | `QCBluetoothStateUnsupported` | Not supported |
| 3 | `QCBluetoothStateUnauthorized` | Not authorized |
| 4 | `QCBluetoothStatePoweredOff` | Bluetooth off |
| 5 | `QCBluetoothStatePoweredOn` | Bluetooth on |

---

## Data Models

### QCSportModel (Steps/Activity)

```objc
@interface QCSportModel : NSObject
@property (nonatomic, assign) NSInteger totalStepCount;  // Total steps
@property (nonatomic, assign) double calories;           // Calories burned
@property (nonatomic, assign) NSInteger distance;        // Distance (meters)
@property (nonatomic, strong) NSString *happenDate;      // Timestamp
@end
```

### QCSleepModel (Sleep)

```objc
@interface QCSleepModel : NSObject
@property (nonatomic, assign) SLEEPTYPE type;        // Sleep type (0-5)
@property (nonatomic, strong) NSString *happenDate;  // Start time
@property (nonatomic, strong) NSString *endTime;     // End time
@property (nonatomic, assign) NSInteger total;       // Duration (minutes)
@end
```

---

## Common Patterns

### Error Handling

All SDK methods follow a success/fail callback pattern:

```objc
[QCSDKCmdCreator someMethod:params success:^(ResultType result) {
    // Handle success
} fail:^{
    // Handle failure - device may be busy or disconnected
}];
```

### Checking Connection Before Commands

Always verify connection state before sending commands:

```objc
if ([QCCentralManager shared].deviceState != QCStateConnected) {
    // Not connected - don't send commands
    return;
}
```

### Day Index Convention

For historical data methods, `dayIndex` follows this convention:
- `0` = Today
- `1` = Yesterday
- `2` = 2 days ago
- ... up to `6` (7 days of history)

---

## Quick Reference

| Operation | Method |
|-----------|--------|
| Scan | `scan(duration)` |
| Connect | `connect(mac)` |
| Disconnect | `disconnect()` |
| Get Battery | `getBattery()` |
| Get Steps | `getSteps()` |
| Get Sleep (1 day) | `getSleepData(dayIndex)` |
| Get Heart Rate | `getHeartRate()` or `startHeartRateMeasuring()` |
| Get SpO2 | `getSpO2()` |
| Sync Time | `setTime()` (auto-called on connect) |

---

## Troubleshooting

### "SDK is busy" errors
The SDK can only process one command at a time. Wait for previous commands to complete.

### Connection timeouts
- Make sure the ring is awake (tap it)
- Keep the ring close to the phone
- Try restarting Bluetooth

### No sleep data
- Ensure the ring was worn during sleep
- Sleep data may take a few hours to sync
- Check `dayIndex` - use `1` for last night's sleep

### Battery reads fail immediately after connect
- Wait 1-2 seconds after connection before fetching data
- The SDK needs time to complete the handshake

