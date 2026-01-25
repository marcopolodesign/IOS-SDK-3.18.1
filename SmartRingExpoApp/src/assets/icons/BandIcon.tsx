import React from 'react';
import Svg, { Rect, Path } from 'react-native-svg';

export interface BandIconProps {
  width?: number;
  height?: number;
  fill?: string;
}

// Placeholder band icon - replace with actual SVG when available
export function BandIcon({
  width = 16,
  height = 16,
  fill = 'white'
}: BandIconProps) {
  return (
    <Svg width={width} height={height} viewBox="0 0 16 16" fill="none">
      {/* Simple band/watch placeholder */}
      <Rect x={4} y={1} width={8} height={14} rx={2} stroke={fill} strokeWidth={1.5} fill="none" />
      <Rect x={5.5} y={4} width={5} height={3} rx={0.5} fill={fill} />
    </Svg>
  );
}

export default BandIcon;
