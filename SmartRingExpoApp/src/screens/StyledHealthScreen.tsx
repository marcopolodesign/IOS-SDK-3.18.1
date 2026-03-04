/**
 * StyledHealthScreen - Oura-style Health Vitals Overview
 * Shows a premium overview of Sleep, Activity, and Recovery with scores,
 * status labels, animated range bars, and key sub-metrics.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Animated,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';

import { GradientInfoCard } from '../components/common/GradientInfoCard';
import { LiveHeartRateCard } from '../components/home/LiveHeartRateCard';
import { useHomeDataContext } from '../context/HomeDataContext';
import { colors, spacing, fontSize, fontFamily } from '../theme/colors';

// ─── Helpers ────────────────────────────────────────────────────────────────

type ScoreLabel = 'OPTIMAL' | 'GOOD' | 'FAIR' | 'NEEDS REST';

function getScoreLabel(score: number): ScoreLabel {
  if (score >= 85) return 'OPTIMAL';
  if (score >= 70) return 'GOOD';
  if (score >= 50) return 'FAIR';
  return 'NEEDS REST';
}

function getScoreLabelColor(label: ScoreLabel): string {
  switch (label) {
    case 'OPTIMAL':    return '#C4FF6B';
    case 'GOOD':       return '#00D4AA';
    case 'FAIR':       return '#FFB84D';
    case 'NEEDS REST': return '#FF6B6B';
  }
}

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function fmtNum(val: number | undefined, fallback = '--'): string {
  if (!val || val === 0) return fallback;
  return String(Math.round(val));
}

// ─── Inline Icons ────────────────────────────────────────────────────────────

function MoonIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        stroke="#6B8EFF"
        strokeWidth={1.8}
        fill="rgba(107,142,255,0.25)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FlameIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
        stroke="#00D4AA"
        strokeWidth={1.8}
        fill="rgba(0,212,170,0.25)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function HeartPulseIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="#C4FF6B"
        strokeWidth={1.8}
        fill="rgba(196,255,107,0.2)"
      />
    </Svg>
  );
}

// ─── Score Label Badge ────────────────────────────────────────────────────────

function ScoreLabelBadge({ label, color }: { label: ScoreLabel; color: string }) {
  return (
    <View
      style={[
        badge.pill,
        { backgroundColor: `${color}20`, borderColor: `${color}55` },
      ]}
    >
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}

const badge = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
  },
});

// ─── Range Indicator Bar ──────────────────────────────────────────────────────

function RangeIndicatorBar({ score, color }: { score: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: score,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [score]);

  const fillWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.track}>
        <Animated.View style={[barStyles.fill, { width: fillWidth, backgroundColor: color }]}>
          <View
            style={[
              barStyles.thumb,
              {
                backgroundColor: color,
                shadowColor: color,
              },
            ]}
          />
        </Animated.View>
      </View>
      <View style={barStyles.labels}>
        <Text style={barStyles.labelText}>0</Text>
        <Text style={barStyles.labelText}>100</Text>
      </View>
    </View>
  );
}

// ─── Steps Progress Bar ───────────────────────────────────────────────────────

const STEPS_GOAL = 8000;

function StepsProgressBar({ steps, color }: { steps: number; color: string }) {
  const pct = Math.min(100, STEPS_GOAL > 0 ? (steps / STEPS_GOAL) * 100 : 0);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: pct,
      duration: 1000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const fillWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  const goalReached = steps > 0 && steps >= STEPS_GOAL;
  const label = goalReached
    ? 'Goal reached!'
    : steps > 0
    ? `${steps.toLocaleString()} / ${STEPS_GOAL.toLocaleString()} steps`
    : '-- steps';

  return (
    <View style={barStyles.wrapper}>
      <View style={barStyles.track}>
        <Animated.View style={[barStyles.fill, { width: fillWidth, backgroundColor: color }]}>
          <View style={[barStyles.thumb, { backgroundColor: color, shadowColor: color }]} />
        </Animated.View>
      </View>
      <View style={barStyles.stepsLabelRow}>
        <Text style={barStyles.stepsLabel}>{label}</Text>
        <Text style={barStyles.stepsGoal}>{STEPS_GOAL.toLocaleString()} goal</Text>
      </View>
    </View>
  );
}

const barStyles = StyleSheet.create({
  wrapper: {
    gap: 6,
  },
  track: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    alignItems: 'flex-end',
    justifyContent: 'center',
    overflow: 'visible',
  },
  thumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    position: 'absolute',
    right: -5,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelText: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
  },
  stepsLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepsLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  stepsGoal: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
  },
});

// ─── Sub-Metrics Row ──────────────────────────────────────────────────────────

type SubMetric = { label: string; value: string; unit?: string };

function SubMetricsRow({ metrics }: { metrics: SubMetric[] }) {
  return (
    <View style={subStyles.row}>
      {metrics.map((m, i) => (
        <React.Fragment key={m.label}>
          <View style={subStyles.item}>
            <View style={subStyles.valueRow}>
              <Text style={subStyles.value}>{m.value}</Text>
              {m.unit ? <Text style={subStyles.unit}> {m.unit}</Text> : null}
            </View>
            <Text style={subStyles.label}>{m.label}</Text>
          </View>
          {i < metrics.length - 1 && <View style={subStyles.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const subStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xl,
    color: '#FFFFFF',
  },
  unit: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export function StyledHealthScreen() {
  const homeData = useHomeDataContext();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  const sleep = homeData.lastNightSleep;
  const activity = homeData.activity;
  const hrFallbackValues = homeData.hrChartData
    .map(point => Number(point.heartRate))
    .filter(value => Number.isFinite(value) && value > 0);
  const restingHRForDisplay =
    sleep?.restingHR && sleep.restingHR > 0
      ? sleep.restingHR
      : hrFallbackValues.length > 0
      ? Math.min(...hrFallbackValues)
      : 0;

  // Sleep
  const sleepScore = homeData.sleepScore;
  const sleepLabel = getScoreLabel(sleepScore);
  const sleepLabelColor = getScoreLabelColor(sleepLabel);
  const sleepSubMetrics: SubMetric[] = [
    { label: 'Total Sleep', value: sleep?.timeAsleep || '--' },
    {
      label: 'Resting HR',
      value: fmtNum(restingHRForDisplay),
      unit: restingHRForDisplay ? 'bpm' : undefined,
    },
    {
      label: 'Resp. Rate',
      value: fmtNum(sleep?.respiratoryRate),
      unit: sleep?.respiratoryRate ? '/min' : undefined,
    },
  ];

  // Activity
  const activityScore = activity?.score ?? 0;
  const activityLabel = getScoreLabel(activityScore);
  const activityLabelColor = getScoreLabelColor(activityLabel);
  const steps = activity?.steps ?? 0;
  const activitySubMetrics: SubMetric[] = [
    {
      label: 'Steps',
      value: steps > 0 ? steps.toLocaleString() : '--',
    },
    {
      label: 'Calories',
      value: fmtNum(activity?.calories),
      unit: activity?.calories ? 'kcal' : undefined,
    },
    {
      label: 'Active Min',
      value: fmtNum(activity?.activeMinutes),
      unit: activity?.activeMinutes ? 'min' : undefined,
    },
  ];

  // Recovery
  const readiness = homeData.readiness;
  const recoveryLabel = getScoreLabel(readiness);
  const recoveryLabelColor = getScoreLabelColor(recoveryLabel);
  const recoverySubMetrics: SubMetric[] = [
    {
      label: 'HRV',
      value: fmtNum(homeData.hrvSdnn),
      unit: homeData.hrvSdnn ? 'ms' : undefined,
    },
    {
      label: 'Strain',
      value: fmtNum(homeData.strain),
    },
    {
      label: 'Readiness',
      value: readiness > 0 ? String(readiness) : '--',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="rgba(255,255,255,0.7)"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Health</Text>
          <Text style={styles.headerDate}>{getTodayLabel()}</Text>
        </View>

        {/* Sleep Card */}
        <View style={styles.cardWrap}>
          <GradientInfoCard
            icon={<MoonIcon />}
            title="Sleep"
            headerValue={sleepScore > 0 ? sleepScore : undefined}
            showArrow
            onHeaderPress={() => router.push('/detail/sleep-detail')}
            gradientStops={[
              { offset: 0, color: '#3B1D8A', opacity: 1 },
              { offset: 0.6, color: '#3B1D8A', opacity: 0 },
            ]}
            gradientCenter={{ x: 0.5, y: -0.5 }}
            gradientRadii={{ rx: '100%', ry: '250%' }}
          >
            <ScoreLabelBadge label={sleepLabel} color={sleepLabelColor} />
            <RangeIndicatorBar score={sleepScore} color="#6B8EFF" />
            <SubMetricsRow metrics={sleepSubMetrics} />
          </GradientInfoCard>
        </View>

        {/* Activity Card */}
        <View style={styles.cardWrap}>
          <GradientInfoCard
            icon={<FlameIcon />}
            title="Activity"
            headerValue={activityScore > 0 ? activityScore : undefined}
            showArrow
            onHeaderPress={() => router.push('/detail/activity-detail')}
            gradientStops={[
              { offset: 0, color: '#00533F', opacity: 1 },
              { offset: 0.6, color: '#00533F', opacity: 0 },
            ]}
            gradientCenter={{ x: 0.5, y: -0.5 }}
            gradientRadii={{ rx: '100%', ry: '250%' }}
          >
            <ScoreLabelBadge label={activityLabel} color={activityLabelColor} />
            <StepsProgressBar steps={steps} color="#00D4AA" />
            <SubMetricsRow metrics={activitySubMetrics} />
          </GradientInfoCard>
        </View>

        {/* Recovery Card */}
        <View style={styles.cardWrap}>
          <GradientInfoCard
            icon={<HeartPulseIcon />}
            title="Recovery"
            headerValue={readiness > 0 ? readiness : undefined}
            showArrow
            onHeaderPress={() => router.push('/detail/recovery-detail')}
            gradientStops={[
              { offset: 0, color: '#2A4A1A', opacity: 1 },
              { offset: 0.6, color: '#2A4A1A', opacity: 0 },
            ]}
            gradientCenter={{ x: 0.5, y: -0.5 }}
            gradientRadii={{ rx: '100%', ry: '250%' }}
          >
            <ScoreLabelBadge label={recoveryLabel} color={recoveryLabelColor} />
            <RangeIndicatorBar score={readiness} color="#C4FF6B" />
            <SubMetricsRow metrics={recoverySubMetrics} />
          </GradientInfoCard>
        </View>

        {/* Live HR measurement */}
        <View style={styles.cardWrap}>
          <LiveHeartRateCard />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xxl,
    color: '#FFFFFF',
  },
  headerDate: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    paddingBottom: 3,
  },
  cardWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default StyledHealthScreen;
