import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function SleptIcon({ size = 20, color = 'white' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <Path d="M19.0176 13.2458C19.2266 12.7477 18.6292 12.3235 18.1281 12.5448C17.1263 12.9841 16.0441 13.2102 14.9503 13.2089C10.6617 13.2089 7.18566 9.80257 7.18566 5.60001C7.18522 4.18122 7.58826 2.79157 8.34774 1.59318C8.63877 1.13409 8.28933 0.498731 7.75645 0.634C3.64817 1.68233 0.614868 5.34279 0.614868 9.69702C0.614868 14.869 4.89326 19.0613 10.1718 19.0613C14.1684 19.0613 17.5911 16.6582 19.0176 13.2458Z" stroke={color} strokeWidth="1.22972"/>
    </Svg>
  );
}

export default SleptIcon;
