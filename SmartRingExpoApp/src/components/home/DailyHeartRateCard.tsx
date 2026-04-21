import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GradientInfoCard } from '../common/GradientInfoCard';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import { reportError } from '../../utils/sentry';
import { ActivityInfoSheet } from './ActivityInfoSheet';
import type { UnifiedActivity } from '../../types/activity.types';

type HourRange = { hour: number; min: number; max: number; hasData: boolean };

type Props = {
  /** Pre-fetched data — skips the internal BLE fetch when provided */
  preloadedData?: Array<{ timeMinutes: number; heartRate: number }>;
  headerRight?: React.ReactNode;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
};

export function DailyHeartRateCard({ preloadedData, headerRight, onTouchStart, onTouchEnd }: Props = {}) {
  const { t } = useTranslation();
  const [hourlyHrRanges, setHourlyHrRanges] = useState<HourRange[]>([]);
  const [selectedHrIndex, setSelectedHrIndex] = useState<number | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<UnifiedActivity | null>(null);
  const isMockData = UnifiedSmartRingService.isUsingMockData();
  const homeData = useHomeDataContext();
  const chartWidthRef = useRef(0);
  const touchStartXRef = useRef(0);
  const lastSetHrIndexRef = useRef<number | null>(null);

  // Map today's unified activities (all sources) to their start hour
  const activitiesByHour = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const map = new Map<number, UnifiedActivity[]>();
    for (const a of homeData.unifiedActivities) {
      if (!a.startDate.startsWith(todayStr)) continue;
      const hour = new Date(a.startDate).getHours();
      const existing = map.get(hour) ?? [];
      existing.push(a);
      map.set(hour, existing);
    }
    return map;
  }, [homeData.unifiedActivities]);
  const activitiesByHourRef = useRef(activitiesByHour);
  activitiesByHourRef.current = activitiesByHour;
  const handleTouchRef = useRef<(x: number) => void>(() => {});
  const onTouchStartRef = useRef(onTouchStart);
  const onTouchEndRef   = useRef(onTouchEnd);
  onTouchStartRef.current = onTouchStart;
  onTouchEndRef.current   = onTouchEnd;

  const parseX3DateToMinutes = (value?: string): number | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const [datePart, timePart] = value.trim().split(/\s+/);
    if (!datePart) return undefined;
    const [y, m, d] = datePart.split('.').map(Number);
    const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
    if ([y, m, d, hh, mm, ss].some((n) => Number.isNaN(n))) return undefined;
    const dt = new Date(y, m - 1, d, hh, mm, ss);
    if (!Number.isFinite(dt.getTime()) || dt.getTime() <= 0) return undefined;
    return dt.getHours() * 60 + dt.getMinutes();
  };

  const buildRanges = (data: Array<{ timeMinutes: number; heartRate: number }>) => {
    if (data && data.length > 0) {
      const hourly = new Map<number, { min: number; max: number; hasData: boolean }>();
      data.forEach(d => {
        const hr = d.heartRate ?? 0;
        const minutes = d.timeMinutes ?? 0;
        const hour = Math.max(0, Math.min(23, Math.floor(minutes / 60)));
        const existing = hourly.get(hour);
        if (!existing) {
          hourly.set(hour, { min: hr, max: hr, hasData: true });
        } else {
          hourly.set(hour, { min: Math.min(existing.min, hr), max: Math.max(existing.max, hr), hasData: true });
        }
      });

      const ranges: HourRange[] = Array.from({ length: 24 }, (_, hour) => {
        const entry = hourly.get(hour);
        if (entry) return { hour, min: entry.min, max: entry.max, hasData: entry.hasData };
        // No data for this hour
        return { hour, min: 0, max: 0, hasData: false };
      });
      setHourlyHrRanges(ranges);
    } else {
      setHourlyHrRanges([]);
    }
  };

  useEffect(() => {
    if (preloadedData !== undefined) {
      // Context data provided — use it (may be empty [] while ring is syncing;
      // useHomeData preserves the last good hrChartData across refreshes so this
      // will become populated once the first successful fetch completes).
      if (preloadedData.length > 0) buildRanges(preloadedData);
      return;
    }
    // No context (card used standalone) — fetch directly from ring.
    // Use getContinuousHeartRate (same as testing.tsx / useHomeData).
    UnifiedSmartRingService.getContinuousHeartRateRaw()
      .then(hrRaw => {
        const points: Array<{ timeMinutes: number; heartRate: number }> = [];
        for (const rec of hrRaw.records || []) {
          const arr: number[] = Array.isArray(rec.arrayDynamicHR)
            ? rec.arrayDynamicHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
            : [];
          const ts = rec.startTimestamp;
          const startMin = typeof ts === 'number'
            ? (ts > 1e10 ? new Date(ts).getHours() * 60 + new Date(ts).getMinutes() : Math.round(ts / 60))
            : (parseX3DateToMinutes(rec.date) ?? 0);
          arr.forEach((v: number, idx: number) => {
            if (v > 0) points.push({ timeMinutes: startMin + idx, heartRate: v });
          });

          // Backward-compat fallback if a raw packet slipped through without normalization.
          if (arr.length === 0 && Array.isArray(rec?.arrayContinuousHR)) {
            for (const seg of rec.arrayContinuousHR) {
              const segVals = Array.isArray(seg?.arrayHR)
                ? seg.arrayHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
                : [];
              const segStart = parseX3DateToMinutes(seg?.date) ?? startMin;
              segVals.forEach((v: number, idx: number) => {
                if (v > 0) points.push({ timeMinutes: segStart + idx, heartRate: v });
              });
            }
          }
        }
        if (points.length > 0) buildRanges(points);
      })
      .catch(e => { reportError(e, { op: 'dailyHR.fetchHourly' }, 'warning'); setHourlyHrRanges([]); });
  }, [preloadedData]);

  const hrMin = useMemo(() => {
    const vals = hourlyHrRanges.filter(h => h.hasData);
    if (vals.length === 0) return 0;
    return Math.min(...vals.map(h => h.min));
  }, [hourlyHrRanges]);

  const hrMax = useMemo(() => {
    const vals = hourlyHrRanges.filter(h => h.hasData);
    if (vals.length === 0) return 0;
    return Math.max(...vals.map(h => h.max));
  }, [hourlyHrRanges]);

  const hrRange = Math.max(1, hrMax - hrMin);
  const selectedRange = selectedHrIndex !== null ? hourlyHrRanges[selectedHrIndex] : null;

  const resetSelection = () => setSelectedHrIndex(null);

  const noData = hourlyHrRanges.length === 0 || hourlyHrRanges.every(h => !h.hasData);
  const headerValue = noData
    ? t('hr_daily.value_none')
    : selectedRange
    ? `${selectedRange.min}-${selectedRange.max}`
    : `${hrMin}-${hrMax}`;
  const headerSubtitle = noData
    ? t('hr_daily.status_no_data')
    : selectedRange
    ? `${String(selectedRange.hour).padStart(2, '0')}:00`
    : isMockData
    ? t('hr_daily.subtitle_mock')
    : t('hr_daily.subtitle_normal');

  handleTouchRef.current = (touchX: number) => {
    if (!chartWidthRef.current || hourlyHrRanges.length === 0) return;
    const normalized = Math.max(0, Math.min(chartWidthRef.current, touchX));
    const ratio = normalized / chartWidthRef.current;
    const idx = Math.max(
      0,
      Math.min(hourlyHrRanges.length - 1, Math.round(ratio * (hourlyHrRanges.length - 1)))
    );
    if (hourlyHrRanges[idx]?.hasData) {
      lastSetHrIndexRef.current = idx;
      setSelectedHrIndex(idx);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        touchStartXRef.current = evt.nativeEvent.locationX;
        onTouchStartRef.current?.();
        handleTouchRef.current(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleTouchRef.current(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: (evt) => {
        const dx = Math.abs(evt.nativeEvent.locationX - touchStartXRef.current);
        const idx = lastSetHrIndexRef.current;
        if (dx < 8 && idx !== null) {
          const acts = activitiesByHourRef.current.get(idx);
          if (acts?.length) setSelectedActivity(acts[0]);
        }
        lastSetHrIndexRef.current = null;
        setSelectedHrIndex(null);
        onTouchEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        lastSetHrIndexRef.current = null;
        setSelectedHrIndex(null);
        onTouchEndRef.current?.();
      },
    })
  ).current;

  return (
    <>
    <ActivityInfoSheet
      activity={selectedActivity}
      visible={!!selectedActivity}
      onClose={() => setSelectedActivity(null)}
    />
    <GradientInfoCard
      icon={<Text style={styles.hrIcon}>♥</Text>}
      title={t('hr_daily.card_title')}
      headerValue={headerValue}
      headerSubtitle={headerSubtitle}
      gradientStops={[
        { offset: 0, color: 'rgba(171, 13, 13, 0.99)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      onHeaderPress={() => {
        resetSelection();
        router.push('/detail/heart-rate-detail');
      }}
      showArrow
      headerRight={headerRight}
    >
      <View style={styles.hrChart} {...pan.panHandlers}>
        {noData ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>{t('hr_daily.empty_no_data')}</Text>
            <Text style={styles.noDataSub}>{t('hr_daily.empty_hint')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.hrGridLine} />
            <View style={[styles.hrGridLine, { top: '33%' }]} />
            <View style={[styles.hrGridLine, { top: '66%' }]} />
            <View
              style={styles.hrBars}
              onLayout={(e) => {
                chartWidthRef.current = e.nativeEvent.layout.width;
              }}
            >
              {hourlyHrRanges.map((item, idx) => {
                const hasData = item.hasData;
                const barMin = hasData ? item.min : hrMin;
                const barMax = hasData ? item.max : hrMin;
                const topPct = hasData ? Math.max(0, ((hrMax - barMax) / hrRange) * 100) : 95;
                const heightPct = hasData ? Math.max(3, ((barMax - barMin) / hrRange) * 100) : 4;
                const selected = selectedHrIndex === idx;
                const hasSelection = selectedHrIndex !== null;
                const barOpacity = hasData ? (hasSelection ? (selected ? 1 : 0.35) : 1) : 0.08;
                const hourActivities = activitiesByHour.get(item.hour);
                const primary = hourActivities?.[0];
                const extra = (hourActivities?.length ?? 0) - 1;
                return (
                  <View key={`hr-${idx}`} style={styles.hrBarWrapper}>
                    {primary && (
                      <View style={styles.activityPin} pointerEvents="none">
                        <View style={[styles.activityIconCircle, { backgroundColor: `${primary.color}28` }]}>
                          <Ionicons name={primary.icon as any} size={10} color={primary.color} />
                          {extra > 0 && (
                            <View style={styles.extraBadge}>
                              <Text style={styles.extraBadgeText}>+{extra}</Text>
                            </View>
                          )}
                        </View>
                        <View style={[styles.activityPinStem, { backgroundColor: primary.color }]} />
                      </View>
                    )}
                    <View
                      style={[
                        styles.hrBar,
                        hasData && styles.hrBarActive,
                        {
                          top: `${topPct}%`,
                          height: `${heightPct}%`,
                          opacity: barOpacity,
                        },
                      ]}
                    />
                  </View>
                );
              })}
              {selectedHrIndex !== null && (
                <View
                  pointerEvents="none"
                  style={[
                    styles.hrMarkerOverlay,
                    {
                      left: `${(selectedHrIndex / Math.max(1, 24 - 1)) * 100}%`,
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.hrAxis}>
              <Text style={styles.hrAxisLabel}>0</Text>
              <Text style={styles.hrAxisLabel}>6</Text>
              <Text style={styles.hrAxisLabel}>12</Text>
              <Text style={styles.hrAxisLabel}>18</Text>
              <Text style={styles.hrAxisLabel}>24</Text>
            </View>
            <View style={styles.hrYAxis}>
              <Text style={styles.hrAxisLabel}>{hrMax}</Text>
              <Text style={styles.hrAxisLabel}>{Math.round(hrMin + hrRange * 0.5)}</Text>
              <Text style={styles.hrAxisLabel}>{hrMin}</Text>
            </View>
          </>
        )}
      </View>
    </GradientInfoCard>
    </>
  );
}

const styles = StyleSheet.create({
  hrIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  hrChart: {
    height: 200,
    marginTop: spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  hrGridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '20%',
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  hrBars: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.xl + 4, // leave room for y-axis labels
    top: spacing.sm,
    bottom: 32,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  hrBarWrapper: {
    position: 'relative',
    flex: 1,
    height: '100%',
    alignItems: 'center',
  },
  hrBar: {
    position: 'absolute',
    width: 8,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  hrBarActive: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  activityPin: {
    position: 'absolute',
    top: 0,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  activityIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activityPinStem: {
    width: 1.5,
    height: 5,
    opacity: 0.7,
  },
  extraBadge: {
    position: 'absolute',
    top: -3,
    right: -4,
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderRadius: 4,
    paddingHorizontal: 2,
  },
  extraBadgeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 7,
    fontFamily: fontFamily.demiBold,
  },
  noDataContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  noDataText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontFamily: fontFamily.regular,
  },
  noDataSub: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  hrMarkerOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    borderRightWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.8)',
    opacity: 0.8,
  },
  hrAxis: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.xl + 4,
    bottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  hrAxisLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  hrYAxis: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    bottom: 32,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
});

export default DailyHeartRateCard;
