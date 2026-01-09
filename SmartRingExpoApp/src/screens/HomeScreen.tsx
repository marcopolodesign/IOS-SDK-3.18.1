import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme/colors';
import { MetricCard, RingIndicator, BatteryIndicator, ConnectionStatus, HeartRateChart } from '../components';
import { useSmartRing, useHealthData } from '../hooks';

interface HomeScreenProps {
  onNavigateToDevices?: () => void;
  onNavigateToHealth?: (type: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onNavigateToDevices,
  onNavigateToHealth,
}) => {
  const { connectionState, isConnected, connectedDevice, battery, isMockMode } = useSmartRing();
  const {
    steps,
    sleep,
    heartRate,
    heartRateHistory,
    spO2,
    isMonitoringHeartRate,
    isLoading,
    refreshSteps,
    refreshSleep,
    refresh24HourHeartRate,
    startHeartRateMonitoring,
    stopHeartRateMonitoring,
  } = useHealthData();

  const [refreshing, setRefreshing] = React.useState(false);

  useEffect(() => {
    if (isConnected) {
      loadInitialData();
    }
  }, [isConnected]);

  const loadInitialData = useCallback(async () => {
    await Promise.all([
      refreshSteps(),
      refreshSleep(),
      refresh24HourHeartRate(),
    ]);
  }, [refreshSteps, refreshSleep, refresh24HourHeartRate]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, [loadInitialData]);

  const handleHeartRateToggle = () => {
    if (isMonitoringHeartRate) {
      stopHeartRateMonitoring();
    } else {
      startHeartRateMonitoring();
    }
  };

  const getTotalSleepHours = () => {
    if (!sleep) return '0h';
    const total = (sleep.deep || 0) + (sleep.light || 0) + (sleep.rem || 0);
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    return `${hours}h ${mins}m`;
  };

  const getStepProgress = () => {
    const goal = 10000;
    return Math.min((steps?.steps || 0) / goal, 1);
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.disconnectedContainer}>
          <View style={styles.disconnectedIcon}>
            <Svg width={80} height={80} viewBox="0 0 80 80">
              <Circle cx="40" cy="40" r="35" fill={`${colors.primary}20`} />
              <Circle cx="40" cy="40" r="25" fill="none" stroke={colors.primary} strokeWidth="3" strokeDasharray="10,5" />
              <Circle cx="40" cy="40" r="10" fill={colors.primary} opacity={0.5} />
            </Svg>
          </View>
          <Text style={styles.disconnectedTitle}>No Ring Connected</Text>
          <Text style={styles.disconnectedText}>
            Connect your Smart Ring to view health data
          </Text>
          <Pressable style={styles.connectButton} onPress={onNavigateToDevices}>
            <Text style={styles.connectButtonText}>Connect Device</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.title}>Dashboard</Text>
        </View>
        <View style={styles.headerRight}>
          {isMockMode && (
            <View style={styles.mockBadge}>
              <Text style={styles.mockBadgeText}>DEMO</Text>
            </View>
          )}
          <BatteryIndicator level={battery || 0} size="medium" />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Steps Progress Ring */}
        <Pressable
          style={styles.mainCard}
          onPress={() => onNavigateToHealth?.('steps')}
        >
          <View style={styles.mainCardContent}>
            <RingIndicator
              value={steps?.steps || 0}
              maxValue={10000}
              size={140}
              strokeWidth={14}
              gradientColors={colors.gradients.primary}
              label="steps"
              showPercentage={false}
            />
            <View style={styles.mainCardInfo}>
              <Text style={styles.mainCardTitle}>Today's Steps</Text>
              <View style={styles.statsRow}>
                <StatItem
                  icon={<DistanceIcon />}
                  value={((steps?.distance || 0) / 1000).toFixed(1)}
                  unit="km"
                  color={colors.steps}
                />
                <StatItem
                  icon={<CaloriesIcon />}
                  value={steps?.calories || 0}
                  unit="kcal"
                  color={colors.calories}
                />
              </View>
              <View style={styles.goalProgress}>
                <Text style={styles.goalText}>
                  {Math.round(getStepProgress() * 100)}% of daily goal
                </Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Heart Rate Live */}
        <Pressable
          style={[styles.heartRateCard, isMonitoringHeartRate && styles.heartRateCardActive]}
          onPress={handleHeartRateToggle}
        >
          <View style={styles.heartRateHeader}>
            <View style={styles.heartRateLeft}>
              <HeartIcon animated={isMonitoringHeartRate} />
              <Text style={styles.heartRateTitle}>Heart Rate</Text>
            </View>
            <View style={[styles.liveIndicator, isMonitoringHeartRate && styles.liveIndicatorActive]}>
              <View style={[styles.liveDot, isMonitoringHeartRate && styles.liveDotActive]} />
              <Text style={[styles.liveText, isMonitoringHeartRate && styles.liveTextActive]}>
                {isMonitoringHeartRate ? 'LIVE' : 'TAP TO START'}
              </Text>
            </View>
          </View>
          <View style={styles.heartRateValue}>
            <Text style={styles.heartRateNumber}>{heartRate?.heartRate || '--'}</Text>
            <Text style={styles.heartRateUnit}>bpm</Text>
          </View>
          {heartRate?.rri && (
            <Text style={styles.rriText}>RR Interval: {heartRate.rri}ms</Text>
          )}
        </Pressable>

        {/* Quick Stats Grid */}
        <View style={styles.statsGrid}>
          <MetricCard
            title="Sleep"
            value={getTotalSleepHours()}
            color={colors.sleep}
            icon={<SleepIcon />}
            onPress={() => onNavigateToHealth?.('sleep')}
          />
          <MetricCard
            title="SpO2"
            value={spO2?.spo2 || '--'}
            unit="%"
            color={colors.spo2}
            icon={<SpO2Icon />}
            onPress={() => onNavigateToHealth?.('spo2')}
          />
        </View>

        {/* 24-Hour Heart Rate Chart */}
        <View style={styles.chartSection}>
          <Text style={styles.chartTitle}>24-Hour Heart Rate</Text>
          <HeartRateChart data={heartRateHistory} />
        </View>

        {/* Sleep Summary */}
        {sleep && (
          <Pressable
            style={styles.sleepCard}
            onPress={() => onNavigateToHealth?.('sleep')}
          >
            <Text style={styles.sleepCardTitle}>Last Night's Sleep</Text>
            <View style={styles.sleepBars}>
              <SleepBar label="Deep" value={sleep.deep || 0} color={colors.tertiary} max={180} />
              <SleepBar label="Light" value={sleep.light || 0} color={colors.tertiaryLight} max={300} />
              {sleep.rem && (
                <SleepBar label="REM" value={sleep.rem} color={colors.spo2} max={120} />
              )}
            </View>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
};

const StatItem: React.FC<{
  icon: React.ReactNode;
  value: string | number;
  unit: string;
  color: string;
}> = ({ icon, value, unit, color }) => (
  <View style={styles.statItem}>
    {icon}
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statUnit}>{unit}</Text>
  </View>
);

const SleepBar: React.FC<{
  label: string;
  value: number;
  color: string;
  max: number;
}> = ({ label, value, color, max }) => (
  <View style={styles.sleepBarContainer}>
    <Text style={styles.sleepBarLabel}>{label}</Text>
    <View style={styles.sleepBarTrack}>
      <View
        style={[
          styles.sleepBarFill,
          { width: `${Math.min((value / max) * 100, 100)}%`, backgroundColor: color },
        ]}
      />
    </View>
    <Text style={styles.sleepBarValue}>{value}m</Text>
  </View>
);

// Icon components
const HeartIcon: React.FC<{ animated?: boolean }> = ({ animated }) => (
  <Svg width={24} height={24} viewBox="0 0 24 24">
    <Path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={colors.heartRate}
    />
  </Svg>
);

const DistanceIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path
      d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
      fill={colors.steps}
    />
  </Svg>
);

const CaloriesIcon = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24">
    <Path
      d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"
      fill={colors.calories}
    />
  </Svg>
);

const SleepIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96z"
      fill={colors.sleep}
    />
  </Svg>
);

const SpO2Icon = () => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8zm0 18c-3.35 0-6-2.57-6-6.2 0-2.34 1.95-5.44 6-9.14 4.05 3.7 6 6.79 6 9.14 0 3.63-2.65 6.2-6 6.2z"
      fill={colors.spo2}
    />
    <Circle cx="12" cy="15" r="3" fill={colors.spo2} />
  </Svg>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  greeting: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mockBadge: {
    backgroundColor: colors.warning,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  mockBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textInverse,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  mainCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.lg,
  },
  mainCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainCardInfo: {
    flex: 1,
    marginLeft: spacing.lg,
  },
  mainCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  statUnit: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  goalProgress: {
    backgroundColor: colors.surfaceLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  goalText: {
    fontSize: fontSize.xs,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  heartRateCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  heartRateCardActive: {
    borderColor: colors.heartRate,
    backgroundColor: `${colors.heartRate}10`,
  },
  heartRateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heartRateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heartRateTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  liveIndicatorActive: {
    backgroundColor: `${colors.heartRate}20`,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.textMuted,
  },
  liveDotActive: {
    backgroundColor: colors.heartRate,
  },
  liveText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    color: colors.textMuted,
  },
  liveTextActive: {
    color: colors.heartRate,
  },
  heartRateValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heartRateNumber: {
    fontSize: 56,
    fontWeight: fontWeight.bold,
    color: colors.heartRate,
  },
  heartRateUnit: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.medium,
    color: colors.heartRate,
    marginLeft: spacing.xs,
    opacity: 0.8,
  },
  rriText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  chartSection: {
    marginBottom: spacing.lg,
  },
  chartTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sleepCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepCardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  sleepBars: {
    gap: spacing.sm,
  },
  sleepBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sleepBarLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    width: 50,
  },
  sleepBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  sleepBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sleepBarValue: {
    fontSize: fontSize.sm,
    color: colors.text,
    width: 45,
    textAlign: 'right',
  },
  disconnectedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  disconnectedIcon: {
    marginBottom: spacing.xl,
  },
  disconnectedTitle: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  disconnectedText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  connectButtonText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textInverse,
  },
});

export default HomeScreen;





