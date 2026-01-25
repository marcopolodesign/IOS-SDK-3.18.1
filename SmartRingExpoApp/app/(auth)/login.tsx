import React, { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { AuthScreen } from '../../src/screens/AuthScreen';
import { useOnboarding } from '../../src/context/OnboardingContext';

export default function LoginScreen() {
  const { isAuthenticated, hasConnectedDevice, isLoading } = useOnboarding();
  const hasNavigated = useRef(false);

  useEffect(() => {
    // Prevent double navigation
    if (hasNavigated.current) return;

    // Wait for loading to complete
    if (isLoading) return;

    if (isAuthenticated) {
      hasNavigated.current = true;
      console.log('🚀 LoginScreen: Authenticated, navigating...', { hasConnectedDevice });

      // Use setTimeout to ensure state has settled before navigation
      setTimeout(() => {
        if (hasConnectedDevice) {
          router.replace('/(tabs)');
        } else {
          router.replace('/(onboarding)/connect');
        }
      }, 0);
    }
  }, [isAuthenticated, hasConnectedDevice, isLoading]);

  return <AuthScreen />;
}
