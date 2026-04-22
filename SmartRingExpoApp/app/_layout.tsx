import '../src/i18n'; // i18n side-effect init — must be first
import '../src/services/BackgroundSleepTask'; // register background fetch task — must be top-level
import * as SplashScreen from 'expo-splash-screen';
import * as Sentry from '@sentry/react-native';

SplashScreen.preventAutoHideAsync();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: __DEV__ ? 1.0 : 0.3,
  _experiments: {
    profilesSampleRate: __DEV__ ? 1.0 : 0.1,
  },
  enableAutoSessionTracking: true,
  attachScreenshot: true,
  debug: false,
  enabled: true,
  beforeSend(event) {
    // Strip any auth tokens or sensitive strings from breadcrumb data
    if (Array.isArray(event.breadcrumbs?.values)) {
      event.breadcrumbs.values = event.breadcrumbs.values.map(crumb => {
        if (crumb.data) {
          const cleaned = { ...crumb.data };
          for (const key of Object.keys(cleaned)) {
            if (/token|password|secret|key/i.test(key)) {
              cleaned[key] = '[Filtered]';
            }
          }
          return { ...crumb, data: cleaned };
        }
        return crumb;
      });
    }
    return event;
  },
});
import { Platform } from 'react-native';
// Inject Figma capture script on web (removed after design capture)
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const s = document.createElement('script');
  s.src = 'https://mcp.figma.com/mcp/html-to-design/capture.js';
  s.async = true;
  document.head.appendChild(s);
}
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useEffect } from 'react';
import { OnboardingProvider } from '../src/context/OnboardingContext';
import { HomeDataProvider } from '../src/context/HomeDataContext';
import { AddOverlayProvider } from '../src/context/AddOverlayContext';
import { MetricExplainerProvider } from '../src/context/MetricExplainerContext';
import { BaselineModeProvider } from '../src/context/BaselineModeContext';
import { FocusDataProvider } from '../src/context/FocusDataContext';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import * as Notifications from 'expo-notifications';

// Must be at module scope so notifications display correctly when the app is backgrounded
// or before the React tree fully mounts. Using shouldShowBanner/shouldShowList (not the
// deprecated shouldShowAlert) to avoid the Expo warning.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function RootLayout() {
  // Handle notification taps → deeplink into the app
  useEffect(() => {
    // Tapped while app was running
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const url = response.notification.request.content.data?.url as string | undefined;
      if (!url) return;
      try {
        const parsed = new URL(url);
        const tab = parsed.searchParams.get('tab');
        if (tab) router.navigate({ pathname: '/', params: { tab } });
      } catch {}
    });

    // Tapped when app was killed — check last response on launch
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return;
      const url = response.notification.request.content.data?.url as string | undefined;
      if (!url) return;
      try {
        const parsed = new URL(url);
        const tab = parsed.searchParams.get('tab');
        if (tab) router.navigate({ pathname: '/', params: { tab } });
      } catch {}
    });

    return () => { sub.remove(); };
  }, []);

  const [fontsLoaded, fontError] = useFonts({
    'TT-Interphases-Pro-Regular': require('../assets/fonts/TT_Interphases_Pro_Regular.ttf'),
    'TT-Interphases-Pro-DemiBold': require('../assets/fonts/TT_Interphases_Pro_DemiBold.ttf'),
  });

  // Splash hide is deferred to index.tsx once onboarding state resolves
  useEffect(() => {
    if (fontError) {
      console.warn('[RootLayout] Font loading error, proceeding anyway:', fontError);
    }
  }, [fontError]);

  // Safety timeout — never let splash hang more than 5s
  useEffect(() => {
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  // Keep native splash visible while fonts load
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <BottomSheetModalProvider>
      <OnboardingProvider>
        <HomeDataProvider>
        <BaselineModeProvider>
        <FocusDataProvider>
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
          <Stack.Screen name="chat" options={{ presentation: 'fullScreenModal', headerShown: false }} />
          <Stack.Screen name="settings" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="profile" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        </AddOverlayProvider>
        </MetricExplainerProvider>
        </FocusDataProvider>
        </BaselineModeProvider>
        </HomeDataProvider>
      </OnboardingProvider>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
