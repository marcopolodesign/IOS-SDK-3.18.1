# Xcode Setup Instructions for Dual-SDK Architecture

## Overview

This document outlines the steps needed to configure the Xcode project to support both the QCBandSDK (Focus R1) and Jstyle BleSDK_X3 (Focus X3) smart rings.

## Current Status

✅ Expo prebuild completed
✅ Frameworks copied to `ios/Frameworks/`
✅ JstyleBridge files created in `ios/JstyleBridge/`
✅ QCBandBridge files restored to `ios/QCBandBridge/`
✅ Xcode workspace opened: `ios/SmartRing.xcworkspace`

## Required Xcode Configuration

### 1. Add QCBandSDK Framework

1. In Xcode, select the **SmartRing** project in the navigator
2. Select the **SmartRing** target
3. Go to the **General** tab
4. Scroll to **Frameworks, Libraries, and Embedded Content**
5. Click the **+** button
6. Click **Add Other...** → **Add Files...**
7. Navigate to `ios/Frameworks/QCBandSDK.framework`
8. Select it and click **Open**
9. Change the embed setting to **Embed & Sign**

### 2. Add QCBandBridge Files

1. Right-click on the **SmartRing** folder in the project navigator
2. Select **Add Files to "SmartRing"...**
3. Navigate to `ios/QCBandBridge/`
4. Select all files:
   - `QCBandBridge.h`
   - `QCBandBridge.m`
   - `QCCentralManager.h`
   - `QCCentralManager.m`
5. Ensure **"Copy items if needed"** is **unchecked** (we want references)
6. Ensure **"Create groups"** is selected
7. Ensure **SmartRing** target is checked
8. Click **Add**

### 3. Add JstyleBridge Files

1. Right-click on the **SmartRing** folder in the project navigator
2. Select **Add Files to "SmartRing"...**
3. Navigate to `ios/JstyleBridge/`
4. Select all files:
   - `JstyleBridge.h`
   - `JstyleBridge.m`
   - `NewBle.h`
   - `NewBle.m`
   - `BleSDK_X3.h`
   - `BleSDK_Header_X3.h`
   - `DeviceData_X3.h`
   - `libBleSDK.a`
5. Ensure **"Copy items if needed"** is **unchecked**
6. Ensure **"Create groups"** is selected
7. Ensure **SmartRing** target is checked
8. Click **Add**

### 4. Verify Build Phases

#### Compile Sources
Go to **Build Phases** → **Compile Sources** and verify these files are present:
- `QCBandBridge.m`
- `QCCentralManager.m`
- `JstyleBridge.m`
- `NewBle.m`

#### Link Binary With Libraries
Go to **Build Phases** → **Link Binary With Libraries** and verify:
- `QCBandSDK.framework`
- `libBleSDK.a`
- `CoreBluetooth.framework` (add if missing)

### 5. Configure Header Search Paths

1. Select the **SmartRing** target
2. Go to **Build Settings**
3. Search for "Header Search Paths"
4. Add these paths (if not already present):
   ```
   $(SRCROOT)/JstyleBridge
   $(SRCROOT)/QCBandBridge
   $(SRCROOT)/Frameworks
   ```
   Set to **recursive** for each

### 6. Configure Framework Search Paths

1. In **Build Settings**, search for "Framework Search Paths"
2. Add:
   ```
   $(SRCROOT)/Frameworks
   ```
   Set to **recursive**

### 7. Configure Library Search Paths

1. In **Build Settings**, search for "Library Search Paths"
2. Add:
   ```
   $(SRCROOT)/JstyleBridge
   ```

### 8. Enable Bluetooth Permissions

Verify in `Info.plist` (should be auto-configured by Expo):
- `NSBluetoothAlwaysUsageDescription`
- `NSBluetoothPeripheralUsageDescription`

### 9. Bridging Header (if needed)

If you see Swift/Objective-C bridging issues:
1. Go to **Build Settings**
2. Search for "Objective-C Bridging Header"
3. Ensure it points to the correct bridging header file

### 10. Build and Test

1. Select a physical iOS device (Bluetooth doesn't work in simulator)
2. Click **Product** → **Clean Build Folder** (Cmd+Shift+K)
3. Click **Product** → **Build** (Cmd+B)
4. Fix any compilation errors
5. Click **Product** → **Run** (Cmd+R)

## Expected Build Targets

After configuration, you should see:
- **SmartRing** target with both bridges compiled
- Both frameworks linked
- No missing header errors
- No missing library errors

## Troubleshooting

### "QCBandSDK/QCSDKManager.h file not found"
- Verify QCBandSDK.framework is in **Frameworks, Libraries, and Embedded Content**
- Verify Framework Search Paths includes `$(SRCROOT)/Frameworks`

### "libBleSDK.a not found"
- Verify libBleSDK.a is in **Link Binary With Libraries**
- Verify Library Search Paths includes `$(SRCROOT)/JstyleBridge`

### "BleSDK_X3.h file not found"
- Verify Header Search Paths includes `$(SRCROOT)/JstyleBridge`

### "Duplicate symbols" error
- Check that files aren't added multiple times in Compile Sources

### "Module 'JstyleBridge' not found" in React Native
- Verify JstyleBridge.m has `RCT_EXPORT_MODULE();`
- Clean build folder and rebuild
- Restart Metro bundler

## Next Steps After Successful Build

1. Test QCBand (R1) device connection
2. Test Jstyle (X3) device connection
3. Verify dual-SDK switching in `UnifiedSmartRingService`
4. Test data retrieval from both device types
5. Verify data normalization in JS layer

## Files Modified/Created

- ✅ `ios/QCBandBridge/QCBandBridge.h` (restored)
- ✅ `ios/QCBandBridge/QCBandBridge.m` (restored)
- ✅ `ios/QCBandBridge/QCCentralManager.h` (restored)
- ✅ `ios/QCBandBridge/QCCentralManager.m` (restored)
- ✅ `ios/JstyleBridge/JstyleBridge.h` (created)
- ✅ `ios/JstyleBridge/JstyleBridge.m` (created)
- ✅ `ios/JstyleBridge/NewBle.h` (copied from SDK)
- ✅ `ios/JstyleBridge/NewBle.m` (copied from SDK)
- ✅ `ios/JstyleBridge/BleSDK_X3.h` (copied from SDK)
- ✅ `ios/JstyleBridge/BleSDK_Header_X3.h` (copied from SDK)
- ✅ `ios/JstyleBridge/DeviceData_X3.h` (copied from SDK)
- ✅ `ios/JstyleBridge/libBleSDK.a` (copied from SDK)
- ✅ `ios/Frameworks/QCBandSDK.framework` (copied)

## Reference Documentation

- `AGENTS.md` - Dual-SDK architecture overview
- `X3_JSTYLE_SDK.md` - X3 SDK technical documentation
- `src/services/UnifiedSmartRingService.ts` - SDK routing layer
- `src/services/JstyleService.ts` - X3 JavaScript wrapper
- `src/services/QCBandService.ts` - R1 JavaScript wrapper
