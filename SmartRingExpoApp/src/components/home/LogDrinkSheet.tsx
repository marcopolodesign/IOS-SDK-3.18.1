import React, {
  useCallback, useRef, useState, forwardRef, useImperativeHandle, useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTranslation } from 'react-i18next';
import { fontFamily, spacing, borderRadius } from '../../theme/colors';
import { CAFFEINE_PRESETS, type DrinkPresetKey } from '../../utils/caffeinePk';

// ─── Scroll-wheel time picker ─────────────────────────────────────────────────

const ROW_H   = 44;
const VISIBLE = 3;           // odd — selected item is in the middle
const PAD     = ROW_H;       // top/bottom padding so first/last items can center

const HOURS   = ['1','2','3','4','5','6','7','8','9','10','11','12'];
const MINUTES = ['00','05','10','15','20','25','30','35','40','45','50','55'];
const PERIOD  = ['AM','PM'];

function WheelCol({
  items,
  selectedIndex,
  onChange,
  colWidth,
}: {
  items: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  colWidth: number;
}) {
  const ref = useRef<ScrollView>(null);
  const mounted = useRef(false);

  // Scroll to the selected row on mount (once) and when selectedIndex changes externally
  useEffect(() => {
    const animated = mounted.current;
    mounted.current = true;
    const y = selectedIndex * ROW_H;
    // Delay slightly so layout has settled before we scroll
    setTimeout(() => ref.current?.scrollTo({ y, animated }), animated ? 0 : 50);
  }, [selectedIndex]);

  const handleScrollEnd = useCallback((y: number) => {
    const i = Math.max(0, Math.min(Math.round(y / ROW_H), items.length - 1));
    onChange(i);
  }, [items.length, onChange]);

  return (
    <View style={{ width: colWidth, height: ROW_H * VISIBLE, overflow: 'hidden' }}>
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_H}
        decelerationRate="fast"
        scrollEventThrottle={16}
        nestedScrollEnabled
        contentContainerStyle={{ paddingVertical: PAD }}
        onMomentumScrollEnd={e => handleScrollEnd(e.nativeEvent.contentOffset.y)}
        onScrollEndDrag={e  => handleScrollEnd(e.nativeEvent.contentOffset.y)}
      >
        {items.map((item, i) => {
          const isSelected = i === selectedIndex;
          return (
            <TouchableOpacity
              key={item}
              style={wheelStyles.row}
              onPress={() => onChange(i)}
              activeOpacity={0.7}
            >
              <Text style={[
                wheelStyles.item,
                isSelected ? wheelStyles.itemSelected : wheelStyles.itemFaded,
              ]}>
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const wheelStyles = StyleSheet.create({
  row:          { height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  item:         { fontFamily: fontFamily.regular },
  itemSelected: { color: '#FFFFFF', fontSize: 22, fontFamily: fontFamily.demiBold },
  itemFaded:    { color: 'rgba(255,255,255,0.25)', fontSize: 18 },
});

function TimeWheelPicker({
  value,
  onChange,
}: {
  value: Date;
  onChange: (d: Date) => void;
}) {
  const h24     = value.getHours();
  const h12     = h24 % 12 || 12;
  const hourIdx = h12 - 1;                                         // 0-based in HOURS array
  const minIdx  = Math.min(Math.round(value.getMinutes() / 5), 11);
  const perIdx  = h24 >= 12 ? 1 : 0;

  const applyHour = useCallback((i: number) => {
    const d = new Date(value);
    // i+1 gives 1-12; map back to 24h preserving AM/PM
    const newH12 = i + 1;
    const newH24 = newH12 === 12 ? perIdx * 12 : newH12 + perIdx * 12;
    d.setHours(newH24, value.getMinutes(), 0, 0);
    onChange(d);
  }, [value, perIdx, onChange]);

  const applyMinute = useCallback((i: number) => {
    const d = new Date(value);
    d.setMinutes(i * 5, 0, 0);
    onChange(d);
  }, [value, onChange]);

  const applyPeriod = useCallback((i: number) => {
    const d = new Date(value);
    const cur = d.getHours();
    if (i === 0 && cur >= 12) d.setHours(cur - 12);
    if (i === 1 && cur < 12)  d.setHours(cur + 12);
    onChange(d);
  }, [value, onChange]);

  return (
    <View style={pickerStyles.wrapper}>
      {/* Selection highlight band */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={pickerStyles.selectionBand} />
      </View>

      <WheelCol items={HOURS}   selectedIndex={hourIdx} onChange={applyHour}   colWidth={68} />
      <View style={pickerStyles.separator}><Text style={pickerStyles.colon}>:</Text></View>
      <WheelCol items={MINUTES} selectedIndex={minIdx}  onChange={applyMinute} colWidth={68} />
      <WheelCol items={PERIOD}  selectedIndex={perIdx}  onChange={applyPeriod} colWidth={60} />
    </View>
  );
}

const pickerStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    height: ROW_H * VISIBLE,
  },
  selectionBand: {
    position: 'absolute',
    top: ROW_H,
    left: 0,
    right: 0,
    height: ROW_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  separator: { paddingBottom: 2 },
  colon: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 22,
    fontFamily: fontFamily.demiBold,
  },
});

// ─── Sheet handle types ────────────────────────────────────────────────────────

export interface LogDrinkSheetHandle {
  present: () => void;
  dismiss: () => void;
}

interface LogDrinkSheetProps {
  onLog: (drink: {
    drink_type: string;
    name?: string | null;
    caffeine_mg: number;
    consumed_at: string;
  }) => Promise<void>;
}

// ─── Main sheet ───────────────────────────────────────────────────────────────

export const LogDrinkSheet = forwardRef<LogDrinkSheetHandle, LogDrinkSheetProps>(
  function LogDrinkSheet({ onLog }, ref) {
    const { t } = useTranslation();
    const sheetRef = useRef<BottomSheetModal>(null);

    const [selectedKey, setSelectedKey] = useState<DrinkPresetKey>('coffee');
    const [customName, setCustomName]   = useState('');
    const [caffeineMg, setCaffeineMg]   = useState(95);
    const [consumedAt, setConsumedAt]   = useState(new Date());
    const [submitting, setSubmitting]   = useState(false);

    useImperativeHandle(ref, () => ({
      present: () => {
        setConsumedAt(new Date());
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const selectPreset = useCallback((key: DrinkPresetKey) => {
      const preset = CAFFEINE_PRESETS.find(p => p.key === key)!;
      setSelectedKey(key);
      setCaffeineMg(preset.defaultMg);
      setCustomName(key !== 'custom' ? t(`adenosine.preset.${key}`) : '');
    }, [t]);

    const handleSubmit = useCallback(async () => {
      if (submitting) return;
      setSubmitting(true);
      try {
        await onLog({
          drink_type:   selectedKey,
          name:         customName.trim() || t(`adenosine.preset.${selectedKey}`),
          caffeine_mg:  caffeineMg,
          consumed_at:  consumedAt.toISOString(),
        });
        sheetRef.current?.dismiss();
      } finally {
        setSubmitting(false);
      }
    }, [submitting, onLog, selectedKey, customName, caffeineMg, consumedAt, t]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={sheetRef}
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handle}
        backgroundStyle={styles.sheetBg}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        <BottomSheetView style={styles.container}>
          <Text style={styles.sheetTitle}>{t('adenosine.log.title')}</Text>

          {/* Preset grid */}
          <View style={styles.presetGrid}>
            {CAFFEINE_PRESETS.map(preset => {
              const active = selectedKey === preset.key;
              return (
                <TouchableOpacity
                  key={preset.key}
                  style={[styles.presetTile, active && styles.presetTileActive]}
                  onPress={() => selectPreset(preset.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.presetEmoji}>{preset.emoji}</Text>
                  <Text style={[styles.presetLabel, active && styles.presetLabelActive]} numberOfLines={1}>
                    {t(`adenosine.preset.${preset.key}`)}
                  </Text>
                  <Text style={[styles.presetMg, active && styles.presetMgActive]}>
                    {preset.defaultMg} mg
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Name input */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('adenosine.log.name_label')}</Text>
            <TextInput
              style={styles.textInput}
              value={customName}
              onChangeText={setCustomName}
              placeholder={t('adenosine.log.name_placeholder')}
              placeholderTextColor="rgba(255,255,255,0.3)"
              maxLength={60}
            />
          </View>

          {/* Caffeine mg stepper */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>
              {t('adenosine.log.mg_label')} ({t('adenosine.log.mg_unit')})
            </Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setCaffeineMg(m => Math.max(0, m - 5))}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepperValue}>{caffeineMg}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setCaffeineMg(m => Math.min(1000, m + 5))}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Time wheel picker */}
          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{t('adenosine.log.time_label')}</Text>
            <TimeWheelPicker value={consumedAt} onChange={setConsumedAt} />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.8}
            disabled={submitting}
          >
            <Text style={styles.submitBtnText}>{t('adenosine.log.submit')}</Text>
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheetBg: { backgroundColor: '#111118' },
  handle:  { backgroundColor: 'rgba(255,255,255,0.25)', width: 36 },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  sheetTitle: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 20,
    marginBottom: spacing.lg,
  },
  presetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  presetTile: {
    width: '30%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 4,
  },
  presetTileActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderColor: 'rgba(255,255,255,0.35)',
  },
  presetEmoji:      { fontSize: 22 },
  presetLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  presetLabelActive: { color: '#FFFFFF' },
  presetMg: {
    color: 'rgba(255,255,255,0.35)',
    fontFamily: fontFamily.regular,
    fontSize: 11,
  },
  presetMgActive: { color: 'rgba(255,255,255,0.65)' },
  fieldRow:   { marginBottom: spacing.md },
  fieldLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontFamily: fontFamily.regular,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontFamily: fontFamily.regular,
    fontSize: 16,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 52,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontFamily: fontFamily.regular,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 20,
  },
  submitBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: borderRadius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: {
    color: '#FFFFFF',
    fontFamily: fontFamily.demiBold,
    fontSize: 17,
  },
  bottomPad: { height: spacing.xl },
});
