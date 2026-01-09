import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme/colors';
import { DeviceCard, ConnectionStatus } from '../components';
import { useSmartRing } from '../hooks';

interface DevicesScreenProps {
  onDeviceConnected?: () => void;
}

export const DevicesScreen: React.FC<DevicesScreenProps> = ({ onDeviceConnected }) => {
  const {
    connectionState,
    bluetoothState,
    isConnected,
    isScanning,
    devices,
    connectedDevice,
    isMockMode,
    scan,
    stopScan,
    connect,
    disconnect,
  } = useSmartRing();

  const [connectingMac, setConnectingMac] = React.useState<string | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (isConnected && onDeviceConnected) {
      onDeviceConnected();
    }
  }, [isConnected, onDeviceConnected]);

  const handleScan = async () => {
    await scan(15);
  };

  const handleConnect = async (mac: string) => {
    setConnectingMac(mac);
    try {
      await connect(mac);
    } finally {
      setConnectingMac(null);
    }
  };

  const handleDisconnect = () => {
    disconnect();
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Devices</Text>
        <ConnectionStatus state={connectionState} compact />
      </View>

      {isMockMode && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>Demo Mode</Text>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isScanning}
            onRefresh={handleScan}
            tintColor={colors.primary}
          />
        }
      >
        {bluetoothState !== 'poweredOn' && bluetoothState !== 'unknown' && (
          <View style={styles.warningCard}>
            <Text style={styles.warningTitle}>Bluetooth Required</Text>
            <Text style={styles.warningText}>
              Please enable Bluetooth to scan for devices.
            </Text>
          </View>
        )}

        {isConnected && connectedDevice && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Connected Device</Text>
            <DeviceCard
              device={connectedDevice}
              isConnected
              onPress={handleDisconnect}
            />
            <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Devices</Text>
            {isScanning && (
              <View style={styles.scanningIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.scanningText}>Scanning...</Text>
              </View>
            )}
          </View>

          {devices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📡</Text>
              <Text style={styles.emptyTitle}>No devices found</Text>
              <Text style={styles.emptyText}>
                Pull down to scan for nearby Smart Ring devices
              </Text>
            </View>
          ) : (
            <View style={styles.deviceList}>
              {devices.map((device) => (
                <DeviceCard
                  key={device.mac}
                  device={device}
                  isConnecting={connectingMac === device.mac}
                  isConnected={connectedDevice?.mac === device.mac}
                  onPress={() => handleConnect(device.mac)}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Pressable
            style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
            onPress={isScanning ? stopScan : handleScan}
          >
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color={colors.textInverse} />
                <Text style={styles.scanButtonText}>Stop Scanning</Text>
              </>
            ) : (
              <Text style={styles.scanButtonText}>Scan for Devices</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>Troubleshooting</Text>
          <Text style={styles.helpText}>
            • Make sure your Smart Ring is charged{'\n'}
            • Keep the ring close to your phone{'\n'}
            • Ensure Bluetooth is enabled{'\n'}
            • Try restarting the ring if not detected
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  mockBanner: {
    backgroundColor: colors.warning,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  mockText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  warningCard: {
    backgroundColor: `${colors.warning}20`,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warningTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  scanningText: {
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  deviceList: {
    gap: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  scanButtonDisabled: {
    backgroundColor: colors.surfaceLight,
  },
  scanButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
  disconnectButton: {
    backgroundColor: `${colors.error}20`,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.error,
  },
  disconnectText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.error,
  },
  helpSection: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  helpTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  helpText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 22,
  },
});

export default DevicesScreen;





