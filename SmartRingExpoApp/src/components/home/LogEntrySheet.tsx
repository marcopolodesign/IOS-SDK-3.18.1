import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import type { TimelineEntry, RecoverySubtype, MealSubtype } from '../../types/timeline.types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LogEntrySheetProps {
  visible: boolean;
  mode: 'recovery' | 'meal' | 'activity' | null;
  onClose: () => void;
  onSave: (entry: Omit<TimelineEntry, 'id'>) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseTimeToMs(hhMM: string): number {
  const [hStr, mStr] = hhMM.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr ?? '0', 10);
  if (isNaN(h) || isNaN(m)) return Date.now();
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

// ─── Chip subcomponent ────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

function Chip({ label, selected, onPress }: ChipProps) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ─── Label ────────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

// ─── Main component ───────────────────────────────────────────────────────────

const SHEET_HEIGHT = 420;

export default function LogEntrySheet({ visible, mode, onClose, onSave }: LogEntrySheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SHEET_HEIGHT)).current;

  // Recovery state
  const [recoverySubtype, setRecoverySubtype] = useState<RecoverySubtype>('sauna');
  const [recoveryTime, setRecoveryTime] = useState(nowHHMM());
  const [recoveryDuration, setRecoveryDuration] = useState('');

  // Meal state
  const [mealSubtype, setMealSubtype] = useState<MealSubtype>('breakfast');
  const [mealTime, setMealTime] = useState(nowHHMM());

  // Activity state
  const [activityName, setActivityName] = useState('');
  const [activityTime, setActivityTime] = useState(nowHHMM());
  const [activityDuration, setActivityDuration] = useState('');

  useEffect(() => {
    if (visible) {
      // Reset time fields to current time on open
      const now = nowHHMM();
      setRecoveryTime(now);
      setMealTime(now);
      setActivityTime(now);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SHEET_HEIGHT,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleSave = useCallback(() => {
    const date = todayDateString();

    if (mode === 'recovery') {
      const subtypeLabels: Record<RecoverySubtype, string> = {
        sauna: t('log_entry.subtype_sauna'),
        ice_bath: t('log_entry.subtype_ice_bath'),
        compression_boots: t('log_entry.subtype_boots'),
        other: t('log_entry.subtype_recovery'),
      };
      const startMs = parseTimeToMs(recoveryTime);
      const durationMs = recoveryDuration
        ? parseInt(recoveryDuration, 10) * 60000
        : 0;
      onSave({
        date,
        type: 'recovery',
        subtype: recoverySubtype,
        title: subtypeLabels[recoverySubtype],
        startTime: startMs,
        endTime: durationMs > 0 ? startMs + durationMs : undefined,
      });
    } else if (mode === 'meal') {
      const subtypeLabels: Record<MealSubtype, string> = {
        breakfast: t('log_entry.subtype_breakfast'),
        lunch: t('log_entry.subtype_lunch'),
        dinner: t('log_entry.subtype_dinner'),
        snack: t('log_entry.subtype_snack'),
      };
      onSave({
        date,
        type: 'meal',
        subtype: mealSubtype,
        title: subtypeLabels[mealSubtype],
        startTime: parseTimeToMs(mealTime),
      });
    } else if (mode === 'activity') {
      const startMs = parseTimeToMs(activityTime);
      const durationMs = activityDuration
        ? parseInt(activityDuration, 10) * 60000
        : 0;
      onSave({
        date,
        type: 'manual_activity',
        subtype: 'manual',
        title: activityName.trim() || t('log_entry.default_activity'),
        startTime: startMs,
        endTime: durationMs > 0 ? startMs + durationMs : undefined,
      });
    }

    onClose();
  }, [mode, recoverySubtype, recoveryTime, recoveryDuration, mealSubtype, mealTime, activityName, activityTime, activityDuration, onSave, onClose]);

  const modeTitle = mode === 'recovery' ? t('log_entry.header_recovery') : mode === 'meal' ? t('log_entry.header_meal') : t('log_entry.header_activity');

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalWrapper}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + spacing.lg, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />

          <View style={styles.sheetContent}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.title}>{modeTitle}</Text>
              <Pressable onPress={onClose} hitSlop={12}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {mode === 'recovery' && (
                <>
                  <FieldLabel>{t('log_entry.type_label')}</FieldLabel>
                  <View style={styles.chipRow}>
                    {(['sauna', 'ice_bath', 'compression_boots', 'other'] as RecoverySubtype[]).map(
                      (sub) => (
                        <Chip
                          key={sub}
                          label={
                            sub === 'sauna' ? t('log_entry.subtype_sauna') :
                            sub === 'ice_bath' ? t('log_entry.subtype_ice_bath') :
                            sub === 'compression_boots' ? t('log_entry.subtype_boots_chip') :
                            t('log_entry.subtype_recovery')
                          }
                          selected={recoverySubtype === sub}
                          onPress={() => setRecoverySubtype(sub)}
                        />
                      )
                    )}
                  </View>

                  <FieldLabel>{t('log_entry.start_time_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={recoveryTime}
                    onChangeText={setRecoveryTime}
                    placeholder={t('log_entry.start_time_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="numbers-and-punctuation"
                    keyboardAppearance="dark"
                  />

                  <FieldLabel>{t('log_entry.duration_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={recoveryDuration}
                    onChangeText={setRecoveryDuration}
                    placeholder={t('log_entry.duration_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    keyboardAppearance="dark"
                  />
                </>
              )}

              {mode === 'meal' && (
                <>
                  <FieldLabel>{t('log_entry.meal_label')}</FieldLabel>
                  <View style={styles.chipRow}>
                    {(['breakfast', 'lunch', 'dinner', 'snack'] as MealSubtype[]).map((sub) => (
                      <Chip
                        key={sub}
                        label={
                          sub === 'breakfast' ? t('log_entry.subtype_breakfast') :
                          sub === 'lunch' ? t('log_entry.subtype_lunch') :
                          sub === 'dinner' ? t('log_entry.subtype_dinner') :
                          t('log_entry.subtype_snack')
                        }
                        selected={mealSubtype === sub}
                        onPress={() => setMealSubtype(sub)}
                      />
                    ))}
                  </View>

                  <FieldLabel>{t('log_entry.time_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={mealTime}
                    onChangeText={setMealTime}
                    placeholder={t('log_entry.time_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="numbers-and-punctuation"
                    keyboardAppearance="dark"
                  />
                </>
              )}

              {mode === 'activity' && (
                <>
                  <FieldLabel>{t('log_entry.activity_name_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={activityName}
                    onChangeText={setActivityName}
                    placeholder={t('log_entry.activity_name_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardAppearance="dark"
                  />

                  <FieldLabel>{t('log_entry.start_time_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={activityTime}
                    onChangeText={setActivityTime}
                    placeholder={t('log_entry.activity_time_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="numbers-and-punctuation"
                    keyboardAppearance="dark"
                  />

                  <FieldLabel>{t('log_entry.duration_label')}</FieldLabel>
                  <TextInput
                    style={styles.input}
                    value={activityDuration}
                    onChangeText={setActivityDuration}
                    placeholder={t('log_entry.activity_duration_placeholder')}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    keyboardType="number-pad"
                    keyboardAppearance="dark"
                  />
                </>
              )}

              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveText}>{t('log_entry.save')}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  sheetContent: {
    padding: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontFamily: fontFamily.demiBold,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  chipSelected: {
    borderColor: '#6B8EFF',
    backgroundColor: 'rgba(107,142,255,0.18)',
  },
  chipText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  saveButton: {
    marginTop: spacing.xl,
    backgroundColor: '#6B8EFF',
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
});
