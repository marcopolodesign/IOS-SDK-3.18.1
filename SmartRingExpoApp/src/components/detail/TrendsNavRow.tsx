import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { spacing, fontFamily } from '../../theme/colors';

interface Props {
  label: string;
  onPress: () => void;
}

export function TrendsNavRow({ label, onPress }: Props) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.text}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  text: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontFamily: fontFamily.regular,
  },
});
