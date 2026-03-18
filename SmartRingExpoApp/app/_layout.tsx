import '../src/i18n'; // i18n side-effect init — must be first
import { Platform } from 'react-native';
// Inject Figma capture script on web (removed after design capture)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const s = document.createElement('script');
  s.src = 'https://mcp.figma.com/mcp/html-to-design/capture.js';
  s.async = true;
  document.head.appendChild(s);
}
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { useFonts } from 'expo-font';
import { OnboardingProvider } from '../src/context/OnboardingContext';
import { HomeDataProvider } from '../src/context/HomeDataContext';
import { AddOverlayProvider } from '../src/context/AddOverlayContext';
import { MetricExplainerProvider } from '../src/context/MetricExplainerContext';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';

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
      <BottomSheetModalProvider>
      <OnboardingProvider>
        <HomeDataProvider>
        <MetricExplainerProvider>
        <AddOverlayProvider>
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
          <Stack.Screen name="detail/sleep-debt-detail" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="profile" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        </AddOverlayProvider>
        </MetricExplainerProvider>
        </HomeDataProvider>
      </OnboardingProvider>
      </BottomSheetModalProvider>
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
