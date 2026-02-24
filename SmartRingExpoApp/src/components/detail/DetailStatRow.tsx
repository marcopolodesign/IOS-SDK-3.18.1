import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  LayoutAnimation,
  StyleSheet,
} from 'react-native';
import { fontFamily, fontSize, spacing } from '../../theme/colors';

interface DetailStatRowProps {
  title: string;
  value: string;
  unit?: string;
  icon?: React.ReactNode;
  accent?: string;
  expandable?: boolean;
  expandedContent?: React.ReactNode;
  badge?: { label: string; color: string };
}

export function DetailStatRow({
  title,
  value,
  unit,
  icon,
  accent,
  expandable = false,
  expandedContent,
  badge,
}: DetailStatRowProps) {
  const [expanded, setExpanded] = useState(false);

  const handlePress = () => {
    if (!expandable) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(prev => !prev);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={expandable ? 0.7 : 1}
      style={styles.wrapper}
    >
      {accent && <View style={[styles.accentBar, { backgroundColor: accent }]} />}
      <View style={styles.row}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.textBlock}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.valueRow}>
            <Text style={styles.value}>{value}</Text>
            {unit && <Text style={styles.unit}> {unit}</Text>}
            {badge && (
              <View style={[styles.badge, { backgroundColor: `${badge.color}22`, borderColor: `${badge.color}55` }]}>
                <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            )}
          </View>
        </View>
        {expandable && (
          <Text style={styles.chevron}>{expanded ? '∧' : '∨'}</Text>
        )}
      </View>
      {expandable && expanded && expandedContent && (
        <View style={styles.expandedContent}>{expandedContent}</View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    borderRadius: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap',
  },
  value: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  unit: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 4,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: fontFamily.demiBold,
  },
  chevron: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  expandedContent: {
    paddingTop: spacing.sm,
    paddingLeft: 40,
  },
});

export default DetailStatRow;
