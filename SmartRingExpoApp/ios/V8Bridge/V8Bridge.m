//
//  V8Bridge.m
//  SmartRing
//
//  Native bridge for BleSDK_V8 (Focus Band)
//

#import "V8Bridge.h"
#import "NewBle.h"
#import "BleSDK_V8.h"
#import "BleSDK_Header_V8.h"
#import "DeviceData_V8.h"
#import <React/RCTLog.h>
#import <CoreBluetooth/CoreBluetooth.h>

static NSString *const kV8ServiceUUID = @"FFF0";
static NSString *const kV8WriteCharUUID = @"FFF6";
static NSString *const kV8NotifyCharUUID = @"FFF7";
static NSString *const kV8PairedDeviceUUIDKey = @"V8PairedDeviceUUID";
static NSString *const kV8PairedDeviceNameKey = @"V8PairedDeviceName";

@interface V8Bridge () <MyBleDelegate>

@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, strong) NSMutableArray<NSDictionary *> *discoveredDevices;
@property (nonatomic, strong) CBPeripheral *connectedPeripheral;
@property (nonatomic, copy) NSString *connectedDeviceId;

// Pending promises for async operations
@property (nonatomic, copy) RCTPromiseResolveBlock pendingConnectResolver;
@property (nonatomic, copy) RCTPromiseRejectBlock pendingConnectRejecter;

// Pagination state for data retrieval
@property (nonatomic, strong) NSMutableArray *accumulatedStepsData;
@property (nonatomic, strong) NSMutableArray *accumulatedSleepData;
@property (nonatomic, strong) NSMutableArray *accumulatedHRData;
@property (nonatomic, strong) NSMutableArray *accumulatedSpO2Data;
@property (nonatomic, strong) NSMutableArray *accumulatedTempData;
@property (nonatomic, strong) NSMutableArray *accumulatedHRVData;
@property (nonatomic, strong) NSMutableArray *accumulatedActivityModeData;
@property (nonatomic, strong) NSMutableArray *accumulatedSleepActivityData;
@property (nonatomic, strong) NSMutableArray *accumulatedPPIData;
@property (nonatomic, copy) RCTPromiseResolveBlock pendingDataResolver;
@property (nonatomic, copy) RCTPromiseRejectBlock pendingDataRejecter;
@property (nonatomic, assign) DATATYPE_V8 pendingDataType;
@property (nonatomic, strong) NSTimer *pendingDataWatchdogTimer;
@property (nonatomic, assign) NSTimeInterval pendingDataTimeoutInterval;
@property (nonatomic, strong) NSTimer *sleepActivityIdleTimer;

// Connection stability
@property (nonatomic, assign) BOOL isDisconnecting;
@property (nonatomic, strong) NSTimer *reconnectionTimer;
@property (nonatomic, assign) NSInteger reconnectionAttempts;

@end

@implementation V8Bridge

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _discoveredDevices = [NSMutableArray array];
        _accumulatedStepsData = [NSMutableArray array];
        _accumulatedSleepData = [NSMutableArray array];
        _accumulatedHRData = [NSMutableArray array];
        _accumulatedSpO2Data = [NSMutableArray array];
        _accumulatedTempData = [NSMutableArray array];
        _accumulatedHRVData = [NSMutableArray array];
        _accumulatedActivityModeData = [NSMutableArray array];
        _accumulatedSleepActivityData = [NSMutableArray array];
        _accumulatedPPIData = [NSMutableArray array];
        _pendingDataType = DataError_V8;
        _pendingDataTimeoutInterval = 20.0;
        _isDisconnecting = NO;
        _reconnectionAttempts = 0;
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"V8DeviceDiscovered",
        @"V8ConnectionStateChanged",
        @"V8BluetoothStateChanged",
        @"V8RealTimeData",
        @"V8MeasurementResult",
        @"V8BatteryData",
        @"V8Error",
        @"V8DebugLog"
    ];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Helper Methods

- (void)debugLog:(NSString *)message {
    RCTLogInfo(@"V8Bridge: %@", message);
    if (self.hasListeners) {
        [self sendEventWithName:@"V8DebugLog" body:@{
            @"message": message,
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        }];
    }
}

- (void)sendError:(NSString *)code message:(NSString *)message {
    if (self.hasListeners) {
        [self sendEventWithName:@"V8Error" body:@{
            @"code": code,
            @"message": message
        }];
    }
}

- (BOOL)rejectIfBusyForOperation:(NSString *)operation
                        rejecter:(RCTPromiseRejectBlock)reject {
    if (!self.pendingDataResolver) {
        return NO;
    }
    NSString *message = [NSString stringWithFormat:@"%@ rejected: V8 bridge is busy with pending data type %d",
                         operation, (int)self.pendingDataType];
    [self debugLog:message];
    if (reject) {
        reject(@"BUSY", message, nil);
    }
    return YES;
}

- (void)setPendingDataRequestWithResolver:(RCTPromiseResolveBlock)resolve
                                 rejecter:(RCTPromiseRejectBlock)reject
                                     type:(DATATYPE_V8)type {
    self.pendingDataResolver = resolve;
    self.pendingDataRejecter = reject;
    self.pendingDataType = type;
    [self invalidatePendingDataWatchdog];
    if (self.pendingDataTimeoutInterval > 0) {
        self.pendingDataWatchdogTimer = [NSTimer scheduledTimerWithTimeInterval:self.pendingDataTimeoutInterval
                                                                          target:self
                                                                        selector:@selector(pendingDataWatchdogFired:)
                                                                        userInfo:nil
                                                                         repeats:NO];
    }
}

- (void)clearPendingDataRequest {
    [self invalidatePendingDataWatchdog];
    [self invalidateSleepActivityIdleTimer];
    self.pendingDataResolver = nil;
    self.pendingDataRejecter = nil;
    self.pendingDataType = DataError_V8;
}

- (void)rejectPendingDataRequestWithCode:(NSString *)code
                                 message:(NSString *)message {
    if (self.pendingDataRejecter) {
        self.pendingDataRejecter(code, message, nil);
    }
    [self clearPendingDataRequest];
}

- (void)pendingDataWatchdogFired:(NSTimer *)timer {
    (void)timer;
    if (!self.pendingDataResolver) return;
    NSString *message = [NSString stringWithFormat:@"V8 pending data request timed out (data type %d)",
                         (int)self.pendingDataType];
    [self debugLog:message];
    [self rejectPendingDataRequestWithCode:@"NATIVE_TIMEOUT" message:message];
    [self clearAccumulatedDataBuffers];
}

- (void)invalidatePendingDataWatchdog {
    if (self.pendingDataWatchdogTimer) {
        [self.pendingDataWatchdogTimer invalidate];
        self.pendingDataWatchdogTimer = nil;
    }
}

- (void)resetSleepActivityIdleTimer {
    if (self.sleepActivityIdleTimer) {
        [self.sleepActivityIdleTimer invalidate];
        self.sleepActivityIdleTimer = nil;
    }
    self.sleepActivityIdleTimer = [NSTimer scheduledTimerWithTimeInterval:3.0
                                                                    target:self
                                                                  selector:@selector(sleepActivityIdleTimerFired:)
                                                                  userInfo:nil
                                                                   repeats:NO];
}

- (void)invalidateSleepActivityIdleTimer {
    if (self.sleepActivityIdleTimer) {
        [self.sleepActivityIdleTimer invalidate];
        self.sleepActivityIdleTimer = nil;
    }
}

- (void)sleepActivityIdleTimerFired:(NSTimer *)timer {
    (void)timer;
    if (!self.pendingDataResolver) return;
    NSArray *resolveData = nil;
    NSString *logTag = @"[V8Idle]";
    if (self.pendingDataType == DetailSleepAndActivityData_V8) {
        resolveData = [self.accumulatedSleepActivityData copy];
        logTag = @"[V8SleepActivity]";
        [self.accumulatedSleepActivityData removeAllObjects];
    } else if (self.pendingDataType == DynamicHR_V8) {
        resolveData = [self.accumulatedHRData copy];
        logTag = @"[V8HR]";
        [self.accumulatedHRData removeAllObjects];
    } else if (self.pendingDataType == HRVData_V8) {
        resolveData = [self.accumulatedHRVData copy];
        logTag = @"[V8HRV]";
        [self.accumulatedHRVData removeAllObjects];
    } else {
        return;
    }
    self.pendingDataResolver(@{@"data": resolveData});
    [self clearPendingDataRequest];
}

- (void)clearAccumulatedDataBuffers {
    [self.accumulatedStepsData removeAllObjects];
    [self.accumulatedSleepData removeAllObjects];
    [self.accumulatedHRData removeAllObjects];
    [self.accumulatedSpO2Data removeAllObjects];
    [self.accumulatedTempData removeAllObjects];
    [self.accumulatedHRVData removeAllObjects];
    [self.accumulatedActivityModeData removeAllObjects];
    [self.accumulatedSleepActivityData removeAllObjects];
    [self.accumulatedPPIData removeAllObjects];
}

- (void)claimDelegate {
    [[NewBle sharedManager] setDelegate:self];
}

- (void)writeCommand:(NSMutableData *)cmd {
    [[NewBle sharedManager] writeValue:kV8ServiceUUID
                      characteristicUUID:kV8WriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

- (NSMutableData *)buildTimeSyncCommand {
    NSDate *now = [NSDate date];
    NSCalendar *cal = [NSCalendar currentCalendar];
    NSDateComponents *c = [cal components:(NSCalendarUnitYear|NSCalendarUnitMonth|NSCalendarUnitDay|
                                           NSCalendarUnitHour|NSCalendarUnitMinute|NSCalendarUnitSecond) fromDate:now];
    MyDeviceTime_V8 t;
    t.year = (int)c.year;
    t.month = (int)c.month;
    t.day = (int)c.day;
    t.hour = (int)c.hour;
    t.minute = (int)c.minute;
    t.second = (int)c.second;
    return [[BleSDK_V8 sharedManager] SetDeviceTime:t];
}

#pragma mark - Scanning

RCT_EXPORT_METHOD(startScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Starting BLE scan for V8 devices"];
    [self claimDelegate];
    [self.discoveredDevices removeAllObjects];

    CBUUID *serviceUUID = [CBUUID UUIDWithString:kV8ServiceUUID];
    [[NewBle sharedManager] startScanningWithServices:@[serviceUUID]];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [[NewBle sharedManager] Stopscan];
    resolve(@{@"success": @YES});
}

#pragma mark - Connection

RCT_EXPORT_METHOD(connectToDevice:(NSString *)deviceId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"V8 connecting to device: %@", deviceId]];
    [self claimDelegate];

    CBPeripheral *peripheral = nil;
    for (NSDictionary *device in self.discoveredDevices) {
        if ([device[@"id"] isEqualToString:deviceId]) {
            peripheral = device[@"peripheral"];
            break;
        }
    }

    if (!peripheral) {
        NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:deviceId];
        if (uuid) {
            NSArray *peripherals = [[NewBle sharedManager].CentralManage retrievePeripheralsWithIdentifiers:@[uuid]];
            if (peripherals.count > 0) {
                peripheral = peripherals[0];
            }
        }
    }

    if (!peripheral) {
        reject(@"DEVICE_NOT_FOUND", @"V8 device not found", nil);
        return;
    }

    self.pendingConnectResolver = resolve;
    self.pendingConnectRejecter = reject;
    [[NewBle sharedManager] connectDevice:peripheral];
}

RCT_EXPORT_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"V8 disconnecting (intentional)"];
    self.isDisconnecting = YES;
    [self stopReconnectionTimer];
    [self rejectPendingDataRequestWithCode:@"DISCONNECTED" message:@"V8 disconnected"];
    [self clearAccumulatedDataBuffers];

    if (self.connectedPeripheral) {
        [self claimDelegate];
        [[NewBle sharedManager] Disconnect];
        self.connectedPeripheral = nil;
        self.connectedDeviceId = nil;
        // NOTE: Do NOT clear NSUserDefaults pairing keys here — disconnect is temporary.
        // Pairing keys are only cleared by forgetPairedDevice or factoryReset.
    }
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(isConnected:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL connected = self.connectedPeripheral != nil && [[NewBle sharedManager] isActivityPeripheral];
    resolve(@{
        @"connected": @(connected),
        @"state": connected ? @"connected" : @"disconnected",
        @"deviceName": self.connectedPeripheral.name ?: [NSNull null],
        @"deviceId": self.connectedDeviceId ?: [NSNull null]
    });
}

RCT_EXPORT_METHOD(hasPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *pairedUUID = [[NSUserDefaults standardUserDefaults] stringForKey:kV8PairedDeviceUUIDKey];
    NSString *pairedName = [[NSUserDefaults standardUserDefaults] stringForKey:kV8PairedDeviceNameKey];
    resolve(@{
        @"hasPairedDevice": @(pairedUUID != nil),
        @"deviceId": pairedUUID ?: [NSNull null],
        @"deviceName": pairedName ?: [NSNull null]
    });
}

RCT_EXPORT_METHOD(getPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *pairedUUID = [[NSUserDefaults standardUserDefaults] stringForKey:kV8PairedDeviceUUIDKey];
    NSString *pairedName = [[NSUserDefaults standardUserDefaults] stringForKey:kV8PairedDeviceNameKey];

    if (pairedUUID) {
        resolve(@{
            @"hasPairedDevice": @YES,
            @"device": @{
                @"id": pairedUUID,
                @"mac": pairedUUID,
                @"name": pairedName ?: @"Focus Band",
                @"rssi": @(-50),
                @"sdkType": @"v8"
            }
        });
    } else {
        resolve(@{@"hasPairedDevice": @NO, @"device": [NSNull null]});
    }
}

RCT_EXPORT_METHOD(forgetPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:kV8PairedDeviceUUIDKey];
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:kV8PairedDeviceNameKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    if (self.connectedPeripheral) {
        [self claimDelegate];
        [[NewBle sharedManager] Disconnect];
        self.connectedPeripheral = nil;
        self.connectedDeviceId = nil;
    }
    resolve(@{@"success": @YES, @"message": @"V8 device forgotten"});
}

RCT_EXPORT_METHOD(autoReconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"V8 attempting auto-reconnect"];
    NSString *pairedUUID = [[NSUserDefaults standardUserDefaults] stringForKey:kV8PairedDeviceUUIDKey];

    if (!pairedUUID) {
        resolve(@{@"success": @NO, @"message": @"No V8 paired device found"});
        return;
    }

    [self claimDelegate];

    NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:pairedUUID];
    if (uuid) {
        NSArray *peripherals = [[NewBle sharedManager].CentralManage retrievePeripheralsWithIdentifiers:@[uuid]];
        if (peripherals.count > 0) {
            CBPeripheral *peripheral = peripherals[0];
            self.pendingConnectResolver = resolve;
            self.pendingConnectRejecter = reject;
            [[NewBle sharedManager] connectDevice:peripheral];
            return;
        }
    }

    CBUUID *serviceUUID = [CBUUID UUIDWithString:kV8ServiceUUID];
    NSArray *peripherals = [[NewBle sharedManager] retrieveConnectedPeripheralsWithServices:@[serviceUUID]];
    if (peripherals.count > 0) {
        CBPeripheral *peripheral = peripherals[0];
        self.pendingConnectResolver = resolve;
        self.pendingConnectRejecter = reject;
        [[NewBle sharedManager] connectDevice:peripheral];
    } else {
        resolve(@{@"success": @NO, @"message": @"V8 paired device not found nearby"});
    }
}

RCT_EXPORT_METHOD(cancelPendingDataRequest:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.pendingDataResolver) {
        [self rejectPendingDataRequestWithCode:@"CANCELLED" message:@"V8 request cancelled"];
    } else {
        [self clearPendingDataRequest];
    }
    [self clearAccumulatedDataBuffers];
    resolve(@{@"success": @YES});
}

#pragma mark - Device Info

RCT_EXPORT_METHOD(getBatteryLevel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getBatteryLevel" rejecter:reject]) return;

    [self claimDelegate];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceBattery_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetDeviceBatteryLevel];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getFirmwareVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getFirmwareVersion" rejecter:reject]) return;

    [self claimDelegate];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceVersion_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetDeviceVersion];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(syncTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"syncTime" rejecter:reject]) return;

    [self claimDelegate];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:SetDeviceTime_V8];
    [self writeCommand:[self buildTimeSyncCommand]];
}

RCT_EXPORT_METHOD(setUserInfo:(NSDictionary *)userInfo
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    int gender = [userInfo[@"gender"] intValue]; // 0=male, 1=female from JS
    MyPersonalInfo_V8 info;
    info.gender = gender;
    info.age = [userInfo[@"age"] intValue];
    info.height = [userInfo[@"height"] intValue];
    info.weight = [userInfo[@"weight"] intValue];
    info.stride = [userInfo[@"stride"] intValue] ?: 70;

    NSMutableData *cmd = [[BleSDK_V8 sharedManager] SetPersonalInfo:info];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

#pragma mark - Data Retrieval

RCT_EXPORT_METHOD(getStepsData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getStepsData" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedStepsData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:TotalActivityData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetTotalActivityDataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getSleepData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getSleepData" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedSleepData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:DetailSleepData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetDetailSleepDataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getSleepWithActivity:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getSleepWithActivity" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedSleepActivityData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:DetailSleepAndActivityData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] getSleepDetailsAndActivityWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getPPIData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getPPIData" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedPPIData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:ppiData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetPPIDataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getContinuousHR:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getContinuousHR" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedHRData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:DynamicHR_V8];
    // Request only last 2 days — avoids transferring full history (can be 3000+ records)
    NSDate *twoDaysAgo = [NSDate dateWithTimeIntervalSinceNow:-2 * 24 * 3600];
    NSDateFormatter *fmt = [[NSDateFormatter alloc] init];
    fmt.dateFormat = @"YYYY.MM.dd";
    NSString *startDateStr = [fmt stringFromDate:twoDaysAgo];
    NSDate *startDate = [fmt dateFromString:startDateStr];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetContinuousHRDataWithMode:0 withStartDate:startDate];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getHRVData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getHRVData" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedHRVData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:HRVData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetHRVDataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getAutoSpO2:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getAutoSpO2" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedSpO2Data removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:AutomaticSpo2Data_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetAutomaticSpo2DataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getTemperature:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getTemperature" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedTempData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:TemperatureData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetTemperatureDataWithMode:0 withStartDate:nil];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(getActivityModeData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getActivityModeData" rejecter:reject]) return;

    [self claimDelegate];
    [self.accumulatedActivityModeData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:ActivityModeData_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetActivityModeDataWithMode:0 withStartDate:nil needMETS:NO];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(factoryReset:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] Reset];
    [self writeCommand:cmd];

    [[NSUserDefaults standardUserDefaults] removeObjectForKey:kV8PairedDeviceUUIDKey];
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:kV8PairedDeviceNameKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    self.connectedPeripheral = nil;
    self.connectedDeviceId = nil;
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(setStepGoal:(int)goal
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] SetStepGoal:goal];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(getStepGoal:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }
    if ([self rejectIfBusyForOperation:@"getStepGoal" rejecter:reject]) return;

    [self claimDelegate];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceGoal_V8];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetStepGoal];
    [self writeCommand:cmd];
}

RCT_EXPORT_METHOD(startRealTimeData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] RealTimeDataWithType:1];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopRealTimeData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] RealTimeDataWithType:0];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(startManualMeasurement:(int)dataType
                  measurementTime:(int)time
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    MeasurementDataType_V8 measureType = (MeasurementDataType_V8)dataType;
    int measureTime = time > 0 ? time : 30;
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] manualMeasurementWithDataType:measureType
                                                                    measurementTime:measureTime
                                                                               open:YES];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopManualMeasurement:(int)dataType
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) { reject(@"NOT_CONNECTED", @"V8 not connected", nil); return; }

    [self claimDelegate];
    MeasurementDataType_V8 measureType = (MeasurementDataType_V8)dataType;
    NSMutableData *cmd = [[BleSDK_V8 sharedManager] manualMeasurementWithDataType:measureType
                                                                    measurementTime:30
                                                                               open:NO];
    [self writeCommand:cmd];
    resolve(@{@"success": @YES});
}

#pragma mark - Reconnection

- (void)stopReconnectionTimer {
    if (self.reconnectionTimer) {
        [self.reconnectionTimer invalidate];
        self.reconnectionTimer = nil;
    }
    self.reconnectionAttempts = 0;
}

- (void)startReconnectionTimer:(CBPeripheral *)peripheral {
    [self stopReconnectionTimer];
    self.reconnectionTimer = [NSTimer scheduledTimerWithTimeInterval:6.0
                                                              target:self
                                                            selector:@selector(attemptReconnection:)
                                                            userInfo:peripheral
                                                             repeats:YES];
}

- (void)attemptReconnection:(NSTimer *)timer {
    CBPeripheral *peripheral = timer.userInfo;
    if (!peripheral || self.isDisconnecting) {
        [self stopReconnectionTimer];
        return;
    }
    self.reconnectionAttempts++;
    if (self.reconnectionAttempts > 10) {
        [self debugLog:@"V8 max reconnection attempts reached"];
        [self stopReconnectionTimer];
        return;
    }
    [self debugLog:[NSString stringWithFormat:@"V8 reconnection attempt %ld", (long)self.reconnectionAttempts]];
    [self claimDelegate];
    [[NewBle sharedManager] connectDevice:peripheral];
}

#pragma mark - MyBleDelegate

- (void)scanWithPeripheral:(CBPeripheral *)peripheral
         advertisementData:(NSDictionary *)advertisementData
                      RSSI:(NSNumber *)RSSI {
    NSString *deviceId = [peripheral.identifier UUIDString];
    NSString *name = peripheral.name ?: advertisementData[CBAdvertisementDataLocalNameKey] ?: @"Unknown";
    NSString *localName = advertisementData[CBAdvertisementDataLocalNameKey] ?: name;

    // Check for duplicates
    for (NSDictionary *d in self.discoveredDevices) {
        if ([d[@"id"] isEqualToString:deviceId]) return;
    }

    [self.discoveredDevices addObject:@{
        @"id": deviceId,
        @"peripheral": peripheral,
        @"name": name,
        @"localName": localName,
        @"rssi": RSSI
    }];

    if (self.hasListeners) {
        [self sendEventWithName:@"V8DeviceDiscovered" body:@{
            @"id": deviceId,
            @"mac": deviceId,
            @"name": name,
            @"localName": localName,
            @"rssi": RSSI,
            @"sdkType": @"v8"
        }];
    }
}

- (void)ConnectSuccessfully {
    [self debugLog:@"V8 connected successfully"];
    CBPeripheral *peripheral = [NewBle sharedManager].activityPeripheral;
    self.connectedPeripheral = peripheral;
    self.connectedDeviceId = [peripheral.identifier UUIDString];
    self.isDisconnecting = NO;
    [self stopReconnectionTimer];

    // Save paired device
    [[NSUserDefaults standardUserDefaults] setObject:self.connectedDeviceId forKey:kV8PairedDeviceUUIDKey];
    [[NSUserDefaults standardUserDefaults] setObject:(peripheral.name ?: @"Focus Band") forKey:kV8PairedDeviceNameKey];
    [[NSUserDefaults standardUserDefaults] synchronize];
}

- (void)EnableCommunicate {
    [self debugLog:@"V8 EnableCommunicate — ready to send commands"];

    if (self.hasListeners) {
        [self sendEventWithName:@"V8ConnectionStateChanged" body:@{@"state": @"connected"}];
    }

    // Sync time on connect
    [self writeCommand:[self buildTimeSyncCommand]];

    // Resolve pending connect
    if (self.pendingConnectResolver) {
        self.pendingConnectResolver(@{
            @"success": @YES,
            @"message": @"V8 connected",
            @"deviceId": self.connectedDeviceId ?: @"",
            @"deviceName": self.connectedPeripheral.name ?: @"Focus Band"
        });
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }
}

- (void)Disconnect:(CBPeripheral *)peripheral error:(NSError *)error {
    [self debugLog:[NSString stringWithFormat:@"V8 disconnected: %@", error ?: @"clean"]];

    [self rejectPendingDataRequestWithCode:@"DISCONNECTED" message:@"V8 device disconnected"];
    [self clearAccumulatedDataBuffers];

    if (self.pendingConnectResolver) {
        self.pendingConnectRejecter(@"CONNECT_FAILED", @"V8 device disconnected during connect", error);
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }

    if (self.hasListeners) {
        [self sendEventWithName:@"V8ConnectionStateChanged" body:@{@"state": @"disconnected"}];
    }

    if (!self.isDisconnecting && self.connectedPeripheral) {
        [self startReconnectionTimer:self.connectedPeripheral];
    }

    self.connectedPeripheral = nil;
    self.connectedDeviceId = nil;
}

- (void)ConnectFailedWithError:(CBPeripheral *)peripheral error:(NSError *)error {
    [self debugLog:[NSString stringWithFormat:@"V8 connect failed: %@", error]];

    if (self.pendingConnectRejecter) {
        self.pendingConnectRejecter(@"CONNECT_FAILED", error.localizedDescription ?: @"V8 connect failed", error);
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }
}

#pragma mark - Data Parsing

- (void)BleCommunicateWithPeripheral:(CBPeripheral *)peripheral data:(NSData *)data {
    DeviceData_V8 *deviceData = [[BleSDK_V8 sharedManager] DataParsingWithData:data];
    if (!deviceData) return;

    DATATYPE_V8 dataType = deviceData.dataType;
    NSDictionary *dicData = deviceData.dicData;
    BOOL dataEnd = deviceData.dataEnd;

    switch (dataType) {

        case GetDeviceBattery_V8: {
            NSNumber *battery = dicData[@"batteryLevel"];
            NSDictionary *result = @{
                @"batteryLevel": battery ?: @0,
                @"isCharging": @NO
            };
            if (self.hasListeners) {
                [self sendEventWithName:@"V8BatteryData" body:result];
            }
            if (self.pendingDataResolver && self.pendingDataType == GetDeviceBattery_V8) {
                self.pendingDataResolver(result);
                [self clearPendingDataRequest];
            }
            break;
        }

        case GetDeviceVersion_V8: {
            NSString *version = dicData[@"deviceVersion"] ?: @"unknown";
            if (self.pendingDataResolver && self.pendingDataType == GetDeviceVersion_V8) {
                self.pendingDataResolver(@{@"deviceVersion": version});
                [self clearPendingDataRequest];
            }
            break;
        }

        case SetDeviceTime_V8: {
            [self debugLog:@"V8 time synced"];
            if (self.pendingDataResolver && self.pendingDataType == SetDeviceTime_V8) {
                self.pendingDataResolver(@{@"success": @YES});
                [self clearPendingDataRequest];
            }
            break;
        }

        case GetDeviceGoal_V8: {
            if (self.pendingDataResolver && self.pendingDataType == GetDeviceGoal_V8) {
                self.pendingDataResolver(@{@"goal": dicData[@"stepGoal"] ?: @8000});
                [self clearPendingDataRequest];
            }
            break;
        }

        case TotalActivityData_V8: {
            NSArray *items = dicData[@"arrayTotalActivityData"];
            if (items) [self.accumulatedStepsData addObjectsFromArray:items];

            if (dataEnd || items.count < 50) {
                if (self.pendingDataResolver && self.pendingDataType == TotalActivityData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedStepsData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedStepsData removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetTotalActivityDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
            }
            break;
        }

        case DetailSleepData_V8: {
            NSArray *items = dicData[@"arrayDetailSleepData"];
            if (items) [self.accumulatedSleepData addObjectsFromArray:items];

            if (dataEnd || items.count < 50) {
                if (self.pendingDataResolver && self.pendingDataType == DetailSleepData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedSleepData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedSleepData removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetDetailSleepDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
            }
            break;
        }

        case DynamicHR_V8: {
            NSArray *items = dicData[@"arrayContinuousHR"];
            NSLog(@"[V8HR] packet — dataEnd=%d itemsInPacket=%lu accumulated=%lu", dataEnd, (unsigned long)items.count, (unsigned long)self.accumulatedHRData.count);
            if (items) [self.accumulatedHRData addObjectsFromArray:items];

            if (dataEnd) {
                [self invalidateSleepActivityIdleTimer];
                NSLog(@"[V8HR] fetch complete (dataEnd=1) — total records=%lu", (unsigned long)self.accumulatedHRData.count);
                if (self.pendingDataResolver && self.pendingDataType == DynamicHR_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedHRData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedHRData removeAllObjects];
                }
            } else if (self.accumulatedHRData.count % 50 == 0 && self.accumulatedHRData.count > 0) {
                [self invalidateSleepActivityIdleTimer];
                NSLog(@"[V8HR] page complete (%lu items) — requesting mode:2", (unsigned long)self.accumulatedHRData.count);
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetContinuousHRDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
                [self resetSleepActivityIdleTimer];
            } else {
                [self resetSleepActivityIdleTimer];
            }
            break;
        }

        case HRVData_V8: {
            NSArray *items = dicData[@"arrayHrvData"];
            NSLog(@"[V8HRV] packet — dataEnd=%d itemsInPacket=%lu accumulated=%lu", dataEnd, (unsigned long)items.count, (unsigned long)self.accumulatedHRVData.count);
            if (items) [self.accumulatedHRVData addObjectsFromArray:items];

            if (dataEnd) {
                [self invalidateSleepActivityIdleTimer];
                NSLog(@"[V8HRV] fetch complete (dataEnd=1) — total records=%lu", (unsigned long)self.accumulatedHRVData.count);
                if (self.pendingDataResolver && self.pendingDataType == HRVData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedHRVData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedHRVData removeAllObjects];
                }
            } else if (self.accumulatedHRVData.count % 50 == 0 && self.accumulatedHRVData.count > 0) {
                [self invalidateSleepActivityIdleTimer];
                NSLog(@"[V8HRV] page complete (%lu items) — requesting mode:2", (unsigned long)self.accumulatedHRVData.count);
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetHRVDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
                [self resetSleepActivityIdleTimer];
            } else {
                [self resetSleepActivityIdleTimer];
            }
            break;
        }

        case AutomaticSpo2Data_V8: {
            NSArray *items = dicData[@"arrayAutomaticSpo2Data"];
            if (items) [self.accumulatedSpO2Data addObjectsFromArray:items];

            if (dataEnd || items.count < 50) {
                if (self.pendingDataResolver && self.pendingDataType == AutomaticSpo2Data_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedSpO2Data copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedSpO2Data removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetAutomaticSpo2DataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
            }
            break;
        }

        case TemperatureData_V8: {
            // Note: SDK uses typo key "arrayemperatureData"
            NSArray *items = dicData[@"arrayemperatureData"] ?: dicData[@"arrayTemperatureData"];
            if (items) [self.accumulatedTempData addObjectsFromArray:items];

            if (dataEnd || (items && items.count < 50)) {
                if (self.pendingDataResolver && self.pendingDataType == TemperatureData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedTempData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedTempData removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetTemperatureDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
            }
            break;
        }

        case ActivityModeData_V8: {
            NSArray *items = dicData[@"arrayActivityModeData"];
            if (items) [self.accumulatedActivityModeData addObjectsFromArray:items];

            if (dataEnd || items.count < 50) {
                if (self.pendingDataResolver && self.pendingDataType == ActivityModeData_V8) {
                    self.pendingDataResolver(@{
                        @"data": [self.accumulatedActivityModeData copy],
                        @"activityMode": dicData[@"activityMode"] ?: @(-1)
                    });
                    [self clearPendingDataRequest];
                    [self.accumulatedActivityModeData removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetActivityModeDataWithMode:2 withStartDate:nil needMETS:NO];
                [self writeCommand:cmd];
            }
            break;
        }

        case DeviceMeasurement_HR_V8: {
            if (self.hasListeners) {
                [self sendEventWithName:@"V8MeasurementResult" body:@{
                    @"type": @"heartRate",
                    @"heartRate": dicData[@"heartRate"] ?: @0
                }];
            }
            break;
        }

        case DeviceMeasurement_Spo2_V8: {
            if (self.hasListeners) {
                [self sendEventWithName:@"V8MeasurementResult" body:@{
                    @"type": @"spo2",
                    @"spo2": dicData[@"spo2"] ?: @0
                }];
            }
            break;
        }

        case DeviceMeasurement_HRV_V8: {
            if (self.hasListeners) {
                [self sendEventWithName:@"V8MeasurementResult" body:@{
                    @"type": @"hrv",
                    @"hrv": dicData[@"hrv"] ?: @0,
                    @"heartRate": dicData[@"heartRate"] ?: @0,
                    @"stress": dicData[@"stress"] ?: @0
                }];
            }
            break;
        }

        case RealTimeStep_V8: {
            if (self.hasListeners) {
                [self sendEventWithName:@"V8RealTimeData" body:@{
                    @"steps": dicData[@"step"] ?: @0,
                    @"heartRate": dicData[@"heartRate"] ?: @0,
                    @"calories": dicData[@"calories"] ?: @0,
                    @"distance": dicData[@"distance"] ?: @0
                }];
            }
            break;
        }

        case DetailSleepAndActivityData_V8: {
            NSArray *items = dicData[@"arrayDetailSleepAndActivityData"];
            if (items) [self.accumulatedSleepActivityData addObjectsFromArray:items];

            if (dataEnd) {
                // Ring signals end of transfer — resolve.
                [self invalidateSleepActivityIdleTimer];
                if (self.pendingDataResolver && self.pendingDataType == DetailSleepAndActivityData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedSleepActivityData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedSleepActivityData removeAllObjects];
                }
            } else if (self.accumulatedSleepActivityData.count % 50 == 0) {
                // Full page received (50 items) — request next page / signal completion.
                // Ring responds with more data or dataEnd=1. This is the correct SDK protocol
                // per the V8 demo: getSleepDetailsAndActivityWithMode:2 after every full page.
                [self invalidateSleepActivityIdleTimer];
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] getSleepDetailsAndActivityWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
                // Safety idle timer: if ring goes silent after mode:2, resolve after 3s.
                [self resetSleepActivityIdleTimer];
            } else {
                // Partial page — still accumulating, reset idle timer as safety net.
                [self resetSleepActivityIdleTimer];
            }
            break;
        }

        case ppiData_V8: {
            NSArray *items = dicData[@"arrayPPIData"];
            if (items) [self.accumulatedPPIData addObjectsFromArray:items];

            if (dataEnd || items.count < 50) {
                if (self.pendingDataResolver && self.pendingDataType == ppiData_V8) {
                    self.pendingDataResolver(@{@"data": [self.accumulatedPPIData copy]});
                    [self clearPendingDataRequest];
                    [self.accumulatedPPIData removeAllObjects];
                }
            } else {
                NSMutableData *cmd = [[BleSDK_V8 sharedManager] GetPPIDataWithMode:2 withStartDate:nil];
                [self writeCommand:cmd];
            }
            break;
        }

        case DataError_V8: {
            [self debugLog:@"V8 DataError received"];
            [self rejectPendingDataRequestWithCode:@"DATA_ERROR" message:@"V8 data parse error"];
            [self clearAccumulatedDataBuffers];
            break;
        }

        default:
            [self debugLog:[NSString stringWithFormat:@"V8 unhandled data type: %d", (int)dataType]];
            break;
    }
}

@end
