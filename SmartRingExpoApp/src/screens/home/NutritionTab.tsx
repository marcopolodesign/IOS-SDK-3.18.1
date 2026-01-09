import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { spacing, fontSize } from '../../theme/colors';

// Apple icon for nutrition
function AppleIcon() {
  return (
    <Svg width={80} height={80} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C12 2 10.5 2 9 3.5C7.5 5 7 6.5 7 8C5.5 8 4 9 4 11C4 13 5.5 15 7 17C8.5 19 10 21 12 21C14 21 15.5 19 17 17C18.5 15 20 13 20 11C20 9 18.5 8 17 8C17 6.5 16.5 5 15 3.5C13.5 2 12 2 12 2Z"
        fill="rgba(255, 255, 255, 0.3)"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1.5}
      />
      <Path
        d="M12 2C12 2 13 4 13 5C13 6 12 7 12 7"
        stroke="rgba(255, 255, 255, 0.5)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={9} cy={12} r={1} fill="rgba(255, 255, 255, 0.4)" />
    </Svg>
  );
}

// Coming soon badge
function ComingSoonBadge() {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>COMING SOON</Text>
    </View>
  );
}

export function NutritionTab() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>
          <AppleIcon />
        </View>

        {/* Badge */}
        <ComingSoonBadge />

        {/* Title */}
        <Text style={styles.title}>Nutrition Tracking</Text>

        {/* Description */}
        <Text style={styles.description}>
          Track your meals, macros, and nutrition goals. Get personalized insights based on your activity and sleep data.
        </Text>

        {/* Feature list */}
        <View style={styles.featureList}>
          <FeatureItem title="Calorie Tracking" description="Log meals and track daily intake" />
          <FeatureItem title="Macro Goals" description="Set protein, carb, and fat targets" />
          <FeatureItem title="AI Recommendations" description="Get personalized meal suggestions" />
          <FeatureItem title="Recovery Nutrition" description="Optimize post-workout meals" />
        </View>

        {/* Notify button placeholder */}
        <View style={styles.notifyButton}>
          <Text style={styles.notifyText}>🔔 Get Notified When Available</Text>
        </View>
      </View>
    </View>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureDot} />
      <View>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: 'rgba(139, 0, 0, 0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: spacing.lg,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  description: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  featureList: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  featureDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B0000',
    marginTop: 6,
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  featureDescription: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  notifyButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  notifyText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});

export default NutritionTab;


