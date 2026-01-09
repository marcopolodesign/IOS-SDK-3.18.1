import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { spacing, fontSize } from '../../theme/colors';

interface StatItem {
  label: string;
  value: number;
  unit?: string;
  color?: string;
}

interface StatsRowProps {
  stats: StatItem[];
}

function StatBlock({ stat, isLast }: { stat: StatItem; isLast: boolean }) {
  return (
    <View style={[styles.statBlock, !isLast && styles.withDivider]}>
      <Text style={styles.statValue}>
        {stat.value}
        {stat.unit && <Text style={styles.statUnit}>{stat.unit}</Text>}
      </Text>
      <Text style={styles.statLabel}>{stat.label}</Text>
    </View>
  );
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <GlassCard style={styles.container} variant="stats" noPadding>
      <View style={styles.row}>
        {stats.map((stat, index) => (
          <StatBlock
            key={stat.label}
            stat={stat}
            isLast={index === stats.length - 1}
          />
        ))}
      </View>
    </GlassCard>
  );
}

// Pre-configured stats row for overview
export function OverviewStatsRow({
  strain,
  readiness,
  sleep,
}: {
  strain: number;
  readiness: number;
  sleep: number;
}) {
  const stats: StatItem[] = [
    { label: 'Strain', value: strain, unit: '%' },
    { label: 'Readiness', value: readiness, unit: '%' },
    { label: 'Sleep', value: sleep, unit: '%' },
  ];

  return <StatsRow stats={stats} />;
}

// Pre-configured stats for sleep tab
export function SleepStatsRow({
  timeAsleep,
  restingHR,
  respiratoryRate,
}: {
  timeAsleep: string;
  restingHR: number;
  respiratoryRate: number;
}) {
  return (
    <GlassCard style={styles.container} variant="stats" noPadding>
      <View style={styles.row}>
        <View style={[styles.statBlock, styles.withDivider]}>
          <Text style={styles.statValue}>{timeAsleep}</Text>
          <Text style={styles.statLabel}>Time Asleep</Text>
        </View>
        <View style={[styles.statBlock, styles.withDivider]}>
          <Text style={styles.statValue}>
            {restingHR}
            <Text style={styles.statUnit}> bpm</Text>
          </Text>
          <Text style={styles.statLabel}>Resting HR</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>
            {respiratoryRate}
            <Text style={styles.statUnit}> rpm</Text>
          </Text>
          <Text style={styles.statLabel}>Respiratory</Text>
        </View>
      </View>
    </GlassCard>
  );
}

// Pre-configured stats for activity tab
export function ActivityStatsRow({
  steps,
  calories,
  activeMinutes,
}: {
  steps: number;
  calories: number;
  activeMinutes: number;
}) {
  return (
    <GlassCard style={styles.container} variant="stats" noPadding>
      <View style={styles.row}>
        <View style={[styles.statBlock, styles.withDivider]}>
          <Text style={styles.statValue}>
            {steps.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Steps</Text>
        </View>
        <View style={[styles.statBlock, styles.withDivider]}>
          <Text style={styles.statValue}>
            {calories.toLocaleString()}
            <Text style={styles.statUnit}> kcal</Text>
          </Text>
          <Text style={styles.statLabel}>Calories</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>
            {activeMinutes}
            <Text style={styles.statUnit}> min</Text>
          </Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
  },
  withDivider: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.2)',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  statUnit: {
    fontSize: fontSize.sm,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatsRow;


