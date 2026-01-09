//
//  ViewController.m
//  OC-SDKDemo
//
//  Created by sylar on 2018/5/11.
//  Copyright © 2018年 sylar. All rights reserved.
//

#import "ViewController.h"
#import "OC-SDKDemo-Bridging-Header.h"
@interface ViewController () <CRPManagerDelegate>
{
    CRPDiscovery * myDiscovery;
    NSString * Mac;
    NSString * version;
    UIImage *image;
    ScreenContent *content;
    weather *weatherInfo;
    forecastWeather * forecastWeatherInfo1;
    forecastWeather * forecastWeatherInfo2;
    forecastWeather * forecastWeatherInfo3;
    NSInteger mcu;
    NSString *path;
    NSString *upgradefileDownUrl;
}

@end
@implementation ViewController


- (void)viewDidLoad {
    [super viewDidLoad];
    // Do any additional setup after loading the view, typically from a nib.
    
    CRPSmartBandSDK.sharedInstance.delegate = self;
    image = [UIImage imageNamed:@"image"];
}
-(void)viewWillAppear:(BOOL)animated{
    
    [super viewWillAppear:animated];
    
}


-(void)viewDidLayoutSubviews{
    [super viewDidLayoutSubviews];
    self.scrollView.frame = CGRectMake(0, 0, self.view.bounds.size.width, 667);
    self.scrollView.contentSize = CGSizeMake(self.view.bounds.size.width, 1167);
    
}


- (void)didReceiveMemoryWarning {
    [super didReceiveMemoryWarning];
    // Dispose of any resources that can be recreated.
}


-(void)didState:(enum CRPState)state{
    NSLog(@"state = %d", state);
}

-(void)didBluetoothState:(enum CRPBluetoothState)state{
    NSLog(@"%d", state);
}

-(void)receiveSteps:(StepModel *)model{
    NSLog(@"Steps = %d, cal = %d, distance = %d", model.steps,model.calory, model.distance);
}

-(void)receiveHeartRate:(NSInteger)heartRate{
    NSLog(@"heartRate = %ld", heartRate);
}


-(void)receiveHeartRateAll:(HeartModel *)model{
    NSLog(@"startTime = %f", model.starttime);
}

-(void)receiveBloodPressure:(NSInteger)heartRate :(NSInteger)sbp :(NSInteger)dbp{
    NSLog(@"heartRate = %ld ,sbp = %ld ,dbp = %ld", heartRate,sbp,dbp);
}

-(void)receiveSpO2:(NSInteger)o2{
    NSLog(@"O2 = %ld", o2);
}

- (void)receiveRealTimeHeartRate:(NSInteger)heartRate :(NSInteger)rri{
    NSLog(@"heartRate = %ld", heartRate);
}

- (void)receiveUpgrede:(enum CRPUpgradeState)state :(NSInteger)progress{
    NSLog(@"state = %ld , progress = %ld",(long)state,progress);
}

- (void)receiveUpgradeScreen:(enum CRPUpgradeState)state :(NSInteger)progress{
    NSLog(@"state = %ld , progress = %ld",(long)state,progress);
}

- (void)recevieTakePhoto {
    NSLog(@"recevieTakePhoto");
}


- (void)receiveSportState:(enum SportType)state :(NSInteger)err{
    NSLog(@"receiveSportState %d, err %d",state,err);
}


- (IBAction)Scan:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] scan:10 progressHandler:^(NSArray<CRPDiscovery *> * arr) {
        //        myDiscovery = arr[0];
        for (int i = 0; i < arr.count; i++) {
            NSLog(@"%lu",(unsigned long)arr.count);
            NSLog(@"Scanned device information======%@,=====%@=====",arr[i].localName,arr[i].mac,i);
        }
        for(int i = 0; i<arr.count; i++) {
            //            NSLog(@"==========%d", arr[i]);
            NSString *name = arr[i].mac;
            if ([name containsString:_macText.text]){
                self.macText.text = arr[i].mac;
                myDiscovery = arr[i];
            }
        }

    } completionHandler:^(NSArray<CRPDiscovery *> * testArr,  CRPError tes) {
        NSLog(@"ok");
        NSLog(@"%d",testArr.count);
        NSLog(@"erro = %d",tes);
    }];
}

- (IBAction)stopScan:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] interruptScan];
}

- (IBAction)reConnect:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] reConnet];
}

- (IBAction)disconnect:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] disConnet];
}

- (IBAction)bind:(UIButton *)sender {
    if (myDiscovery != nil) {
        [[CRPSmartBandSDK sharedInstance] connet:myDiscovery];
        NSLog(@"connect");
    }
}

- (IBAction)unbind:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] remove:^(CRPState state, CRPError err) {
        NSLog(@"remove");
    }];
}

- (IBAction)getSteps:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getSteps:^(StepModel * model,  CRPError err) {
        self.step.text = [[NSString alloc]initWithFormat:@"step = %d Distance= %d Kcal =%d", model.steps, model.distance, model.calory];
    }];
}
- (IBAction)getVersion:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getSoftver:^(NSString * ver, CRPError err) {
        self.version.text = ver;
        [[CRPSmartBandSDK sharedInstance] checkDFUState:^(NSString * dfu, CRPError error) {
            NSLog(@"%@",dfu);
        }];
    }];
}

- (IBAction)sleepData:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getSleepData:^(SleepModel * model, CRPError err) {
        self.sleep.text = [[NSString alloc]initWithFormat:@"Deep sleep= %dMinute Light sleep= %dMinute", model.deep, model.light];
        self.sleep.numberOfLines = 0;
        self.sleep.adjustsFontSizeToFitWidth = true;
    }];
}
- (IBAction)getBattery:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getBattery:^(NSInteger bat, CRPError err) {
        self.battery.text = [[NSString alloc]initWithFormat:@"%d", bat];
    }];
}
- (IBAction)getGoal:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getGoal:^(NSInteger goal, CRPError err) {
        self.goal.text = [[NSString alloc]initWithFormat:@"%d", goal];
    }];
}
- (IBAction)getLanguage:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getLanguage:^(NSInteger language, CRPError err) {
        self.language.text = [[NSString alloc]initWithFormat:@"%d", language];
    } :^(NSArray<NSNumber *> * supportIndex, CRPError error) {
        NSLog(@"supportIndex = %@",supportIndex);
    }];
}
- (IBAction)getScreen:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getDial:^(NSInteger num, CRPError err) {
        self.screen.text = [[NSString alloc]initWithFormat:@"%d", num];
    }];
}
- (IBAction)getMac:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getMac:^(NSString * mac, CRPError err) {
        self.macAddress.text = mac;
        [[CRPSmartBandSDK sharedInstance] getSoftver:^(NSString * ver, CRPError err) {
            self.version.text = ver;
        }];
    }];
}
- (IBAction)setNotifitions:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] getNotifications:^(NSArray<NSNumber *> * notifitions, CRPError err) {
        NSLog(@"Notifitions = %@",notifitions);
    }];
}

- (IBAction)startO2:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] setStartSpO2];
}

- (IBAction)stopO2:(UIButton *)sender {
    [[CRPSmartBandSDK sharedInstance] setStopSpO2];
    
    
}

- (IBAction)sendCmd:(UIButton *)sender {
    CRPSmartBandSDK *manager = CRPSmartBandSDK.sharedInstance;
    switch (sender.tag) {
        {
        case 110:
            [manager getProfile:^(ProfileModel *profile,  CRPError err) {
                NSLog(@"progile.age = %d",profile.age);
            } ];
            break;
        case 111:
                [manager getSportData:^(NSArray<SportModel *> * sports, CRPError err) {
                    for (SportModel *model in sports) {
                        NSLog(@"model.date= %@, model.startTime = %d, model.endTime = %d, model.vaildTime = %d,model.type = %li, model.step = %d, model.distance = %d, model.kcal = %d",model.date,model.startTime, model.endTime, model.vaildTime,model.type, model.step, model.distance, model.kcal);
                    };
                }];
            break;
        case 112:
            [manager getAllData:^(NSArray<StepModel *> * stepModels, NSArray<SleepModel *> * sleepModels, CRPError err) {
                for (StepModel * model in stepModels){
                    NSLog(@"model.steps = %d,model.distance = %d, model.calory = %d",model.steps,model.distance, model.calory);
                };
                for (SleepModel *model in sleepModels){
                    NSLog(@"model.deep = %d, model.light = %d, model.detail = %@",model.deep, model.light, model.detail);
                }
            }];
            break;
        case 113:
            [manager getQuickViewTime:^(periodTimeModel * model, CRPError err) {
                NSLog(@"model.startHour = %d, model.startMin = %d, model.endHour = %d, model.endMin = %d", model.startHour, model.startMin, model.endHour, model.endMin);
            }];
            break;
        case 114:
            [manager getDisturbTime:^(periodTimeModel * model, CRPError err) {
                NSLog(@"model.startHour = %d, model.startMin = %d, model.endHour = %d, model.endMin = %d", model.startHour, model.startMin, model.endHour, model.endMin);
            }];
            break;
        case 115:
            [manager setStepLengthWithLength:90];
            break;
        case 116:
            [manager checkLatest:@"MOY-pk5-1.7.4" :@"C2:CF:14:F4:19:D2" handler:^(newVersionInfo *info,newVersionTpInfo * tpInfo, CRPError err) {
                if (info != nil) {
                    NSLog(@"info.version = %@,info.log = %@,info.logEN = %@",info.version,info.log,info.logEN);
//                    [manager startUpgredeWithInfo:info];
                }else{
                    NSLog(@"Already the latest version");
                }
            }];
            break;
        case 117:
//            NSLog(@"image = %@",image);
//            [manager startChangeScreen:image];
//            [manager getSportData:^(NSArray<SportModel *> * model, CRPError err) {
//                for (int i = 0; i<= model.count; i++){
//                    NSLog(@"model.type = %li", model[i].type);
//                }
//            }];
//            [manager getSportData:^(NSArray<SportModel *> * array, CRPError err) {
//                for(int i = 0; i<array.count; i++) {
//                    SportModel *model=[array objectAtIndex:i];
//                    NSLog(@"%li",model.type);
//                }
//                }];
            [manager getHeartData];
            break;
        case 118:
//            content = [[ScreenContent alloc]initWithPosition:ContentPositionUnder upperContent:ContentSleep underContent:ContentSleep contentColor:[[UIColor alloc]initWithRed:0 green:0 blue:0 alpha:1] md5:@"qwertyuioplkjhgfdsazxcvbnm123456"];
//            [manager setupScreenContentWithContent:content];
            break;
        case 119:
            weatherInfo = [[weather alloc]initWithType:5 temp:39 pm25:0 festival:@"" city:@"Beijing"];
            [manager setWeather:weatherInfo];
            break;
        case 120:
            forecastWeatherInfo1 = [[forecastWeather alloc]initWithType:1 maxTemp:2 minTemp:1];
            forecastWeatherInfo2 = [[forecastWeather alloc]initWithType:2 maxTemp:4 minTemp:3];
            forecastWeatherInfo3 = [[forecastWeather alloc]initWithType:3 maxTemp:6 minTemp:5];
            [manager setForecastWeather:@[forecastWeatherInfo1,forecastWeatherInfo2,forecastWeatherInfo3]];
            break;
        case 121:
            {
                ///Step1
                [manager getSoftver:^(NSString * ver, CRPError err) {
                    self->version = ver;
                }];

                [manager getMac:^(NSString * mac, CRPError err) {
                    self->Mac = mac;
                }];
                ///After Step1 ->Step2:
                ///Get the new version firmware from our server
    //            [manager checkLatest:self->version :self->Mac handler:^(newVersionInfo *info,newVersionTpInfo * tpInfo, CRPError err) {
    //                if (info != nil) {
    //                    self->mcu = info.mcu;
    //                    self->upgradefileDownUrl = info.fileUrl;
    //                }else{
    //                    NSLog(@"Already the latest version");
    //                }
    //            }];
    //            ///Step3: Use upgradefileDownUrl to download the file
            }

        case 122:
            /*
             chip: Nordic;Hunter;RealTek;Goodix
             
             Hunter: Mcu = 4/8/9
             ReakTek: Mcu = 7/11/12/71/72
             Goodix : Mcu = 10
             Nordic: Mcu = Other
             */
            switch (self->mcu) {
                    
                case 4:
                {
                    [manager getOTAMac:^(NSString * otaMac, CRPError err) {
                        [manager startOTAFromFileWithMac:otaMac zipFilePath:self->path isUser:false :true];
                    }];
                }
                    break;
                case 7:
                    [manager startRealTekUpgradeFromFileWithPath:path timeoutInterval:30];
                    break;
                case 8:
                {
                    [manager getOTAMac:^(NSString * otaMac, CRPError err) {
                        [manager startOTAFromFileWithMac:otaMac zipFilePath:self->path isUser:false :true];
                    }];
                }
                    break;
                case 9:
                {
                    [manager getOTAMac:^(NSString * otaMac, CRPError err) {
                        [manager startOTAFromFileWithMac:otaMac zipFilePath:self->path isUser:false :true];
                    }];
                }
                    break;
                case 11:
                    [manager startRealTekUpgradeFromFileWithPath:path timeoutInterval:30];
                    break;
                case 12:
                    [manager startRealTekUpgradeFromFileWithPath:path timeoutInterval:30];
                    break;
                case 71:
                    [manager startRealTekUpgradeFromFileWithPath:path timeoutInterval:30];
                    break;
                case 72:
                    [manager startRealTekUpgradeFromFileWithPath:path timeoutInterval:30];
                    break;
                case 10:
                    [manager startGoodixUpgradeFromFileWithZipPath:path];
                    break;
                default:
                    [manager startUpgradeFromFileWithPath:path];
                    break;
            }
            
            break;
        }
        default:
            break;
    }
}


@end



