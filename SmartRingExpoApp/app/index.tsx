import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useOnboarding } from '../src/context/OnboardingContext';

export default function Index() {
  const { isLoading, isAuthenticated, hasConnectedDevice } = useOnboarding();

  // Debug logging
  console.log('🔄 Index: isLoading=', isLoading, 'isAuthenticated=', isAuthenticated, 'hasConnectedDevice=', hasConnectedDevice);

  useEffect(() => {
    console.log('🔄 Index useEffect: isLoading=', isLoading, 'isAuthenticated=', isAuthenticated, 'hasConnectedDevice=', hasConnectedDevice);
    
    if (isLoading) {
      console.log('⏳ Still loading, waiting...');
      return;
    }

    if (!isAuthenticated) {
      // Not logged in - go to auth
      console.log('🔐 Not authenticated, going to login');
      router.replace('/(auth)/login');
    } else if (!hasConnectedDevice) {
      // Logged in but no device - go to device setup
      console.log('📱 No device connected, going to device setup');
      router.replace('/(onboarding)/connect');
    } else {
      // Fully onboarded - go to main app
      console.log('✅ Fully onboarded, going to tabs');
      router.replace('/(tabs)');
    }
  }, [isLoading, isAuthenticated, hasConnectedDevice]);

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

