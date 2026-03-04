import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { METRIC_EXPLANATIONS } from '../../data/metricExplanations';
import type { MetricKey } from '../../data/metricExplanations';
import { RangeBarChart } from './charts/RangeBarChart';
import { ScoreArcChart } from './charts/ScoreArcChart';
import { SleepStagesBar } from './charts/SleepStagesBar';
import { WaveformHint } from './charts/WaveformHint';
import { fontFamily as ff } from '../../theme/colors';

interface ExplainerSheetContentProps {
  metricKey: MetricKey;
  onClose: () => void;
}

export function ExplainerSheetContent({ metricKey, onClose }: ExplainerSheetContentProps) {
  const data = METRIC_EXPLANATIONS[metricKey];
  const { width } = useWindowDimensions();

  if (!data) return null;

  return (
    <View style={styles.container}>
      {/* Accent stripe */}
      <View style={[styles.accentStripe, { backgroundColor: data.accentColor }]} />

      <BottomSheetScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.title}>{data.title}</Text>
        <Text style={styles.subtitle}>{data.subtitle}</Text>

        {/* Chart */}
        {data.chart.type !== 'none' && (
          <View style={styles.chartContainer}>
            {data.chart.type === 'range_bar' && (
              <RangeBarChart ranges={data.chart.ranges} unit={data.chart.unit} />
            )}
            {data.chart.type === 'score_arc' && (
              <ScoreArcChart zones={data.chart.zones} />
            )}
            {data.chart.type === 'sleep_stages' && (
              <SleepStagesBar />
            )}
            {data.chart.type === 'waveform' && (
              <WaveformHint color={data.accentColor} />
            )}
          </View>
        )}

        {/* Body */}
        <Text style={styles.body}>{data.body}</Text>

        {/* Ranges */}
        {data.ranges && data.ranges.length > 0 && (
          <View style={styles.rangesContainer}>
            {data.ranges.map((range, i) => (
              <View key={i} style={styles.rangeRow}>
                <View style={[styles.rangeDot, { backgroundColor: data.accentColor }]} />
                <Text style={styles.rangeText}>{range}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Got it button */}
        <Pressable style={[styles.button, { backgroundColor: data.accentColor }]} onPress={onClose}>
          <Text style={styles.buttonText}>Got it</Text>
        </Pressable>
      </BottomSheetScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  accentStripe: {
    height: 3,
    marginHorizontal: 24,
    borderRadius: 2,
    opacity: 0.8,
    marginBottom: 8,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: ff.regular,
    fontWeight: '300',
    marginBottom: 4,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: ff.regular,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartContainer: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  body: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontFamily: ff.regular,
    lineHeight: 24,
    marginBottom: 20,
  },
  rangesContainer: {
    gap: 8,
    marginBottom: 28,
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  rangeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  rangeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontFamily: ff.regular,
    flex: 1,
    lineHeight: 20,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: ff.regular,
    fontWeight: '600',
  },
});

export default ExplainerSheetContent;
