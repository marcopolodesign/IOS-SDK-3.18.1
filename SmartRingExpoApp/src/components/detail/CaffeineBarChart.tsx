// Shared caffeine visualization components — used in adenosine-detail and OverviewTab caffeine section.
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { spacing, fontFamily } from '../../theme/colors';
import {
  totalMgAt,
  peakMgForDoses,
  MAX_CAFFEINE_MG,
  SLEEP_THRESHOLD_MG,
  CAFFEINE_PRESETS,
  type CaffeineDose,
} from '../../utils/caffeinePk';
import { formatDecimalHour } from '../../utils/time';

const DRINK_ICON_SIZE = 14;
const BAR_PAD_L = 40;
const BAR_PAD_R = 8;
const BAR_PAD_T = 28;
const BAR_PAD_B = 4;

export type BarEntry = {
  id: string;
  drink_type: string;
  name: string | null;
  consumed_at: string;
};

// ─── Bar chart — PK-modeled caffeine per 30-min slot with Y-axis + drink markers ─
export function CaffeineBarChart({
  doses,
  entries,
  win,
  clearHour,
  timeStart,
  timeEnd,
  height = 240,
}: {
  doses: CaffeineDose[];
  entries: BarEntry[];
  win: { start: number; end: number };
  clearHour: number | null | undefined;
  timeStart: number;
  timeEnd: number;
  height?: number;
}) {
  const { width: screenWidth } = useWindowDimensions();
  const svgW = screenWidth - spacing.md * 2;
  const innerW = svgW - BAR_PAD_L - BAR_PAD_R;
  const innerH = height - BAR_PAD_T - BAR_PAD_B;

  const timeSpan = Math.max(timeEnd - timeStart, 1);
  const totalBars = Math.ceil((timeEnd - timeStart) * 4);
  const slotW = innerW / totalBars;
  const GAP = 4;
  const isPlaceholder = doses.length === 0;

  const displayDoses = useMemo<CaffeineDose[]>(
    () => isPlaceholder ? [{ intakeHour: win.start, amountMg: MAX_CAFFEINE_MG }] : doses,
    [doses, isPlaceholder, win.start],
  );

  const peak = useMemo(
    () => peakMgForDoses(displayDoses, timeStart, timeEnd),
    [displayDoses, timeStart, timeEnd],
  );
  const yScale = useMemo(() => Math.max(peak, MAX_CAFFEINE_MG), [peak]);

  const bars = useMemo(() => Array.from({ length: totalBars }, (_, i) => {
    const slotMid = timeStart + i * 0.25 + 0.125;
    if (slotMid > timeEnd) return null;
    const mg = totalMgAt(slotMid, displayDoses);
    const barH = mg > 0 ? Math.max((mg / yScale) * innerH, 2) : 8;
    const x = BAR_PAD_L + i * slotW + GAP / 2;
    const y = BAR_PAD_T + innerH - barH;
    return { x, y, w: Math.max(slotW - GAP, 1), h: barH, dim: mg === 0 };
  }).filter(Boolean), [displayDoses, yScale, timeStart, timeEnd, slotW, innerH, totalBars]);

  const placeholderBars = useMemo(() => {
    if (isPlaceholder) return bars;
    const phDoses: CaffeineDose[] = [{ intakeHour: win.start, amountMg: MAX_CAFFEINE_MG }];
    return Array.from({ length: totalBars }, (_, i) => {
      const slotMid = timeStart + i * 0.25 + 0.125;
      if (slotMid > timeEnd) return null;
      const mg = totalMgAt(slotMid, phDoses);
      const barH = mg > 0 ? Math.max((mg / yScale) * innerH, 2) : 8;
      const x = BAR_PAD_L + i * slotW + GAP / 2;
      const y = BAR_PAD_T + innerH - barH;
      return { x, y, w: Math.max(slotW - GAP, 1), h: barH };
    }).filter(Boolean);
  }, [isPlaceholder, bars, win.start, timeStart, timeEnd, totalBars, slotW, yScale, innerH]);

  const line400Y = BAR_PAD_T + innerH - (MAX_CAFFEINE_MG / yScale) * innerH;
  const sleepY = BAR_PAD_T + innerH - (SLEEP_THRESHOLD_MG / yScale) * innerH;
  const yTicks = [200, 300];

  const now = new Date();
  const nowHr = now.getHours() + now.getMinutes() / 60;
  const clamped = Math.max(timeStart, Math.min(timeEnd, nowHr));
  const nowX = BAR_PAD_L + ((clamped - timeStart) / timeSpan) * innerW;

  const drinkMarkers = useMemo(() => entries.map(e => {
    const h = new Date(e.consumed_at).getHours() + new Date(e.consumed_at).getMinutes() / 60;
    if (h < timeStart || h > timeEnd) return null;
    const x = BAR_PAD_L + ((h - timeStart) / timeSpan) * innerW;
    const mgHere = totalMgAt(h + 0.25, doses);
    const barTop = BAR_PAD_T + innerH - Math.max((mgHere / yScale) * innerH, 2);
    return { id: e.id, x, iconLeft: x - DRINK_ICON_SIZE / 2, iconTop: Math.max(barTop - 18, 2) };
  }).filter(Boolean), [entries, doses, yScale, timeStart, timeEnd, timeSpan, innerW, innerH]);

  return (
    <View style={styles.barWrapper}>
      <View>
        <Svg width={svgW} height={height}>
          {/* Y-axis labels */}
          {yTicks.map(mg => {
            const y = BAR_PAD_T + innerH - (mg / yScale) * innerH;
            return (
              <SvgText key={mg} x={BAR_PAD_L - 5} y={y + 4}
                fill="rgba(255,255,255,0.45)" fontSize={12}
                fontFamily={fontFamily.regular} textAnchor="end">
                {mg}
              </SvgText>
            );
          })}
          <SvgText x={BAR_PAD_L - 5} y={BAR_PAD_T + innerH + 4}
            fill="rgba(255,255,255,0.28)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            mg
          </SvgText>
          <SvgText x={BAR_PAD_L - 5} y={line400Y + 4}
            fill="rgba(255,255,255,0.45)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            400
          </SvgText>

          {/* Ghost bars — ideal curve or background reference when drinks logged */}
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
              x1={m.x} y1={BAR_PAD_T} x2={m.x} y2={BAR_PAD_T + innerH}
              stroke="rgba(255,255,255,0.45)" strokeWidth={1.5} strokeDasharray="2,3" />
          ))}

          {/* Sleep threshold at 100mg */}
          <Line x1={BAR_PAD_L} y1={sleepY} x2={svgW - BAR_PAD_R} y2={sleepY}
            stroke="rgba(253,141,143,0.55)" strokeWidth={1} strokeDasharray="4,4" />
          <SvgText x={svgW - BAR_PAD_R} y={sleepY - 4}
            fill="rgba(253,141,143,0.7)" fontSize={11} fontFamily={fontFamily.regular} textAnchor="end">
            sleep threshold
          </SvgText>
          <SvgText x={BAR_PAD_L - 5} y={sleepY + 4}
            fill="rgba(253,141,143,0.6)" fontSize={12}
            fontFamily={fontFamily.regular} textAnchor="end">
            100
          </SvgText>

          {/* Daily limit at 400mg */}
          <Line x1={BAR_PAD_L} y1={line400Y} x2={svgW - BAR_PAD_R} y2={line400Y}
            stroke="rgba(255,255,255,0.5)" strokeWidth={1} strokeDasharray="4,4" />
          <SvgText x={svgW - BAR_PAD_R} y={line400Y - 4}
            fill="rgba(255,255,255,0.6)" fontSize={11} fontFamily={fontFamily.regular} textAnchor="end">
            daily limit
          </SvgText>

          {/* Now line */}
          <Line x1={nowX} y1={BAR_PAD_T} x2={nowX} y2={BAR_PAD_T + innerH}
            stroke="rgba(255,255,255,0.3)" strokeWidth={1} strokeDasharray="2,3" />
        </Svg>

        {/* Drink icon labels — absolute overlay above each spike */}
        {drinkMarkers.map(m => m && (
          <View key={m.id} style={[styles.drinkIcon, { left: m.iconLeft, top: m.iconTop }]}>
            <Ionicons name="cafe-outline" size={DRINK_ICON_SIZE} color="rgba(255,255,255,0.85)" />
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Window phase bar — colored phase strip aligning with bar chart X axis ────
export function CaffeineWindowPhaseBar({
  win,
  clearHour,
  activePhase,
  wakeHour,
  bedHour,
}: {
  win: { start: number; end: number };
  clearHour?: number | null;
  activePhase: 'pre' | 'open' | 'closed';
  wakeHour: number;
  bedHour: number;
}) {
  const timeStart = wakeHour;
  const timeEnd = bedHour;
  const timeSpan = Math.max(timeEnd - timeStart, 1);
  const openEnd = Math.min(clearHour ?? win.end, timeEnd);

  const preFrac = Math.max(0, (win.start - timeStart) / timeSpan);
  const openFrac = Math.max(0, (openEnd - win.start) / timeSpan);
  const closedFrac = Math.max(0, (timeEnd - openEnd) / timeSpan);

  return (
    <View style={styles.phaseOuter}>
      <View style={styles.phaseBars}>
        {preFrac > 0 && (
          <View style={[styles.phaseSegment, { flex: preFrac,
            backgroundColor: activePhase === 'pre' ? '#FFAC3F' : 'rgba(255,172,63,0.35)' }]} />
        )}
        {openFrac > 0 && (
          <View style={[styles.phaseSegment, { flex: openFrac,
            backgroundColor: activePhase === 'open' ? '#00D7A9' : 'rgba(0,215,169,0.35)' }]} />
        )}
        {closedFrac > 0 && (
          <View style={[styles.phaseSegment, { flex: closedFrac,
            backgroundColor: activePhase === 'closed' ? '#FD8D8F' : 'rgba(253,141,143,0.35)' }]} />
        )}
      </View>
      <View style={styles.phaseLabels}>
        {preFrac > 0 && (
          <View style={{ flex: preFrac }}>
            <View style={styles.wakeTag}>
              <Ionicons name="sunny-outline" size={10} color="rgba(255,255,255,0.6)" />
              <Text style={styles.phaseLabelText}>{formatDecimalHour(wakeHour)}</Text>
            </View>
          </View>
        )}
        {openFrac > 0 && (
          <View style={{ flex: openFrac }}>
            <Text style={styles.phaseLabelText}>{formatDecimalHour(win.start)}</Text>
          </View>
        )}
        {closedFrac > 0 && (
          <View style={{ flex: closedFrac }}>
            <Text style={styles.phaseLabelText}>{formatDecimalHour(openEnd)}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Drink suggestions based on remaining caffeine budget ─────────────────────
export function DrinkSuggestions({
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
      <View style={styles.suggSection}>
        <Text style={styles.suggHeading}>{t('adenosine.suggestions_heading')}</Text>
        <View style={styles.suggEmptyCard}>
          <Text style={styles.suggEmptyText}>{t(`adenosine.${emptyKey}`)}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.suggSection}>
      <Text style={styles.suggHeading}>{t('adenosine.suggestions_heading')}</Text>
      <Text style={styles.suggBudget}>{t('adenosine.suggestions_budget', { budget })}</Text>
      <View style={styles.suggGrid}>
        {available.map(drink => (
          <View key={drink.key} style={styles.suggCard}>
            <Ionicons name="cafe-outline" size={24} color="rgba(255,255,255,0.85)" />
            <Text style={styles.suggDrinkName}>{t(`adenosine.preset.${drink.key}`)}</Text>
            <Text style={styles.suggMg}>{drink.defaultMg}mg</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barWrapper: { marginHorizontal: spacing.md, marginBottom: 0 },
  drinkIcon: { position: 'absolute', width: 16, alignItems: 'center' },

  phaseOuter: { marginHorizontal: spacing.md, paddingLeft: BAR_PAD_L, paddingRight: BAR_PAD_R, marginBottom: spacing.lg },
  phaseBars: { flexDirection: 'row', gap: 4 },
  phaseSegment: { height: 8, borderRadius: 4 },
  phaseLabels: { flexDirection: 'row', marginTop: 5 },
  wakeTag: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  phaseLabelText: { color: 'rgba(255,255,255,0.4)', fontFamily: fontFamily.regular, fontSize: 10 },

  suggSection: { marginHorizontal: spacing.md, marginBottom: spacing.lg },
  suggHeading: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  suggBudget: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamily.regular,
    fontSize: 13,
    marginBottom: 12,
  },
  suggGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggCard: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 4,
    minWidth: 78,
  },
  suggDrinkName: { color: 'rgba(255,255,255,0.8)', fontFamily: fontFamily.regular, fontSize: 12 },
  suggMg: { color: 'rgba(255,255,255,0.4)', fontFamily: fontFamily.regular, fontSize: 11 },
  suggEmptyCard: {
    borderWidth: 1,
    borderColor: 'rgba(253,141,143,0.3)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  suggEmptyText: {
    color: 'rgba(253,141,143,0.7)',
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textAlign: 'center',
  },
});
