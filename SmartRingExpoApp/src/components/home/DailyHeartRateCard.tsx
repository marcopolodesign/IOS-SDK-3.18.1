import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { GradientInfoCard } from '../common/GradientInfoCard';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import JstyleService from '../../services/JstyleService';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

type HourRange = { hour: number; min: number; max: number; hasData: boolean };

type Props = {
  /** Pre-fetched data — skips the internal BLE fetch when provided */
  preloadedData?: Array<{ timeMinutes: number; heartRate: number }>;
};

export function DailyHeartRateCard({ preloadedData }: Props = {}) {
  const [hourlyHrRanges, setHourlyHrRanges] = useState<HourRange[]>([]);
  const [selectedHrIndex, setSelectedHrIndex] = useState<number | null>(null);
  const isMockData = UnifiedSmartRingService.isUsingMockData();
  const chartWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const parseX3DateToMinutes = (value?: string): number | undefined => {
    if (!value || typeof value !== 'string') return undefined;
    const [datePart, timePart] = value.trim().split(/\s+/);
    if (!datePart) return undefined;
    const [y, m, d] = datePart.split('.').map(Number);
    const [hh, mm, ss] = (timePart || '00:00:00').split(':').map(Number);
    if ([y, m, d, hh, mm, ss].some((n) => Number.isNaN(n))) return undefined;
    const ts = new Date(y, m - 1, d, hh, mm, ss).getTime();
    if (!Number.isFinite(ts) || ts <= 0) return undefined;
    return Math.round((ts % 86400000) / 60000);
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
    JstyleService.getContinuousHeartRate()
      .then(hrRaw => {
        const points: Array<{ timeMinutes: number; heartRate: number }> = [];
        for (const rec of hrRaw.records || []) {
          const arr: number[] = Array.isArray(rec.arrayDynamicHR)
            ? rec.arrayDynamicHR.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
            : [];
          const ts = rec.startTimestamp;
          const startMin = typeof ts === 'number'
            ? (ts > 1e10 ? Math.round((ts % 86400000) / 60000) : Math.round(ts / 60))
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
      .catch(() => setHourlyHrRanges([]));
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
    ? 'None'
    : selectedRange
    ? `${selectedRange.min}-${selectedRange.max}`
    : `${hrMin}-${hrMax}`;
  const headerSubtitle = noData
    ? 'No data'
    : selectedRange
    ? `${String(selectedRange.hour).padStart(2, '0')}:00`
    : isMockData
    ? 'Normal · Mock data'
    : 'Normal';

  handleTouchRef.current = (touchX: number) => {
    if (!chartWidthRef.current || hourlyHrRanges.length === 0) return;
    const normalized = Math.max(0, Math.min(chartWidthRef.current, touchX));
    const ratio = normalized / chartWidthRef.current;
    const idx = Math.max(
      0,
      Math.min(hourlyHrRanges.length - 1, Math.round(ratio * (hourlyHrRanges.length - 1)))
    );
    if (hourlyHrRanges[idx]?.hasData) {
      setSelectedHrIndex(idx);
    }
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: (evt) => {
        handleTouchRef.current(evt.nativeEvent.locationX);
      },
      onPanResponderMove: (evt) => {
        handleTouchRef.current(evt.nativeEvent.locationX);
      },
      onPanResponderRelease: () => {
        setSelectedHrIndex(null);
      },
      onPanResponderTerminate: () => {
        setSelectedHrIndex(null);
      },
    })
  ).current;

  return (
    <GradientInfoCard
      icon={<Text style={styles.hrIcon}>♥</Text>}
      title="Heart Rate"
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
    >
      <View style={styles.hrChart}>
        {noData ? (
          <View style={styles.noDataContainer}>
            <Text style={styles.noDataText}>No heart rate data today</Text>
            <Text style={styles.noDataSub}>Data will appear after the ring syncs</Text>
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
              {...pan.panHandlers}
            >
              {hourlyHrRanges.map((item, idx) => {
                const hasData = item.hasData;
                const barMin = hasData ? item.min : hrMin;
                const barMax = hasData ? item.max : hrMin;
                const topPct = hasData ? Math.max(0, ((barMin - hrMin) / hrRange) * 100) : 95;
                const heightPct = hasData ? Math.max(3, ((barMax - barMin) / hrRange) * 100) : 4;
                const selected = selectedHrIndex === idx;
                const hasSelection = selectedHrIndex !== null;
                const barOpacity = hasData ? (hasSelection ? (selected ? 1 : 0.35) : 1) : 0.08;
                return (
                  <View key={`hr-${idx}`} style={styles.hrBarWrapper}>
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
