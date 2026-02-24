/**
 * StyledHealthScreen - Ring health metrics with frosted glass styling
 * Shows heart rate, SpO2, HRV, sleep, and other health data from the ring
 */

import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ImageBackground,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Polyline } from 'react-native-svg';
import { useSmartRing } from '../hooks';
import { GlassCard } from '../components/home/GlassCard';
import { useHomeDataContext } from '../context/HomeDataContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Icons
function HeartIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        fill="rgba(239,68,68,0.4)"
      />
    </Svg>
  );
}

function OxygenIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <Path
        d="M9 12a3 3 0 1 0 6 0 3 3 0 1 0-6 0"
        stroke="rgba(96,165,250,0.8)"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function HRVIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="3,12 7,12 9,6 12,18 15,9 17,12 21,12"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

function SleepIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        fill="rgba(139,92,246,0.4)"
      />
    </Svg>
  );
}

function TempIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
      />
    </Svg>
  );
}

function StepsIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16l4-8 4 8 4-8 4 8"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Large Metric Card
function LargeMetricCard({ 
  icon, 
  title, 
  value, 
  unit, 
  subtitle,
  color = 'rgba(255,255,255,0.95)' 
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  unit: string;
  subtitle?: string;
  color?: string;
}) {
  return (
    <GlassCard style={styles.largeMetricCard}>
      <View style={styles.metricHeader}>
        <View style={styles.metricIconBg}>{icon}</View>
        <Text style={styles.metricTitle}>{title}</Text>
      </View>
      <View style={styles.metricValueRow}>
        <Text style={[styles.largeValue, { color }]}>{value}</Text>
        <Text style={styles.largeUnit}>{unit}</Text>
      </View>
      {subtitle && <Text style={styles.metricSubtitle}>{subtitle}</Text>}
    </GlassCard>
  );
}

// Small Metric Card
function SmallMetricCard({ 
  icon, 
  title, 
  value, 
  unit, 
  color = 'rgba(255,255,255,0.95)' 
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  unit: string;
  color?: string;
}) {
  return (
    <GlassCard style={styles.smallMetricCard}>
      <View style={styles.smallMetricIcon}>{icon}</View>
      <Text style={styles.smallMetricTitle}>{title}</Text>
      <View style={styles.smallMetricValueRow}>
        <Text style={[styles.smallValue, { color }]}>{value}</Text>
        <Text style={styles.smallUnit}>{unit}</Text>
      </View>
    </GlassCard>
  );
}

export function StyledHealthScreen() {
  const insets = useSafeAreaInsets();
  const { isConnected, connectedDevice, refreshMetrics, metrics, battery } = useSmartRing();
  const homeData = useHomeDataContext();

  // Refresh metrics on mount and whenever we become connected
  useEffect(() => {
    if (isConnected) {
      refreshMetrics();
    }
  }, [isConnected, refreshMetrics]);

  const healthData = useMemo(() => {
    const hr = metrics.heartRate ?? '--';
    const spo2 = metrics.spo2 ?? '--';
    const steps = metrics.steps ?? '--';
    const calories = metrics.calories ?? '--';
    const distanceKm = metrics.distance ? (metrics.distance / 1000).toFixed(2) : '--';

    return {
      heartRate: isConnected ? hr : '--',
      heartRateStatus: isConnected && hr !== '--' ? 'Live' : 'Unavailable',
      spo2: isConnected ? spo2 : '--',
      hrv: homeData.hrvSdnn > 0 ? String(homeData.hrvSdnn) : '--',
      hrvStatus: homeData.hrvSdnn > 0 ? 'ms SDNN' : '—',
      sleepScore: '--',
      sleepDuration: '--',
      skinTemp: '--',
      steps: isConnected ? steps : '--',
      calories: isConnected ? calories : '--',
      respiratoryRate: '--',
      distance: isConnected ? distanceKm : '--',
      battery: battery ?? '--',
    };
  }, [isConnected, metrics, battery, homeData.hrvSdnn]);

  // healthData now pulls from live metrics via useSmartRing

  return (
    <ImageBackground
      source={require('../assets/backgrounds/sleep.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Health</Text>
          {isConnected ? (
            <View style={styles.connectedBadge}>
              <View style={styles.connectedDot} />
              <Text style={styles.connectedText}>Ring Connected</Text>
            </View>
          ) : (
            <View style={styles.disconnectedBadge}>
              <Text style={styles.disconnectedText}>Ring Not Connected</Text>
            </View>
          )}
        </View>

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!isConnected && (
            <GlassCard style={styles.warningCard}>
              <Text style={styles.warningTitle}>Connect Your Ring</Text>
              <Text style={styles.warningText}>
                Go to the Ring tab to connect your Smart Ring and see your health data here.
              </Text>
            </GlassCard>
          )}

          {/* Heart Rate - Large Card */}
          <LargeMetricCard
            icon={<HeartIcon />}
            title="Heart Rate"
            value={String(healthData.heartRate)}
            unit="bpm"
            subtitle={isConnected ? healthData.heartRateStatus : undefined}
            color="#F87171"
          />

          {/* Grid of smaller metrics */}
          <View style={styles.metricsGrid}>
            <SmallMetricCard
              icon={<OxygenIcon size={24} />}
              title="Blood Oxygen"
              value={String(healthData.spo2)}
              unit="%"
              color="#60A5FA"
            />
            <SmallMetricCard
              icon={<HRVIcon size={24} />}
              title="HRV"
              value={String(healthData.hrv)}
              unit="ms"
              color="#A78BFA"
            />
          </View>

          {/* Sleep - Large Card */}
          <LargeMetricCard
            icon={<SleepIcon />}
            title="Sleep Score"
            value={String(healthData.sleepScore)}
            unit="/100"
            subtitle={isConnected ? `Last night: ${healthData.sleepDuration}` : undefined}
            color="#A78BFA"
          />

          {/* More metrics grid */}
          <View style={styles.metricsGrid}>
            <SmallMetricCard
              icon={<TempIcon size={24} />}
              title="Skin Temp"
              value={String(healthData.skinTemp)}
              unit="°C"
              color="#FB923C"
            />
            <SmallMetricCard
              icon={<StepsIcon size={24} />}
              title="Steps"
              value={isConnected ? healthData.steps.toLocaleString() : '--'}
              unit="today"
              color="#4ADE80"
            />
          </View>

          {/* Additional stats */}
          <GlassCard style={styles.additionalStats}>
            <Text style={styles.additionalTitle}>Additional Metrics</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Respiratory Rate</Text>
              <Text style={styles.statValue}>{healthData.respiratoryRate} breaths/min</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Active Calories</Text>
              <Text style={styles.statValue}>{healthData.calories} kcal</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>Resting Heart Rate</Text>
              <Text style={styles.statValue}>{isConnected ? '62' : '--'} bpm</Text>
            </View>
          </GlassCard>
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
    gap: 6,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  disconnectedBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  disconnectedText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  warningCard: {
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FCD34D',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 20,
  },
  largeMetricCard: {
    padding: 20,
    marginBottom: 16,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metricIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  largeValue: {
    fontSize: 48,
    fontWeight: '700',
  },
  largeUnit: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  metricSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  smallMetricCard: {
    flex: 1,
    padding: 16,
    alignItems: 'flex-start',
  },
  smallMetricIcon: {
    marginBottom: 10,
  },
  smallMetricTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 6,
  },
  smallMetricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  smallValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  smallUnit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  additionalStats: {
    padding: 20,
    marginTop: 8,
  },
  additionalTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 16,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  statLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export default StyledHealthScreen;
