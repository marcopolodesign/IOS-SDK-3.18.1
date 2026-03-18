import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSmartRing } from '../../src/hooks/useSmartRing';
import type { DeviceInfo } from '../../src/types/sdk.types';

const { width, height } = Dimensions.get('window');
const RING_HERO = require('../../assets/images/ring-hero.png');

type ConnectionStep = 'welcome' | 'scanning' | 'devices' | 'connecting';

export default function ConnectScreen() {
  console.log('🔵 [ConnectScreen] Component rendering...');

  const [step, setStep] = useState<ConnectionStep>('welcome');
  const [connectingDevice, setConnectingDevice] = useState<DeviceInfo | null>(null);
  const [scanComplete, setScanComplete] = useState(false);

  const {
    devices,
    isScanning,
    scan,
    connect,
  } = useSmartRing();

  console.log('🔵 [ConnectScreen] Current state:', {
    step,
    scanComplete,
    isScanning,
    devicesCount: devices.length,
    devices: devices.map(d => ({ name: d.name, mac: d.mac })),
    connectingDevice: connectingDevice?.name || null,
  });

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('🟡 [ConnectScreen] Step changed to:', step);
  }, [step]);

  useEffect(() => {
    console.log('🟢 [ConnectScreen] Devices updated:', {
      count: devices.length,
      devices: devices.map(d => ({ name: d.name, mac: d.mac, id: d.id })),
    });
  }, [devices]);

  useEffect(() => {
    console.log('🔍 [ConnectScreen] isScanning changed to:', isScanning);
  }, [isScanning]);

  useEffect(() => {
    console.log('✅ [ConnectScreen] scanComplete changed to:', scanComplete);
  }, [scanComplete]);

  // Ripple pulse animation for scanning
  useEffect(() => {
    if (step !== 'scanning' && step !== 'connecting') return;

    const createPulse = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 1800,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );

    const a1 = createPulse(pulseAnim1, 0);
    const a2 = createPulse(pulseAnim2, 600);
    const a3 = createPulse(pulseAnim3, 1200);
    a1.start();
    a2.start();
    a3.start();

    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
      pulseAnim1.setValue(0);
      pulseAnim2.setValue(0);
      pulseAnim3.setValue(0);
    };
  }, [step]);

  const transitionTo = (newStep: ConnectionStep) => {
    console.log('🔄 [ConnectScreen] transitionTo called:', { from: step, to: newStep });
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

  const handleScan = async () => {
    console.log('🔍 [ConnectScreen] handleScan START');
    setScanComplete(false);
    transitionTo('scanning');
    const startTime = Date.now();
    await scan(10);
    const elapsed = Date.now() - startTime;
    console.log(`🔍 [ConnectScreen] scan(10) completed after ${elapsed}ms`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setScanComplete(true);
    transitionTo('devices');
    console.log('🔍 [ConnectScreen] handleScan END');
  };

  const handleConnect = async (device: DeviceInfo) => {
    console.log('🔗 [ConnectScreen] handleConnect START', device);
    setConnectingDevice(device);
    transitionTo('connecting');

    try {
      const success = await connect(device.mac);
      if (success) {
        router.replace({
          pathname: '/(onboarding)/success',
          params: {
            deviceName: device.name || 'Smart Ring',
            deviceMac: device.mac,
          },
        });
      } else {
        Alert.alert(
          'Connection Failed',
          "Could not connect to the ring. Please make sure it's nearby and try again.",
          [
            { text: 'Retry', onPress: () => handleConnect(device) },
            { text: 'Back', onPress: () => transitionTo('devices') },
          ]
        );
      }
    } catch (error) {
      console.log('❌ [ConnectScreen] Connection ERROR:', error);
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting. Please try again.',
        [{ text: 'OK', onPress: () => transitionTo('devices') }]
      );
    }
  };

  const validDevices = devices.filter(d => {
    const hasValidMac = d.mac && d.mac.length > 0 && d.mac !== 'undefined' && d.mac !== 'null';
    return hasValidMac;
  });

  const makePulseStyle = (anim: Animated.Value, baseSize: number) => ({
    position: 'absolute' as const,
    width: baseSize,
    height: baseSize,
    borderRadius: baseSize / 2,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 212, 170, 0.5)',
    opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.7, 0.4, 0] }),
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
  });

  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      {/* Ring hero image */}
      <View style={styles.heroContainer}>
        <Image source={RING_HERO} style={styles.heroImage} resizeMode="cover" />
        <LinearGradient
          colors={['transparent', '#000000']}
          style={styles.heroFade}
        />
      </View>

      <View style={styles.welcomeContent}>
        <Text style={styles.title}>Connect your{'\n'}Focus Ring</Text>
        <Text style={styles.subtitle}>
          Make sure Bluetooth is enabled and your ring is nearby.
        </Text>

        <TouchableOpacity style={styles.primaryButton} onPress={handleScan} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>Scan for Ring</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderScanning = () => (
    <View style={styles.stepContainer}>
      <View style={styles.pulseContainer}>
        <Animated.View style={makePulseStyle(pulseAnim1, 80)} />
        <Animated.View style={makePulseStyle(pulseAnim2, 80)} />
        <Animated.View style={makePulseStyle(pulseAnim3, 80)} />
        <View style={styles.scanningDot}>
          <Ionicons name="bluetooth" size={28} color="#00D4AA" />
        </View>
      </View>

      <Text style={styles.title}>Searching...</Text>
      <Text style={styles.subtitle}>
        Looking for your ring nearby.{'\n'}Keep it charged and close.
      </Text>
    </View>
  );

  const renderDeviceItem = ({ item }: { item: DeviceInfo }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnect(item)}
      activeOpacity={0.75}
    >
      <View style={styles.deviceIconWrap}>
        <Ionicons name="radio-outline" size={22} color="#00D4AA" />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'Smart Ring'}</Text>
        <Text style={styles.deviceMac}>{item.mac}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.3)" />
    </TouchableOpacity>
  );

  const renderDevices = () => {
    const showDevices = validDevices.length > 0;
    const showNoDevices = scanComplete && validDevices.length === 0;
    const showLoading = !scanComplete && !showDevices;

    if (showLoading) {
      return (
        <View style={styles.stepContainer}>
          <ActivityIndicator size="large" color="#00D4AA" />
        </View>
      );
    }

    return (
      <View style={styles.stepContainer}>
        <Text style={styles.title}>
          {showDevices ? 'Nearby Rings' : 'None Found'}
        </Text>
        <Text style={styles.subtitle}>
          {showDevices
            ? 'Tap a device to pair'
            : 'Try the following and scan again'}
        </Text>

        {showDevices ? (
          <FlatList
            data={validDevices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.mac}
            style={styles.deviceList}
            contentContainerStyle={styles.deviceListContent}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.troubleshootContainer}>
            {[
              { icon: 'battery-charging-outline', text: 'Charge your ring for a few minutes' },
              { icon: 'bluetooth-outline', text: 'Enable Bluetooth on your phone' },
              { icon: 'refresh-outline', text: 'Restart the ring on its charger' },
            ].map(({ icon, text }) => (
              <View key={icon} style={styles.troubleshootRow}>
                <Ionicons name={icon as any} size={20} color="#00D4AA" />
                <Text style={styles.troubleshootText}>{text}</Text>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity style={styles.outlineButton} onPress={handleScan} activeOpacity={0.8}>
          <Ionicons name="refresh" size={16} color="#00D4AA" />
          <Text style={styles.outlineButtonText}>Scan Again</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderConnecting = () => (
    <View style={styles.stepContainer}>
      <View style={styles.pulseContainer}>
        <Animated.View style={makePulseStyle(pulseAnim1, 80)} />
        <Animated.View style={makePulseStyle(pulseAnim2, 80)} />
        <View style={styles.scanningDot}>
          <ActivityIndicator size="small" color="#00D4AA" />
        </View>
      </View>

      <Text style={styles.title}>Pairing...</Text>
      <Text style={styles.subtitle}>
        Connecting to {connectingDevice?.name || 'Smart Ring'}.{'\n'}This may take a moment.
      </Text>
    </View>
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

      {/* Step dots */}
      <View style={styles.stepDots}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i <= stepIndex && styles.dotActive,
              i === stepIndex && styles.dotCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const HERO_H = height * 0.42;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    alignItems: 'center',
  },

  // Welcome hero
  heroContainer: {
    width: '100%',
    height: HERO_H,
    overflow: 'hidden',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_H * 0.55,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 28,
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    lineHeight: 38,
    marginBottom: 12,
    marginTop: 40,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 24,
  },
  primaryButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 'auto' as any,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.4)',
    width: '100%',
    gap: 8,
    marginTop: 12,
  },
  outlineButtonText: {
    color: '#00D4AA',
    fontSize: 15,
    fontWeight: '600',
  },

  // Pulse / scanning
  pulseContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: height * 0.2,
    marginBottom: 16,
  },
  scanningDot: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 212, 170, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 170, 0.3)',
  },

  // Device list
  deviceList: {
    width: '100%',
  },
  deviceListContent: {
    paddingBottom: 8,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  deviceIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 212, 170, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  deviceMac: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'monospace',
  },

  // Troubleshoot
  troubleshootContainer: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  troubleshootRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  troubleshootText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    flex: 1,
    lineHeight: 20,
  },

  // Step dots
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 50,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dotActive: {
    backgroundColor: 'rgba(0, 212, 170, 0.5)',
  },
  dotCurrent: {
    width: 20,
    backgroundColor: '#00D4AA',
  },
});
