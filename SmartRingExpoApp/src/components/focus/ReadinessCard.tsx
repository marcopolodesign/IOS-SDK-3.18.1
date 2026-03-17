import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { colors, fontFamily, fontSize, spacing } from '../../theme/colors';
import type { ReadinessScore, FocusBaselines } from '../../types/focus.types';

interface ReadinessCardProps {
  readiness: ReadinessScore | null;
  baselines: FocusBaselines | null;
  isLoading: boolean;
}

function ReadinessIcon() {
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

function useDescribeComponent() {
  const { t } = useTranslation();
  return (score: number | null): string => {
    if (score == null) return t('readiness.desc_no_data');
    if (score >= 80) return t('readiness.desc_excellent');
    if (score >= 65) return t('readiness.desc_above_norm');
    if (score >= 45) return t('readiness.desc_on_track');
    return t('readiness.desc_below_norm');
  };
}

function MetricRow({
  label,
  score,
  barColor,
  describe,
}: {
  label: string;
  score: number | null;
  barColor: string;
  describe: (s: number | null) => string;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View
          style={[
            styles.barFill,
            { width: `${score ?? 0}%`, backgroundColor: barColor },
          ]}
        />
      </View>
      <Text style={styles.metricDesc}>{describe(score)}</Text>
    </View>
  );
}

function SkeletonRow() {
  return (
    <View style={styles.metricRow}>
      <View style={[styles.skeleton, { width: 70 }]} />
      <View style={[styles.barTrack, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
      <View style={[styles.skeleton, { width: 60 }]} />
    </View>
  );
}

export function ReadinessCard({ readiness, baselines, isLoading }: ReadinessCardProps) {
  const { t } = useTranslation();
  const describe = useDescribeComponent();
  const [expanded, setExpanded] = useState(false);
  const daysLogged = baselines?.daysLogged ?? 0;

  const rec = readiness?.recommendation ?? null;
  const subtitle =
    rec === 'GO' ? t('readiness.subtitle_go') : rec === 'EASY' ? t('readiness.subtitle_easy') : rec === 'REST' ? t('readiness.subtitle_rest') : undefined;

  const allNull =
    readiness != null &&
    readiness.components.hrv == null &&
    readiness.components.sleep == null &&
    readiness.components.restingHR == null &&
    readiness.components.trainingLoad == null;

  const hasData = readiness != null && !allNull;

  return (
    <GradientInfoCard
      icon={<ReadinessIcon />}
      title={t('readiness.card_title')}
      headerValue={readiness?.score}
      headerSubtitle={subtitle}
      showArrow={false}
      gradientStops={[
        { offset: 0, color: '#1A3D2A', opacity: 1 },
        { offset: 0.6, color: '#1A3D2A', opacity: 0 },
      ]}
      gradientCenter={{ x: 0.5, y: -0.5 }}
      gradientRadii={{ rx: '100%', ry: '250%' }}
      headerRight={
        hasData ? (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} hitSlop={12}>
            <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
          </TouchableOpacity>
        ) : undefined
      }
    >
      {isLoading ? (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      ) : readiness == null ? (
        <Text style={styles.emptyText}>{t('readiness.empty_sync')}</Text>
      ) : allNull ? (
        /* Building baseline -- no historical data yet */
        <View style={styles.buildingBlock}>
          <Text style={styles.buildingTitle}>{t('readiness.building_title')}</Text>
          <Text style={styles.buildingBody}>{t('readiness.building_body')}</Text>
          <View style={styles.daysRow}>
            {[1,2,3,4,5].map(i => (
              <View
                key={i}
                style={[styles.dayDot, { backgroundColor: i <= daysLogged ? colors.primary : 'rgba(255,255,255,0.12)' }]}
              />
            ))}
            <Text style={styles.daysLabel}>{t('readiness.building_progress', { done: daysLogged })}</Text>
          </View>
        </View>
      ) : expanded ? (
        <>
          <MetricRow label={t('readiness.component_hrv')} score={readiness.components.hrv} barColor={colors.hrv} describe={describe} />
          <MetricRow label={t('readiness.component_sleep')} score={readiness.components.sleep} barColor={colors.sleep} describe={describe} />
          <MetricRow label={t('readiness.component_resting_hr')} score={readiness.components.restingHR} barColor={colors.heartRate} describe={describe} />
          <MetricRow label={t('readiness.component_training')} score={readiness.components.trainingLoad} barColor={colors.steps} describe={describe} />
          <Text style={styles.confidence}>
            {t(daysLogged === 1 ? 'readiness.confidence_one' : 'readiness.confidence_other', { count: daysLogged })}
          </Text>
        </>
      ) : (
        <View style={styles.collapsedRow}>
          <Text style={styles.collapsedLabel}>{t('readiness.collapsed_components')}</Text>
          <TouchableOpacity onPress={() => setExpanded(true)} hitSlop={8}>
            <Text style={styles.showMore}>{t('readiness.show_details')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.55)',
    width: 80,
  },
  barTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
    opacity: 0.85,
  },
  metricDesc: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.55)',
    width: 80,
    textAlign: 'right',
  },
  confidence: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 2,
  },
  collapsedRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsedLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.45)',
  },
  showMore: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: colors.primary,
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.35)',
  },
  buildingBlock: {
    gap: 8,
  },
  buildingTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
  },
  buildingBody: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    lineHeight: 20,
  },
  daysRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  dayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  daysLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.35)',
    marginLeft: 4,
  },
  skeleton: {
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  chevron: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.45)',
  },
});
