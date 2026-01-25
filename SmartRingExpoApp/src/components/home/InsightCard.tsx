import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { spacing, fontSize, borderRadius, fontFamily } from '../../theme/colors';

type InsightType = 'sleep' | 'activity' | 'nutrition' | 'general';

interface InsightCardProps {
  insight: string;
  type?: InsightType;
  onPress?: () => void;
  title?: string;
}

// AI Sparkle icon
function SparkleIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5L12 2Z"
        fill="#FFFFFF"
      />
      <Circle cx={18} cy={5} r={1.5} fill="#FFFFFF" opacity={0.6} />
      <Circle cx={6} cy={17} r={1} fill="#FFFFFF" opacity={0.6} />
    </Svg>
  );
}

const gradientColors: Record<InsightType, [string, string]> = {
  sleep: ['#6366F1', '#4F46E5'],
  activity: ['#FF6B35', '#DC2626'],
  nutrition: ['#10B981', '#059669'],
  general: ['#3B82F6', '#1D4ED8'],
};

export function InsightCard({
  insight,
  type = 'general',
  onPress,
  title = 'AI Insight',
}: InsightCardProps) {
  const colors = gradientColors[type];

  const content = (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <SparkleIcon />
        </View>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.insight}>{insight}</Text>
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Preview card for showing sleep/activity summary
export function PreviewCard({
  title,
  subtitle,
  value,
  unit,
  icon,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value: number | string;
  unit?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.previewContainer}>
      <View style={styles.previewLeft}>
        {icon && <View style={styles.previewIcon}>{icon}</View>}
        <View>
          <Text style={styles.previewTitle}>{title}</Text>
          {subtitle && <Text style={styles.previewSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <View style={styles.previewRight}>
        <Text style={styles.previewValue}>
          {value}
          {unit && <Text style={styles.previewUnit}>{unit}</Text>}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

// Moon icon for sleep
export function MoonIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        fill="#BB6DF3"
      />
    </Svg>
  );
}

// Activity rings icon
export function ActivityRingsIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={10} stroke="#FF6B35" strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={7} stroke="#4ADE80" strokeWidth={2} fill="none" />
      <Circle cx={12} cy={12} r={4} stroke="#3B82F6" strokeWidth={2} fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  insight: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    lineHeight: 24,
    fontFamily: fontFamily.regular,
  },
  // Preview card styles
  previewContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  previewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  previewSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  previewRight: {
    alignItems: 'flex-end',
  },
  previewValue: {
    color: '#FFFFFF',
    fontSize: fontSize.xl,
    fontFamily: fontFamily.demiBold,
  },
  previewUnit: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default InsightCard;


