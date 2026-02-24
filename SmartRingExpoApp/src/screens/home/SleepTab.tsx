import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, RefreshControl, ActivityIndicator, Animated } from 'react-native';
import { router } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { SemiCircularGauge } from '../../components/home/SemiCircularGauge';
import { SleepHypnogram } from '../../components/home/SleepHypnogram';
import { MetricInsightCard } from '../../components/home/MetricInsightCard';
import { GradientInfoCard } from '../../components/common/GradientInfoCard';
import { SleepScoreIcon } from '../../assets/icons';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { getSleepMessage } from '../../hooks/useHomeData';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import JstyleService from '../../services/JstyleService';

type SleepTabProps = {
  onScroll?: (event: any) => void;
  onHypnogramTouchStart?: () => void;
  onHypnogramTouchEnd?: () => void;
  isActive?: boolean;
};

function BrainIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 5c-1.3 0-2.4.8-2.9 2H12v1c-.5-.7-1.3-1-2.1-1C8.3 7 7 8.3 7 9.9c0 .7.2 1.3.6 1.8C7.2 12.1 7 12.5 7 13c0 .5.2 1 .5 1.4C7.2 14.8 7 15.4 7 16c0 1.7 1.3 3 3 3 .6 0 1.2-.2 1.6-.5.4.3 1 .5 1.4.5 1.7 0 3-1.3 3-3 0-.3-.1-.6-.1-.9.5-.4.8-.9 1-1.5.4.2.8.4 1.1.4C19.3 14 20 13.3 20 12.5c0-.6-.4-1.2-.9-1.4.2-.4.4-.9.4-1.4C19.5 7.8 17.7 5 15.5 5zM5 9c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

function DropIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

export function SleepTab({ onScroll, onHypnogramTouchStart, onHypnogramTouchEnd, isActive = false }: SleepTabProps) {
  const homeData = useHomeDataContext();
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastSpO2, setLastSpO2] = useState<number | null>(null);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await homeData.refresh();
    setRefreshing(false);
  }, [homeData.refresh]);

  // Fetch overnight SpO2 only when Sleep tab is visible and home sync is idle.
  useEffect(() => {
    if (!isActive || !homeData.isRingConnected || homeData.isSyncing) return;
    let cancelled = false;
    const fetchSpO2 = async () => {
      try {
        const rawData = await JstyleService.getSpO2Data();
        console.log('[SleepTab] RAW spo2 records count:', rawData.records?.length);
        console.log('[SleepTab] RAW spo2 first record keys:', JSON.stringify(Object.keys(rawData.records?.[0] || {})));
        console.log('[SleepTab] RAW spo2 first record:', JSON.stringify(rawData.records?.[0]));
        if (!cancelled && rawData.records?.length > 0) {
          const allEntries: any[] = [];
          for (const rec of rawData.records) {
            const arr: any[] = rec.arrayAutomaticSpo2Data || [];
            allEntries.push(...arr);
          }
          console.log('[SleepTab] spo2 total entries:', allEntries.length, 'last:', JSON.stringify(allEntries[allEntries.length - 1]));
          const last = allEntries[allEntries.length - 1];
          const val = Number(last?.automaticSpo2Data ?? 0);
          if (val > 0) setLastSpO2(val);
        }
      } catch (e) { console.log('[SleepTab] fetchSpO2 error:', e); }
    };
    fetchSpO2();
    return () => { cancelled = true; };
  }, [isActive, homeData.isRingConnected, homeData.isSyncing]);

  const sleepMessage = getSleepMessage(homeData.sleepScore);
  const sleep = homeData.lastNightSleep;
  const sleepInsight =
    homeData.insightType === 'sleep'
      ? homeData.insight
      : 'Your deep sleep was above average last night. Deep sleep is crucial for physical recovery and memory consolidation.';

  // HRV-derived stress classification
  const sdnn = homeData.hrvSdnn ?? 0;
  const stressLabel = sdnn >= 50 ? 'Low' : sdnn >= 30 ? 'Moderate' : sdnn > 0 ? 'High' : '--';
  const stressColor = sdnn >= 50 ? '#4ADE80' : sdnn >= 30 ? '#FFD700' : sdnn > 0 ? '#FF6B6B' : 'rgba(255,255,255,0.5)';

  // SpO2 status
  const spo2Status = lastSpO2
    ? lastSpO2 >= 95 ? 'Normal' : lastSpO2 >= 90 ? 'Low' : 'Seek care'
    : null;
  const spo2Color = lastSpO2
    ? lastSpO2 >= 95 ? '#4ADE80' : lastSpO2 >= 90 ? '#FFD700' : '#FF6B6B'
    : 'rgba(255,255,255,0.4)';

  return (
    <Animated.ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="rgba(255,255,255,0.7)"
        />
      }
    >
      {/* Syncing Indicator */}
      {homeData.isSyncing && (
        <View style={styles.syncingBanner}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={styles.syncingText}>Syncing with ring...</Text>
        </View>
      )}

      {/* Sleep Score Gauge */}
      <View style={styles.gaugeSection}>
        <SemiCircularGauge
          score={sleep.score}
          label="LAST NIGHT"
          animated={!homeData.isLoading}
        />
        <Text style={styles.scoreMessage}>{sleepMessage}</Text>
      </View>

      {/* Metrics + Insight Card */}
      <View style={styles.metricsInsightSection}>
        <MetricInsightCard
          metrics={[
            { label: 'Sleep', value: sleep.score || 0 },
            { label: 'Rest HR', value: sleep.restingHR || '--' },
            { label: 'Resp', value: sleep.respiratoryRate || '--' },
          ]}
          insight={sleepInsight}
          backgroundImage={require('../../assets/backgrounds/insights/violet-insight.jpg')}
        />
      </View>

      {/* Sleep Stats
      <View style={styles.statsSection}>
        <SleepStatsRow
          timeAsleep={sleep.timeAsleep}
          restingHR={sleep.restingHR}
          respiratoryRate={sleep.respiratoryRate}
        />
      </View> */}

      {/* Sleep Stages Hypnogram */}
      {sleep.segments.length > 0 && (
        <View style={styles.gradientCardSection}>
          <GradientInfoCard
            icon={<SleepScoreIcon />}
            title="Sleep Stages"
            showArrow
            onHeaderPress={() => router.push('/detail/sleep-detail')}
            gradientStops={[
              { offset: 0, color: '#7100C2', opacity: 1 },
              { offset: 0.55, color: '#7100C2', opacity: 0.2 },
            ]}
            gradientCenter={{ x: 0.51, y: -0.86 }}
            gradientRadii={{ rx: '80%', ry: '300%' }}
          >
            <SleepHypnogram
              segments={sleep.segments}
              bedTime={sleep.segments[0].startTime}
              wakeTime={sleep.segments[sleep.segments.length - 1].endTime}
              onTouchStart={onHypnogramTouchStart}
              onTouchEnd={onHypnogramTouchEnd}
            />
          </GradientInfoCard>
        </View>
      )}

      {/* HRV & Stress Card */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<BrainIcon />}
          title="HRV & Stress"
          headerValue={sdnn > 0 ? String(sdnn) : '--'}
          headerSubtitle={sdnn > 0 ? 'SDNN · ms' : 'No data'}
          gradientStops={[
            { offset: 0, color: 'rgba(0, 130, 120, 0.99)' },
            { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
          ]}
          gradientCenter={{ x: 0.51, y: -0.86 }}
          gradientRadii={{ rx: '80%', ry: '300%' }}
          showArrow
          onHeaderPress={() => router.push('/detail/hrv-detail')}
        >
          <View style={styles.hrvBody}>
            <View style={styles.hrvRow}>
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>Stress</Text>
                <Text style={[styles.hrvMetricValue, { color: stressColor }]}>{stressLabel}</Text>
              </View>
              <View style={styles.hrvDivider} />
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>Recovery</Text>
                <Text style={styles.hrvMetricValue}>
                  {sdnn > 0 ? (sdnn >= 50 ? 'Optimal' : sdnn >= 30 ? 'Fair' : 'Poor') : '--'}
                </Text>
              </View>
              <View style={styles.hrvDivider} />
              <View style={styles.hrvMetric}>
                <Text style={styles.hrvMetricLabel}>SDNN</Text>
                <Text style={styles.hrvMetricValue}>{sdnn > 0 ? `${sdnn} ms` : '--'}</Text>
              </View>
            </View>
            {sdnn > 0 && (
              <Text style={styles.hrvNote}>
                {sdnn >= 50
                  ? 'Excellent recovery. Your nervous system is well-balanced.'
                  : sdnn >= 30
                  ? 'Moderate recovery. Consider light activity today.'
                  : 'Low HRV. Prioritize rest and stress reduction.'}
              </Text>
            )}
          </View>
        </GradientInfoCard>
      </View>

      {/* SpO2 Overnight Card */}
      <View style={styles.gradientCardSection}>
        <GradientInfoCard
          icon={<DropIcon />}
          title="Blood Oxygen"
          headerValue={lastSpO2 ? `${lastSpO2}%` : '--'}
          headerSubtitle={spo2Status ?? 'No overnight data'}
          gradientStops={[
            { offset: 0, color: 'rgba(23, 90, 190, 0.99)' },
            { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
          ]}
          gradientCenter={{ x: 0.51, y: -0.86 }}
          gradientRadii={{ rx: '80%', ry: '300%' }}
          showArrow
          onHeaderPress={() => router.push('/detail/spo2-detail')}
        >
          <View style={styles.spo2Body}>
            <View style={styles.spo2Row}>
              <View style={[styles.spo2Badge, { backgroundColor: `${spo2Color}22`, borderColor: `${spo2Color}55` }]}>
                <Text style={[styles.spo2BadgeText, { color: spo2Color }]}>
                  {spo2Status ?? 'No data'}
                </Text>
              </View>
              <Text style={styles.spo2Note}>
                {lastSpO2
                  ? lastSpO2 >= 95
                    ? 'Healthy oxygen saturation while sleeping.'
                    : lastSpO2 >= 90
                    ? 'Slightly below normal. Monitor over the next few nights.'
                    : 'Very low. Consider consulting a physician.'
                  : 'Sync your ring to see overnight SpO2 data.'}
              </Text>
            </View>
            <View style={styles.spo2Scale}>
              <Text style={styles.spo2ScaleLabel}>Normal: 95–100%</Text>
              <Text style={styles.spo2ScaleLabel}>Low: 90–94%</Text>
            </View>
          </View>
        </GradientInfoCard>
      </View>

      {/* Sleep Tips Section (conditional) */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>
          {sleep.score >= 70 ? 'Keep it up' : 'Sleep Tips'}
        </Text>
        {sleep.score >= 70 ? (
          <>
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                ⭐ Great sleep! Your consistent schedule is paying off.
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                💪 Recovery looks solid — you're ready for today's activity.
              </Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                💤 Maintain a consistent sleep schedule, even on weekends
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                🌙 Create a relaxing bedtime routine 30–60 minutes before sleep
              </Text>
            </View>
            <View style={styles.tipCard}>
              <Text style={styles.tipText}>
                📱 Avoid screens at least 1 hour before bedtime
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  metricsInsightSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  content: {
    paddingTop: spacing.lg,
    paddingBottom: 100,
  },
  syncingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: 12,
    gap: 8,
  },
  syncingText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  gaugeSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  scoreMessage: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  statsSection: {
    marginBottom: spacing.lg,
  },
  chartSection: {
    marginBottom: spacing.lg,
  },
  gradientCardSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  insightSection: {
    marginBottom: spacing.lg,
  },
  tipsSection: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  tipsTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
    marginBottom: spacing.md,
  },
  tipCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  tipText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 50,
  },
  hrvBody: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  hrvRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  hrvMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  hrvMetricLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hrvMetricValue: {
    color: '#fff',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  hrvDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  hrvNote: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
  },
  spo2Body: {
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  spo2Row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  spo2Badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  spo2BadgeText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  spo2Note: {
    flex: 1,
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 20,
  },
  spo2Scale: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  spo2ScaleLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});

export default SleepTab;
