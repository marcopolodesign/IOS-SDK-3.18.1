import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Path } from 'react-native-svg';
import { colors, fontSize, fontWeight } from '../theme/colors';

interface BatteryIndicatorProps {
  level: number;
  isCharging?: boolean;
  size?: 'small' | 'medium' | 'large';
  showPercentage?: boolean;
}

export const BatteryIndicator: React.FC<BatteryIndicatorProps> = ({
  level,
  isCharging = false,
  size = 'medium',
  showPercentage = true,
}) => {
  const dimensions = {
    small: { width: 24, height: 12, capWidth: 2 },
    medium: { width: 32, height: 16, capWidth: 3 },
    large: { width: 48, height: 24, capWidth: 4 },
  };

  const { width, height, capWidth } = dimensions[size];
  const innerPadding = 2;
  const innerWidth = width - innerPadding * 2 - capWidth;
  const innerHeight = height - innerPadding * 2;
  const fillWidth = (Math.min(level, 100) / 100) * innerWidth;

  const getBatteryColor = () => {
    if (level <= 20) return colors.batteryLow;
    if (level <= 50) return colors.batteryMedium;
    return colors.batteryFull;
  };

  const batteryColor = getBatteryColor();

  return (
    <View style={styles.container}>
      <Svg width={width + capWidth} height={height}>
        {/* Battery body outline */}
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={3}
          ry={3}
          fill="none"
          stroke={colors.textSecondary}
          strokeWidth={1.5}
        />
        
        {/* Battery cap */}
        <Rect
          x={width}
          y={height * 0.25}
          width={capWidth}
          height={height * 0.5}
          rx={1}
          fill={colors.textSecondary}
        />
        
        {/* Battery fill */}
        <Rect
          x={innerPadding}
          y={innerPadding}
          width={fillWidth}
          height={innerHeight}
          rx={2}
          fill={batteryColor}
        />
        
        {/* Charging icon */}
        {isCharging && (
          <Path
            d={`M ${width / 2 + 1} ${height * 0.2} L ${width / 2 - 2} ${height / 2} L ${width / 2} ${height / 2} L ${width / 2 - 1} ${height * 0.8} L ${width / 2 + 2} ${height / 2} L ${width / 2} ${height / 2} Z`}
            fill={level > 50 ? colors.background : colors.text}
          />
        )}
      </Svg>
      
      {showPercentage && (
        <Text style={[styles.percentage, { color: batteryColor }]}>
          {Math.round(level)}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentage: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
});

export default BatteryIndicator;





