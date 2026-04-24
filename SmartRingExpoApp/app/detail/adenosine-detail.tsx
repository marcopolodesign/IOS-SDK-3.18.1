import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  PanResponder,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  RadialGradient,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Path,
  Line,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { LogDrinkSheet, type LogDrinkSheetHandle } from '../../src/components/home/LogDrinkSheet';
import { buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { useCaffeineTimeline } from '../../src/hooks/useCaffeineTimeline';
import supabaseService from '../../src/services/SupabaseService';
import {
  totalMgAt,
  clearanceHour,
  recommendedWindow,
  buildMultiDoseCurvePath,
  withDefaultDose,
  peakMgForDoses,
  SLEEP_THRESHOLD_MG,
  CAFFEINE_PRESETS,
  type CaffeineDose,
} from '../../src/utils/caffeinePk';
import { formatDecimalHour } from '../../src/utils/time';
import { spacing, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;
const DAY_ENTRIES  = buildDayNavigatorLabels(30);

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_W = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
const CHART_H = 190;

// ─── Chart geometry (matches CaffeineWindowCard) ─────────────────────────────
const CHART_PAD_L  = 34;
const CHART_PAD_R  = 8;
const TIME_START   = 6;
const TIME_END     = 23;
const TIME_SPAN    = TIME_END - TIME_START;
const CURVE_TOP_Y  = 12;
const CURVE_BOT_Y  = 90;
const MIN_Y_SCALE  = 150; // keeps 100 mg sleep-limit line always visible

function mgToY(mg: number, yScale: number): number {
  const conc = Math.min(mg / yScale, 1);
  return CURVE_TOP_Y + (1 - conc) * (CURVE_BOT_Y - CURVE_TOP_Y);
}

function hToX(h: number): number {
  return CHART_PAD_L + ((h - TIME_START) / TIME_SPAN) * (CHART_W - CHART_PAD_L - CHART_PAD_R);
}

function phaseColor(phase: 'pre' | 'open' | 'closed'): string {
  return phase === 'pre' ? '#FFAC3F' : phase === 'open' ? '#00D7A9' : '#FD8D8F';
}

function computeActivePhase(
  doses: CaffeineDose[],
  nowHour: number,
  window: { start: number; end: number },
  clearHour: number | null,
): 'pre' | 'open' | 'closed' {
  if (doses.length === 0) return 'pre';
  const firstDoseHour = Math.min(...doses.map(d => d.intakeHour));
  if (nowHour < firstDoseHour) return 'pre';
  if (clearHour !== null && nowHour < clearHour) return 'open';
  return 'closed';
}

function drinkEmoji(drinkType: string): string {
  return CAFFEINE_PRESETS.find(p => p.key === drinkType)?.emoji ?? '☕';
}

// ─── Inline curve chart with drag-to-scrub ────────────────────────────────────
function CaffeineCurveChart({
  doses,
  wakeHour,
  bedHour,
}: {
  doses: CaffeineDose[];
  wakeHour: number;
  bedHour: number;
}) {
  const [tooltip, setTooltip] = useState<{ x: number; hour: number; mg: number } | null>(null);
  const layoutWidthRef = useRef(CHART_W);
  const innerW = layoutWidthRef.current - CHART_PAD_L - CHART_PAD_R;

  const yScale = useMemo(
    () => Math.max(Math.ceil(peakMgForDoses(doses)), MIN_Y_SCALE),
    [doses],
  );

  const curvePath = useMemo(
    () => buildMultiDoseCurvePath(doses, innerW, CHART_PAD_L, TIME_START, TIME_END, CURVE_TOP_Y, CURVE_BOT_Y, yScale),
    [doses, innerW, yScale],
  );

  const window = useMemo(() => recommendedWindow(wakeHour, bedHour), [wakeHour, bedHour]);
  const clearHour = useMemo(() => clearanceHour(doses), [doses]);

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const clampedNow = Math.max(TIME_START, Math.min(TIME_END, nowHour));
  const nowMg = totalMgAt(clampedNow, doses);

  const windowX1 = hToX(Math.max(window.start, TIME_START));
  const windowX2 = hToX(Math.min(window.end, TIME_END));

  const panResponder = useMemo(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX;
        const h = TIME_START + ((x - CHART_PAD_L) / innerW) * TIME_SPAN;
        const clamped = Math.max(TIME_START, Math.min(TIME_END, h));
        const mg = Math.round(totalMgAt(clamped, doses));
        setTooltip({ x, hour: clamped, mg });
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX;
        const h = TIME_START + ((x - CHART_PAD_L) / innerW) * TIME_SPAN;
        const clamped = Math.max(TIME_START, Math.min(TIME_END, h));
        const mg = Math.round(totalMgAt(clamped, doses));
        setTooltip({ x, hour: clamped, mg });
      },
      onPanResponderRelease: () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    }),
    [doses, innerW],
  );

  const tooltipX = tooltip
    ? Math.max(4, Math.min(tooltip.x - 44, CHART_W - 92))
    : 0;

  const timeLabels = [
    { label: '6AM',  h: 6 },
    { label: '12PM', h: 12 },
    { label: '3PM',  h: 15 },
    { label: '11PM', h: 23 },
  ];

  return (
    <View style={chartStyles.wrapper} {...panResponder.panHandlers}>
      <Svg width={CHART_W} height={CHART_H}>
        <Defs>
          {/* Recommended window band */}
          <SvgLinearGradient id="winBand" x1={0} y1={0} x2={0} y2={1}>
            <Stop offset="0%"   stopColor="#00D7A9" stopOpacity={0.15} />
            <Stop offset="100%" stopColor="#00D7A9" stopOpacity={0.04} />
          </SvgLinearGradient>
        </Defs>

        {/* Recommended window band */}
        {windowX2 > windowX1 && (
          <Rect x={windowX1} y={CURVE_TOP_Y} width={windowX2 - windowX1}
            height={CURVE_BOT_Y - CURVE_TOP_Y} fill="url(#winBand)" />
        )}

        {/* Y gridlines — dynamic labels based on yScale */}
        {[yScale, Math.round(yScale / 2), 0].map(mg => (
          <React.Fragment key={mg}>
            <Line x1={CHART_PAD_L} y1={mgToY(mg, yScale)} x2={CHART_W - CHART_PAD_R} y2={mgToY(mg, yScale)}
              stroke="rgba(255,255,255,0.07)" strokeWidth={1} strokeDasharray="2,4" />
            <SvgText x={CHART_PAD_L - 4} y={mgToY(mg, yScale) + 4} fill="rgba(255,255,255,0.35)"
              fontSize={9} fontFamily={fontFamily.regular} textAnchor="end">
              {mg}
            </SvgText>
          </React.Fragment>
        ))}
        <SvgText x={2} y={CURVE_TOP_Y + 4} fill="rgba(255,255,255,0.25)"
          fontSize={8} fontFamily={fontFamily.regular}>mg</SvgText>

        {/* Sleep threshold dashed */}
        <Line x1={CHART_PAD_L} y1={mgToY(SLEEP_THRESHOLD_MG, yScale)} x2={CHART_W - CHART_PAD_R} y2={mgToY(SLEEP_THRESHOLD_MG, yScale)}
          stroke="rgba(253,141,143,0.6)" strokeWidth={1} strokeDasharray="4,4" />
        <SvgText x={CHART_W - CHART_PAD_R} y={mgToY(SLEEP_THRESHOLD_MG, yScale) - 4}
          fill="rgba(253,141,143,0.75)" fontSize={8} fontFamily={fontFamily.regular} textAnchor="end">
          sleep limit
        </SvgText>

        {/* Drink dose markers */}
        {doses.map((d, i) => (
          <React.Fragment key={i}>
            <Line x1={hToX(d.intakeHour)} y1={CURVE_TOP_Y} x2={hToX(d.intakeHour)} y2={CURVE_BOT_Y}
              stroke="rgba(255,255,255,0.18)" strokeWidth={1} strokeDasharray="2,3" />
          </React.Fragment>
        ))}

        {/* Clearance line */}
        {clearHour !== null && clearHour <= TIME_END && (
          <Line x1={hToX(clearHour)} y1={CURVE_TOP_Y} x2={hToX(clearHour)} y2={CURVE_BOT_Y}
            stroke="rgba(253,141,143,0.4)" strokeWidth={1} strokeDasharray="3,3" />
        )}

        {/* Multi-dose curve */}
        {curvePath !== '' && (
          <Path d={curvePath} fill="none" stroke="white" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* NOW line + dot */}
        <Line x1={hToX(clampedNow)} y1={CURVE_TOP_Y} x2={hToX(clampedNow)} y2={mgToY(nowMg, yScale) - 10}
          stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="3,3" />
        <Circle cx={hToX(clampedNow)} cy={mgToY(nowMg, yScale)} r={8}   fill="rgba(255,255,255,0.2)" />
        <Circle cx={hToX(clampedNow)} cy={mgToY(nowMg, yScale)} r={4.5} fill="white" />

        {/* Time axis */}
        {timeLabels.map(({ label, h }) => (
          <SvgText key={label} x={hToX(h) - (label.length > 4 ? 11 : 0)} y={CHART_H - 4}
            fill="rgba(255,255,255,0.35)" fontSize={10} fontFamily={fontFamily.regular}>
            {label}
          </SvgText>
        ))}

        {/* Drag tooltip */}
        {tooltip && (
          <>
            <Line x1={tooltip.x} y1={CURVE_TOP_Y} x2={tooltip.x} y2={CHART_H - 20}
              stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
            <Rect x={tooltipX} y={2} width={88} height={28} rx={6}
              fill="rgba(20,20,30,0.9)" stroke="rgba(255,255,255,0.15)" strokeWidth={1} />
            <SvgText x={tooltipX + 44} y={21} fill="white" fontSize={12}
              fontFamily={fontFamily.demiBold} textAnchor="middle">
              {formatDecimalHour(tooltip.hour)} · {tooltip.mg}mg
            </SvgText>
          </>
        )}
      </Svg>
    </View>
  );
}

const chartStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    paddingVertical: spacing.sm,
  },
});

// ─── Drink list row ───────────────────────────────────────────────────────────
function DrinkRow({
  emoji,
  name,
  mg,
  time,
  onDelete,
}: {
  emoji: string;
  name: string;
  mg: number;
  time: string;
  onDelete: () => void;
}) {
  return (
    <TouchableOpacity style={drinkStyles.row} onLongPress={onDelete} activeOpacity={0.7}>
      <Text style={drinkStyles.emoji}>{emoji}</Text>
      <View style={drinkStyles.info}>
        <Text style={drinkStyles.name}>{name}</Text>
        <Text style={drinkStyles.time}>{time}</Text>
      </View>
      <Text style={drinkStyles.mg}>{mg} mg</Text>
    </TouchableOpacity>
  );
}

const drinkStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: spacing.sm,
  },
  emoji: { fontSize: 22, width: 28 },
  info: { flex: 1 },
  name: { color: '#FFFFFF', fontFamily: fontFamily.regular, fontSize: 15 },
  time: { color: 'rgba(255,255,255,0.45)', fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
  mg: { color: 'rgba(255,255,255,0.7)', fontFamily: fontFamily.demiBold, fontSize: 15 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AdenosineDetailScreen() {
  const { t } = useTranslation();
  const homeData = useHomeDataContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const logSheetRef = useRef<LogDrinkSheetHandle>(null);

  const { entries, doses, currentMg, totalMgToday, peakMgToday, isLoading, addDrink, deleteDrink } = useCaffeineTimeline();

  const wakeTime = homeData.lastNightSleep?.wakeTime;
  const wakeHour = wakeTime ? wakeTime.getHours() + wakeTime.getMinutes() / 60 : 7;
  const bedHour  = 23;

  // effectiveDoses = wake+1.5h default baseline + logged drinks.
  // Used for the chart and clearance so the curve is never empty.
  // Metrics (totalMgToday, currentMg) use logged doses only to reflect actual intake.
  const effectiveDoses = useMemo(() => withDefaultDose(doses, wakeHour), [doses, wakeHour]);
  const clearHour = useMemo(() => clearanceHour(effectiveDoses), [effectiveDoses]);

  const window = useMemo(() => recommendedWindow(wakeHour, bedHour), [wakeHour]);
  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  const activePhase = computeActivePhase(effectiveDoses, nowHour, window, clearHour);

  // 30-day aggregated mg totals for TrendBarChart
  // Historical data (past 29 days) is fetched once on mount.
  // Today's total is derived from the live `entries` state so it updates without a round-trip.
  const todayKey = DAY_ENTRIES[0]?.dateKey ?? '';
  const [historicalTotals, setHistoricalTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);
    supabaseService.getCaffeineEntriesForRange(thirtyDaysAgo.toISOString(), yesterday.toISOString())
      .then(rows => {
        const totals: Record<string, number> = {};
        for (const r of rows) {
          const key = r.consumed_at.slice(0, 10);
          totals[key] = (totals[key] ?? 0) + r.caffeine_mg;
        }
        setHistoricalTotals(totals);
      });
  }, []); // runs once — historical days don't change while the screen is open

  const trendValues = useMemo(() => {
    const todayMg = Math.round(entries.reduce((s, e) => s + e.caffeine_mg, 0));
    return DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: d.dateKey === todayKey
        ? todayMg
        : Math.round(historicalTotals[d.dateKey] ?? 0),
    }));
  }, [entries, historicalTotals, todayKey]);

  // Must be a plain string — worklets can't call regular JS functions on the UI thread
  const pColor = phaseColor(activePhase);

  // Scroll collapse animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; },
  });

  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize:   interpolate(scrollY.value, [0, COLLAPSE_END], [80, 36], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [80, 36], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [pColor, '#FFFFFF']),
  }));

  const labelAnimStyle = useAnimatedStyle(() => ({
    fontSize:   interpolate(scrollY.value, [0, COLLAPSE_END], [22, 13], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [22, 13], Extrapolation.CLAMP),
  }));

  const badgeExpandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.4], [1, 0], Extrapolation.CLAMP),
    height:  interpolate(scrollY.value, [0, COLLAPSE_END * 0.5], [22, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));

  const headlineHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSE_END], [90, 44], Extrapolation.CLAMP),
  }));

  // Insight text
  const insightText = useMemo(() => {
    if (doses.length === 0) return t('adenosine.insight.no_drinks');
    const firstDose = doses.length > 0 ? Math.min(...doses.map(d => d.intakeHour)) : null;
    const phasePeakHour = firstDose !== null ? firstDose + 0.75 : null;
    const minToPeak = phasePeakHour !== null ? Math.max(0, Math.round((phasePeakHour - nowHour) * 60)) : 0;
    const lastSafe = formatDecimalHour(window.end);
    const clearLabel = clearHour !== null ? formatDecimalHour(clearHour) : '—';
    if (activePhase === 'pre') return t('adenosine.insight.pre_window', { time: formatDecimalHour(window.start) });
    if (activePhase === 'open' && minToPeak > 0)
      return t('adenosine.insight.open_window', { min: minToPeak, lastSafe });
    if (activePhase === 'open') return t('adenosine.insight.open_peaking', { time: lastSafe });
    return t('adenosine.insight.closed_window') + ' ' + t('adenosine.insight.clearance_at', { time: clearLabel });
  }, [doses, activePhase, nowHour, window, clearHour, t]);

  const clearLabel = clearHour !== null ? formatDecimalHour(clearHour) : '—';

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      t('adenosine.delete_confirm'),
      name,
      [
        { text: t('adenosine.delete_cancel'), style: 'cancel' },
        { text: t('adenosine.delete_yes'), style: 'destructive', onPress: () => deleteDrink(id) },
      ],
    );
  }, [deleteDrink, t]);

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="aGrad" cx="51%" cy="-86%" rx="80%" ry="300%">
              <Stop offset="0%"  stopColor="#0D6B33" stopOpacity={0.85} />
              <Stop offset="55%" stopColor="#0D6B33" stopOpacity={0}    />
            </RadialGradient>
            <RadialGradient id="aGrad2" cx="85%" cy="15%" rx="45%" ry="60%">
              <Stop offset="0%"   stopColor="#1F9F50" stopOpacity={0.45} />
              <Stop offset="100%" stopColor="#1F9F50" stopOpacity={0}    />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#aGrad)"  />
          <Rect x="0" y="0" width="100" height="100" fill="url(#aGrad2)" />
        </Svg>

        <DetailPageHeader title={t('adenosine.title')} />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={trendValues}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={() => '#1F9F50'}
          maxValue={600}
          guideLines={[200, 400]}
        />
      </View>

      {/* Collapsing headline */}
      <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
        <View style={styles.headlineLeft}>
          <View style={styles.headlineRow}>
            <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
              {currentMg}
            </Reanimated.Text>
            <View style={styles.labelColumn}>
              <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                {t('adenosine.subtitle')}
              </Reanimated.Text>
              <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                <View style={[styles.badge, { backgroundColor: `${pColor}22`, borderColor: `${pColor}55` }]}>
                  <Text style={[styles.badgeText, { color: pColor }]}>
                    {t(`adenosine.phase.${activePhase}`).toUpperCase()}
                  </Text>
                </View>
              </Reanimated.View>
            </View>
          </View>
        </View>
        <View style={styles.unitRight}>
          <Text style={[styles.unitLabel, { color: pColor }]}>mg</Text>
        </View>
      </Reanimated.View>

      <Reanimated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
      >
        {/* Insight */}
        <View style={styles.insightBlock}>
          <Text style={styles.insightText}>{insightText}</Text>
        </View>

        {/* Curve chart */}
        <CaffeineCurveChart doses={effectiveDoses} wakeHour={wakeHour} bedHour={bedHour} />

        {/* Metrics */}
        <MetricsGrid metrics={[
          { label: t('adenosine.metric.total_today'), value: `${totalMgToday}`, unit: 'mg' },
          { label: t('adenosine.metric.current_mg'),  value: `${currentMg}`,    unit: 'mg' },
          { label: t('adenosine.metric.peak'),        value: `${peakMgToday}`,  unit: 'mg' },
          { label: t('adenosine.metric.clearance'),   value: clearLabel },
        ]} />

        {/* Today's drinks */}
        {entries.length > 0 && (
          <View style={styles.drinkListCard}>
            <Text style={styles.drinkListHeading}>{t('adenosine.today_heading')}</Text>
            {entries.map(e => (
              <DrinkRow
                key={e.id}
                emoji={drinkEmoji(e.drink_type)}
                name={e.name ?? e.drink_type}
                mg={Math.round(e.caffeine_mg)}
                time={formatDecimalHour(new Date(e.consumed_at).getHours() + new Date(e.consumed_at).getMinutes() / 60)}
                onDelete={() => handleDelete(e.id, e.name ?? e.drink_type)}
              />
            ))}
            <Text style={styles.drinkListHint}>Hold a drink to remove it</Text>
          </View>
        )}

        {/* Log drink button */}
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => logSheetRef.current?.present()}
          activeOpacity={0.8}
        >
          <Text style={styles.logBtnText}>
            {entries.length > 0 ? t('adenosine.log_another') : t('adenosine.log_drink')}
          </Text>
        </TouchableOpacity>
      </Reanimated.ScrollView>

      <LogDrinkSheet ref={logSheetRef} onLog={addDrink} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0A0A0F' },
  gradientZone:   { overflow: 'hidden' },
  scroll:         { flex: 1 },
  scrollContent:  { paddingBottom: 80 },

  headlineSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  headlineLeft:  { flex: 1 },
  headlineRow:   { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  headlineScore: { fontFamily: fontFamily.regular, letterSpacing: -2 },
  labelColumn:   { paddingBottom: 4, gap: 4 },
  headlineLabel: { color: 'rgba(255,255,255,0.7)', fontFamily: fontFamily.regular, letterSpacing: -0.2 },
  badgeRow:      { flexDirection: 'row' },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontFamily: fontFamily.demiBold, letterSpacing: 0.5 },
  unitRight: { paddingBottom: 6 },
  unitLabel: { fontFamily: fontFamily.regular, fontSize: 16 },

  insightBlock: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  insightText: {
    color: 'rgba(255,255,255,0.75)',
    fontFamily: fontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
  },

  drinkListCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  drinkListHeading: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 8,
  },
  drinkListHint: {
    color: 'rgba(255,255,255,0.2)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 10,
  },

  logBtn: {
    marginHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
  },
  logBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 16,
  },
});
