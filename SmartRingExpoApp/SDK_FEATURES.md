# QCBandSDK Available Features

## ✅ Currently Implemented

### Connection & Device Management
- ✅ Scan for devices
- ✅ Connect/disconnect
- ✅ Auto-reconnect
- ✅ Get paired device info
- ✅ Get connection state
- ✅ Get device MAC address
- ✅ Get firmware version

### Health Data (Read)
- ✅ Battery level & charging status
- ✅ Steps (current & historical)
- ✅ Heart Rate (real-time measurement, scheduled HR, manual HR)
- ✅ Sleep data (full day with naps)
- ✅ SpO2 (manual measurement)
- ✅ Blood Pressure (manual measurement)

### Real-time Monitoring
- ✅ Real-time heart rate streaming
- ✅ Battery updates
- ✅ Steps updates

---

## 🔴 NOT YET IMPLEMENTED (Available in SDK)

### Health Data (Read)
- ❌ **Temperature** - Scheduled & manual body temperature
  - `getSchedualTemperatureDataByDayIndex`
  - `getManualTemperatureDataByDayIndex`
  - `getTemperatureDataWithIntervalByDayIndex` (with interval)
  - `QCThreeValueTemperatureModel` (3-value temp model)

- ❌ **HRV (Heart Rate Variability)** - Scheduled HRV data
  - `getSchedualHRVDataWithDates`
  - `getSchedualHRVWithFinshed` (get status)
  - `setSchedualHRVStatus` (enable/disable)

- ❌ **Stress** - Scheduled stress monitoring
  - `getSchedualStressDataWithDates`
  - `getSchedualStressStatusWithFinshed`
  - `setSchedualStressStatus`

- ❌ **Blood Glucose** - Blood glucose monitoring
  - `getBloodGlucoseDataByDayIndex`

- ❌ **Exercise/Workout History** - Detailed workout records
  - `getExerciseDataWithLastUnixSeconds`
  - `getSportPlusSummaryFromTimestamp` (Sport+ V2)
  - `getSportPlusDetailsWithSummary`
  - `getSportRecordsFromLastTimeStamp`

- ❌ **Detailed Sport Data** - Minute-by-minute sport data
  - `getSportDetailDataByDay` (all day)
  - `getSportDetailDataByDay:minuteInterval:beginIndex:endIndex` (time range)

- ❌ **Scheduled Blood Pressure** - Historical scheduled BP
  - `getSchedualBPHistoryDataWithUserAge`
  - `getSchedualBPInfo` (get settings)
  - `setSchedualBPInfoOn` (configure)

- ❌ **Scheduled Blood Oxygen** - Historical scheduled SpO2
  - `getBloodOxygenDataByDayIndex`
  - `getBloodOxygenDataWithIntervalByDayIndex`
  - `getManualBloodOxygenDataByDayIndex`
  - `getSchedualBOInfo` / `setSchedualBOInfoOn`

- ❌ **Sedentary Reminders** - Historical sedentary data
  - `getSedentaryReminderFromDay`

### Health Data (Real-time Callbacks via QCSDKManager)
- ❌ **Real-time HRV** - `QCMeasuringTypeHRV`
- ❌ **Real-time Stress** - `QCMeasuringTypeStress`
- ❌ **Real-time Temperature** - `QCMeasuringTypeBodyTemperature` / `QCMeasuringTypeThreeValueBodyTemperature`
- ❌ **Real-time Blood Glucose** - `QCMeasuringTypeBloodGlucose`
- ❌ **One-Key Measurement** - `QCMeasuringTypeOneKeyMeasure` (measures HR, BP, SpO2 together)

### Device Settings & Configuration
- ❌ **User Profile** - Set/get user info (age, gender, height, weight, BP baseline, HR alarm)
  - `setTimeFormatTwentyfourHourFormat:...`
  - `getTimeFormatInfo`

- ❌ **Step Targets** - Set/get daily goals
  - `getStepTargetInfoWithSuccess`
  - `setStepTarget:calorieTarget:distanceTarget:sportDurationTarget:sleepDurationTarget`

- ❌ **Sedentary Reminders** - Configure reminders
  - `getSitLongRemindResult`
  - `setBeginTime:endTime:repeatModel:timeInterval`

- ❌ **Drink Water Reminders** - Set/get water reminders
  - `setDrinkWaterRemindIndex:type:time:cycle`
  - `getDrinkWaterRemindWithIndex`

- ❌ **Alarms** - Set/get device alarms
  - `getBandAlarmsWithFinish`
  - `setBandAlarms`

- ❌ **Do Not Disturb** - Configure DND mode
  - `getDontDisturbInfo`
  - `setDontDisturbOn:beginTime:endTime`

- ❌ **Flip Wrist Settings** - Configure wrist detection
  - `getFlipWristInfo`
  - `setFlipWristOn:flipType`
  - `getFlipWristInfoFinshed` / `setFlipWristInfo` (newer API)

- ❌ **Touch Control** - Configure touch gestures
  - `getTouchControlFinshed` / `setTouchControl`
  - `getTouchControlOfScreenDevieFinshed` / `setTouchControlOfScreenDevie`

- ❌ **Gesture Control** - Configure gesture recognition
  - `getGestureControlFinshed` / `setGestureControl`

- ❌ **Brightness** - Adjust screen brightness
  - `getDeviceLightLevelWithCurrentLevel`
  - `setDeviceLightLevel`

- ❌ **Screen Timeout** - Configure display duration
  - `getLightingSecondsWithSuccess`
  - `setLightingSeconds`

- ❌ **Home Page Settings** - Configure home screen
  - `setHomePageScreenOpType:lightingSeconds:homePageType:transparency:pictureType`

- ❌ **Low Power Mode** - Enable/disable power saving
  - `getLowPowerWithFinshed`
  - `setLowPowerWith`

- ❌ **Scheduled Measurements Config** - Configure auto-measurements
  - `setSchedualInfoType:featureOn:calibrate` (HR, SpO2, BP, Temp, Stress, HRV)
  - `getSchedualInfoType`

### Notifications & Alerts
- ❌ **Push Notification Filters** - Configure which apps send notifications
  - `getFilterSuccess`
  - `setFilter`

- ❌ **Find Phone** - Trigger ring to find phone
  - `lookupDeviceSuccess`

- ❌ **Alert Binding** - Vibration alert (already have method, but not exposed)

### Ring-Specific Features
- ❌ **Wear Calibration** - Calibrate ring wearing position
  - `startToWearCalibrationWithCompletedHandle`
  - `stopToWearCalibrationWithCompletedHandle`
  - `wearCalibration` (newer API with types)

- ❌ **Left/Right Hand Detection** - Configure which hand
  - Via `QCFlipWristInfoModel`

### Advanced Features
- ❌ **Weather** - Send weather data to ring
  - `getWeatherForecastStatusWithCurrentState`
  - `setWeatherForecastStatus`
  - `sendWeatherContents`

- ❌ **Menstrual Cycle** - Period tracking & reminders
  - `setMenstrualFeature:durationDay:intervalDay:startDay:endDay:remindState:...`

- ❌ **Contacts** - Sync contacts to ring
  - `setContacts:percentage:finish`

- ❌ **Music Control** - Control music from ring
  - Via touch/gesture control

- ❌ **Camera Control** - Take photos from ring
  - `switchToPhotoUISuccess`
  - `holdPhotoUISuccess`
  - `stopTakingPhotoSuccess`

- ❌ **Watch Face Management** - Custom dials
  - `listDialFileFinished`
  - `deleteDialFileName`
  - `syncDialFileName:binData:start:percentage:success:failed`
  - `syncImage:start:percentage:success:failed`
  - `getDialIndexWithFinshed` / `setDialIndexWith`

- ❌ **Custom Dial Parameters** - Configure dial display
  - `getDailParameterWithFinished`
  - `setDailParameter:date:value`

- ❌ **Praise/Prayer Data** - Get prayer tracking data
  - `getPraiseDataByDayIndexs`
  - `clearPraiseDataWithSuccess`

### Device Management
- ❌ **Factory Reset** - Reset to factory settings
  - `resetBandToFacotrySuccess`

- ❌ **Hard Reset** - Force restart
  - `resetBandHardlySuccess`

- ❌ **Shutdown** - Turn off device
  - `shutDownSuccess`

- ❌ **OTA Update** - Firmware update
  - `syncOtaBinData:start:percentage:success:failed`

- ❌ **Resource Files** - Sync missing files
  - `syncResourceFileName:binData:start:percentage:success:failed`
  - `getNeededFileListFinished`

- ❌ **UUID Management** - Set/get device UUID
  - `setUUID:success:failed`
  - `getUUID:success:failed`

- ❌ **End Broadcast** - Stop broadcasting
  - `endBroadcast:failed`

### Real-time Callbacks (via QCSDKManager properties)
- ❌ **Find Phone Callback** - `findPhone` property
- ❌ **Camera Callbacks** - `switchToPicture`, `takePicture`, `stopTakePicture`
- ❌ **Dial Index Change** - `dailIndex` property
- ❌ **Low Power Mode Change** - `lowerPower` property
- ❌ **Current Step Info** - `currentStepInfo` property (real-time steps/calories/distance)
- ❌ **Watch Data Updates** - `watchDataUpdateReport` property
- ❌ **Current Sport Info** - `currentSportInfo` property (real-time workout data)
- ❌ **Flip Wrist Info** - `flipWristInfo` property
- ❌ **Gesture/Touch Info** - `gestureAndTouchInfo` property
- ❌ **Touch Sleep Info** - `touchSleepInfo` property

### Sport Mode Control
- ❌ **Start/Stop Sport Mode** - Control workout sessions
  - `operateSportModeWithType:state:finish`

### Watch Call Features
- ❌ **Get BT Name** - Get calling watch BT name
  - `getWatchCallBTName`

---

## 📊 Summary

**Total SDK Methods**: ~150+  
**Currently Implemented**: ~15  
**Available but Not Implemented**: ~135+

### Priority Recommendations (Most Useful)

1. **Temperature Data** - Body temperature monitoring (especially useful for health tracking)
2. **HRV Data** - Heart Rate Variability (recovery & stress indicator)
3. **Stress Data** - Stress level monitoring
4. **Exercise History** - Detailed workout records
5. **Scheduled Measurements History** - Historical scheduled HR, SpO2, BP, Temp
6. **User Profile Settings** - Age, gender, height, weight (affects accuracy)
7. **Step Targets** - Daily goals
8. **Wear Calibration** - Improve measurement accuracy
9. **Real-time Callbacks** - Battery, steps, sport info updates
10. **Sedentary Reminders** - Health reminders

### Ring-Specific Features (Unique to Ring)

- Wear Calibration
- Touch/Gesture Control
- Flip Wrist Detection
- Left/Right Hand Configuration
- Three-Value Temperature Model

