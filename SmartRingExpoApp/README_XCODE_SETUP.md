# Xcode Setup Guide - Quick Reference

## 🎯 Current Status
- ✅ Expo prebuild complete
- ✅ Native bridge files created
- ✅ JavaScript services updated
- ✅ Xcode workspace open
- ⏳ **Manual Xcode configuration required**

## 🚀 Quick Setup (5 Steps)

### Step 1: Add QCBandSDK Framework (2 minutes)
1. In Xcode, select **SmartRing** project (blue icon at top)
2. Select **SmartRing** target (under TARGETS)
3. Click **General** tab
4. Scroll to **Frameworks, Libraries, and Embedded Content**
5. Click **+** button
6. Click **Add Other...** → **Add Files...**
7. Navigate to: `ios/Frameworks/QCBandSDK.framework`
8. Click **Open**
9. In the list, find QCBandSDK.framework and change **Do Not Embed** to **Embed & Sign**

### Step 2: Add QCBandBridge Files (1 minute)
1. In Project Navigator (left sidebar), right-click **SmartRing** folder
2. Select **Add Files to "SmartRing"...**
3. Navigate to: `ios/QCBandBridge/`
4. Select all 4 files:
   - QCBandBridge.h
   - QCBandBridge.m
   - QCCentralManager.h
   - QCCentralManager.m
5. **IMPORTANT**: Uncheck "Copy items if needed"
6. Select "Create groups" (not folder references)
7. Ensure **SmartRing** target is checked
8. Click **Add**

### Step 3: Add JstyleBridge Files (1 minute)
1. In Project Navigator, right-click **SmartRing** folder
2. Select **Add Files to "SmartRing"...**
3. Navigate to: `ios/JstyleBridge/`
4. Select all 8 files:
   - JstyleBridge.h
   - JstyleBridge.m
   - NewBle.h
   - NewBle.m
   - BleSDK_X3.h
   - BleSDK_Header_X3.h
   - DeviceData_X3.h
   - libBleSDK.a
5. **IMPORTANT**: Uncheck "Copy items if needed"
6. Select "Create groups"
7. Ensure **SmartRing** target is checked
8. Click **Add**

### Step 4: Verify Build Phases (1 minute)
1. Select **SmartRing** target → **Build Phases** tab

#### Check "Compile Sources":
Should include:
- ✅ QCBandBridge.m
- ✅ QCCentralManager.m
- ✅ JstyleBridge.m
- ✅ NewBle.m

#### Check "Link Binary With Libraries":
Should include:
- ✅ QCBandSDK.framework
- ✅ libBleSDK.a
- ✅ CoreBluetooth.framework (if missing, click **+** and add it)

### Step 5: Configure Search Paths (2 minutes)
1. Select **SmartRing** target → **Build Settings** tab
2. In the search box, type: **Header Search Paths**
3. Double-click the value column
4. Click **+** and add these 3 paths (all **recursive**):
   ```
   $(SRCROOT)/JstyleBridge
   $(SRCROOT)/QCBandBridge
   $(SRCROOT)/Frameworks
   ```

5. In the search box, type: **Framework Search Paths**
6. Add (if not present):
   ```
   $(SRCROOT)/Frameworks
   ```
   Set to **recursive**

7. In the search box, type: **Library Search Paths**
8. Add (if not present):
   ```
   $(SRCROOT)/JstyleBridge
   ```

## 🏗️ Build and Run

1. Connect a **physical iOS device** (Bluetooth doesn't work in simulator)
2. Select your device in Xcode
3. **Product** → **Clean Build Folder** (⌘⇧K)
4. **Product** → **Build** (⌘B)
5. Wait for build to complete (watch for errors)
6. **Product** → **Run** (⌘R)

## 🐛 Common Build Errors

### Error: "QCBandSDK/QCSDKManager.h file not found"
**Solution**: 
- Verify QCBandSDK.framework is in "Frameworks, Libraries, and Embedded Content"
- Check Framework Search Paths includes `$(SRCROOT)/Frameworks`

### Error: "libBleSDK.a not found"
**Solution**:
- Verify libBleSDK.a is in "Link Binary With Libraries"
- Check Library Search Paths includes `$(SRCROOT)/JstyleBridge`

### Error: "BleSDK_X3.h file not found"
**Solution**:
- Check Header Search Paths includes `$(SRCROOT)/JstyleBridge` (recursive)

### Error: "Duplicate symbol _OBJC_CLASS_$_..."
**Solution**:
- Go to Build Phases → Compile Sources
- Remove duplicate entries (each .m file should appear only once)

### Error: "Module 'JstyleBridge' not found" at runtime
**Solution**:
- Clean build folder (⌘⇧K)
- Delete `ios/build` folder
- Rebuild project
- Restart Metro bundler

## ✅ Verification Checklist

After building successfully, verify:

- [ ] Build completes without errors
- [ ] App launches on device
- [ ] No red screen errors
- [ ] Can navigate to device connection screen
- [ ] Bluetooth permission prompt appears (first launch)

## 📱 Testing the Dual-SDK System

### Test R1 Device (QCBandSDK)
1. Open app on device
2. Tap "Scan for Devices"
3. Look for devices starting with "R10_"
4. Device should show as "FOCUS R1"
5. Tap to connect
6. Verify connection success

### Test X3 Device (Jstyle SDK)
1. Open app on device
2. Tap "Scan for Devices"
3. Look for X3 devices (service UUID FFF0)
4. Device should show as "FOCUS X3"
5. Tap to connect
6. Verify connection success

## 🎯 Success Criteria

✅ **Build succeeds** - No compilation errors
✅ **App launches** - No runtime crashes
✅ **Scanning works** - Discovers both R1 and X3 devices
✅ **Connection works** - Can connect to both device types
✅ **Data retrieval works** - Can fetch steps, sleep, HR data
✅ **SDK switching works** - Can switch between R1 and X3

## 📚 Additional Resources

- **SETUP_COMPLETE.md** - Full setup summary
- **XCODE_SETUP_INSTRUCTIONS.md** - Detailed instructions
- **AGENTS.md** - Architecture documentation
- **X3_JSTYLE_SDK.md** - X3 SDK technical details

## 🆘 Need Help?

If you encounter issues:
1. Check the error message carefully
2. Refer to "Common Build Errors" section above
3. Clean build folder and retry
4. Check that all files are properly added to target
5. Verify search paths are correct

## 🎉 Next Steps After Successful Build

1. Test with physical R1 device
2. Test with physical X3 device
3. Verify data accuracy
4. Test auto-reconnect feature
5. Test real-time data streaming
6. Test dual-device switching

---

**Estimated Time**: 7-10 minutes for complete Xcode setup
**Difficulty**: Beginner-friendly (just follow steps)
**Prerequisites**: Xcode installed, iOS device connected
