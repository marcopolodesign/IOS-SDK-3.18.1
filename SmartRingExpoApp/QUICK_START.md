# Quick Start Guide

Get the Smart Ring Expo app running in 5 minutes!

## Prerequisites Check

- [ ] Node.js 18+ installed
- [ ] Xcode 14+ installed
- [ ] CocoaPods installed (`sudo gem install cocoapods`)
- [ ] Physical iOS device (Bluetooth doesn't work in simulator)

## Quick Setup

### 1. Install Dependencies

```bash
cd SmartRingExpoApp
npm install
```

### 2. Generate iOS Project

```bash
npx expo prebuild --platform ios
```

### 3. Copy SDK Frameworks

```bash
./setup-frameworks.sh
```

Or manually:
```bash
cp -R ../OC-SDKDemo/*.framework ios/
cp ../OC-SDKDemo/libopus.a ios/
```

### 4. Configure Xcode (One-time setup)

1. Open `ios/SmartRingExpoApp.xcworkspace` (or `.xcodeproj` if workspace doesn't exist)
2. Select your project → Target → **General** tab
3. Scroll to **"Frameworks, Libraries, and Embedded Content"**
4. Click **+** and add:
   - CRPSmartBand.framework
   - RTKLEFoundation.framework
   - RTKOTASDK.framework
   - OTAFramework.framework
   - SpeexKit.framework
5. Set each to **"Embed & Sign"**
6. Go to **Build Phases** → **Link Binary With Libraries**
7. Add `libopus.a`

### 5. Build and Run

```bash
# Build and run on device
npx expo run:ios

# Or start dev server
npx expo start --dev-client
```

## That's It! 🎉

The app should now:
- Scan for smart ring devices
- Connect to your ring
- Display health metrics (steps, heart rate, sleep, etc.)

## Troubleshooting

**Build errors?**
- Clean: Product → Clean Build Folder (Cmd+Shift+K)
- Check framework paths in Build Settings

**Can't find frameworks?**
- Make sure you ran `./setup-frameworks.sh`
- Verify frameworks are in `ios/` directory

**App crashes?**
- Check device logs in Xcode
- Verify Bluetooth permissions

For detailed help, see `SETUP_GUIDE.md` or `README.md`.





