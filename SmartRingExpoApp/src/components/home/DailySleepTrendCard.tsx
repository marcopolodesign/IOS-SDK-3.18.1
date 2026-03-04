import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GradientInfoCard } from '../common/GradientInfoCard';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import { spacing, fontFamily, fontSize } from '../../theme/colors';
import { useHomeDataContext } from '../../context/HomeDataContext';

// dayOfWeek index (0=Sun..6=Sat) → bar position in S M T W T F S layout
type SleepDay = { barIndex: number; minutes: number };

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type DailySleepTrendCardProps = {
  headerRight?: React.ReactNode;
};

export function DailySleepTrendCard({ headerRight }: DailySleepTrendCardProps = {}) {
  const [sleepDays, setSleepDays] = useState<SleepDay[]>([]);
  const [retryNonce, setRetryNonce] = useState(0);
  const homeData = useHomeDataContext();
  const hasCompletedLiveFetchRef = useRef(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);

  const toMinutes = (sleep: any): number => {
    if (!sleep) return 0;
    const explicit = Number(sleep.totalSleepMinutes ?? sleep.timeAsleepMinutes ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const deep = Number(sleep.deep ?? 0);
    const light = Number(sleep.light ?? 0);
    const rem = Number(sleep.rem ?? 0);
    const sum = deep + light + rem;
    return Number.isFinite(sum) && sum > 0 ? sum : 0;
  };

  useEffect(() => {
    let cancelled = false;

    const fetchSleep = async () => {
      // No ring: use context-only today fallback and reset live fetch lifecycle.
      if (!homeData.isRingConnected) {
        hasCompletedLiveFetchRef.current = false;
        retryCountRef.current = 0;

        // Fallback: use context for today only, mapped to correct bar
        const contextMinutes = toMinutes(homeData.lastNightSleep as any);
        if (!cancelled && contextMinutes > 0) {
          const todayBarIndex = new Date().getDay(); // 0=Sun..6=Sat
          setSleepDays([{ barIndex: todayBarIndex, minutes: contextMinutes }]);
        } else if (!cancelled) {
          setSleepDays([]);
        }
        return;
      }

      // Wait for home sync to finish so we don't race BLE calls and cache warm-up.
      if (homeData.isSyncing) {
        return;
      }

      // Already fetched reliable 7-day data in this mounted session.
      if (hasCompletedLiveFetchRef.current) {
        return;
      }

      const today = new Date();
      const resultsByBar = new Map<number, number>();

      for (let i = 0; i < 7; i++) {
        try {
          const data = await UnifiedSmartRingService.getSleepByDay(i);
          const mins = toMinutes(data);
          if (mins > 0) {
            // Prefer SDK timestamp date if present; fallback to dayIndex-based date.
            const startTs = Number((data as any)?.startTime ?? (data as any)?.endTime ?? 0);
            const d = Number.isFinite(startTs) && startTs > 0
              ? new Date(startTs)
              : (() => {
                  const fallback = new Date(today);
                  fallback.setDate(fallback.getDate() - i);
                  return fallback;
                })();
            const barIndex = d.getDay();
            const prev = resultsByBar.get(barIndex) ?? 0;
            if (mins > prev) {
              resultsByBar.set(barIndex, mins);
            }
          }
        } catch (e) {
          console.log(`[DailySleepTrendCard] sleep fetch day ${i} error`, e);
        }
      }

      const results: SleepDay[] = Array.from(resultsByBar.entries())
        .map(([barIndex, minutes]) => ({ barIndex, minutes }))
        .sort((a, b) => a.barIndex - b.barIndex);

      if (!cancelled) {
        if (results.length > 0) {
          setSleepDays(results);
          // Mark complete when we have more than today; otherwise allow controlled retries.
          if (results.length >= 2 || retryCountRef.current >= 2) {
            hasCompletedLiveFetchRef.current = true;
          } else if (retryCountRef.current < 2) {
            retryCountRef.current += 1;
            retryTimerRef.current = setTimeout(() => {
              setRetryNonce(prev => prev + 1);
            }, 8000);
          }
        } else {
          // Final fallback: context data for today
          const contextMinutes = toMinutes(homeData.lastNightSleep as any);
          if (contextMinutes > 0) {
            setSleepDays([{ barIndex: today.getDay(), minutes: contextMinutes }]);
          }
          if (retryCountRef.current < 2) {
            retryCountRef.current += 1;
            retryTimerRef.current = setTimeout(() => {
              setRetryNonce(prev => prev + 1);
            }, 8000);
          } else {
            hasCompletedLiveFetchRef.current = true;
          }
        }
      }
    };

    fetchSleep().catch(() => {
      if (!cancelled) setSleepDays([]);
    });

    return () => {
      cancelled = true;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [
    homeData.isRingConnected,
    homeData.isSyncing,
    homeData.lastNightSleep,
    homeData.lastNightSleep?.timeAsleepMinutes,
    (homeData.lastNightSleep as any)?.deep,
    (homeData.lastNightSleep as any)?.light,
    (homeData.lastNightSleep as any)?.rem,
    retryNonce,
  ]);

  const avgMinutes = useMemo(() => {
    if (!sleepDays.length) return 0;
    return Math.round(sleepDays.reduce((sum, d) => sum + d.minutes, 0) / sleepDays.length);
  }, [sleepDays]);

  const maxMinutes = useMemo(() => {
    if (!sleepDays.length) return 1;
    return Math.max(...sleepDays.map(d => d.minutes));
  }, [sleepDays]);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  return (
    <GradientInfoCard
      icon={<Text style={styles.icon}>♥</Text>}
      title="Avg. Sleep"
      headerValue={sleepDays.length ? formatMinutes(avgMinutes) : 'None'}
      headerSubtitle={sleepDays.length ? 'Great' : 'No data'}
      gradientStops={[
        { offset: 0, color: 'rgba(35, 101, 203, 0.95)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      headerRight={headerRight}
    >
      <View style={styles.chart}>
        <View style={[styles.avgLine, { top: `${100 - (avgMinutes / maxMinutes) * 100}%` }]} />
        <View style={styles.barsRow}>
          {DAY_LABELS.map((label, idx) => {
            const dayData = sleepDays.find(d => d.barIndex === idx);
            const value = dayData?.minutes ?? 0;
            const heightPct = sleepDays.length ? Math.max(5, (value / maxMinutes) * 100) : 5;
            return (
              <View key={label + idx} style={styles.barWrapper}>
                <View style={[styles.bar, { height: `${heightPct}%` }]} />
                <Text style={styles.dayLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  icon: {
    color: 'white',
    fontSize: 18,
  },
  chart: {
    height: 160,
    backgroundColor: '#222',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  barsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 16,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 6,
  },
  dayLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
  },
  avgLine: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    height: 2,
    backgroundColor: '#f2a500',
    opacity: 0.8,
  },
});

export default DailySleepTrendCard;
