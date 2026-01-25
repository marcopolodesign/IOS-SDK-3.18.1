/**
 * StyledRingScreen - Ring connection and metrics with frosted glass styling
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Dimensions,
  Alert,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSmartRing } from '../hooks';
import { useOnboarding } from '../context/OnboardingContext';
import { GlassCard } from '../components/home/GlassCard';
import { fontFamily } from '../theme/colors';
import UnifiedSmartRingService from '../services/UnifiedSmartRingService';
import QCBandService from '../services/QCBandService';
import { SleepStageTimeline } from '../components/sleep/SleepStageTimeline';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ring icon
function RingIcon({ size = 80, battery }: { size?: number; battery?: number }) {
  const batteryColor = battery && battery > 20 ? '#4ADE80' : '#F87171';
  return (
    <View style={[styles.ringIconContainer, { width: size, height: size }]}>
      <View style={styles.ringOuterCircle}>
        <View style={styles.ringInnerCircle}>
          {battery !== undefined && (
            <Text style={styles.batteryText}>{battery}%</Text>
          )}
        </View>
      </View>
      {battery !== undefined && (
        <View style={[styles.batteryIndicator, { backgroundColor: batteryColor }]} />
      )}
    </View>
  );
}

// Status badge component
function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <View style={[styles.statusBadge, connected ? styles.statusConnected : styles.statusDisconnected]}>
      <View style={[styles.statusDot, { backgroundColor: connected ? '#4ADE80' : '#F87171' }]} />
      <Text style={styles.statusText}>{connected ? 'Connected' : 'Disconnected'}</Text>
    </View>
  );
}

// Metric card component
function MetricCard({ 
  icon, 
  title, 
  value, 
  unit, 
  color = 'rgba(255,255,255,0.9)' 
}: { 
  icon: React.ReactNode; 
  title: string; 
  value: string; 
  unit: string;
  color?: string;
}) {
  return (
    <GlassCard style={styles.metricCard}>
      <View style={styles.metricIcon}>{icon}</View>
      <Text style={styles.metricTitle}>{title}</Text>
      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>
    </GlassCard>
  );
}

// Heart icon
function HeartIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        fill="rgba(239,68,68,0.3)"
      />
    </Svg>
  );
}

// SpO2 icon
function SpO2Icon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke="rgba(255,255,255,0.9)" strokeWidth={1.5} />
      <Text style={{ color: 'white', fontSize: 10 }}>O₂</Text>
    </Svg>
  );
}

// Steps icon
function StepsIcon() {
  return (
    <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 16l4-8 4 8 4-8 4 8"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// HR Measurement Card with pulsing animation
function HRMeasurementCard({
  isMeasuring,
  liveHR,
  progress,
  onStartMeasure,
  onStopMeasure,
  pulseAnim,
}: {
  isMeasuring: boolean;
  liveHR: number | null;
  progress: number;
  onStartMeasure: () => void;
  onStopMeasure: () => void;
  pulseAnim: Animated.Value;
}) {
  return (
    <GlassCard style={hrStyles.container}>
      <View style={hrStyles.row}>
        <Animated.View
          style={[
            hrStyles.iconContainer,
            isMeasuring && { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={[hrStyles.iconGradient, isMeasuring && hrStyles.iconGradientActive]}>
            <Ionicons name="heart" size={32} color="#fff" />
          </View>
        </Animated.View>

        <View style={hrStyles.content}>
          {isMeasuring ? (
            <>
              <View style={hrStyles.measuringRow}>
                <Text style={hrStyles.measuringText}>
                  {liveHR && liveHR > 0 ? (
                    <Text style={hrStyles.liveValue}>{liveHR}</Text>
                  ) : (
                    'Measuring...'
                  )}
                </Text>
                <ActivityIndicator size="small" color="#EF4444" style={hrStyles.spinner} />
              </View>
              <Text style={hrStyles.subtext}>Keep your ring on for accurate reading</Text>
              <View style={hrStyles.progressBar}>
                <View style={[hrStyles.progressFill, { width: `${progress}%` }]} />
              </View>
            </>
          ) : (
            <>
              <Text style={hrStyles.title}>Real-Time Heart Rate</Text>
              <Text style={hrStyles.subtext}>Measure your current heart rate</Text>
            </>
          )}
        </View>

        <TouchableOpacity
          style={[hrStyles.actionButton, isMeasuring && hrStyles.stopButton]}
          onPress={isMeasuring ? onStopMeasure : onStartMeasure}
        >
          <Ionicons
            name={isMeasuring ? 'stop' : 'play'}
            size={20}
            color={isMeasuring ? '#F87171' : '#4ADE80'}
          />
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

const hrStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 14,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  iconGradientActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.6)',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  measuringRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measuringText: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.95)',
  },
  liveValue: {
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
    color: '#EF4444',
  },
  spinner: {
    marginLeft: 8,
  },
  subtext: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(74, 222, 128, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: 'rgba(248, 113, 113, 0.25)',
    borderColor: 'rgba(248, 113, 113, 0.4)',
  },
});

// Sleep Data Card
function SleepDataCard({
  sleepData,
  isLoading,
  hasError,
  onRefresh,
}: {
  sleepData: {
    totalSleepMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    awakeMinutes: number;
    napMinutes: number;
  } | null;
  isLoading: boolean;
  hasError: boolean;
  onRefresh: () => void;
}) {
  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  const totalMinutes = sleepData?.totalSleepMinutes || 0;
  const deepPercent = totalMinutes > 0 ? (sleepData?.deepMinutes || 0) / totalMinutes * 100 : 0;
  const lightPercent = totalMinutes > 0 ? (sleepData?.lightMinutes || 0) / totalMinutes * 100 : 0;
  const remPercent = totalMinutes > 0 ? (sleepData?.remMinutes || 0) / totalMinutes * 100 : 0;

  return (
    <GlassCard style={sleepStyles.container}>
      <View style={sleepStyles.header}>
        <View style={sleepStyles.headerLeft}>
          <View style={sleepStyles.iconGradient}>
            <Ionicons name="moon" size={24} color="#fff" />
          </View>
          <View>
            <Text style={sleepStyles.title}>Last Night's Sleep</Text>
            <Text style={sleepStyles.subtext}>
              {sleepData ? 'Today' : 'No data yet'}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onRefresh} disabled={isLoading} style={sleepStyles.refreshBtn}>
          {isLoading ? (
            <ActivityIndicator size="small" color="#818CF8" />
          ) : (
            <Ionicons name="refresh" size={18} color="#818CF8" />
          )}
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={sleepStyles.loadingContainer}>
          <ActivityIndicator size="small" color="#818CF8" />
          <Text style={sleepStyles.loadingText}>Loading sleep data...</Text>
        </View>
      ) : hasError || !sleepData ? (
        <View style={sleepStyles.errorContainer}>
          <Text style={sleepStyles.errorText}>
            {hasError ? 'Failed to load sleep data' : 'No sleep data recorded'}
          </Text>
        </View>
      ) : (
        <>
          {/* Total Sleep */}
          <View style={sleepStyles.totalRow}>
            <Text style={sleepStyles.totalValue}>{formatTime(totalMinutes)}</Text>
            <Text style={sleepStyles.totalLabel}>total sleep</Text>
          </View>

          {/* Sleep Stage Bar */}
          <View style={sleepStyles.stageBar}>
            <View style={[sleepStyles.stageSegment, sleepStyles.deepSegment, { flex: deepPercent || 1 }]} />
            <View style={[sleepStyles.stageSegment, sleepStyles.lightSegment, { flex: lightPercent || 1 }]} />
            <View style={[sleepStyles.stageSegment, sleepStyles.remSegment, { flex: remPercent || 1 }]} />
          </View>

          {/* Sleep Stages Breakdown */}
          <View style={sleepStyles.stagesRow}>
            <View style={sleepStyles.stageItem}>
              <View style={[sleepStyles.stageDot, sleepStyles.deepDot]} />
              <Text style={sleepStyles.stageLabel}>Deep</Text>
              <Text style={sleepStyles.stageValue}>{formatTime(sleepData.deepMinutes)}</Text>
            </View>
            <View style={sleepStyles.stageItem}>
              <View style={[sleepStyles.stageDot, sleepStyles.lightDot]} />
              <Text style={sleepStyles.stageLabel}>Light</Text>
              <Text style={sleepStyles.stageValue}>{formatTime(sleepData.lightMinutes)}</Text>
            </View>
            <View style={sleepStyles.stageItem}>
              <View style={[sleepStyles.stageDot, sleepStyles.remDot]} />
              <Text style={sleepStyles.stageLabel}>REM</Text>
              <Text style={sleepStyles.stageValue}>{formatTime(sleepData.remMinutes)}</Text>
            </View>
            <View style={sleepStyles.stageItem}>
              <View style={[sleepStyles.stageDot, sleepStyles.awakeDot]} />
              <Text style={sleepStyles.stageLabel}>Awake</Text>
              <Text style={sleepStyles.stageValue}>{formatTime(sleepData.awakeMinutes)}</Text>
            </View>
          </View>
        </>
      )}
    </GlassCard>
  );
}

const sleepStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(129, 140, 248, 0.4)',
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.5)',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.95)',
  },
  subtext: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  errorText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 12,
  },
  totalValue: {
    fontSize: 32,
    fontFamily: fontFamily.demiBold,
    color: '#fff',
  },
  totalLabel: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  stageBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  stageSegment: {
    height: '100%',
  },
  deepSegment: {
    backgroundColor: '#6366F1',
  },
  lightSegment: {
    backgroundColor: '#818CF8',
  },
  remSegment: {
    backgroundColor: '#A5B4FC',
  },
  stagesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stageItem: {
    alignItems: 'center',
  },
  stageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  deepDot: {
    backgroundColor: '#6366F1',
  },
  lightDot: {
    backgroundColor: '#818CF8',
  },
  remDot: {
    backgroundColor: '#A5B4FC',
  },
  awakeDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  stageLabel: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 2,
  },
  stageValue: {
    fontSize: 13,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
});

export function StyledRingScreen() {
  const insets = useSafeAreaInsets();
  const { hasConnectedDevice, pairedDeviceMac } = useOnboarding();
  const {
    connectionState,
    isConnected,
    isScanning,
    devices,
    connectedDevice,
    battery,
    metrics,
    isLoadingMetrics,
    isMockMode,
    isAutoConnecting,
    scan,
    connect,
    disconnect,
    refreshMetrics,
    autoConnect,
    checkForPairedDevice,
  } = useSmartRing();

  const [connectingMac, setConnectingMac] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [initialDataError, setInitialDataError] = useState(false);
  
  // HR Measurement state
  const [isMeasuringHR, setIsMeasuringHR] = useState(false);
  const [liveHR, setLiveHR] = useState<number | null>(null);
  const [hrProgress, setHrProgress] = useState(0);
  const [lastMeasuredHR, setLastMeasuredHR] = useState<number | null>(null);
  const [lastMeasuredTime, setLastMeasuredTime] = useState<Date | null>(null);
  const hrListenerRef = useRef<(() => void) | null>(null);
  const hrTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Sleep data state
  const [sleepData, setSleepData] = useState<{
    totalSleepMinutes: number;
    deepMinutes: number;
    lightMinutes: number;
    remMinutes: number;
    awakeMinutes: number;
    napMinutes: number;
  } | null>(null);
  const [isLoadingSleep, setIsLoadingSleep] = useState(false);
  const [sleepError, setSleepError] = useState(false);
  
  // Pulse animation for HR measurement
  const pulseAnim = useRef(new Animated.Value(1)).current;
  
  // Pulse animation effect
  useEffect(() => {
    if (isMeasuringHR) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isMeasuringHR, pulseAnim]);
  
  // Start HR measurement
  const startHRMeasurement = useCallback(async () => {
    console.log('💓 [RingScreen] Starting HR measurement...');
    setIsMeasuringHR(true);
    setLiveHR(null);
    setHrProgress(0);
    
    // Set up listener for HR data
    hrListenerRef.current = QCBandService.onHeartRateData((data) => {
      console.log('💓 [RingScreen] HR data received:', data);
      if (data.isMeasuring && data.heartRate > 0) {
        setLiveHR(data.heartRate);
        setHrProgress(prev => Math.min(prev + 15, 85));
      }
      if (data.isFinal && data.heartRate > 0) {
        setLiveHR(data.heartRate);
        setHrProgress(100);
        // Save as last measured result
        setLastMeasuredHR(data.heartRate);
        setLastMeasuredTime(new Date());
        console.log('💓 [RingScreen] Final HR saved:', data.heartRate);
        // Keep showing for a moment then stop
        setTimeout(() => {
          stopHRMeasurement();
        }, 2000);
      }
    });
    
    // Start the measurement
    try {
      await UnifiedSmartRingService.measureHeartRate();
    } catch (error) {
      console.log('💓 [RingScreen] HR measurement error:', error);
      Alert.alert('Measurement Failed', 'Could not start heart rate measurement. Please try again.');
      stopHRMeasurement();
    }
    
    // Timeout after 45 seconds
    hrTimeoutRef.current = setTimeout(() => {
      if (isMeasuringHR) {
        console.log('💓 [RingScreen] HR measurement timeout');
        stopHRMeasurement();
      }
    }, 45000);
  }, []);
  
  // Stop HR measurement
  const stopHRMeasurement = useCallback(() => {
    console.log('💓 [RingScreen] Stopping HR measurement');
    setIsMeasuringHR(false);
    
    if (hrListenerRef.current) {
      hrListenerRef.current();
      hrListenerRef.current = null;
    }
    
    if (hrTimeoutRef.current) {
      clearTimeout(hrTimeoutRef.current);
      hrTimeoutRef.current = null;
    }
    
    // Try to stop the native measurement
    QCBandService.stopHeartRateMeasuring().catch(() => {});
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hrListenerRef.current) {
        hrListenerRef.current();
      }
      if (hrTimeoutRef.current) {
        clearTimeout(hrTimeoutRef.current);
      }
    };
  }, []);
  
  // Fetch sleep data
  const fetchSleepData = useCallback(async () => {
    console.log('😴 [RingScreen] Fetching sleep data...');
    setIsLoadingSleep(true);
    setSleepError(false);
    
    try {
      const result = await UnifiedSmartRingService.getSleepData();
      console.log('😴 [RingScreen] Sleep data received:', result);
      
      if (result) {
        const totalSleep = (result.deep || 0) + (result.light || 0) + (result.rem || 0);
        setSleepData({
          totalSleepMinutes: totalSleep,
          deepMinutes: result.deep || 0,
          lightMinutes: result.light || 0,
          remMinutes: result.rem || 0,
          awakeMinutes: result.awake || 0,
          napMinutes: 0, // Will need to fetch nap data separately if available
        });
      }
    } catch (error) {
      console.log('😴 [RingScreen] Sleep data error:', error);
      setSleepError(true);
    } finally {
      setIsLoadingSleep(false);
    }
  }, []);

  // Use hasConnectedDevice from onboarding context OR isConnected from hook
  // This ensures we show connected state if device was paired during onboarding
  const showConnected = hasConnectedDevice || isConnected;

  // NOTE: Auto-reconnect logic has been MOVED to app/(tabs)/_layout.tsx
  // This prevents duplicate auto-connect attempts from multiple components
  // The TabLayout is the single source of truth for auto-reconnect

  // Log full connection status on screen mount/focus
  // DISABLED: Verbose logging disabled to reduce noise - re-enable for debugging ring screen
  // useEffect(() => {
  //   console.log('📱 StyledRingScreen mounted - checking connection status...');
  //   console.log('📱 hasConnectedDevice (onboarding):', hasConnectedDevice);
  //   console.log('📱 isConnected (hook):', isConnected, 'connectionState:', connectionState);
  //   console.log('📱 showConnected:', showConnected);
  //
  //   // Get full status from native module
  //   UnifiedSmartRingService.getFullConnectionStatus().then(status => {
  //     console.log('📊📊📊 RING SCREEN - FULL CONNECTION STATUS 📊📊📊');
  //     console.log('📊 Manager State:', status.managerState, '(code:', status.managerStateCode, ')');
  //     console.log('📊 Cached State:', status.cachedState, '(code:', status.cachedStateCode, ')');
  //     console.log('📊 Is Connected:', status.isConnected);
  //     console.log('📊 Device:', status.deviceName, '(MAC:', status.deviceMac, ')');
  //     console.log('📊 State Mapping: 0=Unbind, 1=Connecting, 2=Connected, 3=Disconnecting, 4=Disconnected, 5=Syncing, 6=SyncSuccess, 7=SyncError');
  //     console.log('📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊📊');
  //   });
  // }, [isConnected, connectionState, hasConnectedDevice, showConnected]);

  // Fetch initial data when connected (similar to success screen)
  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchInitialData = async () => {
      // Check both onboarding state and actual connection
      if (!showConnected) {
        setIsInitialLoading(false);
        return;
      }
      
      // If we have hasConnectedDevice but not isConnected yet, wait for auto-reconnect
      if (hasConnectedDevice && !isConnected && isAutoConnecting) {
        console.log('📱 Waiting for auto-reconnect to complete...');
        return;
      }

      // Only proceed if actually connected
      if (!isConnected) {
        setIsInitialLoading(false);
        return;
      }

      // DISABLED: Verbose logging - re-enable for debugging
      // console.log('📱 StyledRingScreen: Waiting for connection to settle, then fetching device data...');
      setIsInitialLoading(true);
      setInitialDataError(false);

      try {
        // IMPORTANT: Wait 1500ms after connection (same as success screen)
        // Connection promise resolves after SyncSuccess (state 6), but SDK needs time to settle
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (!mounted) return;

        // Fetch data sequentially (matching success screen pattern exactly)
        // Battery first
        const batteryResult = await UnifiedSmartRingService.getBattery().catch((err) => {
          console.log('Battery fetch failed:', err);
          return null;
        });

        if (!mounted) return;

        // Small delay between requests (same as success screen)
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!mounted) return;

        // Steps second
        const stepsResult = await UnifiedSmartRingService.getSteps().catch((err) => {
          console.log('Steps fetch failed:', err);
          return null;
        });

        if (!mounted) return;

        // Only refresh metrics if we got some data - don't overwhelm the SDK
        // The refreshMetrics will handle heart rate and SpO2 separately
        if (batteryResult || stepsResult) {
          // Wait a bit before calling refreshMetrics to avoid overwhelming the SDK
          await new Promise(resolve => setTimeout(resolve, 500));
          if (mounted) {
            await refreshMetrics();
          }
          
          // Fetch sleep data after a delay
          await new Promise(resolve => setTimeout(resolve, 500));
          if (mounted) {
            setIsLoadingSleep(true);
            try {
              const sleepResult = await UnifiedSmartRingService.getSleepData();
              console.log('😴 Initial sleep data:', sleepResult);
              if (mounted && sleepResult) {
                const totalSleep = (sleepResult.deep || 0) + (sleepResult.light || 0) + (sleepResult.rem || 0);
                setSleepData({
                  totalSleepMinutes: totalSleep,
                  deepMinutes: sleepResult.deep || 0,
                  lightMinutes: sleepResult.light || 0,
                  remMinutes: sleepResult.rem || 0,
                  awakeMinutes: sleepResult.awake || 0,
                  napMinutes: 0,
                });
              }
            } catch (sleepErr) {
              console.log('😴 Sleep data fetch failed:', sleepErr);
              if (mounted) setSleepError(true);
            } finally {
              if (mounted) setIsLoadingSleep(false);
            }
          }
        }

        if (!mounted) return;

        // If both failed, set error state but still allow continuing
        if (!batteryResult && !stepsResult) {
          setInitialDataError(true);
        }
      } catch (error) {
        console.log('Failed to fetch initial device data:', error);
        if (mounted) {
          setInitialDataError(true);
        }
      } finally {
        if (mounted) {
          setIsInitialLoading(false);
        }
      }
    };

    // Delay the fetch slightly to ensure state is stable
    timeoutId = setTimeout(() => {
      fetchInitialData();
    }, 200);

    return () => {
      mounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showConnected, hasConnectedDevice, isConnected, isAutoConnecting, refreshMetrics]);

  const handleScan = async () => {
    await scan(15);
  };

  const handleRefreshMetrics = async () => {
    await refreshMetrics();
  };

  const handleConnect = async (mac: string) => {
    setConnectingMac(mac);
    console.log('🔗 [StyledRingScreen] Starting connection to:', mac);
    try {
      await connect(mac);
    } catch (error: any) {
      console.log('❌ [StyledRingScreen] Connection error:', error?.message);
      const errorMessage = error?.message || 'Connection failed';
      const isTimeout = errorMessage.toLowerCase().includes('timeout');
      
      Alert.alert(
        isTimeout ? 'Connection Timeout' : 'Connection Failed',
        isTimeout 
          ? 'The ring did not respond in time. Make sure the ring is awake by tapping it, then try again.'
          : errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Retry', 
            onPress: () => handleConnect(mac),
            style: 'default'
          }
        ]
      );
    } finally {
      setConnectingMac(null);
    }
  };

  return (
    <ImageBackground
      source={require('../assets/backgrounds/activity.jpg')}
      style={styles.backgroundImage}
      resizeMode="cover"
    >
      {/* Dark overlay for better readability */}
      <View style={styles.overlay} />
      
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Smart Ring</Text>
          <StatusBadge connected={isConnected} />
        </View>

        {isMockMode && (
          <View style={styles.mockBanner}>
            <Text style={styles.mockText}>Demo Mode</Text>
          </View>
        )}

        <ScrollView 
          style={styles.scrollView} 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {showConnected || (hasConnectedDevice && isAutoConnecting) ? (
            <>
              {/* Connecting State (if auto-reconnecting) */}
              {isAutoConnecting ? (
                <GlassCard style={styles.loadingCard}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.loadingText}>Reconnecting to your ring...</Text>
                </GlassCard>
              ) : isConnected && connectedDevice ? (
                <>
                  {/* Connected Ring Card */}
                  <GlassCard style={styles.ringCard}>
                    <RingIcon size={100} battery={battery ?? undefined} />
                    <Text style={styles.ringName}>{connectedDevice.name || 'Smart Ring'}</Text>
                    <Text style={styles.ringMac}>{connectedDevice.mac || pairedDeviceMac || 'Unknown'}</Text>
                    
                    <TouchableOpacity style={styles.disconnectButton} onPress={disconnect}>
                      <Text style={styles.disconnectText}>Disconnect</Text>
                    </TouchableOpacity>
                  </GlassCard>

                  {/* Loading or Error State */}
                  {isInitialLoading ? (
                    <GlassCard style={styles.loadingCard}>
                      <ActivityIndicator size="large" color="#6366F1" />
                      <Text style={styles.loadingText}>Syncing with your ring...</Text>
                    </GlassCard>
                  ) : initialDataError ? (
                    <GlassCard style={styles.errorCard}>
                      <Ionicons name="information-circle" size={32} color="#6B7280" />
                      <Text style={styles.errorText}>
                        Could not fetch data right now.{'\n'}
                        Tap refresh to try again.
                      </Text>
                    </GlassCard>
                  ) : (
                    <>
                      {/* Real-Time HR Measurement */}
                      <HRMeasurementCard
                        isMeasuring={isMeasuringHR}
                        liveHR={liveHR}
                        progress={hrProgress}
                        onStartMeasure={startHRMeasurement}
                        onStopMeasure={stopHRMeasurement}
                        pulseAnim={pulseAnim}
                      />
                      
                      {/* Last Measured HR Result */}
                      {lastMeasuredHR && lastMeasuredTime && !isMeasuringHR && (
                        <View style={styles.lastResultContainer}>
                          <View style={styles.lastResultRow}>
                            <Ionicons name="checkmark-circle" size={16} color="#4ADE80" />
                            <Text style={styles.lastResultLabel}>Last measurement:</Text>
                            <Text style={styles.lastResultValue}>{lastMeasuredHR}</Text>
                            <Text style={styles.lastResultUnit}>bpm</Text>
                          </View>
                          <Text style={styles.lastResultTime}>
                            {lastMeasuredTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>
                      )}
                      
                      {/* Sleep Data */}
                      <SleepDataCard
                        sleepData={sleepData}
                        isLoading={isLoadingSleep}
                        hasError={sleepError}
                        onRefresh={fetchSleepData}
                      />
                      
                      {/* Sleep Stage Timeline - Ring vs Custom Analysis */}
                      <SleepStageTimeline dayIndex={0} />
                      
                      {/* Metrics Grid */}
                      <View style={styles.metricsHeader}>
                        <Text style={styles.sectionTitle}>Live Metrics</Text>
                        <TouchableOpacity 
                          style={styles.refreshButton} 
                          onPress={handleRefreshMetrics}
                          disabled={isLoadingMetrics}
                        >
                          <Text style={styles.refreshText}>
                            {isLoadingMetrics ? 'Loading...' : 'Refresh'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.metricsGrid}>
                        <MetricCard
                          icon={<HeartIcon />}
                          title="Heart Rate"
                          value={metrics.heartRate?.toString() ?? '--'}
                          unit="bpm"
                          color="#F87171"
                        />
                        <MetricCard
                          icon={<SpO2Icon />}
                          title="Blood Oxygen"
                          value={metrics.spo2?.toString() ?? '--'}
                          unit="%"
                          color="#60A5FA"
                        />
                        <MetricCard
                          icon={<StepsIcon />}
                          title="Steps"
                          value={metrics.steps?.toLocaleString() ?? '--'}
                          unit="today"
                          color="#4ADE80"
                        />
                        <MetricCard
                          icon={<RingIcon size={24} />}
                          title="Battery"
                          value={battery?.toString() ?? '--'}
                          unit="%"
                          color={(battery ?? 0) > 20 ? '#4ADE80' : '#F87171'}
                        />
                      </View>
                    </>
                  )}
                </>
              ) : hasConnectedDevice ? (
                <GlassCard style={styles.loadingCard}>
                  <ActivityIndicator size="large" color="#6366F1" />
                  <Text style={styles.loadingText}>Preparing to connect...</Text>
                </GlassCard>
              ) : null}
            </>
          ) : (
            <>
              {/* Not Connected State */}
              <GlassCard style={styles.connectCard}>
                <RingIcon size={120} />
                <Text style={styles.connectTitle}>Connect Your Ring</Text>
                <Text style={styles.connectDescription}>
                  Tap the button below to scan for nearby Smart Ring devices
                </Text>
                
                <TouchableOpacity 
                  style={[styles.scanButton, isScanning && styles.scanButtonScanning]}
                  onPress={handleScan}
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <View style={styles.scanningRow}>
                      <ActivityIndicator size="small" color="white" />
                      <Text style={styles.scanButtonText}>Scanning...</Text>
                    </View>
                  ) : (
                    <Text style={styles.scanButtonText}>Scan for Devices</Text>
                  )}
                </TouchableOpacity>
              </GlassCard>

              {/* Available Devices */}
              {devices.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Available Devices</Text>
                  {devices.map((device) => (
                    <GlassCard key={device.mac} style={styles.deviceCard}>
                      <View style={styles.deviceInfo}>
                        <View style={styles.deviceIconSmall}>
                          <RingIcon size={40} />
                        </View>
                        <View>
                          <Text style={styles.deviceName}>{device.name || 'Unknown Ring'}</Text>
                          <Text style={styles.deviceMac}>{device.mac}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.connectDeviceButton}
                        onPress={() => handleConnect(device.mac)}
                        disabled={connectingMac === device.mac}
                      >
                        {connectingMac === device.mac ? (
                          <ActivityIndicator size="small" color="white" />
                        ) : (
                          <Text style={styles.connectDeviceText}>Connect</Text>
                        )}
                      </TouchableOpacity>
                    </GlassCard>
                  ))}
                </>
              )}

              {/* Help Section */}
              <GlassCard style={styles.helpCard}>
                <Text style={styles.helpTitle}>Troubleshooting</Text>
                <Text style={styles.helpText}>
                  • Make sure your Smart Ring is charged{'\n'}
                  • Keep the ring close to your phone{'\n'}
                  • Ensure Bluetooth is enabled{'\n'}
                  • Try restarting the ring if not detected
                </Text>
              </GlassCard>

              {/* SDK Info Card */}
              <GlassCard style={styles.infoCard}>
                <Text style={styles.infoTitle}>📖 Data Reference</Text>
                <Text style={styles.infoText}>
                  <Text style={styles.infoBold}>Battery:</Text> One-shot read or real-time updates{'\n'}
                  <Text style={styles.infoBold}>Steps:</Text> Today's total + 7-day history{'\n'}
                  <Text style={styles.infoBold}>Sleep:</Text> Night sleep + daytime naps{'\n'}
                  <Text style={styles.infoBold}>Heart Rate:</Text> On-demand measurement
                </Text>
                <Text style={styles.infoSubtext}>
                  See QCBANDSDK_INTEGRATION.md for full API docs
                </Text>
              </GlassCard>
            </>
          )}
        </ScrollView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
    color: 'white',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusConnected: {
    backgroundColor: 'rgba(74, 222, 128, 0.2)',
  },
  statusDisconnected: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  mockBanner: {
    backgroundColor: 'rgba(251, 191, 36, 0.3)',
    paddingVertical: 6,
    alignItems: 'center',
  },
  mockText: {
    fontSize: 11,
    fontFamily: fontFamily.demiBold,
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  ringCard: {
    alignItems: 'center',
    paddingVertical: 32,
    marginBottom: 24,
  },
  ringIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringOuterCircle: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  ringInnerCircle: {
    width: '70%',
    height: '70%',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  batteryText: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: 'white',
  },
  batteryIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  ringName: {
    fontSize: 20,
    fontFamily: fontFamily.demiBold,
    color: 'white',
    marginTop: 16,
  },
  ringMac: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  disconnectButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(248, 113, 113, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.5)',
  },
  disconnectText: {
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
    color: '#F87171',
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.9)',
    marginLeft: 4,
  },
  metricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  refreshButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  refreshText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontFamily: fontFamily.regular,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    padding: 16,
    alignItems: 'flex-start',
  },
  metricIcon: {
    marginBottom: 8,
  },
  metricTitle: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  metricValue: {
    fontSize: 28,
    fontFamily: fontFamily.demiBold,
  },
  metricUnit: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  connectCard: {
    alignItems: 'center',
    paddingVertical: 40,
    marginBottom: 24,
  },
  connectTitle: {
    fontSize: 22,
    fontFamily: fontFamily.demiBold,
    color: 'white',
    marginTop: 24,
  },
  connectDescription: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 20,
    lineHeight: 20,
  },
  scanButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    backgroundColor: 'rgba(96, 165, 250, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(96, 165, 250, 0.6)',
  },
  scanButtonScanning: {
    backgroundColor: 'rgba(96, 165, 250, 0.2)',
  },
  scanningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanButtonText: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: 'white',
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginBottom: 12,
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deviceIconSmall: {
    opacity: 0.8,
  },
  deviceName: {
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
    color: 'white',
  },
  deviceMac: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 2,
  },
  connectDeviceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.5)',
  },
  connectDeviceText: {
    fontSize: 13,
    fontFamily: fontFamily.demiBold,
    color: '#4ADE80',
  },
  helpCard: {
    padding: 20,
    marginTop: 12,
  },
  helpTitle: {
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  helpText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 22,
  },
  infoCard: {
    padding: 20,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.3)',
  },
  infoTitle: {
    fontSize: 14,
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: 22,
  },
  infoBold: {
    fontFamily: fontFamily.demiBold,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  infoSubtext: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: 'rgba(99, 102, 241, 0.8)',
    marginTop: 12,
    fontStyle: 'italic',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    marginBottom: 24,
    minHeight: 120,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 12,
  },
  errorCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginBottom: 24,
    minHeight: 120,
  },
  errorText: {
    fontSize: 14,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  lastResultContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  lastResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  lastResultLabel: {
    fontSize: 13,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  lastResultValue: {
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    color: '#EF4444',
  },
  lastResultUnit: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  lastResultTime: {
    fontSize: 12,
    fontFamily: fontFamily.regular,
    color: 'rgba(255, 255, 255, 0.4)',
  },
});

export default StyledRingScreen;

