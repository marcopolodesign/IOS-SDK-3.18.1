# Mock Data / Sample Data Guide

The app includes a **mock data mode** that provides sample data so you can test the UI and app functionality without needing a physical smart ring device.

## What is Mock Data Mode?

Mock data mode simulates a smart ring device with realistic sample data:
- **2 mock devices** that can be "discovered" when scanning
- **Sample health metrics**: steps, sleep, heart rate, battery
- **Realistic behavior**: connection delays, data updates, etc.

## How to Enable Mock Mode

### Option 1: Automatic (Default in Development)

Mock mode is **automatically enabled** when:
- Running in development mode (`__DEV__ === true`)
- The native SDK bridge is not available (e.g., before setting up frameworks)

### Option 2: Manual Toggle

Edit `src/services/SmartRingService.ts`:

```typescript
// Change this line:
const USE_MOCK_DATA = __DEV__ && true;  // Enable mock mode
// To:
const USE_MOCK_DATA = __DEV__ && false; // Disable mock mode (use real SDK)
```

## Sample Data Included

### Mock Devices
- **SmartRing-F605** (MAC: AA:BB:CC:DD:EE:01)
- **SmartRing-Pro** (MAC: AA:BB:CC:DD:EE:02)

### Sample Metrics
- **Steps**: ~8,500 steps, 6.4km distance, 342 calories
- **Sleep**: 3 hours deep sleep, 4 hours light sleep
- **Battery**: ~78% (decreases slightly on each check)
- **Heart Rate**: 70-100 bpm (varies randomly when monitoring)

## Using Mock Mode

1. **Start the app** - Mock mode will be active automatically
2. **Tap "Scan"** - You'll see 2 mock devices appear
3. **Tap a device** - Connect to it (simulated connection takes ~1.5 seconds)
4. **Get Data** - All buttons work with sample data
5. **Start Monitoring** - Heart rate updates every 2 seconds with random values

## Mock Mode Features

✅ **Device Discovery** - Simulates finding devices during scan  
✅ **Connection Flow** - Shows connecting → connected states  
✅ **Data Retrieval** - Returns realistic sample data  
✅ **Real-time Updates** - Heart rate monitoring with live updates  
✅ **Event System** - All events work (connection state, data updates, etc.)  

## When to Use Mock Mode

- ✅ **UI/UX Development** - Test your app's interface
- ✅ **Development** - Work on features without a device
- ✅ **Testing** - Verify app logic and data flow
- ✅ **Demos** - Show app functionality to others
- ✅ **CI/CD** - Run automated tests

## Switching to Real SDK

When you're ready to use a real device:

1. Set `USE_MOCK_DATA = false` in `SmartRingService.ts`
2. Complete the Xcode setup (add frameworks)
3. Build and run on a physical iOS device
4. The app will automatically use the real SDK

## Mock Data Values

You can customize the sample data by editing `src/services/SmartRingMockService.ts`:

```typescript
// Change default values
private mockSteps: StepsData = {
  steps: 10000,  // Your custom value
  distance: 7500,
  calories: 400,
  time: 36000,
};
```

## Visual Indicator

When mock mode is active, you'll see a yellow banner at the top:
```
📱 MOCK MODE - Using Sample Data
```

This helps you know you're using sample data, not real device data.

## Limitations

Mock mode simulates the SDK but:
- ❌ No actual Bluetooth communication
- ❌ No real device data
- ❌ Some advanced features may not be fully simulated
- ❌ Data doesn't persist between app restarts

For production use, always test with a real device!





