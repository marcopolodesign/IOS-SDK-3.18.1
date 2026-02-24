import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ViewStyle,
  ImageSourcePropType,
} from 'react-native';
import { TouchableOpacity } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { spacing, fontFamily } from '../../theme/colors';

type GradientInfoCardProps = {
  icon: React.ReactNode;
  title: string;
  headerValue?: string | number;
  headerSubtitle?: string;
  showArrow?: boolean;
  backgroundImage?: ImageSourcePropType;
  gradientStops?: { offset: number; color: string; opacity?: number }[];
  gradientCenter?: { x: number; y: number }; // 0-1 range, can be negative for off-canvas centers
  gradientRadii?: { rx: string; ry: string };
  style?: ViewStyle;
  onHeaderPress?: () => void;
  children: React.ReactNode;
};

/**
 * Reusable card with a gradient (or image) backdrop + header and flexible body.
 * Header shows an icon, title, and optional hyperlink (arrow appears only when provided).
 */
export function GradientInfoCard({
  icon,
  title,
  headerValue,
  headerSubtitle,
  showArrow = true,
  backgroundImage,
  gradientStops = [
    // { offset: 0, color: '#7100C2', opacity: 1 },
    // { offset: 0.55, color: '#7100C2', opacity: 0 },
  ],
  gradientCenter = { x: 0.51, y: -0.86 },
  gradientRadii = { rx: '80%', ry: '300%' },
  style,
  onHeaderPress,
  children,
}: GradientInfoCardProps) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.background}>
        {backgroundImage ? (
          <ImageBackground
            source={backgroundImage}
            imageStyle={styles.backgroundImage}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
            <Defs>
              <RadialGradient
                id="radialGradient"
                cx={`${gradientCenter.x * 100}%`}
                cy={`${gradientCenter.y * 100}%`}
                rx={gradientRadii.rx}
                ry={gradientRadii.ry}
              >
                {gradientStops.map(stop => (
                  <Stop
                    key={stop.offset}
                    offset={`${stop.offset * 100}%`}
                    stopColor={stop.color}
                    stopOpacity={stop.opacity ?? 1}
                  />
                ))}
              </RadialGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill="url(#radialGradient)" />
          </Svg>
        )}

        <View style={styles.overlay}>
          {onHeaderPress ? (
            <TouchableOpacity style={styles.header} onPress={onHeaderPress} activeOpacity={0.7}>
              <View style={styles.headerLeft}>
                <View style={styles.iconWrapper}>{icon}</View>
                <Text style={styles.title}>{title}</Text>
                {showArrow && <Text style={styles.linkArrow}>{'>'}</Text>}
              </View>
            </TouchableOpacity>
          ) : (
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconWrapper}>{icon}</View>
                <Text style={styles.title}>{title}</Text>
                {showArrow && <Text style={styles.linkArrow}>{'>'}</Text>}
              </View>
            </View>
          )}

          {(headerValue !== undefined || headerSubtitle) && (
            <View style={styles.headerValueBlock}>
              {headerValue !== undefined && (
                <Text style={styles.headerValueText}>{headerValue}</Text>
              )}
              {headerSubtitle ? (
                <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
              ) : null}
            </View>
          )}

          <View style={styles.contentContainer}>{children}</View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000'
  },
  background: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  backgroundImage: {
    borderRadius: 20,
  },
  overlay: {
    gap: spacing.md,
    // paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    // paddingBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  title: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontFamily: fontFamily.regular,
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    
  },
  linkArrow: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontFamily: fontFamily.demiBold,
    fontSize: 16,
  },
  headerValueBlock: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  headerValueText: {
    color: 'white',
    fontFamily: fontFamily.regular,
    fontSize: 48,
    fontWeight: '100',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: fontFamily.regular,
    fontSize: 18,
    // marginBottom: 0,
  },
  contentContainer: {
    backgroundColor: '#222',
    borderRadius: 16,
    borderTopRightRadius: 0,
    borderTopLeftRadius: 0,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
});

export default GradientInfoCard;
