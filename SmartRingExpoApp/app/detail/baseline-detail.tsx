import React, { useState, useRef, useCallback, useMemo } from 'react';
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
import { colors, fontFamily, fontSize } from '../../src/theme/colors';
import { BackArrow } from '../../src/components/detail/BackArrow';
import { useBaselineMode } from '../../src/context/BaselineModeContext';
import { useHomeDataContext } from '../../src/context/HomeDataContext';
import {
  useMetricHistory,
  buildDayNavigatorLabels,
  type DaySleepData,
  type DayHRData,
  type DayHRVData,
  type DaySpO2Data,
  type DayTemperatureData,
  type DayActivityData,
} from '../../src/hooks/useMetricHistory';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_H = 120;
const CHART_PAD = { top: 8, right: 0, bottom: 18, left: 0 };
const DAY_ENTRIES = buildDayNavigatorLabels(7);
const GRAD_COLOR = '#0D1B40';

const TODAY = new Date().toISOString().slice(0, 10);

const METRIC_LINE_COLORS = {
  sleep: '#6B8EFF',
  heartRate: '#FF6B6B',
  hrv: '#C4FF6B',
  temperature: '#6BFFF5',
  spo2: '#B16BFF',
  activity: '#FFB84D',
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function avg(nums: number[]): number {
  const valid = nums.filter(n => n > 0);
  if (valid.length === 0) return 0;
  return Math.round(valid.reduce((a, b) => a + b, 0) / valid.length);
}

function shortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 3);
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Signal line chart ─────────────────────────────────────────────────────────

function SignalChart({
  values,
  dayKeys,
  avgValue,
  lineColor,
  unit,
  precision,
}: {
  values: number[];
  dayKeys: string[];
  avgValue: number;
  lineColor: string;
  unit: string;
  precision: number;
}) {
  const points: Array<{ idx: number; val: number; date: string }> = [];
  dayKeys.forEach((date, i) => {
    const v = values[i];
    if (v > 0) points.push({ idx: i, val: v, date });
  });

  if (points.length < 2) return null;

  const allVals = points.map(p => p.val);
  if (avgValue > 0) allVals.push(avgValue);
  const minV = Math.min(...allVals);
  const maxV = Math.max(...allVals);
  const rangePad = (maxV - minV) * 0.15 || 1;
  const yMin = minV - rangePad;
  const yMax = maxV + rangePad;

  const totalW = SCREEN_WIDTH - 40;
  const chartW = totalW - CHART_PAD.left - CHART_PAD.right;
  const chartH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;
  const n = dayKeys.length;

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
  for (let i = 0; i < xLabelCount; i++) {
    const idx = Math.round((i / (xLabelCount - 1)) * (n - 1));
    xLabels.push({ idx, label: dayKeys[idx] === TODAY ? 'Today' : shortDate(dayKeys[idx]) });
  }

  const gradId = `bgrad_${lineColor.replace('#', '')}`;

  return (
    <Svg width={totalW} height={CHART_H}>
      <Defs>
        <LinearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <Stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {avgValue > 0 && (
        <>
          <Line
            x1={CHART_PAD.left}
            y1={getY(avgValue)}
            x2={totalW - CHART_PAD.right}
            y2={getY(avgValue)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={1.2}
            strokeDasharray="5,4"
          />
          <SvgText
            x={totalW - 4}
            y={getY(avgValue) + 11}
            fill="rgba(255,255,255,0.45)"
            fontSize={9}
            textAnchor="end"
            fontFamily={fontFamily.regular}
          >
            {`7-day avg: ${Number(avgValue).toFixed(precision)} ${unit}`}
          </SvgText>
        </>
      )}

      {areaPath ? <Path d={areaPath} fill={`url(#${gradId})`} /> : null}

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

// ─── Signal card ──────────────────────────────────────────────────────────────

function MetricSignalCard({
  label,
  baselineValue,
  todayValue,
  unit,
  precision,
  lineColor,
  isReady,
  current,
  required,
  trendValues,
  dayKeys,
  onInfo,
  t,
}: {
  label: string;
  baselineValue: string;
  todayValue: string;
  unit: string;
  precision: number;
  lineColor: string;
  isReady: boolean;
  current: number;
  required: number;
  trendValues: number[];
  dayKeys: string[];
  onInfo: () => void;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const hasBaseline = baselineValue !== '--';
  const hasToday = todayValue !== '--';
  const remaining = Math.max(0, required - current);

  return (
    <View style={styles.signalCard}>
      <View style={styles.signalTitleRow}>
        <Text style={styles.signalTitle}>{label}</Text>
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
          <Text style={styles.valueBig}>{baselineValue}</Text>
          {hasBaseline && <Text style={styles.valueUnit}>{unit.toUpperCase()}</Text>}
        </View>
        <View style={styles.severityChip}>
          <Text style={[styles.severityChipText, { color: isReady ? '#FFFFFF' : 'rgba(255,255,255,0.5)' }]}>
            {isReady ? t('baseline.metric_ready').toUpperCase() : `${current}/${required}`}
          </Text>
        </View>
      </View>

      {hasToday && (
        <Text style={styles.todayValue}>
          {`Today  ${todayValue} ${unit.toUpperCase()}`}
        </Text>
      )}

      <SignalChart
        values={trendValues}
        dayKeys={dayKeys}
        avgValue={0}
        lineColor={lineColor}
        unit={unit}
        precision={precision}
      />

      {!isReady && remaining > 0 && (
        <Text style={styles.warningText}>
          {t('baseline.more_nights_needed', { remaining })}
        </Text>
      )}
    </View>
  );
}

// ─── Trend bars ───────────────────────────────────────────────────────────────

const BAR_MAX_H = 130;

interface DayBarData {
  date: string;
  count: number;
  values: Array<{ label: string; val: number; unit: string; color: string }>;
}

function TrendBars({ bars, t }: { bars: DayBarData[]; t: (k: string) => string }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  if (bars.length === 0) return null;

  const maxCount = Math.max(...bars.map(b => b.count), 1);
  const selectedBar = selectedDate ? bars.find(b => b.date === selectedDate) ?? null : null;

  return (
    <View>
      <View style={styles.trendContainer}>
        {bars.map(bar => {
          const isToday = bar.date === TODAY;
          const isSelected = bar.date === selectedDate;
          const barH = Math.max(8, Math.round((bar.count / maxCount) * BAR_MAX_H));
          return (
            <TouchableOpacity
              key={bar.date}
              style={styles.trendBarWrap}
              onPress={() => setSelectedDate(isSelected ? null : bar.date)}
              activeOpacity={0.7}
            >
              <Text style={[styles.trendScore, { opacity: isSelected || isToday ? 1 : 0.55 }]}>
                {bar.count}
              </Text>
              <View
                style={[
                  styles.trendBar,
                  {
                    height: barH,
                    backgroundColor: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.45)',
                    opacity: isSelected || isToday ? 1 : 0.65,
                  },
                ]}
              />
              <Text style={[styles.trendDayLabel, { opacity: isSelected || isToday ? 1 : 0.45 }]}>
                {isToday ? t('baseline.detail_trend_today') : shortDay(bar.date)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedBar && (
        <View style={styles.trendDetail}>
          <Text style={styles.trendDetailDate}>{formatLongDate(selectedBar.date)}</Text>
          {selectedBar.values.map(({ label, val, unit, color }) =>
            val > 0 ? (
              <View key={label} style={styles.trendDetailRow}>
                <Text style={styles.trendDetailLabel}>{label}</Text>
                <Text style={[styles.trendDetailVal, { color }]}>
                  {val % 1 === 0 ? val : val.toFixed(1)} {unit}
                </Text>
              </View>
            ) : null
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BaselineDetailScreen() {
  const { t } = useTranslation();
  const baseline = useBaselineMode();
  const homeData = useHomeDataContext();

  const { data: sleepData, isLoading: sleepLoading } = useMetricHistory<DaySleepData>('sleep');
  const { data: hrData, isLoading: hrLoading } = useMetricHistory<DayHRData>('heartRate');
  const { data: hrvData, isLoading: hrvLoading } = useMetricHistory<DayHRVData>('hrv');
  const { data: spo2Data, isLoading: spo2Loading } = useMetricHistory<DaySpO2Data>('spo2');
  const { data: tempData, isLoading: tempLoading } = useMetricHistory<DayTemperatureData>('temperature');
  const { data: actData, isLoading: actLoading } = useMetricHistory<DayActivityData>('activity');

  const isLoading = sleepLoading || hrLoading || hrvLoading || spo2Loading || tempLoading || actLoading;

  const [activeSheet, setActiveSheet] = useState<{ label: string; explainKey: string } | null>(null);
  const infoSheetRef = useRef<BottomSheetModal>(null);

  const openInfo = useCallback((label: string, explainKey: string) => {
    setActiveSheet({ label, explainKey });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    infoSheetRef.current?.present();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.65} pressBehavior="close" />
    ),
    [],
  );

  const dayKeys = useMemo(() => [...DAY_ENTRIES].reverse().map(d => d.dateKey), []);
  const recentDayKeys = useMemo(() => [...dayKeys].reverse(), [dayKeys]);

  const sleepScores = useMemo(() => dayKeys.map(k => sleepData.get(k)?.score ?? 0), [dayKeys, sleepData]);
  const hrValues = useMemo(() => dayKeys.map(k => hrData.get(k)?.restingHR ?? 0), [dayKeys, hrData]);
  const hrvValues = useMemo(() => dayKeys.map(k => hrvData.get(k)?.sdnn ?? 0), [dayKeys, hrvData]);
  const spo2Values = useMemo(() => dayKeys.map(k => spo2Data.get(k)?.avg ?? 0), [dayKeys, spo2Data]);
  const tempValues = useMemo(() => dayKeys.map(k => tempData.get(k)?.avg ?? 0), [dayKeys, tempData]);
  const stepsValues = useMemo(() => dayKeys.map(k => actData.get(k)?.steps ?? 0), [dayKeys, actData]);

  const { avgSleep, avgHR, avgHRV, avgSpO2, avgSteps, avgTemp } = useMemo(() => {
    const validTemps = tempValues.filter(v => v > 0);
    return {
      avgSleep: avg(sleepScores),
      avgHR: avg(hrValues),
      avgHRV: avg(hrvValues),
      avgSpO2: avg(spo2Values),
      avgSteps: avg(stepsValues),
      avgTemp: validTemps.length > 0 ? validTemps.reduce((a, b) => a + b, 0) / validTemps.length : 0,
    };
  }, [sleepScores, hrValues, hrvValues, spo2Values, stepsValues, tempValues]);

  const currentSleep = homeData.sleepScore > 0 ? `${homeData.sleepScore}` : '--';
  const currentHR = homeData.lastNightSleep?.restingHR > 0 ? `${homeData.lastNightSleep.restingHR}` : '--';

  const recentHRVEntry = recentDayKeys.find(k => (hrvData.get(k)?.sdnn ?? 0) > 0);
  const recentHRV = recentHRVEntry ? hrvData.get(recentHRVEntry)!.sdnn! : 0;
  const currentHRV = homeData.hrvSdnn > 0
    ? `${Math.round(homeData.hrvSdnn)}`
    : recentHRV > 0 ? `${Math.round(recentHRV)}` : '--';

  const currentSpO2 = homeData.todayVitals?.lastSpo2 ? `${homeData.todayVitals.lastSpo2}` : '--';
  const currentTemp = homeData.todayVitals?.temperatureC ? `${homeData.todayVitals.temperatureC.toFixed(1)}` : '--';

  const recentActEntry = recentDayKeys.find(k => (actData.get(k)?.steps ?? 0) > 0);
  const recentSteps = recentActEntry ? actData.get(recentActEntry)!.steps : 0;
  const currentSteps = homeData.activity?.steps > 0
    ? `${homeData.activity.steps.toLocaleString()}`
    : recentSteps > 0 ? `${recentSteps.toLocaleString()}` : '--';

  const m = baseline.metrics;
  const daysCurrent = Math.min(baseline.daysWithData, 3);
  const pct = Math.round(baseline.overallProgress * 100);
  const heroDate = baseline.canShowScores
    ? t('baseline.ready')
    : t('baseline.days_complete', { current: daysCurrent, required: 3 });
  const todayLabel = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const trendBars: DayBarData[] = useMemo(() => dayKeys.map((date, i) => {
    const entries = [
      { label: t('baseline.metric_sleep'), val: sleepScores[i], unit: '/100', color: METRIC_LINE_COLORS.sleep },
      { label: t('baseline.metric_heartRate'), val: hrValues[i], unit: 'bpm', color: METRIC_LINE_COLORS.heartRate },
      { label: t('baseline.metric_hrv'), val: hrvValues[i], unit: 'ms', color: METRIC_LINE_COLORS.hrv },
      { label: t('baseline.metric_spo2'), val: spo2Values[i], unit: '%', color: METRIC_LINE_COLORS.spo2 },
      { label: t('baseline.metric_temperature'), val: tempValues[i], unit: '°C', color: METRIC_LINE_COLORS.temperature },
      { label: t('baseline.metric_activity'), val: stepsValues[i], unit: 'steps', color: METRIC_LINE_COLORS.activity },
    ];
    return { date, count: entries.filter(e => e.val > 0).length, values: entries };
  }), [dayKeys, sleepScores, hrValues, hrvValues, spo2Values, tempValues, stepsValues, t]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Reanimated.View entering={FadeIn.duration(600)} style={styles.gradientBg} pointerEvents="none">
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
          <Defs>
            <RadialGradient id="baseGrad1" cx="51%" cy="-20%" rx="90%" ry="220%">
              <Stop offset="0%" stopColor={GRAD_COLOR} stopOpacity={1} />
              <Stop offset="70%" stopColor={GRAD_COLOR} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="baseGrad2" cx="85%" cy="10%" rx="60%" ry="80%">
              <Stop offset="0%" stopColor={GRAD_COLOR} stopOpacity={0.6} />
              <Stop offset="100%" stopColor={GRAD_COLOR} stopOpacity={0} />
            </RadialGradient>
            <LinearGradient id="baseFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="40%" stopColor={colors.background} stopOpacity={0} />
              <Stop offset="100%" stopColor={colors.background} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#baseGrad1)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#baseGrad2)" />
          <Rect x="0" y="0" width="100" height="100" fill="url(#baseFade)" />
        </Svg>
      </Reanimated.View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.navRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <BackArrow />
          </TouchableOpacity>
          <View style={styles.statusChip}>
            <Text style={styles.statusChipText}>
              {baseline.canShowScores ? t('baseline.status_ready') : t('baseline.status_building')}
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTopRow}>
            <Text style={styles.heroScore}>{pct}</Text>
            <View style={styles.heroDateBlock}>
              <Text style={styles.heroDate}>{heroDate}</Text>
              <Text style={styles.staleText}>{todayLabel}</Text>
            </View>
          </View>
          <View style={styles.recsInline}>
            <Text style={styles.recInlineText}>{t('baseline.detail_rec_1')}</Text>
            <Text style={styles.recInlineText}>{t('baseline.detail_rec_2')}</Text>
            <Text style={styles.recInlineText}>{t('baseline.detail_rec_3')}</Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.tertiary} />
          </View>
        ) : (
          <>
            <MetricSignalCard
              label={`${t('baseline.metric_sleep')} Baseline`}
              baselineValue={avgSleep > 0 ? `${avgSleep}` : '--'}
              todayValue={currentSleep}
              unit="/100"
              precision={0}
              lineColor={METRIC_LINE_COLORS.sleep}
              isReady={m.sleep.ready}
              current={m.sleep.current}
              required={m.sleep.required}
              trendValues={sleepScores}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_sleep')} Baseline`, 'baseline.detail_explain_sleep')}
              t={t}
            />
            <MetricSignalCard
              label={`${t('baseline.metric_heartRate')} Baseline`}
              baselineValue={avgHR > 0 ? `${avgHR}` : '--'}
              todayValue={currentHR}
              unit="bpm"
              precision={0}
              lineColor={METRIC_LINE_COLORS.heartRate}
              isReady={m.heartRate.ready}
              current={m.heartRate.current}
              required={m.heartRate.required}
              trendValues={hrValues}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_heartRate')} Baseline`, 'baseline.detail_explain_heart_rate')}
              t={t}
            />
            <MetricSignalCard
              label={`${t('baseline.metric_hrv')} Baseline`}
              baselineValue={avgHRV > 0 ? `${avgHRV}` : '--'}
              todayValue={currentHRV}
              unit="ms"
              precision={0}
              lineColor={METRIC_LINE_COLORS.hrv}
              isReady={m.hrv.ready}
              current={m.hrv.current}
              required={m.hrv.required}
              trendValues={hrvValues}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_hrv')} Baseline`, 'baseline.detail_explain_hrv')}
              t={t}
            />
            <MetricSignalCard
              label={`${t('baseline.metric_temperature')} Baseline`}
              baselineValue={avgTemp > 0 ? avgTemp.toFixed(1) : '--'}
              todayValue={currentTemp}
              unit="°C"
              precision={1}
              lineColor={METRIC_LINE_COLORS.temperature}
              isReady={m.temperature.ready}
              current={m.temperature.current}
              required={m.temperature.required}
              trendValues={tempValues}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_temperature')} Baseline`, 'baseline.detail_explain_temperature')}
              t={t}
            />
            <MetricSignalCard
              label={`${t('baseline.metric_spo2')} Baseline`}
              baselineValue={avgSpO2 > 0 ? `${avgSpO2}` : '--'}
              todayValue={currentSpO2}
              unit="%"
              precision={0}
              lineColor={METRIC_LINE_COLORS.spo2}
              isReady={m.spo2.ready}
              current={m.spo2.current}
              required={m.spo2.required}
              trendValues={spo2Values}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_spo2')} Baseline`, 'baseline.detail_explain_spo2')}
              t={t}
            />
            <MetricSignalCard
              label={`${t('baseline.metric_activity')} Baseline`}
              baselineValue={avgSteps > 0 ? avgSteps.toLocaleString() : '--'}
              todayValue={currentSteps}
              unit="steps"
              precision={0}
              lineColor={METRIC_LINE_COLORS.activity}
              isReady={m.activity.ready}
              current={m.activity.current}
              required={m.activity.required}
              trendValues={stepsValues}
              dayKeys={dayKeys}
              onInfo={() => openInfo(`${t('baseline.metric_activity')} Baseline`, 'baseline.detail_explain_activity')}
              t={t}
            />
          </>
        )}

        {!isLoading && trendBars.some(b => b.count > 0) && (
          <>
            <Text style={styles.sectionTitle}>{t('baseline.detail_trend_title')}</Text>
            <View style={styles.trendSection}>
              <TrendBars bars={trendBars} t={t} />
            </View>
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

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
          {activeSheet && (
            <>
              <Text style={styles.sheetTitle}>{activeSheet.label}</Text>
              <Text style={styles.sheetBody}>{t(activeSheet.explainKey)}</Text>
            </>
          )}
        </BottomSheetView>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

// ─── Styles (mirrors IllnessDetailScreen) ─────────────────────────────────────

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
  todayValue: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    marginTop: -6,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  warningText: {
    fontFamily: fontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
    color: 'rgba(255,255,255,0.5)',
  },
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
  loadingWrap: {
    paddingTop: 40,
    alignItems: 'center',
  },
  bottomPad: {
    height: 20,
  },
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
