import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { OnboardingProvider } from '../src/context/OnboardingContext';
import { HomeDataProvider } from '../src/context/HomeDataContext';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'TT-Interphases-Pro-Regular': require('../assets/fonts/TT_Interphases_Pro_Regular.ttf'),
    'TT-Interphases-Pro-DemiBold': require('../assets/fonts/TT_Interphases_Pro_DemiBold.ttf'),
  });

  // Show loading indicator while fonts are loading
  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <OnboardingProvider>
        <HomeDataProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(onboarding)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="testing" />
          <Stack.Screen name="detail/sleep-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/heart-rate-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/hrv-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/spo2-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/temperature-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/activity-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="detail/recovery-detail" options={{ animation: 'slide_from_right' }} />
        </Stack>
        </HomeDataProvider>
      </OnboardingProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
