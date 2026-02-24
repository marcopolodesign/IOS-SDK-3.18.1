//
//  ViewController.m
//  QCBandSDKDemo
//
//  Created by steve on 2021/7/3.
//

#import "ViewController.h"
#import "QCCentralManager.h"
#import <QCBandSDK/QCSDKManager.h>
#import <QCBandSDK/QCSDKCmdCreator.h>
#import <CoreBluetooth/CoreBluetooth.h>
#import "CollectionViewFeatureCell.h"
#import <QCBandSDK/QCSleepModel.h>
#import <QCBandSDK/QCSportModel.h>
#import <QCBandSDK/OdmSportPlusModels.h>
#import <QCBandSDK/QCManualHeartRateModel.h>
#import "QCScanViewController.h"
#import <QCBandSDK/QCManualHeartRateModel.h>
#import <QCBandSDK/QCDimingTimeInfo.h>
#import <QCBandSDK/QCStressModel.h>
#import <QCBandSDK/QCSedentaryModel.h>
#import <QCBandSDK/QCFlipWristInfoModel.h>
#import <QCBandSDK/QCBloodGlucoseHeartRateRawModel.h>
#import <QCBandSDK/QCThreeValueTemperatureModel.h>


typedef NS_ENUM(NSInteger, QCFeatureType) {
    QCFeatureTypeAlertBinding = 0,              //Bind Notification(绑定通知)
    QCFeatureTypeSetTime,                       //Set Watch Time(设置手表时间)
    QCFeatureTypeSetMyProfile,                  //Set personal information(设置个人信息)
    QCFeatureTypeGetFirmware,                   //Get firmware information(获取固件信息)
    QCFeatureTypeGetPower,                      //Get battery information(获取电量信息)
    QCFeatureTypeSleepByDay,                    //get a day of sleep(获取某一天睡眠)
    QCFeatureTypeSleepFromDay,                  //Get day-to-day sleep(获取某一天到今天睡眠)
    QCFeatureTypeTakePicture,                   //Take Picture(拍照)
    QCFeatureTypeDFUUpdate,                     //Firmware upgrade(固件升级)
    QCFeatureTypeGetSteps,                      //Get pedometer data(获取计步数据)
    QCFeatureTypeHRMeasuring,                   //Heart rate measurement(心率测量)
    QCFeatureTypeThreeValueTemperatureMeasuring,    //ThreeValueBodyTemperature rate measurement(体温测量)
    QCFeatureTypeHRMeasuringStop,                   //Heart rate measurement(心率测量)
    QCFeatureTypeGetSportRecords,
    QCFeatureTypeRealTimeHeartRateStart,             //RealTime HeartRate(实时心率)
    QCFeatureTypeSetUUID,                       //Set UUID(设置UUID)
    QCFeatureTypeGetUUID,                       //Get UUID(获取UUID)
    QCFeatureTypeGetTemperatureData,            //Get Temperature Data(获取温度数据)
    QCFeatureTypeSetTemperatureData,            //Set Temperature Data(获取温度数据)
    QCFeatureTypeEndBroadcast,                    //停止广播
    QCFeatureTypeCount,
};

static NSString *const kQCLastConnectedIdentifier = @"kQCLastConnectedIdentifier";
static NSInteger const kQCHoldRealTimeHeartRateTimeout = 20;

@interface ViewController ()<UICollectionViewDelegate,UICollectionViewDataSource,QCCentralManagerDelegate>

@property (strong, nonatomic) UICollectionViewFlowLayout *flowLayout;
@property (strong, nonatomic) UICollectionView *featureList;

/*中心角色,app*/
@property (strong, nonatomic) CBCentralManager *centerManager;

@property (nonatomic,strong)UIBarButtonItem *rightItem;

@property (nonatomic,strong)NSTimer *timer;
@property (nonatomic,strong)NSTimer *hrMeasuringTimer; // 心率测量定时器
@property (nonatomic,strong)NSMutableArray *hrMeasuringDataArray; // 存储心率测量数据的数组
@property (nonatomic,strong)NSString *hrMeasuringDataFilePath; // 心率测量数据文件路径
@end

@implementation ViewController

// 加载已有的心率测量数据
- (void)loadHRMeasuringData {
    // 初始化心率测量数据文件路径
    NSString *documentsPath = [NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES) firstObject];
    self.hrMeasuringDataFilePath = [documentsPath stringByAppendingPathComponent:@"HRMeasuringData.json"];
    
    // 检查文件是否存在
    NSFileManager *fileManager = [NSFileManager defaultManager];
    if ([fileManager fileExistsAtPath:self.hrMeasuringDataFilePath]) {
        // 读取文件内容
        NSData *jsonData = [NSData dataWithContentsOfFile:self.hrMeasuringDataFilePath];
        if (jsonData) {
            NSError *error;
            NSArray *loadedArray = [NSJSONSerialization JSONObjectWithData:jsonData options:NSJSONReadingMutableContainers error:&error];
            
            if (!error && [loadedArray isKindOfClass:[NSArray class]]) {
                self.hrMeasuringDataArray = [loadedArray mutableCopy];
                NSLog(@"已从本地加载心率测量数据，共 %ld 条记录", (long)self.hrMeasuringDataArray.count);
            } else {
                self.hrMeasuringDataArray = [NSMutableArray array];
                NSLog(@"解析JSON数据失败或数据格式不正确，创建新的数据数组");
            }
        } else {
            self.hrMeasuringDataArray = [NSMutableArray array];
            NSLog(@"读取JSON文件失败，创建新的数据数组");
        }
    } else {
        self.hrMeasuringDataArray = [NSMutableArray array];
        NSLog(@"心率测量数据文件不存在，创建新的数据数组");
    }
}

- (void)viewDidLoad {
    [super viewDidLoad];
    // Do any additional setup after loading the view.
    
    // 加载已有的心率测量数据
    [self loadHRMeasuringData];
    
    self.title = @"Feature";
    
    self.rightItem = [[UIBarButtonItem alloc] initWithTitle:@"Search"
                                                      style:(UIBarButtonItemStylePlain)
                                                     target:self
                                                     action:@selector(rightAction)];
    self.navigationItem.rightBarButtonItem = self.rightItem;
    
    _flowLayout = [[UICollectionViewFlowLayout alloc] init];
    _flowLayout.minimumLineSpacing = 20;
    _flowLayout.minimumInteritemSpacing = 10;
    _flowLayout.itemSize = CGSizeMake(100, 40);
    _flowLayout.scrollDirection = UICollectionViewScrollDirectionVertical;
    
    _featureList = [[UICollectionView alloc] initWithFrame:CGRectMake(0, 0, CGRectGetWidth(self.view.frame), CGRectGetHeight(self.view.frame)) collectionViewLayout:_flowLayout];
    _featureList.backgroundColor = [UIColor clearColor];
    _featureList.delegate = self;
    _featureList.dataSource = self;
    _featureList.scrollEnabled = YES;
    _featureList.contentInset = UIEdgeInsetsMake(44, 20, 10, 20);
    [_featureList registerClass:[CollectionViewFeatureCell class] forCellWithReuseIdentifier:NSStringFromClass([CollectionViewFeatureCell class])];
    [self.view addSubview:_featureList];
    
    //Set Scan and Connect delegate
    [QCCentralManager shared].delegate = self;
    
    [QCSDKManager shareInstance].debug = YES;
    
    [QCSDKManager shareInstance].findPhone = ^(NSInteger status){
        if (status == 1) {
            NSLog(@"Start finding phone");
        }
        else if (status == 2) {
            NSLog(@"Stop looking for phone");
        }
    };
    
    [QCSDKManager shareInstance].switchToPicture = ^{
        NSLog(@"Enter the photo page");
    };
    
    [QCSDKManager shareInstance].takePicture = ^{
        NSLog(@"Click on the watch to take a photo");
    };
    
    [QCSDKManager shareInstance].stopTakePicture = ^{
        NSLog(@"The watch ends taking pictures");
    };
    
    [QCSDKManager shareInstance].realTimeHeartRate = ^(NSInteger hr){
        NSLog(@"The RealTime HeartRate is :%zd",hr);
    };
    
    //Supported by some Rings
    [QCSDKManager shareInstance].currentStepInfo = ^(NSInteger step, NSInteger calorie, NSInteger distance) {
        NSLog(@"step:%zd,calorie(unit:calorie):%zd,distance(unit:meter):%zd",step,calorie,distance);
    };
    
    //Supported by Ring
    //App send start sport cmd
    [QCSDKManager shareInstance].currentSportInfo = ^(QCSportInfoModel * _Nonnull sportInfo) {
        NSLog(@"sportType:%zd,duration:%zd,state:%u,hr:%zd,step:%zd,calorie(unit:calorie):%zd,distance(unit:meter):%zd",sportInfo.sportType,sportInfo.duration,sportInfo.state,sportInfo.hr,sportInfo.step,sportInfo.calorie,sportInfo.distance);
    };
    
    [QCSDKManager shareInstance].currentBatteryInfo = ^(NSInteger battery, BOOL charging) {
        NSLog(@"battery:%ld,charging:%d",(long)battery,charging);
    };
    
//    __block NSInteger count = 0;
//    NSTimer *timer = [NSTimer scheduledTimerWithTimeInterval:3 repeats:true block:^(NSTimer * _Nonnull timer) {
//        count += 1;
//        NSLog(@"count: %d", count);
//    }];
//    // 如果需要后台运行，可以添加到 RunLoop
//    [[NSRunLoop currentRunLoop] addTimer:timer forMode:NSRunLoopCommonModes];
    
}

- (void)viewDidAppear:(BOOL)animated {
    [super viewDidAppear:animated];
    
    [QCCentralManager shared].delegate = self;
    [self didState:[QCCentralManager shared].deviceState];
}

- (void)rightAction {
    NSLog(@"[Ring] rightAction tapped with title: %@", self.rightItem.title);
    
    if([self.rightItem.title isEqualToString:@"Unbind"]) {
        NSLog(@"[Ring] Unbind requested");
        [[QCCentralManager shared] remove];
    }
    else if ([self.rightItem.title isEqualToString:@"Search"])  {
        NSLog(@"[Ring] Presenting scan view");
        QCScanViewController *viewCtrl = [[QCScanViewController alloc] init];
        [self.navigationController pushViewController:viewCtrl animated:true];
    }
}

#pragma mark - QCCentralManagerDelegate
- (void)didState:(QCState)state {
    NSLog(@"[Ring] didState callback: %ld", (long)state);
    self.title = @"Feature";
    switch(state) {
        case QCStateUnbind:
            NSLog(@"[Ring] State -> Unbind");
            self.rightItem.title = @"Search";
            self.featureList.hidden = YES;
            break;
        case QCStateConnecting:
            NSLog(@"[Ring] State -> Connecting to %@", [QCCentralManager shared].connectedPeripheral.name);
            self.title = [QCCentralManager shared].connectedPeripheral.name;
            self.rightItem.title = @"Connecting";
            self.rightItem.enabled = NO;
            self.featureList.hidden = YES;
            break;
        case QCStateConnected:
            NSLog(@"[Ring] State -> Connected to %@", [QCCentralManager shared].connectedPeripheral.name);
            self.title = [QCCentralManager shared].connectedPeripheral.name;
            self.rightItem.title = @"Unbind";
            self.rightItem.enabled = YES;
            self.featureList.hidden = NO;
            
            
            //Set Smartwatch time get feature states
            [self setTime];
            break;
        case QCStateUnkown:
            NSLog(@"[Ring] State -> Unknown");
            break;
        case QCStateDisconnecting:
        case QCStateDisconnected:
            NSLog(@"[Ring] State -> Disconnected/Disconnecting");
            self.rightItem.title = @"Search";
            self.rightItem.enabled = YES;
            self.featureList.hidden = YES;
            break;
    }
}

- (void)didBluetoothState:(QCBluetoothState)state {
    
}

- (void)didConnected:(CBPeripheral *)peripheral     //用户可以返回设备类型
{
    NSLog(@"[Ring] didConnected: %@ (%@)", peripheral.name, peripheral.identifier.UUIDString);
    self.rightItem.enabled = YES;
    self.title = peripheral.name;
}

- (void)didDisconnecte:(CBPeripheral *)peripheral {

    NSLog(@"[Ring] didDisconnecte: %@ (%@)", peripheral.name, peripheral.identifier.UUIDString);
    self.title = @"Feature";
    
    self.rightItem.title = @"Search";
    self.rightItem.enabled = YES;
    self.featureList.hidden = YES;
}

- (void)didFailConnected:(CBPeripheral *)peripheral {
    
    NSLog(@"[Ring] didFailConnected: %@ (%@)", peripheral.name, peripheral.identifier.UUIDString);
    self.rightItem.enabled = YES;
}

#pragma mark - UUID Test Methods
- (void)testSetUUID {
    NSString *testUUID = @"123456789012";
    [QCSDKCmdCreator setUUID:testUUID success:^{
        NSLog(@"✅ Set UUID成功: %@", testUUID);
    } failed:^{
        NSLog(@"❌ Set UUID失败");
    }];
}

- (void)testGetUUID {
    [QCSDKCmdCreator getUUID:^(NSString *uuid) {
        NSLog(@"✅ Get UUID成功: %@", uuid);
    } failed:^{
        NSLog(@"❌ Get UUID失败");
    }];
}


- (void)testEndBroadcast {
    [QCSDKCmdCreator endBroadcast:^{
        NSLog(@"✅ end Broadcast 成功");
    } failed:^{
        NSLog(@"❌ end Broadcast 失败");
    }];
}

- (void)testSetTemperatureData {
    //Set
    //calibrate is a reserved value and can be set to 0
    
//    [QCSDKCmdCreator getSchedualInfoType:SchedualInfoTypeBodyTemperator success:nil fail:nil];

    
    [QCSDKCmdCreator setSchedualInfoType:(SchedualInfoTypeBodyTemperator) featureOn:YES calibrate:0 interval:1 success:^{
        
    } fail:^{
        
    }];
    
}

- (void)testGetTemperatureData {
    NSLog(@"🌟开始获取温度数据🌟");
    NSInteger dayIndex = 0; // 0: today, 1: yesterday, etc.
    
    [QCSDKCmdCreator getTemperatureDataWithIntervalByDayIndex:dayIndex finished:^(NSInteger interval, NSArray<QCThreeValueTemperatureModel *> * _Nullable temperatureList, NSError * _Nullable error) {
        if (error == nil) {
            NSLog(@"✅ 获取温度数据成功");
            NSLog(@"📊 温度数据间隔: %ld 分钟", (long)interval);
            NSLog(@"📊 温度数据数量: %ld", (long)[temperatureList count]);
            
            for (int i = 0; i < [temperatureList count]; i++) {
                QCThreeValueTemperatureModel *model = temperatureList[i];
                NSLog(@"🌡️ %d 温度数据: %@",i, model);

            }

        } else {
            NSLog(@"❌ 获取温度数据失败: %@", error.localizedDescription);
        }
    }];
}



#pragma mark - Feature Action
- (void)setTime {
    NSLog(@"set time");
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        NSLog(@"Max Dials:%@",[info objectForKey:QCBandFeatureMaxDial]);
        
        NSLog(@"Set time successfully:%@",info);
        
    } failed:^{
        NSLog(@"Failed to set time");
    }];
}
- (void)setAlertBinding {
    NSLog(@"set binding vibration");
    [QCSDKCmdCreator alertBindingSuccess:^{
        NSLog(@"Set the binding vibration successfully");
    } fail:^{
        NSLog(@"Failed to set binding vibration");
    }];
}

- (void)setMyProfile {
    NSLog(@"Set personal information");
    [QCSDKCmdCreator setTimeFormatTwentyfourHourFormat:YES      //: YES 24 hour system; NO 12 hour system
                                          metricSystem:YES      //: YES metric system; NO British system
                                                gender:0        //(0=Male，1=Female)
                                                   age:18
                                                height:180      //cm
                                                weight:130      //kg
                                               sbpBase:105      //(reserved value, default 0)
                                               dbpBase:75       //(reserved value, default 0)
                                          hrAlarmValue:160      //(reserved value, default 0)
                                               success:^(BOOL twentyfourHourFormat, BOOL metricSystem, NSInteger gender, NSInteger age, NSInteger height, NSInteger weight, NSInteger sbpBase, NSInteger dbpBase, NSInteger hrAlarmValue)
     {
        NSLog(@"Set personal information successfully");
        
        [QCSDKCmdCreator getTimeFormatInfo:^(BOOL isTwentyfour, BOOL isMetricSystem, NSInteger gender, NSInteger age, NSInteger height, NSInteger weight, NSInteger sbpBase, NSInteger dbpBase, NSInteger hrAlarmValue) {
            NSLog(@"isTwentyfour:%d, isMetricSystem:%d",isTwentyfour,isMetricSystem);
        } fail:^{
            
        }];
        
        
    } fail:^{
        NSLog(@"Failed to set personal information");
    }];
}


- (void)getFirmwareInfo {
    NSLog(@"Get firmware information");
    [QCSDKCmdCreator getDeviceSoftAndHardVersionSuccess:^(NSString * _Nonnull hardVersion, NSString * _Nonnull softVersion) {
        NSLog(@"Obtaining firmware information successfully, hardware version: %@, firmware version: %@",hardVersion,softVersion);
    } fail:^{
        NSLog(@"Failed to get firmware information");
    }];
}

- (void)getPower {
    NSLog(@"Get battery information");
    /* real-time battery notification
     
     [QCSDKManager shareInstance].currentBatteryInfo = ^(NSInteger battery, BOOL charging) {
     NSLog(@"battery:%ld,charging:%d",(long)battery,charging);
     };
     */
    [QCSDKCmdCreator readBatterySuccess:^(int battery,BOOL charging) {
        NSLog(@"Obtained battery information successfully:%d,charging:%d",battery,charging);
    } failed:^{
        NSLog(@"Failed to get battery information");
    }];
}

- (void)getSleep {
    NSLog(@"Get sleep data");
    //7 days
    //dayIndex: 0-6,0:today,1:yesterday ...
//    [QCSDKCmdCreator getSleepDetailDataByDay:0 sleepDatas:^(NSArray<QCSleepModel *> * _Nonnull sleeps) {
//        NSLog(@"Get sleep data successfully");
//        
//        for (QCSleepModel *sleep in sleeps) {
//            NSLog(@"Start Time:%@,End Tile:%@,duration:%ld,type:%ld",sleep.happenDate,sleep.endTime,sleep.total,sleep.type);
//        }
//        
//        NSInteger total = [QCSleepModel sleepDuration:sleeps];
//        
//        NSLog(@"total duration：%ldh%ldm",total/60,total%60);
//    } fail:^{
//        NSLog(@"Failed to get sleep");
//    }];
    
    //0xbc3e09005e62 01   00 06 0d03 2703 021a 021a 021a   001a 021a021a021a  001a  021a021a021a
    [QCSDKCmdCreator getFulldaySleepDetailDataByDay:0 sleepDatas:^(NSArray<QCSleepModel *> * _Nullable sleeps, NSArray<QCSleepModel *> * _Nullable naps) {
        
        for (QCSleepModel *sleep in sleeps) {
            NSLog(@"Start Time:%@,End Tile:%@,duration:%ld,type:%ld",sleep.happenDate,sleep.endTime,sleep.total,sleep.type);
        }
        
        NSInteger fallAsleepDuration = [QCSleepModel fallAsleepDuration:sleeps];
        
        NSLog(@"fall Asleep Duration:%zd",fallAsleepDuration);
        
        NSInteger total = [QCSleepModel sleepDuration:sleeps];
        
        NSLog(@"total duration：%ldh%ldm",total/60,total%60);
        
        for (QCSleepModel *sleep in naps) {
            NSLog(@"Start Time:%@,End Tile:%@,duration:%ld,type:%ld",sleep.happenDate,sleep.endTime,sleep.total,sleep.type);
        }
        
        NSInteger totalNaps = [QCSleepModel sleepDuration:naps];
        
        NSLog(@"total duration：%ldh%ldm",totalNaps/60,totalNaps%60);
        
    } fail:^{
        NSLog(@"Failed to get sleep");
    }];
    
}

- (void)getSleepFromDay {
    NSLog(@"Get sleep data");
    [QCSDKCmdCreator getSleepDetailDataFromDay:1 sleepDatas:^(NSDictionary <NSString*,NSArray<QCSleepModel*>*>* _Nonnull sleeps) {
        NSLog(@"Get sleep data successfully");
        for (NSString *dayText in sleeps.allKeys) {
            NSLog(@"sleep date:%@",dayText);
            NSArray *daySleeps = [sleeps valueForKey:dayText];
            for (QCSleepModel *sleep in daySleeps) {
                NSLog(@"Start Time: %@, End Time: %@, Duration: %ld, Type: %ld",sleep.happenDate,sleep.endTime,sleep.total,sleep.type);
            }
            
            NSInteger total = [QCSleepModel sleepDuration:daySleeps];
            
            NSLog(@"total duration：%ldh%ldm",total/60,total%60);
        }
    } fail:^{
        NSLog(@"Failed to get sleep");
    }];
}

- (void)getHeartRate {
    
    //Schedule Heart Rate: Measure heart rate every 5 minutes
    [QCSDKCmdCreator getSchedualHeartRateStatusWithSuccess:^(BOOL enable) {
        
        NSLog(@"Schedule Heart Rate Switch state is %@",enable?@"NO":@"OFF");
        
        //Schedual HeartRate
        //Day Index: 7 days==>0:today,1:yesterday...
        [QCSDKCmdCreator getSchedualHeartRateDataWithDayIndexs:@[@(0)] success:^(NSArray<QCSchedualHeartRateModel *> * _Nonnull schedualData) {
            
            NSLog(@"Schedual HeartRate data count:%ld",schedualData.count);
            
            
            //Manual HeartRate
            //Day Index: 7 days==>0:today,1:yesterday...
            [QCSDKCmdCreator getManualHeartRateDataByDayIndex:0 finished:^(NSArray<QCManualHeartRateModel *> * _Nullable manualData, NSError * _Nullable err) {
                
                NSLog(@"Manual HeartRate data count:%ld",manualData.count);
            }];
            
        } fail:^{
            
        }];
        
    } fail:^{
        
    }];
}

- (void)getSchedualHeartRateAndTimeInterval {
    
    //Get the status of the scheduled heart rate switch and the time interval of the scheduled heart rate
    //获取定时心率开关状态，以及定时心率的时间间隔
    [QCSDKCmdCreator getSchedualHeartRateStatusAndIntervalWithSuccess:^(BOOL enable, NSInteger interval) {
        
        NSLog(@"schedual HeartRate Status:%d,timeInterval:%lu",enable,interval);
        
        
        //Set the status of the scheduled heart rate switch and the time interval of the scheduled heart rate
        //获取定时心率开关状态，以及定时心率的时间间隔
        [QCSDKCmdCreator setSchedualHeartRateStatus:YES timeInterval:5 success:^{
            
        } fail:^{
            
        }];
        
    } fail:^{
        
    }];
}

- (void)getBloodPressure {
    
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        if([[info objectForKey:QCBandFeatureBloodPressure] boolValue]) {
            NSLog(@"Supperort Blood Pressure");
            
            //2.Schedule Blood Pressure
            
            //3.Get Schedule Blood Pressure switch state（Measure blood pressure every one hour）
            [QCSDKCmdCreator getSchedualBPInfo:^(BOOL featureOn, NSString * _Nonnull beginTime, NSString * _Nonnull endTime, NSInteger minuteInterval) {
                
                if(featureOn) {
                    NSLog(@"Schedual Blood Pressure is On");
                }
                else {
                    NSLog(@"Schedual Blood Pressure is Off");
                }
                
                //minuteInterval: limit to 120 minutes
                [QCSDKCmdCreator setSchedualBPInfoOn:YES beginTime:@"00:00" endTime:@"23:59" minuteInterval:60 success:^(BOOL featureOn, NSString * _Nonnull beginTime, NSString * _Nonnull endTime, NSInteger minuteInterval) {
                    
                    
                    //4.Get Schedule Blood Pressure hisitroy Data(last 7 days)
                    [QCSDKCmdCreator getSchedualBPHistoryDataWithSuccess:^(NSArray<QCBloodPressureModel *> * _Nonnull data) {
                        
                        NSLog(@"Schedual Blood Pressure datas:%ld",[data count]);
                        
                        //5.Get Manual Blood Pressure
                        [QCSDKCmdCreator getManualBloodPressureDataWithLastUnixSeconds:0 success:^(NSArray<QCBloodPressureModel *> * _Nonnull data) {
                            
                            NSLog(@"Manual Blood Pressure datas:%ld",[data count]);
                            
                        } fail:^{
                            
                        }];
                        
                        
                    } fail:^{
                        
                    }];
                    
                    
                } fail:^{
                    
                }];
                
            } fail:^{
                
            }];
        }
        else {
            NSLog(@"Not Supperort Blood Pressure");
        }
        
    } failed:^{
        
        
    }];
    
}

- (void)getBloodOxygen {
    
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        if([[info objectForKey:QCBandFeatureBloodOxygen] boolValue]) {
            NSLog(@"Supperort Blood Pressure");
            
            //2.Schedule Blood Oxygen
            
            //3.Get Schedule Blood Oxygen switch state（Measure blood pressure every one hour）
            [QCSDKCmdCreator getSchedualBOInfoSuccess:^(BOOL featureOn) {
                
                //                if(featureOn) {
                //                    NSLog(@"Schedual Blood Oxygen is On");
                //                }
                //                else {
                //                    NSLog(@"Schedual Blood Oxygen is Off");
                //                }
                
                [QCSDKCmdCreator setSchedualBOInfoOn:YES success:^(BOOL featureOn) {
                    
                    NSLog(@"set Schedual Blood Oxygen success");
                    
                    //                    //4.Get Schedule Blood Oxygen hisitroy Data(last 7 days)
                    //                    //Day index: 0-6 ,0:today,1:yesterday...
                    //                    [QCSDKCmdCreator getBloodOxygenDataByDayIndex:0 finished:^(NSArray * _Nullable data, NSError * _Nullable err) {
                    //                        if(err == nil) {
                    //                            NSLog(@"Schedual Blood Pressure datas:%ld",[data count]);
                    //                        }
                    //                    }];
                    
                } fail:^{
                    NSLog(@"set Schedual Blood Oxygen fail");
                }];
                
            } fail:^{
                
            }];
        }
        else {
            NSLog(@"Not Supperort Blood Pressure");
        }
        
    } failed:^{
        
        
    }];
}

- (void)getBodyTemperature {
    
    //Set
    //calibrate is a reserved value and can be set to 0
    [QCSDKCmdCreator setSchedualInfoType:(SchedualInfoTypeBodyTemperator) featureOn:YES calibrate:0 success:^{
        
    } fail:^{
        
    }];
    
    //Get
    [QCSDKCmdCreator getSchedualInfoType:(SchedualInfoTypeBodyTemperator) success:^(BOOL isOn, NSInteger calibrate) {
        
        NSLog(@"get schedual Temperature is %@", isOn ? @"On" : @"Off");
    } fail:^{
        
    }];
    
    
    
    
    
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        if([[info objectForKey:QCBandFeatureTemperature] boolValue]) {
            NSLog(@"Supperort Body Temperature");
            
            //2.Get Schedual Body Temperature hisitroy Data(last 7 days)
            //Day index: 0-6 ,0:today,1:yesterday...
            [QCSDKCmdCreator getSchedualTemperatureDataByDayIndex:0 finished:^(NSArray * _Nullable temperatureList, NSError * _Nullable error) {
                NSLog(@"Schedual Body Temperature datas:%ld",[temperatureList count]);
                
                
                //3.Get Manual Body Temperature
                [QCSDKCmdCreator getManualTemperatureDataByDayIndex:0 finished:^(NSArray * _Nullable temperatureList, NSError * _Nullable error) {
                    NSLog(@"Manual Body Temperature datas:%ld",[temperatureList count]);
                }];
            }];
        }
        else {
            NSLog(@"Not Supperort Blood Pressure");
        }
        
    } failed:^{
        
        
    }];
}

- (void)getBloodGlucouse {
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        if([[info objectForKey:QCBandFeatureBloodGlucose] boolValue]) {
            
            //
            [QCSDKCmdCreator getBloodGlucoseDataByDayIndex:0 finished:^(NSArray * _Nullable data, NSError * _Nullable err) {
                
            }];
        }
        
    } failed:^{
        
    }];
}


- (void)takePicture {
    NSLog(@"start taking pictures");
    [QCSDKCmdCreator switchToPhotoUISuccess:^{
        
    } fail:^{
        
    }];
}

- (void)DFUUpdate {
    
    __block int p = -1;
    NSLog(@"🌟Please make sure the firmware file corresponds to the device, R02A_2.06.06_240302 corresponds to R02A🌟");
    NSString *filePath = [[NSBundle mainBundle] pathForResource:@"R02A_2.06.06_240302" ofType:@"bin"]; //R02A_2.06.06_240302
    NSURL *url = [NSURL fileURLWithPath:filePath];
    NSError *error;
    NSData *data = [NSData dataWithContentsOfURL:url options:NSDataReadingUncached error:&error];
    [QCSDKCmdCreator syncOtaBinData:data start:^{
        NSLog(@"Start firmware upgrade");
    } percentage:^(int percentage) {
        if (p != percentage && percentage%10==0) {
            p = percentage;
            NSLog(@"firmware progress:%ld",(long)percentage);
        }
    } success:^(int seconds) {
        NSLog(@"Firmware upgrade is successful, time:%lds",(long)seconds);
    } failed:^(NSError * _Nonnull error) {
        NSLog(@"Firmware upgrade failed");
    }];
}



- (void)getSteps {
    NSLog(@"🌟Get pedometer data🌟");
    [QCSDKCmdCreator getSportDetailDataByDay:0 sportDatas:^(NSArray<QCSportModel *> * _Nonnull sports) {
        NSLog(@"Get step count data details");
        NSInteger totalStepCount = 0;
        double calories = 0;
        NSInteger distance = 0;
        
        for (QCSportModel *model in sports) {
            totalStepCount += model.totalStepCount;
            calories += model.calories;
            distance += model.distance;
            NSLog(@"Pedometer data details:%@,totalStepCount：%zd,calories:%lf,distance：%zd",model.happenDate,model.totalStepCount,model.calories,model.distance);
        }
        NSLog(@"Pedometer data details result:totalStepCount：%zd,calories:%lf,distance：%zd",totalStepCount,calories,distance);
        
        [QCSDKCmdCreator getCurrentSportSucess:^(QCSportModel * _Nonnull sport) {
            
            NSLog(@"Pedometer data summary:totalStepCount：%zd,calories:%lf,distance：%zd",sport.totalStepCount,sport.calories,sport.distance);
        } failed:^{
            
        }];
        
    } fail:^{
        
    }];
}

- (void)hrMeasuringAction {
    
    NSLog(@"🌟Start measurement🌟");
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    //2.All rings are supported, no judgment required
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        //A single measurement initiated by the App to the ring
        //App向戒指发起的单次测量
        if([[info objectForKey:QCBandFeatureAppManual] boolValue]) {
            NSLog(@"Supperort ");
            
            QCMeasuringType operateType = QCMeasuringTypeHeartRate;
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:operateType measuringHandle:^(id  _Nullable result) {
                                
                if (result != nil && [result isKindOfClass:[NSNumber class]]) {
                    NSNumber *res = (NSNumber *) result;
                    NSLog(@"measuringHandle:res: %@ ", res);
                }
                
            } completedHandle:^(BOOL isSuccess, id  _Nonnull result, NSError * _Nonnull error) {
            
                if (isSuccess) {
                    NSLog(@"completedHandle isSuccess");
                }
                else {
                    NSLog(@"completedHandle failed");
                }
                if (result != nil && [result isKindOfClass:[NSNumber class]]) {
                    NSNumber *res = (NSNumber *) result;
                    NSLog(@"completedHandle:res: %@ ", res);
                }
            }];

            
        }
        else {
            NSLog(@"Not Supperort ");
        }
        
    } failed:^{
        
        
    }];
}

- (void)temperatureMeasuringAction {
    
    NSLog(@"🌟Start measurement🌟");
    //1.Some watches support it, and setting the time will return the status of whether it is supported
    //2.All rings are supported, no judgment required
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull info) {
        
        //A single measurement initiated by the App to the ring
        //App向戒指发起的单次测量
        if([[info objectForKey:QCBandFeatureAppManual] boolValue]) {
            NSLog(@"Supperort ");
            
            QCMeasuringType operateType = QCMeasuringTypeThreeValueBodyTemperature;
            [[QCSDKManager shareInstance] startToMeasuringWithOperateType:operateType measuringHandle:^(id  _Nullable result) {
                                
                if (result != nil && [result isKindOfClass:[QCThreeValueTemperatureModel class]]) {
                    QCThreeValueTemperatureModel *res = (QCThreeValueTemperatureModel *) result;
                    NSLog(@"measuringHandle:res: %@ ", res);
                }
                
            } completedHandle:^(BOOL isSuccess, id  _Nonnull result, NSError * _Nonnull error) {
            
                if (isSuccess) {
                    NSLog(@"completedHandle isSuccess");
                }
                else {
                    NSLog(@"completedHandle failed");
                }
                if (result != nil && [result isKindOfClass:[QCThreeValueTemperatureModel class]]) {
                    QCThreeValueTemperatureModel *res = (QCThreeValueTemperatureModel *) result;
                    NSLog(@"completedHandle:res: %@ ", res);
                }
            }];
            
        }
        else {
            NSLog(@"Not Supperort ");
        }
        
    } failed:^{
        
        
    }];
}


- (void)hrMeasuringActionStop {
    
    NSLog(@"🌟Stop measurement🌟");
    
    // 停止定时器
    if (self.hrMeasuringTimer) {
        [self.hrMeasuringTimer invalidate];
        self.hrMeasuringTimer = nil;
        NSLog(@"心率测量定时器已停止");
    }
    
    QCMeasuringType operateType = QCMeasuringTypeHeartRate;
    [[QCSDKManager shareInstance] stopToMeasuringWithOperateType:operateType completedHandle:^(BOOL isSuccess, NSError * _Nonnull error) {
        
        if (isSuccess) {
            
            NSLog(@"Stop success");
            
        }else {
            NSLog(@"%@", error);
        }
    }];
    
}



- (void)getSportRecords {
    
    [QCSDKCmdCreator getSportRecordsFromLastTimeStamp:0 finish:^(NSArray<OdmGeneralExerciseSummaryModel *> * _Nullable summaries, NSError * _Nullable error) {
        
        NSLog(@"getSportRecords Finish");
        for (OdmGeneralExerciseSummaryModel *model in summaries) {
            
            NSDate *startDate = [NSDate dateWithTimeIntervalSince1970:model.startTime];
            
            //Convert TimeZone
            startDate = [self convertTimeZone:startDate];
            
            NSDateFormatter *dateFormatter = [[NSDateFormatter alloc] init];
            [dateFormatter setDateFormat:@"yyyy-MM-dd HH:mm:ss"];
            NSLog(@"date:%@,steps:%zd,hr count:%zd",[dateFormatter stringFromDate:startDate],model.steps,model.detail.hrs.count);
            /*
             2023-02-28 14:00:15.030554+0800 QCBandSDKDemo[6223:262521] date:2023-02-24 16:58:39,steps:2470,hr count:47
             2023-02-28 14:00:15.032183+0800 QCBandSDKDemo[6223:262521] date:2023-02-23 21:19:04,steps:0,hr count:54
             2023-02-28 14:00:15.034040+0800 QCBandSDKDemo[6223:262521] date:2023-02-23 21:16:34,steps:0,hr count:52
             2023-02-28 14:00:15.035666+0800 QCBandSDKDemo[6223:262521] date:2023-02-23 21:06:38,steps:303,hr count:56
             */
        }
    }];
}

- (void)startToRealTimeHR {
    
    NSLog(@"start RealTime HeartRate");
    //[self endToRealTimeHR];
    
    //start RealTime HeartRate
    [QCSDKCmdCreator realTimeHeartRateWithCmd:(QCBandRealTimeHeartRateCmdTypeStart) finished:nil];
    
    
    //RealTime HeartRate Result
    
    [QCSDKManager shareInstance].realTimeHeartRate = ^(NSInteger hr){
        NSLog(@"The RealTime HeartRate is :%zd",hr);
    };
    
    
    //hold RealTime HeartRate
    [self startToHoldTealTimeHRTimer];
    
    
    //stop RealTime HeartRate
    [self performSelector:@selector(endToRealTimeHR) withObject:nil afterDelay:kQCHoldRealTimeHeartRateTimeout*6];
}

- (void)endToRealTimeHR {
    NSLog(@"end RealTime HeartRate");
    [self stopTimer];
    [QCSDKCmdCreator realTimeHeartRateWithCmd:(QCBandRealTimeHeartRateCmdTypeEnd) finished:nil];
}

- (void)holdTealTimeHR {
    NSLog(@"hold RealTime RealTime HeartRate");
    [QCSDKCmdCreator realTimeHeartRateWithCmd:(QCBandRealTimeHeartRateCmdTypeHold) finished:nil];
}

- (void)startToHoldTealTimeHRTimer {
    [self stopTimer];
    self.timer = [NSTimer scheduledTimerWithTimeInterval:kQCHoldRealTimeHeartRateTimeout target:self selector:@selector(holdTealTimeHR) userInfo:nil repeats:YES];
}

- (void)stopTimer {
    if (self.timer) {
        [self.timer invalidate];
        self.timer = nil;
    }
}

- (void)getStress {
    //Only Ring Supports
    [QCSDKCmdCreator getSchedualStressStatusWithFinshed:^(BOOL isOn, NSError * _Nullable error) {
        
        
        //get stress datas
        [QCSDKCmdCreator getSchedualStressDataWithDates:@[@(0),@(1),@(2),@(3),@(4),@(5),@(6)] finished:^(NSArray * _Nullable models, NSError * _Nullable err) {
            
            if (err == nil) {
                NSLog(@"Stress data count:%zd",models.count);
            }
            
        }];
    }];
}

- (void)getHRV {
    [QCSDKCmdCreator getSchedualHRVWithFinshed:^(BOOL isOn, NSError * _Nullable error) {
        
        [QCSDKCmdCreator getSchedualHRVDataWithDates:@[@(0),@(1),@(2),@(3),@(4),@(5),@(6)] finished:^(NSArray * _Nullable models, NSError * _Nullable err) {
            
            if (models) {
                NSLog(@"HRV Datas:%@",models);
            }
        }];
    }];
}

- (void)operateSportModel {
    //Only Ring Supports
    /*
     //Supported by Ring
     //App send start sport cmd
     [QCSDKManager shareInstance].currentSportInfo = ^(QCSportInfoModel * _Nonnull sportInfo) {
     NSLog(@"sportType:%zd,duration:%zd,state:%u,hr:%zd,step:%zd,calorie(unit:calorie):%zd,distance(unit:meter):%zd",sportInfo.sportType,sportInfo.duration,sportInfo.state,sportInfo.hr,sportInfo.step,sportInfo.calorie,sportInfo.distance);
     };
     */
    
    [QCSDKCmdCreator operateSportModeWithType:(OdmSportPlusExerciseModelTypeWalk) state:(QCSportStateStart) finish:^(id _Nullable res, NSError * _Nullable err) {
        
        
        dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(120 * NSEC_PER_SEC)), dispatch_get_main_queue(), ^{
            
            [QCSDKCmdCreator operateSportModeWithType:OdmSportPlusExerciseModelTypeWalk state:(QCSportStateStop) finish:^(id _Nullable res, NSError * _Nullable err) {
                
                //get sport records
                [self getSportRecords];
                
            }];
        });
    }];
}

- (void)wearCalibration {
    
    [[QCSDKManager shareInstance] startToWearCalibrationWithCompletedHandle:^(BOOL isSuccess, NSError * _Nonnull error) {
        
        if (isSuccess) {
            NSLog(@"Wear Calibration success");
        }
    }];
    
    //    [[QCSDKManager shareInstance] stopToWearCalibrationWithCompletedHandle:^(BOOL isSuccess, NSError * _Nonnull error) {
    //
    //    }];
}

- (void)getSedentaryReminderFromDay {
    
    //check device support
    //[[feature objectForKey:QCBandFeatureSedentaryReminder] boolValue]
    
    NSLog(@"Get Sedentary Reminder");
    [QCSDKCmdCreator getSedentaryReminderFromDay:1 finished:^(NSDictionary<NSString *,NSArray<QCSedentaryModel *> *> * _Nullable datas, NSError * _Nullable error) {
        if (!error) {
            NSLog(@"Get Sedentary Reminder data successfully");
            for (NSString *dayText in datas.allKeys) {
                NSLog(@"Sedentary Reminder date:%@",dayText);
                NSArray *dayDatas = [datas valueForKey:dayText];
                NSInteger total = 0;
                for (QCSedentaryModel *sedentary in dayDatas) {
                    NSLog(@"Start Time: %@, End Time: %@, Duration: %ld, Type: %ld",sedentary.date,sedentary.endTime,sedentary.duration,sedentary.type);
                    total = total + sedentary.duration;
                }
                NSLog(@"total duration：%ldh%ldm",total/60,total%60);
            }
        }
        else {
            NSLog(@"Failed to get Sedentary Reminder");
        }
    }];
    
    /*
     2024-09-03 11:27:47.005198+0800 QCBandSDKDemo[11782:244498] Sedentary Reminder date:1
     2024-09-03 11:27:47.005260+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 00:00:00, End Time: 2024-09-02 04:00:00, Duration: 240, Type: 0
     2024-09-03 11:27:47.005310+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 04:00:00, End Time: 2024-09-02 08:00:00, Duration: 240, Type: 0
     2024-09-03 11:27:47.005353+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 08:00:00, End Time: 2024-09-02 12:00:00, Duration: 240, Type: 0
     2024-09-03 11:27:47.005394+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 12:00:00, End Time: 2024-09-02 16:00:00, Duration: 240, Type: 0
     2024-09-03 11:27:47.005434+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 16:00:00, End Time: 2024-09-02 20:00:00, Duration: 240, Type: 0
     2024-09-03 11:27:47.005474+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:00:00, End Time: 2024-09-02 20:16:00, Duration: 16, Type: 0
     2024-09-03 11:27:47.005515+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:16:00, End Time: 2024-09-02 20:17:00, Duration: 1, Type: 2
     2024-09-03 11:27:47.005588+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:17:00, End Time: 2024-09-02 20:18:00, Duration: 1, Type: 0
     2024-09-03 11:27:47.005675+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:18:00, End Time: 2024-09-02 20:29:00, Duration: 11, Type: 2
     2024-09-03 11:27:47.005783+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:29:00, End Time: 2024-09-02 20:43:00, Duration: 14, Type: 0
     2024-09-03 11:27:47.005873+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:43:00, End Time: 2024-09-02 20:45:00, Duration: 2, Type: 2
     2024-09-03 11:27:47.006120+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 20:45:00, End Time: 2024-09-02 21:21:00, Duration: 36, Type: 0
     2024-09-03 11:27:47.006162+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 21:21:00, End Time: 2024-09-02 21:22:00, Duration: 1, Type: 2
     2024-09-03 11:27:47.006293+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-02 21:22:00, End Time: 2024-09-02 21:23:00, Duration: 1, Type: 0
     2024-09-03 11:27:47.006917+0800 QCBandSDKDemo[11782:244498] total duration：21h23m
     2024-09-03 11:27:47.006982+0800 QCBandSDKDemo[11782:244498] Sedentary Reminder date:0
     2024-09-03 11:27:47.007024+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 00:00:00, End Time: 2024-09-03 04:01:00, Duration: 241, Type: 0
     2024-09-03 11:27:47.007064+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 04:01:00, End Time: 2024-09-03 08:02:00, Duration: 241, Type: 0
     2024-09-03 11:27:47.007102+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 08:02:00, End Time: 2024-09-03 10:08:00, Duration: 126, Type: 0
     2024-09-03 11:27:47.007176+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:08:00, End Time: 2024-09-03 10:09:00, Duration: 1, Type: 2
     2024-09-03 11:27:47.007218+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:09:00, End Time: 2024-09-03 10:18:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.007257+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:18:00, End Time: 2024-09-03 10:19:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.007752+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:19:00, End Time: 2024-09-03 10:20:00, Duration: 1, Type: 0
     2024-09-03 11:27:47.007793+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:20:00, End Time: 2024-09-03 10:21:00, Duration: 1, Type: 2
     2024-09-03 11:27:47.007831+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:21:00, End Time: 2024-09-03 10:30:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.007868+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:30:00, End Time: 2024-09-03 10:31:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.007906+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:31:00, End Time: 2024-09-03 10:40:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.007999+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:40:00, End Time: 2024-09-03 10:41:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.008051+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:41:00, End Time: 2024-09-03 10:50:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.008554+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:50:00, End Time: 2024-09-03 10:51:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.008595+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 10:51:00, End Time: 2024-09-03 11:00:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.008633+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 11:00:00, End Time: 2024-09-03 11:01:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.008671+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 11:01:00, End Time: 2024-09-03 11:10:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.008709+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 11:10:00, End Time: 2024-09-03 11:11:00, Duration: 1, Type: 1
     2024-09-03 11:27:47.008746+0800 QCBandSDKDemo[11782:244498] Start Time: 2024-09-03 11:11:00, End Time: 2024-09-03 11:20:00, Duration: 9, Type: 0
     2024-09-03 11:27:47.009121+0800 QCBandSDKDemo[11782:244498] total duration：11h20m
     */
}

- (void)getTouchControl {
    //check device support
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull featureList) {
        
        if ([[featureList objectForKey:QCBandFeatureTouchControl] boolValue]) {
            
            //需要判断设备是否支持类型
            NSMutableArray *supportControlTyps = [[NSMutableArray alloc] init];
            [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeOff]];
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlMusic] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeMusic]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlVideo] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeVideo]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureMSLPraise] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeMSLPraise]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlEBook] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeEBook]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlTakePhoto] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeTakePhoto]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlPhoneCall] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypePhoneCall]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlGame] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeGame]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlGame] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeGame]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlHRMeasure] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeHRMeasure]];
            }
            
            QCTouchGestureControlType controlType = QCTouchGestureControlTypeOff;
            
            [QCSDKCmdCreator setTouchControl:controlType strength:1 duration:3 finshed:^(NSError * _Nullable error) {
                
            }];
        }
        
    } failed:^{
        
    }];
}

- (void)getGestureControl {
    
    //check device support
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull featureList) {
        
        if ([[featureList objectForKey:QCBandFeatureGestureControl] boolValue]) {
            
            //需要判断设备是否支持类型
            NSMutableArray *supportControlTyps = [[NSMutableArray alloc] init];
            [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeOff]];
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlMusic] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeMusic]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlVideo] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeVideo]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureMSLPraise] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeMSLPraise]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlEBook] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeEBook]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlTakePhoto] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeTakePhoto]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlPhoneCall] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypePhoneCall]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlGame] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeGame]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlGame] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeGame]];
            }
            
            if ([[featureList objectForKey:QCBandFeatureGestureControlHRMeasure] boolValue]) {
                [supportControlTyps addObject:[NSNumber numberWithInteger:QCTouchGestureControlTypeHRMeasure]];
            }
            
            
            QCTouchGestureControlType controlType = QCTouchGestureControlTypeOff;
            
            [QCSDKCmdCreator setGestureControl:controlType strength:1 finshed:^(NSError * _Nullable error) {
                
            }];
            
        }
        
    } failed:^{
        
    }];
    
}

- (void)getTouchControlOfScreen {
    //check device support
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull featureList) {
        
        if ([[featureList objectForKey:QCBandFeatureTouchControlOfScreenDevice] boolValue]) {
            
            QCTouchGestureControlType controlType = QCTouchGestureControlTypeOff;
            [QCSDKCmdCreator setTouchControlOfScreenDevie:controlType strength:1 duration:3 finshed:^(NSError * _Nullable error) {
                
            }];
        }
        
    } failed:^{
        
    }];
}

- (void)getFlipWristInfo {
    //Support for ring
    [QCSDKCmdCreator setTime:[NSDate date] success:^(NSDictionary * _Nonnull featureList) {
       
        if ([[featureList objectForKey:QCBandFeatureFlipWrist] boolValue]) {
            
            [QCSDKCmdCreator getFlipWristInfoFinshed:^(QCFlipWristInfoModel * _Nullable info, NSError * _Nullable err) {
                NSLog(@"flip wrist info:%d,hand:%zd",info.enable,info.flipType); //hand:1-left,2-right
            }];
            
            
            //info report
//            [QCSDKManager shareInstance].flipWristInfo = ^(NSInteger enable, NSInteger hand) {
//                NSLog(@"flip wrist info report:%zd,hand:%zd",enable,hand); //hand:1-left,2-right
//            };
            
        }
        
    } failed:^{
        
    }];
}

- (void)getBloodOxygenDataWithTimerInterval {

    NSLog(@"operate blood oxygen data with timer interval");
    [QCSDKCmdCreator setSchedualBOInfoOn:YES timeInterval:10 success:^{
        
        NSLog(@"set blood oxygen info with 10 minute success");
        [QCSDKCmdCreator getSchedualBOInfoWithIntervalSuccess:^(BOOL isOn, NSInteger interval) {
            NSLog(@"get blood oxygen info success: isOn:%zd, %zd minutes success",(NSInteger)isOn,interval);
            
            NSInteger dayIndex = 0;
            [QCSDKCmdCreator getBloodOxygenDataWithIntervalByDayIndex:dayIndex finished:^(NSInteger interval, NSArray * _Nullable datas, NSError * _Nullable err) {
                
                if (!err) {
                    NSLog(@"get (%zd) blood oxygen datas with interval success,interval:%zd, count:%zd,datas:%@",dayIndex,interval,[datas count],[datas componentsJoinedByString:@","]);
                }
                else {
                    NSLog(@"get (%zd) blood oxygen datas with interval fail",dayIndex);
                }
            }];
            
        } fail:^{
            NSLog(@"get blood oxygen info success: fail");
        }];

    } fail:^{
        NSLog(@"set blood oxygen data with 1 minute fail");

    }];
}

- (NSDate*)convertTimeZone:(NSDate*)date {
    NSTimeZone * Shanghai = [[NSTimeZone alloc] initWithName:@"Asia/Shanghai"];
    NSTimeInterval a = Shanghai.secondsFromGMT - [[NSTimeZone systemTimeZone] secondsFromGMT];
    return [date dateByAddingTimeInterval:a];
}

#pragma mark - CollectionView view datasource & delegate
- (NSInteger)numberOfSectionsInCollectionView:(UICollectionView *)collectionView {
    return 1;
}

- (NSInteger)collectionView:(UICollectionView *)collectionView numberOfItemsInSection:(NSInteger)section {
    return QCFeatureTypeCount;
}

- (__kindof UICollectionViewCell *)collectionView:(UICollectionView *)collectionView cellForItemAtIndexPath:(NSIndexPath *)indexPath {
    
    CollectionViewFeatureCell *cell = [collectionView dequeueReusableCellWithReuseIdentifier:NSStringFromClass([CollectionViewFeatureCell class]) forIndexPath:indexPath];
    
    cell.featureName = [[self class] featureNameWithType:indexPath.row];
    
    return cell;
}

- (void)collectionView:(UICollectionView *)collectionView didSelectItemAtIndexPath:(NSIndexPath *)indexPath {
    NSLog(@"[Ring] Feature tapped: %ld", (long)indexPath.row);
    [collectionView deselectItemAtIndexPath:indexPath animated:YES];
    
    switch (indexPath.row) {
        case QCFeatureTypeAlertBinding:
            [self setAlertBinding];
            break;
        case QCFeatureTypeSetTime:
            [self setTime];
            break;
        case QCFeatureTypeSetMyProfile:
            [self setMyProfile];
            break;
        case QCFeatureTypeGetFirmware:
            [self getFirmwareInfo];
            break;
        case QCFeatureTypeGetPower:
            [self getPower];
            break;
        case QCFeatureTypeSleepByDay:
            [self getSleep];
            break;
        case QCFeatureTypeSleepFromDay:
            [self getSleepFromDay];
            break;
        case QCFeatureTypeTakePicture:
            [self takePicture];
            break;
        case QCFeatureTypeDFUUpdate:
            [self DFUUpdate];
            break;
        case QCFeatureTypeGetSteps:
            [self getSteps];
            break;
        case QCFeatureTypeHRMeasuring:
            [self hrMeasuringAction];
            break;
        case QCFeatureTypeThreeValueTemperatureMeasuring:
            [self temperatureMeasuringAction];
            break;
        case QCFeatureTypeHRMeasuringStop:
            [self hrMeasuringActionStop];
            break;
        case QCFeatureTypeGetSportRecords:
            [self getSportRecords];
            break;
        case QCFeatureTypeRealTimeHeartRateStart:
            [self startToRealTimeHR];
            break;
        case QCFeatureTypeSetUUID:
            [self testSetUUID];
            break;
        case QCFeatureTypeGetUUID:
            [self testGetUUID];
            break;
        case QCFeatureTypeGetTemperatureData:
            [self testGetTemperatureData];
            break;
        case QCFeatureTypeSetTemperatureData:
            [self testSetTemperatureData];
            break;
        case QCFeatureTypeEndBroadcast:
            [self testEndBroadcast];
            break;
        default:
            break;
    }
}


#pragma mark - Helpers
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

+ (NSString*)featureNameWithType:(QCFeatureType)type {
    
    switch (type) {
        case QCFeatureTypeAlertBinding:
            return @"Alert Binding";
        case QCFeatureTypeSetTime:
            return @"Set Time";
        case QCFeatureTypeSetMyProfile:
            return @"Set Profile";
        case QCFeatureTypeGetFirmware:
            return @"Get Firmware";
        case QCFeatureTypeGetPower:
            return @"Get Battery";
        case QCFeatureTypeSleepByDay:
            return @"One day Sleep";
        case QCFeatureTypeSleepFromDay:
            return @"Some days Sleep";
        case QCFeatureTypeTakePicture:
            return @"Take Pciture";
        case QCFeatureTypeDFUUpdate:
            return @"Firmware Upgrade";
        case QCFeatureTypeGetSteps:
            return @"Get Steps";
        case QCFeatureTypeHRMeasuring:
            return @"Heart Rate Measuring";
        case QCFeatureTypeThreeValueTemperatureMeasuring:
            return @"Temperature Measuring";
        case QCFeatureTypeHRMeasuringStop:
            return @"Heart Rate Measuring stop";
        case QCFeatureTypeGetSportRecords:
            return @"Sport Records";
        case QCFeatureTypeRealTimeHeartRateStart:
            return @"Start RealTime HR";
        case QCFeatureTypeSetUUID:
            return @"Set UUID";
        case QCFeatureTypeGetUUID:
            return @"Get UUID";
        case QCFeatureTypeGetTemperatureData:
            return @"Get Temperature Data";
        case QCFeatureTypeSetTemperatureData:
            return @"Set Temperature interval";
        case QCFeatureTypeEndBroadcast:
            return @"end broadcast";
        default:
            break;
    }
    
    return @"Title";
}
@end

