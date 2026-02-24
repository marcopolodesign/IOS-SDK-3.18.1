import { useLayoutEffect } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';
import { DynamicColorIOS, Platform } from 'react-native';
import { useOnboarding } from '../../src/context/OnboardingContext';
import { AddOverlayProvider } from '../../src/context/AddOverlayContext';

export default function TabLayout() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();

  // Route guard - redirect if not properly onboarded
  useLayoutEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      router.replace('/(onboarding)/connect');
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  // Don't render tabs until properly authenticated
  if (isLoading || !isAuthenticated || !hasConnectedDevice) {
    return null;
  }

  return (
    <AddOverlayProvider>
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

      <NativeTabs.Trigger name="add" role="search">
        <Icon sf="plus" />
      </NativeTabs.Trigger>

      {/* Hide the today folder from tab bar */}
      <NativeTabs.Trigger name="today" hidden />
    </NativeTabs>
    </AddOverlayProvider>
  );
}
