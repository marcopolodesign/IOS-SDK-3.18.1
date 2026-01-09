//
//  SetViewController.m
//  OC-SDKDemo
//
//  Created by dong po luo on 2019/4/11.
//  Copyright © 2019 sylar. All rights reserved.
//

#import "SetViewController.h"
#import "OC-SDKDemo-Bridging-Header.h"
@interface SetViewController () <CRPManagerDelegate>
{
    ProfileModel * model;
    NSMutableArray * notifi;
    AlarmModel * alarm1;
    AlarmModel * alarm2;
    AlarmModel * alarm3;
    NSArray<NSNumber *> * supportModel;
    watchFaceInfo * info;
    contactProfileModel * contactmodel;
    ScreenImageSize * imageSize;
    NSInteger * compressionType;
}

@end

@implementation SetViewController

- (void)viewDidLoad {
    [super viewDidLoad];
    CRPSmartBandSDK.sharedInstance.delegate = self;
}
-(void)viewWillAppear:(BOOL)animated{
    
    [super viewWillAppear:animated];
    
}
- (void)viewDidAppear:(BOOL)animated{
    [super viewDidAppear:animated];
}
-(void)viewDidLayoutSubviews{
    [super viewDidLayoutSubviews];
    self.scrollView.frame = CGRectMake(0, 0, self.view.bounds.size.width, 667);
    self.scrollView.contentSize = CGSizeMake(self.view.bounds.size.width, 1067);
    
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

- (void)receiveECGDate:(enum ecgState)state :(NSArray<NSNumber *> *)data completeTime:(NSInteger)completeTime{
    NSLog(@"state =%d,data count = %d,completeTime = %d",state,data.count,completeTime);
}

- (IBAction)sendCmd:(UIButton *)sender {
    CRPSmartBandSDK *manager = CRPSmartBandSDK.sharedInstance;
    switch (sender.tag) {
        {
        case 90:
            manager.setFindDevice;
            break;
        case 100:
            model = [[ProfileModel alloc] initWithHeight:180 weight:70 age:30 gender:GenderOptionMale ];
            [manager setProfile:model];
            break;
        case 101:
            model = [[ProfileModel alloc] initWithHeight:150 weight:50 age:20 gender:GenderOptionFemale ];
            [manager setProfile:model];
            break;
        case 110:
            [manager setQuickView:false];
            break;
        case 111:
            [manager setQuickView:true];
            break;
            //时间格式:
        case 120:
            [manager setTimeFormat:0];
            break;
        case 121:
            [manager setTimeFormat:1];
            break;
            
            //左右手:
        case 150:
            [manager setDominantHand:0];
            break;
        case 151:
            [manager setDominantHand:1];
            break;
            
            //表盘:
        case 160:
            [manager setDial:1];
            [manager getDial:^(NSInteger num,  CRPError err) {
                NSLog(@"dial =%d",num);
            }];
            break;
        case 161:
            [manager setDial:2];
            break;
        case 162:
            [manager setDial:3];
            break;
            
            
            //单位:
        case 170:
            [manager setUnit:0];
            break;
        case 171:
            [manager setUnit:1];
            break;
            
            
            //久坐提醒:
        case 180:
            [manager setRemindersToMove:false];
            break;
        case 181:
            [manager setRemindersToMove:true];
            break;
            
            
            //心率监测:
        case 190:
            manager.setStopSingleHR;
            break;
        case 191:
            manager.setStartSingleHR;
            break;
            
            //血压
        case 200:
            manager.setStopBlood;
            break;
        case 201:
            manager.setStartBlood;
            break;
        case 202:
            [manager setCalibrationBlood:88 :110 :88];
            break;
            //消息推送::
            
        case 210:
            notifi = @[];
            [manager setNotification:notifi];
            break;
        case 211:
            notifi = @[@0,@1,@2,@3,@4,@5,@6,@7,@8,@9,@10,@11];
            [manager setNotification:notifi];
            break;
            
            
            //设置目标:
        case 220:
            [manager setGoal:500];
            break;
        case 221:
            [manager setGoal:1000];
            break;
            
            //设置语言:
        case 230:
            [manager setLanguage:0];
            break;
        case 231:
            [manager setLanguage:1];
            break;
            
            
            //设置闹钟:
            //weekday: AlarmWeekDay
        case 240:
            //            alarm1 = [[AlarmModel alloc]initWithId:0 enable:1 type:AlarmTypeWeekly hour:12 minute:55 year:2019 month:2 day:1 weekday:@[@1,@2]];
            //            [manager setAlarm:alarm1];
            [manager getAlarms:^(NSArray<AlarmModel *> * models, CRPError err) {
                for (AlarmModel *model in models){
                    NSLog(@"model.id = %d,model.enable = %d,model.type = %li, model.hour = %d, model.minute = %d, model.year = %d, model.month = %d, model.day = %d, model.weekday = %@",model.id,model.enable,model.type, model.hour, model.minute, model.year, model.month, model.day, model.weekday);
                }
            }];
            
            break;
        case 241:
            alarm1 = [[AlarmModel alloc]initWithId:0 enable:1 type:AlarmTypeEveryday hour:14 minute:05 year:2019 month:2 day:1 weekday:@[]];
            alarm2 = [[AlarmModel alloc]initWithId:1 enable:YES type:AlarmTypeOnce hour:17 minute:40 year:2019 month:6 day:18 weekday:@[@6]];
            alarm3 = [[AlarmModel alloc]initWithId:2 enable:1 type:AlarmTypeWeekly hour:15 minute:55 year:2019 month:2 day:1 weekday:@[@1,@2,@3,@4,@5,@6,@7]];
            [manager setAlarm:alarm1];
            [manager setAlarm:alarm2];
            [manager setAlarm:alarm3];
            break;
            
            //设置24小时心率间隔
        case 250:
            [manager set24HourHeartRate:0];
            break;
        case 251:
            [manager set24HourHeartRate:1];
            break;
        case 252:
            [manager set24HourHeartRate:2];
            break;
            
            //获取24小时心率间隔
        case 260:
            [manager get24HourHeartRateInterval:^(NSInteger interval, CRPError err) {
                NSLog(@"获取间隔%d",interval);
            }];
            break;
            //获取当天24小时心率
        case 261:
            //            [manager getFullDayHeartRate:^(NSArray<NSNumber *> * arr, CRPError err) {
            //                NSLog(@"全天心率 %@",arr);
            //            }];
            [manager get24HourHeartRate:^(NSArray<NSNumber *> * arr, enum CRPError err) {
                NSLog(@"今天全天心率 %@",arr);
            }];
            break;
            //获取昨天24小时心率
        case 262:
            [manager getAgo24HourHeartRate:^(NSArray<NSNumber *> * arr, CRPError err) {
                NSLog(@"昨天全天心率 %@",arr);
            }];
            break;
        case 270:
            {
                [manager getWatchFaceSupportModel:^(watchFaceSupportModel * model, CRPError err) {
                    NSLog(@"model.supportModel = %@, model.current = %d",model.supportModel, model.currentID);
                    supportModel = model.supportModel;
                }];
            }
            break;
        case 271:{
            [self getWatchInfo:self->supportModel :1 :18];
            break;
        case 272:
            if (self->info != NULL){
//                [manager startChangeWatchFace:self->info];
            }
            break;
            
        case 280:
            {
                [manager getScreenContent:^(ScreenContent * Content, ScreenImageSize * size, NSInteger compressionType, CRPError error) {
                    self->imageSize = size;
                    self->compressionType = compressionType;
                }];
                
            }
            break;
        case 281:
            {
                UIImage *image = [UIImage imageNamed:@"image"];
                if (self->imageSize != NULL && self->compressionType != NULL){
                    [manager startChangeScreen:image :self->imageSize :FALSE :compressionType];
                }
            }
            
            break;
        case 290:
            //            manager.fatigueReminder;
            {
                [manager getWatchFaceInfoByID:11 :^(NSArray<watchFaceInfo *> * infos, NSInteger total, NSInteger count, enum CRPError err) {
                    NSLog(@"info.count = %d",infos.count);
                    for (watchFaceInfo* info in infos){
                        NSLog(@"info.id = %d, info.model = %d,info.fileUrl = %@, info.imageURL = %@", info.id, info.model, info.fileUrl, info.imageUrl);
                    }
                }];
            }
            break;
        case 300:
            [manager get24HourSteps:^(NSArray<NSNumber *> * arr, enum CRPError err) {
                NSLog(@"今天全天步数统计 %@",arr);
            }];
            break;
        case 301:
            [manager getAgo24HourSteps:^(NSArray<NSNumber *> * arr, enum CRPError err) {
                NSLog(@"昨天全天步数统计 %@",arr);
            }];
            break;
        case 310:
            [manager getPhysiological:^(Physiological * phy, enum CRPError err) {
                NSLog(@"phy.reminderModels= %@,phy.cycleTime = %d, phy.menstruationTime = %d,phy.lastTimeMonth = %d,phy.lastTimeDay = %d,phy.remindTimeHour = %d,phy.remindTimeMinute = %d ",phy.reminderModels,phy.cycleTime,phy.menstruationTime,phy.lastTimeMonth,phy.lastTimeDay,phy.remindTimeHour,phy.remindTimeMinute);
            }];
            break;
        case 311:
            {
                Physiological * phy = [[Physiological alloc]initWithReminderModels:@[@2,@1,@0,@3] cycleTime:26 menstruationTime:7 lastTimeMonth:8 lastTimeDay:9 remindTimeHour:18 remindTimeMinute:16];
                [manager setPhysiological:phy];
            }
            break;
            
        case 320:
            {
                [manager getContactProfile:^(contactProfileModel * model, enum CRPError err) {
                    NSLog(@"max = %d, width = %d, height  = %d", model.contactMax, model.contactAvatarWidth, model.contactAvatarHeight);
                    self->contactmodel = model;
                }];
            }
            break;
        case 321:
            {
                UIImage *image = [UIImage imageNamed:@"image"];
                if (self->contactmodel != NULL ){
                    CRPContact * contact1 = [[CRPContact alloc]initWithContactID:0 fullName:@"0" image:image phoneNumber:@"0"];
                    CRPContact * contact2 = [[CRPContact alloc]initWithContactID:1 fullName:@"1" image:image phoneNumber:@"1"];
                    CRPContact * contact3 = [[CRPContact alloc]initWithContactID:2 fullName:@"2" image:image phoneNumber:@"2"];
                    CRPContact * contact4 = [[CRPContact alloc]initWithContactID:3 fullName:@"3" image:image phoneNumber:@"3"];
                    CRPContact * contact5 = [[CRPContact alloc]initWithContactID:4 fullName:@"4" image:image phoneNumber:@"4"];
                    NSArray<CRPContact *> * contacts = @[contact1, contact2, contact3, contact4, contact5];
                    [manager setContactWithProfile:self->contactmodel contacts:contacts];
                }
            }
            break;
        case 330:
            {
                [manager deleteContactWithContactID:0];
            }
            break;
        case 331:
            {
                [manager cleanAllContact];
            }
            break;
            
            
            
            
            
        }
        default:
            break;
        }
    }
}

- (void)getWatchInfo:(NSArray<NSNumber *> * _Nonnull)supportModel :(NSInteger)currentPage :(NSInteger)perPage {
    NSLog(@"currentPage = %d, perpage =%d",currentPage, perPage);
    CRPSmartBandSDK *manager = CRPSmartBandSDK.sharedInstance;
    [manager getWatchFaceInfo:supportModel currentPage:currentPage perPage:perPage :^(NSArray<watchFaceInfo *> * infos, NSInteger total, NSInteger count, enum CRPError err) {
        NSLog(@"infos = %@",infos);
        if (count > 0){
            [self getWatchInfo:supportModel :currentPage + 1 :perPage];
        }
    }];
}


@end


