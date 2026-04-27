import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { fontFamily, spacing, borderRadius } from '../../theme/colors';
import type { RangeMode } from '../../screens/trendsDetail/domains';

interface Props {
  mode: RangeMode;
  onChange: (m: RangeMode) => void;
}

const TABS: { key: RangeMode; labelKey: string }[] = [
  { key: 'daily', labelKey: 'trends_detail.range.daily' },
  { key: 'weekly', labelKey: 'trends_detail.range.weekly' },
  { key: 'monthly', labelKey: 'trends_detail.range.monthly' },
];

export function RangeModeTabs({ mode, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const active = mode === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, active && styles.tabActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, active && styles.labelActive]}>
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 3,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.full,
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  label: {
    fontFamily: fontFamily.regular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.2,
  },
  labelActive: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
  },
});
