import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

interface WaveformHintProps {
  color?: string;
  height?: number;
}

export function WaveformHint({ color = '#FF6B6B', height = 48 }: WaveformHintProps) {
  // Static ECG-like path drawn across full width
  const w = 280;
  const h = height;
  const mid = h / 2;
  const amp = h * 0.38;

  // Build a stylized ECG path: flat → spike → sine decay
  const path = [
    `M 0 ${mid}`,
    `L ${w * 0.2} ${mid}`,
    // small bump
    `Q ${w * 0.23} ${mid - amp * 0.3} ${w * 0.25} ${mid}`,
    `L ${w * 0.3} ${mid}`,
    // main spike up
    `L ${w * 0.33} ${mid - amp}`,
    // spike down
    `L ${w * 0.36} ${mid + amp * 0.5}`,
    `L ${w * 0.39} ${mid}`,
    // sine tail
    `Q ${w * 0.43} ${mid - amp * 0.4} ${w * 0.47} ${mid}`,
    `Q ${w * 0.51} ${mid + amp * 0.4} ${w * 0.55} ${mid}`,
    `Q ${w * 0.59} ${mid - amp * 0.35} ${w * 0.63} ${mid}`,
    `Q ${w * 0.67} ${mid + amp * 0.3} ${w * 0.71} ${mid}`,
    `Q ${w * 0.75} ${mid - amp * 0.25} ${w * 0.79} ${mid}`,
    `L ${w} ${mid}`,
  ].join(' ');

  return (
    <View style={{ width: '100%', height }}>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${h}`}>
        <Path
          d={path}
          stroke={color}
          strokeWidth={2}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

export default WaveformHint;
