import { useLayoutEffect } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { router } from 'expo-router';
import { DynamicColorIOS, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../src/context/OnboardingContext';

export default function TabLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();

  useLayoutEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      router.replace('/(onboarding)/connect');
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

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
        <Label>{t('tabs.today')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="health">
        <Icon sf={{ default: 'heart', selected: 'heart.fill' }} />
        <Label>{t('tabs.health')}</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <Icon src={{
          default: require('../../assets/coach-icon.png'),
          selected: require('../../assets/coach-icon-selected.png'),
        }} />
        <Label>{t('tabs.coach')}</Label>
      </NativeTabs.Trigger>

      {/* 4th slot — role="search" for native layout, + icon triggers add overlay */}
      <NativeTabs.Trigger name="[search]" role="search">
        <Icon sf={{ default: 'plus', selected: 'plus' }} />
      </NativeTabs.Trigger>

      {/* Hidden routes (no tab bar slot) */}
      <NativeTabs.Trigger name="add" hidden />
      <NativeTabs.Trigger name="today" hidden />
    </NativeTabs>
  );
}
