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
import { router } from 'expo-router';
import { useSmartRing } from '../../src/hooks/useSmartRing';
import type { DeviceInfo } from '../../src/types/sdk.types';

const { width, height } = Dimensions.get('window');

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

  // Log state on every render
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
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringRotation = useRef(new Animated.Value(0)).current;

  // Log step changes
  useEffect(() => {
    console.log('🟡 [ConnectScreen] Step changed to:', step);
  }, [step]);

  // Log devices changes
  useEffect(() => {
    console.log('🟢 [ConnectScreen] Devices updated:', {
      count: devices.length,
      devices: devices.map(d => ({ name: d.name, mac: d.mac, id: d.id })),
    });
  }, [devices]);

  // Log scanning state
  useEffect(() => {
    console.log('🔍 [ConnectScreen] isScanning changed to:', isScanning);
  }, [isScanning]);

  // Log scanComplete state
  useEffect(() => {
    console.log('✅ [ConnectScreen] scanComplete changed to:', scanComplete);
  }, [scanComplete]);

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
  const transitionTo = (newStep: ConnectionStep) => {
    console.log('🔄 [ConnectScreen] transitionTo called:', { from: step, to: newStep });
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
    console.log('🔍 [ConnectScreen] handleScan START');
    console.log('🔍 [ConnectScreen] Setting scanComplete = false');
    setScanComplete(false);
    
    console.log('🔍 [ConnectScreen] Transitioning to scanning step');
    transitionTo('scanning');
    
    console.log('🔍 [ConnectScreen] Calling scan(10) - waiting for scan to complete...');
    const startTime = Date.now();
    await scan(10);
    const elapsed = Date.now() - startTime;
    console.log(`🔍 [ConnectScreen] scan(10) completed after ${elapsed}ms`);
    
    // Wait additional time for devices to arrive via event listeners
    // BLE discovery happens asynchronously - devices arrive via onDeviceDiscovered events
    // Give devices time to be discovered after the scan function returns
    console.log('🔍 [ConnectScreen] Waiting for devices to arrive via event listeners...');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s for devices
    
    console.log('🔍 [ConnectScreen] Setting scanComplete = true');
    setScanComplete(true);
    
    console.log('🔍 [ConnectScreen] Transitioning to devices step');
    transitionTo('devices');
    console.log('🔍 [ConnectScreen] handleScan END');
  };

  // Handle connect
  const handleConnect = async (device: DeviceInfo) => {
    console.log('🔗 [ConnectScreen] handleConnect START');
    console.log('🔗 [ConnectScreen] Device to connect:', {
      name: device.name,
      mac: device.mac,
      id: device.id,
      rssi: device.rssi,
    });
    
    console.log('🔗 [ConnectScreen] Setting connectingDevice');
    setConnectingDevice(device);
    
    console.log('🔗 [ConnectScreen] Transitioning to connecting step');
    transitionTo('connecting');

    try {
      console.log('🔗 [ConnectScreen] Calling connect() with MAC:', device.mac);
      const startTime = Date.now();
      
      const success = await connect(device.mac);
      
      const elapsed = Date.now() - startTime;
      console.log(`🔗 [ConnectScreen] connect() returned after ${elapsed}ms`);
      console.log('🔗 [ConnectScreen] connect() result:', success);
      
      if (success) {
        console.log('✅ [ConnectScreen] Connection SUCCESS! Navigating to success screen...');
        
        // Navigate to success screen with device info
        router.replace({
          pathname: '/(onboarding)/success',
          params: {
            deviceName: device.name || 'Smart Ring',
            deviceMac: device.mac
          },
        });
        console.log('✅ [ConnectScreen] Navigation called');
      } else {
        console.log('❌ [ConnectScreen] Connection FAILED (returned false)');
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
      console.log('❌ [ConnectScreen] Connection ERROR:', error);
      console.log('❌ [ConnectScreen] Error details:', JSON.stringify(error, null, 2));
      Alert.alert(
        'Connection Error',
        'An error occurred while connecting. Please try again.',
        [{ text: 'OK', onPress: () => transitionTo('devices') }]
      );
    }
    console.log('🔗 [ConnectScreen] handleConnect END');
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

      <Text style={styles.title}>Connect Your Ring</Text>
      <Text style={styles.subtitle}>
        Let's pair your smart ring to start tracking your health metrics
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
        Looking for nearby smart rings.{'\n'}Make sure your ring is charged and nearby.
      </Text>

      <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
    </View>
  );

  // Filter devices that have a valid MAC address
  const validDevices = devices.filter(d => {
    const hasValidMac = d.mac && d.mac.length > 0 && d.mac !== 'undefined' && d.mac !== 'null';
    if (!hasValidMac) {
      console.log('⏭️ [ConnectScreen] Skipping device without valid MAC:', { name: d.name, mac: d.mac, id: d.id });
    }
    return hasValidMac;
  });

  console.log('📋 [ConnectScreen] Valid devices for display:', validDevices.length, 'out of', devices.length);

  // Render device item
  const renderDeviceItem = ({ item }: { item: DeviceInfo }) => {
    console.log('📱 [ConnectScreen] Rendering device item:', { name: item.name, mac: item.mac });
    return (
      <TouchableOpacity
        style={styles.deviceItem}
        onPress={() => handleConnect(item)}
      >
        <View style={styles.deviceIcon}>
          <Ionicons name="fitness" size={28} color="#6366F1" />
        </View>
        <View style={styles.deviceInfo}>
          <Text style={styles.deviceName}>{item.name || 'Smart Ring'}</Text>
          <Text style={styles.deviceMac}>{item.mac}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="#6B7280" />
      </TouchableOpacity>
    );
  };

  // Render devices step (with troubleshooting tips when empty)
  const renderDevices = () => {
    console.log('🖼️ [ConnectScreen] renderDevices called:', {
      validDevicesCount: validDevices.length,
      scanComplete,
    });
    
    // Show loading if scan just finished but devices not yet rendered
    const showDevices = validDevices.length > 0;
    const showNoDevices = scanComplete && validDevices.length === 0;
    const showLoading = !scanComplete && !showDevices;
    
    console.log('🖼️ [ConnectScreen] renderDevices state:', { showDevices, showNoDevices, showLoading });

    if (showLoading) {
      return (
        <View style={styles.stepContainer}>
          <Text style={styles.title}>Loading...</Text>
          <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
        </View>
      );
    }

    return (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>
        {showDevices ? 'Devices Found' : 'No Devices Found'}
      </Text>
      <Text style={styles.subtitle}>
        {showDevices
          ? 'Tap a device to connect'
          : 'Please check the following and try again'}
      </Text>

      {showDevices ? (
        <FlatList
          data={validDevices}
          renderItem={renderDeviceItem}
          keyExtractor={(item) => item.mac}
          style={styles.deviceList}
          contentContainerStyle={styles.deviceListContent}
        />
      ) : (
        <View style={styles.troubleshootingContainer}>
          <View style={styles.troubleshootingItem}>
            <Ionicons name="battery-charging" size={24} color="#6366F1" />
            <Text style={styles.troubleshootingText}>
              Make sure your ring is charged and nearby
            </Text>
          </View>
          <View style={styles.troubleshootingItem}>
            <Ionicons name="bluetooth" size={24} color="#6366F1" />
            <Text style={styles.troubleshootingText}>
              Ensure Bluetooth is enabled on your phone
            </Text>
          </View>
          <View style={styles.troubleshootingItem}>
            <Ionicons name="refresh" size={24} color="#6366F1" />
            <Text style={styles.troubleshootingText}>
              Try restarting the ring by placing it on the charger
            </Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.secondaryButton} onPress={handleScan}>
        <Ionicons name="refresh" size={20} color="#6366F1" style={styles.buttonIcon} />
        <Text style={styles.secondaryButtonText}>Scan Again</Text>
      </TouchableOpacity>
    </View>
    );
  };

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
          Pairing with {connectingDevice?.name || 'Smart Ring'}{'\n'}
          This may take a moment
        </Text>

        <ActivityIndicator size="large" color="#6366F1" style={styles.loader} />
      </View>
    );
  };

  // Render current step
  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return renderWelcome();
      case 'scanning':
        return renderScanning();
      case 'devices':
        return renderDevices();
      case 'connecting':
        return renderConnecting();
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

      {/* Step indicator */}
      <View style={styles.stepIndicator}>
        {['welcome', 'scanning', 'devices', 'connecting'].map((s, i) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              step === s && styles.stepDotActive,
              ['scanning', 'devices', 'connecting'].indexOf(step) >= i && styles.stepDotPassed,
            ]}
          />
        ))}
      </View>
    </LinearGradient>
  );
}

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
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
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
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
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
    fontWeight: '600',
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
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  deviceMac: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  troubleshootingContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  troubleshootingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  troubleshootingText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginLeft: 12,
    flex: 1,
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
