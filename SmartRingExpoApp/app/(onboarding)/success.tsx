import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '../../src/context/OnboardingContext';
import UnifiedSmartRingService from '../../src/services/UnifiedSmartRingService';
import QCBandService from '../../src/services/QCBandService';

type DataPhase = 'syncing' | 'measuring_hr' | 'complete' | 'error';

export default function SuccessScreen() {
  const { deviceName, deviceMac } = useLocalSearchParams<{ deviceName: string; deviceMac: string }>();
  const { completeDeviceSetup, completeOnboarding } = useOnboarding();

  const [phase, setPhase] = useState<DataPhase>('syncing');
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [currentSteps, setCurrentSteps] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [measuringHR, setMeasuringHR] = useState(false);
  const [hrProgress, setHrProgress] = useState(0);

  // Pulse animation for HR measuring
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hrValueAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation while measuring
  useEffect(() => {
    if (measuringHR) {
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
  }, [measuringHR, pulseAnim]);

  // Animate HR value appearance
  useEffect(() => {
    if (heartRate !== null && heartRate > 0) {
      Animated.spring(hrValueAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [heartRate, hrValueAnim]);

  useEffect(() => {
    let hrListener: (() => void) | null = null;

    const fetchDeviceData = async () => {
      // Connection promise now only resolves after SyncSuccess (state 6)
      // Add small additional delay for SDK internal state to fully settle
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        // Fetch sequentially to avoid overwhelming the SDK
        // Battery first, then steps
        const batteryResult = await UnifiedSmartRingService.getBattery().catch((err) => {
          console.log('Battery fetch failed:', err);
          return null;
        });

        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));

        const stepsResult = await UnifiedSmartRingService.getSteps().catch((err) => {
          console.log('Steps fetch failed:', err);
          return null;
        });

        if (batteryResult && typeof batteryResult.battery === 'number') {
          setBatteryLevel(batteryResult.battery);
        }

        if (stepsResult && typeof stepsResult.steps === 'number') {
          setCurrentSteps(stepsResult.steps);
        }

        // If both failed, set error state but still allow continuing
        if (!batteryResult && !stepsResult) {
          setPhase('error');
          return;
        }

        // Now start heart rate measurement
        setPhase('measuring_hr');
        setMeasuringHR(true);

        // Listen for HR data events
        hrListener = QCBandService.onHeartRateData((data) => {
          console.log('💓 HR data received:', data);
          if (data.isMeasuring && data.heartRate > 0) {
            // Show intermediate value
            setHeartRate(data.heartRate);
            setHrProgress(prev => Math.min(prev + 20, 80));
          }
          if (data.isFinal && data.heartRate > 0) {
            // Final measurement complete
            setHeartRate(data.heartRate);
            setHrProgress(100);
            setMeasuringHR(false);
            setPhase('complete');
          }
        });

        // Start measurement
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('💓 Starting heart rate measurement...');
        await UnifiedSmartRingService.measureHeartRate().catch(err => {
          console.log('HR measurement error:', err);
        });

        // Timeout after 30 seconds if no final result
        setTimeout(() => {
          setMeasuringHR(prev => {
            if (prev) {
              console.log('💓 HR measurement timeout');
              setPhase('complete');
              return false;
            }
            return prev;
          });
        }, 30000);

      } catch (error) {
        console.log('Failed to fetch device data:', error);
        setPhase('error');
      }
    };

    fetchDeviceData();

    return () => {
      if (hrListener) {
        hrListener();
      }
    };
  }, []);

  const handleContinue = async () => {
    // Save device pairing and mark onboarding complete
    if (deviceMac) {
      await completeDeviceSetup(deviceMac);
    }
    await completeOnboarding();
    router.replace('/(tabs)');
  };

  const handleSkipHR = () => {
    setMeasuringHR(false);
    setPhase('complete');
  };

  const getBatteryColor = (level: number) => {
    if (level >= 60) return '#10B981';
    if (level >= 30) return '#F59E0B';
    return '#EF4444';
  };

  const isLoading = phase === 'syncing';
  const isMeasuringPhase = phase === 'measuring_hr';
  const isComplete = phase === 'complete';
  const isError = phase === 'error';

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

      <View style={styles.content}>
        {/* Success icon */}
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
          Your {deviceName || 'Smart Ring'} is ready to use
        </Text>

        {/* Stats container */}
        <View style={styles.statsContainer}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <Text style={styles.loadingText}>Syncing with your ring...</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="information-circle" size={32} color="#6B7280" />
              <Text style={styles.errorText}>
                Could not fetch data right now.{'\n'}
                Data will sync once you enter the app.
              </Text>
            </View>
          ) : (
            <>
              {/* Battery */}
              <View style={styles.statItem}>
                <Ionicons
                  name={
                    batteryLevel !== null
                      ? batteryLevel >= 80
                        ? 'battery-full'
                        : batteryLevel >= 50
                          ? 'battery-half'
                          : 'battery-dead'
                      : 'battery-half'
                  }
                  size={32}
                  color={batteryLevel !== null ? getBatteryColor(batteryLevel) : '#6B7280'}
                />
                <Text style={styles.statValue}>
                  {batteryLevel !== null ? `${batteryLevel}%` : '--'}
                </Text>
                <Text style={styles.statLabel}>Battery</Text>
              </View>

              <View style={styles.statDivider} />

              {/* Steps */}
              <View style={styles.statItem}>
                <Ionicons name="footsteps" size={32} color="#6366F1" />
                <Text style={styles.statValue}>
                  {currentSteps !== null ? currentSteps.toLocaleString() : '--'}
                </Text>
                <Text style={styles.statLabel}>Steps Today</Text>
              </View>
            </>
          )}
        </View>

        {/* Heart Rate Measurement Section */}
        {(isMeasuringPhase || isComplete) && (
          <View style={styles.hrSection}>
            <Animated.View
              style={[
                styles.hrIconContainer,
                measuringHR && {
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            >
              <LinearGradient
                colors={measuringHR ? ['#EF4444', '#DC2626'] : ['#EF4444', '#B91C1C']}
                style={styles.hrIconGradient}
              >
                <Ionicons name="heart" size={36} color="#fff" />
              </LinearGradient>
            </Animated.View>

            <View style={styles.hrContent}>
              {measuringHR ? (
                <>
                  <View style={styles.hrMeasuringRow}>
                    <Text style={styles.hrMeasuringText}>
                      {heartRate && heartRate > 0 ? (
                        <Text style={styles.hrLiveValue}>{heartRate}</Text>
                      ) : (
                        'Measuring...'
                      )}
                    </Text>
                    <ActivityIndicator size="small" color="#EF4444" style={styles.hrSpinner} />
                  </View>
                  <Text style={styles.hrSubtext}>Keep your ring on for accurate reading</Text>
                  <View style={styles.hrProgressBar}>
                    <View style={[styles.hrProgressFill, { width: `${hrProgress}%` }]} />
                  </View>
                </>
              ) : (
                <Animated.View
                  style={{
                    opacity: hrValueAnim,
                    transform: [
                      {
                        scale: hrValueAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.5, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.hrFinalValue}>
                    {heartRate && heartRate > 0 ? `${heartRate}` : '--'}
                    <Text style={styles.hrUnit}> bpm</Text>
                  </Text>
                  <Text style={styles.hrSubtext}>Heart Rate</Text>
                </Animated.View>
              )}
            </View>

            {measuringHR && (
              <TouchableOpacity onPress={handleSkipHR} style={styles.skipButton}>
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.primaryButton, (isLoading || measuringHR) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={isLoading || measuringHR}
        >
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
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    top: -100,
    right: -150,
  },
  bgCircle2: {
    width: 300,
    height: 300,
    backgroundColor: 'rgba(99, 102, 241, 0.06)',
    bottom: 100,
    left: -100,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
    marginBottom: 32,
    paddingHorizontal: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 140,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  hrSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  hrIconContainer: {
    marginRight: 16,
  },
  hrIconGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  hrContent: {
    flex: 1,
  },
  hrMeasuringRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hrMeasuringText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hrLiveValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#EF4444',
  },
  hrSpinner: {
    marginLeft: 8,
  },
  hrSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  hrProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  hrProgressFill: {
    height: '100%',
    backgroundColor: '#EF4444',
    borderRadius: 2,
  },
  hrFinalValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hrUnit: {
    fontSize: 16,
    fontWeight: '400',
    color: '#9CA3AF',
  },
  skipButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
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
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonIconRight: {
    marginLeft: 12,
  },
});
