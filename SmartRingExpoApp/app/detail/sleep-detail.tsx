import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  PanResponder,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, RadialGradient, Pattern, Rect, Stop, Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { monotoneCubicPath } from '../../src/utils/chartMath';
import { supabase } from '../../src/services/SupabaseService';

const COLLAPSE_END = 80;
import { DetailStatRow } from '../../src/components/detail/DetailStatRow';
import { DetailPageHeader } from '../../src/components/detail/DetailPageHeader';
import { MetricsGrid } from '../../src/components/detail/MetricsGrid';
import { TrendBarChart } from '../../src/components/detail/TrendBarChart';
import { SleepHypnogram } from '../../src/components/home/SleepHypnogram';
import { useMetricHistory, buildDayNavigatorLabels } from '../../src/hooks/useMetricHistory';
import type { DaySleepData } from '../../src/hooks/useMetricHistory';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../src/theme/colors';
import { useTranslation } from 'react-i18next';

const SCREEN_WIDTH = Dimensions.get('window').width;
// chartCard has marginHorizontal md + paddingHorizontal sm each side
const CHART_W = SCREEN_WIDTH - spacing.md * 2 - spacing.sm * 2;
const CHART_H = 135;
const PAD_LEFT = 34;
const PAD_V = 14;
const TOOLTIP_W = 96;

const DAY_ENTRIES = buildDayNavigatorLabels(30);

function formatHourCompact(hour: number): string {
  if (hour === 0 || hour === 24) return '12AM';
  if (hour === 12) return '12PM';
  return hour > 12 ? `${hour - 12}PM` : `${hour}AM`;
}

function formatTimeFromMs(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(m).padStart(2, '0')} ${suffix}`;
}

function buildSleepWindowHourTicks(bedTime: Date, wakeTime: Date): { hourTicks: number[]; hourToMs: (h: number) => number } {
  const bedMs = bedTime.getTime();
  const startHour = Math.ceil(bedTime.getHours() + bedTime.getMinutes() / 60);
  const endHour   = Math.floor(wakeTime.getHours() + wakeTime.getMinutes() / 60);
  const hourTicks: number[] = [];
  for (let h = startHour; h <= endHour; h++) hourTicks.push(h % 24);
  const hourToMs = (h: number) => {
    const d = new Date(bedTime);
    d.setHours(h, 0, 0, 0);
    // Sleep can start before midnight, so the date may need to advance
    if (d.getTime() < bedMs) d.setDate(d.getDate() + 1);
    return d.getTime();
  };
  return { hourTicks, hourToMs };
}

// ─── Oura-style HR chart for sleep window ────────────────────────────────────
const HR_CHART_H = 150;
const HR_XAXIS_H = 26; // reserved at bottom for x-axis labels
const HR_PAD_LEFT = 30;
const HR_PAD_V = 10;
const PILL_W = 58;
const PILL_H = 18;

function SleepHRLine({
  samples, bedTime, wakeTime,
}: {
  samples: Array<{ timeMs: number; heartRate: number }>;
  bedTime: Date;
  wakeTime: Date;
}) {
  const [tooltip, setTooltip] = useState<{ svgX: number; heartRate: number; timeMs: number } | null>(null);
  const layoutWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const windowMs = wakeTime.getTime() - bedTime.getTime();
  const bedMs = bedTime.getTime();
  const chartBodyW = CHART_W - HR_PAD_LEFT;

  // Graph area bounds (excludes x-axis row at bottom)
  const graphTop = HR_PAD_V;
  const graphBottom = HR_CHART_H - HR_XAXIS_H;
  const graphH = graphBottom - graphTop;

  const vals = samples.map(s => s.heartRate);
  const peakHR = Math.max(...vals);
  const minHR = Math.min(...vals);

  // Round domain to nearest 10 bpm for clean y-axis labels
  const domainMin = Math.floor((minHR - 5) / 10) * 10;
  const domainMax = Math.ceil((peakHR + 5) / 10) * 10;
  const domainRange = Math.max(1, domainMax - domainMin);

  const toX = (ms: number) => HR_PAD_LEFT + ((ms - bedMs) / windowMs) * chartBodyW;
  const toY = (hr: number) => graphTop + (1 - (hr - domainMin) / domainRange) * graphH;

  // Round 10-bpm y-axis ticks
  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let v = domainMin; v <= domainMax; v += 10) ticks.push(v);
    return ticks;
  }, [domainMin, domainMax]);

  // Sharp polyline (no spline — shows minute-by-minute variability)
  const linePath = useMemo(() => {
    if (samples.length < 2) return '';
    return samples
      .map((s, i) => `${i === 0 ? 'M' : 'L'} ${toX(s.timeMs).toFixed(1)} ${toY(s.heartRate).toFixed(1)}`)
      .join(' ');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, bedMs, windowMs, domainMin, domainRange, chartBodyW]);

  // Find 30-min window with the lowest average HR → "Lowest HR Zone"
  const lowestZone = useMemo(() => {
    if (samples.length < 2) return null;
    const HALF_WIN = 15 * 60 * 1000;
    let bestAvg = Infinity;
    let bestCenter = samples[0].timeMs;
    for (const s of samples) {
      const win = samples.filter(r => Math.abs(r.timeMs - s.timeMs) <= HALF_WIN);
      const avg = win.reduce((acc, r) => acc + r.heartRate, 0) / win.length;
      if (avg < bestAvg) { bestAvg = avg; bestCenter = s.timeMs; }
    }
    const x1 = Math.max(HR_PAD_LEFT, toX(bestCenter - HALF_WIN));
    const x2 = Math.min(CHART_W, toX(bestCenter + HALF_WIN));
    return { x1, x2, centerX: (x1 + x2) / 2 };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, bedMs, windowMs, chartBodyW]);

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidthRef.current || samples.length === 0) return;
    const svgX = Math.max(HR_PAD_LEFT, Math.min(CHART_W, touchPx * (CHART_W / layoutWidthRef.current)));
    let nearest = samples[0];
    let nearestDist = Infinity;
    for (const s of samples) {
      const dist = Math.abs(toX(s.timeMs) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = s; }
    }
    setTooltip({ svgX: toX(nearest.timeMs), heartRate: nearest.heartRate, timeMs: nearest.timeMs });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:      e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease:   () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    })
  ).current;

  if (samples.length < 2 || !linePath) return null;

  const tooltipLeft = tooltip
    ? Math.max(0, Math.min(CHART_W - TOOLTIP_W, tooltip.svgX - TOOLTIP_W / 2))
    : 0;

  const { hourTicks, hourToMs } = buildSleepWindowHourTicks(bedTime, wakeTime);

  // Dashed reference line at resting HR (minimum of the night)
  const refLineY = toY(minHR);

  // X-axis label positions
  const xAxisY = HR_CHART_H - 7;
  const bedLabel   = formatTimeFromMs(bedMs).toLowerCase();
  const wakeLabel  = formatTimeFromMs(wakeTime.getTime()).toLowerCase();

  return (
    <View
      style={sleepChartStyles.wrapper}
      onLayout={e => { layoutWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {tooltip && (
        <View style={[sleepChartStyles.tooltip, { left: tooltipLeft }]}>
          <Text style={sleepChartStyles.tooltipValue}>{tooltip.heartRate} bpm</Text>
          <Text style={sleepChartStyles.tooltipTime}>{formatTimeFromMs(tooltip.timeMs)}</Text>
        </View>
      )}
      <Svg width="100%" height={HR_CHART_H} viewBox={`0 0 ${CHART_W} ${HR_CHART_H}`}>

        {/* Lowest HR Zone — vertical band */}
        {lowestZone && (
          <>
            <Rect
              x={lowestZone.x1} y={graphTop}
              width={lowestZone.x2 - lowestZone.x1} height={graphBottom - graphTop}
              fill="rgba(255,45,120,0.12)"
            />
            {/* Vertical center line */}
            <Line
              x1={lowestZone.centerX} y1={graphTop}
              x2={lowestZone.centerX} y2={graphBottom}
              stroke="rgba(255,45,120,0.5)" strokeWidth={1.5}
            />
            {/* Label */}
            <SvgText
              x={lowestZone.centerX} y={graphTop + 11}
              textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.75)"
              fontFamily={fontFamily.demiBold}
            >
              Lowest HR
            </SvgText>
            <SvgText
              x={lowestZone.centerX} y={graphTop + 22}
              textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.75)"
              fontFamily={fontFamily.demiBold}
            >
              Zone
            </SvgText>
            <Circle cx={lowestZone.centerX} cy={graphTop} r={3} fill="rgba(255,45,120,0.7)" />
          </>
        )}

        {/* Y-axis labels */}
        {yTicks.map(v => (
          <SvgText key={v} x={2} y={toY(v) + 3}
            textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily={fontFamily.regular}>
            {v}
          </SvgText>
        ))}

        {/* Dashed reference line at resting HR */}
        <Line
          x1={HR_PAD_LEFT} y1={refLineY} x2={CHART_W} y2={refLineY}
          stroke="rgba(255,255,255,0.25)" strokeWidth={1} strokeDasharray="5,4"
        />

        {/* HR polyline — hot pink sharp line */}
        <Path d={linePath} stroke="#FF2D78" strokeWidth={1.5} fill="none" strokeLinejoin="round" />

        {/* Scrub cursor */}
        {tooltip && (
          <>
            <Line
              x1={tooltip.svgX} y1={graphTop} x2={tooltip.svgX} y2={graphBottom}
              stroke="rgba(255,255,255,0.4)" strokeWidth={1}
            />
            <Circle cx={tooltip.svgX} cy={toY(tooltip.heartRate)} r={4} fill="#FF2D78" />
          </>
        )}

        {/* X-axis: bed/wake time pills at edges, intermediate hours in middle */}
        {/* Bed time pill */}
        <Rect
          x={HR_PAD_LEFT} y={HR_CHART_H - PILL_H - 2}
          width={PILL_W} height={PILL_H} rx={PILL_H / 2}
          fill="rgba(255,255,255,0.12)"
        />
        <SvgText
          x={HR_PAD_LEFT + PILL_W / 2} y={xAxisY}
          textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)" fontFamily={fontFamily.demiBold}
        >
          {bedLabel}
        </SvgText>

        {/* Wake time pill */}
        <Rect
          x={CHART_W - PILL_W} y={HR_CHART_H - PILL_H - 2}
          width={PILL_W} height={PILL_H} rx={PILL_H / 2}
          fill="rgba(255,255,255,0.12)"
        />
        <SvgText
          x={CHART_W - PILL_W / 2} y={xAxisY}
          textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.85)" fontFamily={fontFamily.demiBold}
        >
          {wakeLabel}
        </SvgText>

        {/* Intermediate hour ticks — only those that don't collide with pills */}
        {hourTicks.map(h => {
          const x = toX(hourToMs(h));
          if (x < HR_PAD_LEFT + PILL_W + 8 || x > CHART_W - PILL_W - 8) return null;
          return (
            <SvgText key={h} x={x} y={xAxisY}
              textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)" fontFamily={fontFamily.regular}>
              {formatHourCompact(h)}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const NORMAL_TEMP_LOW = 36.1;
const NORMAL_TEMP_HIGH = 37.2;

// ─── Temperature chart for sleep window ───────────────────────────────────────
function SleepTempLine({
  samples, bedTime, wakeTime,
}: {
  samples: Array<{ timeMs: number; temperature: number }>;
  bedTime: Date;
  wakeTime: Date;
}) {
  const [tooltip, setTooltip] = useState<{ svgX: number; temperature: number; timeMs: number } | null>(null);
  const layoutWidthRef = useRef(0);
  const handleTouchRef = useRef<(x: number) => void>(() => {});

  const windowMs = wakeTime.getTime() - bedTime.getTime();
  const bedMs = bedTime.getTime();
  const chartBodyW = CHART_W - PAD_LEFT;

  const vals = samples.map(s => s.temperature).filter(v => v > 0);
  const domainMin = Math.min(...vals, NORMAL_TEMP_LOW) - 0.3;
  const domainMax = Math.max(...vals, NORMAL_TEMP_HIGH) + 0.3;
  const domainRange = domainMax - domainMin;

  const toX = (ms: number) => PAD_LEFT + ((ms - bedMs) / windowMs) * chartBodyW;
  const toY = (v: number) => PAD_V + ((domainMax - v) / domainRange) * (CHART_H - PAD_V * 2);

  const yNormalHigh = toY(NORMAL_TEMP_HIGH);
  const yNormalLow  = toY(NORMAL_TEMP_LOW);

  const { linePath, linePts } = useMemo(() => {
    if (samples.length < 2) return { linePath: '', linePts: [] };
    const pts = samples.map(s => ({ x: toX(s.timeMs), y: toY(s.temperature) }));
    const path = monotoneCubicPath(pts);
    return { linePath: path, linePts: pts };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, bedMs, windowMs, domainMin, domainMax, chartBodyW]);

  handleTouchRef.current = (touchPx: number) => {
    if (!layoutWidthRef.current || samples.length === 0) return;
    const svgX = Math.max(PAD_LEFT, Math.min(CHART_W, touchPx * (CHART_W / layoutWidthRef.current)));
    let nearest = samples[0];
    let nearestDist = Infinity;
    for (const s of samples) {
      const dist = Math.abs(toX(s.timeMs) - svgX);
      if (dist < nearestDist) { nearestDist = dist; nearest = s; }
    }
    setTooltip({ svgX: toX(nearest.timeMs), temperature: nearest.temperature, timeMs: nearest.timeMs });
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder:        () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder:         () => true,
      onMoveShouldSetPanResponderCapture:  () => true,
      onPanResponderGrant:     e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderMove:      e => handleTouchRef.current(e.nativeEvent.locationX),
      onPanResponderRelease:   () => setTooltip(null),
      onPanResponderTerminate: () => setTooltip(null),
    })
  ).current;

  if (samples.length < 2 || !linePath) return null;

  const tooltipLeft = tooltip
    ? Math.max(0, Math.min(CHART_W - TOOLTIP_W, tooltip.svgX - TOOLTIP_W / 2))
    : 0;

  const { hourTicks, hourToMs } = buildSleepWindowHourTicks(bedTime, wakeTime);

  const firstX = linePts[0].x;
  const lastX  = linePts[linePts.length - 1].x;
  const baselineY = toY(domainMin);
  const areaPath = `${linePath} L ${lastX} ${baselineY} L ${firstX} ${baselineY} Z`;

  return (
    <View
      style={sleepChartStyles.wrapper}
      onLayout={e => { layoutWidthRef.current = e.nativeEvent.layout.width; }}
      {...pan.panHandlers}
    >
      {tooltip && (
        <View style={[sleepChartStyles.tooltip, { left: tooltipLeft }]}>
          <Text style={sleepChartStyles.tooltipValue}>{tooltip.temperature.toFixed(1)}°C</Text>
          <Text style={sleepChartStyles.tooltipTime}>{formatTimeFromMs(tooltip.timeMs)}</Text>
        </View>
      )}
      <Svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        <Defs>
          <LinearGradient id="sleepTempGrad" gradientUnits="userSpaceOnUse" x1="0" y1={PAD_V} x2="0" y2={baselineY}>
            <Stop offset="0%" stopColor="#FB923C" stopOpacity={0.35} />
            <Stop offset="100%" stopColor="#0A0A0F" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={PAD_LEFT} y={yNormalHigh} width={CHART_W - PAD_LEFT} height={yNormalLow - yNormalHigh} fill="rgba(74,222,128,0.08)" />
        <Line x1={PAD_LEFT} x2={CHART_W} y1={yNormalHigh} y2={yNormalHigh} stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,3" />
        <Line x1={PAD_LEFT} x2={CHART_W} y1={yNormalLow}  y2={yNormalLow}  stroke="rgba(74,222,128,0.3)" strokeWidth={1} strokeDasharray="4,3" />
        <SvgText x={PAD_LEFT + 2} y={yNormalHigh - 3} fill="rgba(74,222,128,0.4)" fontSize={8} fontFamily={fontFamily.regular}>37.2°</SvgText>
        <SvgText x={PAD_LEFT + 2} y={yNormalLow + 10} fill="rgba(74,222,128,0.4)" fontSize={8} fontFamily={fontFamily.regular}>36.1°</SvgText>
        {[0.25, 0.5, 0.75].map((frac, i) => (
          <SvgText key={i} x={2} y={PAD_V + frac * (CHART_H - PAD_V * 2) + 3}
            textAnchor="start" fontSize={9} fill="rgba(255,255,255,0.3)" fontFamily={fontFamily.regular}>
            {(domainMin + (1 - frac) * domainRange).toFixed(1)}
          </SvgText>
        ))}
        <Path d={areaPath} fill="url(#sleepTempGrad)" />
        <Path d={linePath} stroke="rgba(251,146,60,0.9)" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {tooltip && (
          <>
            <Line x1={tooltip.svgX} y1={PAD_V} x2={tooltip.svgX} y2={CHART_H - PAD_V}
              stroke="rgba(255,255,255,0.5)" strokeWidth={1} />
            <Circle cx={tooltip.svgX} cy={toY(tooltip.temperature)} r={5} fill="#FB923C" />
          </>
        )}
        {hourTicks.map(h => (
          <SvgText key={h} x={toX(hourToMs(h))} y={CHART_H - 2}
            textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.4)" fontFamily={fontFamily.regular}>
            {formatHourCompact(h)}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const sleepChartStyles = StyleSheet.create({
  wrapper: { position: 'relative' },
  tooltip: {
    position: 'absolute',
    top: 4,
    width: TOOLTIP_W,
    backgroundColor: 'rgba(20,20,30,0.92)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipValue: { color: '#FFFFFF', fontSize: 13, fontFamily: fontFamily.demiBold },
  tooltipTime: { color: 'rgba(255,255,255,0.5)', fontSize: 10, fontFamily: fontFamily.regular },
});

function sleepScoreColor(score: number): string {
  if (score >= 80) return '#4ADE80';
  if (score >= 60) return '#FFD700';
  return '#FF6B6B';
}

function sleepInsight(data: DaySleepData | undefined): string {
  if (!data) return 'Sync your ring to see sleep insights.';
  const deepPct = data.timeAsleepMinutes > 0
    ? Math.round((data.deepMin / data.timeAsleepMinutes) * 100)
    : 0;
  if (data.score >= 80) return `Excellent sleep! Deep sleep was ${deepPct}% of your night — great for physical recovery.`;
  if (data.score >= 60) return `Moderate sleep quality. Increasing deep sleep (currently ${deepPct}%) can improve recovery.`;
  return `Sleep quality was low. Aim for a consistent bedtime and limit screens before bed.`;
}

function formatTime(date: Date | null): string {
  if (!date) return '--';
  const h = date.getHours();
  const m = date.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

function buildTodaySleepFromContext(
  sleep: ReturnType<typeof useHomeDataContext>['lastNightSleep'],
  hrChartData: Array<{ timeMinutes: number; heartRate: number }>,
): DaySleepData | null {
  if (!sleep || sleep.score === 0) return null;
  const d0 = new Date();
  const today = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
  let deepMin = 0, lightMin = 0, remMin = 0, awakeMin = 0;
  for (const seg of sleep.segments ?? []) {
    const durMin = Math.round((seg.endTime.getTime() - seg.startTime.getTime()) / 60000);
    if (seg.stage === 'deep') deepMin += durMin;
    else if (seg.stage === 'core') lightMin += durMin;
    else if (seg.stage === 'rem') remMin += durMin;
    else awakeMin += durMin;
  }
  const bedTime = sleep.bedTime ?? null;
  const wakeTime = sleep.wakeTime ?? null;

  // Convert day-relative hrChartData to absolute timeMs and filter to sleep window
  let hrSamples: DaySleepData['hrSamples'] = [];
  if (bedTime && wakeTime && hrChartData.length > 0) {
    const todayMidnight = new Date(d0);
    todayMidnight.setHours(0, 0, 0, 0);
    const startMs = bedTime.getTime();
    const endMs   = wakeTime.getTime();
    hrSamples = hrChartData
      .map(p => {
        const base = new Date(todayMidnight);
        base.setMinutes(p.timeMinutes);
        // Sleep may start before midnight — shift back a day if needed
        const timeMs = base.getTime() > endMs ? base.getTime() - 86400000 : base.getTime();
        return { timeMs, heartRate: p.heartRate };
      })
      .filter(s => s.timeMs >= startMs && s.timeMs <= endMs && s.heartRate > 0);
  }

  return {
    date: today,
    score: sleep.score,
    timeAsleep: sleep.timeAsleep,
    timeAsleepMinutes: sleep.timeAsleepMinutes,
    bedTime,
    wakeTime,
    deepMin,
    lightMin,
    remMin,
    awakeMin,
    segments: (sleep.segments ?? []) as any,
    restingHR: sleep.restingHR ?? 0,
    respiratoryRate: 0,
    hrSamples,
    tempSamples: [],
  };
}

const STAGE_BAR_H = 40;
const STAGE_BAR_RADIUS = 10;
// statsContainer has marginHorizontal: spacing.md only — no padding
const STAGE_BAR_W = SCREEN_WIDTH - spacing.md * 2;
const STAGE_LABEL_MIN_W = 82; // minimum fill width so label is always readable

function SleepStageBar({
  label,
  minutes,
  totalMinutes,
  color,
  recMinPct,
  recMaxPct,
}: {
  label: string;
  minutes: number;
  totalMinutes: number;
  color: string;
  recMinPct?: number; // 0–100, omit to hide zone
  recMaxPct?: number; // 0–100
}) {
  const pct = totalMinutes > 0 ? minutes / totalMinutes : 0;
  const pctRounded = Math.round(pct * 100);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const timeStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

  const fillW = Math.max(STAGE_LABEL_MIN_W, pct * STAGE_BAR_W);
  const showRec = recMinPct != null && recMaxPct != null;
  const recX  = showRec ? (recMinPct! / 100) * STAGE_BAR_W : 0;
  const recW  = showRec ? ((recMaxPct! - recMinPct!) / 100) * STAGE_BAR_W : 0;
  const patId = `hp_${label.replace(/\s/g, '')}`;
  const recLabelX = recX + recW / 2;
  const statsStr = `${pctRounded}% · ${timeStr}`;
  return (
    <View style={stageBarStyles.row}>
      <Svg width={STAGE_BAR_W} height={STAGE_BAR_H}>
        <Defs>
          <Pattern id={patId} patternUnits="userSpaceOnUse" width="8" height="8">
            <Line x1="0" y1="8" x2="8" y2="0" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
            <Line x1="-2" y1="2" x2="2" y2="-2" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
            <Line x1="6" y1="10" x2="10" y2="6" stroke="rgba(255,255,255,0.28)" strokeWidth="2" />
          </Pattern>
        </Defs>

        {/* Dark background track */}
        <Rect x={0} y={0} width={STAGE_BAR_W} height={STAGE_BAR_H}
          rx={STAGE_BAR_RADIUS} ry={STAGE_BAR_RADIUS}
          fill="rgba(255,255,255,0.07)" />

        {/* Colored fill */}
        {fillW > 0 && (
          <Rect x={0} y={0} width={fillW} height={STAGE_BAR_H}
            rx={STAGE_BAR_RADIUS} ry={STAGE_BAR_RADIUS}
            fill={color} />
        )}

        {/* Recommended range — no rounded corners, min/max labels flanking the rect */}
        {showRec && (
          <>
            <Rect x={recX} y={0} width={recW} height={STAGE_BAR_H}
              fill={`url(#${patId})`}
              stroke="rgba(255,255,255,0.6)"
              strokeWidth={1.5} />
            <SvgText
              x={recX - 5} y={STAGE_BAR_H / 2 + 5}
              textAnchor="end"
              fill="rgba(255,255,255,0.6)"
              fontSize={10}
              fontWeight="600"
            >{recMinPct}%</SvgText>
            <SvgText
              x={recX + recW + 5} y={STAGE_BAR_H / 2 + 5}
              textAnchor="start"
              fill="rgba(255,255,255,0.6)"
              fontSize={10}
              fontWeight="600"
            >{recMaxPct}%</SvgText>
          </>
        )}

        {/* Stage label — left inside */}
        <SvgText
          x={13} y={STAGE_BAR_H / 2 + 5}
          fill="rgba(255,255,255,0.95)"
          fontSize={14}
          fontWeight="700"
        >{label}</SvgText>

      </Svg>
      <View style={stageBarStyles.statOverlay}>
        <Text style={stageBarStyles.stat} numberOfLines={1}>{statsStr}</Text>
      </View>
    </View>
  );
}

const stageBarStyles = StyleSheet.create({
  row: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  statOverlay: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  stat: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontFamily: fontFamily.demiBold,
    flexShrink: 0,
  },
});

function AIIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 25 25" fill="none">
      <Path d="M20.8333 19.1667C20.3913 19.1667 19.9674 19.3423 19.6548 19.6548C19.3423 19.9674 19.1667 20.3913 19.1667 20.8334C19.1667 20.8967 19.1783 20.9575 19.1858 21.0192C17.2822 22.5229 14.9259 23.3384 12.5 23.3334C8.94833 23.3334 5.83333 20.0234 5.83333 16.25C5.83333 12.3442 9.01083 9.16669 12.9167 9.16669H13.3333V7.50002H12.9167C8.09167 7.50002 4.16667 11.425 4.16667 16.25C4.16667 17.82 4.60833 19.325 5.36417 20.6309C3.10333 18.6425 1.66667 15.7384 1.66667 12.5C1.66667 10.7375 2.07667 9.05586 2.885 7.50336L1.40667 6.73419C0.483232 8.51592 0.000837275 10.4932 0 12.5C0 19.3925 5.6075 25 12.5 25C15.3117 25 17.985 24.0667 20.1708 22.3617C20.398 22.4605 20.6444 22.5075 20.8921 22.4991C21.1397 22.4907 21.3823 22.4272 21.6023 22.3132C21.8223 22.1992 22.0142 22.0376 22.1638 21.8402C22.3135 21.6427 22.4173 21.4144 22.4676 21.1718C22.5179 20.9291 22.5135 20.6784 22.4547 20.4377C22.3958 20.197 22.2841 19.9724 22.1275 19.7804C21.971 19.5883 21.7736 19.4336 21.5497 19.3274C21.3258 19.2213 21.0811 19.1663 20.8333 19.1667Z" fill="rgba(255,255,255,0.9)" />
      <Path d="M10 15.8333V17.5H8.33337V15.8333H10ZM16.6667 7.5V9.16667H15V7.5H16.6667Z" fill="rgba(255,255,255,0.9)" />
      <Path d="M12.5 0C9.68833 0 7.015 0.933333 4.82917 2.63833C4.49998 2.49573 4.13356 2.46315 3.78438 2.54544C3.4352 2.62773 3.12189 2.82049 2.89101 3.09507C2.66013 3.36965 2.52402 3.7114 2.50289 4.06953C2.48177 4.42766 2.57676 4.78304 2.77376 5.08286C2.97075 5.38268 3.25923 5.61094 3.59631 5.73371C3.9334 5.85648 4.30111 5.8672 4.64478 5.76429C4.98845 5.66138 5.28974 5.45032 5.50387 5.16249C5.718 4.87466 5.83355 4.52541 5.83333 4.16667C5.83333 4.10333 5.82167 4.0425 5.81417 3.98083C7.71783 2.47716 10.0741 1.66158 12.5 1.66667C16.0517 1.66667 19.1667 4.97667 19.1667 8.75C19.1667 12.6558 15.9892 15.8333 12.0833 15.8333H11.6667V17.5H12.0833C16.9083 17.5 20.8333 13.575 20.8333 8.75C20.8333 7.17917 20.39 5.67333 19.6333 4.36667C21.8958 6.355 23.3333 9.26 23.3333 12.5C23.3333 14.2625 22.9233 15.9442 22.115 17.4967L23.5933 18.2658C24.5168 16.4841 24.9992 14.5068 25 12.5C25 5.6075 19.3925 0 12.5 0Z" fill="rgba(255,255,255,0.9)" />
    </Svg>
  );
}

const SLEEP_INSIGHT_CACHE_PREFIX = 'sleep-insight-v1-';

async function fetchSleepInsight(dayData: DaySleepData): Promise<string> {
  const cacheKey = `${SLEEP_INSIGHT_CACHE_PREFIX}${dayData.date}`;
  const cached = await AsyncStorage.getItem(cacheKey);
  if (cached) return cached;

  const totalMin = dayData.awakeMin + dayData.remMin + dayData.lightMin + dayData.deepMin;
  const pct = (m: number) => totalMin > 0 ? Math.round((m / totalMin) * 100) : 0;
  const fmt = (m: number) => { const h = Math.floor(m / 60); const min = m % 60; return h > 0 ? `${h}h ${min}m` : `${min}m`; };

  const prompt = `Analyze this sleep data and give 2–3 specific, actionable recommendations to improve sleep quality. Be direct and personal, no bullet points, max 3 sentences.

Sleep data (${dayData.date}):
- Total sleep: ${dayData.timeAsleep} (score: ${dayData.score}/100)
- Deep sleep: ${fmt(dayData.deepMin)} (${pct(dayData.deepMin)}% — recommended 13–23%)
- REM sleep: ${fmt(dayData.remMin)} (${pct(dayData.remMin)}% — recommended 20–25%)
- Light sleep: ${fmt(dayData.lightMin)} (${pct(dayData.lightMin)}% — recommended 45–55%)
- Awake: ${fmt(dayData.awakeMin)} (${pct(dayData.awakeMin)}%)
${dayData.restingHR > 0 ? `- Resting HR during sleep: ${dayData.restingHR} bpm` : ''}`;

  const { data, error } = await supabase.functions.invoke('coach-chat', {
    body: { message: prompt, history: [] },
  });
  if (error || !data?.message) throw error ?? new Error('No response');

  const insight: string = data.message;
  await AsyncStorage.setItem(cacheKey, insight);
  return insight;
}

export default function SleepDetailScreen() {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [todayTempSamples, setTodayTempSamples] = useState<DaySleepData['tempSamples']>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiInsightLoading, setAiInsightLoading] = useState(false);

  // Progressive: show last 7 days immediately, extend to 30 silently in background
  const { data, isLoading } = useMetricHistory<DaySleepData>('sleep', { initialDays: 7, fullDays: 30 });
  const homeData = useHomeDataContext();

  const selectedDateKey = DAY_ENTRIES[selectedIndex]?.dateKey;
  // For today, always prefer live ring data — it's fresher than a cached Supabase sync,
  // keeping bedTime/wakeTime in sync with the overview card.
  const todayLive = selectedIndex === 0 && homeData.lastNightSleep.score > 0
    ? buildTodaySleepFromContext(homeData.lastNightSleep, homeData.hrChartData)
    : null;
  const dayData = todayLive ?? (selectedDateKey ? data.get(selectedDateKey) : undefined);

  // Fetch today's temperature samples directly when showing live overlay (not in Supabase batch)
  useEffect(() => {
    if (selectedIndex !== 0 || !todayLive?.bedTime || !todayLive?.wakeTime) return;
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: rows } = await (supabase
        .from('temperature_readings')
        .select('temperature_c, recorded_at')
        .eq('user_id', user.id)
        .gte('recorded_at', todayLive.bedTime!.toISOString())
        .lte('recorded_at', todayLive.wakeTime!.toISOString())
        .order('recorded_at', { ascending: true }) as any);
      if (!cancelled && rows && rows.length > 0) {
        setTodayTempSamples(rows.map((r: any) => ({
          timeMs: new Date(r.recorded_at).getTime(),
          temperature: r.temperature_c,
        })));
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex, todayLive?.bedTime?.getTime(), todayLive?.wakeTime?.getTime()]);

  // AI sleep insight — fetched once per day, cached in AsyncStorage
  useEffect(() => {
    if (!dayData) return;
    let cancelled = false;
    setAiInsight(null);
    setAiInsightLoading(true);
    fetchSleepInsight(dayData)
      .then(text => { if (!cancelled) setAiInsight(text); })
      .catch(() => { if (!cancelled) setAiInsight(null); })
      .finally(() => { if (!cancelled) setAiInsightLoading(false); });
    return () => { cancelled = true; };
  }, [dayData?.date]);

  const allScores = useMemo(() =>
    DAY_ENTRIES.map(d => ({
      dateKey: d.dateKey,
      score: (d.dateKey === DAY_ENTRIES[0]?.dateKey && todayLive)
        ? todayLive.score
        : (data.get(d.dateKey)?.score ?? 0),
    })),
    [data, todayLive]
  );

  // Debug logging
  console.log('[SleepDetail] selectedIndex=', selectedIndex, 'selectedDateKey=', selectedDateKey);
  console.log('[SleepDetail] data map keys=', Array.from(data.keys()));
  console.log('[SleepDetail] isLoading=', isLoading, 'dayData=', dayData ? `score=${dayData.score} total=${dayData.timeAsleepMinutes}min` : null);
  if (selectedIndex !== 0) {
    console.log('[SleepDetail] RAW data.get(selectedDateKey)=', data.get(selectedDateKey));
  }

  const efficiency = dayData && dayData.timeAsleepMinutes > 0
    ? Math.round(((dayData.deepMin + dayData.lightMin + dayData.remMin) / dayData.timeAsleepMinutes) * 100)
    : null;

  const activeTempSamples = selectedIndex === 0
    ? (todayTempSamples.length > 0 ? todayTempSamples : (dayData?.tempSamples ?? []))
    : (dayData?.tempSamples ?? []);

  const tempAvg = activeTempSamples.length > 0
    ? Math.round(activeTempSamples.reduce((acc, s) => acc + s.temperature, 0) / activeTempSamples.length * 10) / 10
    : null;
  const tempAvgLabel = tempAvg !== null ? t('sleep.chart_temp_subtitle', { value: tempAvg }) : '';

  const scoreColor = sleepScoreColor(dayData?.score ?? 0);
  const qualityLabel = !dayData ? '' : dayData.score >= 80 ? 'Excellent' : dayData.score >= 60 ? 'Fair' : 'Poor';

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({ onScroll: (e) => { scrollY.value = e.contentOffset.y; } });
  const numberAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [88, 40], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [88, 40], Extrapolation.CLAMP),
    color: interpolateColor(scrollY.value, [0, COLLAPSE_END], [scoreColor, '#FFFFFF']),
  }));
  const labelAnimStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(scrollY.value, [0, COLLAPSE_END], [24, 14], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, COLLAPSE_END], [24, 14], Extrapolation.CLAMP),
  }));
  const badgeExpandedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END * 0.4], [1, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, COLLAPSE_END * 0.5], [22, 0], Extrapolation.CLAMP),
    overflow: 'hidden',
  }));
  const chipSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.value, [0, COLLAPSE_END], [30, 0], Extrapolation.CLAMP) }],
    opacity: interpolate(scrollY.value, [0, COLLAPSE_END], [0, 1], Extrapolation.CLAMP),
  }));
  const headlineHeightStyle = useAnimatedStyle(() => ({
    height: interpolate(scrollY.value, [0, COLLAPSE_END], [100, 44], Extrapolation.CLAMP),
  }));

  return (
    <View style={styles.container}>
      {/* Gradient zone: header + trend chart — starts from the very top of the screen */}
      <View style={styles.gradientZone}>
        {/* Purple radial gradient backdrop */}
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient
              id="sleepGrad"
              cx="51%"
              cy="-86%"
              rx="80%"
              ry="300%"
            >
              <Stop offset="0%" stopColor="#7100C2" stopOpacity={0.85} />
              <Stop offset="55%" stopColor="#7100C2" stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="sleepGrad2" cx="15%" cy="20%" rx="50%" ry="65%">
              <Stop offset="0%" stopColor="#3B0764" stopOpacity={0.6} />
              <Stop offset="100%" stopColor="#3B0764" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#sleepGrad)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#sleepGrad2)" />
        </Svg>

        <DetailPageHeader title="Sleep" marginBottom={spacing.md} />

        <TrendBarChart
          dayEntries={DAY_ENTRIES}
          values={allScores.map(s => ({ dateKey: s.dateKey, value: s.score }))}
          selectedIndex={selectedIndex}
          onSelectDay={setSelectedIndex}
          colorFn={sleepScoreColor}
          maxValue={100}
          guideLines={[25, 50, 75]}
        />
      </View>

      {!isLoading && dayData && (
        <Reanimated.View style={[styles.headlineSection, headlineHeightStyle]}>
          <View style={styles.headlineLeft}>
            <View style={styles.headlineRow}>
              <Reanimated.Text style={[styles.headlineScore, numberAnimStyle]}>
                {dayData.score}
              </Reanimated.Text>
              <View style={styles.labelColumn}>
                <Reanimated.Text style={[styles.headlineLabel, labelAnimStyle]}>
                  Sleep Score
                </Reanimated.Text>
                <Reanimated.View style={[styles.badgeRow, badgeExpandedStyle]}>
                  <View style={[styles.badge, { backgroundColor: `${scoreColor}22`, borderColor: `${scoreColor}55` }]}>
                    <Text style={[styles.badgeText, { color: scoreColor }]}>{qualityLabel}</Text>
                  </View>
                </Reanimated.View>
              </View>
            </View>
          </View>
          <View style={styles.chipRight}>
            <Reanimated.View style={[styles.chip, chipSlideStyle, { backgroundColor: `${scoreColor}22`, borderColor: `${scoreColor}55` }]}>
              <Text style={[styles.chipText, { color: scoreColor }]}>{qualityLabel}</Text>
            </Reanimated.View>
          </View>
        </Reanimated.View>
      )}

      <Reanimated.ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="rgba(255,255,255,0.6)" />
            <Text style={styles.loadingText}>Loading history…</Text>
          </View>
        ) : !dayData ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No sleep data for this day</Text>
            <Text style={styles.emptySubtext}>Sync your ring to record sleep automatically</Text>
          </View>
        ) : (
          <>
            {/* Insight */}
            <View style={styles.insightBlock}>
              <Text style={styles.insightText}>{sleepInsight(dayData)}</Text>
            </View>

            {/* Hypnogram (unified with naps for today) */}
            {dayData.segments.length > 0 && dayData.bedTime && dayData.wakeTime && (() => {
              // For today, use pre-built unified sessions from data layer
              const allSessions = selectedIndex === 0 ? homeData.unifiedSleepSessions : [];
              const hasNaps = allSessions.length > 1;
              return (
                <View style={styles.hypnogramWrapper}>
                  <SleepHypnogram
                    segments={dayData.segments as any}
                    bedTime={dayData.bedTime}
                    wakeTime={dayData.wakeTime}
                    sessions={hasNaps ? allSessions : undefined}
                  />
                </View>
              );
            })()}

            {/* Sleep stages */}
            {(() => {
              const totalStageMin = dayData.awakeMin + dayData.remMin + dayData.lightMin + dayData.deepMin;
              return (
                <View style={styles.statsContainer}>
                  <DetailStatRow title="Total Sleep" value={dayData.timeAsleep} />
                  <SleepStageBar label="Awake"  minutes={dayData.awakeMin}  totalMinutes={totalStageMin} color="#C26060" />
                  <SleepStageBar label="REM"    minutes={dayData.remMin}    totalMinutes={totalStageMin} color="#D45050" recMinPct={20} recMaxPct={25} />
                  <SleepStageBar label="Light"  minutes={dayData.lightMin}  totalMinutes={totalStageMin} color="#D96A6A" recMinPct={45} recMaxPct={55} />
                  <SleepStageBar label="Deep"   minutes={dayData.deepMin}   totalMinutes={totalStageMin} color="#B92929" recMinPct={13} recMaxPct={23} />

                  {/* AI sleep insight */}
                  {(aiInsightLoading || aiInsight) && (
                    <View style={styles.aiInsightRow}>
                      <AIIcon size={18} />
                      {aiInsightLoading && !aiInsight
                        ? <ActivityIndicator size="small" color="rgba(255,255,255,0.5)" style={{ marginLeft: 8 }} />
                        : <Text style={styles.aiInsightText}>{aiInsight}</Text>
                      }
                    </View>
                  )}
                </View>
              );
            })()}

            {/* Metrics grid */}
            <MetricsGrid metrics={[
              { label: 'Sleep Efficiency', value: efficiency !== null ? `${efficiency}%` : '--' },
              { label: 'Bed Time', value: formatTime(dayData.bedTime) },
              { label: 'Wake Time', value: formatTime(dayData.wakeTime) },
              { label: 'Resting HR', value: dayData.restingHR > 0 ? `${dayData.restingHR}` : '--', unit: dayData.restingHR > 0 ? 'bpm' : undefined },
            ]} />

            {/* Resting HR chart */}
            {(dayData.hrSamples?.length ?? 0) > 1 && dayData.bedTime && dayData.wakeTime && (
              <View style={styles.chartSection}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>{t('sleep.chart_hr_title')}</Text>
                  {dayData.restingHR > 0 && (
                    <Text style={styles.chartSubtitle}>{t('sleep.chart_hr_subtitle', { value: dayData.restingHR })}</Text>
                  )}
                </View>
                <SleepHRLine samples={dayData.hrSamples} bedTime={dayData.bedTime} wakeTime={dayData.wakeTime} />
              </View>
            )}

            {/* Skin temperature chart */}
            {activeTempSamples.length > 1 && dayData.bedTime && dayData.wakeTime && (
              <View style={styles.chartSection}>
                <View style={styles.chartHeader}>
                  <Text style={styles.chartTitle}>{t('sleep.chart_temp_title')}</Text>
                  {tempAvgLabel ? <Text style={styles.chartSubtitle}>{tempAvgLabel}</Text> : null}
                </View>
                <SleepTempLine samples={activeTempSamples} bedTime={dayData.bedTime} wakeTime={dayData.wakeTime} />
              </View>
            )}

            {/* Nap Stats (today only) */}
            {selectedIndex === 0 && homeData.todayNaps.length > 0 && (
              <View style={styles.statsContainer}>
                <DetailStatRow title="Naps" value={`${homeData.todayNaps.length}`} />
                <DetailStatRow title="Total Nap Time" value={`${homeData.totalNapMinutesToday} min`} />
                {homeData.todayNaps.map((nap, i) => (
                  <DetailStatRow
                    key={nap.id}
                    title={`Nap ${homeData.todayNaps.length > 1 ? i + 1 : ''}`}
                    value={`${formatTime(new Date(nap.startTime))} – ${formatTime(new Date(nap.endTime))}`}
                  />
                ))}
              </View>
            )}

          </>
        )}
      </Reanimated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0F' },
  gradientZone: {
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  loadingContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.md },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, gap: spacing.sm },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: fontSize.md, fontFamily: fontFamily.demiBold },
  emptySubtext: { color: 'rgba(255,255,255,0.4)', fontSize: fontSize.sm, fontFamily: fontFamily.regular, textAlign: 'center', paddingHorizontal: spacing.xl },
  headlineSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    overflow: 'hidden',
  },
  headlineLeft: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  labelColumn: { flexDirection: 'column', alignItems: 'flex-start' },
  headlineScore: { fontSize: 88, fontFamily: fontFamily.regular },
  headlineLabel: { color: '#FFFFFF', fontSize: 24, fontFamily: fontFamily.demiBold },
  badgeRow: { flexDirection: 'row', alignSelf: 'flex-start', marginTop: 4 },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeText: { fontSize: 12, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  chipRight: { overflow: 'hidden' },
  chip: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, alignSelf: 'flex-start' },
  chipText: { fontSize: 10, fontFamily: fontFamily.demiBold, textTransform: 'uppercase' },
  hypnogramWrapper: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: 8,
    overflow: 'hidden',
  },
  statsContainer: {
    marginHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  insightBlock: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  insightText: { color: 'rgba(255,255,255,0.75)', fontSize: 16, fontFamily: fontFamily.regular, lineHeight: 24 },
  aiInsightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  aiInsightText: {
    flex: 1,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontFamily: fontFamily.regular,
    lineHeight: 19,
  },
  chartSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.xs,
  },
  chartTitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
  },
  chartSubtitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
});
