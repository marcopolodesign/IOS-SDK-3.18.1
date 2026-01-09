import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { borderRadius, spacing } from '../../theme/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
  variant?: 'default' | 'stats' | 'insight';
}

export function GlassCard({ 
  children, 
  style, 
  noPadding = false,
  variant = 'default',
}: GlassCardProps) {
  const cardStyle = [
    styles.container,
    variant === 'stats' && styles.statsVariant,
    variant === 'insight' && styles.insightVariant,
    !noPadding && styles.padding,
    style,
  ];

  return (
    <View style={cardStyle}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  padding: {
    padding: spacing.lg,
  },
  statsVariant: {
    borderRadius: borderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  insightVariant: {
    borderRadius: borderRadius.xl,
    borderColor: 'transparent',
  },
});

export default GlassCard;
