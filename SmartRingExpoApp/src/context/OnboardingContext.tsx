import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { OnboardingStorage } from '../utils/storage';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';

interface OnboardingState {
  isLoading: boolean;
  isAuthenticated: boolean;
  hasConnectedDevice: boolean;
  isDeviceCurrentlyConnected: boolean; // Live connection status
  pairedDeviceMac: string | null;
  canAccessMainApp: boolean;
  needsAuth: boolean;
  needsDeviceSetup: boolean;
}

interface OnboardingContextValue extends OnboardingState {
  completeDeviceSetup: (mac: string) => Promise<void>;
  completeOnboarding: () => Promise<void>;
  clearDevicePairing: () => Promise<void>;
  resetOnboarding: () => Promise<void>;
  refreshState: () => Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

interface OnboardingProviderProps {
  children: ReactNode;
}

export function OnboardingProvider({ children }: OnboardingProviderProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [deviceLoading, setDeviceLoading] = useState(true);
  const [hasConnectedDevice, setHasConnectedDevice] = useState(false);
  const [isDeviceCurrentlyConnected, setIsDeviceCurrentlyConnected] = useState(false);
  const [pairedDeviceMac, setPairedDeviceMac] = useState<string | null>(null);

  // Listen for live connection state changes
  useEffect(() => {
    const unsubscribe = UnifiedSmartRingService.onConnectionStateChanged((state) => {
      console.log('📱 OnboardingContext: Connection state changed to:', state);
      setIsDeviceCurrentlyConnected(state === 'connected');
    });

    // Check initial connection status
    UnifiedSmartRingService.isConnected().then((status) => {
      console.log('📱 OnboardingContext: Initial connection status:', status.connected);
      setIsDeviceCurrentlyConnected(status.connected);
    });

    return () => unsubscribe();
  }, []);

  const loadDeviceState = useCallback(async () => {
    console.log('📱 OnboardingContext: Loading device state...');
    try {
      // First check AsyncStorage (app's storage)
      const [deviceConnected, mac] = await Promise.all([
        OnboardingStorage.getDeviceConnected(),
        OnboardingStorage.getPairedDeviceMac(),
      ]);
      console.log('📱 OnboardingContext: AsyncStorage deviceConnected=', deviceConnected, 'mac=', mac);
      
      // Also check the SDK's native storage (UserDefaults)
      // This handles the case where SDK has a device but AsyncStorage was cleared
      let sdkHasPaired = false;
      try {
        const sdkResult = await UnifiedSmartRingService.getPairedDevice();
        sdkHasPaired = sdkResult.hasPairedDevice;
        console.log('📱 OnboardingContext: SDK hasPairedDevice=', sdkHasPaired, 'device=', sdkResult.device?.name);
        
        // If SDK has a paired device but AsyncStorage doesn't, sync them
        if (sdkHasPaired && sdkResult.device && !deviceConnected) {
          console.log('📱 OnboardingContext: Syncing SDK paired device to AsyncStorage');
          await OnboardingStorage.setDeviceConnected(true);
          await OnboardingStorage.setPairedDeviceMac(sdkResult.device.mac);
          setHasConnectedDevice(true);
          setPairedDeviceMac(sdkResult.device.mac);
          return; // Early return, state is set
        }
      } catch (sdkError) {
        console.log('📱 OnboardingContext: SDK check failed (expected on non-iOS):', sdkError);
      }
      
      // Use AsyncStorage values (or SDK-synced values if available)
      setHasConnectedDevice(deviceConnected || sdkHasPaired);
      setPairedDeviceMac(mac);
    } catch (error) {
      console.error('Failed to load device state:', error);
    } finally {
      console.log('📱 OnboardingContext: Device loading complete');
      setDeviceLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDeviceState();
  }, [loadDeviceState]);

  const completeDeviceSetup = useCallback(async (mac: string) => {
    await OnboardingStorage.setDeviceConnected(true);
    await OnboardingStorage.setPairedDeviceMac(mac);
    setHasConnectedDevice(true);
    setPairedDeviceMac(mac);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await OnboardingStorage.setOnboardingComplete();
  }, []);

  const clearDevicePairing = useCallback(async () => {
    // Clear both AsyncStorage and SDK's native storage
    await OnboardingStorage.clearDevicePairing();
    try {
      await UnifiedSmartRingService.forgetPairedDevice();
    } catch (error) {
      console.log('📱 OnboardingContext: Failed to forget SDK device:', error);
    }
    setHasConnectedDevice(false);
    setPairedDeviceMac(null);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await OnboardingStorage.reset();
    setHasConnectedDevice(false);
    setPairedDeviceMac(null);
  }, []);

  const refreshState = useCallback(async () => {
    setDeviceLoading(true);
    await loadDeviceState();
  }, [loadDeviceState]);

  const isLoading = authLoading || deviceLoading;
  const canAccessMainApp = isAuthenticated && hasConnectedDevice;
  const needsAuth = !isAuthenticated;
  const needsDeviceSetup = isAuthenticated && !hasConnectedDevice;

  // Debug logging for auth state changes
  useEffect(() => {
    console.log('🔄 OnboardingContext state:', {
      authLoading,
      deviceLoading,
      isLoading,
      isAuthenticated,
      hasConnectedDevice,
    });
  }, [authLoading, deviceLoading, isLoading, isAuthenticated, hasConnectedDevice]);

  const value: OnboardingContextValue = {
    isLoading,
    isAuthenticated,
    hasConnectedDevice,
    isDeviceCurrentlyConnected,
    pairedDeviceMac,
    canAccessMainApp,
    needsAuth,
    needsDeviceSetup,
    completeDeviceSetup,
    completeOnboarding,
    clearDevicePairing,
    resetOnboarding,
    refreshState,
  };

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within an OnboardingProvider');
  }
  return context;
}

export default OnboardingContext;
