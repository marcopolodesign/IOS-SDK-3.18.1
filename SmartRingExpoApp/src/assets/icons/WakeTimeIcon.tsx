import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface Props {
  focused?: boolean;
  color?: string;
}

export function WakeTimeIcon({ focused = false, color = 'white' }: Props) {
  
  return (
    <Svg width="25" height="25" viewBox="0 0 25 25" fill="none">

<Path d="M12.2972 18.4459C15.693 18.4459 18.4458 15.693 18.4458 12.2973C18.4458 8.9015 15.693 6.14868 12.2972 6.14868C8.90144 6.14868 6.14862 8.9015 6.14862 12.2973C6.14862 15.693 8.90144 18.4459 12.2972 18.4459Z" stroke={color} strokeWidth="1.22972"/>
<Path d="M12.2972 2.04956V3.07432M12.2972 21.5201V22.5448M22.5449 12.2972H21.5201M3.07434 12.2972H2.04958M19.5423 5.05212L19.1406 5.45485M5.45384 19.1406L5.05111 19.5433M19.5423 19.5423L19.1406 19.1396M5.45384 5.45383L5.05111 5.0511" stroke={color} strokeWidth="1.22972" strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}

export default WakeTimeIcon;

