# V8 SDK vs X3 SDK — Comparison & Migration Guide

Reference for migrating from BleSDK_X3 to BleSDK_V8 (Jstyle smart ring / band).

---

## Architecture (Identical)

| Aspect | X3 | V8 |
|--------|----|----|
| Singleton | `BleSDK_X3.sharedManager` | `BleSDK_V8.sharedManager` |
| BLE Service UUID | `FFF0` | `FFF0` |
| Write Characteristic | `FFF6` | `FFF6` |
| Notify Characteristic | `FFF7` | `FFF7` |
| Response Wrapper | `DeviceData_X3` (dataType, dicData, dataEnd) | `DeviceData_V8` (same shape) |
| Pagination | Max 50 records; mode 0=start, 2=continue, 0x99=delete | Same |
| BLE Layer | `NewBle.h/m` (CBCentralManager wrapper) | Same |
| Delegate Protocol | `MyBleDelegate` (6 callbacks) | Same |
| Static Library | `libBleSDK.a` | `libBleSDK.a` |

**Bottom line:** Same protocol, same UUIDs, same data flow. The V8 SDK is a drop-in replacement with additional capabilities.

---

## What's New in V8

### New Data Types

| Feature | V8 Method | Data Shape |
|---------|-----------|------------|
| **Sleep HRV** | `GetSleepHRVDataWithMode:withStartDate:` | HRV readings captured during sleep phases |
| **OSA (Sleep Apnea)** | `GetOSADataWithMode:withStartDate:` | Obstructive sleep apnea detection events |
| **OSA Config** | `configureOSAFeatureWithMode:enable:` | Enable/disable OSA monitoring on device |
| **EOV (Energy of Vitality)** | `GetEOVDataWithMode:withStartDate:` | Energy/vitality metric |
| **Continuous SpO2** | `GetContinuousSpO2DataWithMode:withStartDate:` | Separate from auto SpO2 — continuous stream |
| **Axillary Temperature** | Included in temperature data types | Wrist temp + axillary temp distinction |
| **ECG Streaming** | `setECGRealtimeDuringHRVEnabled:` | Real-time ECG waveform during HRV measurement |

### New Enum Values (DATATYPE_V8)

```
EovData_V8          = 83   // Energy of vitality
OSAData_V8          = 84   // Sleep apnea
SleepHRVData_V8     = 85   // Sleep-phase HRV
ContinuousSpO2_V8   = (new) // Continuous blood oxygen
AxillaryTemp_V8     = 49   // Axillary temperature (separate from wrist)
```

---

## Unchanged Data Types

All existing X3 data types work identically in V8 with the same dictionary keys:

### Sleep
```objc
arrayDetailSleepData: [
  { startTime_SleepData, totalSleepTime, arraySleepQuality, sleepUnitLength }
]
// Quality: 1=awake, 2=light, 3=deep (unchanged)
```

### Heart Rate (Continuous)
```objc
arrayContinuousHR: [{ date, arrayHR: [int] }]
```

### Heart Rate (Single)
```objc
arraySingleHR: [{ date, singleHR }]
```

### HRV
```objc
arrayHrvData: [{ date, hrv, stress, heartRate, systolicBP, diastolicBP }]
```

### SpO2 (Auto)
```objc
arrayAutomaticSpo2Data: [{ date, automaticSpo2Data }]
```

### Steps / Activity
```objc
arrayTotalActivityData: [{ date, step, exerciseMinutes, distance, calories, goal, activeMinutes }]
arrayDetailActivityData: [{ date, step, exerciseMinutes, distance, calories }]  // per hour
```

### Temperature
```objc
arrayTemperatureData: [{ date, temperature }]
```

### Battery
```objc
dicData: { batteryLevel: 0-100 }  // No charging state key in either SDK
```

---

## API Rename Map

Methods that changed name slightly:

| X3 | V8 |
|----|----|
| `GetSleepDetailAndActivityDataWithMode:` | `getSleepDetailsAndActivityWithMode:` |

All other method names are identical except for the class/suffix change (`_X3` → `_V8`).

---

## Structs

| X3 | V8 | Fields |
|----|----|----|
| `MyDeviceTime_X3` | `MyDeviceTime_V8` | year, month, day, hour, minute, second |
| `MyPersonalInfo_X3` | `MyPersonalInfo_V8` | gender, age, height, weight, stride |
| `MyDeviceInfo_X3` | `MyDeviceInfo_V8` | handPosition, autoDetectMotion |
| `MyAutomaticMonitoring_X3` | `MyAutomaticMonitoring_V8` | mode, start/end time, weeks, intervalTime, dataType |
| `MyWeatherParameter_X3` | `MyWeatherParameter_V8` | weatherType, temps, city |
| `MyBreathParameter_X3` | `MyBreathParameter_V8` | breathe in/out durations |

---

## Activity Modes (Same 18 Types)

```
Run(0), Cycling(1), Badminton(2), Football(3), Tennis(4), Yoga(5),
Breath(6), Dance(7), Basketball(8), Walk(9), Workout(10), Cricket(11),
Hiking(12), Aerobics(13), PingPong(14), RopeJump(15), SitUps(16), Volleyball(17)
```

---

## Automatic Monitoring (Same Config)

```objc
// Works for: HR (1), SpO2 (2), Temperature (3), HRV (4)
struct AutomaticMonitoring {
    int mode;           // 0=off, 1=time window, 2=interval
    int startTime_Hour, startTime_Minutes;
    int endTime_Hour, endTime_Minutes;
    MyWeeks weeks;      // per-day BOOL
    int intervalTime;   // minutes between measurements
    int dataType;
}
```

---

## Migration Checklist

### Native Bridge (`V8Bridge.m` — already exists)
- [x] Uses `BleSDK_V8` singleton
- [x] Same BLE UUIDs (FFF0/FFF6/FFF7)
- [x] Same `DataParsingWithData:` pattern
- [ ] Add `GetSleepHRVDataWithMode:` support
- [ ] Add `GetOSADataWithMode:` support
- [ ] Add `GetEOVDataWithMode:` support
- [ ] Add `GetContinuousSpO2DataWithMode:` support
- [ ] Add `configureOSAFeatureWithMode:enable:` support
- [ ] Add `setECGRealtimeDuringHRVEnabled:` support

### JS Service (`V8Service.ts` — already exists)
- [x] Basic data fetching (steps, sleep, HR, SpO2, temp, HRV, battery)
- [x] Real-time HR streaming
- [ ] Sleep HRV data type
- [ ] OSA data type
- [ ] EOV data type
- [ ] Continuous SpO2 data type

### Types (`sdk.types.ts`)
- [ ] Add `SleepHRVData` interface
- [ ] Add `OSAData` interface
- [ ] Add `EOVData` interface

---

## SDK File Locations

| SDK | Headers | Library | Demo |
|-----|---------|---------|------|
| X3 | `IOS (X3)/Ble SDK Demo/BleSDK/` | `libBleSDK.a` (X3) | `IOS (X3)/Ble SDK Demo/` |
| V8 | `V8 IOS/BleSDK/` | `libBleSDK.a` (V8) | `V8 IOS/Ble SDK Demo/` |
| App (X3 bridge) | `ios/JstyleBridge/` | via `ios/Frameworks/` | — |
| App (V8 bridge) | `ios/V8Bridge/` | via `ios/Frameworks/` | — |
