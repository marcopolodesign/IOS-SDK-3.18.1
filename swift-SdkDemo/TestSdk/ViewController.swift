//
//  ViewController.swift
//  TestSdk
//
//  Created by sylar on 2017/5/15.
//  Copyright © 2017年 sylar. All rights reserved.
//

import UIKit
import CRPSmartBand

class ViewController: UIViewController, CRPManagerDelegate {
    
    
    func recevieTakePhoto() {
        print("recevieTakePhoto")
    }
    
    
    func receiveUpgradeScreen(_ state: CRPUpgradeState, _ progress: Int) {
        print("state = \(state.description()), progress = \(progress)")
        
    }
    
    func receiveRealTimeHeartRate(_ heartRate: Int, _ rri: Int) {
        print("heart rate is \(heartRate)")
    }
    func receiveUpgrede(_ state: CRPUpgradeState, _ progress: Int) {
        print("state = \(state.description()), progress = \(progress)")
    }
    func recevieWeather() {
        print("recevieWeather")
    }
    
    func receiveGPTState(type: CRPGPTType, state: CRPGPTRequestState, result: NSData) {
        NSLog("type: \(type.rawValue), state: \(state.rawValue), result: \(result.count)")
        
        switch state{
        case .ready:
            CRPSmartBandSDK.sharedInstance.setGPTState(type: type, state: .ready)
        case .cancel:
            break
        case .parseFail:
            break
        case .parseSuccess:
            break
        }
    }
    
    func receiveRequestGPTPreviewImage() {
        
    }
    
    func receiveRequestGPTImage() {
        
    }
    
    
    
//    func receiveCalling() {
//        print("receiveCalling")
//    }
    
    @IBOutlet weak var scrollView: UIScrollView!
    @IBOutlet weak var macField: UITextField!
    
    //Local upgrade file address
    var path = ""
    
    var verStr = ""
    var macStr = ""
    var mcu: Int? = 0
    var upgradefileDownUrl: String? = ""

    override func viewDidLoad() {
        super.viewDidLoad()
        // Do any additional setup after loading the view, typically from a nib.
        
//        _ = CRPSmartBandSDK.sharedInstance
        CRPSmartBandSDK.sharedInstance.delegate = self
        
        self.getStep { (step) in
            print(step)
        }
        var mac = ""
        
        
//        self.macField.text = "dc:57:10:55:fb:bd"
        self.scrollView.contentSize.height = 1000.0
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        // Dispose of any resources that can be recreated.
    }
    @IBAction func endInput(_ sender: UITextField) {
        sender.endEditing(true)
    }
    
    public typealias stepHandler = ((_ step: Int) -> Void)
    
    var myStepHandler:stepHandler!

    func getStep(_ handler: @escaping stepHandler) {
        myStepHandler = handler
    }

    func didState(_ state: CRPState) {
        print("Connect state: \(state.rawValue)")
        if state == .connected{
            CRPSmartBandSDK.sharedInstance.checkDFUState { (dfu, err) in
                print("dfu =\(dfu)")
            }
        }
    }
    
    func didBluetoothState(_ state: CRPBluetoothState) {
        print("Bluetooth state \(state)")
    }
    
    func receiveSteps(_ model: StepModel) {
        print("Latest steps: \(model.steps)")
    }
    func receiveHeartRate(_ heartRate: Int) {
        print("Latest heart rate: \(heartRate)")
    }
    
    func receiveHeartRateAll(_ model: HeartModel) {
        print("receiveHeartRateAll =\(model.starttime)")
    }
    
    func receiveBloodPressure(_ heartRate: Int, _ sbp: Int, _ dbp: Int) {
        print("BP: \(heartRate), \(sbp), \(dbp)")
    }
    func receiveSpO2(_ o2:Int){
        print("SpO2 = \(o2)")
    }
    
    func receiveCalling() {
        print("receiveCalling")
    }
    
    
    func receiveSportState(_ state: SportType, _ err: Int) {
        print("receiveSportState state = \(state), err =\(err)")
    }
    
    var discoverys = [CRPDiscovery]()
    var myDiscovery:CRPDiscovery!
    
    
    //:MARK 扫描
    @IBAction func scan(_ sender: UIButton) {
        var mac = self.macField.text!
//        if (mac == "") {
//            let alert = UIAlertController(title: "请输入手环的MAC", message: "", preferredStyle: UIAlertControllerStyle.alert)
//
//            let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
//            alert.addAction(cancel)
//
//            self.present(alert, animated: true, completion: nil)
//            return
//        }
        
        CRPSmartBandSDK.sharedInstance.scan(10, progressHandler: { (newDiscoverys) in
            let p = newDiscoverys[0]
            self.discoverys.append(p)
            print("p.ver = \(p.ver) mac =\(p.mac)")
            if (mac == "") {
                if (p.localName?.contains("F605"))! {
                    mac = p.mac!
                    self.macField.text = p.mac
                    
                    self.myDiscovery = p
                    self.stop(UIButton())
                    
                    let alert = UIAlertController(title: "", message: "Scanned to:\(mac)，please Bind", preferredStyle: UIAlertControllerStyle.alert)
                    let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
                    alert.addAction(cancel)
                    self.present(alert, animated: true, completion: nil)
                }
            }
            else if ((p.mac?.contains(mac))!) {
                self.myDiscovery = p
                self.stop(UIButton())
                
                let alert = UIAlertController(title: "", message: "Scanned to:\(mac)，Please Bind", preferredStyle: UIAlertControllerStyle.alert)
                let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
                alert.addAction(cancel)
                self.present(alert, animated: true, completion: nil)
            }
        }) { (newDiscoverys, err) in
            print("error = \(err)")
            print("ok")
        }
        
        CRPSmartBandSDK.sharedInstance.scan(10, progressHandler: <#T##scanProgressHandler?##scanProgressHandler?##(_ newDiscoveries: [CRPDiscovery]) -> Void#>, completionHandler: <#T##scanCompletionHandler?##scanCompletionHandler?##(_ result: [CRPDiscovery]?, _ error: CRPError) -> Void#>)


    }
    
    
    //:MARK 停止扫描
    @IBAction func stop(_ sender: UIButton) {
        
        CRPSmartBandSDK.sharedInstance.interruptScan()
    }
    
    
    //:MARK 绑定
    @IBAction func bind(_ sender: UIButton) {
        
        if (self.myDiscovery != nil) {
            CRPSmartBandSDK.sharedInstance.connet(self.myDiscovery)
            
            let alert = UIAlertController(title: "", message: "connected", preferredStyle: UIAlertControllerStyle.alert)
            let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
            alert.addAction(cancel)
            self.present(alert, animated: true, completion: nil)
        }
        else {
            let mac = self.macField.text!
            let alert = UIAlertController(title: "", message: "Can not find:\(mac)", preferredStyle: UIAlertControllerStyle.alert)
            let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
            alert.addAction(cancel)
            self.present(alert, animated: true, completion: nil)
        }
    }
    
    
    //:MARK 解除绑定
    @IBAction func unbind(_ sender: UIButton) {
        CRPSmartBandSDK.sharedInstance.remove { (state, err) in
            
            let alert = UIAlertController(title: "", message: "Undind finish", preferredStyle: UIAlertControllerStyle.alert)
            let cancel = UIAlertAction(title: "OK", style: UIAlertActionStyle.default, handler: nil)
            alert.addAction(cancel)
            self.present(alert, animated: true, completion: nil)
        }
    }
    
    //:MARK 断开连接
    @IBAction func disconnect(_ sender: UIButton) {
        CRPSmartBandSDK.sharedInstance.disConnet()
    }
    
    //:MARK 重新连接
    @IBAction func reconnect(_ sender: UIButton) {
        CRPSmartBandSDK.sharedInstance.reConnet()
    }
    
    @IBAction func getCmd(_ sender: UIButton) {
        let manager = CRPSmartBandSDK.sharedInstance
        switch sender.tag {
        case 10:
            manager.getSteps({ (model, error) in
                print(model)
//                let cal
//                let text = "Step:\(model)"
                (self.view.viewWithTag(20) as! UILabel).text = "\(model.steps)step \(model.calory)kcal \(model.distance)m , \(model.time)s"
            })
        case 11:
            manager.getSleepData({ (model, error) in
                print(model)
                (self.view.viewWithTag(21) as! UILabel).text = "Deep sleep\(model.deep)Minute Light sleep\(model.light)Minute"
            })
        case 100:
            manager.getFeatures({ (features, error) in
                print("Support：\(features)")
            })

        case 101:
            manager.getSoftver({ (ver, error) in
                print(error)
                (self.view.viewWithTag(201) as! UILabel).text = ver
                print("varsion：\(ver)")
            })
        case 102:
            manager.getBattery({ (battery, error) in
                (self.view.viewWithTag(202) as! UILabel).text = String(battery)
                print("Battery：\(battery)")
            })
        case 103:
            manager.getGoal({ (value, error) in
                (self.view.viewWithTag(203) as! UILabel).text = String(value)
                print("Goal：\(value)")
            })
        case 104:
            manager.getDominantHand({ (value, error) in
                (self.view.viewWithTag(204) as! UILabel).text = String(value)
                print("Hand：\(value)")
            })
        case 106:
            manager.getAlarms({ (alarms, error) in
                print(alarms)
            })
        case 107:
            manager.getProfile({ (profile, error) in
                (self.view.viewWithTag(207) as! UILabel).text = "\(profile)"
            })
        case 108:
            manager.getLanguage { (value, CRPErrorerror) in
                (self.view.viewWithTag(208) as! UILabel).text = "\(value)"
            } _: { (indexs, error) in
                print("index = \(indexs)")
            }

        case 109:
            manager.getDial({ (value, error) in
                (self.view.viewWithTag(209) as! UILabel).text = "\(value)"
            })
        case 110:
            manager.getRemindersToMove({ (value, error) in
                (self.view.viewWithTag(210) as! UILabel).text = "\(value)"
            })
        case 111:
            manager.getQuickView({ (value, error) in
                (self.view.viewWithTag(211) as! UILabel).text = "\(value)"
            })
        case 112:
            manager.getUnit({ (value, error) in
                (self.view.viewWithTag(212) as! UILabel).text = "\(value)"
            })
        case 113:
            manager.getTimeformat({ (value, error) in
                (self.view.viewWithTag(213) as! UILabel).text = "\(value)"
            })
        case 114:
            manager.getMac({ (value, error) in
                (self.view.viewWithTag(214) as! UILabel).text = "\(value)"
            })
        case 115:
            manager.getNotifications({ (value, error) in
                print(value)
            })
        case 116:
            manager.getNotifications({ (value, error) in
                print(value)
                (self.view.viewWithTag(216) as! UILabel).text = "\(value.description)"
            })
        case 117:
            manager.setStartSpO2()
          
        case 118:
            manager.setStopSpO2()
            
        case 119:
            
            ///Step1
            manager.getSoftver { (ver, err) in
                self.verStr = ver
            }
            
            manager.getMac { (mac, err)in
                self.macStr = mac
            }
            
            ///After Step1 ->Step2:
            /// Get the new version firmware from our server
//            manager.checkLatest(verStr, macStr) { (newVersionInfo, newVersionTpInfo,err ) in
//                self.mcu = newVersionInfo?.mcu
//                self.upgradefileDownUrl = newVersionInfo?.fileUrl
//            }
            ///Step3: Use upgradefileDownUrl to download the file

        case 120:
            /*
             chip: Nordic;Hunter;RealTek;Goodix
             
             Hunter: Mcu = 4/8/9
             ReakTek: Mcu = 7/11/12/71/72
             Goodix : Mcu = 10
             Nordic: Mcu = Other
             */
            if mcu != nil {
                switch mcu {
                case 4,8,9:
                    manager.getOTAMac { (otaMac, err) in
                        manager.startOTAFromFile(mac: otaMac, zipFilePath: self.path, isUser: false)
                    }
                case 7,11,12,71,72:
                    manager.startRealTekUpgradeFromFile(path: path, timeoutInterval: 30)
                case 10:
                    manager.startGoodixUpgradeFromFile(zipPath: path)
                default:
                    manager.startUpgradeFromFile(path: path)
                }
            }
            
        default:
            break
        }
    }
    
    
}

