//
//  SmartRingBridge.m
//  SmartRing
//
//  Native bridge implementation for CRPSmartBand SDK
//  Based on official OC-SDKDemo
//

#import "SmartRingBridge.h"
#import <React/RCTLog.h>
#import <CoreLocation/CoreLocation.h>

// Import SDK using module import (Swift framework)
@import CRPSmartBand;

@interface SmartRingBridge () <CRPManagerDelegate>

@property (nonatomic, strong) NSMutableArray<CRPDiscovery *> *discoveredDevices;
@property (nonatomic, strong) CRPDiscovery *currentDiscovery;
@property (nonatomic, assign) BOOL hasListeners;
@property (nonatomic, assign) enum CRPBluetoothState currentBluetoothState;
@property (nonatomic, assign) enum CRPState currentState;
// Store connection promise to resolve when actually connected
@property (nonatomic, copy) RCTPromiseResolveBlock connectionResolve;
@property (nonatomic, copy) RCTPromiseRejectBlock connectionReject;

@end

@implementation SmartRingBridge

RCT_EXPORT_MODULE();

- (instancetype)init {
    self = [super init];
    if (self) {
        _discoveredDevices = [NSMutableArray array];
        _currentBluetoothState = CRPBluetoothStateUnknown;
        _currentState = CRPStateDisconnected;
        
        // Set delegate on init
        CRPSmartBandSDK.sharedInstance.delegate = self;
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
        @"onSleepData",
        @"onSleepDataReceived",
        @"onBloodPressureData",
        @"onBloodPressureReceived",
        @"onSpO2Data",
        @"onSpO2Received",
        @"onHRVData",
        @"onStressData",
        @"onTemperatureData",
        @"onBatteryData",
        @"onBatteryReceived",
        @"onSyncProgress",
        @"onUpgradeProgress",
        @"onError",
        @"onDebugLog"
    ];
}

// Helper to send debug logs to both Xcode and Expo console
- (void)debugLog:(NSString *)message {
    RCTLogInfo(@"SmartRingBridge: %@", message);
    if (self.hasListeners) {
        [self sendEventWithName:@"onDebugLog" body:@{@"message": message, @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)}];
    }
}

- (void)startObserving {
    _hasListeners = YES;
}

- (void)stopObserving {
    _hasListeners = NO;
}

#pragma mark - Initialize SDK

RCT_EXPORT_METHOD(initialize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"SmartRingBridge: Initializing SDK");
    
    dispatch_async(dispatch_get_main_queue(), ^{
        CRPSmartBandSDK.sharedInstance.delegate = self;
        RCTLogInfo(@"SmartRingBridge: SDK initialized successfully");
        resolve(@{@"success": @YES, @"message": @"SDK initialized"});
    });
}

#pragma mark - Bluetooth State

RCT_EXPORT_METHOD(getBluetoothState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *stateString = [self bluetoothStateToString:self.currentBluetoothState];
    resolve(@{@"state": stateString});
}

- (NSString *)bluetoothStateToString:(enum CRPBluetoothState)state {
    switch (state) {
        case CRPBluetoothStateUnknown:
            return @"unknown";
        case CRPBluetoothStateResetting:
            return @"resetting";
        case CRPBluetoothStateUnsupported:
            return @"unsupported";
        case CRPBluetoothStateUnauthorized:
            return @"unauthorized";
        case CRPBluetoothStatePoweredOff:
            return @"poweredOff";
        case CRPBluetoothStatePoweredOn:
            return @"poweredOn";
        default:
            return @"unknown";
    }
}

- (NSString *)connectionStateToString:(enum CRPState)state {
    switch (state) {
        case CRPStateDisconnected:
            return @"disconnected";
        case CRPStateConnecting:
            return @"connecting";
        case CRPStateConnected:
            return @"connected";
        default:
            return @"disconnected";
    }
}

#pragma mark - Scanning

// Helper method to check if a device is a supported ring or smart band
- (BOOL)isRingOrBandDevice:(NSString *)deviceName mac:(NSString *)mac {
    // Empty or nil name - reject
    if (!deviceName || deviceName.length == 0) {
        return NO;
    }
    
    // Only match specific devices:
    // 1. R10_... (FOCUS R1 ring)
    // 2. SmartBand
    
    if ([deviceName hasPrefix:@"R10_"]) {
        [self debugLog:[NSString stringWithFormat:@"✅ Found FOCUS R1 ring: %@", deviceName]];
        return YES;
    }
    
    if ([deviceName containsString:@"SmartBand"] || [deviceName containsString:@"smartband"] || [deviceName containsString:@"Smartband"]) {
        [self debugLog:[NSString stringWithFormat:@"✅ Found SmartBand: %@", deviceName]];
        return YES;
    }
    
    // Reject everything else
    return NO;
}

// Transform device name for display
- (NSString *)displayNameForDevice:(NSString *)deviceName {
    // R10_... becomes "FOCUS R1"
    if (deviceName && [deviceName hasPrefix:@"R10_"]) {
        return @"FOCUS R1";
    }
    
    // SmartBand stays as is
    if (deviceName && deviceName.length > 0) {
        return deviceName;
    }
    
    // This should never be shown due to filter, but just in case
    return nil;
}

RCT_EXPORT_METHOD(scan:(double)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    // Ensure delegate is set every time
    CRPSmartBandSDK.sharedInstance.delegate = self;
    NSLog(@"🚨🚨🚨 SCAN STARTED - delegate = %@ 🚨🚨🚨", CRPSmartBandSDK.sharedInstance.delegate == self ? @"SELF ✓" : @"NOT SELF ❌");
    [self debugLog:[NSString stringWithFormat:@"🔍 Starting device scan for %.0f seconds", duration]];
    
    // First check current connection status from SDK
    CRPDiscovery *currentDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
    if (currentDevice) {
        [self debugLog:[NSString stringWithFormat:@"📱 SDK reports connected device: %@ (MAC: %@)", currentDevice.localName ?: @"(no name)", currentDevice.mac ?: @"(no mac)"]];
        [self debugLog:[NSString stringWithFormat:@"📱 Current connection state: %@", [self connectionStateToString:self.currentState]]];
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self.discoveredDevices removeAllObjects];
        
        // If SDK has a current device with a valid name (R10_ or SmartBand), add it even if not found in scan
        // This handles the case where the ring is connected via iOS Bluetooth settings
        if (currentDevice && currentDevice.localName && [self isRingOrBandDevice:currentDevice.localName mac:currentDevice.mac]) {
            // Generate a unique ID if MAC is empty
            NSString *deviceId = currentDevice.mac;
            if (!deviceId || deviceId.length == 0) {
                deviceId = [NSString stringWithFormat:@"sdk_%@", currentDevice.localName];
            }
            
            [self debugLog:[NSString stringWithFormat:@"📱 Adding SDK's current device to scan results: %@ (ID: %@)", 
                          [self displayNameForDevice:currentDevice.localName], deviceId]];
            
            // Store the discovery for later connection
            [self.discoveredDevices addObject:currentDevice];
            
            if (self.hasListeners) {
                NSDictionary *deviceInfo = @{
                    @"id": deviceId,
                    @"mac": deviceId,  // Use ID as MAC since real MAC might be empty
                    @"name": [self displayNameForDevice:currentDevice.localName],
                    @"rssi": @(currentDevice.RSSI),
                    @"isSystemPaired": @YES  // Flag to indicate this is from iOS Bluetooth
                };
                [self sendEventWithName:@"onDeviceFound" body:deviceInfo];
                [self sendEventWithName:@"onDeviceDiscovered" body:deviceInfo];
            }
        }
        
        NSTimeInterval scanDuration = duration > 0 ? duration : 10;
        
        [[CRPSmartBandSDK sharedInstance] scan:scanDuration progressHandler:^(NSArray<CRPDiscovery *> * _Nonnull discoveries) {
            // Called as devices are found during scan
            for (CRPDiscovery *discovery in discoveries) {
                // Filter: Only add rings and bands, not TVs or other devices
                BOOL isValidDevice = [self isRingOrBandDevice:discovery.localName mac:discovery.mac];
                
                if (!isValidDevice) {
                    [self debugLog:[NSString stringWithFormat:@"⏭️ Skipping non-ring device: %@ (MAC: %@)", discovery.localName ?: @"Unknown", discovery.mac]];
                    continue;
                }
                
                BOOL exists = NO;
                for (CRPDiscovery *existing in self.discoveredDevices) {
                    // Check by MAC if both have valid MACs
                    if (existing.mac.length > 0 && discovery.mac.length > 0 && [existing.mac isEqualToString:discovery.mac]) {
                        exists = YES;
                        break;
                    }
                    // For R10_ rings, also check by name suffix (e.g., R10_AC04) to avoid duplicates
                    // when one entry has MAC and the other doesn't
                    if (existing.localName && discovery.localName) {
                        if ([existing.localName hasPrefix:@"R10_"] && [discovery.localName hasPrefix:@"R10_"]) {
                            // Both are rings - compare the suffix (last 4 chars)
                            NSString *existingSuffix = [existing.localName substringFromIndex:4];
                            NSString *discoverySuffix = [discovery.localName substringFromIndex:4];
                            if ([existingSuffix isEqualToString:discoverySuffix]) {
                                exists = YES;
                                // If this one has a valid MAC and existing doesn't, replace it
                                if (discovery.mac.length > 0 && existing.mac.length == 0) {
                                    [self.discoveredDevices removeObject:existing];
                                    exists = NO;  // Allow adding this one as replacement
                                    [self debugLog:[NSString stringWithFormat:@"📱 Replacing SDK cached device with scanned device (has MAC)"]];
                                }
                                break;
                            }
                        }
                    }
                }
                
                if (!exists) {
                    [self.discoveredDevices addObject:discovery];
                    [self debugLog:[NSString stringWithFormat:@"📡 Found ring/band: %@ (MAC: %@, RSSI: %ld)", discovery.localName, discovery.mac, (long)discovery.RSSI]];
                    
                    if (self.hasListeners) {
                        NSDictionary *deviceInfo = @{
                            @"id": discovery.mac ?: @"",
                            @"mac": discovery.mac ?: @"",
                            @"name": [self displayNameForDevice:discovery.localName],
                            @"rssi": @(discovery.RSSI)
                        };
                        [self sendEventWithName:@"onDeviceFound" body:deviceInfo];
                        [self sendEventWithName:@"onDeviceDiscovered" body:deviceInfo];
                    }
                }
            }
        } completionHandler:^(NSArray<CRPDiscovery *> * _Nullable discoveries, enum CRPError error) {
            [self debugLog:[NSString stringWithFormat:@"✅ Scan completed: %lu ring/band devices found (filtered), error code: %ld", 
                      (unsigned long)self.discoveredDevices.count, (long)error]];
            
            NSMutableArray *deviceList = [NSMutableArray array];
            for (CRPDiscovery *discovery in self.discoveredDevices) {
                // Generate a unique ID if MAC is empty
                NSString *deviceId = discovery.mac;
                if (!deviceId || deviceId.length == 0) {
                    deviceId = [NSString stringWithFormat:@"sdk_%@", discovery.localName ?: @"unknown"];
                }
                
                [deviceList addObject:@{
                    @"id": deviceId,
                    @"mac": deviceId,
                    @"name": [self displayNameForDevice:discovery.localName],
                    @"rssi": @(discovery.RSSI)
                }];
            }
            
            resolve(deviceList);
        }];
    });
}

// Unfiltered scan for debugging - shows ALL Bluetooth devices
RCT_EXPORT_METHOD(scanAll:(double)duration
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:[NSString stringWithFormat:@"🔍 Starting UNFILTERED scan for %.0f seconds (debug mode)", duration]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        NSMutableArray *allDevices = [NSMutableArray array];
        
        NSTimeInterval scanDuration = duration > 0 ? duration : 10;
        
        [[CRPSmartBandSDK sharedInstance] scan:scanDuration progressHandler:^(NSArray<CRPDiscovery *> * _Nonnull discoveries) {
            for (CRPDiscovery *discovery in discoveries) {
                BOOL exists = NO;
                for (NSDictionary *existing in allDevices) {
                    if ([existing[@"mac"] isEqualToString:discovery.mac]) {
                        exists = YES;
                        break;
                    }
                }
                
                if (!exists) {
                    [self debugLog:[NSString stringWithFormat:@"📡 [ALL] Device: %@ (MAC: %@, RSSI: %ld)", 
                                  discovery.localName ?: @"Unknown", discovery.mac, (long)discovery.RSSI]];
                    [allDevices addObject:@{
                        @"id": discovery.mac ?: @"",
                        @"mac": discovery.mac ?: @"",
                        @"name": [self displayNameForDevice:discovery.localName],
                        @"rssi": @(discovery.RSSI),
                        @"isRingOrBand": @([self isRingOrBandDevice:discovery.localName mac:discovery.mac])
                    }];
                }
            }
        } completionHandler:^(NSArray<CRPDiscovery *> * _Nullable discoveries, enum CRPError error) {
            [self debugLog:[NSString stringWithFormat:@"✅ Unfiltered scan completed: %lu total devices", (unsigned long)allDevices.count]];
            resolve(allDevices);
        }];
    });
}

RCT_EXPORT_METHOD(stopScan:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"Stopping device scan"];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] interruptScan];
        resolve(@{@"success": @YES, @"message": @"Scan stopped"});
    });
}

RCT_EXPORT_METHOD(getDiscoveredDevices:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSMutableArray *devices = [NSMutableArray array];
    
    for (CRPDiscovery *discovery in self.discoveredDevices) {
        [devices addObject:@{
            @"id": discovery.mac ?: @"",
            @"mac": discovery.mac ?: @"",
            @"name": [self displayNameForDevice:discovery.localName],
            @"rssi": @(discovery.RSSI)
        }];
    }
    
    resolve(devices);
}

#pragma mark - Connection

RCT_EXPORT_METHOD(connect:(NSString *)mac
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"====== CONNECTION ATTEMPT ======"];
    [self debugLog:[NSString stringWithFormat:@"Target MAC: %@", mac]];
    [self debugLog:[NSString stringWithFormat:@"Current state: %@ (%ld)", [self connectionStateToString:self.currentState], (long)self.currentState]];
    [self debugLog:[NSString stringWithFormat:@"Bluetooth state: %@", [self bluetoothStateToString:self.currentBluetoothState]]];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Check if already connected
        CRPDiscovery *currentDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
        if (currentDevice) {
            [self debugLog:[NSString stringWithFormat:@"📱 SDK has a current device: %@ (MAC: %@)", currentDevice.localName, currentDevice.mac]];
            [self debugLog:[NSString stringWithFormat:@"📱 Comparing with target: %@", mac]];
            BOOL sameDevice = [currentDevice.mac isEqualToString:mac];
            [self debugLog:[NSString stringWithFormat:@"📱 Is same device: %@", sameDevice ? @"YES" : @"NO"]];
        } else {
            [self debugLog:@"📱 SDK has NO current device"];
        }
        
        // Check SDK manager state
        CRPManager *manager = [CRPSmartBandSDK sharedInstance].manager;
        if (manager) {
            [self debugLog:[NSString stringWithFormat:@"📱 SDK Manager exists, state: %ld", (long)manager.state]];
        } else {
            [self debugLog:@"⚠️ SDK Manager is nil!"];
        }
        
        // If already connected to this device, just resolve
        if (self.currentState == CRPStateConnected && currentDevice && [currentDevice.mac isEqualToString:mac]) {
            [self debugLog:@"✅ Already connected to this device!"];
            resolve(@{@"success": @YES, @"message": @"Already connected"});
            return;
        }
        
        // If connected to a different device, disconnect first
        if (self.currentState == CRPStateConnected) {
            [self debugLog:@"⚠️ Already connected to different device, disconnecting first..."];
            [[CRPSmartBandSDK sharedInstance] disConnet];
        }
        
        CRPDiscovery *targetDiscovery = nil;
        
        [self debugLog:[NSString stringWithFormat:@"🔍 Searching for device ID %@ in %lu discovered devices", mac, (unsigned long)self.discoveredDevices.count]];
        
        // First try to match by MAC
        for (CRPDiscovery *discovery in self.discoveredDevices) {
            NSString *discoveryId = discovery.mac;
            if (!discoveryId || discoveryId.length == 0) {
                discoveryId = [NSString stringWithFormat:@"sdk_%@", discovery.localName ?: @"unknown"];
            }
            
            [self debugLog:[NSString stringWithFormat:@"   - Checking: %@ (ID: %@)", discovery.localName, discoveryId]];
            
            if ([discoveryId isEqualToString:mac]) {
                targetDiscovery = discovery;
                [self debugLog:@"   ✓ Match found by ID!"];
                break;
            }
        }
        
        // If not found and this looks like an SDK-generated ID, try the SDK's current device
        if (!targetDiscovery && [mac hasPrefix:@"sdk_"]) {
            CRPDiscovery *sdkDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
            if (sdkDevice) {
                NSString *sdkId = [NSString stringWithFormat:@"sdk_%@", sdkDevice.localName ?: @"unknown"];
                if ([sdkId isEqualToString:mac]) {
                    targetDiscovery = sdkDevice;
                    [self debugLog:@"   ✓ Using SDK's current device!"];
                }
            }
        }
        
        if (!targetDiscovery) {
            [self debugLog:[NSString stringWithFormat:@"❌ Device %@ not found in discovered list", mac]];
            reject(@"DEVICE_NOT_FOUND", @"Device not found in discovered list", nil);
            return;
        }
        
        [self debugLog:[NSString stringWithFormat:@"🔄 Found device: %@ (MAC: %@)", targetDiscovery.localName, targetDiscovery.mac]];
        [self debugLog:@"🔄 Initiating connection..."];
        
        // #region agent log - Hypothesis B: Check CRPDiscovery object properties
        NSString *logPath = @"/Users/mataldao/Downloads/7203d09b5b0c4f3e7a47d6c24ff44fae/IOS-SDK-3.18.1/.cursor/debug.log";
        NSString *logEntry1 = [NSString stringWithFormat:@"{\"hypothesisId\":\"B\",\"location\":\"SmartRingBridge.m:connect\",\"message\":\"CRPDiscovery details\",\"data\":{\"localName\":\"%@\",\"mac\":\"%@\",\"rssi\":%ld},\"timestamp\":%lld}\n",
            targetDiscovery.localName ?: @"nil",
            targetDiscovery.mac ?: @"nil",
            (long)targetDiscovery.RSSI,
            (long long)([[NSDate date] timeIntervalSince1970] * 1000)];
        NSFileHandle *fh1 = [NSFileHandle fileHandleForWritingAtPath:logPath];
        if (!fh1) { [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil]; fh1 = [NSFileHandle fileHandleForWritingAtPath:logPath]; }
        [fh1 seekToEndOfFile]; [fh1 writeData:[logEntry1 dataUsingEncoding:NSUTF8StringEncoding]]; [fh1 closeFile];
        // #endregion
        
        // #region agent log - Hypothesis A: Check if SDK reports existing connection
        CRPDiscovery *existingDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
        CRPState sdkState = [CRPSmartBandSDK sharedInstance].manager.state;
        NSString *logEntry2 = [NSString stringWithFormat:@"{\"hypothesisId\":\"A\",\"location\":\"SmartRingBridge.m:connect\",\"message\":\"SDK state before connect\",\"data\":{\"existingDeviceName\":\"%@\",\"existingDeviceMac\":\"%@\",\"sdkManagerState\":%ld,\"ourTrackedState\":%ld},\"timestamp\":%lld}\n",
            existingDevice.localName ?: @"nil",
            existingDevice.mac ?: @"nil",
            (long)sdkState,
            (long)self.currentState,
            (long long)([[NSDate date] timeIntervalSince1970] * 1000)];
        fh1 = [NSFileHandle fileHandleForWritingAtPath:logPath];
        [fh1 seekToEndOfFile]; [fh1 writeData:[logEntry2 dataUsingEncoding:NSUTF8StringEncoding]]; [fh1 closeFile];
        // #endregion
        
        self.currentDiscovery = targetDiscovery;
        self.connectionResolve = resolve;
        self.connectionReject = reject;
        
        // Check if this is a cached device (from iOS Bluetooth) - use reConnet for those
        CRPDiscovery *cachedDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
        BOOL isCachedDevice = NO;
        if (cachedDevice && cachedDevice.localName && targetDiscovery.localName) {
            // Check if names match (for R10_ devices, compare suffix)
            if ([cachedDevice.localName hasPrefix:@"R10_"] && [targetDiscovery.localName hasPrefix:@"R10_"]) {
                NSString *cachedSuffix = [cachedDevice.localName substringFromIndex:4];
                NSString *targetSuffix = [targetDiscovery.localName substringFromIndex:4];
                isCachedDevice = [cachedSuffix isEqualToString:targetSuffix];
            } else {
                isCachedDevice = [cachedDevice.localName isEqualToString:targetDiscovery.localName];
            }
        }
        
        if (isCachedDevice) {
            // Use reConnet for cached devices (already known to SDK from iOS Bluetooth)
            NSLog(@"🚨🚨🚨 CALLING reConnet() 🚨🚨🚨");
            RCTLogInfo(@"🚨🚨🚨 CALLING reConnet() 🚨🚨🚨");
            [self debugLog:@"📡 Using reConnet (device is already cached/paired via iOS Bluetooth)"];
            [[CRPSmartBandSDK sharedInstance] reConnet];
            NSLog(@"🚨🚨🚨 reConnet() CALLED - waiting for didState delegate 🚨🚨🚨");
        } else {
            // Use connet for new devices (note: method is spelled "connet" in SDK)
            NSLog(@"🚨🚨🚨 CALLING connet: with device %@ 🚨🚨🚨", targetDiscovery.localName);
            RCTLogInfo(@"🚨🚨🚨 CALLING connet: with device %@ 🚨🚨🚨", targetDiscovery.localName);
            [self debugLog:@"📡 Using connet (new device connection)"];
            [[CRPSmartBandSDK sharedInstance] connet:targetDiscovery];
            NSLog(@"🚨🚨🚨 connet: CALLED - waiting for didState delegate 🚨🚨🚨");
        }
        
        [self debugLog:@"📡 Connection command sent to SDK, waiting for callback (60s timeout)..."];
        
        // #region agent log - Hypothesis C: Log immediately after connet call
        CRPState stateAfterConnect = [CRPSmartBandSDK sharedInstance].manager.state;
        NSString *logEntry3 = [NSString stringWithFormat:@"{\"hypothesisId\":\"C\",\"location\":\"SmartRingBridge.m:connect\",\"message\":\"State immediately after connet call\",\"data\":{\"stateAfterConnect\":%ld},\"timestamp\":%lld}\n",
            (long)stateAfterConnect,
            (long long)([[NSDate date] timeIntervalSince1970] * 1000)];
        fh1 = [NSFileHandle fileHandleForWritingAtPath:logPath];
        [fh1 seekToEndOfFile]; [fh1 writeData:[logEntry3 dataUsingEncoding:NSUTF8StringEncoding]]; [fh1 closeFile];
        // #endregion
        
        // Start polling to detect connection in case delegate doesn't fire
        [self startConnectionPollingForMAC:mac];
        
        // Set a timeout for connection (60 seconds)
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(60 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            if (self.connectionResolve && self.currentState != CRPStateConnected) {
                [self debugLog:@"⏰ Connection timeout after 60 seconds"];
                [self debugLog:[NSString stringWithFormat:@"Final state: %@ (%ld)", [self connectionStateToString:self.currentState], (long)self.currentState]];
                if (self.connectionReject) {
                    NSDictionary *errorInfo = @{
                        @"code": @"CONNECTION_TIMEOUT",
                        @"message": @"Connection timed out after 60 seconds",
                        @"suggestion": @"Try tapping the ring to wake it up, then tap Retry",
                        @"canRetry": @YES
                    };
                    self.connectionReject(@"CONNECTION_TIMEOUT", @"Connection timed out. Tap the ring to wake it, then try again.", nil);
                    
                    // Also send an error event for UI to handle
                    if (self.hasListeners) {
                        [self sendEventWithName:@"onError" body:errorInfo];
                    }
                }
                self.connectionResolve = nil;
                self.connectionReject = nil;
            }
        });
    });
}

// Polling mechanism to detect connection when delegate doesn't fire
- (void)startConnectionPollingForMAC:(NSString *)targetMAC {
    __block int pollCount = 0;
    const int maxPolls = 30; // Poll for up to 30 seconds (every 1 second)
    
    dispatch_source_t timer = dispatch_source_create(DISPATCH_SOURCE_TYPE_TIMER, 0, 0, dispatch_get_main_queue());
    dispatch_source_set_timer(timer, dispatch_time(DISPATCH_TIME_NOW, 1 * NSEC_PER_SEC), 1 * NSEC_PER_SEC, 0.1 * NSEC_PER_SEC);
    
    dispatch_source_set_event_handler(timer, ^{
        pollCount++;
        
        // Check if we already resolved
        if (!self.connectionResolve) {
            [self debugLog:@"🔍 Polling stopped - connection already resolved"];
            dispatch_source_cancel(timer);
            return;
        }
        
        // Check SDK's current device
        CRPDiscovery *currentDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
        CRPState managerState = [CRPSmartBandSDK sharedInstance].manager.state;
        
        [self debugLog:[NSString stringWithFormat:@"🔍 Poll #%d - Manager state: %ld, Current device: %@", 
                       pollCount, (long)managerState, currentDevice.mac ?: @"none"]];
        
        // ONLY trust manager state == Connected (code 2), not just any state
        // Do NOT match on empty MAC addresses - that's a false positive
        if (managerState == CRPStateConnected) {
            [self debugLog:@"✅ Polling detected CONNECTED state (2) from SDK manager!"];
            
            // Update our state
            self.currentState = CRPStateConnected;
            
            if (self.connectionResolve) {
                self.connectionResolve(@{@"success": @YES, @"message": @"Connected"});
                self.connectionResolve = nil;
                self.connectionReject = nil;
            }
            
            // Send connection event
            if (self.hasListeners) {
                [self sendEventWithName:@"onConnectionStateChanged" body:@{
                    @"state": @"connected",
                    @"deviceId": currentDevice.mac ?: targetMAC,
                    @"deviceName": [self displayNameForDevice:currentDevice.localName]
                }];
            }
            
            dispatch_source_cancel(timer);
            return;
        }
        
        // Stop polling after max attempts
        if (pollCount >= maxPolls) {
            [self debugLog:[NSString stringWithFormat:@"🔍 Polling stopped - max attempts reached, manager state was: %ld", (long)managerState]];
            dispatch_source_cancel(timer);
        }
    });
    
    dispatch_resume(timer);
}

RCT_EXPORT_METHOD(disconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"SmartRingBridge: Disconnecting");
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] disConnet];
        resolve(@{@"success": @YES, @"message": @"Disconnect initiated"});
    });
}

RCT_EXPORT_METHOD(getConnectionState:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    NSString *state = [self connectionStateToString:self.currentState];
    resolve(@{@"state": state});
}

RCT_EXPORT_METHOD(isConnected:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    BOOL connected = self.currentState == CRPStateConnected;
    CRPDiscovery *currentDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
    
    [self debugLog:[NSString stringWithFormat:@"📊 isConnected check: %@", connected ? @"YES" : @"NO"]];
    if (currentDevice) {
        [self debugLog:[NSString stringWithFormat:@"📊 Connected device: %@ (MAC: %@)", currentDevice.localName, currentDevice.mac]];
    }
    
    resolve(@{
        @"connected": @(connected),
        @"state": [self connectionStateToString:self.currentState],
        @"deviceName": currentDevice.localName ?: [NSNull null],
        @"deviceMac": currentDevice.mac ?: [NSNull null]
    });
}

RCT_EXPORT_METHOD(getConnectedDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    CRPDiscovery *currentDevice = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
    
    if (currentDevice && self.currentState == CRPStateConnected) {
        [self debugLog:[NSString stringWithFormat:@"📱 getConnectedDevice: %@ (MAC: %@)", [self displayNameForDevice:currentDevice.localName], currentDevice.mac]];
        resolve(@{
            @"connected": @YES,
            @"device": @{
                @"id": currentDevice.mac ?: @"",
                @"mac": currentDevice.mac ?: @"",
                @"name": [self displayNameForDevice:currentDevice.localName],
                @"rssi": @(currentDevice.RSSI)
            }
        });
    } else if (currentDevice) {
        // SDK has a device reference but not fully connected
        [self debugLog:[NSString stringWithFormat:@"📱 getConnectedDevice: Device exists but state is %@", [self connectionStateToString:self.currentState]]];
        resolve(@{
            @"connected": @NO,
            @"state": [self connectionStateToString:self.currentState],
            @"device": @{
                @"id": currentDevice.mac ?: @"",
                @"mac": currentDevice.mac ?: @"",
                @"name": [self displayNameForDevice:currentDevice.localName],
                @"rssi": @(currentDevice.RSSI)
            },
            @"message": @"Device found but not fully connected. Try reconnecting."
        });
    } else {
        [self debugLog:@"📱 getConnectedDevice: No device connected"];
        resolve(@{
            @"connected": @NO,
            @"device": [NSNull null]
        });
    }
}

// Clear any stale connection and prepare for fresh connection
RCT_EXPORT_METHOD(resetConnection:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    [self debugLog:@"🔄 Resetting connection state..."];
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Disconnect any existing connection
        [[CRPSmartBandSDK sharedInstance] disConnet];
        
        // Clear our state
        self.connectionResolve = nil;
        self.connectionReject = nil;
        self.currentDiscovery = nil;
        self.currentState = CRPStateDisconnected;
        
        [self debugLog:@"✅ Connection reset complete. Ready for fresh scan and connect."];
        resolve(@{@"success": @YES, @"message": @"Connection reset. Scan for devices again."});
    });
}

RCT_EXPORT_METHOD(reconnect:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"SmartRingBridge: Attempting reconnect");
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] reConnet];
        resolve(@{@"success": @YES, @"message": @"Reconnect initiated"});
    });
}

#pragma mark - Data Retrieval (using SDK completion handlers like official demo)

RCT_EXPORT_METHOD(getSteps:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getSteps:^(StepModel * _Nonnull model, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Steps: %ld, Cal: %ld, Distance: %ld", 
                          (long)model.steps, (long)model.calory, (long)model.distance);
                resolve(@{
                    @"steps": @(model.steps),
                    @"distance": @(model.distance),
                    @"calories": @(model.calory),
                    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
                });
            } else {
                RCTLogError(@"SmartRingBridge: Failed to get steps, error: %ld", (long)err);
                reject(@"GET_STEPS_FAILED", @"Failed to get steps data", nil);
            }
        }];
    });
}

RCT_EXPORT_METHOD(getBattery:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getBattery:^(NSInteger bat, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Battery: %ld%%", (long)bat);
                resolve(@{
                    @"battery": @(bat),
                    @"level": @(bat),
                    @"isCharging": @NO
                });
            } else {
                RCTLogError(@"SmartRingBridge: Failed to get battery, error: %ld", (long)err);
                reject(@"GET_BATTERY_FAILED", @"Failed to get battery", nil);
            }
        }];
    });
}

RCT_EXPORT_METHOD(getVersion:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getSoftver:^(NSString * _Nonnull ver, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Version: %@", ver);
                resolve(@{@"version": ver ?: @"unknown"});
            } else {
                RCTLogError(@"SmartRingBridge: Failed to get version, error: %ld", (long)err);
                resolve(@{@"version": @"unknown"});
            }
        }];
    });
}

RCT_EXPORT_METHOD(getSleepData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getSleepData:^(SleepModel * _Nonnull model, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Sleep - Deep: %ldmin, Light: %ldmin", 
                          (long)model.deep, (long)model.light);
                resolve(@{
                    @"deep": @(model.deep),
                    @"light": @(model.light),
                    @"duration": @(model.deep + model.light),
                    @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
                });
            } else {
                RCTLogError(@"SmartRingBridge: Failed to get sleep data, error: %ld", (long)err);
                reject(@"GET_SLEEP_FAILED", @"Failed to get sleep data", nil);
            }
        }];
    });
}

RCT_EXPORT_METHOD(getProfile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getProfile:^(ProfileModel * _Nonnull profile, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Profile - Age: %ld", (long)profile.age);
                resolve(@{
                    @"age": @(profile.age),
                    @"gender": @"unknown",
                    @"height": @(0),
                    @"weight": @(0)
                });
            } else {
                resolve(@{
                    @"age": @(25),
                    @"gender": @"male",
                    @"height": @(175),
                    @"weight": @(70)
                });
            }
        }];
    });
}

RCT_EXPORT_METHOD(getGoal:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getGoal:^(NSInteger goal, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: Goal: %ld", (long)goal);
                resolve(@{@"goal": @(goal)});
            } else {
                resolve(@{@"goal": @(10000)});
            }
        }];
    });
}

RCT_EXPORT_METHOD(getMac:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getMac:^(NSString * _Nonnull mac, enum CRPError err) {
            if (err == CRPErrorNone) {
                RCTLogInfo(@"SmartRingBridge: MAC: %@", mac);
                resolve(@{@"mac": mac ?: @""});
            } else {
                resolve(@{@"mac": @""});
            }
        }];
    });
}

RCT_EXPORT_METHOD(getSportData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getSportData:^(NSArray<SportModel *> * _Nonnull sports, enum CRPError err) {
            if (err == CRPErrorNone) {
                NSMutableArray *sportList = [NSMutableArray array];
                for (SportModel *model in sports) {
                    [sportList addObject:@{
                        @"type": @(model.type),
                        @"step": @(model.step),
                        @"distance": @(model.distance),
                        @"calories": @(model.kcal),
                        @"startTime": @(model.startTime),
                        @"endTime": @(model.endTime)
                    }];
                }
                resolve(sportList);
            } else {
                resolve(@[]);
            }
        }];
    });
}

RCT_EXPORT_METHOD(getAllData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] getAllData:^(NSArray<StepModel *> * _Nonnull stepModels, NSArray<SleepModel *> * _Nonnull sleepModels, enum CRPError err) {
            NSMutableArray *steps = [NSMutableArray array];
            NSMutableArray *sleeps = [NSMutableArray array];
            
            for (StepModel *model in stepModels) {
                [steps addObject:@{
                    @"steps": @(model.steps),
                    @"distance": @(model.distance),
                    @"calories": @(model.calory)
                }];
            }
            
            for (SleepModel *model in sleepModels) {
                [sleeps addObject:@{
                    @"deep": @(model.deep),
                    @"light": @(model.light)
                }];
            }
            
            resolve(@{@"steps": steps, @"sleep": sleeps});
        }];
    });
}

RCT_EXPORT_METHOD(get24HourHeartRate:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        // Return empty array - heart rate data comes via delegate
        resolve(@[]);
    });
}

RCT_EXPORT_METHOD(get24HourSteps:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        resolve(@[]);
    });
}

#pragma mark - Settings

RCT_EXPORT_METHOD(setGoal:(double)goal
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"SmartRingBridge: Set goal to %.0f", goal);
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(setProfile:(NSDictionary *)profile
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    RCTLogInfo(@"SmartRingBridge: Set profile");
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(setTimeFormat:(BOOL)is24Hour
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(setUnit:(BOOL)isMetric
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{@"success": @YES});
}

#pragma mark - Device Actions

RCT_EXPORT_METHOD(findDevice:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance].manager sendFindBand];
        resolve(@{@"success": @YES, @"message": @"Find device command sent"});
    });
}

#pragma mark - Monitoring

RCT_EXPORT_METHOD(startHeartRateMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance].manager sendStartHeart];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(stopHeartRateMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance].manager sendStopHeart];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(startSpO2Monitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    if (self.currentState != CRPStateConnected) {
        reject(@"NOT_CONNECTED", @"No device connected", nil);
        return;
    }
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] setStartSpO2];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(stopSpO2Monitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    dispatch_async(dispatch_get_main_queue(), ^{
        [[CRPSmartBandSDK sharedInstance] setStopSpO2];
        resolve(@{@"success": @YES});
    });
}

RCT_EXPORT_METHOD(startBloodPressureMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{@"success": @YES});
}

RCT_EXPORT_METHOD(stopBloodPressureMonitoring:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    resolve(@{@"success": @YES});
}

#pragma mark - CRPManagerDelegate

- (void)didState:(enum CRPState)state {
    // CRITICAL: These logs MUST appear in Xcode console
    NSLog(@"🚨🚨🚨 SmartRingBridge didState CALLED! state = %ld 🚨🚨🚨", (long)state);
    RCTLogInfo(@"🚨🚨🚨 SmartRingBridge didState CALLED! state = %ld 🚨🚨🚨", (long)state);
    [self debugLog:[NSString stringWithFormat:@"🔔 Connection state changed: %@ (code: %ld)", [self connectionStateToString:state], (long)state]];
    
    // #region agent log - Hypothesis C: Log all state changes with full context
    NSString *logPath = @"/Users/mataldao/Downloads/7203d09b5b0c4f3e7a47d6c24ff44fae/IOS-SDK-3.18.1/.cursor/debug.log";
    CRPDiscovery *currentDev = [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
    NSString *logEntry = [NSString stringWithFormat:@"{\"hypothesisId\":\"C\",\"location\":\"SmartRingBridge.m:didState\",\"message\":\"State change delegate fired\",\"data\":{\"newState\":%ld,\"previousState\":%ld,\"currentDeviceName\":\"%@\",\"hasConnectionPromise\":%@},\"timestamp\":%lld}\n",
        (long)state,
        (long)self.currentState,
        currentDev.localName ?: @"nil",
        self.connectionResolve ? @"true" : @"false",
        (long long)([[NSDate date] timeIntervalSince1970] * 1000)];
    NSFileHandle *fh = [NSFileHandle fileHandleForWritingAtPath:logPath];
    if (!fh) { [[NSFileManager defaultManager] createFileAtPath:logPath contents:nil attributes:nil]; fh = [NSFileHandle fileHandleForWritingAtPath:logPath]; }
    [fh seekToEndOfFile]; [fh writeData:[logEntry dataUsingEncoding:NSUTF8StringEncoding]]; [fh closeFile];
    // #endregion
    
    enum CRPState previousState = self.currentState;
    [self debugLog:[NSString stringWithFormat:@"   Previous state: %@ → New state: %@", [self connectionStateToString:previousState], [self connectionStateToString:state]]];
    self.currentState = state;
    
    // Handle connection promise resolution
    if (state == CRPStateConnected && self.connectionResolve) {
        [self debugLog:@"✅ Device connected successfully!"];
        self.connectionResolve(@{@"success": @YES, @"message": @"Connected"});
        self.connectionResolve = nil;
        self.connectionReject = nil;
    } else if (state == CRPStateDisconnected && previousState == CRPStateConnecting && self.connectionReject) {
        // Only reject if we were actively connecting (not if already disconnected)
        [self debugLog:@"❌ Connection failed - state went from Connecting to Disconnected"];
        [self debugLog:@"❌ This usually means the ring didn't respond. Try: 1) Tap ring to wake, 2) Hold close to phone, 3) Disconnect from other apps"];
        self.connectionReject(@"CONNECTION_FAILED", @"Failed to connect. Tap the ring to wake it up and try again.", nil);
        self.connectionResolve = nil;
        self.connectionReject = nil;
    } else if (state == CRPStateConnecting) {
        [self debugLog:@"🔄 Connecting to device..."];
    } else if (state == CRPStateDisconnected) {
        [self debugLog:@"📵 Device disconnected"];
    }
    
    if (self.hasListeners) {
        CRPDiscovery *currentDevice = self.currentDiscovery ?: [CRPSmartBandSDK sharedInstance].currentCRPDiscovery;
        [self sendEventWithName:@"onConnectionStateChanged" body:@{
            @"state": [self connectionStateToString:state],
            @"deviceId": currentDevice.mac ?: @"",
            @"deviceName": currentDevice.localName ?: @"Smart Ring"
        }];
    }
}

- (void)didBluetoothState:(enum CRPBluetoothState)state {
    RCTLogInfo(@"SmartRingBridge: Bluetooth state changed: %ld", (long)state);
    self.currentBluetoothState = state;
    
    if (self.hasListeners) {
        [self sendEventWithName:@"onBluetoothStateChanged" body:@{
            @"state": [self bluetoothStateToString:state]
        }];
    }
}

- (void)receiveSteps:(StepModel *)model {
    RCTLogInfo(@"SmartRingBridge: Steps received - Steps: %ld, Calories: %ld", (long)model.steps, (long)model.calory);
    
    if (self.hasListeners) {
        NSDictionary *data = @{
            @"steps": @(model.steps),
            @"distance": @(model.distance),
            @"calories": @(model.calory),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        };
        [self sendEventWithName:@"onStepsData" body:data];
        [self sendEventWithName:@"onStepsReceived" body:data];
    }
}

- (void)receiveHeartRate:(NSInteger)heartRate {
    RCTLogInfo(@"SmartRingBridge: Heart rate received: %ld", (long)heartRate);
    
    if (self.hasListeners) {
        NSDictionary *data = @{
            @"heartRate": @(heartRate),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
            @"isResting": @NO
        };
        [self sendEventWithName:@"onHeartRateData" body:data];
        [self sendEventWithName:@"onHeartRateReceived" body:data];
    }
}

- (void)receiveHeartRateAll:(HeartModel *)model {
    RCTLogInfo(@"SmartRingBridge: Heart rate history received");
}

- (void)receiveBloodPressure:(NSInteger)heartRate :(NSInteger)sbp :(NSInteger)dbp {
    RCTLogInfo(@"SmartRingBridge: Blood pressure - HR: %ld, SBP: %ld, DBP: %ld", (long)heartRate, (long)sbp, (long)dbp);
    
    if (self.hasListeners) {
        NSDictionary *data = @{
            @"systolic": @(sbp),
            @"diastolic": @(dbp),
            @"heartRate": @(heartRate),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        };
        [self sendEventWithName:@"onBloodPressureData" body:data];
        [self sendEventWithName:@"onBloodPressureReceived" body:data];
    }
}

- (void)receiveSpO2:(NSInteger)o2 {
    RCTLogInfo(@"SmartRingBridge: SpO2 received: %ld", (long)o2);
    
    if (self.hasListeners) {
        NSDictionary *data = @{
            @"spo2": @(o2),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000)
        };
        [self sendEventWithName:@"onSpO2Data" body:data];
        [self sendEventWithName:@"onSpO2Received" body:data];
    }
}

- (void)receiveRealTimeHeartRate:(NSInteger)heartRate :(NSInteger)rri {
    RCTLogInfo(@"SmartRingBridge: Real-time heart rate: %ld", (long)heartRate);
    
    if (self.hasListeners) {
        [self sendEventWithName:@"onHeartRateData" body:@{
            @"heartRate": @(heartRate),
            @"rri": @(rri),
            @"timestamp": @([[NSDate date] timeIntervalSince1970] * 1000),
            @"isRealTime": @YES
        }];
    }
}

- (void)receiveUpgrede:(enum CRPUpgradeState)state :(NSInteger)progress {
    RCTLogInfo(@"SmartRingBridge: Upgrade progress: %ld%%", (long)progress);
    
    if (self.hasListeners) {
        [self sendEventWithName:@"onSyncProgress" body:@{
            @"progress": @(progress),
            @"state": @(state)
        }];
    }
}

- (void)receiveUpgradeScreen:(enum CRPUpgradeState)state :(NSInteger)progress {
    RCTLogInfo(@"SmartRingBridge: Screen upgrade progress: %ld%%", (long)progress);
}

- (void)recevieTakePhoto {
    RCTLogInfo(@"SmartRingBridge: Take photo request received");
}

- (void)recevieWeather {
    RCTLogInfo(@"SmartRingBridge: Weather request received");
}

- (void)recevieFindPhone:(NSInteger)state {
    RCTLogInfo(@"SmartRingBridge: Find phone request received");
}

- (void)receiveECGDate:(enum ecgState)state :(NSArray<NSNumber *> *)data completeTime:(NSInteger)completeTime {
    RCTLogInfo(@"SmartRingBridge: ECG data received");
}

- (void)receiveCalling {
    RCTLogInfo(@"SmartRingBridge: Calling notification received");
}

- (void)receviceHRVRealTime:(CRPHRVDataModel *)model {
    RCTLogInfo(@"SmartRingBridge: Real-time HRV received");
}

- (void)receivePhoneNumberWithNumber:(NSString *)number {
    RCTLogInfo(@"SmartRingBridge: Phone number received: %@", number);
}

- (void)receiveMedicineInfo:(NSInteger)max :(CRPMedicineReminderModel *)model {
    RCTLogInfo(@"SmartRingBridge: Medicine info received");
}

- (void)receiveSportList:(NSArray<CRPSportRecord *> *)list {
    RCTLogInfo(@"SmartRingBridge: Sport list received: %lu records", (unsigned long)list.count);
}

- (void)receiveSportState:(enum SportType)state :(NSInteger)err {
    RCTLogInfo(@"SmartRingBridge: Sport state received: %ld, err: %ld", (long)state, (long)err);
}

- (void)receiveConnectConfirm:(enum CRPPairState)state {
    RCTLogInfo(@"SmartRingBridge: Connect confirm received: %ld", (long)state);
}

- (void)receiveGPSDataRecordListWithTime:(NSArray<NSNumber *> *)time {
    RCTLogInfo(@"SmartRingBridge: GPS data record list received");
}

- (void)receiveGPSRealTimeWithLocation:(CLLocationCoordinate2D)location {
    RCTLogInfo(@"SmartRingBridge: GPS location: lat=%f, lon=%f", location.latitude, location.longitude);
}

- (void)receiveGPSAuxiliaryRequest {
    RCTLogInfo(@"SmartRingBridge: GPS auxiliary request received");
}

- (void)receiveEPORequestWithType:(NSInteger)type {
    RCTLogInfo(@"SmartRingBridge: EPO request received");
}

- (void)receiveEPOSync:(enum CRPUpgradeState)state :(NSInteger)progress {
    RCTLogInfo(@"SmartRingBridge: EPO sync progress: %ld%%", (long)progress);
}

- (void)receiveRealTimeSportDataWithData:(CRPNewSportingModel *)data {
    RCTLogInfo(@"SmartRingBridge: Real-time sport data received");
}

- (void)receiveExitCameraView {
    RCTLogInfo(@"SmartRingBridge: Exit camera view received");
}

- (void)receiveAddDrinkWaterRecordWithRecord:(CRPNewDrinkWaterRecord *)record {
    RCTLogInfo(@"SmartRingBridge: Drink water record received");
}

- (void)receiveModifyDrinkWaterRecordWithSource:(enum CRPDrinkWaterSource)source record:(CRPNewDrinkWaterRecord *)record {
    RCTLogInfo(@"SmartRingBridge: Modify drink water record received");
}

- (void)receiveDeleteDrinkWaterRecordWithSource:(enum CRPDrinkWaterSource)source recordID:(NSInteger)recordID {
    RCTLogInfo(@"SmartRingBridge: Delete drink water record received");
}

- (void)receiveRequestAppDrinkWaterRecord {
    RCTLogInfo(@"SmartRingBridge: Request app drink water record received");
}

- (void)receiveStockRequestUpdateInfo {
    RCTLogInfo(@"SmartRingBridge: Stock request update info received");
}

- (void)receiveGPTStateWithType:(enum CRPGPTType)type state:(enum CRPGPTRequestState)state result:(NSData *)result {
    RCTLogInfo(@"SmartRingBridge: GPT state received");
}

- (void)receiveRequestGPTAnswer {
    RCTLogInfo(@"SmartRingBridge: Request GPT answer received");
}

- (void)receiveRequestGPTPreviewImageWithImageSize:(CGSize)imageSize {
    RCTLogInfo(@"SmartRingBridge: Request GPT preview image received");
}

- (void)receiveRequestGPTImage {
    RCTLogInfo(@"SmartRingBridge: Request GPT image received");
}

@end
