import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, Text as SvgText } from 'react-native-svg';
import { colors, spacing, borderRadius, fontSize } from '../theme/colors';

interface HeartRateChartProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showLabels?: boolean;
  animated?: boolean;
}

export const HeartRateChart: React.FC<HeartRateChartProps> = ({
  data,
  width = Dimensions.get('window').width - 48,
  height = 150,
  color = colors.heartRate,
  showLabels = true,
}) => {
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { width, height }]}>
        <Text style={styles.noData}>No data available</Text>
      </View>
    );
  }

  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const filteredData = data.filter(v => v > 0);
  const minValue = filteredData.length > 0 ? Math.min(...filteredData) - 10 : 40;
  const maxValue = filteredData.length > 0 ? Math.max(...filteredData) + 10 : 120;
  const valueRange = maxValue - minValue;

  const getX = (index: number) => {
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    if (value === 0) return height - padding.bottom;
    return padding.top + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  // Create path for the line
  let pathD = '';
  let areaPathD = '';
  let firstValidIndex = -1;
  
  data.forEach((value, index) => {
    if (value > 0) {
      const x = getX(index);
      const y = getY(value);
      
      if (firstValidIndex === -1) {
        firstValidIndex = index;
        pathD = `M ${x} ${y}`;
        areaPathD = `M ${x} ${height - padding.bottom} L ${x} ${y}`;
      } else {
        pathD += ` L ${x} ${y}`;
        areaPathD += ` L ${x} ${y}`;
      }
    }
  });

  // Close area path
  if (firstValidIndex !== -1) {
    const lastValidIndex = data.length - 1 - [...data].reverse().findIndex(v => v > 0);
    areaPathD += ` L ${getX(lastValidIndex)} ${height - padding.bottom} Z`;
  }

  // Y-axis labels
  const yLabels = [minValue, Math.round((minValue + maxValue) / 2), maxValue];

  // X-axis labels (every 6 hours)
  const xLabels = ['12am', '6am', '12pm', '6pm', '12am'];

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yLabels.map((value, index) => (
          <Line
            key={`grid-${index}`}
            x1={padding.left}
            y1={getY(value)}
            x2={width - padding.right}
            y2={getY(value)}
            stroke={colors.border}
            strokeWidth="1"
            strokeDasharray="4,4"
          />
        ))}

        {/* Area fill */}
        {areaPathD && (
          <Path
            d={areaPathD}
            fill="url(#areaGradient)"
          />
        )}

        {/* Line */}
        {pathD && (
          <Path
            d={pathD}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Data points for last value */}
        {data.length > 0 && data[data.length - 1] > 0 && (
          <>
            <Circle
              cx={getX(data.length - 1)}
              cy={getY(data[data.length - 1])}
              r="6"
              fill={color}
            />
            <Circle
              cx={getX(data.length - 1)}
              cy={getY(data[data.length - 1])}
              r="3"
              fill={colors.background}
            />
          </>
        )}

        {/* Y-axis labels */}
        {showLabels && yLabels.map((value, index) => (
          <SvgText
            key={`y-label-${index}`}
            x={padding.left - 8}
            y={getY(value) + 4}
            fill={colors.textMuted}
            fontSize="10"
            textAnchor="end"
          >
            {value}
          </SvgText>
        ))}

        {/* X-axis labels */}
        {showLabels && xLabels.map((label, index) => (
          <SvgText
            key={`x-label-${index}`}
            x={padding.left + (index / (xLabels.length - 1)) * chartWidth}
            y={height - 8}
            fill={colors.textMuted}
            fontSize="10"
            textAnchor="middle"
          >
            {label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  noData: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});

export default HeartRateChart;





