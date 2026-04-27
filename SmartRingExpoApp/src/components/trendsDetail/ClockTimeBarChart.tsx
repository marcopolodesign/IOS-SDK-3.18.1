import React from 'react';
import { Dimensions } from 'react-native';
import { TrendBarChart } from '../detail/TrendBarChart';
import type { TrendBucket, TrendSeries } from '../../hooks/useTrendsData';

const SCREEN_W = Dimensions.get('window').width;

interface Props {
  buckets: TrendBucket[];
  series: TrendSeries;
  color: string;
  clockRange: [number, number];
  chartHeight?: number;
  colWidth?: number;
  barWidth?: number;
  selectedIndex?: number;
  onSelectDay?: (index: number) => void;
}

/** Wraps TrendBarChart for clock-time metrics (bedTime, sleepOnset, wakeTime).
 *  Values are decimal hours; clock range is passed as minValue/maxValue so bar
 *  heights encode earliness/lateness instead of duration. */
export function ClockTimeBarChart({
  buckets,
  series,
  color,
  clockRange,
  chartHeight = 100,
  colWidth,
  barWidth,
  selectedIndex = 0,
  onSelectDay,
}: Props) {
  const defaultColW = Math.max(28, Math.floor(SCREEN_W / Math.max(1, buckets.length)));
  const defaultBarW = Math.max(16, defaultColW - 8);

  return (
    <TrendBarChart
      dayEntries={buckets}
      values={series.map(s => ({
        dateKey: s.bucketKey,
        value: s.value ?? 0,
      }))}
      selectedIndex={selectedIndex}
      onSelectDay={onSelectDay ?? (() => {})}
      colorFn={() => color}
      minValue={clockRange[0]}
      maxValue={clockRange[1]}
      chartHeight={chartHeight}
      colWidth={colWidth ?? defaultColW}
      barWidth={barWidth ?? defaultBarW}
      showValueLabels={false}
      roundedBars
      unselectedOpacity={0.35}
      labelsBelow
    />
  );
}
