import React from 'react';
import Svg, { Path } from 'react-native-svg';

export function BackArrow() {
  return (
    <Svg width={20} height={16} viewBox="0 0 10 8" fill="none">
      <Path d="M4.70414 0.5L0.770736 3.85303L4.41942 6.96336" stroke="white" strokeLinecap="round" />
      <Path d="M0.856245 3.92035H8.80856" stroke="white" strokeLinecap="round" />
    </Svg>
  );
}
