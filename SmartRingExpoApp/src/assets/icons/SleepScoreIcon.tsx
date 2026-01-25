import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type Props = {
  size?: number;
  color?: string;
};

export function SleepScoreIcon({ size = 20, color = '#FFFFFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="11" stroke={color} strokeWidth="2" opacity={0.7} />
      <Path
        d="M10.2 8C10.2 7.44772 10.6477 7 11.2 7H12.2C12.7523 7 13.2 7.44772 13.2 8V8C13.2 8.55228 12.7523 9 12.2 9H11.2C10.6477 9 10.2 8.55228 10.2 8V8ZM10.2 12C10.2 11.4477 10.6477 11 11.2 11H12.2C12.7523 11 13.2 11.4477 13.2 12V12C13.2 12.5523 12.7523 13 12.2 13H11.2C10.6477 13 10.2 12.5523 10.2 12V12ZM10.2 16C10.2 15.4477 10.6477 15 11.2 15H12.2C12.7523 15 13.2 15.4477 13.2 16V16C13.2 16.5523 12.7523 17 12.2 17H11.2C10.6477 17 10.2 16.5523 10.2 16V16Z"
        fill={color}
        opacity={0.9}
      />
    </Svg>
  );
}

export default SleepScoreIcon;
