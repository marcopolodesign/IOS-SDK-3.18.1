# Detailed Setup Guide

This guide walks you through setting up the Smart Ring Expo app step by step.

## Step-by-Step Setup

### 1. Initial Project Setup

```bash
# Navigate to the project directory
cd SmartRingExpoApp

# Install dependencies
npm install

# Install Expo CLI globally (if not already installed)
npm install -g expo-cli
```

### 2. Generate iOS Project

```bash
# Generate native iOS project
npx expo prebuild --platform ios
```

This creates the `ios/` directory with the Xcode project.

### 3. Add SDK Frameworks

#### Option A: Manual Copy (Recommended)

```bash
# From the SmartRingExpoApp directory
cd ios

# Copy frameworks (adjust path as needed)
cp -R ../OC-SDKDemo/CRPSmartBand.framework .
cp -R ../OC-SDKDemo/RTKLEFoundation.framework .
cp -R ../OC-SDKDemo/RTKOTASDK.framework .
cp -R ../OC-SDKDemo/OTAFramework.framework .
cp -R ../OC-SDKDemo/SpeexKit.framework .
cp ../OC-SDKDemo/libopus.a .
```

#### Option B: Create Script

Create a script `setup-frameworks.sh`:

```bash
#!/bin/bash
SDK_DIR="../OC-SDKDemo"
IOS_DIR="ios"

echo "Copying frameworks..."

cp -R "$SDK_DIR/CRPSmartBand.framework" "$IOS_DIR/"
cp -R "$SDK_DIR/RTKLEFoundation.framework" "$IOS_DIR/"
cp -R "$SDK_DIR/RTKOTASDK.framework" "$IOS_DIR/"
cp -R "$SDK_DIR/OTAFramework.framework" "$IOS_DIR/"
cp -R "$SDK_DIR/SpeexKit.framework" "$IOS_DIR/"
cp "$SDK_DIR/libopus.a" "$IOS_DIR/"

echo "Frameworks copied successfully!"
```

Make it executable:
```bash
chmod +x setup-frameworks.sh
./setup-frameworks.sh
```

### 4. Configure Xcode Project

1. **Open the workspace** (NOT the .xcodeproj):
   ```bash
   open ios/SmartRingExpoApp.xcworkspace
   ```
   If the workspace doesn't exist, open:
   ```bash
   open ios/SmartRingExpoApp.xcodeproj
   ```

2. **Add Frameworks to Project:**
   - In Xcode, right-click on your project in the navigator
   - Select "Add Files to SmartRingExpoApp..."
   - Navigate to `ios/` folder
   - Select all the `.framework` files
   - Make sure "Copy items if needed" is **unchecked** (they're already in the right place)
   - Click "Add"

3. **Link Frameworks:**
   - Select your project in the navigator
   - Select your app target
   - Go to **Build Phases** tab
   - Expand **"Link Binary With Libraries"**
   - Click **+** and add:
     - CRPSmartBand.framework
     - RTKLEFoundation.framework
     - RTKOTASDK.framework
     - OTAFramework.framework
     - SpeexKit.framework
     - libopus.a

4. **Embed Frameworks:**
   - Still in **Build Phases**
   - Expand **"Embed Frameworks"** (if it doesn't exist, add it)
   - Click **+** and add all frameworks
   - Set each to **"Embed & Sign"**

5. **Configure Search Paths:**
   - Go to **Build Settings** tab
   - Search for **"Framework Search Paths"**
   - Add: `$(PROJECT_DIR)` (recursive)
   - Search for **"Library Search Paths"**
   - Add: `$(PROJECT_DIR)` (recursive)

### 5. Add Native Module to Xcode

1. **Add Bridge Files:**
   - In Xcode, right-click on your project
   - Select "Add Files to SmartRingExpoApp..."
   - Navigate to `ios/SmartRingBridge/`
   - Select `SmartRingBridge.h` and `SmartRingBridge.m`
   - Make sure your target is checked
   - Click "Add"

2. **Verify Files are Added:**
   - Check that both files appear in your project navigator
   - Make sure they're included in your target's "Compile Sources"

### 6. Configure Info.plist

The `app.json` should already have the Bluetooth permissions, but verify in Xcode:

1. Open `ios/SmartRingExpoApp/Info.plist`
2. Verify these keys exist:
   - `NSBluetoothAlwaysUsageDescription`
   - `NSBluetoothPeripheralUsageDescription`
   - `UIBackgroundModes` with `bluetooth-central`

### 7. Install CocoaPods (if needed)

```bash
cd ios
pod install
cd ..
```

### 8. Build and Run

#### Development Build

```bash
# Build for development
npx expo run:ios

# Or use EAS Build
eas build --profile development --platform ios
```

#### Start Development Server

```bash
# Start Expo dev server
npx expo start --dev-client

# In another terminal, run on device
npx expo run:ios
```

## Common Issues and Solutions

### Issue: "Framework not found: CRPSmartBand"

**Solution:**
1. Verify frameworks are in `ios/` directory
2. Check Framework Search Paths includes `$(PROJECT_DIR)`
3. Clean build: Product → Clean Build Folder (Cmd+Shift+K)
4. Rebuild

### Issue: "Undefined symbols" or linking errors

**Solution:**
1. Make sure all frameworks are in "Link Binary With Libraries"
2. Verify `libopus.a` is linked
3. Check that frameworks are set to "Embed & Sign"

### Issue: Swift/Objective-C bridging errors

**Solution:**
1. Create bridging header (see README.md Step 5)
2. Set bridging header path in Build Settings
3. Make sure CRPSmartBand-Swift.h is accessible

### Issue: "Module 'CRPSmartBand' not found"

**Solution:**
1. Verify framework is added to project
2. Check Framework Search Paths
3. Clean and rebuild

### Issue: App crashes on launch

**Solution:**
1. Check device logs in Xcode (Window → Devices and Simulators)
2. Verify Bluetooth permissions are granted
3. Make sure you're using a development build, not Expo Go

## Testing Checklist

- [ ] Project builds without errors
- [ ] App launches on device/simulator
- [ ] Bluetooth permissions are requested
- [ ] Scan button works
- [ ] Devices are discovered
- [ ] Connection works
- [ ] Data retrieval works

## Next Steps After Setup

1. Test basic connection
2. Verify data retrieval
3. Test real-time monitoring
4. Add more features from the SDK
5. Customize UI/UX

## Need Help?

- Check Xcode build logs for specific errors
- Review the SDK documentation in `IOS-SDK Development Guide.pdf`
- Look at the demo projects for reference implementations





