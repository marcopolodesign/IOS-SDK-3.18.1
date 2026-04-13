import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { spacing, fontFamily, fontSize } from '../../theme/colors';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { supabase } from '../../services/SupabaseService';
import { parseLocalDate } from '../../utils/chartMath';
import { reportError } from '../../utils/sentry';

// dayOfWeek index (0=Sun..6=Sat) → bar position in S M T W T F S layout
type SleepDay = { barIndex: number; minutes: number };

type DailySleepTrendCardProps = {
  headerRight?: React.ReactNode;
};

export function DailySleepTrendCard({ headerRight }: DailySleepTrendCardProps = {}) {
  const { t } = useTranslation();
  const DAY_LABELS = [
    t('sleep_trend.day_sun'),
    t('sleep_trend.day_mon'),
    t('sleep_trend.day_tue'),
    t('sleep_trend.day_wed'),
    t('sleep_trend.day_thu'),
    t('sleep_trend.day_fri'),
    t('sleep_trend.day_sat'),
  ];
  const [sleepDays, setSleepDays] = useState<SleepDay[]>([]);
  const homeData = useHomeDataContext();

  useEffect(() => {
    let cancelled = false;

    const fetchSleep = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query daily_summaries keyed by wake-up date — overnight sessions spanning midnight
      // are always credited to the correct calendar day.
      const since = new Date();
      since.setDate(since.getDate() - 7);
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, sleep_total_min, nap_total_min')
        .eq('user_id', user.id)
        .gte('date', since.toISOString().slice(0, 10))
        .order('date', { ascending: true });

      if (error || !data) {
        reportError(error, { op: 'sleepTrend.fetch' }, 'warning');
        return;
      }

      const results: SleepDay[] = data
        .map(row => {
          const mins = (row.sleep_total_min ?? 0) + (row.nap_total_min ?? 0);
          if (mins <= 0) return null;
          const barIndex = parseLocalDate(row.date as string).getDay();
          return { barIndex, minutes: mins };
        })
        .filter((x): x is SleepDay => x !== null);

      if (!cancelled) {
        setSleepDays(results);
      }
    };

    fetchSleep().catch(e => {
      reportError(e, { op: 'sleepTrend.fetch' }, 'warning');
    });

    return () => { cancelled = true; };
  }, [homeData.lastNightSleep?.timeAsleepMinutes]);

  const hasEnoughForAverage = sleepDays.length >= 2;

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
      title={
        hasEnoughForAverage || sleepDays.length === 0
          ? t('sleep_trend.card_title')
          : t('sleep_trend.card_title_last')
      }
      headerValue={
        sleepDays.length === 0
          ? t('sleep_trend.value_none')
          : formatMinutes(hasEnoughForAverage ? avgMinutes : sleepDays[0].minutes)
      }
      headerSubtitle={
        sleepDays.length === 0
          ? t('sleep_trend.status_no_data')
          : hasEnoughForAverage
          ? t('sleep_trend.subtitle_great')
          : t('sleep_trend.subtitle_last_night')
      }
      gradientStops={[
        { offset: 0, color: 'rgba(35, 101, 203, 0.95)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      headerRight={headerRight}
    >
      <View style={styles.chart}>
        <View style={styles.barsRow}>
          {DAY_LABELS.map((label, idx) => {
            const dayData = sleepDays.find(d => d.barIndex === idx);
            const value = dayData?.minutes ?? 0;
            const heightPct = sleepDays.length ? Math.max(5, (value / maxMinutes) * 100) : 5;
            return (
              <View key={label + idx} style={styles.barWrapper}>
                <View style={[styles.bar, { height: `${heightPct}%` }]} />
                <Text style={styles.dayLabel}>{label}</Text>
                <Text style={styles.dayValue}>
                  {value > 0 ? formatMinutes(value) : '—'}
                </Text>
              </View>
            );
          })}
          {hasEnoughForAverage && (
            <View style={[styles.avgLineRow, { bottom: `${(avgMinutes / maxMinutes) * 100}%` }]}>
              <View style={styles.avgLineDashes}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <View key={i} style={styles.avgLineDash} />
                ))}
              </View>
              <View style={styles.avgPill}>
                <Text style={styles.avgPillText}>{formatMinutes(avgMinutes)}</Text>
              </View>
            </View>
          )}
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
    marginTop: spacing.md,
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
  avgLineRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  avgLineDashes: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    gap: 4,
    opacity: 0.75,
  },
  avgLineDash: {
    width: 6,
    height: 2,
    backgroundColor: '#f2a500',
    borderRadius: 1,
  },
  avgPill: {
    backgroundColor: '#f2a500',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    marginLeft: 4,
  },
  avgPillText: {
    color: '#1a1a1a',
    fontFamily: fontFamily.regular,
    fontSize: 10,
  },
  dayValue: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default DailySleepTrendCard;
