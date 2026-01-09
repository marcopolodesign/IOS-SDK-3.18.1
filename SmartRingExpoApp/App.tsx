import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, StatusBar, Platform, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Svg, { Path, Circle } from 'react-native-svg';

import { DevicesScreen, SettingsScreen, AuthScreen } from './src/screens';
import AppleHealthScreen from './src/screens/AppleHealthScreen';
import NewHomeScreen from './src/screens/NewHomeScreen';
import { colors } from './src/theme/colors';
import { useAuth } from './src/hooks/useAuth';

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
          <Text style={{ color: colors.error, fontSize: 18, marginBottom: 10 }}>App Error</Text>
          <Text style={{ color: colors.text, fontSize: 14, textAlign: 'center' }}>
            {this.state.error?.message || 'Unknown error'}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const Tab = createBottomTabNavigator();

// Only use native driver on iOS/Android, not on web
const useNativeDriver = Platform.OS !== 'web';

// Custom dark theme for navigation
const DarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    background: 'transparent',
    card: 'rgba(0, 0, 0, 0.9)',
    text: colors.text,
    border: 'rgba(255, 255, 255, 0.1)',
    notification: colors.secondary,
  },
};

// Animated Tab Bar Icon
const AnimatedTabIcon: React.FC<{
  focused: boolean;
  icon: React.ReactNode;
  focusedIcon: React.ReactNode;
}> = ({ focused, icon, focusedIcon }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(focused ? 1 : 0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.1 : 1,
        friction: 6,
        tension: 120,
        useNativeDriver,
      }),
      Animated.timing(opacityAnim, {
        toValue: focused ? 1 : 0.5,
        duration: 150,
        useNativeDriver,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        opacity: opacityAnim,
      }}
    >
      {focused ? focusedIcon : icon}
    </Animated.View>
  );
};

// Tab Icons - iOS 26 style (SF Symbol inspired)
const TodayIcon = ({ focused }: { focused: boolean }) => (
  <AnimatedTabIcon
    focused={focused}
    icon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <Path d="M12 7v5l3 3" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      </Svg>
    }
    focusedIcon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="9" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Path d="M12 7v5l3 3" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
      </Svg>
    }
  />
);

const HealthIcon = ({ focused }: { focused: boolean }) => (
  <AnimatedTabIcon
    focused={focused}
    icon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1.5"
        />
      </Svg>
    }
    focusedIcon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill="#FF3B30"
        />
      </Svg>
    }
  />
);

const RingIcon = ({ focused }: { focused: boolean }) => (
  <AnimatedTabIcon
    focused={focused}
    icon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="8" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
        <Circle cx="12" cy="12" r="4" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5" />
      </Svg>
    }
    focusedIcon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Circle cx="12" cy="12" r="8" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="12" cy="12" r="4" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="12" cy="12" r="1.5" fill="#FFFFFF" />
      </Svg>
    }
  />
);

const SettingsIcon = ({ focused }: { focused: boolean }) => (
  <AnimatedTabIcon
    focused={focused}
    icon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
        />
      </Svg>
    }
    focusedIcon={
      <Svg width={26} height={26} viewBox="0 0 24 24">
        <Path
          d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
          fill="#FFFFFF"
        />
      </Svg>
    }
  />
);

// Splash screen animation component
const SplashScreen: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;
  const fadeOut = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Simple fade-in animation
    Animated.timing(logoOpacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver,
    }).start();

    // Rotation animation
    Animated.timing(ringRotation, {
      toValue: 1,
      duration: 2000,
      useNativeDriver,
    }).start();

    // Auto-complete after 2.5 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeOut, {
        toValue: 0,
        duration: 300,
        useNativeDriver,
      }).start(() => {
        onComplete();
      });
    }, 2500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const rotateInterpolate = ringRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.splashContainer, { opacity: fadeOut }]}>
      <Animated.View
        style={[
          styles.splashLogo,
          {
            transform: [{ rotate: rotateInterpolate }],
            opacity: logoOpacity,
          },
        ]}
      >
        <Svg width={120} height={120} viewBox="0 0 120 120">
          <Circle cx="60" cy="60" r="50" fill={`${colors.primary}20`} />
          <Circle
            cx="60"
            cy="60"
            r="40"
            fill="none"
            stroke={colors.primary}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="180 70"
          />
          <Circle cx="60" cy="60" r="20" fill={colors.primary} />
        </Svg>
      </Animated.View>
      <Animated.Text style={[styles.splashTitle, { opacity: logoOpacity }]}>
        Smart Ring
      </Animated.Text>
    </Animated.View>
  );
};

// Main app content with tabs - iOS 26 style
function MainApp() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.5)',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarItemStyle: styles.tabBarItem,
      }}
    >
      <Tab.Screen
        name="Today"
        component={NewHomeScreen}
        options={{
          tabBarIcon: ({ focused }) => <TodayIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Health"
        component={AppleHealthScreen}
        options={{
          tabBarIcon: ({ focused }) => <HealthIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Ring"
        component={DevicesScreen}
        options={{
          tabBarIcon: ({ focused }) => <RingIcon focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          tabBarIcon: ({ focused }) => <SettingsIcon focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

// App with auth flow
function AppWithAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AuthScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      <MainApp />
    </NavigationContainer>
  );
}

function App() {
  const [showSplash, setShowSplash] = React.useState(true);

  const handleSplashComplete = React.useCallback(() => {
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={colors.background} />
        <SplashScreen onComplete={handleSplashComplete} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <AppWithAuth />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabBar: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    height: Platform.OS === 'ios' ? 85 : 65,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  tabBarItem: {
    paddingVertical: 4,
  },
  splashContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    marginBottom: 24,
  },
  splashTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 1,
  },
});

// Wrap App with ErrorBoundary
const AppWithErrorBoundary = () => (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

export default AppWithErrorBoundary;
