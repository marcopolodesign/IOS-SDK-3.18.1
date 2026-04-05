import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { supabase } from '../services/SupabaseService';
import { colors, fontFamily, fontSize } from '../theme/colors';
import type { IllnessScore } from '../types/supabase.types';
import type { IllnessStatus } from '../types/focus.types';
import {
  getSeverity,
  severityColor,
  SeverityPill,
  statusColor,
} from '../components/focus/IllnessWatchCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 120;
const CHART_PAD = { top: 14, right: 14, bottom: 22, left: 38 };

// ─── Signal config ─────────────────────────────────────────────────────────────

interface SignalConfig {
  i18nKey: string;
  valueField: keyof IllnessScore;
  baselineField: keyof IllnessScore;
  subField: keyof IllnessScore;
  weight: number;
  unit: string;
  precision: number;
  lineColor: string;
}

const SIGNALS: SignalConfig[] = [
  { i18nKey: 'nocturnal_hr', valueField: 'nocturnal_hr', baselineField: 'baseline_nocturnal_hr', subField: 'sub_nocturnal_hr', weight: 30, unit: 'bpm', precision: 0, lineColor: colors.error },
  { i18nKey: 'hrv', valueField: 'hrv_sdnn', baselineField: 'baseline_hrv_sdnn', subField: 'sub_hrv', weight: 25, unit: 'ms', precision: 0, lineColor: colors.tertiary },
  { i18nKey: 'spo2', valueField: 'spo2_min_val', baselineField: 'baseline_spo2_min', subField: 'sub_spo2', weight: 20, unit: '%', precision: 0, lineColor: '#B16BFF' },
  { i18nKey: 'temperature', valueField: 'temperature_avg', baselineField: 'baseline_temperature', subField: 'sub_temperature', weight: 15, unit: '°C', precision: 1, lineColor: '#FF8C42' },
  { i18nKey: 'sleep', valueField: 'sleep_awake_min', baselineField: 'baseline_sleep_awake', subField: 'sub_sleep', weight: 10, unit: 'min', precision: 0, lineColor: '#FFD166' },
];

const SIGNAL_LABEL_KEYS: Record<string, string> = {
  nocturnal_hr: 'illness_watch.signal_nocturnal_hr',
  hrv: 'illness_watch.signal_hrv',
  spo2: 'illness_watch.signal_spo2_min',
  temperature: 'illness_watch.signal_temperature',
  sleep: 'illness_watch.signal_sleep',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtValue(val: number | null | undefined, precision: number, unit: string): string | null {
  if (val == null) return null;
  return `${Number(val).toFixed(precision)} ${unit}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function shortDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function scoreBarColor(status: string): string {
  if (status === 'SICK') return colors.error;
  if (status === 'WATCH') return '#FF8C42';
  return colors.success;
}

// ─── Signal Line Chart ─────────────────────────────────────────────────────────

function SignalChart({
  history,
  valueField,
  baselineField,
  lineColor,
  unit,
  precision,
}: {
  history: IllnessScore[];
  valueField: keyof IllnessScore;
  baselineField: keyof IllnessScore;
  lineColor: string;
  unit: string;
  precision: number;
}) {
  // Sort oldest → newest
  const sorted = [...history].sort((a, b) => a.score_date.localeCompare(b.score_date));

  // Extract data points (skip nulls)
  const points: Array<{ idx: number; val: number; date: string }> = [];
  sorted.forEach((row, i) => {
    const v = row[valueField] as number | null;
    if (v != null) points.push({ idx: i, val: v, date: row.score_date });
  });

  if (points.length < 2) return null;

  // Baseline from latest row
  const baseline = sorted[sorted.length - 1][baselineField] as number | null;

  // Compute Y range
  const allVals = points.map(p => p.val);
  if (baseline != null) allVals.push(baseline);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const rangePad = (maxV - minV) * 0.15 || 1;
  const yMin = minV - rangePad;
  const yMax = maxV + rangePad;

  const chartW = SCREEN_WIDTH - 40 - CHART_PAD.left - CHART_PAD.right; // 40 = screen padding
  const chartH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const totalW = SCREEN_WIDTH - 40;
  const n = sorted.length;

  const getX = (idx: number) => CHART_PAD.left + (idx / Math.max(n - 1, 1)) * chartW;
  const getY = (val: number) => CHART_PAD.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;

  // Build line path
  let linePath = '';
  points.forEach((p, i) => {
    const x = getX(p.idx);
    const y = getY(p.val);
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  // Build area path
  let areaPath = '';
  if (points.length > 0) {
    areaPath = `M ${getX(points[0].idx)} ${CHART_PAD.top + chartH}`;
    points.forEach(p => { areaPath += ` L ${getX(p.idx)} ${getY(p.val)}`; });
    areaPath += ` L ${getX(points[points.length - 1].idx)} ${CHART_PAD.top + chartH} Z`;
  }

  // Y-axis labels (3 ticks)
  const yMid = (yMin + yMax) / 2;
  const yTicks = [yMax, yMid, yMin];

  // X-axis labels — show ~5 evenly spaced dates
  const xLabelCount = Math.min(5, n);
  const xLabels: Array<{ idx: number; label: string }> = [];
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 0; i < xLabelCount; i++) {
    const idx = Math.round((i / (xLabelCount - 1)) * (n - 1));
    const date = sorted[idx].score_date;
    xLabels.push({ idx, label: date === today ? 'Today' : shortDate(date) });
  }

  const gradientId = `grad_${valueField as string}`;

  return (
    <Svg width={totalW} height={CHART_H}>
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Grid lines */}
      {yTicks.map((v, i) => (
        <Line
          key={`g${i}`}
          x1={CHART_PAD.left}
          y1={getY(v)}
          x2={CHART_PAD.left + chartW}
          y2={getY(v)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}

      {/* Baseline dashed line */}
      {baseline != null && (
        <>
          <Line
            x1={CHART_PAD.left}
            y1={getY(baseline)}
            x2={CHART_PAD.left + chartW}
            y2={getY(baseline)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.2}
            strokeDasharray="5,4"
          />
          <SvgText
            x={CHART_PAD.left + chartW + 2}
            y={getY(baseline) + 3}
            fill="rgba(255,255,255,0.35)"
            fontSize={9}
            fontFamily={fontFamily.regular}
          >
            base
          </SvgText>
        </>
      )}

      {/* Area fill */}
      {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}

      {/* Value line */}
      {linePath ? (
        <Path
          d={linePath}
          fill="none"
          stroke={lineColor}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}

      {/* Data dots */}
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        return (
          <React.Fragment key={p.date}>
            <Circle
              cx={getX(p.idx)}
              cy={getY(p.val)}
              r={isLast ? 4.5 : 2.5}
              fill={lineColor}
              opacity={isLast ? 1 : 0.6}
            />
            {isLast && (
              <Circle
                cx={getX(p.idx)}
                cy={getY(p.val)}
                r={2}
                fill={colors.background}
              />
            )}
          </React.Fragment>
        );
      })}

      {/* Y-axis labels */}
      {yTicks.map((v, i) => (
        <SvgText
          key={`yl${i}`}
          x={CHART_PAD.left - 6}
          y={getY(v) + 3}
          fill="rgba(255,255,255,0.35)"
          fontSize={9}
          textAnchor="end"
          fontFamily={fontFamily.regular}
        >
          {Number(v).toFixed(precision)}
        </SvgText>
      ))}

      {/* X-axis labels */}
      {xLabels.map(({ idx, label }) => (
        <SvgText
          key={`xl${idx}`}
          x={getX(idx)}
          y={CHART_H - 4}
          fill="rgba(255,255,255,0.35)"
          fontSize={9}
          textAnchor="middle"
          fontFamily={fontFamily.regular}
        >
          {label}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function BackButton() {
  return (
    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
      <Text style={styles.backBtnText}>← Back</Text>
    </TouchableOpacity>
  );
}

function SignalCard({
  sig,
  latestRow,
  history,
  t,
}: {
  sig: SignalConfig;
  latestRow: IllnessScore;
  history: IllnessScore[];
  t: (k: string) => string;
}) {
  const rawVal = latestRow[sig.valueField] as number | null;
  const rawBase = latestRow[sig.baselineField] as number | null;
  const rawSub = latestRow[sig.subField] as number;
  const severity = getSeverity(rawSub, sig.weight);
  const severityLabel = t(`illness_watch.severity_${severity}`);
  const hasData = rawVal != null;
  const hasBaseline = rawBase != null;

  return (
    <View style={styles.signalCard}>
      <View style={styles.signalCardHeader}>
        <Text style={styles.signalCardTitle}>{t(SIGNAL_LABEL_KEYS[sig.i18nKey])}</Text>
        <SeverityPill severity={severity} label={severityLabel} />
      </View>

      {/* Chart */}
      <View style={styles.chartWrap}>
        <SignalChart
          history={history}
          valueField={sig.valueField}
          baselineField={sig.baselineField}
          lineColor={sig.lineColor}
          unit={sig.unit}
          precision={sig.precision}
        />
      </View>

      {/* Values summary */}
      {hasData ? (
        <View style={styles.valuesRow}>
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>{t('illness_watch.detail_your_value')}</Text>
            <Text style={[styles.valueNumber, { color: severityColor(severity) }]}>
              {fmtValue(rawVal, sig.precision, sig.unit)}
            </Text>
          </View>
          <View style={styles.valueDivider} />
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>{t('illness_watch.detail_baseline')}</Text>
            <Text style={styles.valueNumber}>
              {hasBaseline
                ? fmtValue(rawBase, sig.precision, sig.unit)
                : t('illness_watch.detail_building_baseline')}
            </Text>
          </View>
        </View>
      ) : (
        <Text style={styles.noDataText}>{t('illness_watch.detail_building_baseline')}</Text>
      )}

      {/* Medical explanation */}
      <Text style={styles.explanationText}>
        {t(`illness_watch.detail_explain_${sig.i18nKey}`)}
      </Text>
    </View>
  );
}

function TrendBars({
  trend,
  t,
}: {
  trend: IllnessScore[];
  t: (k: string) => string;
}) {
  if (trend.length === 0) return null;
  const bars = [...trend].sort((a, b) => a.score_date.localeCompare(b.score_date));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <View style={styles.trendContainer}>
      {bars.map((bar) => {
        const isToday = bar.score_date === today;
        const barH = Math.max(4, Math.round((bar.score / 100) * 80));
        const barColor = scoreBarColor(bar.status);
        return (
          <View key={bar.score_date} style={styles.trendBarWrap}>
            <Text style={[styles.trendScore, { color: barColor, opacity: isToday ? 1 : 0.6 }]}>
              {bar.score}
            </Text>
            <View
              style={[
                styles.trendBar,
                {
                  height: barH,
                  backgroundColor: barColor,
                  opacity: isToday ? 1 : 0.45,
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: isToday ? barColor : 'transparent',
                },
              ]}
            />
            <Text style={[styles.trendDayLabel, { color: isToday ? barColor : 'rgba(255,255,255,0.4)' }]}>
              {isToday ? t('illness_watch.detail_trend_today') : shortDay(bar.score_date)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Recommendations({ status, t }: { status: IllnessStatus; t: (k: string) => string }) {
  const s = status.toLowerCase() as 'clear' | 'watch' | 'sick';
  const recs = [1, 2, 3].map(n => t(`illness_watch.detail_rec_${s}_${n}`));
  const accent = statusColor(status);
  return (
    <View style={styles.recList}>
      {recs.map((rec, i) => (
        <View key={i} style={styles.recRow}>
          <View style={[styles.recDot, { backgroundColor: accent }]} />
          <Text style={styles.recText}>{rec}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function IllnessDetailScreen() {
  const { t } = useTranslation();
  const [latestRow, setLatestRow] = useState<IllnessScore | null>(null);
  const [history, setHistory] = useState<IllnessScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        // Fetch last 14 days of full rows for the signal charts
        const { data } = await supabase
          .from('illness_scores')
          .select('*')
          .eq('user_id', userId)
          .order('score_date', { ascending: false })
          .limit(14);

        if (data && data.length > 0) {
          setLatestRow(data[0]);
          setHistory(data);
        }
      } catch {}
      finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <BackButton />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.tertiary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!latestRow) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <BackButton />
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>{t('illness_watch.empty_sync')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = latestRow.status as IllnessStatus;
  const dot = statusColor(status);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Text style={[styles.heroScore, { color: dot }]}>{latestRow.score}</Text>
          <View style={[styles.statusBadge, { borderColor: dot + '66', backgroundColor: dot + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: dot }]} />
            <Text style={[styles.statusBadgeText, { color: dot }]}>{status}</Text>
          </View>
          <Text style={styles.heroDate}>{formatDate(latestRow.score_date)}</Text>
          {latestRow.stale && (
            <Text style={styles.staleText}>{t('illness_watch.stale_warning')}</Text>
          )}
        </View>

        {/* ── Signal breakdown with charts ──────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('illness_watch.detail_signals_title')}</Text>
        {SIGNALS.map(sig => (
          <SignalCard
            key={sig.i18nKey}
            sig={sig}
            latestRow={latestRow}
            history={history}
            t={t}
          />
        ))}

        {/* ── Overall score trend ───────────────────────────────────────── */}
        {history.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>{t('illness_watch.detail_trend_title')}</Text>
            <View style={styles.glassCard}>
              <TrendBars trend={history} t={t} />
            </View>
          </>
        )}

        {/* ── Recommendations ───────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>{t('illness_watch.detail_recommendations_title')}</Text>
        <View style={styles.glassCard}>
          <Recommendations status={status} t={t} />
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backBtn: {
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  backBtnText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.tertiary,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: 28,
    marginBottom: 8,
  },
  heroScore: {
    fontFamily: fontFamily.demiBold,
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusBadgeText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    letterSpacing: 1,
  },
  heroDate: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 10,
  },
  staleText: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 6,
    textAlign: 'center',
  },

  // Sections
  sectionTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 24,
    marginBottom: 10,
  },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 16,
  },

  // Signal cards
  signalCard: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 14,
    marginBottom: 12,
  },
  signalCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  signalCardTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
    marginRight: 8,
  },
  chartWrap: {
    marginHorizontal: -6,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  valuesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    padding: 10,
  },
  valueBlock: {
    flex: 1,
    alignItems: 'center',
  },
  valueDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 4,
  },
  valueLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueNumber: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
  },
  noDataText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 8,
  },
  explanationText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 19,
  },

  // Trend
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 120,
    paddingTop: 8,
  },
  trendBarWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  trendScore: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginBottom: 3,
  },
  trendBar: {
    width: '55%',
    borderRadius: 4,
    minHeight: 4,
  },
  trendDayLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    marginTop: 4,
  },

  // Recommendations
  recList: {
    gap: 10,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  recText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20,
    flex: 1,
  },

  // Loading / empty
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.35)',
  },
  bottomPad: {
    height: 20,
  },
});
