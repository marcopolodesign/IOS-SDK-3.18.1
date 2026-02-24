import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GradientInfoCard } from '../common/GradientInfoCard';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import { spacing, fontFamily, fontSize } from '../../theme/colors';
import { useHomeDataContext } from '../../context/HomeDataContext';

type SleepDay = { dayIndex: number; minutes: number };

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function DailySleepTrendCard() {
  const [sleepDays, setSleepDays] = useState<SleepDay[]>([]);
  const homeData = useHomeDataContext();
  const hasTriedLiveFetchRef = useRef(false);

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
    const lastNight: any = homeData.lastNightSleep as any;

    const fetchSleep = async () => {
      const contextMinutes = toMinutes(lastNight);
      if (contextMinutes > 0) {
        hasTriedLiveFetchRef.current = false;
        if (!cancelled) {
          setSleepDays([{ dayIndex: 0, minutes: contextMinutes }]);
        }
        return;
      }

      if (!cancelled) {
        setSleepDays([]);
      }

      // Optional fallback: one native fetch for day 0 only.
      if (!homeData.isRingConnected || hasTriedLiveFetchRef.current) {
        return;
      }
      hasTriedLiveFetchRef.current = true;

      try {
        const data = await UnifiedSmartRingService.getSleepByDay(0);
        console.log('[DailySleepTrendCard] sleep day 0 fallback', data);
        const fallbackMinutes = toMinutes(data);
        if (!cancelled && fallbackMinutes > 0) {
          setSleepDays([{ dayIndex: 0, minutes: fallbackMinutes }]);
        }
      } catch (e) {
        console.log('[DailySleepTrendCard] sleep fetch fallback error', e);
      }
    };

    fetchSleep().catch(() => {
      if (!cancelled) setSleepDays([]);
    });

    return () => {
      cancelled = true;
    };
  }, [
    homeData.isRingConnected,
    homeData.lastNightSleep,
    homeData.lastNightSleep?.timeAsleepMinutes,
    (homeData.lastNightSleep as any)?.deep,
    (homeData.lastNightSleep as any)?.light,
    (homeData.lastNightSleep as any)?.rem,
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
    >
      <View style={styles.chart}>
        <View style={[styles.avgLine, { top: `${100 - (avgMinutes / maxMinutes) * 100}%` }]} />
        <View style={styles.barsRow}>
          {DAY_LABELS.map((label, idx) => {
            const dayData = sleepDays.find(d => d.dayIndex === idx);
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
