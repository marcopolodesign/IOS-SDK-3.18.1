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
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useOnboarding } from '../../src/context/OnboardingContext';
import UnifiedSmartRingService from '../../src/services/UnifiedSmartRingService';

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

  // Animations
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hrValueAnim = useRef(new Animated.Value(0)).current;

  // Animate check icon in on mount
  useEffect(() => {
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 5,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Pulse animation while measuring HR
  useEffect(() => {
    if (measuringHR) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
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
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        const batteryResult = await UnifiedSmartRingService.getBattery().catch((err) => {
          console.log('Battery fetch failed:', err);
          return null;
        });

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

        if (!batteryResult && !stepsResult) {
          setPhase('error');
          return;
        }

        setPhase('measuring_hr');
        setMeasuringHR(true);

        hrListener = UnifiedSmartRingService.onHeartRateReceived((data) => {
          console.log('💓 HR data received:', data);
          if (data.isMeasuring && data.heartRate > 0) {
            setHeartRate(data.heartRate);
            setHrProgress(prev => Math.min(prev + 20, 80));
          }
          if (data.isFinal && data.heartRate > 0) {
            setHeartRate(data.heartRate);
            setHrProgress(100);
            setMeasuringHR(false);
            setPhase('complete');
          }
        });

        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('💓 Starting heart rate measurement...');
        await UnifiedSmartRingService.measureHeartRate().catch(err => {
          console.log('HR measurement error:', err);
        });

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
      if (hrListener) hrListener();
    };
  }, []);

  const handleContinue = async () => {
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
    if (level >= 60) return '#00D4AA';
    if (level >= 30) return '#FFB84D';
    return '#FF6B6B';
  };

  const isLoading = phase === 'syncing';
  const isMeasuringPhase = phase === 'measuring_hr';
  const isComplete = phase === 'complete';
  const isError = phase === 'error';

  return (
    <View style={styles.container}>
      {/* Ambient glow */}
      <View style={styles.glowBg} />

      <View style={styles.content}>
        {/* Animated check mark */}
        <Animated.View
          style={[
            styles.checkWrapper,
            { opacity: checkOpacity, transform: [{ scale: checkScale }] },
          ]}
        >
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={40} color="#000000" />
          </View>
        </Animated.View>

        <Text style={styles.title}>All set</Text>
        <Text style={styles.subtitle}>
          {deviceName || 'Smart Ring'} is connected
        </Text>

        {/* Stats card */}
        <View style={styles.statsCard}>
          {isLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color="#00D4AA" />
              <Text style={styles.loadingText}>Syncing with your ring…</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorRow}>
              <Ionicons name="information-circle-outline" size={20} color="rgba(255,255,255,0.3)" />
              <Text style={styles.errorInfoText}>
                Data will sync when you open the app.
              </Text>
            </View>
          ) : (
            <View style={styles.statsRow}>
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
                  size={24}
                  color={batteryLevel !== null ? getBatteryColor(batteryLevel) : 'rgba(255,255,255,0.3)'}
                />
                <Text style={styles.statValue}>
                  {batteryLevel !== null ? `${batteryLevel}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Battery</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statItem}>
                <Ionicons name="footsteps" size={24} color="#00D4AA" />
                <Text style={styles.statValue}>
                  {currentSteps !== null ? currentSteps.toLocaleString() : '—'}
                </Text>
                <Text style={styles.statLabel}>Steps today</Text>
              </View>
            </View>
          )}
        </View>

        {/* Heart Rate section */}
        {(isMeasuringPhase || isComplete) && (
          <View style={styles.hrCard}>
            <Animated.View
              style={[
                styles.hrIconWrap,
                measuringHR && { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="heart" size={20} color="#FF6B6B" />
            </Animated.View>

            <View style={styles.hrContent}>
              {measuringHR ? (
                <>
                  <View style={styles.hrRow}>
                    <Text style={styles.hrMeasuringLabel}>
                      {heartRate && heartRate > 0
                        ? <Text style={styles.hrLiveValue}>{heartRate}</Text>
                        : 'Measuring…'}
                    </Text>
                    <ActivityIndicator size="small" color="#FF6B6B" style={{ marginLeft: 8 }} />
                  </View>
                  <Text style={styles.hrHint}>Keep ring on for accurate reading</Text>
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
                          outputRange: [0.8, 1],
                        }),
                      },
                    ],
                  }}
                >
                  <Text style={styles.hrFinalValue}>
                    {heartRate && heartRate > 0 ? `${heartRate}` : '—'}
                    <Text style={styles.hrUnit}> bpm</Text>
                  </Text>
                  <Text style={styles.hrHint}>Heart Rate</Text>
                </Animated.View>
              )}
            </View>

            {measuringHR && (
              <TouchableOpacity onPress={handleSkipHR} style={styles.skipBtn}>
                <Text style={styles.skipText}>Skip</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* Bottom CTA */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={[
            styles.continueButton,
            (isLoading || measuringHR) && styles.buttonDisabled,
          ]}
          onPress={handleContinue}
          disabled={isLoading || measuringHR}
          activeOpacity={0.85}
        >
          <Text style={styles.continueButtonText}>Continue</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  glowBg: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -160,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(0, 212, 170, 0.07)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 90,
  },

  // Check
  checkWrapper: {
    marginBottom: 28,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D4AA',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 32,
  },

  // Stats
  statsCard: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 18,
    padding: 22,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    minHeight: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  errorInfoText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.35)',
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: 1,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },

  // HR
  hrCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.06)',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.15)',
  },
  hrIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  hrContent: {
    flex: 1,
  },
  hrRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hrMeasuringLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  hrLiveValue: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  hrHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 4,
  },
  hrProgressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  hrProgressFill: {
    height: '100%',
    backgroundColor: '#FF6B6B',
    borderRadius: 2,
  },
  hrFinalValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  hrUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.4)',
  },
  skipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },

  // CTA
  ctaContainer: {
    paddingHorizontal: 24,
    paddingBottom: 50,
    paddingTop: 16,
  },
  continueButton: {
    backgroundColor: '#00D4AA',
    borderRadius: 50,
    paddingVertical: 17,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  continueButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
