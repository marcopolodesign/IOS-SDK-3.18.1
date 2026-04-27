import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily } from '../../theme/colors';

export function TrendSubStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

export function TrendSubStatDivider() {
  return <View style={styles.divider} />;
}

/** Renders the baseline comparison string right-aligned in the card title row. */
export function TrendHeaderRight({ text }: { text: string }) {
  return (
    <View style={styles.headerRight}>
      <Text style={styles.headerRightText} numberOfLines={1}>{text}</Text>
      <Ionicons name="chevron-forward" size={13} color="rgba(255,255,255,0.35)" />
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  value: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 18,
  },
  label: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  headerRightText: {
    color: 'rgba(255,255,255,0.55)',
    fontFamily: fontFamily.regular,
    fontSize: 12,
  },
});
