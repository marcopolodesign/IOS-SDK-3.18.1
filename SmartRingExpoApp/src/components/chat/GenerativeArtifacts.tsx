import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, Path, Text as SvgText } from 'react-native-svg';
import { HeartRateChart } from '../HeartRateChart';
import { MetricsGrid, MetricCell } from '../detail/MetricsGrid';
import { HeroLinearGauge } from '../home/HeroLinearGauge';
import { fontFamily, fontSize, spacing } from '../../theme/colors';

const CARD_PADDING = 16;
const CHART_WIDTH = Dimensions.get('window').width - 64 - CARD_PADDING * 2;

// ─── Shared card wrapper ──────────────────────────────────────────────────────

function ArtifactCard({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────

export type BarChartData = {
  points: { label: string; value: number }[];
  title?: string;
  unit?: string;
  accent?: string;
  maxValue?: number;
};

export function BarChartArtifact({ data }: { data: BarChartData }) {
  const { points, title, unit, accent = '#6B8EFF', maxValue } = data;
  const [selected, setSelected] = useState<number | null>(null);

  if (!points || points.length === 0) return null;

  const max = maxValue ?? Math.max(...points.map(p => p.value), 1);
  const chartH = 110;
  const barW = Math.min(32, Math.floor((CHART_WIDTH - 8) / points.length) - 4);
  const gap = Math.floor((CHART_WIDTH - barW * points.length) / (points.length + 1));
  const labelH = 18;
  const svgH = chartH + labelH + 4;

  return (
    <ArtifactCard title={title}>
      <Svg width={CHART_WIDTH} height={svgH}>
        {points.map((p, i) => {
          const barH = Math.max(4, Math.round((p.value / max) * chartH));
          const x = gap + i * (barW + gap);
          const y = chartH - barH;
          const isSelected = selected === i;
          const fill = isSelected ? accent : `${accent}55`;
          return (
            <React.Fragment key={i}>
              <Rect
                x={x} y={y} width={barW} height={barH}
                fill={fill} rx={4} ry={4}
                onPress={() => setSelected(isSelected ? null : i)}
              />
              <SvgText
                x={x + barW / 2} y={svgH - 2}
                textAnchor="middle"
                fontSize={10} fill="rgba(255,255,255,0.5)"
                fontFamily={fontFamily.regular}
              >
                {p.label}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
      {selected !== null && (
        <Text style={[styles.selectedLabel, { color: accent }]}>
          {points[selected].label}: {points[selected].value}{unit ? ` ${unit}` : ''}
        </Text>
      )}
    </ArtifactCard>
  );
}

// ─── Line Chart ───────────────────────────────────────────────────────────────

export type LineChartData = {
  points: number[];
  labels?: string[];
  title?: string;
  unit?: string;
  accent?: string;
};

export function LineChartArtifact({ data }: { data: LineChartData }) {
  const { points, title, accent = '#6B8EFF' } = data;
  if (!points || points.length === 0) return null;

  return (
    <ArtifactCard title={title}>
      <HeartRateChart
        data={points}
        width={CHART_WIDTH}
        height={120}
        color={accent}
        showLabels={false}
      />
    </ArtifactCard>
  );
}

// ─── Stat Grid ────────────────────────────────────────────────────────────────

export type StatGridData = {
  cells: { label: string; value: string | number; unit?: string; accent?: string }[];
  title?: string;
};

export function StatGridArtifact({ data }: { data: StatGridData }) {
  const { cells, title } = data;
  if (!cells || cells.length === 0) return null;

  const metrics: MetricCell[] = cells.map(c => ({
    label: c.label,
    value: String(c.value),
    unit: c.unit,
    accent: c.accent,
  }));

  return (
    <ArtifactCard title={title}>
      <MetricsGrid metrics={metrics} />
    </ArtifactCard>
  );
}

// ─── Gauge ────────────────────────────────────────────────────────────────────

export type GaugeData = {
  value: number;
  goal: number;
  label: string;
  message?: string;
};

export function GaugeArtifact({ data }: { data: GaugeData }) {
  const { value, goal, label, message } = data;
  return (
    <View style={styles.card}>
      <HeroLinearGauge label={label} value={value} goal={goal} message={message ?? ''} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    paddingHorizontal: CARD_PADDING,
    paddingVertical: spacing.md,
    marginTop: 8,
  },
  title: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectedLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    marginTop: 6,
    textAlign: 'center',
  },
});
