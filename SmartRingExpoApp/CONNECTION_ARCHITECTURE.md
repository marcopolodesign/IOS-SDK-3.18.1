# Smart Ring Connection Architecture

## Overview

This document details the connection management architecture for the Smart Ring iOS app, including critical iOS BLE synchronization timing fixes implemented in January 2026.

---

## Table of Contents

1. [Connection Management Layers](#connection-management-layers)
2. [iOS BLE Background Connection Behavior](#ios-ble-background-connection-behavior)
3. [Critical Timing Issues & Solutions](#critical-timing-issues--solutions)
4. [Connection State Flow](#connection-state-flow)
5. [Hook Architecture](#hook-architecture)
6. [Best Practices](#best-practices)

---

## Connection Management Layers

The connection architecture consists of three layers:

```
┌─────────────────────────────────────────────┐
│   UI Layer (Screens/Components)            │
│   - Displays connection status              │
│   - Triggers manual reconnect               │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│   Hook Layer (useHomeData, useSmartRing)   │
│   - Manages connection state                │
│   - Handles auto-reconnection               │
│   - Fetches data on connection              │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│   Service Layer (UnifiedSmartRingService)  │
│   - Wraps native SDK                        │
│   - Provides connection API                 │
│   - Emits connection events                 │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│   Native Layer (QCBandBridge)              │
│   - QCBandSDK integration                   │
│   - CoreBluetooth communication             │
│   - Device pairing/connection               │
└─────────────────────────────────────────────┘
```

---

## iOS BLE Background Connection Behavior

### How iOS Manages BLE Connections

**Key Fact**: iOS CoreBluetooth maintains active BLE connections in the background, even when your app is terminated.

**Lifecycle**:
1. App connects to ring → iOS establishes BLE connection
2. User force-quits app → iOS KEEPS the BLE connection alive
3. App relaunches → iOS has connection, but SDK doesn't know yet
4. SDK needs 1.5-2s to detect the existing iOS connection

### The Synchronization Gap

```
Time:    0ms        800ms       1500ms      2000ms
         │           │            │           │
iOS:     [Connected─────────────────────────────]
         │           │            │           │
SDK:     [Detecting...│...........│....Ready!]
         │           │            │           │
Check:   ❌          ❌           ✅          ✅
         Too early   Too early   Detected    Detected
```

**What happens if you check too early:**
```typescript
// At 800ms:
const status = await isConnected(); // Returns false
// But iOS actually HAS the connection!

// You call autoReconnect()
await autoReconnect(); // Tries to connect to already-connected device
// Result: "Connection timed out" error
```

---

## Critical Timing Issues & Solutions

### Problem #1: Duplicate Auto-Reconnect

**Before Fix:**
```typescript
// TabLayout._layout.tsx (REMOVED)
useEffect(() => {
  setTimeout(async () => {
    await autoConnect(); // ❌ Duplicate attempt 1
  }, 1500);
}, []);

// useHomeData.ts
useEffect(() => {
  setTimeout(async () => {
    await autoReconnect(); // ❌ Duplicate attempt 2
  }, 800);
}, []);
```

**Result**: Two concurrent reconnection attempts → SDK confusion → timeout errors

**After Fix:**
```typescript
// TabLayout._layout.tsx - ONLY route guard
useLayoutEffect(() => {
  if (!isAuthenticated) router.replace('/(auth)/login');
  else if (!hasConnectedDevice) router.replace('/(onboarding)/connect');
}, [isAuthenticated, hasConnectedDevice, isLoading]);

// useHomeData.ts - SINGLE source of auto-reconnect
useEffect(() => {
  setTimeout(async () => {
    const status = await isConnected();
    if (!status.connected) {
      await autoReconnect(); // ✅ Single attempt
    }
  }, 2000); // Increased delay
}, []);
```

---

### Problem #2: Duplicate Data Fetch

**Before Fix:**
```typescript
// Mount effect
useEffect(() => {
  setTimeout(async () => {
    await fetchData(true); // ❌ Fetch 1
  }, 800);
}, []);

// Connection event listener
onConnectionStateChanged((state) => {
  if (state === 'connected') {
    setTimeout(() => {
      fetchData(true); // ❌ Fetch 2 (overlaps with Fetch 1!)
    }, 800);
  }
});
```

**Result**: Second fetch blocked by first fetch → confusion → errors

**After Fix:**
```typescript
// Mount effect - handles initial fetch
useEffect(() => {
  setTimeout(async () => {
    await fetchData(true); // ✅ Single fetch
  }, 2000);
}, []);

// Connection event - ONLY updates UI
onConnectionStateChanged((state) => {
  if (state === 'connected') {
    // ✅ Just update connection flag, no fetch
    setData(prev => ({ ...prev, isRingConnected: true }));
  }
});
```

---

### Problem #3: Early Connection Check

**Before Fix:**
```typescript
// Checked at 800ms - too early for iOS sync
setTimeout(async () => {
  const status = await isConnected(); // Returns false (SDK not synced)
  if (!status.connected) {
    await autoReconnect(); // Tries to reconnect to already-connected device
  }
}, 800); // ❌ Too early
```

**After Fix:**
```typescript
// Check at 2000ms - gives SDK time to sync
setTimeout(async () => {
  const status = await isConnected(); // Returns true (SDK synced)
  if (!status.connected) {
    await autoReconnect(); // Only reconnects if truly disconnected
  }
}, 2000); // ✅ Adequate delay
```

---

### Problem #4: No Retry on Timeout

**Before Fix:**
```typescript
try {
  const result = await autoReconnect();
  if (!result.success) {
    // ❌ Give up immediately
    setError('Connection failed');
    return;
  }
} catch (error) {
  // ❌ Show error, no retry
  setError('Connection timeout');
}
```

**After Fix:**
```typescript
try {
  const result = await autoReconnect();
  if (!result.success) {
    // ✅ Might be iOS sync lag - wait and recheck
    console.log('Waiting 1s for SDK to sync with iOS...');
    await wait(1000);

    const recheckStatus = await isConnected();
    if (recheckStatus.connected) {
      console.log('SDK synced! Connection detected.');
      // Continue with data fetch
    } else {
      setError('Connection failed after retry');
    }
  }
} catch (error) {
  // ✅ Also retry on error
  await wait(1000);
  const recheckStatus = await isConnected();
  if (recheckStatus.connected) {
    // Connection actually exists!
  }
}
```

---

## Connection State Flow

### App Launch (Cold Start)

```
┌──────────────────────────────────────────────────────┐
│ 1. App Launches                                      │
│    - TabLayout mounts → Guards routes only           │
│    - useHomeData mounts → Loads cached data          │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ 2. Wait 2000ms (iOS BLE Sync Period)                │
│    - iOS maintains connection in background          │
│    - SDK needs time to detect existing connection    │
└──────────────────┬───────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────┐
│ 3. Check Connection Status                           │
│    const status = await isConnected()                │
└──────────────────┬───────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌────────────────┐  ┌────────────────────┐
│ Connected?     │  │ Not Connected?     │
│ - Fetch data   │  │ - Auto-reconnect   │
│   immediately  │  │ - Wait 500ms       │
│                │  │ - Then fetch data  │
└────────────────┘  └────────────────────┘
         │                   │
         └─────────┬─────────┘
                   │
         ┌─────────▼─────────┐
         │ Connection Event  │
         │ Fires (SDK Ready) │
         └─────────┬─────────┘
                   │
         ┌─────────▼────────────────────┐
         │ Update UI Connection State   │
         │ (isRingConnected: true)      │
         │ Do NOT trigger data fetch    │
         └──────────────────────────────┘
```

### Manual Reconnect (Pull-to-Refresh)

```
┌──────────────────────────────────────────┐
│ User Pulls to Refresh                    │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│ fetchData(forceRefresh: true)            │
│ - Sets isSyncing: true                   │
└──────────────────┬───────────────────────┘
                   │
┌──────────────────▼───────────────────────┐
│ Check Connection                         │
│ const status = await isConnected()       │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
┌────────────────┐  ┌────────────────────┐
│ Connected?     │  │ Not Connected?     │
│ - Fetch data   │  │ - Auto-reconnect   │
│                │  │ - Retry on timeout │
│                │  │ - Then fetch       │
└────────────────┘  └────────────────────┘
```

---

## Hook Architecture

### useHomeData (Single Source of Truth)

**Responsibilities**:
- ✅ Auto-reconnection on app launch
- ✅ Data fetching orchestration
- ✅ Connection state for data availability
- ✅ Pull-to-refresh reconnection
- ✅ App foreground reconnection
- ✅ Data caching for instant display

**Does NOT**:
- ❌ Fetch data on connection events (mount handles it)
- ❌ Allow duplicate fetches (uses flag)
- ❌ Check connection too early (waits 2s)

**Code Location**: `src/hooks/useHomeData.ts`

```typescript
// Mount effect - initial connection + fetch
useEffect(() => {
  const mountTime = Date.now();

  setTimeout(async () => {
    const status = await UnifiedSmartRingService.isConnected();

    if (status.connected) {
      console.log('Connection detected - fetching data');
      fetchData(true);
    } else {
      console.log('Not connected - attempting reconnect');
      fetchData(true); // Will auto-reconnect then fetch
    }
  }, 2000); // Critical: 2s delay for iOS BLE sync
}, [fetchData]);

// Connection listener - UI update only
useEffect(() => {
  const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
    if (state === 'connected') {
      // Update UI flag, mount handles data fetching
      setData(prev => ({ ...prev, isRingConnected: true }));
    }
  });
  return () => unsubscribe();
}, []);
```

---

### useSmartRing (Device Management)

**Responsibilities**:
- ✅ Device scanning
- ✅ Manual connection/disconnection
- ✅ Device info (battery, version)
- ✅ Real-time metric listeners
- ✅ Connection state for UI

**Does NOT**:
- ❌ Auto-reconnect on app launch (useHomeData does this)
- ❌ Fetch aggregated health data (useHomeData does this)

**Code Location**: `src/hooks/useSmartRing.ts`

**When to use**:
- Ring settings screen (battery, version, disconnect)
- Device management screen (scan, pair, forget)
- Components needing real-time metrics (HR, SpO2)

---

### TabLayout (Route Guard Only)

**Responsibilities**:
- ✅ Route guards (redirect if not authenticated/paired)

**Does NOT**:
- ❌ Auto-reconnect (removed in fix)
- ❌ Check connection status
- ❌ Fetch data

**Code Location**: `app/(tabs)/_layout.tsx`

**Simplified Code**:
```typescript
export default function TabLayout() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();

  // ONLY route guard - no reconnection logic
  useLayoutEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) router.replace('/(auth)/login');
    else if (!hasConnectedDevice) router.replace('/(onboarding)/connect');
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  return <NativeTabs>...</NativeTabs>;
}
```

---

## Best Practices

### ✅ DO:

1. **Wait 2s before first connection check** on app launch
2. **Use single auto-reconnect source** (useHomeData only)
3. **Retry on connection timeout** (SDK might be syncing with iOS)
4. **Show cached data instantly** while connecting
5. **Separate connection state listeners** (don't trigger fetches)
6. **Use flags to prevent duplicate fetches**

### ❌ DON'T:

1. **Check connection before 1.5-2s** after app launch
2. **Create multiple auto-reconnect points** (causes race conditions)
3. **Fetch data on every connection event** (mount already handles it)
4. **Give up on first timeout** (could be iOS sync lag)
5. **Assume SDK connection state = iOS BLE state** (sync delay exists)

---

## Debugging Connection Issues

### Logs to Look For

**Healthy Connection Flow**:
```
🚀 [useHomeData] HOOK MOUNTED at 3:54:02 PM
😴 [useHomeData] Loaded cached data from 3:53:56 PM
😴 [useHomeData] Applying cached data for instant display
🚀 [useHomeData] Connection check at +2003ms | connected: true
🚀 [useHomeData] Connection detected - fetching data immediately
⏱️ [useHomeData] fetchData() STARTED
⏱️ [useHomeData] Starting SDK data fetches (in parallel)
✅ Battery: 85%
✅ Steps: 1234
⏱️ [useHomeData] fetchData() COMPLETED in 3500ms
```

**Connection with Retry** (SDK sync lag):
```
🚀 [useHomeData] Connection check at +2001ms | connected: false
🔄 [useHomeData] PTR: Auto-reconnect error: Connection timed out
🔄 [useHomeData] Rechecking connection after error...
🔄 [useHomeData] Connection detected on recheck after error!
⏱️ [useHomeData] fetchData() continues...
```

**Red Flags** (indicates issues):
```
❌ "🔗 [TabLayout] Auto-reconnecting to: R10_9802"
   → TabLayout shouldn't reconnect anymore

❌ "😴 [useHomeData] Skipping fetch - already fetching data"
   → Duplicate fetch attempt

❌ "🚀 [useHomeData] Connection check at +817ms"
   → Too early, should be 2000ms+

❌ "Connection timed out" without retry
   → Should retry/recheck connection
```

---

## Performance Characteristics

### Cold Start Timeline

```
Time:     0ms      2000ms     2500ms    6000ms
          │         │          │          │
User:     Launch    See cache  Connected  Fresh data
          │         │          │          │
App:      Mount───┐ Check─────►Reconnect──►Fetch────►Display
                  │            (if needed)
                  └─Show cached data instantly
```

**Key Metrics**:
- **Time to cached data**: ~100ms (instant)
- **Time to connection check**: 2000ms (iOS BLE sync)
- **Time to reconnect**: ~500ms (if needed)
- **Time to data fetch**: ~3500ms (parallel SDK calls)
- **Total time to fresh data**: ~6000ms (6 seconds from launch)

### Optimization Opportunities

**Already Optimized**:
- ✅ Cached data loads instantly (<100ms)
- ✅ Parallel data fetching (sleep, steps, battery)
- ✅ Single reconnect attempt (no duplicates)
- ✅ Connection state sync (prevents retries)

**Cannot Optimize Further**:
- ⏸️ 2s iOS BLE sync delay (iOS behavior, unavoidable)
- ⏸️ SDK data fetch time (native SDK speed)
- ⏸️ Bluetooth communication latency

**Could Optimize**:
- 🔄 Reduce 2s delay to 1.5s if SDK proves consistently faster
- 🔄 Predict connection based on iOS BLE state (if API available)
- 🔄 Background fetch to pre-load data before user opens app

---

## Related Files

### Core Connection Logic
- `src/hooks/useHomeData.ts` - Main connection + data orchestration
- `src/hooks/useSmartRing.ts` - Device management + real-time metrics
- `app/(tabs)/_layout.tsx` - Route guard only
- `src/services/UnifiedSmartRingService.ts` - SDK wrapper + events

### Native Layer
- `ios/SmartRing/QCBandBridge.m` - Native SDK bridge
- `ios/SmartRing/QCBandBridge.h` - Bridge header

### Documentation
- `ARCHITECTURE.md` - Overall system architecture
- `SDK_INTEGRATION.md` - SDK setup guide
- `QCBANDSDK_INTEGRATION.md` - QCBand-specific details

---

## Version History

### v2.0 - January 26, 2026
- **Fixed**: Duplicate auto-reconnect race condition
- **Fixed**: Duplicate data fetch overlap
- **Fixed**: Early connection check (800ms → 2000ms)
- **Added**: Retry logic for connection timeout
- **Simplified**: TabLayout to route guard only
- **Result**: Stable connection, no timeout errors

### v1.0 - Initial Implementation
- Auto-reconnect on app launch (TabLayout)
- Auto-reconnect on mount (useHomeData)
- Connection event data fetch
- 800ms connection check delay

---

## Commit Reference

**Commit**: 9cfb367
**Message**: Fix connection race conditions and iOS BLE sync timing issues
**Date**: January 26, 2026
**Files Changed**: 3 files, 379 insertions(+), 633 deletions(-)
