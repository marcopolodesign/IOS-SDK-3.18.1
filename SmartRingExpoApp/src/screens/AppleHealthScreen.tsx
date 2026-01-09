/**
 * AppleHealthScreen - View and sync data with Apple Health
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, fontSize, fontWeight } from '../theme/colors';
import { useHealthKit } from '../hooks';

export const AppleHealthScreen: React.FC = () => {
  const {
    isAvailable,
    isInitialized,
    isLoading,
    error,
    healthKitSteps,
    healthKitSleep,
    healthKitHeartRate,
    healthKitRestingHR,
    healthKitHRV,
    healthKitSpO2,
    healthKitBloodPressure,
    initialize,
    refreshAll,
  } = useHealthKit();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleConnect = async () => {
    const success = await initialize();
    if (success) {
      Alert.alert('Success', 'Connected to Apple Health!');
      setLastRefresh(new Date());
    } else {
      Alert.alert('Error', 'Failed to connect. Please check your permissions in Settings.');
    }
  };

  const handleRefresh = async () => {
    await refreshAll();
    setLastRefresh(new Date());
  };

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <Text style={styles.emoji}>🍎</Text>
          <Text style={styles.title}>Apple Health</Text>
          <Text style={styles.subtitle}>Only available on iOS devices</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isAvailable) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>HealthKit Not Available</Text>
          <Text style={styles.subtitle}>
            HealthKit is not available on this device or simulator.
            Please test on a physical iPhone.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Apple Health</Text>
        {isInitialized && (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>● Connected</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isInitialized ? (
          <View style={styles.connectCard}>
            <Text style={styles.emoji}>🍎</Text>
            <Text style={styles.connectTitle}>Connect to Apple Health</Text>
            <Text style={styles.connectDescription}>
              Access your health data from Apple Watch, iPhone, and other connected apps.
            </Text>
            <Pressable
              style={[styles.connectButton, isLoading && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <Text style={styles.connectButtonText}>Connect</Text>
              )}
            </Pressable>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        ) : (
          <>
            {/* Refresh Button */}
            <View style={styles.refreshRow}>
              <Text style={styles.lastRefreshText}>
                Last updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Never'}
              </Text>
              <Pressable
                style={styles.refreshButton}
                onPress={handleRefresh}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.refreshButtonText}>↻ Refresh</Text>
                )}
              </Pressable>
            </View>

            {/* Steps Card */}
            <DataCard
              title="Steps"
              icon="👟"
              value={healthKitSteps?.steps?.toLocaleString() || '--'}
              unit="steps"
              color={colors.steps}
              details={[
                { label: 'Distance', value: `${((healthKitSteps?.distance || 0) / 1000).toFixed(2)} km` },
                { label: 'Calories', value: `${healthKitSteps?.calories || 0} kcal` },
              ]}
            />

            {/* Heart Rate Card */}
            <DataCard
              title="Heart Rate"
              icon="❤️"
              value={healthKitHeartRate?.heartRate?.toString() || '--'}
              unit="bpm"
              color={colors.heartRate}
              details={[
                { label: 'Resting HR', value: healthKitRestingHR ? `${healthKitRestingHR} bpm` : '--' },
                { label: 'HRV (SDNN)', value: healthKitHRV?.sdnn ? `${healthKitHRV.sdnn.toFixed(0)} ms` : '--' },
              ]}
            />

            {/* Sleep Card */}
            <DataCard
              title="Sleep"
              icon="😴"
              value={healthKitSleep ? `${Math.round((healthKitSleep.deep + healthKitSleep.light + (healthKitSleep.rem || 0)) / 60)}h ${(healthKitSleep.deep + healthKitSleep.light + (healthKitSleep.rem || 0)) % 60}m` : '--'}
              unit=""
              color={colors.sleep}
              details={[
                { label: 'Deep', value: `${healthKitSleep?.deep || 0} min` },
                { label: 'Light', value: `${healthKitSleep?.light || 0} min` },
                { label: 'REM', value: `${healthKitSleep?.rem || 0} min` },
                { label: 'Awake', value: `${healthKitSleep?.awake || 0} min` },
              ]}
            />

            {/* Blood Oxygen Card */}
            <DataCard
              title="Blood Oxygen"
              icon="💧"
              value={healthKitSpO2?.spo2?.toString() || '--'}
              unit="%"
              color={colors.spo2}
            />

            {/* Blood Pressure Card */}
            <DataCard
              title="Blood Pressure"
              icon="🩺"
              value={healthKitBloodPressure ? `${healthKitBloodPressure.systolic}/${healthKitBloodPressure.diastolic}` : '--'}
              unit="mmHg"
              color={colors.bloodPressure}
            />

            {/* Info Card */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>💡 Data Sources</Text>
              <Text style={styles.infoText}>
                This data comes from Apple Health, which aggregates data from:
              </Text>
              <Text style={styles.infoText}>• Apple Watch</Text>
              <Text style={styles.infoText}>• iPhone sensors</Text>
              <Text style={styles.infoText}>• Third-party apps and devices</Text>
              <Text style={styles.infoText}>• Manual entries</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// Data Card Component
const DataCard: React.FC<{
  title: string;
  icon: string;
  value: string;
  unit: string;
  color: string;
  details?: { label: string; value: string }[];
}> = ({ title, icon, value, unit, color, details }) => (
  <View style={styles.dataCard}>
    <View style={styles.dataCardHeader}>
      <Text style={styles.dataCardIcon}>{icon}</Text>
      <Text style={styles.dataCardTitle}>{title}</Text>
    </View>
    <View style={styles.dataCardValue}>
      <Text style={[styles.valueText, { color }]}>{value}</Text>
      <Text style={styles.unitText}>{unit}</Text>
    </View>
    {details && details.length > 0 && (
      <View style={styles.detailsContainer}>
        {details.map((detail, index) => (
          <View key={index} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{detail.label}</Text>
            <Text style={styles.detailValue}>{detail.value}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

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
  headerTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  connectedBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  connectedText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  connectCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  connectTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  connectDescription: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: '#FF3B30', // Apple red
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  connectButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  refreshRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  lastRefreshText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  refreshButton: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  refreshButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  dataCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dataCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dataCardIcon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  dataCardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  dataCardValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  valueText: {
    fontSize: 36,
    fontWeight: fontWeight.bold,
  },
  unitText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  detailsContainer: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detailLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  detailValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text,
  },
  infoCard: {
    backgroundColor: `${colors.info}10`,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.info}30`,
  },
  infoTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});

export default AppleHealthScreen;





