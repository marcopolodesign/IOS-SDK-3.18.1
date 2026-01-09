import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, fontSize, shadows } from '../theme/colors';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  color?: string;
  subtitle?: string;
  onPress?: () => void;
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  animated?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  color = colors.primary,
  subtitle,
  onPress,
  size = 'medium',
  style,
  animated = true,
}) => {
  const valueRef = useRef(value);
  
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const cardStyle = [
    styles.card,
    size === 'small' && styles.cardSmall,
    size === 'large' && styles.cardLarge,
    style,
  ];

  const valueStyle = [
    styles.value,
    size === 'small' && styles.valueSmall,
    size === 'large' && styles.valueLarge,
    { color },
  ];

  const content = (
    <View style={cardStyle}>
      <View style={styles.header}>
        {icon && <View style={[styles.iconContainer, { backgroundColor: `${color}20` }]}>{icon}</View>}
        <Text style={styles.title}>{title}</Text>
      </View>
      
      <View style={styles.valueContainer}>
        <Text style={valueStyle}>{value}</Text>
        {unit && <Text style={[styles.unit, { color }]}>{unit}</Text>}
      </View>
      
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      
      <View style={[styles.glow, { backgroundColor: `${color}15` }]} />
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minWidth: 150,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.md,
  },
  cardSmall: {
    padding: spacing.sm,
    minWidth: 100,
  },
  cardLarge: {
    padding: spacing.lg,
    minWidth: 200,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  title: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  value: {
    fontSize: fontSize.xxxl,
    fontWeight: '700',
    color: colors.primary,
  },
  valueSmall: {
    fontSize: fontSize.xxl,
  },
  valueLarge: {
    fontSize: fontSize.display,
  },
  unit: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginLeft: spacing.xs,
    opacity: 0.8,
  },
  subtitle: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  glow: {
    position: 'absolute',
    bottom: -30,
    right: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
});

export default MetricCard;





