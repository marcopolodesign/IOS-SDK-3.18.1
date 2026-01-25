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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSmartRing } from '../hooks/useSmartRing';
import type { DeviceInfo } from '../types/sdk.types';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import { fontFamily } from '../theme/colors';

const { width, height } = Dimensions.get('window');

type OnboardingStep = 'checking' | 'welcome' | 'scanning' | 'devices' | 'connecting' | 'connected';

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const [step, setStep] = useState<OnboardingStep>('checking');
  const [connectingDevice, setConnectingDevice] = useState<DeviceInfo | null>(null);

  const {
    devices,
    isScanning,
    connectedDevice,
    scan,
    connect,
    checkForPairedDevice,
  } = useSmartRing();

  // On mount, go directly to welcome screen
  // Auto-connect is disabled - user must manually initiate pairing
  // TODO: Add AsyncStorage-based auto-connect after first successful pairing
  useEffect(() => {
    console.log('📱 OnboardingScreen: Showing welcome screen (auto-connect disabled)');
    setStep('welcome');
  }, []);

  // Animations
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  // Pulse animation for scanning
  useEffect(() => {
    if (step === 'scanning') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [step, pulseAnim]);

  // Ring rotation animation
  useEffect(() => {
    if (step === 'connecting') {
      const rotate = Animated.loop(
        Animated.timing(ringRotation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        })
      );
      rotate.start();
      return () => rotate.stop();
    }
  }, [step, ringRotation]);

  // Transition between steps
  const transitionTo = (newStep: OnboardingStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
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

  // Handle scan
  const handleScan = async () => {
    transitionTo('scanning');
    await scan(10);
    transitionTo('devices');
  };

  // Handle connect
  const handleConnect = async (device: DeviceInfo) => {
    setConnectingDevice(device);
    transitionTo('connecting');
    
    try {
      const success = await connect(device.mac);
      if (success) {
        transitionTo('connected');
      } else {
        Alert.alert(
          'Connection Failed',
          'Could not connect to the ring. Please make sure it\'s nearby and try again.',
          [
            { text: 'Retry', onPress: () => handleConnect(device) },
            { text: 'Back', onPress: () => transitionTo('devices') },
          ]
        );
      }
    } catch (error) {
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting. Please try again.',
        [{ text: 'OK', onPress: () => transitionTo('devices') }]
      );
    }
  };

  // Render welcome step
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#A855F7']}
          style={styles.iconGradient}
        >
          <Ionicons name="fitness" size={80} color="#fff" />
        </LinearGradient>
      </View>
      
      <Text style={styles.title}>Welcome to FOCUS</Text>
      <Text style={styles.subtitle}>
        Let's connect your smart ring to start tracking your health metrics
      </Text>
      
      <TouchableOpacity style={styles.primaryButton} onPress={handleScan}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          <Ionicons name="bluetooth" size={24} color="#fff" style={styles.buttonIcon} />
          <Text style={styles.buttonText}>Scan for Devices</Text>
        </LinearGradient>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  // Render scanning step
  const renderScanning = () => (
    <View style={styles.stepContainer}>
      <Animated.View style={[styles.scanningCircle, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={['rgba(99, 102, 241, 0.3)', 'rgba(139, 92, 246, 0.1)']}
          style={styles.scanningGradient}
        >
          <Ionicons name="bluetooth" size={60} color="#6366F1" />
        </LinearGradient>
      </Animated.View>
      
      <Text style={styles.title}>Scanning...</Text>
      <Text style={styles.subtitle}>
        Looking for nearby FOCUS rings.{'\n'}Make sure your ring is charged and nearby.
      </Text>
      
      <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
    </View>
  );

  // Render device item
  const renderDeviceItem = ({ item }: { item: DeviceInfo }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleConnect(item)}
    >
      <View style={styles.deviceIcon}>
        <Ionicons name="fitness" size={28} color="#6366F1" />
      </View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name || 'FOCUS R1'}</Text>
        <Text style={styles.deviceMac}>{item.mac}</Text>
      </View>
      <Ionicons name="chevron-forward" size={24} color="#6B7280" />
    </TouchableOpacity>
  );

  // Render devices step
  const renderDevices = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>
        {devices.length > 0 ? 'Devices Found' : 'No Devices Found'}
      </Text>
      <Text style={styles.subtitle}>
        {devices.length > 0
          ? 'Tap a device to connect'
          : 'Make sure your ring is charged and nearby'}
      </Text>
      
      {devices.length > 0 ? (
        <FlatList
          data={devices}
          renderItem={renderDeviceItem}
          keyExtractor={(item) => item.mac}
          style={styles.deviceList}
          contentContainerStyle={styles.deviceListContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={60} color="#6B7280" />
          <Text style={styles.emptyText}>No rings detected</Text>
        </View>
      )}
      
      <TouchableOpacity style={styles.secondaryButton} onPress={handleScan}>
        <Ionicons name="refresh" size={20} color="#6366F1" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>Scan Again</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.skipButton} onPress={onComplete}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  // Render connecting step
  const renderConnecting = () => {
    const spin = ringRotation.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <View style={styles.stepContainer}>
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <LinearGradient
            colors={['#6366F1', '#8B5CF6', '#A855F7']}
            style={styles.connectingRing}
          >
            <View style={styles.connectingInner}>
              <Ionicons name="fitness" size={50} color="#6366F1" />
            </View>
          </LinearGradient>
        </Animated.View>
        
        <Text style={styles.title}>Connecting...</Text>
        <Text style={styles.subtitle}>
          Pairing with {connectingDevice?.name || 'FOCUS R1'}{'\n'}
          This may take a moment
        </Text>
        
        <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
      </View>
    );
  };

  // Render connected step - simplified without data (SDK may be busy syncing)
  const renderConnected = () => (
    <View style={styles.stepContainer}>
      <View style={styles.successIcon}>
        <LinearGradient
          colors={['#10B981', '#059669']}
          style={styles.successGradient}
        >
          <Ionicons name="checkmark" size={60} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Connected!</Text>
      <Text style={styles.subtitle}>
        Your {connectedDevice?.name || connectingDevice?.name || 'FOCUS R1'} is ready to use
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onComplete}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          <Text style={styles.buttonText}>Continue to App</Text>
          <Ionicons name="arrow-forward" size={24} color="#fff" style={styles.buttonIconRight} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // Render checking step (looking for paired device)
  const renderChecking = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <LinearGradient
          colors={['#6366F1', '#8B5CF6', '#A855F7']}
          style={styles.iconGradient}
        >
          <Ionicons name="bluetooth" size={60} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Looking for your ring...</Text>
      <Text style={styles.subtitle}>
        Checking for previously paired devices
      </Text>

      <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
    </View>
  );

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'checking':
        return renderChecking();
      case 'welcome':
        return renderWelcome();
      case 'scanning':
        return renderScanning();
      case 'devices':
        return renderDevices();
      case 'connecting':
        return renderConnecting();
      case 'connected':
        return renderConnected();
    }
  };

  return (
    <LinearGradient
      colors={['#0F0F1A', '#1A1A2E', '#16213E']}
      style={styles.container}
    >
      {/* Background decoration */}
      <View style={styles.bgDecoration}>
        <View style={[styles.bgCircle, styles.bgCircle1]} />
        <View style={[styles.bgCircle, styles.bgCircle2]} />
      </View>
      
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {renderStep()}
      </Animated.View>
      
      {/* Step indicator - hidden during checking step */}
      {step !== 'checking' && (
        <View style={styles.stepIndicator}>
          {['welcome', 'scanning', 'devices', 'connecting', 'connected'].map((s, i) => (
            <View
              key={s}
              style={[
                styles.stepDot,
                step === s && styles.stepDotActive,
                ['scanning', 'devices', 'connecting', 'connected'].indexOf(step) >= i && styles.stepDotPassed,
              ]}
            />
          ))}
        </View>
      )}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: 400,
    height: 400,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -100,
    right: -150,
  },
  bgCircle2: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    bottom: 100,
    left: -100,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  stepContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: fontFamily.regular,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  primaryButton: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonIcon: {
    marginRight: 12,
  },
  buttonIconRight: {
    marginLeft: 12,
  },
  buttonText: {
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
  },
  skipButton: {
    marginTop: 24,
    paddingVertical: 12,
  },
  skipText: {
    fontSize: 16,
    fontFamily: fontFamily.regular,
    color: '#6B7280',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: '#6366F1',
    borderRadius: 16,
    width: '100%',
    marginTop: 16,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: '#6366F1',
  },
  scanningCircle: {
    marginBottom: 32,
  },
  scanningGradient: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  loader: {
    marginTop: 24,
  },
  deviceList: {
    width: '100%',
    maxHeight: 300,
  },
  deviceListContent: {
    paddingBottom: 16,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  deviceIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  deviceMac: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontFamily: fontFamily.regular,
    color: '#6B7280',
    marginTop: 16,
  },
  connectingRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  connectingInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0F0F1A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIcon: {
    marginBottom: 32,
  },
  successGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 50,
    gap: 8,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepDotActive: {
    backgroundColor: '#6366F1',
    width: 24,
  },
  stepDotPassed: {
    backgroundColor: 'rgba(99, 102, 241, 0.5)',
  },
});

export default OnboardingScreen;

