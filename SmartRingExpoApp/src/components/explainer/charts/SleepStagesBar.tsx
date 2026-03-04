import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const STAGES = [
  { label: 'Light', pct: 50, color: '#60A5FA' },
  { label: 'Deep', pct: 25, color: '#3B38C9' },
  { label: 'REM', pct: 20, color: '#8B5CF6' },
  { label: 'Awake', pct: 5, color: 'rgba(255,255,255,0.3)' },
];

export function SleepStagesBar() {
  return (
    <View style={styles.container}>
      {/* Stacked bar */}
      <View style={styles.bar}>
        {STAGES.map((s) => (
          <View
            key={s.label}
            style={[styles.segment, { flex: s.pct, backgroundColor: s.color }]}
          />
        ))}
      </View>

      {/* Labels */}
      <View style={styles.labelsRow}>
        {STAGES.map((s) => (
          <View key={s.label} style={[styles.labelItem, { flex: s.pct }]}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.labelText}>{s.label}</Text>
            <Text style={styles.pctText}>{s.pct}%</Text>
          </View>
        ))}
      </View>
      <Text style={styles.note}>Illustrative — typical adult distribution</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  bar: {
    flexDirection: 'row',
    height: 20,
    borderRadius: 4,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  labelItem: {
    alignItems: 'center',
    gap: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  labelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '600',
  },
  pctText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
  },
  note: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});

export default SleepStagesBar;
