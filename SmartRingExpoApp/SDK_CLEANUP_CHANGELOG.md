# SDK Cleanup Changelog

**Date:** January 25, 2025
**Rollback Commit:** `99637bb`

---

## Overview

Consolidated smart ring SDK integration from dual-SDK support (CRP + QCBand) to QCBandSDK only. Fixed pull-to-refresh behavior to always fetch real data instead of showing cached/stale data when disconnected.

---

## Changes Made

### 1. Removed CRP SDK (TypeScript Layer)

**Deleted:**
- `src/services/SmartRingService.ts` (569 lines) - CRP TypeScript wrapper

**Modified:**
- `src/services/UnifiedSmartRingService.ts` - Simplified from 849 to 541 lines
  - Removed `import SmartRingService`
  - Changed `SDKType` from `'crp' | 'qcband' | 'none'` to `'qcband' | 'none'`
  - Removed ~40 `case 'crp':` switch branches
  - Simplified `detectSDK()` to only check QCBandService

### 2. Fixed Pull-to-Refresh Behavior

**File:** `src/hooks/useHomeData.ts`

**Before:**
```typescript
if (!connectionStatus.connected) {
  // Showed cached data silently - user didn't know it was stale
  setData(prev => ({ ...prev, isLoading: false, isSyncing: keepSyncing }));
  return;
}
```

**After:**
```typescript
if (!connectionStatus.connected) {
  if (forceRefresh) {
    // PTR: Attempt auto-reconnect first
    const reconnectResult = await UnifiedSmartRingService.autoReconnect();
    if (reconnectResult.success) {
      // Continue to fetch real data
    } else {
      // Show ERROR, not cached data
      setData(prev => ({ ...prev, error: 'Ring not connected...' }));
      return;
    }
  } else {
    // Initial load: OK to show cached data
  }
}
```

**Behavior Changes:**
| Scenario | Before | After |
|----------|--------|-------|
| PTR when disconnected | Shows cached data silently | Attempts reconnect, shows error if fails |
| PTR reconnect success | N/A | Fetches real data |
| Initial load disconnected | Shows cached data | Shows cached data (unchanged) |

### 3. Removed CRP SDK (Native iOS Layer)

**Deleted:**
- `ios/SmartRing/SmartRingBridge.h` (13 lines)
- `ios/SmartRing/SmartRingBridge.m` (1446 lines)

**Deleted Frameworks from `ios/Frameworks/`:**
- `CRPSmartBand.framework`
- `RTKLEFoundation.framework`
- `RTKOTASDK.framework`
- `OTAFramework.framework`
- `SpeexKit.framework`
- `libopus.a`

**Remaining:**
- `QCBandSDK.framework` (only SDK now)

### 4. Updated Setup Script

**File:** `setup-frameworks.sh`

Simplified to only copy QCBandSDK.framework (removed all CRP framework copying logic).

---

## Current Architecture

```
┌─────────────────────────────────────────┐
│            React Native App             │
│  (OverviewTab, SleepTab, ActivityTab)   │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│            useHomeData.ts               │
│  - Initial load: cache → real data      │
│  - PTR: reconnect → real data or error  │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│       UnifiedSmartRingService.ts        │
│         (QCBandSDK only now)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│           QCBandService.ts              │
│      (NativeModules.QCBandBridge)       │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│     ios/QCBandBridge/QCBandBridge.m     │
│         (Native Obj-C bridge)           │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│         QCBandSDK.framework             │
│      (Bluetooth ring hardware)          │
└─────────────────────────────────────────┘
```

---

## Build Status

**Xcode Build:** SUCCESS (Jan 25, 2025 13:13)

- No errors related to SmartRingBridge or CRP frameworks
- Only standard ExpoModulesCore nullability warnings (normal)
- App deployed successfully

---

## Testing Checklist

- [x] App builds without errors
- [ ] App launches without crash
- [ ] Ring connection works via QCBandSDK
- [ ] Initial load shows cached data instantly
- [ ] PTR when connected fetches fresh data
- [ ] PTR when disconnected attempts reconnect
- [ ] PTR reconnect failure shows error message (not cached data)
- [ ] Sleep data displays correctly
- [ ] Steps/activity data displays correctly
- [ ] Battery level displays correctly

---

## Rollback Instructions

If issues occur:
```bash
cd /Users/mataldao/Local/Focus
git reset --hard 99637bb
```

This will restore the dual-SDK architecture with CRP support.

---

## Files Summary

| Action | File | Lines |
|--------|------|-------|
| MODIFIED | `src/services/UnifiedSmartRingService.ts` | 849 → 541 |
| MODIFIED | `src/hooks/useHomeData.ts` | PTR logic |
| MODIFIED | `setup-frameworks.sh` | Simplified |
| DELETED | `src/services/SmartRingService.ts` | -569 |
| DELETED | `ios/SmartRing/SmartRingBridge.h` | -13 |
| DELETED | `ios/SmartRing/SmartRingBridge.m` | -1446 |
| DELETED | 6 CRP frameworks | ~15MB |
