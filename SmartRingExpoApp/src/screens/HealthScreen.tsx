import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Circle } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize, fontWeight, shadows } from '../theme/colors';
import { MetricCard, HeartRateChart, RingIndicator } from '../components';
import { useHealthData, useSmartRing, useAuth } from '../hooks';
import { supabaseService } from '../services/SupabaseService';
import { DailySummary, WeeklySummary } from '../types/supabase.types';

interface HealthScreenProps {
  initialTab?: string;
}

type TabType = 'heart' | 'sleep' | 'spo2' | 'bp' | 'stress';
type ViewMode = 'today' | 'week' | 'month';

// Date helper functions
function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export const HealthScreen: React.FC<HealthScreenProps> = ({ initialTab }) => {
  const [activeTab, setActiveTab] = React.useState<TabType>(
    (initialTab as TabType) || 'heart'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [historicalData, setHistoricalData] = useState<DailySummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const { user, isAuthenticated } = useAuth();
  const { isConnected } = useSmartRing();
  const {
    heartRate,
    heartRateHistory,
    sleep,
    spO2,
    bloodPressure,
    hrv,
    stress,
    temperature,
    isMonitoringHeartRate,
    isMonitoringSpO2,
    isMonitoringBloodPressure,
    isLoading,
    refresh24HourHeartRate,
    refreshSleep,
    refreshHRV,
    refreshStress,
    refreshTemperature,
    startHeartRateMonitoring,
    stopHeartRateMonitoring,
    startSpO2Monitoring,
    stopSpO2Monitoring,
    startBloodPressureMonitoring,
    stopBloodPressureMonitoring,
  } = useHealthData();

  // Load historical data when view mode or date changes
  const loadHistoricalData = useCallback(async () => {
    if (!user || !isAuthenticated) return;

    setIsLoadingHistory(true);
    try {
      let startDate: Date;
      let endDate: Date = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      if (viewMode === 'today') {
        startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
      } else if (viewMode === 'week') {
        startDate = getStartOfWeek(selectedDate);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = getStartOfMonth(selectedDate);
        endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);
      }

      const data = await supabaseService.getDailySummaries(user.id, startDate, endDate);
      setHistoricalData(data);
    } catch (e) {
      console.error('Error loading historical data:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user, isAuthenticated, viewMode, selectedDate]);

  useEffect(() => {
    if (isAuthenticated) {
      loadHistoricalData();
    }
  }, [loadHistoricalData, isAuthenticated]);

  useEffect(() => {
    if (isConnected) {
      loadTabData();
    }
  }, [activeTab, isConnected]);

  const loadTabData = async () => {
    switch (activeTab) {
      case 'heart':
        await Promise.all([refresh24HourHeartRate(), refreshHRV()]);
        break;
      case 'sleep':
        await refreshSleep();
        break;
      case 'stress':
        await Promise.all([refreshStress(), refreshTemperature()]);
        break;
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'today') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    } else {
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    }
    setSelectedDate(newDate);
  };

  const getDateRangeLabel = (): string => {
    if (viewMode === 'today') {
      const today = new Date();
      if (selectedDate.toDateString() === today.toDateString()) {
        return 'Today';
      }
      return formatDateShort(selectedDate);
    } else if (viewMode === 'week') {
      const weekStart = getStartOfWeek(selectedDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      return `${formatDateShort(weekStart)} - ${formatDateShort(weekEnd)}`;
    } else {
      return selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
  };

  // Calculate aggregated stats from historical data
  const getAggregatedStats = () => {
    if (historicalData.length === 0) return null;

    const totalSteps = historicalData.reduce((sum, d) => sum + (d.total_steps || 0), 0);
    const totalCalories = historicalData.reduce((sum, d) => sum + (d.total_calories || 0), 0);
    const hrValues = historicalData.filter(d => d.hr_avg).map(d => d.hr_avg!);
    const avgHr = hrValues.length > 0 ? hrValues.reduce((a, b) => a + b, 0) / hrValues.length : null;
    const sleepValues = historicalData.filter(d => d.sleep_total_min).map(d => d.sleep_total_min!);
    const avgSleep = sleepValues.length > 0 ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length : null;

    return { totalSteps, totalCalories, avgHr, avgSleep, daysWithData: historicalData.length };
  };

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'heart', label: 'Heart', icon: <HeartTabIcon active={activeTab === 'heart'} /> },
    { id: 'sleep', label: 'Sleep', icon: <SleepTabIcon active={activeTab === 'sleep'} /> },
    { id: 'spo2', label: 'SpO2', icon: <SpO2TabIcon active={activeTab === 'spo2'} /> },
    { id: 'bp', label: 'BP', icon: <BPTabIcon active={activeTab === 'bp'} /> },
    { id: 'stress', label: 'Stress', icon: <StressTabIcon active={activeTab === 'stress'} /> },
  ];

  const renderTabContent = () => {
    if (!isConnected) {
      return (
        <View style={styles.disconnectedState}>
          <Text style={styles.disconnectedText}>Connect a device to view health data</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'heart':
        return <HeartRateTab />;
      case 'sleep':
        return <SleepTab />;
      case 'spo2':
        return <SpO2Tab />;
      case 'bp':
        return <BloodPressureTab />;
      case 'stress':
        return <StressTab />;
      default:
        return null;
    }
  };

  const HeartRateTab = () => (
    <>
      {/* Live Heart Rate */}
      <Pressable
        style={[styles.liveCard, isMonitoringHeartRate && styles.liveCardActive]}
        onPress={isMonitoringHeartRate ? stopHeartRateMonitoring : startHeartRateMonitoring}
      >
        <View style={styles.liveCardHeader}>
          <Text style={styles.liveCardTitle}>Live Heart Rate</Text>
          <View style={[styles.liveButton, isMonitoringHeartRate && styles.liveButtonActive]}>
            <Text style={[styles.liveButtonText, isMonitoringHeartRate && styles.liveButtonTextActive]}>
              {isMonitoringHeartRate ? 'STOP' : 'START'}
            </Text>
          </View>
        </View>
        <View style={styles.liveValueRow}>
          <Text style={styles.liveValue}>{heartRate?.heartRate || '--'}</Text>
          <Text style={styles.liveUnit}>bpm</Text>
        </View>
        {heartRate?.rri && (
          <Text style={styles.rriValue}>RR Interval: {heartRate.rri}ms</Text>
        )}
      </Pressable>

      {/* 24-Hour Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>24-Hour Overview</Text>
        <HeartRateChart data={heartRateHistory} height={180} />
      </View>

      {/* HRV Data */}
      {hrv && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heart Rate Variability</Text>
          <View style={styles.hrvGrid}>
            <MetricCard
              title="SDNN"
              value={hrv.sdnn?.toFixed(1) || '--'}
              unit="ms"
              color={colors.hrv}
              size="small"
            />
            <MetricCard
              title="RMSSD"
              value={hrv.rmssd?.toFixed(1) || '--'}
              unit="ms"
              color={colors.hrv}
              size="small"
            />
            <MetricCard
              title="LF/HF"
              value={hrv.lfHfRatio?.toFixed(2) || '--'}
              color={colors.hrv}
              size="small"
            />
          </View>
        </View>
      )}
    </>
  );

  const SleepTab = () => (
    <>
      {sleep ? (
        <>
          {/* Total Sleep */}
          <View style={styles.sleepSummaryCard}>
            <RingIndicator
              value={(sleep.deep || 0) + (sleep.light || 0) + (sleep.rem || 0)}
              maxValue={480}
              size={160}
              strokeWidth={16}
              gradientColors={colors.gradients.tertiary}
              label="Total Sleep"
              unit="min"
            />
            <View style={styles.sleepBreakdown}>
              <SleepMetric label="Deep" value={sleep.deep || 0} color={colors.tertiary} />
              <SleepMetric label="Light" value={sleep.light || 0} color={colors.tertiaryLight} />
              {sleep.rem && <SleepMetric label="REM" value={sleep.rem} color={colors.spo2} />}
              {sleep.awake && <SleepMetric label="Awake" value={sleep.awake} color={colors.warning} />}
            </View>
          </View>

          {/* Sleep Quality */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sleep Quality</Text>
            <View style={styles.qualityCard}>
              <Text style={styles.qualityText}>{sleep.detail || 'Good sleep quality'}</Text>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.noDataState}>
          <Text style={styles.noDataText}>No sleep data available</Text>
          <Text style={styles.noDataSubtext}>Wear your ring while sleeping to track sleep</Text>
        </View>
      )}
    </>
  );

  const SpO2Tab = () => (
    <>
      <Pressable
        style={[styles.liveCard, isMonitoringSpO2 && styles.liveCardActive]}
        onPress={isMonitoringSpO2 ? stopSpO2Monitoring : startSpO2Monitoring}
      >
        <View style={styles.liveCardHeader}>
          <Text style={styles.liveCardTitle}>Blood Oxygen</Text>
          <View style={[styles.liveButton, isMonitoringSpO2 && styles.liveButtonActive]}>
            <Text style={[styles.liveButtonText, isMonitoringSpO2 && styles.liveButtonTextActive]}>
              {isMonitoringSpO2 ? 'MEASURING...' : 'MEASURE'}
            </Text>
          </View>
        </View>
        <View style={styles.liveValueRow}>
          <Text style={[styles.liveValue, { color: colors.spo2 }]}>{spO2?.spo2 || '--'}</Text>
          <Text style={[styles.liveUnit, { color: colors.spo2 }]}>%</Text>
        </View>
        <Text style={styles.normalRange}>Normal range: 95-100%</Text>
      </Pressable>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>About SpO2</Text>
        <Text style={styles.infoText}>
          Blood oxygen saturation (SpO2) measures the percentage of oxygen-carrying hemoglobin
          in your blood. Normal levels are typically between 95-100%.
        </Text>
      </View>
    </>
  );

  const BloodPressureTab = () => (
    <>
      <Pressable
        style={[styles.liveCard, isMonitoringBloodPressure && styles.liveCardActive]}
        onPress={isMonitoringBloodPressure ? stopBloodPressureMonitoring : startBloodPressureMonitoring}
      >
        <View style={styles.liveCardHeader}>
          <Text style={styles.liveCardTitle}>Blood Pressure</Text>
          <View style={[styles.liveButton, isMonitoringBloodPressure && styles.liveButtonActive]}>
            <Text style={[styles.liveButtonText, isMonitoringBloodPressure && styles.liveButtonTextActive]}>
              {isMonitoringBloodPressure ? 'MEASURING...' : 'MEASURE'}
            </Text>
          </View>
        </View>
        {isMonitoringBloodPressure && (
          <View style={styles.measuringIndicator}>
            <ActivityIndicator color={colors.bloodPressure} />
            <Text style={styles.measuringText}>Please keep still for 30 seconds...</Text>
          </View>
        )}
        {bloodPressure && !isMonitoringBloodPressure && (
          <View style={styles.bpValues}>
            <View style={styles.bpValue}>
              <Text style={styles.bpNumber}>{bloodPressure.systolic}</Text>
              <Text style={styles.bpLabel}>Systolic</Text>
            </View>
            <Text style={styles.bpDivider}>/</Text>
            <View style={styles.bpValue}>
              <Text style={styles.bpNumber}>{bloodPressure.diastolic}</Text>
              <Text style={styles.bpLabel}>Diastolic</Text>
            </View>
            <Text style={styles.bpUnit}>mmHg</Text>
          </View>
        )}
      </Pressable>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Blood Pressure Ranges</Text>
        <View style={styles.bpRanges}>
          <BPRangeItem label="Normal" systolic="< 120" diastolic="< 80" color={colors.success} />
          <BPRangeItem label="Elevated" systolic="120-129" diastolic="< 80" color={colors.warning} />
          <BPRangeItem label="High" systolic="≥ 130" diastolic="≥ 80" color={colors.error} />
        </View>
      </View>
    </>
  );

  const StressTab = () => (
    <>
      {stress && (
        <View style={styles.stressCard}>
          <RingIndicator
            value={stress.level}
            maxValue={100}
            size={180}
            strokeWidth={18}
            color={getStressColor(stress.level)}
            label={getStressLabel(stress.level)}
            showPercentage
          />
        </View>
      )}

      {temperature && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Body Temperature</Text>
          <MetricCard
            title="Current"
            value={temperature.temperature.toFixed(1)}
            unit="°C"
            color={colors.temperature}
            subtitle={getTemperatureStatus(temperature.temperature)}
          />
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Stress Levels</Text>
        <View style={styles.stressLevels}>
          <StressLevelItem label="Low" range="0-29" color={colors.success} />
          <StressLevelItem label="Normal" range="30-59" color={colors.warning} />
          <StressLevelItem label="High" range="60-100" color={colors.error} />
        </View>
      </View>
    </>
  );

  // Historical Summary Component
  const HistoricalSummary = () => {
    const stats = getAggregatedStats();
    if (!stats || viewMode === 'today') return null;

    return (
      <View style={styles.historySummaryCard}>
        <Text style={styles.historySummaryTitle}>
          {viewMode === 'week' ? 'Weekly' : 'Monthly'} Summary
        </Text>
        <View style={styles.historySummaryGrid}>
          <View style={styles.historyStat}>
            <Text style={styles.historyStatValue}>
              {stats.totalSteps.toLocaleString()}
            </Text>
            <Text style={styles.historyStatLabel}>Total Steps</Text>
          </View>
          <View style={styles.historyStat}>
            <Text style={styles.historyStatValue}>
              {stats.totalCalories.toLocaleString()}
            </Text>
            <Text style={styles.historyStatLabel}>Calories</Text>
          </View>
          {stats.avgHr && (
            <View style={styles.historyStat}>
              <Text style={[styles.historyStatValue, { color: colors.heartRate }]}>
                {Math.round(stats.avgHr)}
              </Text>
              <Text style={styles.historyStatLabel}>Avg HR</Text>
            </View>
          )}
          {stats.avgSleep && (
            <View style={styles.historyStat}>
              <Text style={[styles.historyStatValue, { color: colors.sleep }]}>
                {Math.round(stats.avgSleep / 60)}h {Math.round(stats.avgSleep % 60)}m
              </Text>
              <Text style={styles.historyStatLabel}>Avg Sleep</Text>
            </View>
          )}
        </View>
        <Text style={styles.historyDaysCount}>
          {stats.daysWithData} day{stats.daysWithData !== 1 ? 's' : ''} with data
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Health</Text>
      </View>

      {/* View Mode Selector */}
      <View style={styles.viewModeContainer}>
        <View style={styles.viewModeSelector}>
          {(['today', 'week', 'month'] as ViewMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.viewModeButton, viewMode === mode && styles.viewModeButtonActive]}
              onPress={() => setViewMode(mode)}
            >
              <Text style={[styles.viewModeText, viewMode === mode && styles.viewModeTextActive]}>
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNavigator}>
        <TouchableOpacity style={styles.dateNavButton} onPress={() => navigateDate('prev')}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" fill={colors.text} />
          </Svg>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.dateLabel}
          onPress={() => setSelectedDate(new Date())}
        >
          <Text style={styles.dateLabelText}>{getDateRangeLabel()}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.dateNavButton} 
          onPress={() => navigateDate('next')}
          disabled={selectedDate >= new Date()}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path 
              d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" 
              fill={selectedDate >= new Date() ? colors.textMuted : colors.text} 
            />
          </Svg>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {(isLoading || isLoadingHistory) && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator color={colors.primary} />
          </View>
        )}
        <HistoricalSummary />
        {renderTabContent()}
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper components
const SleepMetric: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <View style={styles.sleepMetric}>
    <View style={[styles.sleepMetricDot, { backgroundColor: color }]} />
    <Text style={styles.sleepMetricLabel}>{label}</Text>
    <Text style={[styles.sleepMetricValue, { color }]}>
      {Math.floor(value / 60)}h {value % 60}m
    </Text>
  </View>
);

const BPRangeItem: React.FC<{
  label: string;
  systolic: string;
  diastolic: string;
  color: string;
}> = ({ label, systolic, diastolic, color }) => (
  <View style={styles.bpRangeItem}>
    <View style={[styles.bpRangeDot, { backgroundColor: color }]} />
    <Text style={styles.bpRangeLabel}>{label}</Text>
    <Text style={styles.bpRangeValue}>{systolic}/{diastolic}</Text>
  </View>
);

const StressLevelItem: React.FC<{ label: string; range: string; color: string }> = ({
  label,
  range,
  color,
}) => (
  <View style={styles.stressLevelItem}>
    <View style={[styles.stressLevelDot, { backgroundColor: color }]} />
    <Text style={styles.stressLevelLabel}>{label}</Text>
    <Text style={styles.stressLevelRange}>{range}</Text>
  </View>
);

// Helper functions
const getStressColor = (level: number) => {
  if (level < 30) return colors.success;
  if (level < 60) return colors.warning;
  return colors.error;
};

const getStressLabel = (level: number) => {
  if (level < 30) return 'Relaxed';
  if (level < 60) return 'Normal';
  return 'Stressed';
};

const getTemperatureStatus = (temp: number) => {
  if (temp < 36.0) return 'Below normal';
  if (temp <= 37.2) return 'Normal';
  return 'Elevated';
};

// Tab icons
const HeartTabIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill={active ? colors.heartRate : colors.textMuted}
    />
  </Svg>
);

const SleepTabIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12.34 2.02C6.59 1.82 2 6.42 2 12c0 5.52 4.48 10 10 10 3.71 0 6.93-2.02 8.66-5.02-7.51-.25-12.09-8.43-8.32-14.96z"
      fill={active ? colors.sleep : colors.textMuted}
    />
  </Svg>
);

const SpO2TabIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M12 2c-5.33 4.55-8 8.48-8 11.8 0 4.98 3.8 8.2 8 8.2s8-3.22 8-8.2c0-3.32-2.67-7.25-8-11.8z"
      fill={active ? colors.spo2 : colors.textMuted}
    />
  </Svg>
);

const BPTabIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"
      fill={active ? colors.bloodPressure : colors.textMuted}
    />
  </Svg>
);

const StressTabIcon: React.FC<{ active: boolean }> = ({ active }) => (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Circle cx="12" cy="12" r="10" fill="none" stroke={active ? colors.stress : colors.textMuted} strokeWidth="2" />
    <Path d="M8 14s1.5 2 4 2 4-2 4-2" stroke={active ? colors.stress : colors.textMuted} strokeWidth="2" fill="none" />
    <Circle cx="9" cy="9" r="1.5" fill={active ? colors.stress : colors.textMuted} />
    <Circle cx="15" cy="9" r="1.5" fill={active ? colors.stress : colors.textMuted} />
  </Svg>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text,
  },
  viewModeContainer: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  viewModeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
  },
  viewModeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  viewModeButtonActive: {
    backgroundColor: colors.primary,
  },
  viewModeText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  viewModeTextActive: {
    color: colors.background,
  },
  dateNavigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  dateNavButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  dateLabel: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  dateLabelText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  historySummaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historySummaryTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  historySummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  historyStat: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  historyStatLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  historyDaysCount: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    fontWeight: fontWeight.medium,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  loadingOverlay: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  liveCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  liveCardActive: {
    borderColor: colors.heartRate,
  },
  liveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  liveCardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text,
  },
  liveButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  liveButtonActive: {
    backgroundColor: `${colors.heartRate}20`,
  },
  liveButtonText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textMuted,
  },
  liveButtonTextActive: {
    color: colors.heartRate,
  },
  liveValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  liveValue: {
    fontSize: 64,
    fontWeight: fontWeight.bold,
    color: colors.heartRate,
  },
  liveUnit: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.medium,
    color: colors.heartRate,
    marginLeft: spacing.xs,
  },
  rriValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  normalRange: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  hrvGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sleepSummaryCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  sleepBreakdown: {
    flex: 1,
    marginLeft: spacing.lg,
    gap: spacing.sm,
  },
  sleepMetric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sleepMetricDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sleepMetricLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  sleepMetricValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  qualityCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qualityText: {
    fontSize: fontSize.md,
    color: colors.text,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  bpValues: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  bpValue: {
    alignItems: 'center',
  },
  bpNumber: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    color: colors.bloodPressure,
  },
  bpLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  bpDivider: {
    fontSize: 36,
    color: colors.textMuted,
  },
  bpUnit: {
    fontSize: fontSize.md,
    color: colors.bloodPressure,
    marginLeft: spacing.sm,
  },
  bpRanges: {
    gap: spacing.sm,
  },
  bpRangeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bpRangeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bpRangeLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  bpRangeValue: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  measuringIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  measuringText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  stressCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  stressLevels: {
    gap: spacing.sm,
  },
  stressLevelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stressLevelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stressLevelLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.text,
  },
  stressLevelRange: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  disconnectedState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  disconnectedText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  noDataState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  noDataText: {
    fontSize: fontSize.lg,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  noDataSubtext: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});

export default HealthScreen;



