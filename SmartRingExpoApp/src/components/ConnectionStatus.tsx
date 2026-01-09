import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, fontSize, fontWeight, spacing, borderRadius } from '../theme/colors';
import type { ConnectionState } from '../types/sdk.types';

interface ConnectionStatusProps {
  state: ConnectionState;
  deviceName?: string;
  compact?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  state,
  deviceName,
  compact = false,
}) => {
  const getStatusInfo = () => {
    switch (state) {
      case 'connected':
        return { color: colors.success, text: 'Connected', icon: '●' };
      case 'connecting':
        return { color: colors.warning, text: 'Connecting...', icon: null };
      case 'reconnecting':
        return { color: colors.warning, text: 'Reconnecting...', icon: null };
      case 'scanning':
        return { color: colors.info, text: 'Scanning...', icon: null };
      case 'disconnected':
      default:
        return { color: colors.error, text: 'Disconnected', icon: '○' };
    }
  };

  const { color, text, icon } = getStatusInfo();
  const isLoading = state === 'connecting' || state === 'reconnecting' || state === 'scanning';

  if (compact) {
    return (
      <View style={[styles.compactContainer, { borderColor: color }]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Text style={[styles.compactIcon, { color }]}>{icon}</Text>
        )}
        <Text style={[styles.compactText, { color }]}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.indicator, { backgroundColor: `${color}20`, borderColor: color }]}>
        {isLoading ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <View style={[styles.dot, { backgroundColor: color }]} />
        )}
      </View>
      
      <View style={styles.textContainer}>
        <Text style={[styles.status, { color }]}>{text}</Text>
        {deviceName && state === 'connected' && (
          <Text style={styles.deviceName}>{deviceName}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
  },
  indicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  textContainer: {
    marginLeft: spacing.md,
  },
  status: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  deviceName: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  compactIcon: {
    fontSize: fontSize.xs,
  },
  compactText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
});

export default ConnectionStatus;





