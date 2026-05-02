// Design rule for this screen: NO background fills on components — borders only.
// All cards, chart wrappers, and buttons use borderWidth + borderColor without backgroundColor.
// Exception: logBtn uses white background (#FFFFFF) with black text per brand spec.

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Rect,
  Path,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  peakMgForDoses,
  MAX_CAFFEINE_MG,
  SLEEP_THRESHOLD_MG,
  CAFFEINE_PRESETS,
  type CaffeineDose,
} from '../../src/utils/caffeinePk';
import { formatDecimalHour } from '../../src/utils/time';
import { spacing, fontFamily } from '../../src/theme/colors';

const COLLAPSE_END = 80;
const DAY_ENTRIES  = buildDayNavigatorLabels(30);

const SCREEN_WIDTH = Dimensions.get('window').width;

// ─── Bar chart geometry ───────────────────────────────────────────────────────
// TIME_START/END/SPAN/TOTAL_BARS are all dynamic (wake→bed) — passed as props to chart components

const BAR_SVG_W   = SCREEN_WIDTH - spacing.md * 2;
const BAR_CHART_H = 240;
const BAR_PAD_L   = 40;
const BAR_PAD_R   = 8;
const BAR_PAD_T   = 28; // extra room for drink emoji labels above bars
const BAR_PAD_B   = 4; // no time labels at bottom — phase bar acts as X axis
const BAR_INNER_W = BAR_SVG_W - BAR_PAD_L - BAR_PAD_R;
const BAR_INNER_H = BAR_CHART_H - BAR_PAD_T - BAR_PAD_B;

function phaseColor(phase: 'pre' | 'open' | 'closed'): string {
  return phase === 'pre' ? '#FFAC3F' : phase === 'open' ? '#00D7A9' : '#FD8D8F';
}

function drinkEmoji(drinkType: string): string {
  return CAFFEINE_PRESETS.find(p => p.key === drinkType)?.emoji ?? '☕';
}

type BarEntry = { id: string; drink_type: string; name: string | null; consumed_at: string };

// ─── Bar chart — PK-modeled caffeine per 30-min slot with Y-axis + drink markers
function CaffeineBarChart({
  doses,
  entries,
  win,
  clearHour,
  timeStart,
  timeEnd,
}: {
  doses: CaffeineDose[];
  entries: BarEntry[];
  win: { start: number; end: number };
  clearHour: number | null;
  timeStart: number;
  timeEnd: number;
}) {
  const timeSpan  = Math.max(timeEnd - timeStart, 1);
  const totalBars = Math.ceil((timeEnd - timeStart) * 4);
  const slotW     = BAR_INNER_W / totalBars;
  const GAP            = 2;
  const isPlaceholder  = doses.length === 0;

  // When nothing logged, show 400mg-at-window-open placeholder so bars trace the ideal curve
  const displayDoses = useMemo<CaffeineDose[]>(
    () => isPlaceholder ? [{ intakeHour: win.start, amountMg: MAX_CAFFEINE_MG }] : doses,
    [doses, isPlaceholder, win.start],
  );

  const peak   = useMemo(() => peakMgForDoses(displayDoses, timeStart, timeEnd), [displayDoses, timeStart, timeEnd]);
  const yScale = useMemo(() => Math.max(peak, MAX_CAFFEINE_MG), [peak]);

  const bars = useMemo(() => Array.from({ length: totalBars }, (_, i) => {
    const slotMid = timeStart + i * 0.25 + 0.125;
    if (slotMid > timeEnd) return null;
    const mg   = totalMgAt(slotMid, displayDoses);
    const barH = mg > 0 ? Math.max((mg / yScale) * BAR_INNER_H, 2) : 8;
    const x    = BAR_PAD_L + i * slotW + GAP / 2;
    const y    = BAR_PAD_T + BAR_INNER_H - barH;
    return { x, y, w: Math.max(slotW - GAP, 1), h: barH, dim: mg === 0 };
  }).filter(Boolean), [displayDoses, yScale, timeStart, timeEnd, slotW]);

  const placeholderBars = useMemo(() => {
    if (isPlaceholder) return bars;
    const phDoses: CaffeineDose[] = [{ intakeHour: win.start, amountMg: MAX_CAFFEINE_MG }];
    return Array.from({ length: totalBars }, (_, i) => {
      const slotMid = timeStart + i * 0.25 + 0.125;
      if (slotMid > timeEnd) return null;
      const mg   = totalMgAt(slotMid, phDoses);
      const barH = mg > 0 ? Math.max((mg / yScale) * BAR_INNER_H, 2) : 8;
      const x    = BAR_PAD_L + i * slotW + GAP / 2;
      const y    = BAR_PAD_T + BAR_INNER_H - barH;
      return { x, y, w: Math.max(slotW - GAP, 1), h: barH };
    }).filter(Boolean);
  }, [isPlaceholder, bars, win.start, timeStart, timeEnd, totalBars, slotW, yScale]);

  const line400Y = BAR_PAD_T + BAR_INNER_H - (MAX_CAFFEINE_MG / yScale) * BAR_INNER_H;
  const sleepY   = BAR_PAD_T + BAR_INNER_H - (SLEEP_THRESHOLD_MG / yScale) * BAR_INNER_H;
  const yTicks   = [200, 300];

  const now     = new Date();
  const nowHr   = now.getHours() + now.getMinutes() / 60;
  const clamped = Math.max(timeStart, Math.min(timeEnd, nowHr));
  const nowX    = BAR_PAD_L + ((clamped - timeStart) / timeSpan) * BAR_INNER_W;

  // Precompute drink marker positions
  const drinkMarkers = useMemo(() => entries.map(e => {
    const h = new Date(e.consumed_at).getHours() + new Date(e.consumed_at).getMinutes() / 60;
    if (h < timeStart || h > timeEnd) return null;
    const x      = BAR_PAD_L + ((h - timeStart) / timeSpan) * BAR_INNER_W;
    const mgHere = totalMgAt(h + 0.25, doses);
    const barTop = BAR_PAD_T + BAR_INNER_H - Math.max((mgHere / yScale) * BAR_INNER_H, 2);
    return { id: e.id, x, emoji: drinkEmoji(e.drink_type), emojiLeft: x - 10, emojiTop: Math.max(barTop - 20, 2) };
  }).filter(Boolean), [entries, doses, yScale, timeStart, timeEnd, timeSpan]);

  return (
    <View style={barChartStyles.wrapper}>
      <View>
        <Svg width={BAR_SVG_W} height={BAR_CHART_H}>
          {/* Y-axis labels at 200, 300 + "mg" at baseline */}
          {yTicks.map(mg => {
            const y = BAR_PAD_T + BAR_INNER_H - (mg / yScale) * BAR_INNER_H;
            return (
              <SvgText key={mg} x={BAR_PAD_L - 5} y={y + 4}
                fill="rgba(255,255,255,0.45)" fontSize={12}
                fontFamily={fontFamily.regular} textAnchor="end">
                {mg}
              </SvgText>
            );
          })}
          <SvgText x={BAR_PAD_L - 5} y={BAR_PAD_T + BAR_INNER_H + 4}
            fill="rgba(255,255,255,0.28)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            mg
          </SvgText>

          {/* 400 label on left Y axis */}
          <SvgText x={BAR_PAD_L - 5} y={line400Y + 4}
            fill="rgba(255,255,255,0.45)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            400
          </SvgText>

          {/* Ghost bars — ideal 400mg curve, always behind real bars */}
          {placeholderBars.map((bar, i) => bar && (
            <Rect key={`ph-${i}`} x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx={2} ry={2}
              fill="#FFFFFF" opacity={isPlaceholder ? 0.22 : 0.10} />
          ))}

          {/* Real bars — only when drinks logged */}
          {!isPlaceholder && bars.map((bar, i) => bar && (
            <Rect key={`r-${i}`} x={bar.x} y={bar.y} width={bar.w} height={bar.h} rx={2} ry={2}
              fill="#FFFFFF" opacity={bar.dim ? 0.15 : 0.85} />
          ))}

          {/* Drink intake marker lines */}
          {drinkMarkers.map(m => m && (
            <Line key={m.id}
              x1={m.x} y1={BAR_PAD_T} x2={m.x} y2={BAR_PAD_T + BAR_INNER_H}
              stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="2,3" />
          ))}

          {/* Sleep threshold dashed line at 100mg */}
          <Line x1={BAR_PAD_L} y1={sleepY} x2={BAR_SVG_W - BAR_PAD_R} y2={sleepY}
            stroke="rgba(253,141,143,0.55)" strokeWidth={1} strokeDasharray="4,4" />
          <SvgText x={BAR_SVG_W - BAR_PAD_R} y={sleepY - 4}
            fill="rgba(253,141,143,0.7)" fontSize={11} fontFamily={fontFamily.regular} textAnchor="end">
            sleep threshold
          </SvgText>
          <SvgText x={BAR_PAD_L - 5} y={sleepY + 4}
            fill="rgba(253,141,143,0.6)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            100
          </SvgText>

          {/* Daily limit dashed line at 400mg */}
          <Line x1={BAR_PAD_L} y1={line400Y} x2={BAR_SVG_W - BAR_PAD_R} y2={line400Y}
            stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="4,4" />
          <SvgText x={BAR_SVG_W - BAR_PAD_R} y={line400Y - 4}
            fill="rgba(255,255,255,0.6)" fontSize={11} fontFamily={fontFamily.regular} textAnchor="end">
            daily limit
          </SvgText>

          {/* Now line */}
          <Line x1={nowX} y1={BAR_PAD_T} x2={nowX} y2={BAR_PAD_T + BAR_INNER_H}
            stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="2,3" />

        </Svg>

        {/* Drink emoji labels — absolute overlay above each spike */}
        {drinkMarkers.map(m => m && (
          <View key={m.id} style={[barChartStyles.emojiLabel, { left: m.emojiLeft, top: m.emojiTop }]}>
            <Text style={barChartStyles.emojiText}>{m.emoji}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const barChartStyles = StyleSheet.create({
  wrapper:    { marginHorizontal: spacing.md, marginBottom: 0 }, // flush — phase bar is the X axis
  emojiLabel: { position: 'absolute', width: 20, alignItems: 'center' },
  emojiText:  { fontSize: 13 },
});

// ─── Window phase bar — pre-wake spacer + 3 colored phases + wake-time label ──
function WindowPhaseBar({
  win,
  activePhase,
  wakeHour,
  bedHour,
}: {
  win: { start: number; end: number };
  activePhase: 'pre' | 'open' | 'closed';
  wakeHour: number;
  bedHour: number;
}) {
  // Dynamic span: wake time → bed time (matches bar chart X axis exactly)
  const timeStart = wakeHour;
  const timeEnd   = bedHour;
  const timeSpan  = Math.max(timeEnd - timeStart, 1);
  const openEnd   = Math.min(win.end, timeEnd);

  const preFrac    = Math.max(0, (win.start - timeStart) / timeSpan);
  const openFrac   = Math.max(0, (openEnd   - win.start) / timeSpan);
  const closedFrac = Math.max(0, (timeEnd   - openEnd)   / timeSpan);

  // wakeHour === timeStart, so the sun label always sits at the far left of pre
  const wakeOffsetFrac = 0;

  return (
    <View style={phaseBarStyles.outer}>
      {/* Segments — full width coverage */}
      <View style={phaseBarStyles.bars}>
        {preFrac > 0 && (
          <View style={[phaseBarStyles.segment, { flex: preFrac,
            backgroundColor: activePhase === 'pre' ? '#FFAC3F' : 'rgba(255,172,63,0.35)' }]} />
        )}
        {openFrac > 0 && (
          <View style={[phaseBarStyles.segment, { flex: openFrac,
            backgroundColor: activePhase === 'open' ? '#00D7A9' : 'rgba(0,215,169,0.35)' }]} />
        )}
        {closedFrac > 0 && (
          <View style={[phaseBarStyles.segment, { flex: closedFrac,
            backgroundColor: activePhase === 'closed' ? '#FD8D8F' : 'rgba(253,141,143,0.35)' }]} />
        )}
      </View>

      {/* Labels — ☀ wake time pinned at exact wakeHour position within pre segment */}
      <View style={phaseBarStyles.labels}>
        {preFrac > 0 && (
          <View style={{ flex: preFrac, flexDirection: 'row', overflow: 'visible' }}>
            {wakeOffsetFrac > 0 && <View style={{ flex: wakeOffsetFrac }} />}
            <View style={{ flex: Math.max(1 - wakeOffsetFrac, 0.001) }}>
              <View style={phaseBarStyles.wakeTag}>
                <Ionicons name="sunny-outline" size={10} color="rgba(255,255,255,0.6)" />
                <Text style={phaseBarStyles.labelText}>{formatDecimalHour(wakeHour)}</Text>
              </View>
            </View>
          </View>
        )}
        {openFrac > 0 && (
          <View style={{ flex: openFrac }}>
            <Text style={phaseBarStyles.labelText}>{formatDecimalHour(win.start)}</Text>
          </View>
        )}
        {closedFrac > 0 && (
          <View style={{ flex: closedFrac }}>
            <Text style={phaseBarStyles.labelText}>{formatDecimalHour(openEnd)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const phaseBarStyles = StyleSheet.create({
  outer:     { marginHorizontal: spacing.md, paddingLeft: BAR_PAD_L, paddingRight: BAR_PAD_R, marginBottom: spacing.lg },
  bars:      { flexDirection: 'row', gap: 4 },
  segment:   { height: 8, borderRadius: 4 },
  labels:    { flexDirection: 'row', marginTop: 5 },
  wakeTag:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  labelText: { color: 'rgba(255,255,255,0.4)', fontFamily: fontFamily.regular, fontSize: 10 },
});

// ─── Drink suggestions based on remaining caffeine budget ────────────────────
function DrinkSuggestions({
  currentMg,
  activePhase,
}: {
  currentMg: number;
  activePhase: 'pre' | 'open' | 'closed';
}) {
  const { t } = useTranslation();
  const budget = Math.max(0, Math.round(MAX_CAFFEINE_MG - currentMg));
  const available = CAFFEINE_PRESETS.filter(p => p.key !== 'custom' && p.defaultMg <= budget);

  const emptyKey = activePhase === 'closed' ? 'suggestions_none' : 'suggestions_limit';
  if (activePhase === 'closed' || available.length === 0) {
    return (
      <View style={suggStyles.section}>
        <Text style={suggStyles.heading}>{t('adenosine.suggestions_heading')}</Text>
        <View style={suggStyles.emptyCard}>
          <Text style={suggStyles.emptyText}>{t(`adenosine.${emptyKey}`)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={suggStyles.section}>
      <Text style={suggStyles.heading}>{t('adenosine.suggestions_heading')}</Text>
      <Text style={suggStyles.budget}>{t('adenosine.suggestions_budget', { budget })}</Text>
      <View style={suggStyles.grid}>
        {available.map(drink => (
          <View key={drink.key} style={suggStyles.card}>
            <Text style={suggStyles.emoji}>{drink.emoji}</Text>
            <Text style={suggStyles.drinkName}>{t(`adenosine.preset.${drink.key}`)}</Text>
            <Text style={suggStyles.mg}>{drink.defaultMg}mg</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const suggStyles = StyleSheet.create({
  section:   { marginHorizontal: spacing.md, marginBottom: spacing.lg },
  heading:   {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  budget:    {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginBottom: 12,
  },
  grid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:      {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
    minWidth: 78,
  },
  emoji:     { fontSize: 24 },
  drinkName: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 12 },
  mg:        { color: 'rgba(255,255,255,0.4)', fontFamily: fontFamily.regular, fontSize: 11 },
  emptyCard: {
    borderWidth: 1,
    borderColor: 'rgba(253,141,143,0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: 'rgba(253,141,143,0.7)',
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
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
  info:  { flex: 1 },
  name:  { color: '#FFFFFF', fontFamily: fontFamily.regular, fontSize: 15 },
  time:  { color: 'rgba(255,255,255,0.45)', fontFamily: fontFamily.regular, fontSize: 12, marginTop: 2 },
  mg:    { color: 'rgba(255,255,255,0.7)', fontFamily: fontFamily.demiBold, fontSize: 15 },
});

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function AdenosineDetailScreen() {
  const { t } = useTranslation();
  const homeData = useHomeDataContext();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const logSheetRef = useRef<LogDrinkSheetHandle>(null);

  const { entries, doses, currentMg, totalMgToday, peakMgToday, addDrink, deleteDrink } = useCaffeineTimeline();

  const wakeTime = homeData.lastNightSleep?.wakeTime;
  const bedTime  = homeData.lastNightSleep?.bedTime;
  const validDate = (d?: Date) => d instanceof Date && !isNaN(d.getTime());
  const wakeHour = validDate(wakeTime) ? wakeTime!.getHours() + wakeTime!.getMinutes() / 60 : 7;
  // post-midnight bedtimes (e.g. 1 AM) are treated as hour 25 so the formula stays consistent
  const bedRaw   = validDate(bedTime)  ? bedTime!.getHours()  + bedTime!.getMinutes()  / 60 : 23;
  const bedHour  = bedRaw < 6 ? bedRaw + 24 : bedRaw;

  // clearHour from actual drinks only — no phantom 95mg default that clears immediately
  const clearHour = useMemo(() => clearanceHour(doses), [doses]);
  const win       = useMemo(() => recommendedWindow(wakeHour, bedHour), [wakeHour, bedHour]);

  const nowHour = new Date().getHours() + new Date().getMinutes() / 60;
  // Phase is purely time-based on the recommended window — never affected by caffeine clearance
  const activePhase: 'pre' | 'open' | 'closed' =
    nowHour < win.start ? 'pre' : nowHour <= win.end ? 'open' : 'closed';

  // 30-day aggregated mg totals for TrendBarChart
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
  }, []);

  const trendValues = useMemo(() => {
    const todayMg = Math.round(entries.reduce((s, e) => s + e.caffeine_mg, 0));
    return DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      value: d.dateKey === todayKey
        ? todayMg
        : Math.round(historicalTotals[d.dateKey] ?? 0),
    }));
  }, [entries, historicalTotals, todayKey]);

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

  const insightText = useMemo(() => {
    if (doses.length === 0) return t('adenosine.insight.no_drinks');
    const firstDose = Math.min(...doses.map(d => d.intakeHour));
    const minToPeak = Math.max(0, Math.round((firstDose + 0.75 - nowHour) * 60));
    const lastSafe  = formatDecimalHour(win.end);
    const clearLabel = clearHour !== null ? formatDecimalHour(clearHour) : '—';
    if (activePhase === 'pre')  return t('adenosine.insight.pre_window', { time: formatDecimalHour(win.start) });
    if (activePhase === 'open' && minToPeak > 0)
      return t('adenosine.insight.open_window', { min: minToPeak, lastSafe });
    if (activePhase === 'open') return t('adenosine.insight.open_peaking', { time: lastSafe });
    return t('adenosine.insight.closed_window') + ' ' + t('adenosine.insight.clearance_at', { time: clearLabel });
  }, [doses, activePhase, nowHour, win, clearHour, t]);

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
      {/* Full-screen gradient background */}
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <RadialGradient id="aGrad" cx="51%" cy="-20%" rx="90%" ry="220%">
            <Stop offset="0%"  stopColor="#0D6B33" stopOpacity={1} />
            <Stop offset="70%" stopColor="#0D6B33" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="aGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
            <Stop offset="0%"   stopColor="#1F9F50" stopOpacity={0.75} />
            <Stop offset="100%" stopColor="#1F9F50" stopOpacity={0}    />
          </RadialGradient>
          <LinearGradient id="aFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="40%" stopColor="#0A0A0F" stopOpacity={0} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#aGrad)"  />
        <Rect x="0" y="0" width="100" height="100" fill="url(#aGrad2)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#aFade)"  />
        </Svg>
      </Reanimated.View>

      {/* Gradient zone: header + trend chart */}
      <View style={styles.gradientZone}>
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
                <View style={[styles.badge, { borderColor: `${pColor}55` }]}>
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
        {/* Main bar chart — dynamic X axis from wake to bed */}
        <CaffeineBarChart
          doses={doses} entries={entries} win={win} clearHour={clearHour}
          timeStart={wakeHour} timeEnd={bedHour}
        />

        {/* Window phase indicator — same wake→bed span as bar chart */}
        <WindowPhaseBar
          win={win} activePhase={activePhase}
          wakeHour={wakeHour} bedHour={bedHour}
        />

        {/* Insight */}
        <View style={styles.insightBlock}>
          <Text style={styles.insightText}>{insightText}</Text>
        </View>

        {/* Drink suggestions for current hour */}
        <DrinkSuggestions currentMg={currentMg} activePhase={activePhase} />

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

        {/* Log drink button — white bg, black text */}
        <TouchableOpacity
          style={styles.logBtn}
          onPress={() => logSheetRef.current?.present()}
          activeOpacity={0.85}
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
  container:     { flex: 1, backgroundColor: '#0A0A0F' },
  gradientBg:    { position: 'absolute', top: 0, left: 0, right: 0, height: 480 },
  gradientZone:  {},
  scroll:        { flex: 1 },
  scrollContent: { paddingBottom: 80 },

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
    // no background fill — border only
  },
  badgeText: { fontSize: 11, fontFamily: fontFamily.demiBold, letterSpacing: 0.5 },
  unitRight: { paddingBottom: 6 },
  unitLabel: { fontFamily: fontFamily.regular, fontSize: 16 },

  insightBlock: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    // no background fill — border only
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

  // White button, black text — brand spec for this screen type
  logBtn: {
    marginHorizontal: spacing.md,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  logBtnText: {
    color: '#000000',
    fontFamily: fontFamily.demiBold,
    fontSize: 16,
  },
});
