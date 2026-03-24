const IS_DEV = process.env.ENV === 'dev';

const name = IS_DEV ? 'Focus DEV' : 'Focus';
const bundleId = IS_DEV ? 'com.focusring.app.dev' : 'com.focusring.app';
const icon = IS_DEV ? './assets/icon_dev.png' : './assets/icon.png';

module.exports = {
  expo: {
    extra: {
      eas: {
        projectId: '176a7f39-858f-4c21-97c5-7714f587c179',
      },
    },
    name,
    slug: 'smart-ring-expo-app',
    owner: 'mateoaldao',
    version: '1.0.10',
    orientation: 'portrait',
    icon,
    userInterfaceStyle: 'dark',
    splash: {
      image: './assets/splash.jpg',
      resizeMode: 'cover',
      backgroundColor: '#0D0D0D',
    },
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: bundleId,
      buildNumber: '11',
      infoPlist: {
        NSBluetoothAlwaysUsageDescription: 'Focus needs Bluetooth to connect to your ring and sync health data',
        NSBluetoothPeripheralUsageDescription: 'Focus needs Bluetooth to connect to your ring and sync health data',
        NSHealthShareUsageDescription: 'Focus needs access to read your health data from Apple Health to provide comprehensive health insights',
        NSHealthUpdateUsageDescription: 'Focus needs access to write health data to Apple Health to keep your records synchronized',
        UIBackgroundModes: ['bluetooth-central', 'fetch'],
      },
      config: {
        usesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0D0D0D',
      },
      package: bundleId,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      [
        'expo-build-properties',
        {
          ios: {
            deploymentTarget: '15.1',
          },
        },
      ],
      'expo-secure-store',
      'expo-router',
      'expo-localization',
      [
        'expo-notifications',
        {
          iosDisplayInForeground: true,
        },
      ],
      [
        '@kingstinct/react-native-healthkit',
        {
          NSHealthShareUsageDescription: 'Focus reads your health data from Apple Health to provide comprehensive insights alongside your ring data.',
          NSHealthUpdateUsageDescription: 'Focus writes ring health data to Apple Health to keep your records synchronized.',
        },
      ],
      [
        '@sentry/react-native/expo',
        {
          organization: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
        },
      ],
    ],
    scheme: IS_DEV ? 'smartringdev' : 'smartring',
    experiments: {
      typedRoutes: true,
    },
    runtimeVersion: '1.0.0',
    updates: {
      url: 'https://u.expo.dev/176a7f39-858f-4c21-97c5-7714f587c179',
      requestHeaders: {
        'expo-channel-name': IS_DEV ? 'development' : 'production',
      },
    },
  },
};
