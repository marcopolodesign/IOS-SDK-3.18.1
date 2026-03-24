import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useOnboarding } from '../src/context/OnboardingContext';

export default function Index() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      router.replace('/(onboarding)/connect');
    } else {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  // Show loading while checking state
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
  },
});
