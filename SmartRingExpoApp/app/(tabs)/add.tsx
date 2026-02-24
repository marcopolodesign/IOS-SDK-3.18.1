import { useCallback } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useAddOverlay } from '../../src/context/AddOverlayContext';

export default function AddTab() {
  const { showOverlay } = useAddOverlay();

  // useFocusEffect only fires when this tab becomes focused (not on initial mount)
  // This prevents the overlay from showing on app load
  useFocusEffect(
    useCallback(() => {
      showOverlay();
      // Defer popping the placeholder tab so the overlay appears without flashing the blank screen
      requestAnimationFrame(() => {
        if (router.canGoBack()) {
          router.back();
        }
      });
    }, [showOverlay])
  );

  return <View />;
}
