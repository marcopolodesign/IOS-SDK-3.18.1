import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

interface FirmwareUpdateSheetProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  onDismiss: () => void;
}

export function FirmwareUpdateSheet({
  visible,
  currentVersion,
  latestVersion,
  onDismiss,
}: FirmwareUpdateSheetProps) {
  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible]);

  const handleDismiss = useCallback(() => {
    onDismiss();
  }, [onDismiss]);

  const handleChange = useCallback((_from: number, toIndex: number) => {
    if (toIndex >= 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

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
      onDismiss={handleDismiss}
      onAnimate={handleChange}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleComponent={null}
      handleStyle={styles.handle}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.iconWrapper}>
          <Text style={styles.icon}>💍</Text>
        </View>

        <Text style={styles.title}>Ring Update Available</Text>

        <Text style={styles.body}>
          Your ring is running v{currentVersion}. Version {latestVersion} is available.{'\n'}
          Use the Jstyle companion app to update your ring.
        </Text>

        <TouchableOpacity
          style={styles.button}
          onPress={() => modalRef.current?.dismiss()}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>Update Later</Text>
        </TouchableOpacity>
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handle: {
    height: 0,
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
  icon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
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

export default FirmwareUpdateSheet;
