//
//  SetViewController.swift
//  TestSdk
//
//  Created by sylar on 2017/5/22.
//  Copyright © 2017年 sylar. All rights reserved.
//

import UIKit
import CRPSmartBand

class SetViewController: UIViewController, CRPManagerDelegate {
    
    func receiveStress(_ stress: Int) {
        print("receiveStress =\(stress)")
    }
    
    func receiveHRV(_ hrv: Int) {
        print("hrv =\(hrv)")
    }
    
    func recevieTakePhoto() {
        print("recevieTakePhoto SetViewController")
    }
    
    func receiveUpgradeScreen(_ state: CRPUpgradeState, _ progress: Int) {
        print("state = \(state.description()), progress = \(progress) SetViewController")
    }
    
    func receiveUpgrede(_ state: CRPUpgradeState, _ progress: Int) {
        print("state = \(state.description()), progress = \(progress) SetViewController")
    }
    
    func receiveRealTimeHeartRate(_ heartRate: Int, _ rri: Int) {
        print("heart rate is \(heartRate)")
    }
    
    func receiveSpO2(_ o2: Int) {
        print("Spo2 = \(o2)")
    }
    
    func receiveStockRequestUpdateInfo() {
        print("receiveStockRequestUpdateInfo")
    }
    
    var contactProfile: contactProfileModel!
    var imageSize: ScreenImageSize!
    var compressionType: Int!

    override func viewDidLoad() {
        super.viewDidLoad()
        
        CRPSmartBandSDK.sharedInstance.delegate = self
        
        let scrool = self.view.viewWithTag(10) as! UIScrollView
        scrool.contentSize.height = 1100.0
        scrool.contentSize.width = 380.0
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }
    
    func didState(_ state: CRPState) {
        print("连接状态: \(state)")
    }
    
    func didBluetoothState(_ state: CRPBluetoothState) {
        print("蓝牙状态: \(state)")
    }
    
    func receiveSteps(_ model: StepModel) {
        print("最新步数: \(model)")
    }

    func receiveHeartRate(_ heartRate: Int) {
        print("最新心率: \(heartRate)")
    }
    
    func receiveHeartRateAll(_ model: HeartModel) {
        print(model)
    }
    
    func receiveBloodPressure(_ heartRate: Int, _ sbp: Int, _ dbp: Int) {
        print("血压: \(heartRate), \(sbp), \(dbp)")
    }
    func receiveECGDate(_ state: ecgState, _ data: [UInt32], completeTime: Int) {
        print("state=\(state.rawValue),data=\(data.count),time =\(completeTime)")
    }
    
    
    /*
    // MARK: - Navigation

    // In a storyboard-based application, you will often want to do a little preparation before navigation
    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        // Get the new view controller using segue.destinationViewController.
        // Pass the selected object to the new view controller.
    }
    */
    
    @IBAction func sendCmd(_ sender: UIButton) {
        let manager = CRPSmartBandSDK.sharedInstance
        switch sender.tag {
        case 90:
            manager.setFindDevice()
            
        //设置用户资料
        case 100:
            let model = ProfileModel(height: 190, weight: 90, age:-30, gender:.male)
            manager.setProfile(model)
        case 101:
//            let model = ProfileModel(height: 150, weight: 50, age:20, gender:.female)
//            manager.setProfile(model)
            manager.getProfile { (profile, err) in
                print("profile.height = \(profile.height), progile.weight = \(profile.weight),profile.age = \(profile.age), gender =\(profile.gender)")
            }
            
        //翻腕亮屏
        case 110:
            manager.setQuickView(false)
        case 111:
            manager.setQuickView(true)
            
        //时间格式:
        case 120:
            manager.setTimeFormat(0)
        case 121:
            manager.setTimeFormat(1)
            
        //左右手: 
        case 150:
            manager.setDominantHand(0)
        case 151:
            manager.setDominantHand(1)
           
        //表盘:
        case 160:
            manager.setDial(1)
        case 161:
            manager.setDial(2)
        case 162:
            manager.setDial(3)
            
            
        //单位:
        case 170:
            manager.setUnit(0)
        case 171:
            manager.setUnit(1)
            
            
        //久坐提醒:
        case 180:
            manager.setRemindersToMove(true)
        case 181:
            manager.setRemindersToMove(false)
            
            
        //心率监测:
        case 190:
//            manager.setStopHeart()
            manager.setStopSingleHR()
        case 191:
//            manager.setStartHeart()
            manager.setStartSingleHR()
            
            
        //血压
        case 200:
            manager.setStopBlood()
        case 201:
            manager.setStartBlood()
        case 202:
            manager.setCalibrationBlood(88, 110, 88)
            
        //消息推送::
        case 210:
            manager.setNotification([])
            break
        case 211:
            let swis = [NotificationType.phone, NotificationType.messages, NotificationType.qq, NotificationType.others]
            manager.setNotification(swis)
            break
            
            
        //设置目标:
        case 220:
            manager.setGoal(500)
        case 221:
            manager.setGoal(1000)
            
            
        //设置语言:
        case 230:
            manager.setLanguage(0)
        case 231:
            manager.setLanguage(1)
            
            
        //设置闹钟:
        case 240:
            let alarm = AlarmModel(id: 0, enable: 1, type: .weekly, hour: 12, minute: 55, year: 2017, month: 5, day: 24, weekday: [])
            manager.setAlarm(alarm)
        case 241:
            let alarm1 = AlarmModel(id: 0, enable: 1, type: .weekly, hour: 12, minute: 55, year: 2017, month: 5, day: 24, weekday: [])
            let alarm2 = AlarmModel(id: 1, enable: 1, type: .once, hour: 12, minute: 30, year: 2017, month: 5, day: 24, weekday: [])
            let alarm3 = AlarmModel(id: 2, enable: 1, type: .everyday, hour: 12, minute: 35, year: 2017, month: 5, day: 24, weekday: [])
            manager.setAlarm(alarm1)
            manager.setAlarm(alarm2)
            manager.setAlarm(alarm3)
            
        //设置24小时心率间隔
        case 250:
            manager.set24HourHeartRate(0)
        case 251:
            manager.set24HourHeartRate(1)
        case 252:
            manager.set24HourHeartRate(2)
            
        //获取24小时心率间隔
        case 260:
            manager.get24HourHeartRateInterval({ (interval, error) in
                print(interval)
                sender.setTitle("获取间隔(\(interval))", for: UIControlState.normal)
            })
        //获取当天24小时心率
        case 261:
            manager.get24HourHeartRate({ (hearts, error) in
                print("today heart.count = \(hearts.count), heart = \(hearts)")
            })
//            manager.getFullDayHeartRate({ (hearts, error) in
//                print(hearts)
//            })
        //获取昨天24小时心率
        case 262:
            manager.getAgo24HourHeartRate({ (hearts, error) in
                print("yesterday heart.count = \(hearts.count), heart = \(hearts)")
            })
            
        case 270:
            manager.getWatchFaceSupportModel { (model, error) in
                print("currentID = \(model.currentID)")
                print("supportModel = \(model.supportModel)")
            }
            
        case 271:
//            if let pathStr = Bundle.main.path(forResource: "watchFace2", ofType: "bin"){
//                manager.startChangeWathcFaceFromFile(path: pathStr)
//            }
            var currentPage = 1
            var perPage = 18
            getWatchInfo(model: [33], currentPage: currentPage, perPage: perPage)
            break
            
        case 280:
//            manager.fatigueReminder()
            manager.getWatchFaceInfoByID(11) { (infos, total, count, err) in
                print("infos.count = \(infos.count). total =\(total), count = \(count)")
                for info in infos{
                    print("info.file = \(info.fileUrl), info.image = \(info.imageUrl)")
                }

            }
            break
           
        case 290:
            manager.get24HourSteps { (steps, error) in
                print("Today steps =\(steps)")
            }
        case 291:
            manager.getAgo24HourSteps { (steps, error) in
                print("Yesterdays steps =\(steps)")
            }
        case 300:
            manager.getPhysiological { (phy, error) in
                print("getPhysiological = \(phy.reminderModels),\(phy.cycleTime),\(phy.menstruationTime),\(phy.lastTimeMonth),\(phy.lastTimeDay),\(phy.remindTimeHour),\(phy.remindTimeMinute)")
            }
        case 301:
            let physiological = Physiological(reminderModels: [reminderModel.menstruation.rawValue,reminderModel.ovulation.rawValue], cycleTime: 24, menstruationTime: 7, lastTimeMonth: 8, lastTimeDay: 3, remindTimeHour: 12, remindTimeMinute: 15)
            manager.setPhysiological(physiological)
            
        case 310:
            manager.getContactProfile { (model, error) in
                print("model.max = \(model.contactMax), model.width =\(model.contactAvatarWidth), model.height = \(model.contactAvatarHeight)")
                self.contactProfile = model
            }
        case 311:
            guard let image = UIImage(named: "image") else {
                return
            }
            guard self.contactProfile != nil else {
                return
            }
            let contact1 = CRPContact(contactID: 0, fullName: "0", image: image, phoneNumber: "0")
            let contact2 = CRPContact(contactID: 1, fullName: "1", image: image, phoneNumber: "1")
            let contact3 = CRPContact(contactID: 2, fullName: "2", image: image, phoneNumber: "2")
            let contact4 = CRPContact(contactID: 3, fullName: "3", image: image, phoneNumber: "3")
            let contact5 = CRPContact(contactID: 4, fullName: "4", image: image, phoneNumber: "4")
            
            let contacts = [contact1, contact2, contact3, contact4, contact5]
            
            manager.setContact(profile: self.contactProfile, contacts: contacts)
            
        case 320:
            manager.deleteContact(contactID: 0)
        case 321:
            manager.cleanAllContact()
        case 330:
            manager.getScreenContent { (content, imageSize, compressionType, error) in
                self.imageSize = imageSize
                self.compressionType = compressionType
            }
            break
        case 331:
            guard let image = UIImage(named: "image") else {
                return
            }
            if self.imageSize != nil && self.compressionType != nil {
                manager.startChangeScreen(image, self.imageSize, false, compressionType)
            }
            break
        case 340:
            manager.getStressIsSupport { value, error in
                print("value = \(value)")
            }
            
        case 341:
            manager.getStressRecord { stressRecordModels, error in
                for model in stressRecordModels{
                    print("value = \(model.value) ,time =\(model.time)")
                }
            }
        case 350:
            manager.setStartStress()
        case 351:
            manager.setStopStress()
        case 360:
            manager.getStockSupportInfo { value, error in
                NSLog("Stock support quantity = \(value)")
            }
        case 361:
            //Clear stock data
            manager.setNullStockData()
        case 370:
            let stock = CRPStockSelectionModel(id: 1, regularMarketOpen: 1000000, regularMarketDayHigh: 100, regularMarketDayLow: 99, regularMarketVolume: 98, peRatio: 2, marketCap: 3, fiftyTwoWeekHigh: 97, fiftyTwoWeekLow: 96, averageDailyVolume3Month: 95, regularMarketPrice: 94, currency: "CNY", shortName: "QWE", symbol: "CN", exchange: "ASD", regularMarketPreviousClose: 03, isOpen: true)
            manager.setStockData(data: stock)
        case 371:
            manager.deleteStock(id: 1)
        case 380:
            manager.setStockSequence(ids: [1,2])
            
        default:
            break
        }
    }
    
    func getWatchInfo(model: [Int], currentPage: Int, perPage: Int){
        print("currentPage = \(currentPage), perpage =\(perPage)")
        let manager = CRPSmartBandSDK.sharedInstance
        manager.getWatchFaceInfo(model, currentPage: currentPage, perPage: perPage) { (infos, total, count, err) in
            print("infos = \(infos)")
            if count > 0 {
                self.getWatchInfo(model: model, currentPage: currentPage + 1, perPage: perPage)
            }
        }
    }

}
