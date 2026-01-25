import { useLayoutEffect } from 'react';
import { Stack, router } from 'expo-router';
import { useOnboarding } from '../../src/context/OnboardingContext';

export default function OnboardingLayout() {
  const { isAuthenticated, isLoading } = useOnboarding();

  useLayoutEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="connect" />
      <Stack.Screen name="success" />
    </Stack>
  );
}
