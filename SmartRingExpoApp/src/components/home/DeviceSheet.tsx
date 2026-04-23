import { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSize, fontFamily, getBatteryColor } from '../../theme/colors';
import type { DeviceInfo } from '../../types/sdk.types';

const CONNECT_MOCK_IMG = require('../../../assets/connect-mock.png');
const X6_MOCK_IMG = require('../../../assets/x6-mock-connect.png');
const BAND_MOCK_IMG = require('../../../assets/v8-mock-connect.png');

interface DeviceSheetProps {
  visible: boolean;
  onDismiss: () => void;
  connectedDevice: DeviceInfo | null;
  battery: number | null;
  isConnected: boolean;
  lastSyncedAt?: number | null;
}

const BatteryIcon = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24">
    <Path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z" fill="rgba(255,255,255,0.5)" />
  </Svg>
);

function formatSyncedAt(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Synced just now';
  if (diffMin < 60) return `Synced ${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Synced ${diffH}h ago`;
  return 'Synced yesterday';
}

export const DeviceSheet = memo(function DeviceSheet({
  visible,
  onDismiss,
  connectedDevice,
  battery,
  isConnected,
  lastSyncedAt,
}: DeviceSheetProps) {
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
    return () => { modalRef.current?.dismiss(); };
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleChange = useCallback((_from: number, toIndex: number) => {
    if (toIndex >= 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const isX6 = /x6/i.test(connectedDevice?.name ?? '') || /x6/i.test(connectedDevice?.localName ?? '');
  const isBand = (connectedDevice?.sdkType === 'v8' || connectedDevice?.deviceType === 'band') && !isX6;
  const deviceImg = isX6 ? X6_MOCK_IMG : isBand ? BAND_MOCK_IMG : CONNECT_MOCK_IMG;
  const deviceName = connectedDevice?.localName || connectedDevice?.name || (isX6 ? 'FOCUS X6' : isBand ? 'FOCUS BAND' : 'FOCUS X3');

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onDismiss}
      onAnimate={handleChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleComponent={null}
      handleStyle={styles.handle}
    >
      <BottomSheetView style={styles.container}>
        <Image
          source={deviceImg}
          style={styles.deviceImg}
          resizeMode="contain"
        />
        <Text style={styles.deviceName}>{deviceName}</Text>
        {connectedDevice?.mac ? (
          <Text style={styles.deviceMac}>{connectedDevice.mac}</Text>
        ) : null}

        {battery != null && (
          <View style={styles.batteryRow}>
            <BatteryIcon />
            <Text style={[styles.batteryText, { color: getBatteryColor(battery) }]}>
              {battery}%
            </Text>
          </View>
        )}

        <View style={[styles.statusBadge, isConnected && styles.statusBadgeConnected]}>
          <Text style={[styles.statusText, isConnected && styles.statusTextConnected]}>
            {isConnected ? t('profile.account.connected') : t('profile.account.not_connected')}
          </Text>
        </View>

        {lastSyncedAt != null && (
          <Text style={styles.syncedAt}>{formatSyncedAt(lastSyncedAt)}</Text>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    height: 0,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
  },
  deviceImg: {
    width: 200,
    height: 170,
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.44,
    marginBottom: 4,
  },
  deviceMac: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    marginBottom: 8,
  },
  batteryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  batteryText: {
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  statusBadge: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: 20,
    width: '100%',
    alignItems: 'center',
  },
  statusBadgeConnected: {
    backgroundColor: '#fff',
  },
  statusText: {
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255,255,255,0.5)',
  },
  statusTextConnected: {
    color: colors.success,
  },
  syncedAt: {
    marginTop: 12,
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
});
