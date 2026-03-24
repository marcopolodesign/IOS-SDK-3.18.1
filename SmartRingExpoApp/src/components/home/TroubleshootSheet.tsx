import { memo, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface TroubleshootSheetProps {
  visible: boolean;
  onDismiss: () => void;
}

const TIPS = [
  'onboarding.troubleshoot_tip_1',
  'onboarding.troubleshoot_tip_2',
  'onboarding.troubleshoot_tip_3',
  'onboarding.troubleshoot_tip_4',
  'onboarding.troubleshoot_tip_5',
] as const;

export const TroubleshootSheet = memo(function TroubleshootSheet({
  visible,
  onDismiss,
}: TroubleshootSheetProps) {
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
    return () => { modalRef.current?.dismiss(); };
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.65}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onDismiss}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.iconWrapper}>
          <Ionicons name="bluetooth" size={28} color="#fff" />
        </View>

        <Text style={styles.title}>{t('onboarding.troubleshoot_title')}</Text>

        <View style={styles.tipsList}>
          {TIPS.map((key, i) => (
            <View key={key} style={styles.tipRow}>
              <Text style={styles.tipNumber}>{i + 1}</Text>
              <Text style={styles.tipText}>{t(key)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.button}
          onPress={() => modalRef.current?.dismiss()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>{t('onboarding.troubleshoot_dismiss')}</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 36,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 40,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  tipsList: {
    width: '100%',
    gap: 14,
    marginBottom: 28,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  tipNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
    width: 20,
    textAlign: 'center',
    lineHeight: 22,
  },
  tipText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
    flex: 1,
  },
  button: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
