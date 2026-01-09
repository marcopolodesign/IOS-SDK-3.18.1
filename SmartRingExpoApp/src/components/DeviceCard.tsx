import React from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme/colors';
import type { DeviceInfo } from '../types/sdk.types';

interface DeviceCardProps {
  device: DeviceInfo;
  isConnecting?: boolean;
  isConnected?: boolean;
  onPress: () => void;
}

export const DeviceCard: React.FC<DeviceCardProps> = ({
  device,
  isConnecting = false,
  isConnected = false,
  onPress,
}) => {
  const getSignalStrength = (rssi: number): 'strong' | 'medium' | 'weak' => {
    if (rssi >= -50) return 'strong';
    if (rssi >= -70) return 'medium';
    return 'weak';
  };

  const signalStrength = getSignalStrength(device.rssi);
  const signalColor = {
    strong: colors.success,
    medium: colors.warning,
    weak: colors.error,
  }[signalStrength];

  return (
    <Pressable
      onPress={onPress}
      disabled={isConnecting}
      style={({ pressed }) => [
        styles.container,
        isConnected && styles.containerConnected,
        pressed && styles.containerPressed,
      ]}
    >
      <View style={styles.iconContainer}>
        <Svg width={40} height={40} viewBox="0 0 40 40">
          <Circle cx="20" cy="20" r="18" fill={`${colors.primary}20`} />
          <Circle cx="20" cy="20" r="12" fill="none" stroke={colors.primary} strokeWidth="2" />
          <Circle cx="20" cy="20" r="6" fill={colors.primary} />
        </Svg>
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name}>{device.localName || 'Unknown Device'}</Text>
        <Text style={styles.mac}>{device.mac}</Text>
        <View style={styles.infoRow}>
          <Text style={styles.version}>v{device.ver}</Text>
          <View style={styles.signalContainer}>
            <SignalIcon strength={signalStrength} color={signalColor} />
            <Text style={[styles.rssi, { color: signalColor }]}>{device.rssi} dBm</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.action}>
        {isConnecting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isConnected ? (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>Connected</Text>
          </View>
        ) : (
          <View style={styles.connectButton}>
            <Text style={styles.connectText}>Connect</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

const SignalIcon: React.FC<{ strength: 'strong' | 'medium' | 'weak'; color: string }> = ({
  strength,
  color,
}) => {
  const bars = strength === 'strong' ? 3 : strength === 'medium' ? 2 : 1;
  
  return (
    <Svg width={16} height={12} viewBox="0 0 16 12">
      <Path
        d={`M 2 10 L 2 8 L 4 8 L 4 10 Z`}
        fill={bars >= 1 ? color : colors.surfaceLight}
      />
      <Path
        d={`M 6 10 L 6 5 L 8 5 L 8 10 Z`}
        fill={bars >= 2 ? color : colors.surfaceLight}
      />
      <Path
        d={`M 10 10 L 10 2 L 12 2 L 12 10 Z`}
        fill={bars >= 3 ? color : colors.surfaceLight}
      />
    </Svg>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.sm,
  },
  containerConnected: {
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}10`,
  },
  containerPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: 2,
  },
  mac: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    fontFamily: 'monospace',
    marginBottom: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  version: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rssi: {
    fontSize: fontSize.xs,
  },
  action: {
    marginLeft: spacing.md,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  connectText: {
    color: colors.textInverse,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  connectedBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  connectedText: {
    color: colors.success,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
});

export default DeviceCard;





