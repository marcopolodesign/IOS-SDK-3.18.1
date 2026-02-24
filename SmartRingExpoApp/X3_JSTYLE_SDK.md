# Focus X3 — Jstyle BleSDK_X3 Integration

## Overview

The Focus X3 ring uses the Jstyle BleSDK_X3, an Objective-C static library (`libBleSDK.a`) that communicates over BLE using a custom protocol on service UUID `FFF0`.

## BLE Protocol

| UUID | Role |
|---|---|
| `FFF0` | Service UUID (used for scanning and service discovery) |
| `FFF6` | Write characteristic (send commands to ring) |
| `FFF7` | Notify characteristic (receive responses from ring) |

## Communication Flow

1. **Build command**: `NSMutableData *cmd = [[BleSDK_X3 sharedManager] SomeMethod:params];`
2. **Write to ring**: `[[NewBle sharedManager] writeValue:@"FFF0" characteristicUUID:@"FFF6" p:peripheral data:cmd];`
3. **Receive response**: `BleCommunicateWithPeripheral:data:` delegate callback fires
4. **Parse response**: `DeviceData_X3 *parsed = [[BleSDK_X3 sharedManager] DataParsingWithData:data];`
5. **Handle result**: Check `parsed.dataType` (DATATYPE_X3 enum), `parsed.dicData` (NSDictionary), and `parsed.dataEnd` (BOOL)

## Pagination Protocol

Many data retrieval commands (steps, sleep, HR, SpO2, temperature, HRV) return paginated results:

- **Mode 0**: Start reading from the latest position (up to 50 records)
- **Mode 2**: Continue reading (when total records > 50)
- **Mode 0x99**: Delete all data of that type
- **`dataEnd` flag**: `YES` = all data received; `NO` = send mode 2 to get next page

The native bridge (`JstyleBridge.m`) handles pagination automatically — it accumulates pages and resolves the promise only when `dataEnd == YES`.

## Data Types (DATATYPE_X3)

Key data types used by the bridge:

| Enum | Value | Description |
|---|---|---|
| `GetDeviceBattery_X3` | 9 | Battery level |
| `GetDeviceVersion_X3` | 11 | Firmware version |
| `RealTimeStep_X3` | 24 | Real-time step data push |
| `TotalActivityData_X3` | 25 | Daily step/activity totals (paginated) |
| `DetailSleepData_X3` | 27 | Sleep quality data (paginated) |
| `DynamicHR_X3` | 28 | Continuous/dynamic heart rate (paginated) |
| `StaticHR_X3` | 29 | Single/manual heart rate (paginated) |
| `HRVData_X3` | 41 | HRV data — includes BP values (paginated) |
| `AutomaticSpo2Data_X3` | 45 | Automatic SpO2 readings (paginated) |
| `TemperatureData_X3` | 48 | Temperature readings (paginated) |
| `DeviceMeasurement_HR_X3` | 58 | Manual HR measurement result |
| `DeviceMeasurement_Spo2_X3` | 60 | Manual SpO2 measurement result |

Full enum: see `BleSDK_Header_X3.h` (88 data types total).

## Sleep Data Format

X3 sleep data (`DetailSleepData_X3`) contains:
- `arraySleepQuality`: Array of quality values per time unit
- `sleepUnitLength`: Duration in minutes per unit

Sleep quality values (to be confirmed with physical device testing):
- `1` = Deep sleep
- `2` = Light sleep
- `3` = Awake
- `4` = REM

## HRV Data Format

X3 HRV data (`HRVData_X3`) includes:
- `hrvValue`: HRV SDNN value
- `hrvTired`: Fatigue index
- `KHrvMoodValue`: Mood value
- `KHrvBreathRate`: Breath rate
- `HighPressure`: Systolic blood pressure
- `LowPressure`: Diastolic blood pressure

This is the only source of blood pressure data on X3 (no dedicated BP measurement).

## Manual Measurement

To trigger a manual measurement on the ring:

```objc
// Heart rate — 30 second measurement
[[BleSDK_X3 sharedManager] manualMeasurementWithDataType:heartRateData_X3
                                         measurementTime:30
                                                    open:YES];

// SpO2 — 30 second measurement
[[BleSDK_X3 sharedManager] manualMeasurementWithDataType:spo2Data_X3
                                         measurementTime:30
                                                    open:YES];

// Stop measurement
[[BleSDK_X3 sharedManager] manualMeasurementWithDataType:heartRateData_X3
                                         measurementTime:0
                                                    open:NO];
```

Results arrive via `DeviceMeasurement_HR_X3` / `DeviceMeasurement_Spo2_X3` data types.

## Real-Time Data

X3 supports real-time data upload (steps, HR, SpO2, temp, calories):

```objc
// Start: type=1
[[BleSDK_X3 sharedManager] RealTimeDataWithType:1];

// Stop: type=0
[[BleSDK_X3 sharedManager] RealTimeDataWithType:0];
```

Data arrives as `RealTimeStep_X3` (dataType 24) with keys: `step`, `distance`, `calories`, `heartRate`, `spo2`, `temperature`.

## Personal Info

```objc
typedef struct PersonalInfo_X3 {
    int gender;   // 0=female, 1=male (NOTE: opposite of QCBandSDK)
    int age;
    int height;   // cm
    int weight;   // kg
    int stride;   // cm
} MyPersonalInfo_X3;
```

## Activity/Sport Modes

18 sport types: Run, Cycling, Badminton, Football, Tennis, Yoga, Breath, Dance, Basketball, Walk, Workout, Cricket, Hiking, Aerobics, PingPong, RopeJump, SitUps, Volleyball.

Work modes: start (1), pause (2), continue (3), stop (4).

## Paired Device Persistence

X3 SDK does not natively persist paired devices. The bridge uses `NSUserDefaults` to store the peripheral UUID and name, and uses `retrieveConnectedPeripheralsWithServices:` to find the device for auto-reconnect.

## File Structure

```
ios/JstyleBridge/
├── JstyleBridge.h          # RCTEventEmitter subclass header
├── JstyleBridge.m          # Main native bridge (~700 lines)
├── NewBle.h                # BLE connection manager header
├── NewBle.m                # BLE connection manager (adapted from demo)
├── BleSDK_X3.h             # SDK API header
├── BleSDK_Header_X3.h      # Structs, enums, constants
├── DeviceData_X3.h          # Response container (dataType, dicData, dataEnd)
└── libBleSDK.a             # Static library (arm64)
```

## Key Differences from QCBandSDK (R1)

| Aspect | QCBandSDK (R1) | Jstyle BleSDK_X3 (X3) |
|---|---|---|
| Architecture | Callback-based (success/fail blocks) | Delegate-based (async command→response) |
| BLE Management | Managed by SDK (`QCCentralManager`) | Manual via `NewBle` + `CBCentralManager` |
| Data Retrieval | Single call with callback | Paginated (mode 0/2, dataEnd flag) |
| Pairing | SDK manages (`isBindDevice`) | Manual via `NSUserDefaults` |
| Gender | 0=male, 1=female | 0=female, 1=male |
| Distance | Meters | Kilometers |
| Blood Pressure | Dedicated measurement | Embedded in HRV data |
| Blood Glucose | Supported | Not supported |
| Stress | Dedicated endpoint | Not supported (derive from HRV) |
