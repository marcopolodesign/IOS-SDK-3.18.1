import React from 'react';
import { Pressable } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { useMetricExplainer } from '../../context/MetricExplainerContext';
import type { MetricKey } from '../../data/metricExplanations';

interface InfoButtonProps {
  metricKey: MetricKey;
  size?: number;
  color?: string;
}

export function InfoButton({ metricKey, size = 20, color = 'rgba(255,255,255,0.5)' }: InfoButtonProps) {
  const { openExplainer } = useMetricExplainer();

  return (
    <Pressable
      onPress={() => openExplainer(metricKey)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={`Learn more about ${metricKey.replace(/_/g, ' ')}`}
    >
      <Svg width={size} height={size} viewBox="0 0 20 20">
        <Circle cx={10} cy={10} r={9} stroke={color} strokeWidth={1.5} fill="none" />
        {/* "i" dot */}
        <Circle cx={10} cy={6.5} r={1.2} fill={color} />
        {/* "i" stem */}
        <SvgText
          x={10}
          y={15.5}
          fontSize={8}
          fontWeight="700"
          fill={color}
          textAnchor="middle"
        >
          i
        </SvgText>
      </Svg>
    </Pressable>
  );
}

export default InfoButton;
