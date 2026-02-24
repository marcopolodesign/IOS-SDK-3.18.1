//
//  JstyleBridge.m
//  SmartRing
//
//  Native bridge for Jstyle BleSDK_X3 (Focus X3)
//

#import "JstyleBridge.h"
#import "NewBle.h"
#import "BleSDK_X3.h"
#import "BleSDK_Header_X3.h"
#import "DeviceData_X3.h"
#import <React/RCTLog.h>
#import <CoreBluetooth/CoreBluetooth.h>

static NSString *const kJstyleServiceUUID = @"FFF0";
static NSString *const kJstyleWriteCharUUID = @"FFF6";
static NSString *const kJstyleNotifyCharUUID = @"FFF7";
static NSString *const kPairedDeviceUUIDKey = @"JstylePairedDeviceUUID";
static NSString *const kPairedDeviceNameKey = @"JstylePairedDeviceName";

@interface JstyleBridge () <MyBleDelegate>

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
@property (nonatomic, copy) RCTPromiseResolveBlock pendingDataResolver;
@property (nonatomic, copy) RCTPromiseRejectBlock pendingDataRejecter;
@property (nonatomic, assign) DATATYPE_X3 pendingDataType;
@property (nonatomic, strong) NSTimer *pendingDataWatchdogTimer;
@property (nonatomic, assign) NSTimeInterval pendingDataTimeoutInterval;

// Connection stability improvements
@property (nonatomic, assign) BOOL isDisconnecting;  // Track intentional disconnect
@property (nonatomic, strong) NSTimer *reconnectionTimer;
@property (nonatomic, assign) NSInteger reconnectionAttempts;
@property (nonatomic, assign) NSTimeInterval reconnectionInterval;

@end

@implementation JstyleBridge

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
        _pendingDataType = DataError_X3;
        _pendingDataTimeoutInterval = 20.0;

        // Connection stability
        _isDisconnecting = NO;
        _reconnectionAttempts = 0;
        _reconnectionInterval = 6.0;  // Match demo app: 6 seconds

        // Set delegate for BLE manager
        [[NewBle sharedManager] setDelegate:self];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"onDeviceFound",
        @"onConnectionStateChanged",
        @"onBluetoothStateChanged",
        @"onRealTimeData",
        @"onMeasurementResult",
        @"onError",
        @"onDebugLog"
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
    RCTLogInfo(@"JstyleBridge: %@", message);
    if (self.hasListeners) {
        [self sendEventWithName:@"onDebugLog" body:@{
            @"message": message,
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        }];
    }
}

- (void)sendError:(NSString *)code message:(NSString *)message {
    if (self.hasListeners) {
        [self sendEventWithName:@"onError" body:@{
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

    NSString *message = [NSString stringWithFormat:@"%@ rejected: bridge is busy with pending data type %d",
                         operation, (int)self.pendingDataType];
    [self debugLog:message];
    if (reject) {
        reject(@"BUSY", message, nil);
    }
    return YES;
}

- (void)setPendingDataRequestWithResolver:(RCTPromiseResolveBlock)resolve
                                 rejecter:(RCTPromiseRejectBlock)reject
                                     type:(DATATYPE_X3)type {
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
    self.pendingDataResolver = nil;
    self.pendingDataRejecter = nil;
    self.pendingDataType = DataError_X3;
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
    if (!self.pendingDataResolver) {
        return;
    }
    NSString *message = [NSString stringWithFormat:@"Pending data request timed out in native bridge (data type %d)",
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

- (void)clearAccumulatedDataBuffers {
    [self.accumulatedStepsData removeAllObjects];
    [self.accumulatedSleepData removeAllObjects];
    [self.accumulatedHRData removeAllObjects];
    [self.accumulatedSpO2Data removeAllObjects];
    [self.accumulatedTempData removeAllObjects];
    [self.accumulatedHRVData removeAllObjects];
}

#pragma mark - Initialize SDK

RCT_EXPORT_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Initializing Jstyle SDK"];

    // Initialize BLE manager
    [[NewBle sharedManager] setDelegate:self];

    resolve(@{@"success": @YES});
}

#pragma mark - Scanning

RCT_EXPORT_METHOD(startScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Starting BLE scan for X3 devices"];

    [self.discoveredDevices removeAllObjects];

    // Start scanning for FFF0 service
    CBUUID *serviceUUID = [CBUUID UUIDWithString:kJstyleServiceUUID];
    [[NewBle sharedManager] startScanningWithServices:@[serviceUUID]];

    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Stopping BLE scan"];

    [[NewBle sharedManager] Stopscan];

    resolve(@{@"success": @YES});
}

#pragma mark - Connection

RCT_EXPORT_METHOD(connectToDevice:(NSString *)deviceId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"Connecting to device: %@", deviceId]];

    // Find the peripheral in discovered devices first
    CBPeripheral *peripheral = nil;
    for (NSDictionary *device in self.discoveredDevices) {
        if ([device[@"id"] isEqualToString:deviceId]) {
            peripheral = device[@"peripheral"];
            break;
        }
    }

    // Fallback: retrieve peripheral by UUID if not in discovered list
    // (e.g., device was discovered by QCBand scanner instead of Jstyle scanner)
    if (!peripheral) {
        [self debugLog:@"Device not in discovered list, trying retrievePeripheralsWithIdentifiers"];
        NSUUID *uuid = [[NSUUID alloc] initWithUUIDString:deviceId];
        if (uuid) {
            NSArray *peripherals = [[NewBle sharedManager].CentralManage retrievePeripheralsWithIdentifiers:@[uuid]];
            if (peripherals.count > 0) {
                peripheral = peripherals[0];
                [self debugLog:[NSString stringWithFormat:@"Retrieved peripheral via UUID: %@", peripheral.name]];
            }
        }
    }

    if (!peripheral) {
        reject(@"DEVICE_NOT_FOUND", @"Device not found in discovered devices or by UUID", nil);
        return;
    }

    self.pendingConnectResolver = resolve;
    self.pendingConnectRejecter = reject;

    [[NewBle sharedManager] connectDevice:peripheral];
}

RCT_EXPORT_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Disconnecting from device (intentional)"];

    // Mark as intentional disconnect to prevent auto-reconnect
    self.isDisconnecting = YES;
    [self stopReconnectionTimer];
    [self rejectPendingDataRequestWithCode:@"DISCONNECTED"
                                   message:@"Disconnected before pending data request completed"];
    [self clearAccumulatedDataBuffers];

    if (self.connectedPeripheral) {
        [[NewBle sharedManager] Disconnect];
        self.connectedPeripheral = nil;
        self.connectedDeviceId = nil;

        // Clear paired device
        [[NSUserDefaults standardUserDefaults] removeObjectForKey:kPairedDeviceUUIDKey];
        [[NSUserDefaults standardUserDefaults] removeObjectForKey:kPairedDeviceNameKey];
        [[NSUserDefaults standardUserDefaults] synchronize];
    }

    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(getConnectedDevices:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSMutableArray *devices = [NSMutableArray array];

    if (self.connectedPeripheral && self.connectedDeviceId) {
        [devices addObject:@{
            @"id": self.connectedDeviceId,
            @"name": self.connectedPeripheral.name ?: @"Unknown",
            @"sdkType": @"jstyle"
        }];
    }

    resolve(devices);
}

RCT_EXPORT_METHOD(cancelPendingDataRequest:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    (void)reject;
    if (self.pendingDataResolver) {
        [self debugLog:[NSString stringWithFormat:@"Cancelling pending data request (type %d)", (int)self.pendingDataType]];
        [self rejectPendingDataRequestWithCode:@"CANCELLED"
                                       message:@"Pending data request cancelled by JS timeout recovery"];
    } else {
        [self clearPendingDataRequest];
    }

    [self clearAccumulatedDataBuffers];
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(autoReconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Attempting auto-reconnect"];

    NSString *pairedUUID = [[NSUserDefaults standardUserDefaults] stringForKey:kPairedDeviceUUIDKey];

    if (!pairedUUID) {
        resolve(@{@"success": @NO, @"message": @"No paired device found"});
        return;
    }

    // Try to retrieve the peripheral by saved UUID first
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

    // Fallback: try retrieveConnectedPeripherals (already connected by system)
    CBUUID *serviceUUID = [CBUUID UUIDWithString:kJstyleServiceUUID];
    NSArray *peripherals = [[NewBle sharedManager] retrieveConnectedPeripheralsWithServices:@[serviceUUID]];

    if (peripherals.count > 0) {
        CBPeripheral *peripheral = peripherals[0];
        self.pendingConnectResolver = resolve;
        self.pendingConnectRejecter = reject;
        [[NewBle sharedManager] connectDevice:peripheral];
    } else {
        resolve(@{@"success": @NO, @"message": @"Paired device not found nearby"});
    }
}

#pragma mark - Device Info

RCT_EXPORT_METHOD(getBatteryLevel:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getBatteryLevel" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting battery level"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceBattery_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDeviceBatteryLevel];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getFirmwareVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getFirmwareVersion" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting firmware version"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceVersion_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDeviceVersion];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - User Settings

RCT_EXPORT_METHOD(setUserInfo:(NSDictionary *)userInfo
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    // Note: X3 uses opposite gender encoding from QCBand
    // X3: 0=female, 1=male (normalized in bridge)
    // QCBand: 0=male, 1=female
    int gender = [userInfo[@"gender"] intValue]; // Expect 0=male, 1=female from JS
    int normalizedGender = (gender == 0) ? 1 : 0; // Convert to X3 format

    MyPersonalInfo_X3 info;
    info.gender = normalizedGender;
    info.age = [userInfo[@"age"] intValue];
    info.height = [userInfo[@"height"] intValue];
    info.weight = [userInfo[@"weight"] intValue];
    info.stride = [userInfo[@"stride"] intValue] ?: 70; // Default stride

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] SetPersonalInfo:info];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];

    resolve(@{@"success": @YES});
}

#pragma mark - Data Retrieval

RCT_EXPORT_METHOD(getStepsData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getStepsData" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting steps data"];

    [self.accumulatedStepsData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:TotalActivityData_X3];

    // Mode 0: Start reading from latest position
    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetTotalActivityDataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getSleepData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getSleepData" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting sleep data"];

    [self.accumulatedSleepData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:DetailSleepData_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDetailSleepDataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getHeartRateData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getHeartRateData" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting heart rate data"];

    [self.accumulatedHRData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:DynamicHR_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetContinuousHRDataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getSpO2Data:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getSpO2Data" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting SpO2 data"];

    [self.accumulatedSpO2Data removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:AutomaticSpo2Data_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetAutomaticSpo2DataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getTemperatureData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getTemperatureData" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting temperature data"];

    [self.accumulatedTempData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:TemperatureData_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetTemperatureDataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getHRVData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getHRVData" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting HRV data"];

    [self.accumulatedHRVData removeAllObjects];
    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:HRVData_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetHRVDataWithMode:0 withStartDate:nil];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - Time Sync

RCT_EXPORT_METHOD(syncTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"syncTime" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Syncing time to device"];

    NSDate *now = [NSDate date];
    NSCalendar *cal = [NSCalendar currentCalendar];
    NSDateComponents *comp = [cal components:(NSCalendarUnitYear | NSCalendarUnitMonth | NSCalendarUnitDay |
                                              NSCalendarUnitHour | NSCalendarUnitMinute | NSCalendarUnitSecond)
                                    fromDate:now];

    MyDeviceTime_X3 deviceTime;
    deviceTime.year   = (int)[comp year];
    deviceTime.month  = (int)[comp month];
    deviceTime.day    = (int)[comp day];
    deviceTime.hour   = (int)[comp hour];
    deviceTime.minute = (int)[comp minute];
    deviceTime.second = (int)[comp second];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:SetDeviceTime_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] SetDeviceTime:deviceTime];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(getDeviceTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getDeviceTime" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting device time"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceTime_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDeviceTime];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - Step Goal

RCT_EXPORT_METHOD(getStepGoal:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getStepGoal" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting step goal"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceGoal_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetStepGoal];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

RCT_EXPORT_METHOD(setStepGoal:(int)goal
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"setStepGoal" rejecter:reject]) {
        return;
    }

    [self debugLog:[NSString stringWithFormat:@"Setting step goal: %d", goal]];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:SetDeviceGoal_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] SetStepGoal:goal];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - MAC Address

RCT_EXPORT_METHOD(getMacAddress:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"getMacAddress" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Getting MAC address"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:GetDeviceMacAddress_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDeviceMacAddress];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - Factory Reset

RCT_EXPORT_METHOD(factoryReset:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    if ([self rejectIfBusyForOperation:@"factoryReset" rejecter:reject]) {
        return;
    }

    [self debugLog:@"Factory resetting device"];

    [self setPendingDataRequestWithResolver:resolve rejecter:reject type:FactoryReset_X3];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] Reset];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];
}

#pragma mark - Real-Time Data

RCT_EXPORT_METHOD(startRealTimeData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    [self debugLog:@"Starting real-time data"];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] RealTimeDataWithType:1];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];

    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopRealTimeData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    [self debugLog:@"Stopping real-time data"];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] RealTimeDataWithType:0];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];

    resolve(@{@"success": @YES});
}

#pragma mark - Manual Measurements

RCT_EXPORT_METHOD(startHeartRateMeasurement:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    [self debugLog:@"Starting manual HR measurement (enable real-time first, then manual command)"];

    // Demo parity: manual HR results are surfaced via RealTimeStep heartRate while real-time mode is on.
    NSMutableData *rtCmd = [[BleSDK_X3 sharedManager] RealTimeDataWithType:1];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:rtCmd];

    // Give the device a short settle window before starting manual measurement.
    __weak typeof(self) weakSelf = self;
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.35 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
        __strong typeof(weakSelf) strongSelf = weakSelf;
        if (!strongSelf || !strongSelf.connectedPeripheral) {
            reject(@"NOT_CONNECTED", @"Device disconnected before measurement command", nil);
            return;
        }

        NSMutableData *cmd = [[BleSDK_X3 sharedManager] manualMeasurementWithDataType:heartRateData_X3
                                                                       measurementTime:30
                                                                                  open:YES];
        [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                          characteristicUUID:kJstyleWriteCharUUID
                                           p:strongSelf.connectedPeripheral
                                        data:cmd];

        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(startSpO2Measurement:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    [self debugLog:@"Starting manual SpO2 measurement"];

    NSMutableData *cmd = [[BleSDK_X3 sharedManager] manualMeasurementWithDataType:spo2Data_X3
                                                                   measurementTime:30
                                                                              open:YES];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd];

    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopMeasurement:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (!self.connectedPeripheral) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }

    [self debugLog:@"Stopping manual measurement"];

    // Stop both HR and SpO2
    NSMutableData *cmd1 = [[BleSDK_X3 sharedManager] manualMeasurementWithDataType:heartRateData_X3
                                                                    measurementTime:0
                                                                               open:NO];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd1];

    NSMutableData *cmd2 = [[BleSDK_X3 sharedManager] manualMeasurementWithDataType:spo2Data_X3
                                                                    measurementTime:0
                                                                               open:NO];
    [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                      characteristicUUID:kJstyleWriteCharUUID
                                       p:self.connectedPeripheral
                                    data:cmd2];

    resolve(@{@"success": @YES});
}

#pragma mark - MyBleDelegate Methods

- (void)scanWithPeripheral:(CBPeripheral *)peripheral
          advertisementData:(NSDictionary *)advertisementData
                       RSSI:(NSNumber *)RSSI {
    NSString *deviceId = peripheral.identifier.UUIDString;
    NSString *deviceName = peripheral.name ?: @"Unknown";

    // Check if already discovered
    BOOL alreadyFound = NO;
    for (NSDictionary *device in self.discoveredDevices) {
        if ([device[@"id"] isEqualToString:deviceId]) {
            alreadyFound = YES;
            break;
        }
    }

    if (!alreadyFound) {
        NSDictionary *deviceInfo = @{
            @"id": deviceId,
            @"name": deviceName,
            @"rssi": RSSI,
            @"peripheral": peripheral,
            @"sdkType": @"jstyle"
        };

        [self.discoveredDevices addObject:deviceInfo];

        if (self.hasListeners) {
            [self sendEventWithName:@"onDeviceFound" body:@{
                @"id": deviceId,
                @"name": deviceName,
                @"mac": deviceId,
                @"rssi": RSSI,
                @"sdkType": @"jstyle"
            }];
        }

        [self debugLog:[NSString stringWithFormat:@"Discovered X3 device: %@", deviceName]];
    }
}

- (void)ConnectSuccessfully {
    CBPeripheral *peripheral = [NewBle sharedManager].activityPeripheral;
    [self debugLog:[NSString stringWithFormat:@"Connected to: %@", peripheral.name]];

    self.connectedPeripheral = peripheral;
    self.connectedDeviceId = peripheral.identifier.UUIDString;

    // Stop reconnection timer on successful connection
    [self stopReconnectionTimer];
    self.reconnectionAttempts = 0;
    [self clearAccumulatedDataBuffers];
    if (self.pendingDataResolver) {
        [self rejectPendingDataRequestWithCode:@"CONNECTION_RESET"
                                       message:@"Connection reset before pending data request completed"];
    }

    // Save paired device
    [[NSUserDefaults standardUserDefaults] setObject:peripheral.identifier.UUIDString
                                              forKey:kPairedDeviceUUIDKey];
    [[NSUserDefaults standardUserDefaults] setObject:peripheral.name
                                              forKey:kPairedDeviceNameKey];
    [[NSUserDefaults standardUserDefaults] synchronize];

    if (self.hasListeners) {
        [self sendEventWithName:@"onConnectionStateChanged" body:@{
            @"state": @"connected",
            @"deviceId": self.connectedDeviceId,
            @"deviceName": peripheral.name ?: @"Unknown"
        }];
    }

    if (self.pendingConnectResolver) {
        self.pendingConnectResolver(@{
            @"success": @YES,
            @"deviceId": self.connectedDeviceId,
            @"deviceName": peripheral.name ?: @"Unknown"
        });
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }
}

- (void)Disconnect:(NSError *)error {
    CBPeripheral *peripheral = self.connectedPeripheral;
    [self debugLog:[NSString stringWithFormat:@"Disconnected from: %@ (error: %@)",
                    peripheral.name ?: @"Unknown", error ? @"YES" : @"NO"]];

    // Keep peripheral reference for potential reconnection
    CBPeripheral *disconnectedPeripheral = self.connectedPeripheral;

    self.connectedPeripheral = nil;
    self.connectedDeviceId = nil;
    [self rejectPendingDataRequestWithCode:@"DISCONNECTED"
                                   message:@"Connection dropped before pending data request completed"];
    [self clearAccumulatedDataBuffers];

    if (self.hasListeners) {
        [self sendEventWithName:@"onConnectionStateChanged" body:@{
            @"state": @"disconnected",
            @"error": error ? error.localizedDescription : [NSNull null]
        }];
    }

    // Automatic reconnection if NOT intentional disconnect
    if (!self.isDisconnecting && error && disconnectedPeripheral) {
        [self debugLog:@"Unexpected disconnect - starting auto-reconnection"];
        [self startReconnectionTimer:disconnectedPeripheral];
    } else if (self.isDisconnecting) {
        [self debugLog:@"Intentional disconnect - no auto-reconnect"];
        self.isDisconnecting = NO;  // Reset flag
    }

    if (self.pendingConnectRejecter && error) {
        self.pendingConnectRejecter(@"CONNECTION_FAILED", error.localizedDescription, error);
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }
}

- (void)ConnectFailedWithError:(NSError *)error {
    [self debugLog:[NSString stringWithFormat:@"Failed to connect: %@", error.localizedDescription]];

    if (self.pendingDataResolver) {
        [self rejectPendingDataRequestWithCode:@"CONNECTION_FAILED"
                                       message:@"Connection failed before pending data request completed"];
        [self clearAccumulatedDataBuffers];
    }

    if (self.pendingConnectRejecter) {
        self.pendingConnectRejecter(@"CONNECTION_FAILED", error.localizedDescription, error);
        self.pendingConnectResolver = nil;
        self.pendingConnectRejecter = nil;
    }
}

- (void)BleCommunicateWithPeripheral:(CBPeripheral *)Peripheral data:(NSData *)data {
    // Parse response using BleSDK_X3
    DeviceData_X3 *parsed = [[BleSDK_X3 sharedManager] DataParsingWithData:data];

    if (!parsed) {
        [self debugLog:@"Failed to parse data"];
        return;
    }

    [self debugLog:[NSString stringWithFormat:@"Received data type: %d, dataEnd: %d",
                    (int)parsed.dataType, parsed.dataEnd]];

    [self handleParsedData:parsed];
}

#pragma mark - Data Parsing

- (void)handleParsedData:(DeviceData_X3 *)parsed {
    switch (parsed.dataType) {
        case GetDeviceBattery_X3:
            [self handleBatteryData:parsed];
            break;

        case GetDeviceVersion_X3:
            [self handleVersionData:parsed];
            break;

        case TotalActivityData_X3:
            [self handleStepsData:parsed];
            break;

        case DetailSleepData_X3:
            [self handleSleepData:parsed];
            break;

        case DynamicHR_X3:
        case StaticHR_X3:
            [self handleHeartRateData:parsed];
            break;

        case AutomaticSpo2Data_X3:
            [self handleSpO2Data:parsed];
            break;

        case TemperatureData_X3:
            [self handleTemperatureData:parsed];
            break;

        case HRVData_X3:
            [self handleHRVData:parsed];
            break;

        case RealTimeStep_X3:
            [self handleRealTimeData:parsed];
            break;

        case DeviceMeasurement_HR_X3:
            [self handleManualHRResult:parsed];
            break;

        case DeviceMeasurement_Spo2_X3:
            [self handleManualSpO2Result:parsed];
            break;

        case DeviceMeasurement_X3:
            [self handleManualMeasurementResult:parsed];
            break;

        case SetDeviceTime_X3:
            [self handleSetTimeResponse:parsed];
            break;

        case GetDeviceTime_X3:
            [self handleGetTimeResponse:parsed];
            break;

        case GetDeviceGoal_X3:
            [self handleGetGoalResponse:parsed];
            break;

        case SetDeviceGoal_X3:
            [self handleSetGoalResponse:parsed];
            break;

        case GetDeviceMacAddress_X3:
            [self handleMacAddressResponse:parsed];
            break;

        case FactoryReset_X3:
            [self handleFactoryResetResponse:parsed];
            break;

        case DataError_X3:
            [self handleDataError:parsed];
            break;

        default:
            [self debugLog:[NSString stringWithFormat:@"Unhandled data type: %d", (int)parsed.dataType]];
            break;
    }
}

- (void)handleDataError:(DeviceData_X3 *)parsed {
    NSString *rawMessage = parsed.dicData[@"msg"] ?: parsed.dicData[@"message"] ?: parsed.dicData[@"error"];
    NSString *message = rawMessage ?: [NSString stringWithFormat:@"SDK returned DataError (pending data type %d)",
                                       (int)self.pendingDataType];
    [self debugLog:[NSString stringWithFormat:@"DataError received: %@", message]];
    [self sendError:@"DATA_ERROR" message:message];

    if (self.pendingDataResolver) {
        [self rejectPendingDataRequestWithCode:@"DATA_ERROR" message:message];
        [self clearAccumulatedDataBuffers];
    }
}

- (void)handleBatteryData:(DeviceData_X3 *)parsed {
    NSNumber *battery = parsed.dicData[@"battery"] ?: parsed.dicData[@"batteryLevel"];

    if (self.pendingDataResolver && self.pendingDataType == GetDeviceBattery_X3) {
        self.pendingDataResolver(@{@"battery": battery ?: @0});
        [self clearPendingDataRequest];
    }
}

- (void)handleVersionData:(DeviceData_X3 *)parsed {
    NSString *version = parsed.dicData[@"version"] ?: @"Unknown";

    if (self.pendingDataResolver && self.pendingDataType == GetDeviceVersion_X3) {
        self.pendingDataResolver(@{@"version": version});
        [self clearPendingDataRequest];
    }
}

- (void)handleStepsData:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        [self.accumulatedStepsData addObject:parsed.dicData];
    }

    if (parsed.dataEnd) {
        // All data received - normalize and return
        NSMutableArray *normalizedData = [NSMutableArray array];

        for (NSDictionary *record in self.accumulatedStepsData) {
            NSMutableDictionary *normalized = [record mutableCopy];

            // Convert distance from km to meters
            if (record[@"distance"]) {
                double distanceKm = [record[@"distance"] doubleValue];
                normalized[@"distance"] = @(distanceKm * 1000);
            }

            [normalizedData addObject:normalized];
        }

        if (self.pendingDataResolver && self.pendingDataType == TotalActivityData_X3) {
            self.pendingDataResolver(@{@"data": normalizedData});
            [self clearPendingDataRequest];
        }

        [self.accumulatedStepsData removeAllObjects];
    } else {
        // Only continue pagination if a pending request is still waiting for data
        if (self.pendingDataResolver && self.pendingDataType == TotalActivityData_X3) {
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetTotalActivityDataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"Steps pagination stopped - no pending request"];
            [self.accumulatedStepsData removeAllObjects];
        }
    }
}

- (void)handleSleepData:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        // Extract the arrayDetailSleepData from dicData (matches demo implementation)
        NSArray *arrayDetailSleepData = parsed.dicData[@"arrayDetailSleepData"];
        if (arrayDetailSleepData && arrayDetailSleepData.count > 0) {
            [self.accumulatedSleepData addObjectsFromArray:arrayDetailSleepData];
        }
    }

    if (parsed.dataEnd) {
        if (self.pendingDataResolver && self.pendingDataType == DetailSleepData_X3) {
            [self debugLog:[NSString stringWithFormat:@"Sleep data complete: %lu records", (unsigned long)self.accumulatedSleepData.count]];
            // Pass a copy of the array, not the mutable array that gets cleared
            NSArray *sleepDataCopy = [self.accumulatedSleepData copy];
            self.pendingDataResolver(@{@"data": sleepDataCopy});
            [self clearPendingDataRequest];
        }

        [self.accumulatedSleepData removeAllObjects];
    } else {
        // Only continue pagination if a pending request is still waiting for data
        if (self.pendingDataResolver && self.pendingDataType == DetailSleepData_X3) {
            [self debugLog:@"Requesting next page of sleep data"];
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetDetailSleepDataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"Sleep pagination stopped - no pending request"];
            [self.accumulatedSleepData removeAllObjects];
        }
    }
}

- (void)handleHeartRateData:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        [self.accumulatedHRData addObject:parsed.dicData];
    }

    if (parsed.dataEnd) {
        if (self.pendingDataResolver && self.pendingDataType == DynamicHR_X3) {
            NSArray *hrDataCopy = [self.accumulatedHRData copy];
            self.pendingDataResolver(@{@"data": hrDataCopy});
            [self clearPendingDataRequest];
        }

        [self.accumulatedHRData removeAllObjects];
    } else {
        if (self.pendingDataResolver && self.pendingDataType == DynamicHR_X3) {
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetContinuousHRDataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"HR pagination stopped - no pending request"];
            [self.accumulatedHRData removeAllObjects];
        }
    }
}

- (void)handleSpO2Data:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        [self.accumulatedSpO2Data addObject:parsed.dicData];
    }

    if (parsed.dataEnd) {
        if (self.pendingDataResolver && self.pendingDataType == AutomaticSpo2Data_X3) {
            NSArray *spo2DataCopy = [self.accumulatedSpO2Data copy];
            self.pendingDataResolver(@{@"data": spo2DataCopy});
            [self clearPendingDataRequest];
        }

        [self.accumulatedSpO2Data removeAllObjects];
    } else {
        if (self.pendingDataResolver && self.pendingDataType == AutomaticSpo2Data_X3) {
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetAutomaticSpo2DataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"SpO2 pagination stopped - no pending request"];
            [self.accumulatedSpO2Data removeAllObjects];
        }
    }
}

- (void)handleTemperatureData:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        [self.accumulatedTempData addObject:parsed.dicData];
    }

    if (parsed.dataEnd) {
        if (self.pendingDataResolver && self.pendingDataType == TemperatureData_X3) {
            NSArray *tempDataCopy = [self.accumulatedTempData copy];
            self.pendingDataResolver(@{@"data": tempDataCopy});
            [self clearPendingDataRequest];
        }

        [self.accumulatedTempData removeAllObjects];
    } else {
        if (self.pendingDataResolver && self.pendingDataType == TemperatureData_X3) {
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetTemperatureDataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"Temperature pagination stopped - no pending request"];
            [self.accumulatedTempData removeAllObjects];
        }
    }
}

- (void)handleHRVData:(DeviceData_X3 *)parsed {
    if (parsed.dicData) {
        [self.accumulatedHRVData addObject:parsed.dicData];
    }

    if (parsed.dataEnd) {
        if (self.pendingDataResolver && self.pendingDataType == HRVData_X3) {
            NSArray *hrvDataCopy = [self.accumulatedHRVData copy];
            self.pendingDataResolver(@{@"data": hrvDataCopy});
            [self clearPendingDataRequest];
        }

        [self.accumulatedHRVData removeAllObjects];
    } else {
        if (self.pendingDataResolver && self.pendingDataType == HRVData_X3) {
            NSMutableData *cmd = [[BleSDK_X3 sharedManager] GetHRVDataWithMode:2 withStartDate:nil];
            [[NewBle sharedManager] writeValue:kJstyleServiceUUID
                              characteristicUUID:kJstyleWriteCharUUID
                                               p:self.connectedPeripheral
                                            data:cmd];
        } else {
            [self debugLog:@"HRV pagination stopped - no pending request"];
            [self.accumulatedHRVData removeAllObjects];
        }
    }
}

- (void)handleRealTimeData:(DeviceData_X3 *)parsed {
    if (self.hasListeners && parsed.dicData) {
        [self sendEventWithName:@"onRealTimeData" body:parsed.dicData];
    }
}

- (void)handleManualHRResult:(DeviceData_X3 *)parsed {
    if (self.hasListeners && parsed.dicData) {
        NSMutableDictionary *result = [parsed.dicData mutableCopy];
        result[@"type"] = @"heartRate";
        [self sendEventWithName:@"onMeasurementResult" body:result];
    }
}

- (void)handleManualSpO2Result:(DeviceData_X3 *)parsed {
    if (self.hasListeners && parsed.dicData) {
        NSMutableDictionary *result = [parsed.dicData mutableCopy];
        result[@"type"] = @"spo2";
        [self sendEventWithName:@"onMeasurementResult" body:result];
    }
}

- (void)handleManualMeasurementResult:(DeviceData_X3 *)parsed {
    if (!self.hasListeners) {
        return;
    }

    NSMutableDictionary *result = [NSMutableDictionary dictionary];
    if (parsed.dicData) {
        [result addEntriesFromDictionary:parsed.dicData];
    }

    NSNumber *measurementType = result[@"dataType"];
    if (!measurementType && parsed.dicData[@"measurementType"]) {
        measurementType = parsed.dicData[@"measurementType"];
    }
    if (measurementType) {
        result[@"measurementType"] = measurementType;
    }

    if (result[@"heartRate"] || result[@"singleHR"] || result[@"hr"]) {
        result[@"type"] = @"heartRate";
    } else if (result[@"spo2"] || result[@"automaticSpo2Data"]) {
        result[@"type"] = @"spo2";
    } else if (result[@"temperature"]) {
        result[@"type"] = @"temperature";
    } else if (measurementType) {
        NSInteger typeValue = [measurementType integerValue];
        if (typeValue == 1 || typeValue == 2) {
            result[@"type"] = @"heartRate";
        } else if (typeValue == 3) {
            result[@"type"] = @"spo2";
        } else if (typeValue == 4) {
            result[@"type"] = @"temperature";
        } else {
            result[@"type"] = @"measurement";
        }
    } else {
        result[@"type"] = @"measurement";
    }

    [self sendEventWithName:@"onMeasurementResult" body:result];
}

- (void)handleSetTimeResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == SetDeviceTime_X3) {
        self.pendingDataResolver(@{@"success": @YES});
        [self clearPendingDataRequest];
    }
}

- (void)handleGetTimeResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == GetDeviceTime_X3) {
        NSString *deviceTime = parsed.dicData[@"deviceTime"] ?: @"Unknown";
        self.pendingDataResolver(@{@"time": deviceTime});
        [self clearPendingDataRequest];
    }
}

- (void)handleGetGoalResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == GetDeviceGoal_X3) {
        NSNumber *stepGoal = parsed.dicData[@"stepGoal"] ?: @0;
        self.pendingDataResolver(@{@"goal": stepGoal});
        [self clearPendingDataRequest];
    }
}

- (void)handleSetGoalResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == SetDeviceGoal_X3) {
        self.pendingDataResolver(@{@"success": @YES});
        [self clearPendingDataRequest];
    }
}

- (void)handleMacAddressResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == GetDeviceMacAddress_X3) {
        NSString *macAddress = parsed.dicData[@"macAddress"] ?: @"N/A";
        self.pendingDataResolver(@{@"mac": macAddress});
        [self clearPendingDataRequest];
    }
}

- (void)handleFactoryResetResponse:(DeviceData_X3 *)parsed {
    if (self.pendingDataResolver && self.pendingDataType == FactoryReset_X3) {
        self.pendingDataResolver(@{@"success": @YES});
        [self clearPendingDataRequest];
    }
}

#pragma mark - Connection Stability Helpers

- (void)startReconnectionTimer:(CBPeripheral *)peripheral {
    if (!peripheral) {
        [self debugLog:@"Cannot start reconnection timer - no peripheral"];
        return;
    }

    [self stopReconnectionTimer];

    [self debugLog:[NSString stringWithFormat:@"Starting reconnection timer (attempt %ld)", (long)self.reconnectionAttempts + 1]];

    // Store peripheral for reconnection attempts
    __weak typeof(self) weakSelf = self;
    __weak CBPeripheral *weakPeripheral = peripheral;

    self.reconnectionTimer = [NSTimer scheduledTimerWithTimeInterval:self.reconnectionInterval
                                                              target:weakSelf
                                                            selector:@selector(attemptReconnectionWithTimer:)
                                                            userInfo:weakPeripheral
                                                             repeats:YES];
}

- (void)stopReconnectionTimer {
    if (self.reconnectionTimer) {
        [self debugLog:@"Stopping reconnection timer"];
        [self.reconnectionTimer invalidate];
        self.reconnectionTimer = nil;
    }
}

- (void)attemptReconnectionWithTimer:(NSTimer *)timer {
    CBPeripheral *peripheral = timer.userInfo;

    if (!peripheral) {
        [self debugLog:@"No peripheral to reconnect to - stopping timer"];
        [self stopReconnectionTimer];
        return;
    }

    self.reconnectionAttempts++;
    [self debugLog:[NSString stringWithFormat:@"Reconnection attempt %ld to %@",
                    (long)self.reconnectionAttempts, peripheral.name]];

    // Use NewBle's connectDevice which will trigger ConnectSuccessfully on success
    [[NewBle sharedManager] connectDevice:peripheral];

    // Optional: Stop after max attempts (e.g., 20 attempts = 2 minutes)
    if (self.reconnectionAttempts >= 20) {
        [self debugLog:@"Max reconnection attempts reached - stopping"];
        [self stopReconnectionTimer];
        self.reconnectionAttempts = 0;
    }
}

@end
