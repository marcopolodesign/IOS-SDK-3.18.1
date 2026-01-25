//
//  QCCentralManager.m
//  QCBandSDKDemo
//
//  Created by steve on 2023/2/28.
//

#import "QCCentralManager.h"
#import <QCBandSDK/QCSDKManager.h>

static NSString *const QCLastConnectedIdentifier = @"QCLastConnectedIdentifier";
static NSInteger const QCBleDefaultTimeout = 15;
static NSInteger const QCBleDefaultConnectTimeout = 6;
@implementation QCBlePeripheral


@end

@interface QCCentralManager()<CBCentralManagerDelegate>

/*中心角色,app*/
@property (strong, nonatomic) CBCentralManager *centerManager;

@property (strong, nonatomic) NSMutableArray<QCBlePeripheral *> *peripherals;

@property (strong, nonatomic) CBPeripheral *connectedPeripheral;

@property (nonatomic,copy) void(^connectCompletedHandle)(BOOL);

@property (nonatomic,strong)NSTimer *reconTimer;

@property (assign,nonatomic)QCDeviceType deviceType;

@property (nonatomic,assign)QCState deviceState;

@property (nonatomic,assign)QCBluetoothState bleState;

@property (nonatomic,assign) NSInteger scanTimeout;

@property (nonatomic,assign) NSInteger connectTimeout;
@end

@implementation QCCentralManager

+ (instancetype)shared {
    static QCCentralManager * instance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        instance = [[QCCentralManager alloc] init];
    });
    return instance;
}

- (instancetype)init
{
    self = [super init];
    if (self) {
        NSDictionary *options = [NSDictionary dictionaryWithObjectsAndKeys:
                                 //蓝牙power没打开时alert提示框
                                 [NSNumber numberWithBool:YES],CBCentralManagerOptionShowPowerAlertKey,
                                 [NSNumber numberWithBool:YES],CBConnectPeripheralOptionNotifyOnConnectionKey,
                                 //重设centralManager恢复的IdentifierKey
                                 @"QCWXBluetoothRestore",CBCentralManagerOptionRestoreIdentifierKey,
                                 nil];
        
        _centerManager = [[CBCentralManager alloc] initWithDelegate:self queue:dispatch_get_main_queue() options:options];
        _peripherals = [[NSMutableArray alloc] init];
        _scanTimeout = QCBleDefaultTimeout;
        _connectTimeout = QCBleDefaultTimeout;
    }
    return self;
}

#pragma mark - Params
- (void)setScanTimeout:(NSInteger)scanTimeout {
    if(scanTimeout >= 0) {
        _scanTimeout = scanTimeout;
    }
    else {
        _scanTimeout = QCBleDefaultTimeout;
    }
}

- (void)setConnectTimeout:(NSInteger)connectTimeout {
    if(connectTimeout >= 0) {
        _connectTimeout = connectTimeout;
    }
    else {
        _connectTimeout = QCBleDefaultConnectTimeout;
    }
}

- (void)setDeviceState:(QCState)deviceState {
    _deviceState = deviceState;
    
    if(self.delegate && [self.delegate respondsToSelector:@selector(didState:)]) {
        [self.delegate didState:self.deviceState];
    }
}

#pragma mark - Public Fuction
- (void)scan; {
    [self scanWithTimeout:QCBleDefaultTimeout];
}

- (void)scanWithTimeout:(NSInteger)timeout {
    self.scanTimeout = timeout;
    NSLog(@"[Ring] scanWithTimeout: %ld", (long)timeout);
    
    [self stopScan];
    [self.peripherals removeAllObjects];
    
    NSArray <CBUUID*>*uuids = @[[CBUUID UUIDWithString:QCBANDSDKSERVERUUID1],[CBUUID UUIDWithString:QCBANDSDKSERVERUUID2]];
    NSArray *connectedP = [self retrieveConnectPeripheral:uuids];
    NSMutableArray * tempAray = [[NSMutableArray alloc] init];
    for (CBPeripheral *per in connectedP) {
        QCBlePeripheral *qcPer = [[QCBlePeripheral alloc] init];
        qcPer.peripheral = per;
        qcPer.mac = @"";//The paired device cannot read the mac from the system information, and can read the mac by sending instructions after the connection is successful
        qcPer.isPaired = YES;
        [tempAray addObject:qcPer];
    }
    
    [self.peripherals addObjectsFromArray:tempAray];
    
    if([connectedP count] > 0) {
        [self.peripherals sortedArrayUsingComparator:^NSComparisonResult(QCBlePeripheral *  _Nonnull obj1, QCBlePeripheral *  _Nonnull obj2) {
            return NSOrderedSame;
        }];
        if(self.delegate && [self.delegate respondsToSelector:@selector(didScanPeripherals:)]) {
            [self.delegate didScanPeripherals:self.peripherals];
        }
    }
    
    NSDictionary *option = @{CBCentralManagerScanOptionAllowDuplicatesKey : [NSNumber numberWithBool:NO]};
    [_centerManager scanForPeripheralsWithServices:nil options:option];
    
    [self stopTimer];
    self.reconTimer = [NSTimer scheduledTimerWithTimeInterval:self.scanTimeout target:self selector:@selector(stopScanFinishTimer:) userInfo:nil repeats:NO];
    [[NSRunLoop currentRunLoop]addTimer:self.reconTimer forMode: NSRunLoopCommonModes];
}

- (void)stopScan {
    NSLog(@"[Ring] stopScan called");
    if (!_centerManager) {
        return;
    }
    [_centerManager stopScan];
}

- (void)connect:(CBPeripheral *)peripheral {    
    [self connect:peripheral deviceType:QCDeviceTypeRing];
}

- (void)connect:(CBPeripheral *)peripheral deviceType:(QCDeviceType)deviceType {
    [self connect:peripheral timeout:QCBleDefaultConnectTimeout deviceType:deviceType];
}

- (void)connect:(CBPeripheral *)peripheral timeout:(NSInteger)timeout {
    [self connect:peripheral timeout:timeout deviceType:QCDeviceTypeRing];
}

- (void)connect:(CBPeripheral *)peripheral timeout:(NSInteger)timeout deviceType:(QCDeviceType)deviceType {
    
    self.connectTimeout = timeout;
    
    self.deviceType = deviceType;
    
    self.connectedPeripheral = peripheral;
    
    NSLog(@"[Ring] connect requested: %@ (%@), timeout: %ld, deviceType: %ld", peripheral.name, peripheral.identifier.UUIDString, (long)timeout, (long)deviceType);
    
    [self stopTimer];
    
    // Check if peripheral is already connected at BLE level
    if (peripheral.state == CBPeripheralStateConnected) {
        NSLog(@"[Ring] Peripheral already connected at BLE level, adding to SDK directly");
        [self centralManager:self.centerManager didConnectPeripheral:peripheral];
        return;
    }
    
    // Connect once - don't use a repeating timer!
    // The timer is only for timeout detection
    [self connectCurrentPeripheral];
    
    // Set a NON-REPEATING timeout timer (NOT repeats:YES!)
    self.reconTimer = [NSTimer scheduledTimerWithTimeInterval:self.connectTimeout target:self selector:@selector(stopConnectFinishTimer:) userInfo:nil repeats:NO];
    [[NSRunLoop currentRunLoop] addTimer:self.reconTimer forMode:NSRunLoopCommonModes];
}

- (void)connectCurrentPeripheral {
    
    CBPeripheral *lastPer = [self lastPeripheral];
    NSLog(@"[Ring] connectCurrentPeripheral -> %@ (%@)", lastPer.name, lastPer.identifier.UUIDString);
    NSDictionary * options = [NSMutableDictionary new];
    [options setValue:@(YES) forKey:CBConnectPeripheralOptionNotifyOnDisconnectionKey];
    if (@available(iOS 13.0, *)) {
        [options setValue:@(YES) forKey:CBConnectPeripheralOptionEnableTransportBridgingKey];
        if (self.deviceType != QCDeviceTypeRing) {
            // Be sure to use the following method to initialize, otherwise the ansc agent will not be executed and the App will not be able to monitor the accurate status of ancs.
            [options setValue:@(YES) forKey:CBConnectPeripheralOptionRequiresANCS];
        }
    }
    
    [_centerManager connectPeripheral:lastPer options:options];
}

- (void)remove {
    NSLog(@"[Ring] remove (unbind) invoked");
    
    [self stopTimer];
    if (self.connectedPeripheral) {
        @try {
            [_centerManager cancelPeripheralConnection:self.connectedPeripheral];
        } @catch (NSException *e) {
            NSLog(@"warn: 取消设备(%@)连接时出现异常", self.connectedPeripheral.name);
        }
    }
    
    [[QCSDKManager shareInstance] removeAllPeripheral];
    [[NSUserDefaults standardUserDefaults] removeObjectForKey:QCLastConnectedIdentifier];
    [[NSUserDefaults standardUserDefaults] synchronize];
    
    self.deviceState = QCStateDisconnecting;
}


- (void)startToReconnect{
    NSLog(@"[Ring] startToReconnect");
    
    // Stop any existing timer first
    [self stopTimer];
    
    if (self.bleState != QCBluetoothStatePoweredOn) {
        NSLog(@"[Ring] Cannot reconnect - Bluetooth not powered on");
        if(self.delegate && [self.delegate respondsToSelector:@selector(didFailConnected:error:)]) {
            [self.delegate didFailConnected:self.connectedPeripheral error:[NSError errorWithDomain:@"Bluetooth powered off" code:-1 userInfo:@{@"message":@"Bluetooth powered off"}]];
        }
        return;
    }
    
    CBPeripheral *lastPer = [self lastPeripheral];
    if(lastPer) {
        NSLog(@"[Ring] Attempting to reconnect to: %@ (%@), current BLE state: %ld", lastPer.name, lastPer.identifier.UUIDString, (long)lastPer.state);
        
        // Check the peripheral's actual BLE state
        if (lastPer.state == CBPeripheralStateConnected) {
            NSLog(@"[Ring] Peripheral already connected at BLE level (state=connected), adding to SDK...");
            
            // Already connected at BLE level - just add to SDK
            [[QCSDKManager shareInstance] removePeripheral:lastPer];
            [[QCSDKManager shareInstance] addPeripheral:lastPer finished:^(BOOL success) {
                if (success) {
                    NSLog(@"[Ring] Successfully added already-connected peripheral to SDK");
                    [[NSUserDefaults standardUserDefaults] setValue:lastPer.identifier.UUIDString forKey:QCLastConnectedIdentifier];
                    [[NSUserDefaults standardUserDefaults] synchronize];
                    self.deviceState = QCStateConnected;
                } else {
                    NSLog(@"[Ring] Failed to add peripheral to SDK, trying fresh connection...");
                    // Disconnect and reconnect fresh
                    [self.centerManager cancelPeripheralConnection:lastPer];
                    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(0.5 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
                        [self connect:lastPer];
                    });
                }
            }];
        } else if (lastPer.state == CBPeripheralStateConnecting) {
            NSLog(@"[Ring] Peripheral already connecting, waiting...");
            // Already trying to connect, just wait
        } else {
            // Disconnected - try to connect
            NSLog(@"[Ring] Peripheral disconnected, initiating connection...");
            [self connect:lastPer];
        }
    }
    else {
        NSLog(@"[Ring] Cannot reconnect - no saved peripheral found. UUID from UserDefaults may not match any currently known peripheral.");
        NSLog(@"[Ring] This can happen if the app was restarted and the peripheral hasn't been discovered yet.");
        NSLog(@"[Ring] The user may need to scan for devices first, or ensure the ring is nearby and advertising.");
        
        if(self.delegate && [self.delegate respondsToSelector:@selector(didFailConnected:error:)]) {
            [self.delegate didFailConnected:self.connectedPeripheral error:[NSError errorWithDomain:@"CBPeripheral not exist" code:-1 userInfo:@{@"message":@"Device not found. Please ensure the ring is nearby and try scanning for devices."}]];
        }
    }
}

- (CBPeripheral*)lastPeripheral {
    
    if(self.connectedPeripheral) {
        NSLog(@"[Ring] Using existing connectedPeripheral: %@", self.connectedPeripheral.name);
        return self.connectedPeripheral;
    }
    
    NSString *uuidStr = [[NSUserDefaults standardUserDefaults] objectForKey:QCLastConnectedIdentifier];
    
    if(uuidStr && uuidStr.length > 0) {
        NSLog(@"[Ring] Looking for peripheral with UUID: %@", uuidStr);
        
        // First, check if the peripheral is already connected at system level (most reliable)
        NSArray <CBUUID*>*uuids = @[[CBUUID UUIDWithString:QCBANDSDKSERVERUUID1],[CBUUID UUIDWithString:QCBANDSDKSERVERUUID2]];
        NSArray *connectedPeripherals = [self retrieveConnectPeripheral:uuids];
        
        NSLog(@"[Ring] Found %lu connected peripherals at system level", (unsigned long)connectedPeripherals.count);
        
        // Try to find the matching peripheral by UUID
        NSUUID *targetUUID = [[NSUUID alloc] initWithUUIDString:uuidStr];
        for (CBPeripheral *peripheral in connectedPeripherals) {
            if ([peripheral.identifier isEqual:targetUUID]) {
                NSLog(@"[Ring] Found matching connected peripheral: %@ (%@) - already connected at iOS level", peripheral.name, peripheral.identifier.UUIDString);
                // Update connectedPeripheral so we know it's already connected
                self.connectedPeripheral = peripheral;
                return peripheral;
            }
        }
        
        // If not already connected, try to retrieve by identifier (may not work across app sessions)
        CBPeripheral *peripheral = [self periperalWithUUID:uuidStr];
        if (peripheral) {
            NSLog(@"[Ring] Retrieved peripheral from cache: %@ (%@)", peripheral.name, peripheral.identifier.UUIDString);
            return peripheral;
        }
        
        // If retrievePeripheralsWithIdentifiers failed, the device might need to be scanned first
        NSLog(@"[Ring] Warning: Could not retrieve peripheral with UUID %@", uuidStr);
        NSLog(@"[Ring] This usually means the device hasn't been discovered yet in this session.");
        NSLog(@"[Ring] The user may need to scan for devices first, or ensure the ring is nearby and advertising.");
    }
    
    return nil;
}

- (BOOL)isBindDevice {
    NSString *uuidStr = [[NSUserDefaults standardUserDefaults] objectForKey:QCLastConnectedIdentifier];
    if(uuidStr && uuidStr.length > 0) {
        return YES;
    }
    return NO;
}

# pragma mark - CBCentralManagerDelegate
- (void)centralManagerDidUpdateState:(CBCentralManager *)central {
    NSLog(@"[Ring] centralManagerDidUpdateState: %ld", (long)[central state]);
    QCBluetoothState bleState = QCBluetoothStateUnkown;
    
    switch([central state]) {
        case CBManagerStateUnknown:
            bleState = QCBluetoothStateUnkown;
            break;
        case CBManagerStateResetting:
            bleState = QCBluetoothStateResetting;
            break;
        case CBManagerStateUnsupported:
            bleState = QCBluetoothStateUnsupported;
            break;
        case CBManagerStatePoweredOff:
            bleState = QCBluetoothStatePoweredOff;
            break;
        case CBManagerStatePoweredOn:
            bleState = QCBluetoothStatePoweredOn;
            break;
        default:break;
    }
    
    self.bleState = bleState;
    
    if (self.delegate && [self.delegate respondsToSelector:@selector(didBluetoothState:)]) {
        [self.delegate didBluetoothState:bleState];
    }
    
    // Update device state based on binding status
    if([self isBindDevice]) {
        // Device is bound - set to disconnected (not connecting)
        // Let JS layer initiate reconnection when appropriate
        if (self.deviceState != QCStateConnected) {
            self.deviceState = QCStateDisconnected;
        }
    }
    else {
        self.deviceState = QCStateUnbind;
    }
    
    // DON'T automatically reconnect on Bluetooth power on
    // Let the JS layer decide when to reconnect
    NSLog(@"[Ring] Bluetooth state updated, device state: %@", [self connectionStateToStringInternal:self.deviceState]);
}

- (NSString *)connectionStateToStringInternal:(QCState)state {
    switch (state) {
        case QCStateUnkown: return @"unknown";
        case QCStateUnbind: return @"unbind";
        case QCStateConnecting: return @"connecting";
        case QCStateConnected: return @"connected";
        case QCStateDisconnecting: return @"disconnecting";
        case QCStateDisconnected: return @"disconnected";
        default: return @"unknown";
    }
}

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary<NSString *,id> *)advertisementData RSSI:(NSNumber *)RSSI {
    NSLog(@"[Ring] didDiscoverPeripheral: %@ (%@) RSSI:%@", peripheral.name, peripheral.identifier.UUIDString, RSSI);
    
//    if(![peripheral.name.lowercaseString hasPrefix:@"o_"]) {
//        return;
//    }
    if(peripheral.name.length == 0) return;
    NSString *mac = [self macFromAdvertisementData:advertisementData];

    NSLog(@"Devices found:%@,mac:%@,id:%@",peripheral.name,mac,peripheral.identifier.UUIDString);
    BOOL isExist = false;
    for (QCBlePeripheral *per in self.peripherals) {
        if([per.peripheral.identifier.UUIDString isEqual:peripheral.identifier.UUIDString]) {
            per.peripheral = peripheral;
            per.mac = mac;
            per.advertisementData = advertisementData;
            per.RSSI = RSSI;
            isExist = true;
            return;
        }
    }
    
    if(!isExist) {
        QCBlePeripheral *per = [[QCBlePeripheral alloc] init];
        per.peripheral = peripheral;
        per.mac = mac;
        per.advertisementData = advertisementData;
        per.RSSI = RSSI;
        [self.peripherals addObject:per];
    }
    
    //Signal strength sorting
    [self.peripherals sortUsingComparator:^NSComparisonResult(QCBlePeripheral *obj1, QCBlePeripheral *obj2) {
        NSNumber *rssi1 = obj1.RSSI ?: @(-100);
        NSNumber *rssi2 = obj2.RSSI ?: @(-100);
        return [rssi2 compare:rssi1]; // 从大到小
    }];
    
    if(self.delegate && [self.delegate respondsToSelector:@selector(didScanPeripherals:)]) {
        [self.delegate didScanPeripherals:self.peripherals];
    }
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral {
    NSLog(@"[Ring] didConnectPeripheral: %@ (%@)", peripheral.name, peripheral.identifier.UUIDString);
    
    // IMMEDIATELY stop the timer to prevent any further connection attempts
    [self stopTimer];
    
    // Update our reference to the connected peripheral
    self.connectedPeripheral = peripheral;
    
    // Remove any stale reference and add fresh
    [[QCSDKManager shareInstance] removePeripheral:peripheral];
    [[QCSDKManager shareInstance] addPeripheral:peripheral finished:^(BOOL success) {
        if (success) {
            NSLog(@"[Ring] Add peripheral to SDK successfully");
            [[NSUserDefaults standardUserDefaults] setValue:peripheral.identifier.UUIDString forKey:QCLastConnectedIdentifier];
            [[NSUserDefaults standardUserDefaults] synchronize];
            
            self.deviceState = QCStateConnected;
        }
        else {
            NSLog(@"[Ring] Failed to add peripheral to SDK");
            if(self.delegate && [self.delegate respondsToSelector:@selector(didFailConnected:error:)]) {
                [self.delegate didFailConnected:peripheral error:[NSError errorWithDomain:@"Connect fail" code:-1 userInfo:@{@"message":@"Failed to add peripheral to SDK"}]];
            }
        }
    }];
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(nullable NSError *)error {
    NSLog(@"[Ring] didDisconnectPeripheral: %@ (%@), error: %@", peripheral.name, peripheral.identifier.UUIDString, error);
    
    // Stop any pending timers
    [self stopTimer];
    
    // Clean up SDK state
    [[QCSDKManager shareInstance] removeAllPeripheral];
    
    if(self.deviceState == QCStateDisconnecting) {
        // User intentionally unbinding - don't reconnect
        NSLog(@"[Ring] User-initiated disconnect, setting state to Unbind");
        self.deviceState = QCStateUnbind;
    }
    else {
        // Unexpected disconnect - notify but don't automatically reconnect
        // Let the JS layer decide when to reconnect
        NSLog(@"[Ring] Unexpected disconnect, setting state to Disconnected");
        self.deviceState = QCStateDisconnected;
        
        // Notify delegate of the disconnection
        if (self.delegate && [self.delegate respondsToSelector:@selector(didFailConnected:error:)]) {
            NSError *disconnectError = error ?: [NSError errorWithDomain:@"Disconnect" code:-1 userInfo:@{@"message":@"Device disconnected"}];
            [self.delegate didFailConnected:peripheral error:disconnectError];
        }
        
        // DON'T automatically reconnect here - this causes loops
        // The JS layer will call autoReconnect if/when appropriate
    }
}

- (void)centralManager:(CBCentralManager *)central willRestoreState:(NSDictionary *)dict {
    NSLog(@"[Ring] willRestoreState, peripherals: %lu", (unsigned long)[dict[CBCentralManagerRestoredStatePeripheralsKey] count]);
    NSArray *peripherals = dict[CBCentralManagerRestoredStatePeripheralsKey];
    if (peripherals.count > 0) {
        //恢复重连上一次连接的设备
        NSString *uuidStr = [[NSUserDefaults standardUserDefaults] objectForKey:QCLastConnectedIdentifier];
        if (uuidStr.length > 0) {
            for (CBPeripheral* pr in peripherals) {
                if ([uuidStr isEqualToString:pr.identifier.UUIDString]) {
                    self.connectedPeripheral = pr;
                }
            }
        }
    }
}

#pragma mark - Helpers
- (NSArray *)retrieveConnectPeripheral:(NSArray<CBUUID *> *)uuidArray
{
    NSArray *connectedDevice = [_centerManager retrieveConnectedPeripheralsWithServices:uuidArray];
    NSMutableArray *connectedPeripheral = [NSMutableArray arrayWithCapacity:connectedDevice.count];
    [connectedDevice enumerateObjectsUsingBlock:^(id  _Nonnull obj, NSUInteger idx, BOOL * _Nonnull stop) {
        if (![obj isKindOfClass:[CBPeripheral class]]) {
            return;
        }
        [connectedPeripheral addObject:obj];
    }];
    
    return [connectedPeripheral copy];
}

- (CBPeripheral *)periperalWithUUID:(NSString *)uuid {
    
    if (!uuid) {
        return nil;
    }
    
    NSArray *periperals = nil;
    NSUUID *UUID = [[NSUUID alloc] initWithUUIDString:uuid];
    if(!UUID){
        NSLog(@"NSUUID(%@)合法，但无法创建UUID，原因不明", uuid);
        return nil;
    }
    periperals = [_centerManager retrievePeripheralsWithIdentifiers:@[UUID]];
    if (periperals.count > 0) {
        return [periperals objectAtIndex:0];
    } else {
        return nil;
    }
}

- (NSString *)macFromAdvertisementData:(NSDictionary *)advertisementData {
    NSString *mac = @"";
    NSData *manufacturerData = [advertisementData objectForKey:@"kCBAdvDataManufacturerData"];
    mac = [self macFromData:manufacturerData];
    
    if (mac.length == 0) {
        NSDictionary *serviceData = [advertisementData objectForKey:@"kCBAdvDataServiceData"];
        if ([serviceData isKindOfClass:[NSDictionary class]]) {
            NSArray *allValues = [serviceData allValues];
            if (allValues.count > 0) {
                for (NSData *dataValue in allValues) {
                    if ([dataValue isKindOfClass:[NSData class]]) {
                        mac = [self macFromData:dataValue];
                    }
                }
            }
        }
    }
    return mac;
}

- (NSString*)macFromData:(NSData*)macData {
    NSString *mac = @"";
    if ([macData isKindOfClass:[NSData class]] && macData.length > 0) {
        NSData *data = macData;
        if (data.length >= 10) {
            data = [data subdataWithRange:NSMakeRange(4, 6)];
            Byte *bytes = (Byte *)data.bytes;
            mac = [NSString stringWithFormat:@"%02x:%02x:%02x:%02x:%02x:%02x",
                        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]];
        } else if (data.length == 8) {
            data = [data subdataWithRange:NSMakeRange(2, 6)];
            Byte *bytes = (Byte *)data.bytes;
            mac = [NSString stringWithFormat:@"%02x:%02x:%02x:%02x:%02x:%02x",
                        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]];
        } else if (data.length == 6) {
           data = [data subdataWithRange:NSMakeRange(0, 6)];
           Byte *bytes = (Byte *)data.bytes;
           mac = [NSString stringWithFormat:@"%02x:%02x:%02x:%02x:%02x:%02x",
                       bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]];
       }
    }
    
    return mac;
}

- (void)stopTimer
{
    NSLog(@"[Ring] stopTimer");
    if ([self.reconTimer isValid]) {
        [self.reconTimer invalidate];
        self.reconTimer = nil;
    }
}

- (void)stopConnectFinishTimer:(NSTimer *)timer {
    NSLog(@"[Ring] connect timeout fired");
    if(self.delegate && [self.delegate respondsToSelector:@selector(didFailConnected:error:)]) {
        [self.delegate didFailConnected:self.connectedPeripheral error:[NSError errorWithDomain:@"timeout" code:-1 userInfo:@{@"message":@"connect timeout"}]];
    }
}

- (void)stopScanFinishTimer:(NSTimer *)timer
{
    NSLog(@"[Ring] scan timeout fired");
    [self stopScan];
}
@end

