import { Stack } from 'expo-router';

export default function TodayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="overview" />
      <Stack.Screen name="sleep" />
      <Stack.Screen name="nutrition" />
      <Stack.Screen name="activity" />
    </Stack>
  );
}


