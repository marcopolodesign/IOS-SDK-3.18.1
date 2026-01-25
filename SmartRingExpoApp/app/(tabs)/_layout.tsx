import { useEffect, useLayoutEffect, useRef } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';
import { DynamicColorIOS, Platform } from 'react-native';
import { useOnboarding } from '../../src/context/OnboardingContext';
import { useSmartRing } from '../../src/hooks/useSmartRing';

export default function TabLayout() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();
  const { isConnected, autoConnect, checkForPairedDevice, isAutoConnecting } = useSmartRing();

  // Guard to prevent multiple auto-reconnect attempts
  const hasAttemptedReconnect = useRef(false);

  // Route guard - redirect if not properly onboarded
  useLayoutEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      router.replace('/(onboarding)/connect');
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  // Auto-reconnect to previously paired device on mount (only once)
  // This is the SINGLE source of auto-reconnect - StyledRingScreen no longer does this
  useEffect(() => {
    const attemptReconnect = async () => {
      // Only attempt once per app session
      if (hasAttemptedReconnect.current) return;

      if (hasConnectedDevice && !isConnected && !isAutoConnecting) {
        hasAttemptedReconnect.current = true;

        // IMPORTANT: Wait 1.5s before auto-connect to give SDK time to detect
        // existing iOS-maintained Bluetooth connections. Without this delay,
        // isConnected() returns false even when iOS has already restored the connection.
        console.log('🔗 [TabLayout] Waiting 1.5s for SDK to detect existing connection...');
        await new Promise(resolve => setTimeout(resolve, 1500));

        const { hasPairedDevice, device } = await checkForPairedDevice();
        if (hasPairedDevice && device) {
          console.log('🔗 [TabLayout] Auto-reconnecting to:', device.name);
          await autoConnect();
        }
      }
    };

    attemptReconnect();
  }, [hasConnectedDevice, isConnected, isAutoConnecting, checkForPairedDevice, autoConnect]);

  // Reset reconnect flag when we successfully connect (allows retry if disconnected later)
  useEffect(() => {
    if (isConnected) {
      hasAttemptedReconnect.current = false;
    }
  }, [isConnected]);

  // Don't render tabs until properly authenticated
  if (isLoading || !isAuthenticated || !hasConnectedDevice) {
    return null;
  }

  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      labelStyle={{
        color: Platform.OS === 'ios' 
          ? DynamicColorIOS({ dark: 'white', light: 'black' })
          : 'white',
      }}
      tintColor={Platform.OS === 'ios'
        ? DynamicColorIOS({ dark: 'white', light: 'black' })
        : 'white'
      }
    >
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: 'clock', selected: 'clock.fill' }} />
        <Label>Today</Label>
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="health">
        <Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
        <Label>Health</Label>
      </NativeTabs.Trigger>
      
      {/* <NativeTabs.Trigger name="ring">
        <Icon sf={{ default: 'circle.circle', selected: 'circle.circle.fill' }} />
        <Label>Ring</Label>
      </NativeTabs.Trigger> */}
      
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>

      {/* Hide the today folder from tab bar */}
      <NativeTabs.Trigger name="today" hidden />
    </NativeTabs>
  );
}
