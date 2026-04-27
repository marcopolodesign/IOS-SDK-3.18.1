import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient as SvgLinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { BackArrow } from '../components/detail/BackArrow';
import { RangeModeTabs } from '../components/trendsDetail/RangeModeTabs';
import { MetricSection } from '../components/trendsDetail/MetricSection';
import { useTrendsData } from '../hooks/useTrendsData';
import {
  SLEEP_DOMAIN,
  RECOVERY_DOMAIN,
  ACTIVITY_DOMAIN,
  RUNNING_DOMAIN,
  HR_DOMAIN,
  type DomainKey,
  type RangeMode,
  type TrendsDomain,
} from './trendsDetail/domains';
import { colors, fontFamily, spacing } from '../theme/colors';

const DOMAIN_MAP: Record<DomainKey, TrendsDomain> = {
  sleep: SLEEP_DOMAIN,
  recovery: RECOVERY_DOMAIN,
  activity: ACTIVITY_DOMAIN,
  running: RUNNING_DOMAIN,
  hr: HR_DOMAIN,
};

interface Props {
  domain: DomainKey;
}

export default function TrendsDetailScreen({ domain: domainKey }: Props) {
  const { t } = useTranslation();
  const [rangeMode, setRangeMode] = useState<RangeMode>('daily');
  const domain = DOMAIN_MAP[domainKey];
  const { series, buckets, isLoading } = useTrendsData(domain, rangeMode);

  return (
    <View style={styles.container}>
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="trendsGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
              <Stop offset="0%" stopColor="#5B21B6" stopOpacity={1} />
              <Stop offset="70%" stopColor="#5B21B6" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="trendsGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
              <Stop offset="0%" stopColor="#1E1B4B" stopOpacity={0.75} />
              <Stop offset="100%" stopColor="#1E1B4B" stopOpacity={0} />
            </RadialGradient>
            <SvgLinearGradient id="trendsFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
              <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
            </SvgLinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#trendsGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#trendsGrad2)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#trendsFade)" />
        </Svg>
      </Reanimated.View>

    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Scrollable metrics */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Nav row */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <BackArrow />
          </TouchableOpacity>
        </View>

        {/* Screen title */}
        <Text style={styles.heroTitle}>
          {t('trends_detail.screen_title', { domain: t(domain.titleKey) })}
        </Text>

        {/* Empty state for phases not yet implemented */}
        {domain.metrics.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>{t('trends_detail.coming_soon')}</Text>
          </View>
        )}

        {/* Metric sections */}
        {domain.metrics.map(metric => (
          <MetricSection
            key={metric.key}
            metric={metric}
            buckets={buckets}
            series={series.get(metric.key) ?? []}
            isLoading={isLoading}
          />
        ))}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* Fixed D/W/M tabs — blurred, pinned to bottom */}
      <BlurView intensity={40} tint="dark" style={styles.tabsContainer}>
        <RangeModeTabs mode={rangeMode} onChange={setRangeMode} />
      </BlurView>
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0F',
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480,
  },
  screen: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scroll: {
    paddingBottom: 90,
  },
  navRow: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    padding: 8,
    alignSelf: 'flex-start',
  },
  heroTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: 32,
    color: '#FFFFFF',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.35)',
  },
  bottomPad: {
    height: 8,
  },
  tabsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
});
