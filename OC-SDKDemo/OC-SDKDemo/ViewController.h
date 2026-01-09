//
//  ViewController.h
//  OC-SDKDemo
//
//  Created by sylar on 2018/5/11.
//  Copyright © 2018年 sylar. All rights reserved.
//

#import <UIKit/UIKit.h>

@interface ViewController : UIViewController
@property (weak, nonatomic) IBOutlet UIScrollView *scrollView;
@property (weak, nonatomic) IBOutlet UITextField *macText;
- (IBAction)Scan:(UIButton *)sender;
- (IBAction)stopScan:(UIButton *)sender;
- (IBAction)reConnect:(UIButton *)sender;
- (IBAction)disconnect:(UIButton *)sender;
- (IBAction)bind:(UIButton *)sender;
- (IBAction)unbind:(UIButton *)sender;
- (IBAction)getSteps:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *step;
- (IBAction)getVersion:(UIButton *)sender;
- (IBAction)sleepData:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *sleep;
@property (weak, nonatomic) IBOutlet UILabel *version;
- (IBAction)getBattery:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *battery;
- (IBAction)getGoal:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *goal;
- (IBAction)getLanguage:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *language;
- (IBAction)getScreen:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *screen;
- (IBAction)getMac:(UIButton *)sender;
@property (weak, nonatomic) IBOutlet UILabel *macAddress;
- (IBAction)setNotifitions:(UIButton *)sender;
- (IBAction)startO2:(UIButton *)sender;
- (IBAction)stopO2:(UIButton *)sender;
- (IBAction)sendCmd:(UIButton *)sender;




@end
