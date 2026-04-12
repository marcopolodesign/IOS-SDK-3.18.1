import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { BackArrow } from '../../src/components/detail/BackArrow';
import { SleepDebtGauge } from '../../src/components/home/SleepDebtGauge';
import { useSleepDebt } from '../../src/hooks/useSleepDebt';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';
import type { SleepDebtCategory } from '../../src/types/sleepDebt.types';

const CATEGORY_COLORS: Record<SleepDebtCategory, string> = {
  none: '#4ADE80',
  low: '#FFD700',
  moderate: '#FF6B35',
  high: '#FF4444',
};

const TARGET_PRESETS = [420, 450, 480, 510, 540]; // 7h, 7.5h, 8h, 8.5h, 9h

function formatDebtTime(minutes: number): string {
  if (minutes < 1) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatAvgTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

function deficitColor(deficitMin: number): string {
  if (deficitMin === 0) return '#4ADE80';
  if (deficitMin <= 60) return '#FFD700';
  return '#FF4444';
}

function getInsight(category: SleepDebtCategory, t: (key: string) => string): string {
  return t(`sleep_debt.insight_${category}`);
}

export default function SleepDebtDetailScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { sleepDebt, updateTarget } = useSleepDebt();

  const catColor = CATEGORY_COLORS[sleepDebt.category];

  const handleEditTarget = () => {
    const options = TARGET_PRESETS.map((m) => `${m / 60}h`);
    Alert.alert(
      t('sleep_debt.edit_target'),
      undefined,
      [
        ...options.map((label, i) => ({
          text: label,
          onPress: () => updateTarget(TARGET_PRESETS[i]),
        })),
        { text: t('profile.alerts.cancel'), style: 'cancel' as const },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <BackArrow />
        </TouchableOpacity>
        <Text style={styles.title}>{t('sleep_debt.detail_title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Period label */}
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>{t('sleep_debt.period_label')}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!sleepDebt.isReady ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{t('sleep_debt.not_enough_data', { count: 3 - sleepDebt.daysWithData })}</Text>
          </View>
        ) : (
          <>
            {/* Headline */}
            <View style={styles.headlineRow}>
              <Text style={[styles.headlineScore, { color: catColor }]}>
                {formatDebtTime(sleepDebt.totalDebtMin)}
              </Text>
              <View style={styles.headlineRight}>
                <Text style={styles.headlineLabel}>{t('sleep_debt.card_title').toUpperCase()}</Text>
                <View style={[styles.badge, { backgroundColor: `${catColor}22`, borderColor: `${catColor}55` }]}>
                  <Text style={[styles.badgeText, { color: catColor }]}>
                    {t(`sleep_debt.category_${sleepDebt.category}`)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Gauge */}
            <View style={styles.gaugeWrapper}>
              <SleepDebtGauge
                totalDebtMin={sleepDebt.totalDebtMin}
                category={sleepDebt.category}
              />
            </View>

            {/* Stats */}
            <View style={styles.statsContainer}>
              <DetailStatRow
                title={t('sleep_debt.avg_label')}
                value={formatAvgTime(sleepDebt.averageSleepMin)}
              />
              <TouchableOpacity onPress={handleEditTarget} activeOpacity={0.7}>
                <DetailStatRow
                  title={t('sleep_debt.target_label')}
                  value={formatAvgTime(sleepDebt.targetMin)}
                  unit="tap to edit"
                />
              </TouchableOpacity>
              <DetailStatRow
                title={t('sleep_debt.days_tracked')}
                value={`${sleepDebt.daysWithData} / 7`}
              />
              <DetailStatRow
                title={t('sleep_debt.total_debt')}
                value={formatDebtTime(sleepDebt.totalDebtMin)}
                accent={catColor}
              />
            </View>

            {/* Nightly Sleep Bar Chart */}
            <View style={styles.chartCard}>
              <Text style={styles.chartSectionTitle}>{t('sleep_debt.daily_breakdown')}</Text>
              <View style={styles.chartArea}>
                {/* Target line */}
                {(() => {
                  const sorted = sleepDebt.dailyDeficits.slice().sort((a, b) => a.date.localeCompare(b.date));
                  const maxActual = Math.max(...sorted.map(d => d.actualMin), 0);
                  const target = sleepDebt.targetMin;
                  const ceiling = Math.max(target, maxActual) * 1.15;
                  const targetPct = (target / ceiling) * 100;
                  const targetH = Math.floor(target / 60);
                  const targetM = Math.round(target % 60);
                  const targetLabel = targetM === 0 ? `${targetH}h` : `${targetH}h ${targetM}m`;

                  return (
                    <>
                      {/* Dashed target line */}
                      <View style={[styles.targetLine, { bottom: `${targetPct}%` }]}>
                        <View style={styles.targetDash} />
                        <Text style={styles.targetLabel}>{targetLabel}</Text>
                      </View>

                      {/* Bars */}
                      <View style={styles.barsRow}>
                        {sorted.map((d) => {
                          const barPct = d.actualMin > 0 ? (d.actualMin / ceiling) * 100 : 8;
                          const hasData = d.actualMin > 0;
                          const barColor = !hasData
                            ? 'rgba(255,255,255,0.1)'
                            : deficitColor(d.deficitMin);
                          const ghostPct = hasData && d.deficitMin > 0
                            ? (d.deficitMin / ceiling) * 100
                            : 0;
                          const dayDate = new Date(d.date + 'T12:00:00');
                          const dayLabel = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayDate.getDay()];

                          return (
                            <View key={d.date} style={styles.barColumn}>
                              {/* Duration label */}
                              <Text style={styles.barValueLabel}>
                                {hasData ? formatAvgTime(d.actualMin) : '—'}
                              </Text>
                              {/* Bar + ghost container */}
                              <View style={styles.barContainer}>
                                {/* Ghost deficit segment */}
                                {ghostPct > 0 && (
                                  <View
                                    style={[
                                      styles.ghostSegment,
                                      { height: `${ghostPct}%` },
                                    ]}
                                  />
                                )}
                                {/* Actual sleep bar */}
                                <View
                                  style={[
                                    styles.sleepBar,
                                    {
                                      height: `${barPct}%`,
                                      backgroundColor: barColor,
                                    },
                                  ]}
                                />
                              </View>
                              {/* Day label */}
                              <Text style={styles.barDayLabel}>{dayLabel}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </>
                  );
                })()}
              </View>
            </View>

            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{getInsight(sleepDebt.category, t)}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  backArrow: { color: '#FFFFFF', fontSize: 28, fontFamily: fontFamily.regular },
  title: { color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.demiBold },
  headerRight: { width: 40 },
  periodRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  periodLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  emptyContainer: { alignItems: 'center', paddingTop: 80, paddingHorizontal: spacing.xl },
  emptyText: { color: 'rgba(255,255,255,0.5)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: 'center' },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  headlineScore: { fontSize: 56, fontFamily: fontFamily.regular, lineHeight: 64 },
  headlineRight: { gap: spacing.xs },
  headlineLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold },
  gaugeWrapper: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  statsContainer: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
chartCard: {
    marginHorizontal: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  chartSectionTitle: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  chartArea: {
    height: 200,
    position: 'relative',
    paddingBottom: 24,
  },
  targetLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  targetDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  targetLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    marginLeft: 4,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barValueLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    fontFamily: fontFamily.regular,
    marginBottom: 4,
  },
  barContainer: {
    width: 28,
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  ghostSegment: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    borderBottomWidth: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  sleepBar: {
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    minHeight: 4,
  },
  barDayLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    marginTop: 6,
  },
  insightBlock: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(107,142,255,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107,142,255,0.3)',
  },
  insightText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    lineHeight: 22,
  },
});
