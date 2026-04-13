import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackArrow } from './BackArrow';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

interface DetailPageHeaderProps {
  title: string;
  rightElement?: React.ReactNode;
  /** Extra bottom margin below the header. Default: 0. */
  marginBottom?: number;
  /**
   * When true (default), adds insets.top to paddingTop.
   * Set to false for pages where the parent container already applies insets.
   */
  useSafeArea?: boolean;
}

export function DetailPageHeader({
  title,
  rightElement,
  marginBottom = 0,
  useSafeArea = true,
}: DetailPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const paddingTop = useSafeArea ? insets.top + spacing.sm : spacing.sm;

  return (
    <View style={[styles.header, { paddingTop, marginBottom }]}>
      <TouchableOpacity
        onPress={() => router.back()}
        style={styles.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <BackArrow />
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.headerRight}>{rightElement}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { padding: spacing.xs },
  title: { color: '#FFFFFF', fontSize: fontSize.lg, fontFamily: fontFamily.demiBold },
  headerRight: { width: 40 },
});
