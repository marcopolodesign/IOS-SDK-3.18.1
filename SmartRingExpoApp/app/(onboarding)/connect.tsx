import React, { useState, useEffect, useRef, useCallback } from 'react';
import { reportError } from '../../src/utils/sentry';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  Dimensions,
  Alert,
  Image,
  ImageBackground,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSmartRing } from '../../src/hooks/useSmartRing';
import { TroubleshootSheet } from '../../src/components/home/TroubleshootSheet';
import type { DeviceInfo, DeviceType } from '../../src/types/sdk.types';

const { width: SCREEN_WIDTH, height } = Dimensions.get('window');
const WELCOME_BG = require('../../assets/welcome-bg.jpg');
const SCANNING_BG = require('../../assets/scanning_bg.jpg');
const CONNECT_MOCK_IMG = require('../../assets/connect-mock.png');
const X6_MOCK_IMG = require('../../assets/x6-mock-connect.png');
const BAND_MOCK_IMG = require('../../assets/v8-mock-connect.png');
const SCAN_RING_IMG = require('../../assets/scan-ring.png');

const RING_SIZE = 194;
const RING_STROKE = 4;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const ARC_LENGTH = RING_CIRCUMFERENCE * 0.15; // 15% arc segment

type ConnectionStep = 'welcome' | 'scanning' | 'devices' | 'connecting';

const CUSTOM_BEZIER = Easing.bezier(0.4, 0, 0, 1);
const STAGGER_DURATION = 600;

export default function ConnectScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ deviceType?: string }>();
  const deviceType: DeviceType = (params.deviceType as DeviceType) || 'ring';
  const isBand = deviceType === 'band';
  const [step, setStep] = useState<ConnectionStep>('welcome');
  const [connectingDevice, setConnectingDevice] = useState<DeviceInfo | null>(null);
  const [scanComplete, setScanComplete] = useState(false);
  const [activeDeviceIndex, setActiveDeviceIndex] = useState(0);
  const [troubleshootVisible, setTroubleshootVisible] = useState(false);

  const {
    devices,
    isScanning,
    scan,
    stopScan,
    connect,
  } = useSmartRing();

  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDeviceScroll = useCallback((e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveDeviceIndex(index);
  }, []);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Welcome stagger animations (Reanimated)
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(80);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(80);
  const buttonOpacity = useSharedValue(0);
  const buttonTranslateY = useSharedValue(80);

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
    transform: [{ translateY: buttonTranslateY.value }],
  }));

  // Scanning spinner + stagger
  const spinRotation = useSharedValue(0);
  const scanTitleOpacity = useSharedValue(0);
  const scanTitleTranslateY = useSharedValue(80);
  const scanSubtitleOpacity = useSharedValue(0);
  const scanSubtitleTranslateY = useSharedValue(80);
  const scanFooterOpacity = useSharedValue(0);
  const scanFooterTranslateY = useSharedValue(80);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinRotation.value}deg` }],
  }));
  const scanTitleStyle = useAnimatedStyle(() => ({
    opacity: scanTitleOpacity.value,
    transform: [{ translateY: scanTitleTranslateY.value }],
  }));
  const scanSubtitleStyle = useAnimatedStyle(() => ({
    opacity: scanSubtitleOpacity.value,
    transform: [{ translateY: scanSubtitleTranslateY.value }],
  }));
  const scanFooterStyle = useAnimatedStyle(() => ({
    opacity: scanFooterOpacity.value,
    transform: [{ translateY: scanFooterTranslateY.value }],
  }));

  useEffect(() => {
  }, [step]);

  // Cleanup scan timeout on unmount
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
  }, [devices]);

  useEffect(() => {
  }, [isScanning]);

  useEffect(() => {
  }, [scanComplete]);

  // Welcome stagger entrance (Reanimated)
  useEffect(() => {
    if (step === 'welcome') {
      titleOpacity.value = 0;
      titleTranslateY.value = 80;
      subtitleOpacity.value = 0;
      subtitleTranslateY.value = 80;
      buttonOpacity.value = 0;
      buttonTranslateY.value = 80;

      const timingOpts = { duration: STAGGER_DURATION, easing: CUSTOM_BEZIER };
      titleOpacity.value = withDelay(200, withTiming(1, timingOpts));
      titleTranslateY.value = withDelay(200, withTiming(0, timingOpts));
      subtitleOpacity.value = withDelay(225, withTiming(1, timingOpts));
      subtitleTranslateY.value = withDelay(225, withTiming(0, timingOpts));
      buttonOpacity.value = withDelay(235, withTiming(1, timingOpts));
      buttonTranslateY.value = withDelay(235, withTiming(0, timingOpts));
    }
  }, [step]);

  // Spinner for scanning, connecting, and no-devices steps
  useEffect(() => {
    if (step !== 'scanning' && step !== 'connecting' && step !== 'devices') return;

    // Spinning glow: 1s spin with bezier, then 1.5s pause, repeat forever
    // Only restart if entering scanning (not when transitioning to connecting)
    if (step === 'scanning') spinRotation.value = 0;
    spinRotation.value = withRepeat(
      withSequence(
        withTiming(360, { duration: 1000, easing: CUSTOM_BEZIER }),
        withDelay(1500, withTiming(360, { duration: 0 })),
        withTiming(0, { duration: 0 }),
      ),
      -1,
    );

    // Stagger content in (scanning only)
    if (step === 'scanning') {
      const timingOpts = { duration: STAGGER_DURATION, easing: CUSTOM_BEZIER };
      scanTitleOpacity.value = 0;
      scanTitleTranslateY.value = 80;
      scanSubtitleOpacity.value = 0;
      scanSubtitleTranslateY.value = 80;
      scanFooterOpacity.value = 0;
      scanFooterTranslateY.value = 80;

      scanTitleOpacity.value = withDelay(200, withTiming(1, timingOpts));
      scanTitleTranslateY.value = withDelay(200, withTiming(0, timingOpts));
      scanSubtitleOpacity.value = withDelay(225, withTiming(1, timingOpts));
      scanSubtitleTranslateY.value = withDelay(225, withTiming(0, timingOpts));
      scanFooterOpacity.value = withDelay(250, withTiming(1, timingOpts));
      scanFooterTranslateY.value = withDelay(250, withTiming(0, timingOpts));
    }
  }, [step]);

  const transitionTo = (newStep: ConnectionStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStep(newStep);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    });
  };

  // Early-stop useEffect: as soon as a device appears during scanning,
  // stop the scan after 800ms (to catch nearby companion devices) and show the list.
  useEffect(() => {
    if (devices.length > 0 && step === 'scanning') {
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
        scanTimeoutRef.current = null;
      }
      const timer = setTimeout(() => {
        stopScan();
        setScanComplete(true);
        transitionTo('devices');
      }, 800);
      scanTimeoutRef.current = timer;
    }
  }, [devices, step]);

  const handleScan = () => {
    setScanComplete(false);
    transitionTo('scanning');

    // Fire scan without awaiting — devices arrive via onDeviceDiscovered events.
    scan(7).catch(err => { reportError(err, { op: 'onboarding.scan' }, 'warning'); });

    // Fallback: after 7 s, show whatever was found (or nothing).
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    scanTimeoutRef.current = setTimeout(() => {
      setScanComplete(true);
      transitionTo('devices');
    }, 7000);
  };

  const handleConnect = async (device: DeviceInfo) => {
    setConnectingDevice(device);
    transitionTo('connecting');

    try {
      const success = await connect(device.mac);
      if (success) {
        router.replace({
          pathname: '/(onboarding)/success',
          params: {
            deviceName: device.name || (isBandDevice(device) ? 'Focus Band' : 'Focus X3'),
            deviceMac: device.mac,
            deviceType,
          },
        });
      } else {
        Alert.alert(
          t('onboarding.alert_failed_title'),
          t('onboarding.alert_failed_message'),
          [
            { text: t('onboarding.button_retry'), onPress: () => handleConnect(device) },
            { text: t('onboarding.button_back'), onPress: () => transitionTo('devices') },
          ]
        );
      }
    } catch (error) {
      reportError(error, { op: 'onboarding.connect' });
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting. Please try again.',
        [{ text: 'OK', onPress: () => transitionTo('devices') }]
      );
    }
  };

  const isX6Device = (d: DeviceInfo | null | undefined): boolean =>
    d?.sdkType === 'v8' && d?.deviceType === 'ring' || false;
  const isBandDevice = (d: DeviceInfo | null | undefined): boolean =>
    (d?.sdkType === 'v8' || d?.deviceType === 'band') && !isX6Device(d) || false;
  const getDeviceImage = (d: DeviceInfo | null | undefined) =>
    isX6Device(d) ? X6_MOCK_IMG : isBandDevice(d) ? BAND_MOCK_IMG : CONNECT_MOCK_IMG;

  const validDevices = devices.filter(d => {
    const hasValidMac = d.mac && d.mac.length > 0 && d.mac !== 'undefined' && d.mac !== 'null';
    return hasValidMac;
  });

  const renderWelcome = () => (
    <ImageBackground source={WELCOME_BG} style={styles.fullScreen} resizeMode="cover">
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeTextCenter}>
          <Reanimated.Text style={[styles.welcomeTitle, titleStyle]}>
            {t('onboarding.welcome_title')}
          </Reanimated.Text>
          <Reanimated.Text style={[styles.welcomeSubtitle, subtitleStyle]}>
            {t('onboarding.welcome_subtitle')}
          </Reanimated.Text>
        </View>

        <Reanimated.View style={[styles.welcomeButtonWrap, buttonStyle]}>
          <TouchableOpacity style={styles.welcomeButton} onPress={handleScan} activeOpacity={0.85}>
            <Text style={styles.welcomeButtonText}>{t('onboarding.button_scan')}</Text>
          </TouchableOpacity>
        </Reanimated.View>
      </View>
    </ImageBackground>
  );

  const renderSpinner = () => (
    <View style={styles.spinnerWrap}>
      {/* Frosted glass fill inside the circle */}
      <BlurView intensity={40} tint="light" style={styles.spinnerBlur} />
      {/* Base circle — white 50% */}
      <Svg width={RING_SIZE} height={RING_SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
      </Svg>
      {/* Spinning arc glow — white 100% with blur */}
      <Reanimated.View style={[StyleSheet.absoluteFill, spinnerStyle]}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            stroke="#fff"
            strokeWidth={RING_STROKE + 4}
            fill="none"
            strokeDasharray={`${ARC_LENGTH} ${RING_CIRCUMFERENCE - ARC_LENGTH}`}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
      </Reanimated.View>
    </View>
  );

  const renderScanning = () => (
    <ImageBackground source={SCANNING_BG} style={styles.fullScreen} resizeMode="cover">
      <View style={styles.scanContent}>
        {renderSpinner()}

        <Reanimated.Text style={[styles.scanTitle, scanTitleStyle]}>
          {t('onboarding.title_scanning')}
        </Reanimated.Text>
        <Reanimated.Text style={[styles.scanSubtitle, scanSubtitleStyle]}>
          {t('onboarding.subtitle_scanning')}
        </Reanimated.Text>

        <Image source={SCAN_RING_IMG} style={styles.scanRingImg} resizeMode="contain" />

        {/* Troubleshoot footer */}
        <Reanimated.View style={[styles.scanFooter, scanFooterStyle]}>
          <Text style={styles.scanFooterText}>
            {t('onboarding.cant_find')}{' '}
            <Text style={styles.scanFooterLink} onPress={() => setTroubleshootVisible(true)}>{t('onboarding.troubleshoot_link')}</Text>
          </Text>
        </Reanimated.View>
      </View>
    </ImageBackground>
  );

  const renderDeviceCard = ({ item }: { item: DeviceInfo }) => (
    <View style={styles.deviceCard}>
      <Image source={getDeviceImage(item)} style={styles.deviceRingImg} resizeMode="contain" />
      <Text style={styles.deviceCardName}>{item.name || (isX6Device(item) ? 'FOCUS X6' : isBandDevice(item) ? 'FOCUS BAND' : 'FOCUS X3')}</Text>
      <Text style={styles.deviceCardMac}>{item.mac}</Text>
      <TouchableOpacity style={styles.connectButton} onPress={() => handleConnect(item)} activeOpacity={0.85}>
        <Text style={styles.connectButtonText}>{t('onboarding.button_connect_device')}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderDevices = () => {
    const showDevices = validDevices.length > 0;
    const showNoDevices = scanComplete && validDevices.length === 0;

    // No devices found
    if (showNoDevices || (!scanComplete && !showDevices)) {
      return (
        <ImageBackground source={SCANNING_BG} style={styles.fullScreen} resizeMode="cover">
          <View style={styles.scanContent}>
            <Text style={styles.scanTitle}>{t('onboarding.title_no_devices')}</Text>
            <Text style={styles.scanSubtitle}>{t('onboarding.subtitle_no_devices')}</Text>

            <View style={styles.scanFooter}>
              <TouchableOpacity style={styles.scanAgainButton} onPress={handleScan} activeOpacity={0.85}>
                <Text style={styles.scanAgainButtonText}>{t('onboarding.button_scan_again')}</Text>
              </TouchableOpacity>
              <Text
                style={styles.troubleshootLink}
                onPress={() => setTroubleshootVisible(true)}
              >
                {t('onboarding.troubleshoot_link')}
              </Text>
            </View>
          </View>
        </ImageBackground>
      );
    }

    // Devices found — Figma 543:654
    return (
      <LinearGradient colors={['#000000', '#5A112A']} locations={[0.3914, 0.9591]} style={styles.fullScreen}>
        <View style={styles.devicesContent}>
          {/* Blue radial glow behind ring */}
          <View style={styles.blueGlow} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <RadialGradient id="blueGlow" cx="50%" cy="50%" rx="50%" ry="50%">
                  <Stop offset="0" stopColor="#0042A8" stopOpacity="1" />
                  <Stop offset="1" stopColor="#0042A8" stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="100%" height="100%" fill="url(#blueGlow)" />
            </Svg>
          </View>

          <Text style={styles.scanTitle}>{t('onboarding.title_devices_found')}</Text>
          <Text style={styles.scanSubtitle}>{t('onboarding.subtitle_devices_found')}</Text>

          {/* Carousel + dots wrapper */}
          <View style={styles.carouselWrap}>
            <FlatList
              data={validDevices}
              renderItem={renderDeviceCard}
              keyExtractor={(item) => item.mac}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onDeviceScroll}
            />
            {validDevices.length > 1 && (
              <View style={styles.pageDots}>
                {validDevices.map((d, i) => (
                  <View
                    key={d.mac}
                    style={[
                      styles.pageDot,
                      i === activeDeviceIndex && styles.pageDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.scanFooter}>
            <Text style={styles.scanFooterText}>
              {t('onboarding.not_your_ring')}{' '}
              <Text style={styles.scanFooterLink} onPress={handleScan}>
                {t('onboarding.scan_again_link')}
              </Text>
            </Text>
            <Text
              style={styles.troubleshootLink}
              onPress={() => setTroubleshootVisible(true)}
            >
              {t('onboarding.troubleshoot_link')}
            </Text>
          </View>
        </View>
      </LinearGradient>
    );
  };

  const renderConnecting = () => (
    <ImageBackground source={SCANNING_BG} style={styles.fullScreen} resizeMode="cover">
      <View style={styles.scanContent}>
        {renderSpinner()}

        <Text style={styles.scanTitle}>{t('onboarding.title_connecting')}</Text>
        <Text style={styles.scanSubtitle}>
          {t('onboarding.subtitle_connecting', { name: connectingDevice?.name || (isBandDevice(connectingDevice) ? 'Focus Band' : 'Focus X3') })}
        </Text>
      </View>
    </ImageBackground>
  );

  const renderStep = () => {
    switch (step) {
      case 'welcome': return renderWelcome();
      case 'scanning': return renderScanning();
      case 'devices': return renderDevices();
      case 'connecting': return renderConnecting();
    }
  };

  const stepIndex = ['welcome', 'scanning', 'devices', 'connecting'].indexOf(step);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        {renderStep()}
      </Animated.View>

      <TroubleshootSheet
        visible={troubleshootVisible}
        onDismiss={() => setTroubleshootVisible(false)}
      />

      {/* Step bars */}
      <View style={styles.stepBars}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.stepBar,
              i <= stepIndex && styles.stepBarActive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  fullScreen: {
    flex: 1,
  },
  content: {
    flex: 1,
  },

  // Welcome screen (Figma 540:606)
  welcomeContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  welcomeTextCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 120,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.64,
    lineHeight: 38,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.36,
    lineHeight: 24,
    maxWidth: 260,
  },
  welcomeButtonWrap: {
    width: '100%',
  },
  welcomeButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeButtonText: {
    color: '#5a112a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },



  // Scanning screen
  scanContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.09,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  spinnerWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    overflow: 'hidden',
    borderRadius: RING_SIZE / 2,
  },
  spinnerBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  scanTitle: {
    fontSize: 32,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.64,
    lineHeight: 38,
    marginBottom: 8,
  },
  scanSubtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.36,
    lineHeight: 24,
    maxWidth: 260,
  },
  scanRingImg: {
    width: 240,
    height: 240,
    marginTop: 'auto' as const,
  },
  scanAgainButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    width: '100%' as const,
  },
  scanAgainButtonText: {
    color: '#5a112a',
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.32,
  },
  scanFooter: {
    marginTop: 'auto',
    marginBottom: 20,
    width: '100%',
  },
  scanFooterText: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.32,
    lineHeight: 18,
  },
  scanFooterLink: {
    textDecorationLine: 'underline' as const,
  },

  // Devices found screen (Figma 543:654)
  devicesContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: height * 0.12,
    paddingBottom: 60,
  },
  carouselWrap: {
    width: '100%',
    alignItems: 'center',
  },
  blueGlow: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    position: 'absolute',
    top: height * 0.2,
    left: (SCREEN_WIDTH - SCREEN_WIDTH) / 2,
  },
  carouselArrow: {
    position: 'absolute',
    right: 16,
    top: '40%',
    zIndex: 1,
  },
  deviceCard: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  deviceRingImg: {
    width: 244,
    height: 207,
    marginBottom: 13,
  },
  deviceCardName: {
    fontSize: 22,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.44,
    lineHeight: 21,
    marginBottom: 13,
  },
  deviceCardMac: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.32,
    lineHeight: 21,
  },
  connectButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 24,
  },
  connectButtonText: {
    color: '#5a112a',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.32,
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 20,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  pageDotActive: {
    width: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
  },

  // Step bars
  stepBars: {
    position: 'absolute',
    top: 58,
    left: 20,
    right: 20,
    flexDirection: 'row',
    gap: 4,
  },
  stepBar: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stepBarActive: {
    backgroundColor: '#fff',
  },
  troubleshootLink: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    textDecorationLine: 'underline',
    letterSpacing: -0.32,
    marginTop: 16,
  },
});
