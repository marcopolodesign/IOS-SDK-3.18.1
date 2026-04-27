import { useEffect, useRef, useState } from 'react';
import { NativeTabs, Icon, Label } from 'expo-router/unstable-native-tabs';
import { DynamicColorIOS, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '../../src/context/OnboardingContext';
import { FirmwareUpdateSheet } from '../../src/components/home/FirmwareUpdateSheet';
import { FirmwareUpdateService } from '../../src/services/FirmwareUpdateService';
import { UnifiedSmartRingService } from '../../src/services/UnifiedSmartRingService';

export default function TabLayout() {
  const { t } = useTranslation();
  const { hasConnectedDevice } = useOnboarding();

  const [showFirmwareSheet, setShowFirmwareSheet] = useState(false);
  const [firmwareVersions, setFirmwareVersions] = useState({ current: '', latest: '' });
  const firmwareChecked = useRef(false);

  useEffect(() => {
    if (!hasConnectedDevice || firmwareChecked.current) return;
    firmwareChecked.current = true;

    (async () => {
      try {
        const { version } = await UnifiedSmartRingService.getVersion();
        const { shouldShow, latestVersion } = await FirmwareUpdateService.checkShouldShow(version);
        if (shouldShow) {
          setFirmwareVersions({ current: version, latest: latestVersion });
          setShowFirmwareSheet(true);
        }
      } catch {
        // Silently ignore — non-critical feature
      }
    })();
  }, [hasConnectedDevice]);

  const handleFirmwareDismiss = async () => {
    await FirmwareUpdateService.markDismissed();
    setShowFirmwareSheet(false);
  };

  return (
    <>
      <FirmwareUpdateSheet
        visible={showFirmwareSheet}
        currentVersion={firmwareVersions.current}
        latestVersion={firmwareVersions.latest}
        onDismiss={handleFirmwareDismiss}
      />

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

        <NativeTabs.Trigger name="trends">
          <Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
          <Label>{t('tabs.trends')}</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="coach">
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
    </>
  );
}
