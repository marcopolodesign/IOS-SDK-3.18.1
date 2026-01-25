//
//  QCBandBridge.m
//  SmartRing
//
//  Native bridge for QCBandSDK - based on QCBandSDKDemo patterns
//

#import "QCBandBridge.h"
#import "QCCentralManager.h"
#import <React/RCTLog.h>
#import <QCBandSDK/QCSDKManager.h>
#import <QCBandSDK/QCSDKCmdCreator.h>
#import <QCBandSDK/QCSleepModel.h>
#import <QCBandSDK/QCSportModel.h>
#import <QCBandSDK/QCManualHeartRateModel.h>
#import <QCBandSDK/QCSchedualHeartRateModel.h>
#import <QCBandSDK/QCThreeValueTemperatureModel.h>
#import <QCBandSDK/QCBloodOxygenModel.h>
#import <QCBandSDK/QCBloodGlucoseModel.h>

static NSInteger const kQCHoldRealTimeHeartRateTimeout = 20;

@interface QCBandBridge () <QCCentralManagerDelegate>

@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, strong) NSTimer *realTimeHRTimer;
@property (nonatomic, strong) NSMutableArray<QCBlePeripheral *> *discoveredDevices;

// Pending connection promise - resolved when connection actually completes
@property (nonatomic, copy) RCTPromiseResolveBlock pendingConnectResolver;
@property (nonatomic, copy) RCTPromiseRejectBlock pendingConnectRejecter;
@property (nonatomic, strong) NSTimer *connectTimeoutTimer;
@property (nonatomic, strong) NSString *pendingConnectDeviceId;
@property (nonatomic, assign) BOOL autoReconnectResolved; // Flag to prevent double resolution

@end

@implementation QCBandBridge

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _discoveredDevices = [NSMutableArray array];
    }
    return self;
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[
        @"onDeviceFound",
        @"onDeviceDiscovered",
        @"onConnectionStateChanged",
        @"onBluetoothStateChanged",
        @"onHeartRateData",
        @"onHeartRateReceived",
        @"onStepsData",
        @"onStepsReceived",
        @"onCurrentStepInfo",
        @"onSleepData",
        @"onSleepDataReceived",
        @"onSpO2Data",
        @"onSpO2Received",
        @"onBatteryData",
        @"onBatteryReceived",
        @"onTemperatureData",
        @"onError",
        @"onDebugLog",
        @"onScanFinished"
    ];
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

// Helper to send debug logs
- (void)debugLog:(NSString *)message {
    RCTLogInfo(@"QCBandBridge: %@", message);
    if (self.hasListeners) {
        [self sendEventWithName:@"onDebugLog" body:@{
            @"message": message,
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        }];
    }
}

#pragma mark - Initialize SDK

RCT_EXPORT_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Initializing QCBandSDK"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Set up QCCentralManager delegate
        [QCCentralManager shared].delegate = self;
        
        // Enable SDK debug mode
        [QCSDKManager shareInstance].debug = YES;
        
        // Set up real-time callbacks
        [QCSDKManager shareInstance].realTimeHeartRate = ^(NSInteger hr) {
            [self debugLog:[NSString stringWithFormat:@"Real-time HR: %ld", (long)hr]];
            if (self.hasListeners) {
                [self sendEventWithName:@"onHeartRateData" body:@{
                    @"heartRate": @(hr),
                    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                    @"isRealTime": @YES
                }];
            }
        };
        
        [QCSDKManager shareInstance].currentBatteryInfo = ^(NSInteger battery, BOOL charging) {
            [self debugLog:[NSString stringWithFormat:@"Battery: %ld%%, charging: %d", (long)battery, charging]];
            if (self.hasListeners) {
                [self sendEventWithName:@"onBatteryData" body:@{
                    @"battery": @(battery),
                    @"level": @(battery),
                    @"isCharging": @(charging)
                }];
            }
        };
        
        [QCSDKManager shareInstance].currentStepInfo = ^(NSInteger step, NSInteger calorie, NSInteger distance) {
            [self debugLog:[NSString stringWithFormat:@"Steps: %ld, Cal: %ld, Dist: %ld", (long)step, (long)calorie, (long)distance]];
            if (self.hasListeners) {
                [self sendEventWithName:@"onStepsData" body:@{
                    @"steps": @(step),
                    @"calories": @(calorie),
                    @"distance": @(distance),
                    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
                }];
            }
        };
        
        [self debugLog:@"QCBandSDK initialized successfully"];
        resolve(@{@"success": @YES, @"message": @"SDK initialized"});
    });
}

#pragma mark - Bluetooth State

RCT_EXPORT_METHOD(getBluetoothState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    QCBluetoothState state = [QCCentralManager shared].bleState;
    NSString *stateString = [self bluetoothStateToString:state];
    resolve(@{@"state": stateString});
}

- (NSString *)bluetoothStateToString:(QCBluetoothState)state {
    switch (state) {
        case QCBluetoothStateUnkown:
            return @"unknown";
        case QCBluetoothStateResetting:
            return @"resetting";
        case QCBluetoothStateUnsupported:
            return @"unsupported";
        case QCBluetoothStateUnauthorized:
            return @"unauthorized";
        case QCBluetoothStatePoweredOff:
            return @"poweredOff";
        case QCBluetoothStatePoweredOn:
            return @"poweredOn";
        default:
            return @"unknown";
    }
}

- (NSString *)connectionStateToString:(QCState)state {
    switch (state) {
        case QCStateUnkown:
            return @"unknown";
        case QCStateUnbind:
            return @"unbind";
        case QCStateConnecting:
            return @"connecting";
        case QCStateConnected:
            return @"connected";
        case QCStateDisconnecting:
            return @"disconnecting";
        case QCStateDisconnected:
            return @"disconnected";
        default:
            return @"unknown";
    }
}

#pragma mark - Scanning

RCT_EXPORT_METHOD(scan:(double)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"Starting scan for %.0f seconds", duration]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.discoveredDevices removeAllObjects];
        [QCCentralManager shared].delegate = self;
        
        NSInteger timeout = duration > 0 ? (NSInteger)duration : 30;
        [[QCCentralManager shared] scanWithTimeout:timeout];
        
        // Return immediately, devices will be sent via events
        resolve(@{@"success": @YES, @"message": @"Scan started"});
    });
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Stopping scan"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[QCCentralManager shared] stopScan];
        resolve(@{@"success": @YES, @"message": @"Scan stopped"});
    });
}

RCT_EXPORT_METHOD(getDiscoveredDevices:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSMutableArray *devices = [NSMutableArray array];
    
    for (QCBlePeripheral *peripheral in self.discoveredDevices) {
        [devices addObject:@{
            @"id": peripheral.peripheral.identifier.UUIDString ?: @"",
            @"mac": peripheral.mac ?: @"",
            @"name": peripheral.peripheral.name ?: @"Unknown",
            @"rssi": peripheral.RSSI ?: @(-100),
            @"isPaired": @(peripheral.isPaired)
        }];
    }
    
    resolve(devices);
}

#pragma mark - Connection

// Helper to clean up pending connection state
- (void)cleanupPendingConnection {
    [self debugLog:@"Cleaning up pending connection state"];
    if (self.connectTimeoutTimer) {
        [self.connectTimeoutTimer invalidate];
        self.connectTimeoutTimer = nil;
    }
    self.pendingConnectResolver = nil;
    self.pendingConnectRejecter = nil;
    self.pendingConnectDeviceId = nil;
    self.autoReconnectResolved = NO; // Reset the flag
}

// Connection timeout handler
- (void)connectTimeout:(NSTimer *)timer {
    [self debugLog:@"Connection timeout - 15 seconds elapsed"];
    
    if (self.pendingConnectRejecter) {
        self.pendingConnectRejecter(@"CONNECTION_TIMEOUT", @"Connection timed out. Please ensure the ring is nearby and try again.", nil);
    }
    [self cleanupPendingConnection];
    
    // Also stop any pending connection in QCCentralManager
    [[QCCentralManager shared] stopScan];
}

RCT_EXPORT_METHOD(connect:(NSString *)peripheralId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"Connecting to device: %@", peripheralId]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Clean up any previous pending connection
        [self cleanupPendingConnection];
        
        QCBlePeripheral *targetPeripheral = nil;
        
        for (QCBlePeripheral *peripheral in self.discoveredDevices) {
            if ([peripheral.peripheral.identifier.UUIDString isEqualToString:peripheralId] ||
                [peripheral.mac isEqualToString:peripheralId]) {
                targetPeripheral = peripheral;
                break;
            }
        }
        
        if (!targetPeripheral) {
            [self debugLog:[NSString stringWithFormat:@"Device not found: %@", peripheralId]];
            reject(@"DEVICE_NOT_FOUND", @"Device not found in discovered list", nil);
            return;
        }
        
        [self debugLog:[NSString stringWithFormat:@"Found device: %@, connecting (will wait for completion)...", targetPeripheral.peripheral.name]];
        
        // Store the promise to resolve later when connection actually completes
        self.pendingConnectResolver = resolve;
        self.pendingConnectRejecter = reject;
        self.pendingConnectDeviceId = peripheralId;
        
        // Set a 15-second timeout for the connection (shorter to avoid long waits)
        self.connectTimeoutTimer = [NSTimer scheduledTimerWithTimeInterval:15.0
                                                                    target:self
                                                                  selector:@selector(connectTimeout:)
                                                                  userInfo:nil
                                                                   repeats:NO];
        
        // Initiate the connection - the promise will be resolved in didState: callback
        [[QCCentralManager shared] connect:targetPeripheral.peripheral deviceType:QCDeviceTypeRing];
        
        // NOTE: We do NOT resolve here! We wait for didState: to fire with QCStateConnected
    });
}

RCT_EXPORT_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Disconnecting from device"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Cancel any pending connection attempt
        if (self.pendingConnectRejecter) {
            [self debugLog:@"Cancelling pending connection due to disconnect request"];
            self.pendingConnectRejecter(@"CONNECTION_CANCELLED", @"Connection cancelled by user", nil);
            [self cleanupPendingConnection];
        }
        
        [[QCCentralManager shared] remove];
        resolve(@{@"success": @YES, @"message": @"Disconnect initiated"});
    });
}

RCT_EXPORT_METHOD(getConnectionState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    QCState state = [QCCentralManager shared].deviceState;
    NSString *stateString = [self connectionStateToString:state];
    resolve(@{@"state": stateString});
}

RCT_EXPORT_METHOD(isConnected:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL connected = [QCCentralManager shared].deviceState == QCStateConnected;
    CBPeripheral *peripheral = [QCCentralManager shared].connectedPeripheral;
    
    resolve(@{
        @"connected": @(connected),
        @"state": [self connectionStateToString:[QCCentralManager shared].deviceState],
        @"deviceName": peripheral.name ?: [NSNull null],
        @"deviceId": peripheral.identifier.UUIDString ?: [NSNull null]
    });
}

#pragma mark - Paired Device Management

RCT_EXPORT_METHOD(hasPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL hasPaired = [[QCCentralManager shared] isBindDevice];
    [self debugLog:[NSString stringWithFormat:@"hasPairedDevice: %d", hasPaired]];
    resolve(@{@"hasPairedDevice": @(hasPaired)});
}

RCT_EXPORT_METHOD(getPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Getting paired device info"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        BOOL hasPaired = [[QCCentralManager shared] isBindDevice];
        
        if (!hasPaired) {
            [self debugLog:@"No paired device found"];
            resolve(@{
                @"hasPairedDevice": @NO,
                @"device": [NSNull null]
            });
            return;
        }
        
        // Get the saved peripheral using the stored UUID
        CBPeripheral *peripheral = [[QCCentralManager shared] lastPeripheral];
        
        if (peripheral) {
            [self debugLog:[NSString stringWithFormat:@"Found paired device: %@", peripheral.name]];
            
            // Add to discovered devices list so connect() can find it
            QCBlePeripheral *qcPer = [[QCBlePeripheral alloc] init];
            qcPer.peripheral = peripheral;
            qcPer.mac = peripheral.identifier.UUIDString; // Use UUID as MAC for reconnection
            qcPer.isPaired = YES;
            
            // Add to our discovered devices if not already there
            BOOL exists = NO;
            for (QCBlePeripheral *p in self.discoveredDevices) {
                if ([p.peripheral.identifier.UUIDString isEqualToString:peripheral.identifier.UUIDString]) {
                    exists = YES;
                    break;
                }
            }
            if (!exists) {
                [self.discoveredDevices addObject:qcPer];
            }
            
            resolve(@{
                @"hasPairedDevice": @YES,
                @"device": @{
                    @"id": peripheral.identifier.UUIDString ?: @"",
                    @"mac": peripheral.identifier.UUIDString ?: @"", // Use UUID for reconnection
                    @"name": peripheral.name ?: @"Smart Ring",
                    @"rssi": @(-50),
                    @"isPaired": @YES
                }
            });
        } else {
            [self debugLog:@"Paired device UUID exists but peripheral not found"];
            resolve(@{
                @"hasPairedDevice": @YES,
                @"device": [NSNull null]
            });
        }
    });
}

RCT_EXPORT_METHOD(autoReconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Auto-reconnect requested"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Reset the flag at the start
        self.autoReconnectResolved = NO;
        
        BOOL hasPaired = [[QCCentralManager shared] isBindDevice];
        
        if (!hasPaired) {
            [self debugLog:@"No paired device to reconnect"];
            resolve(@{@"success": @NO, @"message": @"No paired device"});
            return;
        }
        
        QCBluetoothState bleState = [QCCentralManager shared].bleState;
        if (bleState != QCBluetoothStatePoweredOn) {
            [self debugLog:@"Bluetooth not powered on"];
            resolve(@{@"success": @NO, @"message": @"Bluetooth not powered on"});
            return;
        }
        
        // Check if already connected first
        QCState currentState = [QCCentralManager shared].deviceState;
        CBPeripheral *peripheral = [QCCentralManager shared].connectedPeripheral;
        
        if (currentState == QCStateConnected) {
            [self debugLog:@"Device already connected, returning success"];
            resolve(@{
                @"success": @YES,
                @"message": @"Already connected",
                @"deviceName": peripheral.name ?: @"Smart Ring",
                @"deviceId": peripheral.identifier.UUIDString ?: @""
            });
            return;
        }
        
        // Also check if peripheral BLE state shows connected
        if (peripheral && peripheral.state == CBPeripheralStateConnected) {
            [self debugLog:@"Peripheral BLE state shows connected, adding to SDK..."];
            
            // Already connected at BLE level, just need to add to SDK
            [[QCSDKManager shareInstance] removePeripheral:peripheral];
            [[QCSDKManager shareInstance] addPeripheral:peripheral finished:^(BOOL success) {
                // Check if already resolved (prevent double resolution)
                if (self.autoReconnectResolved) {
                    [self debugLog:@"autoReconnect already resolved, skipping"];
                    return;
                }
                
                if (success) {
                    [self debugLog:@"Successfully added already-connected peripheral to SDK"];
                    // Now sync time - resolve AFTER time sync completes (SDK needs this)
                    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
                        if (self.autoReconnectResolved) return; // Double-check
                        self.autoReconnectResolved = YES;
                        [self debugLog:@"Time synced after reconnect"];
                        resolve(@{
                            @"success": @YES,
                            @"message": @"Reconnected (already connected)",
                            @"deviceName": peripheral.name ?: @"Smart Ring",
                            @"deviceId": peripheral.identifier.UUIDString ?: @""
                        });
                    } failed:^{
                        if (self.autoReconnectResolved) return; // Double-check
                        self.autoReconnectResolved = YES;
                        [self debugLog:@"Time sync failed, but still connected"];
                        resolve(@{
                            @"success": @YES,
                            @"message": @"Reconnected (time sync failed)",
                            @"deviceName": peripheral.name ?: @"Smart Ring",
                            @"deviceId": peripheral.identifier.UUIDString ?: @""
                        });
                    }];
                } else {
                    [self debugLog:@"Failed to add peripheral to SDK, trying fresh connection"];
                    // Fall through to regular reconnection
                    [self cleanupPendingConnection];
                    self.pendingConnectResolver = resolve;
                    self.pendingConnectRejecter = reject;
                    self.connectTimeoutTimer = [NSTimer scheduledTimerWithTimeInterval:15.0
                                                                                target:self
                                                                              selector:@selector(connectTimeout:)
                                                                              userInfo:nil
                                                                               repeats:NO];
                    [[QCCentralManager shared] startToReconnect];
                }
            }];
            return;
        }
        
        // Clean up any existing pending connection
        [self cleanupPendingConnection];
        
        // Store the promise resolver for when connection completes
        self.pendingConnectResolver = resolve;
        self.pendingConnectRejecter = reject;
        
        // Set a 15-second timeout (shorter than before, we don't want to wait forever)
        self.connectTimeoutTimer = [NSTimer scheduledTimerWithTimeInterval:15.0
                                                                    target:self
                                                                  selector:@selector(connectTimeout:)
                                                                  userInfo:nil
                                                                   repeats:NO];
        
        [self debugLog:@"Starting reconnection..."];
        [[QCCentralManager shared] startToReconnect];
    });
}

RCT_EXPORT_METHOD(forgetPairedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Forgetting paired device"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[QCCentralManager shared] remove];
        resolve(@{@"success": @YES, @"message": @"Device forgotten"});
    });
}

#pragma mark - Set Time (Required after connection)

RCT_EXPORT_METHOD(setTime:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Setting device time"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
            [self debugLog:[NSString stringWithFormat:@"Time set successfully, features: %@", info]];
            resolve(@{
                @"success": @YES,
                @"features": info ?: @{}
            });
        } failed:^{
            [self debugLog:@"Failed to set time"];
            reject(@"SET_TIME_FAILED", @"Failed to set device time", nil);
        }];
    });
}

#pragma mark - Battery

RCT_EXPORT_METHOD(getBattery:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Getting battery level"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator readBatterySuccess:^(int battery, BOOL charging) {
            [self debugLog:[NSString stringWithFormat:@"Battery: %d%%, charging: %d", battery, charging]];
            resolve(@{
                @"battery": @(battery),
                @"level": @(battery),
                @"isCharging": @(charging)
            });
        } failed:^{
            [self debugLog:@"Failed to get battery"];
            reject(@"GET_BATTERY_FAILED", @"Failed to get battery", nil);
        }];
    });
}

#pragma mark - Steps

RCT_EXPORT_METHOD(getSteps:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Getting step data"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getCurrentSportSucess:^(QCSportModel * _Nonnull sport) {
            [self debugLog:[NSString stringWithFormat:@"Steps: %ld, Cal: %lf, Dist: %ld",
                          (long)sport.totalStepCount, sport.calories, (long)sport.distance]];
            resolve(@{
                @"steps": @(sport.totalStepCount),
                @"calories": @(sport.calories),
                @"distance": @(sport.distance),
                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
            });
        } failed:^{
            [self debugLog:@"Failed to get steps"];
            reject(@"GET_STEPS_FAILED", @"Failed to get step data", nil);
        }];
    });
}

RCT_EXPORT_METHOD(getStepsDetail:(double)dayIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getSportDetailDataByDay:(NSInteger)dayIndex sportDatas:^(NSArray<QCSportModel *> * _Nonnull sports) {
            NSMutableArray *result = [NSMutableArray array];
            for (QCSportModel *sport in sports) {
                [result addObject:@{
                    @"steps": @(sport.totalStepCount),
                    @"calories": @(sport.calories),
                    @"distance": @(sport.distance),
                    @"date": sport.happenDate ?: @""
                }];
            }
            resolve(result);
        } fail:^{
            reject(@"GET_STEPS_FAILED", @"Failed to get step details", nil);
        }];
    });
}

#pragma mark - Sleep

RCT_EXPORT_METHOD(getSleepData:(double)dayIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Getting sleep data for day: %.0f", dayIndex]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getFulldaySleepDetailDataByDay:(NSInteger)dayIndex sleepDatas:^(NSArray<QCSleepModel *> * _Nullable sleeps, NSArray<QCSleepModel *> * _Nullable naps) {
            
            // Log raw sleep data from SDK
            // SLEEPTYPE: 0=None, 1=Awake, 2=Light, 3=Deep, 4=REM, 5=Unweared
            NSArray *typeNames = @[@"None", @"Awake", @"Light", @"Deep", @"REM", @"Unweared"];
            
            [self debugLog:@"😴 ========== RAW SLEEP DATA FROM SDK =========="];
            [self debugLog:[NSString stringWithFormat:@"😴 Total sleep segments: %lu, Total nap segments: %lu", (unsigned long)sleeps.count, (unsigned long)naps.count]];
            
            for (NSUInteger i = 0; i < sleeps.count; i++) {
                QCSleepModel *sleep = sleeps[i];
                NSString *typeName = (sleep.type >= 0 && sleep.type < typeNames.count) ? typeNames[sleep.type] : @"Unknown";
                [self debugLog:[NSString stringWithFormat:@"😴 Sleep[%lu]: type=%ld (%@), duration=%ld min, %@ → %@",
                              (unsigned long)i, (long)sleep.type, typeName, (long)sleep.total, sleep.happenDate, sleep.endTime]];
            }
            
            NSInteger totalSleep = [QCSleepModel sleepDuration:sleeps];
            NSInteger totalNaps = [QCSleepModel sleepDuration:naps];
            NSInteger fallAsleepDuration = [QCSleepModel fallAsleepDuration:sleeps];
            
            // Calculate totals by type for verification
            NSInteger awakeMins = 0, lightMins = 0, deepMins = 0, remMins = 0;
            for (QCSleepModel *sleep in sleeps) {
                switch (sleep.type) {
                    case 1: awakeMins += sleep.total; break;
                    case 2: lightMins += sleep.total; break;
                    case 3: deepMins += sleep.total; break;
                    case 4: remMins += sleep.total; break;
                    default: break;
                }
            }
            [self debugLog:[NSString stringWithFormat:@"😴 Breakdown: Awake=%ldm, Light=%ldm, Deep=%ldm, REM=%ldm", awakeMins, lightMins, deepMins, remMins]];
            [self debugLog:[NSString stringWithFormat:@"😴 SDK totalSleep=%ldm (%ldh%ldm), fallAsleep=%ldm", totalSleep, totalSleep/60, totalSleep%60, fallAsleepDuration]];
            [self debugLog:@"😴 ============================================="];
            
            NSMutableArray *sleepArray = [NSMutableArray array];
            for (QCSleepModel *sleep in sleeps) {
                [sleepArray addObject:@{
                    @"startTime": sleep.happenDate ?: @"",
                    @"endTime": sleep.endTime ?: @"",
                    @"duration": @(sleep.total),
                    @"type": @(sleep.type)
                }];
            }
            
            NSMutableArray *napArray = [NSMutableArray array];
            for (QCSleepModel *nap in naps) {
                [napArray addObject:@{
                    @"startTime": nap.happenDate ?: @"",
                    @"endTime": nap.endTime ?: @"",
                    @"duration": @(nap.total),
                    @"type": @(nap.type)
                }];
            }
            
            [self debugLog:[NSString stringWithFormat:@"Sleep: %ldh%ldm, Naps: %ldh%ldm",
                          totalSleep/60, totalSleep%60, totalNaps/60, totalNaps%60]];
            
            resolve(@{
                @"totalSleepMinutes": @(totalSleep),
                @"totalNapMinutes": @(totalNaps),
                @"fallAsleepDuration": @(fallAsleepDuration),
                @"sleepSegments": sleepArray,
                @"napSegments": napArray,
                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
            });
        } fail:^{
            [self debugLog:@"Failed to get sleep data"];
            reject(@"GET_SLEEP_FAILED", @"Failed to get sleep data", nil);
        }];
    });
}

#pragma mark - Heart Rate Measurement

RCT_EXPORT_METHOD(startHeartRateMeasuring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Starting heart rate measurement"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeHeartRate
            measuringHandle:^(id _Nullable result) {
                if (result && [result isKindOfClass:[NSNumber class]]) {
                    NSNumber *hr = (NSNumber *)result;
                    [self debugLog:[NSString stringWithFormat:@"HR measuring: %@", hr]];
                    if (self.hasListeners) {
                        [self sendEventWithName:@"onHeartRateData" body:@{
                            @"heartRate": hr,
                            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                            @"isMeasuring": @YES
                        }];
                    }
                }
            }
            completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                if (isSuccess && result && [result isKindOfClass:[NSNumber class]]) {
                    NSNumber *hr = (NSNumber *)result;
                    [self debugLog:[NSString stringWithFormat:@"HR measurement complete: %@", hr]];
                    if (self.hasListeners) {
                        [self sendEventWithName:@"onHeartRateData" body:@{
                            @"heartRate": hr,
                            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                            @"isFinal": @YES
                        }];
                    }
                } else {
                    [self debugLog:@"HR measurement failed"];
                }
            }];
        
        resolve(@{@"success": @YES, @"message": @"Heart rate measurement started"});
    });
}

RCT_EXPORT_METHOD(stopHeartRateMeasuring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Stopping heart rate measurement"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[QCSDKManager shareInstance] stopToMeasuringWithOperateType:QCMeasuringTypeHeartRate
            completedHandle:^(BOOL isSuccess, NSError * _Nonnull error) {
                if (isSuccess) {
                    [self debugLog:@"HR measurement stopped"];
                }
            }];
        
        resolve(@{@"success": @YES, @"message": @"Heart rate measurement stopped"});
    });
}

#pragma mark - Real-Time Heart Rate

RCT_EXPORT_METHOD(startRealTimeHeartRate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Starting real-time heart rate"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Start real-time HR
        [QCSDKCmdCreator realTimeHeartRateWithCmd:QCBandRealTimeHeartRateCmdTypeStart finished:nil];
        
        // Start hold timer (must send hold command every 20 seconds)
        [self stopRealTimeHRTimer];
        self.realTimeHRTimer = [NSTimer scheduledTimerWithTimeInterval:kQCHoldRealTimeHeartRateTimeout
                                                                target:self
                                                              selector:@selector(holdRealTimeHR)
                                                              userInfo:nil
                                                               repeats:YES];
        
        resolve(@{@"success": @YES, @"message": @"Real-time heart rate started"});
    });
}

- (void)holdRealTimeHR {
    [self debugLog:@"Sending real-time HR hold command"];
    [QCSDKCmdCreator realTimeHeartRateWithCmd:QCBandRealTimeHeartRateCmdTypeHold finished:nil];
}

- (void)stopRealTimeHRTimer {
    if (self.realTimeHRTimer) {
        [self.realTimeHRTimer invalidate];
        self.realTimeHRTimer = nil;
    }
}

RCT_EXPORT_METHOD(stopRealTimeHeartRate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Stopping real-time heart rate"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self stopRealTimeHRTimer];
        [QCSDKCmdCreator realTimeHeartRateWithCmd:QCBandRealTimeHeartRateCmdTypeEnd finished:nil];
        
        resolve(@{@"success": @YES, @"message": @"Real-time heart rate stopped"});
    });
}

#pragma mark - Temperature

RCT_EXPORT_METHOD(startTemperatureMeasuring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:@"Starting temperature measurement"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeThreeValueBodyTemperature
            measuringHandle:^(id _Nullable result) {
                if (result && [result isKindOfClass:[QCThreeValueTemperatureModel class]]) {
                    QCThreeValueTemperatureModel *temp = (QCThreeValueTemperatureModel *)result;
                    [self debugLog:[NSString stringWithFormat:@"Temperature measuring: %@", temp]];
                    if (self.hasListeners) {
                        [self sendEventWithName:@"onTemperatureData" body:@{
                            @"temperature": @(0), // Extract from model
                            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                            @"isMeasuring": @YES
                        }];
                    }
                }
            }
            completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                [self debugLog:[NSString stringWithFormat:@"Temperature measurement complete: %d", isSuccess]];
            }];
        
        resolve(@{@"success": @YES, @"message": @"Temperature measurement started"});
    });
}

#pragma mark - Scheduled/Manual Data Retrieval

RCT_EXPORT_METHOD(getScheduledHeartRate:(NSArray *)dayIndexes
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Getting scheduled heart rate for days: %@", dayIndexes]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getSchedualHeartRateDataWithDayIndexs:dayIndexes
            success:^(NSArray<QCSchedualHeartRateModel *> * _Nonnull models) {
                NSMutableArray *results = [NSMutableArray array];
                
                // Date formatter to parse the model's date string
                NSDateFormatter *dateFormatter = [[NSDateFormatter alloc] init];
                [dateFormatter setDateFormat:@"yyyy-MM-dd"];
                [dateFormatter setTimeZone:[NSTimeZone localTimeZone]];
                
                for (QCSchedualHeartRateModel *model in models) {
                    NSArray *hrValues = model.heartRates ?: @[];
                    NSInteger secondInterval = model.secondInterval > 0 ? model.secondInterval : 300; // Default 5 min (300s)
                    
                    // Parse the date string to get midnight of that day
                    NSDate *dayStart = [dateFormatter dateFromString:model.date];
                    if (!dayStart) {
                        // Fallback to today if date parsing fails
                        dayStart = [[NSCalendar currentCalendar] startOfDayForDate:[NSDate date]];
                    }
                    NSTimeInterval dayStartTimestamp = [dayStart timeIntervalSince1970] * 1000; // milliseconds
                    
                    [self debugLog:[NSString stringWithFormat:@"Processing HR model: date=%@, interval=%lds, %lu values",
                                    model.date, (long)secondInterval, (unsigned long)hrValues.count]];
                    
                    for (NSInteger i = 0; i < hrValues.count; i++) {
                        NSNumber *hr = hrValues[i];
                        if ([hr integerValue] > 0) {
                            // Calculate actual timestamp for this measurement
                            // Each measurement is at index * secondInterval from midnight
                            NSTimeInterval offsetMs = i * secondInterval * 1000;
                            NSTimeInterval actualTimestamp = dayStartTimestamp + offsetMs;
                            
                            // Calculate timeMinutes (minutes since midnight)
                            NSInteger timeMinutes = (i * secondInterval) / 60;
                            
                            [results addObject:@{
                                @"heartRate": hr,
                                @"timestamp": @(actualTimestamp),
                                @"timeMinutes": @(timeMinutes)
                            }];
                        }
                    }
                }
                [self debugLog:[NSString stringWithFormat:@"Got %lu scheduled HR records with proper timestamps", (unsigned long)results.count]];
                resolve(results);
            }
            fail:^{
                [self debugLog:@"Failed to get scheduled heart rate"];
                reject(@"GET_HR_FAILED", @"Failed to get scheduled heart rate", nil);
            }];
    });
}

RCT_EXPORT_METHOD(getManualHeartRate:(double)dayIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Getting manual heart rate for day: %.0f", dayIndex]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getManualHeartRateDataByDayIndex:(NSInteger)dayIndex
            finished:^(NSArray<QCManualHeartRateModel *> * _Nullable models, NSError * _Nullable error) {
                if (error) {
                    [self debugLog:[NSString stringWithFormat:@"Manual HR error: %@", error.localizedDescription]];
                    reject(@"GET_HR_FAILED", error.localizedDescription, error);
                    return;
                }
                
                NSMutableArray *results = [NSMutableArray array];
                for (QCManualHeartRateModel *model in models) {
                    // Model has heartRates array and hrTimes array (minutes from start of day)
                    NSArray *hrValues = model.heartRates ?: @[];
                    NSArray *hrTimes = model.hrTimes ?: @[];
                    NSString *dateStr = model.date ?: @"";
                    
                    for (NSUInteger i = 0; i < hrValues.count; i++) {
                        NSNumber *hr = hrValues[i];
                        if ([hr integerValue] > 0) {
                            // Get time offset in minutes from start of day
                            NSInteger timeMinutes = (i < hrTimes.count) ? [hrTimes[i] integerValue] : 0;
                            [results addObject:@{
                                @"heartRate": hr,
                                @"date": dateStr,
                                @"timeMinutes": @(timeMinutes),
                                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
                            }];
                        }
                    }
                }
                [self debugLog:[NSString stringWithFormat:@"Got %lu manual HR records", (unsigned long)results.count]];
                resolve(results);
            }];
    });
}

RCT_EXPORT_METHOD(getManualBloodOxygen:(double)dayIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Getting manual blood oxygen for day: %.0f", dayIndex]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getManualBloodOxygenDataByDayIndex:(NSInteger)dayIndex
            finished:^(NSArray * _Nullable data, NSError * _Nullable error) {
                if (error) {
                    [self debugLog:[NSString stringWithFormat:@"Manual SpO2 error: %@", error.localizedDescription]];
                    reject(@"GET_SPO2_FAILED", error.localizedDescription, error);
                    return;
                }
                
                NSMutableArray *results = [NSMutableArray array];
                for (id item in data) {
                    // The data could be QCBloodOxygenModel objects
                    if ([item isKindOfClass:[QCBloodOxygenModel class]]) {
                        QCBloodOxygenModel *model = (QCBloodOxygenModel *)item;
                        NSTimeInterval timestamp = model.date ? [model.date timeIntervalSince1970] : [[NSDate date] timeIntervalSince1970];
                        [results addObject:@{
                            @"spo2": @(model.soa2),
                            @"minSpo2": @(model.minSoa2),
                            @"maxSpo2": @(model.maxSoa2),
                            @"timestamp": @(timestamp * 1000)
                        }];
                    } else if ([item isKindOfClass:[NSDictionary class]]) {
                        // Fallback for dictionary format
                        NSDictionary *dict = (NSDictionary *)item;
                        NSNumber *spo2 = dict[@"soa2"] ?: dict[@"spo2"] ?: dict[@"bloodOxygen"] ?: @(0);
                        NSNumber *timestamp = dict[@"timestamp"] ?: @([[NSDate date] timeIntervalSince1970]);
                        [results addObject:@{
                            @"spo2": spo2,
                            @"timestamp": @([timestamp doubleValue] * 1000)
                        }];
                    }
                }
                [self debugLog:[NSString stringWithFormat:@"Got %lu manual SpO2 records", (unsigned long)results.count]];
                resolve(results);
            }];
    });
}

RCT_EXPORT_METHOD(getBloodGlucose:(double)dayIndex
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Getting blood glucose for day: %.0f", dayIndex]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getBloodGlucoseDataByDayIndex:(NSInteger)dayIndex
            finished:^(NSArray * _Nullable data, NSError * _Nullable error) {
                if (error) {
                    [self debugLog:[NSString stringWithFormat:@"Blood glucose error: %@", error.localizedDescription]];
                    reject(@"GET_BG_FAILED", error.localizedDescription, error);
                    return;
                }
                
                NSMutableArray *results = [NSMutableArray array];
                for (id item in data) {
                    if ([item isKindOfClass:[QCBloodGlucoseModel class]]) {
                        QCBloodGlucoseModel *model = (QCBloodGlucoseModel *)item;
                        NSTimeInterval timestamp = model.date ? [model.date timeIntervalSince1970] : [[NSDate date] timeIntervalSince1970];
                        [results addObject:@{
                            @"glucose": @(model.glu),
                            @"minGlucose": @(model.minGlu),
                            @"maxGlucose": @(model.maxGlu),
                            @"type": @(model.type), // 0=scheduled, 1=manual
                            @"gluType": @(model.gluType), // 0=before meals, 1=normal, 2=after meals
                            @"timestamp": @(timestamp * 1000)
                        }];
                    } else if ([item isKindOfClass:[NSDictionary class]]) {
                        // Fallback for dictionary format
                        NSDictionary *dict = (NSDictionary *)item;
                        NSNumber *glucose = dict[@"glu"] ?: dict[@"glucose"] ?: @(0);
                        NSNumber *timestamp = dict[@"timestamp"] ?: @([[NSDate date] timeIntervalSince1970]);
                        [results addObject:@{
                            @"glucose": glucose,
                            @"timestamp": @([timestamp doubleValue] * 1000)
                        }];
                    }
                }
                [self debugLog:[NSString stringWithFormat:@"Got %lu blood glucose records", (unsigned long)results.count]];
                resolve(results);
            }];
    });
}

RCT_EXPORT_METHOD(startMeasurement:(NSString *)type
                  timeout:(double)timeout
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    [self debugLog:[NSString stringWithFormat:@"Starting measurement type: %@", type]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        if ([type isEqualToString:@"heartRate"]) {
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeHeartRate
                measuringHandle:^(id _Nullable result) {
                    if (result && [result isKindOfClass:[NSNumber class]]) {
                        NSNumber *hr = (NSNumber *)result;
                        [self debugLog:[NSString stringWithFormat:@"HR measuring: %@", hr]];
                        if (self.hasListeners) {
                            [self sendEventWithName:@"onHeartRateData" body:@{
                                @"heartRate": hr,
                                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                                @"isMeasuring": @YES
                            }];
                        }
                    }
                }
                completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                    if (isSuccess && result && [result isKindOfClass:[NSNumber class]]) {
                        NSNumber *hr = (NSNumber *)result;
                        [self debugLog:[NSString stringWithFormat:@"HR measurement complete: %@", hr]];
                        if (self.hasListeners) {
                            [self sendEventWithName:@"onHeartRateData" body:@{
                                @"heartRate": hr,
                                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                                @"isFinal": @YES
                            }];
                        }
                    }
                }];
            resolve(@{@"success": @YES, @"message": @"Heart rate measurement started"});
            
        } else if ([type isEqualToString:@"spo2"] || [type isEqualToString:@"bloodOxygen"]) {
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeBloodOxygen
                measuringHandle:^(id _Nullable result) {
                    if (result && [result isKindOfClass:[NSNumber class]]) {
                        NSNumber *spo2 = (NSNumber *)result;
                        [self debugLog:[NSString stringWithFormat:@"SpO2 measuring: %@", spo2]];
                        if (self.hasListeners) {
                            [self sendEventWithName:@"onSpO2Data" body:@{
                                @"spo2": spo2,
                                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                                @"isMeasuring": @YES
                            }];
                        }
                    }
                }
                completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                    if (isSuccess && result && [result isKindOfClass:[NSNumber class]]) {
                        NSNumber *spo2 = (NSNumber *)result;
                        [self debugLog:[NSString stringWithFormat:@"SpO2 measurement complete: %@", spo2]];
                        if (self.hasListeners) {
                            [self sendEventWithName:@"onSpO2Data" body:@{
                                @"spo2": spo2,
                                @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
                                @"isFinal": @YES
                            }];
                        }
                    }
                }];
            resolve(@{@"success": @YES, @"message": @"SpO2 measurement started"});
            
        } else if ([type isEqualToString:@"bloodPressure"]) {
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeBloodPressue
                measuringHandle:^(id _Nullable result) {
                    [self debugLog:@"Blood pressure measuring..."];
                }
                completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                    [self debugLog:[NSString stringWithFormat:@"Blood pressure complete: %d", isSuccess]];
                }];
            resolve(@{@"success": @YES, @"message": @"Blood pressure measurement started"});
            
        } else if ([type isEqualToString:@"temperature"]) {
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:QCMeasuringTypeThreeValueBodyTemperature
                measuringHandle:^(id _Nullable result) {
                    [self debugLog:@"Temperature measuring..."];
                }
                completedHandle:^(BOOL isSuccess, id _Nonnull result, NSError * _Nonnull error) {
                    [self debugLog:[NSString stringWithFormat:@"Temperature complete: %d", isSuccess]];
                }];
            resolve(@{@"success": @YES, @"message": @"Temperature measurement started"});
            
        } else {
            reject(@"INVALID_TYPE", [NSString stringWithFormat:@"Unknown measurement type: %@", type], nil);
        }
    });
}

RCT_EXPORT_METHOD(stopMeasurement:(NSString *)type
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"Stopping measurement type: %@", type]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        QCMeasuringType measureType = QCMeasuringTypeHeartRate;
        
        if ([type isEqualToString:@"heartRate"]) {
            measureType = QCMeasuringTypeHeartRate;
        } else if ([type isEqualToString:@"spo2"] || [type isEqualToString:@"bloodOxygen"]) {
            measureType = QCMeasuringTypeBloodOxygen;
        } else if ([type isEqualToString:@"bloodPressure"]) {
            measureType = QCMeasuringTypeBloodPressue;
        } else if ([type isEqualToString:@"temperature"]) {
            measureType = QCMeasuringTypeThreeValueBodyTemperature;
        }
        
        [[QCSDKManager shareInstance] stopToMeasuringWithOperateType:measureType
            completedHandle:^(BOOL isSuccess, NSError * _Nonnull error) {
                [self debugLog:[NSString stringWithFormat:@"Measurement stopped: %d", isSuccess]];
            }];
        
        resolve(@{@"success": @YES});
    });
}

#pragma mark - Firmware Info

RCT_EXPORT_METHOD(getFirmwareInfo:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator getDeviceSoftAndHardVersionSuccess:^(NSString * _Nonnull hardVersion, NSString * _Nonnull softVersion) {
            [self debugLog:[NSString stringWithFormat:@"Firmware: HW=%@, SW=%@", hardVersion, softVersion]];
            resolve(@{
                @"hardwareVersion": hardVersion ?: @"unknown",
                @"softwareVersion": softVersion ?: @"unknown"
            });
        } fail:^{
            reject(@"GET_FIRMWARE_FAILED", @"Failed to get firmware info", nil);
        }];
    });
}

#pragma mark - Alert/Vibration

RCT_EXPORT_METHOD(alertBinding:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if ([QCCentralManager shared].deviceState != QCStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [QCSDKCmdCreator alertBindingSuccess:^{
            [self debugLog:@"Alert binding sent"];
            resolve(@{@"success": @YES});
        } fail:^{
            reject(@"ALERT_FAILED", @"Failed to send alert", nil);
        }];
    });
}

#pragma mark - QCCentralManagerDelegate

- (void)didState:(QCState)state {
    [self debugLog:[NSString stringWithFormat:@"Connection state changed: %@", [self connectionStateToString:state]]];
    
    CBPeripheral *peripheral = [QCCentralManager shared].connectedPeripheral;
    
    // Send event to JS listeners
    if (self.hasListeners) {
        [self sendEventWithName:@"onConnectionStateChanged" body:@{
            @"state": [self connectionStateToString:state],
            @"deviceId": peripheral.identifier.UUIDString ?: @"",
            @"deviceName": peripheral.name ?: @"Unknown"
        }];
    }
    
    // Skip if autoReconnect already handled this
    if (self.autoReconnectResolved) {
        [self debugLog:@"Skipping didState handling - autoReconnect already resolved"];
        return;
    }
    
    // Handle pending connection promise
    if (state == QCStateConnected) {
        // Only handle if we have a pending resolver (from connect: or autoReconnect fallback path)
        if (!self.pendingConnectResolver) {
            [self debugLog:@"Device connected but no pending resolver, skipping"];
            return;
        }
        
        [self debugLog:@"Device connected! Syncing time before resolving promise..."];
        
        // Sync time first (required by SDK), then resolve the promise
        [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
            [self debugLog:[NSString stringWithFormat:@"Time synced, features: %@", info]];
            
            // NOW resolve the pending connect promise
            if (self.pendingConnectResolver) {
                [self debugLog:@"Resolving pending connect promise with success"];
                self.pendingConnectResolver(@{
                    @"success": @YES,
                    @"message": @"Connected successfully",
                    @"deviceName": peripheral.name ?: @"Smart Ring",
                    @"deviceId": peripheral.identifier.UUIDString ?: @"",
                    @"features": info ?: @{}
                });
                [self cleanupPendingConnection];
            }
        } failed:^{
            [self debugLog:@"Failed to sync time, but still connected"];
            
            // Still resolve as connected (time sync is not critical for connection)
            if (self.pendingConnectResolver) {
                [self debugLog:@"Resolving pending connect promise with success (time sync failed)"];
                self.pendingConnectResolver(@{
                    @"success": @YES,
                    @"message": @"Connected (time sync failed)",
                    @"deviceName": peripheral.name ?: @"Smart Ring",
                    @"deviceId": peripheral.identifier.UUIDString ?: @""
                });
                [self cleanupPendingConnection];
            }
        }];
    }
    else if (state == QCStateDisconnected || state == QCStateUnbind) {
        // If we were waiting for a connection and got disconnected, reject the promise
        if (self.pendingConnectRejecter) {
            [self debugLog:@"Connection failed - device disconnected or unbound"];
            self.pendingConnectRejecter(@"CONNECTION_FAILED", @"Device disconnected during connection", nil);
            [self cleanupPendingConnection];
        }
    }
}

- (void)didBluetoothState:(QCBluetoothState)state {
    [self debugLog:[NSString stringWithFormat:@"Bluetooth state: %@", [self bluetoothStateToString:state]]];
    
    if (self.hasListeners) {
        [self sendEventWithName:@"onBluetoothStateChanged" body:@{
            @"state": [self bluetoothStateToString:state]
        }];
    }
}

- (void)didScanPeripherals:(NSArray<QCBlePeripheral *> *)peripheralArr {
    [self debugLog:[NSString stringWithFormat:@"Scan found %lu devices", (unsigned long)peripheralArr.count]];
    
    self.discoveredDevices = [peripheralArr mutableCopy];
    
    if (self.hasListeners) {
        for (QCBlePeripheral *peripheral in peripheralArr) {
            NSDictionary *deviceInfo = @{
                @"id": peripheral.peripheral.identifier.UUIDString ?: @"",
                @"mac": peripheral.mac ?: @"",
                @"name": peripheral.peripheral.name ?: @"Unknown",
                @"rssi": peripheral.RSSI ?: @(-100),
                @"isPaired": @(peripheral.isPaired)
            };
            [self sendEventWithName:@"onDeviceFound" body:deviceInfo];
            [self sendEventWithName:@"onDeviceDiscovered" body:deviceInfo];
        }
    }
}

- (void)scanPeripheralFinish {
    [self debugLog:@"Scan finished"];
    
    if (self.hasListeners) {
        NSMutableArray *devices = [NSMutableArray array];
        for (QCBlePeripheral *peripheral in self.discoveredDevices) {
            [devices addObject:@{
                @"id": peripheral.peripheral.identifier.UUIDString ?: @"",
                @"mac": peripheral.mac ?: @"",
                @"name": peripheral.peripheral.name ?: @"Unknown",
                @"rssi": peripheral.RSSI ?: @(-100),
                @"isPaired": @(peripheral.isPaired)
            }];
        }
        [self sendEventWithName:@"onScanFinished" body:@{@"devices": devices}];
    }
}

- (void)didFailConnected:(CBPeripheral *)peripheral error:(NSError *)error {
    [self debugLog:[NSString stringWithFormat:@"Connection failed: %@", error.localizedDescription]];
    
    // Reject pending connection promise if one exists
    if (self.pendingConnectRejecter) {
        [self debugLog:@"Rejecting pending connect promise due to connection failure"];
        self.pendingConnectRejecter(@"CONNECTION_FAILED", 
                                     error.localizedDescription ?: @"Connection failed", 
                                     error);
        [self cleanupPendingConnection];
    }
    
    // Also send event to listeners
    if (self.hasListeners) {
        [self sendEventWithName:@"onError" body:@{
            @"code": @"CONNECTION_FAILED",
            @"message": error.localizedDescription ?: @"Connection failed",
            @"deviceName": peripheral.name ?: @"Unknown"
        }];
    }
}

@end

