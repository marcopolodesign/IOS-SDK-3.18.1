import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import AnimatedGlow, { type PresetConfig } from 'react-native-animated-glow';
import { colors, fontFamily, fontSize, spacing } from '../../theme/colors';
import type { IllnessScore } from '../../types/supabase.types';
import { statusColor } from './IllnessWatchCard';

const TOTAL_DAYS = 30;
const COLS = 10;
const ROWS = 3;

// Apple Intelligence preset structure, driven by the illness status color
export function darkBg(status: 'PEAK' | 'CLEAR' | 'WATCH' | 'SICK'): string {
  if (status === 'PEAK') return 'rgba(24, 18, 0, 0.97)';
  if (status === 'SICK') return 'rgba(28, 4, 4, 0.97)';
  if (status === 'WATCH') return 'rgba(28, 16, 0, 0.97)';
  return 'rgba(4, 22, 12, 0.97)';
}

export function createIllnessGlowPreset(accentColor: string, status: 'PEAK' | 'CLEAR' | 'WATCH' | 'SICK'): PresetConfig {
  const c = accentColor;
  const cDim = accentColor + '88';
  const cFaint = accentColor + '44';
  return {
    metadata: {
      name: 'Illness Glow',
      textColor: '#FFFFFF',
      category: 'Custom',
      tags: ['illness'],
    },
    states: [
      {
        name: 'default',
        preset: {
          cornerRadius: 20,
          outlineWidth: 0,
          backgroundColor: darkBg(status),
          animationSpeed: 0,
          borderSpeedMultiplier: 0,
          glowLayers: [
            // Tight edge glow — stays close to the perimeter
            {
              glowPlacement: 'inside',
              colors: [c, cDim, cFaint],
              glowSize: 18,
              opacity: 0.45,
              speedMultiplier: 0,
              coverage: 1,
            },
          ],
        },
      },
    ],
  };
}

interface IllnessStreakCardGlowProps {
  history: IllnessScore[];
  latestRow: IllnessScore;
}

function localDateStr(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeClearStreak(sorted: IllnessScore[]): number {
  let streak = 0;
  let prevDate: string | null = null;
  for (const row of sorted) {
    if (prevDate !== null) {
      const prev = new Date(prevDate + 'T12:00:00');
      const curr = new Date(row.score_date + 'T12:00:00');
      if (Math.round((prev.getTime() - curr.getTime()) / 86400000) > 1) break;
    }
    if (row.status !== 'CLEAR') break;
    streak++;
    prevDate = row.score_date;
  }
  return streak;
}

function computeWatchSickStreak(sorted: IllnessScore[], latestStatus: string): number {
  if (latestStatus === 'CLEAR') return 0;
  let count = 0;
  for (const row of sorted) {
    if (row.status === 'CLEAR') break;
    count++;
  }
  return count;
}

function buildIllnessAnalysisQuery(latestRow: IllnessScore, history: IllnessScore[]): string {
  const n = history.length;
  const statusSeq = [...history]
    .sort((a, b) => b.score_date.localeCompare(a.score_date))
    .map(r => r.status)
    .join(' → ');
  const sig = (val: number | null, unit: string, prec = 0) =>
    val != null ? `${Number(val).toFixed(prec)} ${unit}` : 'no data';
  const bl = (val: number | null, unit: string, prec = 0) =>
    val != null ? `${Number(val).toFixed(prec)} ${unit}` : 'unknown';
  return (
    `Detailed live illness status report — last ${n} day${n !== 1 ? 's' : ''}:\n\n` +
    `Current status: ${latestRow.status} (score ${latestRow.score}, ${latestRow.score_date})\n\n` +
    `Signals (today vs baseline):\n` +
    `- Nocturnal HR: ${sig(latestRow.nocturnal_hr, 'bpm')} (baseline ${bl(latestRow.baseline_nocturnal_hr, 'bpm')})\n` +
    `- HRV (SDNN): ${sig(latestRow.hrv_sdnn, 'ms')} (baseline ${bl(latestRow.baseline_hrv_sdnn, 'ms')})\n` +
    `- SpO₂ min: ${sig(latestRow.spo2_min_val, '%')} (baseline ${bl(latestRow.baseline_spo2_min, '%')})\n` +
    `- Temperature: ${sig(latestRow.temperature_avg, '°C', 1)} (baseline ${bl(latestRow.baseline_temperature, '°C', 1)})\n` +
    `- Sleep awake: ${sig(latestRow.sleep_awake_min, 'min')} (baseline ${bl(latestRow.baseline_sleep_awake, 'min')})\n\n` +
    `Recent status pattern (newest → oldest): ${statusSeq}\n\n` +
    `Give me a thorough live status read: am I trending toward illness, what's the trajectory, what should I do today (training, rest, hydration, sleep), and which early-warning patterns stand out?`
  );
}

export function IllnessStreakCardGlow({ history, latestRow }: IllnessStreakCardGlowProps) {
  const { t } = useTranslation();

  const sorted = useMemo(
    () => [...history].sort((a, b) => b.score_date.localeCompare(a.score_date)),
    [history],
  );

  const status = latestRow.status as 'CLEAR' | 'WATCH' | 'SICK';
  const accentColor = statusColor(status);
  const glowPreset = useMemo(() => createIllnessGlowPreset(accentColor, status), [accentColor, status]);

  const dateMap = useMemo(() => {
    const m: Record<string, IllnessScore> = {};
    sorted.forEach(r => { m[r.score_date] = r; });
    return m;
  }, [sorted]);

  const clearStreak = useMemo(() => computeClearStreak(sorted), [sorted]);
  const watchSickStreak = useMemo(
    () => computeWatchSickStreak(sorted, status),
    [sorted, status],
  );

  const cells = useMemo(() => {
    return Array.from({ length: TOTAL_DAYS }, (_, i) => {
      const offset = TOTAL_DAYS - 1 - i;
      const date = localDateStr(offset);
      const row = dateMap[date];
      return { offset, date, row: row ?? null };
    });
  }, [dateMap]);

  const summaryText = useMemo(() => {
    if (sorted.length === 0) return t('illness_watch.empty_sync');
    if (status === 'PEAK') return t('illness_watch.streak_summary_peak');
    if (status === 'CLEAR') return t('illness_watch.streak_summary_clear', { count: clearStreak });
    if (status === 'WATCH') return t('illness_watch.streak_summary_watch', { count: watchSickStreak });
    return t('illness_watch.streak_summary_sick');
  }, [status, clearStreak, watchSickStreak, sorted.length, t]);

  function handleCoachPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/chat',
      params: { q: buildIllnessAnalysisQuery(latestRow, history), mode: 'analyst' },
    });
  }

  return (
    <View style={styles.wrapper}>
      <AnimatedGlow preset={glowPreset} style={styles.glowContainer}>
        <View style={styles.inner}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>{t('illness_watch.streak_card_title')}</Text>
            {clearStreak > 0 && (
              <View style={styles.streakPill}>
                <Ionicons name="flash" size={13} color={colors.success} />
                <Text style={styles.streakPillText}>
                  {t('illness_watch.streak_label_days', { count: clearStreak })}
                </Text>
              </View>
            )}
          </View>

          {/* Grid */}
          <View style={styles.grid}>
            {Array.from({ length: ROWS }, (_, row) => (
              <View key={row} style={styles.gridRow}>
                {cells.slice(row * COLS, row * COLS + COLS).map(cell => {
                  const isToday = cell.offset === 0;
                  const hasData = cell.row !== null;
                  const cellColor = hasData
                    ? statusColor(cell.row!.status as 'CLEAR' | 'WATCH' | 'SICK')
                    : undefined;
                  return (
                    <View
                      key={cell.date}
                      style={[
                        styles.cell,
                        hasData
                          ? {
                              backgroundColor: cellColor + '55',
                              borderWidth: 1.5,
                              borderColor: cellColor,
                              opacity: isToday ? 1 : 0.85,
                              shadowColor: cellColor,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 1,
                              shadowRadius: 10,
                              elevation: 8,
                            }
                          : styles.cellEmpty,
                        isToday && styles.cellToday,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Summary */}
          <Text style={styles.summary}>{summaryText}</Text>

          {/* Coach CTA */}
          <TouchableOpacity style={styles.ctaButton} onPress={handleCoachPress} activeOpacity={0.82}>
            <Ionicons name="sparkles-outline" size={16} color="#000000" />
            <Text style={styles.ctaText}>{t('illness_watch.streak_cta_report')}</Text>
          </TouchableOpacity>
        </View>
      </AnimatedGlow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 28,
  },
  glowContainer: {
    borderRadius: 20,
  },
  inner: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 14,
  },
  title: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 22,
    letterSpacing: 0.2,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakPillText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  grid: {
    paddingHorizontal: spacing.lg,
    gap: 8,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
  },
  cellEmpty: {
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  cellToday: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.75)',
  },
  summary: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    paddingHorizontal: spacing.lg,
    marginBottom: 14,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    paddingVertical: 13,
    borderRadius: 14,
  },
  ctaText: {
    fontFamily: fontFamily.demiBold,
    fontSize: 15,
    color: '#000000',
  },
});
