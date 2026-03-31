import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { router } from 'expo-router';
import { useOnboarding } from '../src/context/OnboardingContext';

export default function Index() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();

  useEffect(() => {
    if (isLoading) return;

    // Hide native splash now that we know where to navigate
    SplashScreen.hideAsync();

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      router.replace('/(onboarding)/connect');
    } else {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  // Keep screen blank — native splash is still visible on top
  return <View style={styles.container} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
});
