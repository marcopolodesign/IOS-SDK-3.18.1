import React, { useCallback, useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useMetricExplainer } from '../../context/MetricExplainerContext';
import { ExplainerSheetContent } from './ExplainerSheetContent';

export function ExplainerSheet() {
  const { isOpen, closeExplainer, activeKey } = useMetricExplainer();
  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [isOpen]);

  const handleDismiss = useCallback(() => {
    closeExplainer();
  }, [closeExplainer]);

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
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
      maxDynamicContentSize={700}
    >
      <BottomSheetView>
        {activeKey && (
          <ExplainerSheetContent metricKey={activeKey} onClose={() => modalRef.current?.dismiss()} />
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

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
});

export default ExplainerSheet;
