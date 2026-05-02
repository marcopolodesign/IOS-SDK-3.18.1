import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import Svg, {
  Path,
  Line,
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
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
  statusColor,
} from '../components/focus/IllnessWatchCard';
import { IllnessStreakCard } from '../components/focus/IllnessStreakCard';
import { IllnessStreakCardGlow } from '../components/focus/IllnessStreakCardGlow';
import { BackArrow } from '../components/detail/BackArrow';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 120;
const CHART_PAD = { top: 8, right: 0, bottom: 18, left: 0 };

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

function gradientColor(status: IllnessStatus): string {
  if (status === 'SICK') return '#AB0D0D';
  if (status === 'WATCH') return '#7A3A00';
  return '#004D2E';
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
  const sorted = [...history].sort((a, b) => a.score_date.localeCompare(b.score_date));

  const points: Array<{ idx: number; val: number; date: string }> = [];
  sorted.forEach((row, i) => {
    const v = row[valueField] as number | null;
    if (v != null) points.push({ idx: i, val: v, date: row.score_date });
  });

  if (points.length < 2) return null;

  const baseline = sorted[sorted.length - 1][baselineField] as number | null;

  const allVals = points.map(p => p.val);
  if (baseline != null) allVals.push(baseline);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const rangePad = (maxV - minV) * 0.15 || 1;
  const yMin = minV - rangePad;
  const yMax = maxV + rangePad;

  const totalW = SCREEN_WIDTH - 40;
  const chartW = totalW - CHART_PAD.left - CHART_PAD.right;
  const chartH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const n = sorted.length;

  const getX = (idx: number) => CHART_PAD.left + (idx / Math.max(n - 1, 1)) * chartW;
  const getY = (val: number) => CHART_PAD.top + chartH - ((val - yMin) / (yMax - yMin)) * chartH;

  let linePath = '';
  points.forEach((p, i) => {
    const x = getX(p.idx);
    const y = getY(p.val);
    linePath += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  let areaPath = '';
  if (points.length > 0) {
    areaPath = `M ${getX(points[0].idx)} ${CHART_PAD.top + chartH}`;
    points.forEach(p => { areaPath += ` L ${getX(p.idx)} ${getY(p.val)}`; });
    areaPath += ` L ${getX(points[points.length - 1].idx)} ${CHART_PAD.top + chartH} Z`;
  }

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

      {baseline != null && (
        <>
          <Line
            x1={CHART_PAD.left}
            y1={getY(baseline)}
            x2={totalW - CHART_PAD.right}
            y2={getY(baseline)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.2}
            strokeDasharray="5,4"
          />
          <SvgText
            x={totalW - 4}
            y={getY(baseline) + 11}
            fill="rgba(255,255,255,0.45)"
            fontSize={9}
            textAnchor="end"
            fontFamily={fontFamily.regular}
          >
            {`Baseline: ${Number(baseline).toFixed(precision)} ${unit}`}
          </SvgText>
        </>
      )}

      {areaPath ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}

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

function SignalCard({
  sig,
  latestRow,
  history,
  t,
  onInfo,
}: {
  sig: SignalConfig;
  latestRow: IllnessScore;
  history: IllnessScore[];
  t: (k: string, opts?: Record<string, string>) => string;
  onInfo: () => void;
}) {
  // Fall back to the most recent non-null value — today's record may be partial
  const sorted = [...history].sort((a, b) => b.score_date.localeCompare(a.score_date));
  const mostRecentWithVal = sorted.find(row => row[sig.valueField] != null);
  const rawVal = mostRecentWithVal?.[sig.valueField] as number | null ?? null;

  const rawBase = latestRow[sig.baselineField] as number | null;
  const rawSub = latestRow[sig.subField] as number;
  const severity = getSeverity(rawSub, sig.weight);
  const hasData = rawVal != null;
  const hasBaseline = rawBase != null;

  const displayVal = hasData ? Number(rawVal).toFixed(sig.precision) : '—';
  const delta = hasData && hasBaseline
    ? Math.abs(Number(rawVal) - Number(rawBase)).toFixed(sig.precision)
    : '0';

  return (
    <View style={styles.signalCard}>
      <View style={styles.signalTitleRow}>
        <Text style={styles.signalTitle}>{t(SIGNAL_LABEL_KEYS[sig.i18nKey])}</Text>
        <Pressable onPress={onInfo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Svg width={18} height={18} viewBox="0 0 20 20">
            <Circle cx={10} cy={10} r={9} stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} fill="none" />
            <Circle cx={10} cy={6.5} r={1.2} fill="rgba(255,255,255,0.45)" />
            <SvgText x={10} y={15.5} fontSize={8} fontWeight="700" fill="rgba(255,255,255,0.45)" textAnchor="middle">i</SvgText>
          </Svg>
        </Pressable>
      </View>

      <View style={styles.valueRow}>
        <View style={styles.valueLeft}>
          <Text style={styles.valueBig}>{displayVal}</Text>
          {hasData && (
            <Text style={styles.valueUnit}>{sig.unit.toUpperCase()}</Text>
          )}
        </View>
        <View style={styles.severityChip}>
          <Text style={[styles.severityChipText, { color: severity === 'normal' ? '#FFFFFF' : severityColor(severity) }]}>
            {t(`illness_watch.severity_${severity}`).toUpperCase()}
          </Text>
        </View>
      </View>

      <SignalChart
        history={history}
        valueField={sig.valueField}
        baselineField={sig.baselineField}
        lineColor={sig.lineColor}
        unit={sig.unit}
        precision={sig.precision}
      />

      {severity !== 'normal' && hasData && hasBaseline && (
        <Text style={[styles.warningText, { color: severityColor(severity) }]}>
          {t(`illness_watch.detail_warning_${sig.i18nKey}`, {
            value: fmtValue(rawVal, sig.precision, sig.unit) ?? '',
            baseline: fmtValue(rawBase, sig.precision, sig.unit) ?? '',
            delta,
            unit: sig.unit,
          })}
        </Text>
      )}
    </View>
  );
}

const BAR_MAX_H = 130;

function TrendBars({
  trend,
  t,
}: {
  trend: IllnessScore[];
  t: (k: string) => string;
}) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  if (trend.length === 0) return null;
  const bars = [...trend].sort((a, b) => a.score_date.localeCompare(b.score_date));
  const today = new Date().toISOString().slice(0, 10);
  const maxScore = Math.max(...bars.map(b => b.score), 1);
  const selectedRow = selectedDate ? bars.find(b => b.score_date === selectedDate) ?? null : null;

  return (
    <View>
      <View style={styles.trendContainer}>
        {bars.map((bar) => {
          const isToday = bar.score_date === today;
          const isSelected = bar.score_date === selectedDate;
          const isElevated = bar.status === 'WATCH' || bar.status === 'SICK';
          const accentColor = scoreBarColor(bar.status);
          const barH = Math.max(8, Math.round((bar.score / maxScore) * BAR_MAX_H));
          const barColor = isElevated
            ? accentColor
            : isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.45)';
          const scoreColor = isElevated ? accentColor : '#FFFFFF';
          return (
            <TouchableOpacity
              key={bar.score_date}
              style={styles.trendBarWrap}
              onPress={() => setSelectedDate(isSelected ? null : bar.score_date)}
              activeOpacity={0.7}
            >
              <Text style={[styles.trendScore, { color: scoreColor, opacity: isSelected || isToday ? 1 : 0.55 }]}>
                {bar.score}
              </Text>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: barH,
                    backgroundColor: barColor,
                    opacity: isSelected || isToday ? 1 : 0.65,
                  },
                ]}
              />
              <Text style={[styles.trendDayLabel, { opacity: isSelected || isToday ? 1 : 0.45 }]}>
                {isToday ? t('illness_watch.detail_trend_today') : shortDay(bar.score_date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedRow && (
        <View style={styles.trendDetail}>
          <Text style={styles.trendDetailDate}>{formatDate(selectedRow.score_date)}</Text>
          {SIGNALS.map(sig => {
            const val = selectedRow[sig.valueField] as number | null;
            if (val == null) return null;
            return (
              <View key={sig.i18nKey} style={styles.trendDetailRow}>
                <Text style={styles.trendDetailLabel}>{t(SIGNAL_LABEL_KEYS[sig.i18nKey])}</Text>
                <Text style={[styles.trendDetailVal, { color: sig.lineColor }]}>
                  {Number(val).toFixed(sig.precision)} {sig.unit}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function IllnessDetailScreen() {
  const { t } = useTranslation();
  const [latestRow, setLatestRow] = useState<IllnessScore | null>(null);
  const [history, setHistory] = useState<IllnessScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSignal, setActiveSignal] = useState<SignalConfig | null>(null);
  const infoSheetRef = useRef<BottomSheetModal>(null);

  const openInfo = useCallback((sig: SignalConfig) => {
    setActiveSignal(sig);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    infoSheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.65} pressBehavior="close" />
    ),
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (!userId) return;

        const { data } = await supabase
          .from('illness_scores')
          .select('*')
          .eq('user_id', userId)
          .order('score_date', { ascending: false })
          .limit(30);

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
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.tertiary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!latestRow) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <BackArrow />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyText}>{t('illness_watch.empty_sync')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = latestRow.status as IllnessStatus;
  const s = status.toLowerCase() as 'clear' | 'watch' | 'sick';
  const recs = [1, 2, 3].map(n => t(`illness_watch.detail_rec_${s}_${n}`));
  const gradColor = gradientColor(status);
  const gradId = 'illnessHeroGrad';
  const gradId2 = 'illnessHeroGrad2';
  const fadeId = 'illnessHeroFade';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Full-screen gradient background */}
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id={gradId} cx="51%" cy="-20%" rx="90%" ry="220%">
              <Stop offset="0%" stopColor={gradColor} stopOpacity={1} />
              <Stop offset="70%" stopColor={gradColor} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id={gradId2} cx="85%" cy="10%" rx="60%" ry="80%">
              <Stop offset="0%" stopColor={gradColor} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={gradColor} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="40%" stopColor={colors.background} stopOpacity={0} />
              <Stop offset="100%" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradId})`} />
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradId2})`} />
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${fadeId})`} />
        </Svg>
      </Reanimated.View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Nav row: back arrow + status chip ─────────────────────────── */}
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <BackArrow />
          </TouchableOpacity>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>{status}</Text>
          </View>
        </View>

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroScore}>{latestRow.score}</Text>
            <View style={styles.heroDateBlock}>
              <Text style={styles.heroDate}>{formatDate(latestRow.score_date)}</Text>
              {latestRow.stale && (
                <Text style={styles.staleText}>{t('illness_watch.stale_warning')}</Text>
              )}
            </View>
          </View>

          {/* Recommendations inline below */}
          <View style={styles.recsInline}>
            {recs.map((rec, i) => (
              <Text key={i} style={styles.recInlineText}>{rec}</Text>
            ))}
          </View>
        </View>

        {/* ── Streak card A — manual glow ───────────────────────────────── */}
        <Text style={styles.variantLabel}>A — manual glow</Text>
        <IllnessStreakCard history={history} latestRow={latestRow} />

        {/* ── Streak card B — react-native-animated-glow (needs rebuild) ── */}
        <Text style={styles.variantLabel}>B — animated glow (Skia)</Text>
        <IllnessStreakCardGlow history={history} latestRow={latestRow} />

        {/* ── Signal cards ──────────────────────────────────────────────── */}
        {SIGNALS.map(sig => (
          <SignalCard
            key={sig.i18nKey}
            sig={sig}
            latestRow={latestRow}
            history={history}
            t={t}
            onInfo={() => openInfo(sig)}
          />
        ))}

        {/* ── Overall score trend ───────────────────────────────────────── */}
        {history.length > 1 && (
          <>
            <Text style={styles.sectionTitle}>{t('illness_watch.detail_trend_title')}</Text>
            <View style={styles.trendSection}>
              <TrendBars trend={history} t={t} />
            </View>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {/* ── Signal info sheet ─────────────────────────────────────────── */}
      <BottomSheetModal
        ref={infoSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleComponent={null}
        maxDynamicContentSize={560}
      >
        <BottomSheetView style={styles.sheetContent}>
          {activeSignal && (
            <>
              <Text style={styles.sheetTitle}>
                {t(SIGNAL_LABEL_KEYS[activeSignal.i18nKey])}
              </Text>
              <Text style={styles.sheetBody}>
                {t(`illness_watch.detail_explain_${activeSignal.i18nKey}`)}
              </Text>
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradientBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 480,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Nav row (back arrow + chip)
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    paddingBottom: 4,
  },
  backBtn: {
    padding: 8,
  },
  statusChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  statusChipText: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.sm,
    color: '#FFFFFF',
    letterSpacing: 1,
  },

  // Hero
  hero: {
    paddingTop: 20,
    paddingBottom: 32,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginBottom: 20,
  },
  heroScore: {
    fontFamily: fontFamily.demiBold,
    fontSize: 80,
    lineHeight: 84,
    letterSpacing: -3,
    color: '#FFFFFF',
  },
  heroDateBlock: {
    flex: 1,
    paddingBottom: 8,
  },
  heroDate: {
    fontFamily: fontFamily.regular,
    fontSize: 20,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 26,
  },
  staleText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 3,
  },
  recsInline: {
    gap: 8,
  },
  recInlineText: {
    fontFamily: fontFamily.regular,
    fontSize: 17,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 24,
  },

  // Sections
  sectionTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 24,
    marginBottom: 10,
  },
  trendSection: {
    paddingBottom: 48,
  },

  // Signal cards — no chrome
  signalCard: {
    marginBottom: 28,
  },
  signalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  signalTitle: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  valueLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  valueBig: {
    fontFamily: fontFamily.demiBold,
    fontSize: 36,
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  valueUnit: {
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
  },
  severityChip: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  severityChipText: {
    fontFamily: fontFamily.demiBold,
    fontSize: 11,
    letterSpacing: 0.8,
  },
  warningText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },

  // Trend
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 180,
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
    fontSize: 11,
    color: '#FFFFFF',
    marginBottom: 3,
  },
  trendBar: {
    width: '55%',
    borderRadius: 4,
    minHeight: 8,
  },
  trendDayLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
  },
  trendDetail: {
    marginTop: 16,
    gap: 10,
  },
  trendDetailDate: {
    fontFamily: fontFamily.demiBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  trendDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendDetailLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
  },
  trendDetailVal: {
    fontFamily: fontFamily.demiBold,
    fontSize: 14,
  },

  variantLabel: {
    fontFamily: fontFamily.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.3)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 6,
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

  // Info bottom sheet
  sheetBackground: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 48,
    gap: 14,
  },
  sheetTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: 20,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  sheetBody: {
    fontFamily: fontFamily.regular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 24,
  },
});
