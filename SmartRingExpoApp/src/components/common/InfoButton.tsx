import React from 'react';
import { Pressable } from 'react-native';
import { InfoIcon } from '../../assets/icons';
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
      <InfoIcon size={size} color={color} />
    </Pressable>
  );
}

export default InfoButton;
