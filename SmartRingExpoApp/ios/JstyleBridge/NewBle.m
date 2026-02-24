//
//  NewBle.m
//  NewBle
//
//  Adapted from Jstyle SDK demo for Smart Ring app.
//  Removed demo-only dependencies (writeLogs, UserDefaults shortcuts).
//  Defined BLE service/characteristic UUIDs for X3 protocol.
//

#import "NewBle.h"

// X3 BLE Protocol UUIDs
#define SERVICE    @"FFF0"
#define SEND_CHAR  @"FFF6"
#define REC_CHAR   @"FFF7"

// No-op replacement for demo's file-based logging
static inline void writeLogs(NSString *msg, NSString *file) {
    NSLog(@"[BLE] %@", msg);
}

#define UserDefaults [NSUserDefaults standardUserDefaults]

@interface NewBle()<CBCentralManagerDelegate,CBPeripheralDelegate>
{

}
@end
@implementation NewBle
@synthesize CentralManage,PeripheralManager,activityPeripheral;
+(NewBle *)sharedManager
{
    static NewBle *sharedAccountManagerInstance = nil;
    static dispatch_once_t predicate;
    dispatch_once(&predicate, ^{
        sharedAccountManagerInstance = [[self alloc] init];
    });
    return sharedAccountManagerInstance;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        // Auto-initialize the central manager so it's ready for scanning
        CentralManage = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
    }
    return self;
}

- (void)SetUpCentralManager
{
    if (!CentralManage) {
        CentralManage = [[CBCentralManager alloc] initWithDelegate:self queue:nil];
    }
}

- (void)SetUpPeripheralManager
{

}

-(BOOL)isConnectOrConnecting
{
   if(activityPeripheral.state==CBPeripheralStateConnected||activityPeripheral.state==CBPeripheralStateConnecting)
        return YES;
    else
        return NO;
}

-(BOOL)isActivityPeripheral
{
   if(activityPeripheral.state==CBPeripheralStateConnected)
        return YES;
    else
        return NO;
}

- (void)startScanningWithServices:(nullable NSArray<CBUUID *> *)serviceUUIDs
{
    CentralManage.delegate = self;
    [CentralManage scanForPeripheralsWithServices:serviceUUIDs options:@{CBCentralManagerScanOptionAllowDuplicatesKey:@YES}];
}

- (void)connectDevice:(CBPeripheral*)peripheral
{
    // Use connection options for better stability
    NSDictionary *options = @{
        CBConnectPeripheralOptionNotifyOnDisconnectionKey: @YES,
    };

    // Enable transport bridging on iOS 13+
    if (@available(iOS 13.0, *)) {
        NSMutableDictionary *mutableOptions = [options mutableCopy];
        mutableOptions[CBConnectPeripheralOptionEnableTransportBridgingKey] = @YES;
        options = mutableOptions;
    }

    if (CentralManage.isScanning==YES)
        [self Stopscan];
      activityPeripheral = peripheral;
      activityPeripheral.delegate = self;
      peripheral.delegate = self;
     [CentralManage connectPeripheral:peripheral options:options];
}

#pragma mark - Retrieve connected peripherals
- (NSArray *)retrieveConnectedPeripheralsWithServices:(NSArray<CBUUID *> *)serviceUUIDs
{
    NSArray * arrayConnectPeripheral = [CentralManage retrieveConnectedPeripheralsWithServices:serviceUUIDs];
      return arrayConnectPeripheral;
}

#pragma mark - Float conversion
-(void)Float_to_Byte:(float)f byte:(Byte*)byte location:(int)location
{
    memcpy(byte+location, &f, 4);
}

#pragma mark - Data send/receive
static void (^BLE_Block_Receive)(Byte* _Nullable buf,int length);

- (void)SendData:(char*)b length:(int)length
{
    int sam = 0;
    for (int j = 0; j < length; j++)
    {
        sam += b[j];
    }
    b[15] = sam;
    NSMutableData *data = [[NSMutableData alloc] initWithBytes:b length:length];
    [self writeValue:SERVICE characteristicUUID:SEND_CHAR p:activityPeripheral data:data];
}

-(void)writeValueUI:(NSString*)serviceUUID characteristicUUID:(NSString*)characteristicUUID p:(CBPeripheral *)p data:(NSData *)data
{
    NSString * strData = @"";
    Byte * byte = (Byte*) data.bytes;
    for (int i = 0 ; i< data.length; i++) {
        strData = [strData stringByAppendingString:[NSString stringWithFormat:@"%02x ",byte[i]]];
    }
    strData = [@"Send:" stringByAppendingString:[NSString stringWithFormat:@"(length:%d)-%@",(int)data.length,strData]];
    writeLogs(strData, @"Ble SDK Demo Log.txt");

    CBService * service  = [self FindServiceFromUUID:serviceUUID Peripheral:p];
    if(!service)
    {
        NSLog(@"Could not find service with UUID %@ on peripheral",serviceUUID);
        return;
    }
    CBCharacteristic * characteristic = [self findCharacteristicFromUUID:characteristicUUID service:service];
    if(!characteristic)
    {
        NSLog(@"Could not find characteristic with UUID %@ on service with UUID %@ on peripheral",serviceUUID,characteristicUUID);
        return;
    }
    [p writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithoutResponse];
}

-(void)writeValue:(NSString*)serviceUUID characteristicUUID:(NSString*)characteristicUUID p:(CBPeripheral *)p data:(NSData *)data
{
     NSString * strData = @"";
    Byte * byte = (Byte*) data.bytes;
    for (int i = 0 ; i< data.length; i++) {
        strData = [strData stringByAppendingString:[NSString stringWithFormat:@"%02x ",byte[i]]];
    }

     strData = [@"Send:" stringByAppendingString:[NSString stringWithFormat:@"(length:%d)-%@",(int)data.length,strData]];
     writeLogs(strData, @"Ble SDK Demo.txt");

    CBService * service  = [self FindServiceFromUUID:serviceUUID Peripheral:p];
    if(!service)
    {
        NSLog(@"Could not find service with UUID %@ on peripheral",serviceUUID);
        return;
    }
    CBCharacteristic * characteristic = [self findCharacteristicFromUUID:characteristicUUID service:service];
    if(!characteristic)
    {
        NSLog(@"Could not find characteristic with UUID %@ on service with UUID %@ on peripheral",serviceUUID,characteristicUUID);
        return;
    }
    [p writeValue:data forCharacteristic:characteristic type:CBCharacteristicWriteWithResponse];
}

- (void)retrieveConnectedPeripheralsWithServices:(NSArray<CBUUID *> *)serviceUUIDs Block:(void (^)(NSArray* arrayConnectPeripheral,BOOL isSuccess))block
{
    NSArray * arrayConnectPeripheral = [CentralManage retrieveConnectedPeripheralsWithServices:serviceUUIDs];
    if(arrayConnectPeripheral.count>0)
        block(arrayConnectPeripheral,YES);
    else
        block(nil,NO);
}

-(void)Stopscan
{
    [CentralManage stopScan];
}
-(void)Disconnect
{
    if(activityPeripheral)
    [CentralManage cancelPeripheralConnection:activityPeripheral];
}

-(void)enable
{
    [self notification:SERVICE characteristicUUID:REC_CHAR p:activityPeripheral on:YES];
}

-(void)notification:(NSString*)serviceUUID characteristicUUID:(NSString*)characteristicUUID p:(CBPeripheral *)p on:(BOOL)on
{
   CBService * service  = [self FindServiceFromUUID:serviceUUID Peripheral:p];
    if(!service)
    {
        NSLog(@"Could not find service with UUID %@ on peripheral",serviceUUID);
        return;
    }
    CBCharacteristic * characteristic = [self findCharacteristicFromUUID:characteristicUUID service:service];
    if(!characteristic)
    {
        NSLog(@"Could not find characteristic with UUID %@ on service with UUID %@ on peripheral",serviceUUID,characteristicUUID);
        return;
    }
   [p setNotifyValue:on forCharacteristic:characteristic];
   if ([self.delegate respondsToSelector:@selector(EnableCommunicate)]) {
       [self.delegate EnableCommunicate];
   }
}

-(CBService*)FindServiceFromUUID:(NSString*)serviceUUID Peripheral:(CBPeripheral *)peripheral
{
    for (int i = 0; i<peripheral.services.count; i++) {
        CBService * service = [peripheral.services objectAtIndex:i];
        if([service.UUID.UUIDString.lowercaseString isEqualToString:serviceUUID.lowercaseString])
            return service;
    }
    return nil;
}

-(CBCharacteristic *) findCharacteristicFromUUID:(NSString *)UUID service:(CBService*)service {
    for(int i=0; i < service.characteristics.count; i++) {
        CBCharacteristic *c = [service.characteristics objectAtIndex:i];
        if([UUID.lowercaseString isEqualToString:c.UUID.UUIDString.lowercaseString])
            return c;
    }
    return nil;
}

#pragma mark - CBCentralManagerDelegate
-(NSString*)centralManagerStateToString:(NSInteger)state
{
    switch(state) {
        case CBManagerStateUnknown:
            return @"CBManagerStateUnknown";
        case CBManagerStateResetting:
            return @"CBManagerStateResetting";
        case CBManagerStateUnsupported:
            return @"CBManagerStateUnsupported";
        case CBManagerStateUnauthorized:
            return @"CBManagerStateUnauthorized";
        case CBManagerStatePoweredOff:
        {
            [UserDefaults setBool:NO forKey:@"blestatus"];
            [UserDefaults synchronize];
            [self.delegate Disconnect:nil];
            return @"CBCentralManagerStatePoweredOff";
        }
        case CBManagerStatePoweredOn:
        {
            [UserDefaults setBool:YES forKey:@"blestatus"];
            [UserDefaults synchronize];
            return @"CBCentralManagerStatePoweredOn";
        }
        default:
            return @"State unknown";
    }
    return @"Unknown state";
}

- (void)centralManagerDidUpdateState:(nonnull CBCentralManager *)central {
    NSLog(@"Status of CoreBluetooth central manager changed %@",[self centralManagerStateToString:central.state]);
}

- (void)centralManager:(CBCentralManager *)central willRestoreState:(NSDictionary<NSString *, id> *)dict
{

}

- (void)centralManager:(CBCentralManager *)central didDiscoverPeripheral:(CBPeripheral *)peripheral advertisementData:(NSDictionary<NSString *, id> *)advertisementData RSSI:(NSNumber *)RSSI
{
    [self.delegate scanWithPeripheral:peripheral advertisementData:advertisementData RSSI:RSSI];
}

- (void)centralManager:(CBCentralManager *)central didConnectPeripheral:(CBPeripheral *)peripheral
{
    [peripheral discoverServices:nil];
    [self.delegate ConnectSuccessfully];
}

- (void)centralManager:(CBCentralManager *)central didFailToConnectPeripheral:(CBPeripheral *)peripheral error:(nullable NSError *)error
{
    [self.delegate ConnectFailedWithError:error];
}

- (void)centralManager:(CBCentralManager *)central didDisconnectPeripheral:(CBPeripheral *)peripheral error:(nullable NSError *)error
{
    NSString * strError = [NSString stringWithFormat:@"Device %@ disconnected: %@",peripheral.name,error.description];
    writeLogs(strError, @"Ble SDK Demo.txt");
    if(error)
    {
        [central connectPeripheral:peripheral options:nil];
    }
     [self.delegate Disconnect:error];
}

#pragma mark - CBPeripheralDelegate
- (void)peripheralDidUpdateName:(CBPeripheral *)peripheral
{

}

- (void)peripheral:(CBPeripheral *)peripheral didModifyServices:(NSArray<CBService *> *)invalidatedServices
{

}

- (void)peripheral:(CBPeripheral *)peripheral didReadRSSI:(NSNumber *)RSSI error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverServices:(nullable NSError *)error
{
    for (int i=0; i < peripheral.services.count; i++) {
        CBService *s = [peripheral.services objectAtIndex:i];
        [peripheral discoverCharacteristics:nil forService:s];
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverIncludedServicesForService:(CBService *)service error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverCharacteristicsForService:(CBService *)service error:(nullable NSError *)error
{
    if([service isEqual:peripheral.services.lastObject])
        [self enable];
}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForCharacteristic:(CBCharacteristic *)characteristic error:(nullable NSError *)error
{
    NSString * strUUID = characteristic.UUID.UUIDString;
    if([strUUID.lowercaseString isEqualToString:[REC_CHAR lowercaseString]])
    {
        Byte *byte = (Byte *)[characteristic.value bytes];
        NSString * strData = @"";
        for (int i = 0 ; i< characteristic.value.length; i++) {
            strData = [strData stringByAppendingString:[NSString stringWithFormat:@"%02x ",byte[i]]];
        }
        strData = [@"Receive:" stringByAppendingString:[NSString stringWithFormat:@"(length:%d) %@",(int)characteristic.value.length,strData]];
        writeLogs(strData, @"Ble SDK Demo.txt");
        [self.delegate BleCommunicateWithPeripheral:peripheral data:characteristic.value];
    }
}

- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForCharacteristic:(CBCharacteristic *)characteristic error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateNotificationStateForCharacteristic:(CBCharacteristic *)characteristic error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didDiscoverDescriptorsForCharacteristic:(CBCharacteristic *)characteristic error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didUpdateValueForDescriptor:(CBDescriptor *)descriptor error:(nullable NSError *)error
{

}

- (void)peripheral:(CBPeripheral *)peripheral didWriteValueForDescriptor:(CBDescriptor *)descriptor error:(nullable NSError *)error
{

}

- (void)peripheralIsReadyToSendWriteWithoutResponse:(CBPeripheral *)peripheral
{

}

- (void)peripheral:(CBPeripheral *)peripheral didOpenL2CAPChannel:(nullable CBL2CAPChannel *)channel error:(nullable NSError *)error
API_AVAILABLE(ios(11.0)){

}

-(NSString *) utf8ToUnicode:(NSString *)string{
    NSUInteger length = [string length];
    NSMutableString *str = [NSMutableString stringWithCapacity:0];
    for (int i = 0;i < length; i++){
        NSMutableString *s = [NSMutableString stringWithCapacity:0];
        unichar _char = [string characterAtIndex:i];
        if (_char <= '9' && _char >='0'){
            [s appendFormat:@"%@",[string substringWithRange:NSMakeRange(i,1)]];
        }else if(_char >='a' && _char <= 'z'){
            [s appendFormat:@"%@",[string substringWithRange:NSMakeRange(i,1)]];
        }else if(_char >='A' && _char <= 'Z')
        {
            [s appendFormat:@"%@",[string substringWithRange:NSMakeRange(i,1)]];
        }else{
            [s appendFormat:@"\\u%x",[string characterAtIndex:i]];
            if(s.length == 4) {
                [s insertString:@"00" atIndex:2];
            } else if (s.length == 5) {
                [s insertString:@"0" atIndex:2];
            }
        }
        [str appendFormat:@"%@", s];
    }
    return str;
}

-(NSString *) getNSUTF8String: (NSString *) content{
    return [content stringByAddingPercentEncodingWithAllowedCharacters:[NSCharacterSet URLQueryAllowedCharacterSet]];
}

- (void) SetWeatherWithWeather:(int)weatherType CurrentTemp:(int)CurrentTemp LowTemp:(int)LowTemp HighTemp:(int)HighTemp CityName:(NSString *)CityName Block:(void (^)(Byte * _Nullable, int))block
{
    // Not implemented for ring use case
}

@end
