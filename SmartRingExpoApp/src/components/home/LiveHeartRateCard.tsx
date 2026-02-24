import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Path } from 'react-native-svg';
import { GradientInfoCard } from '../common/GradientInfoCard';
import JstyleService from '../../services/JstyleService';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

// Get the eventEmitter directly so we can listen to onMeasurementResult
let _emitter: NativeEventEmitter | null = null;
try {
  const JstyleBridge = NativeModules.JstyleBridge;
  if (JstyleBridge) _emitter = new NativeEventEmitter(JstyleBridge);
} catch {}

type MeasurementState = 'idle' | 'measuring' | 'done' | 'error';

const MEASURE_DURATION = 30;
const LIVE_HR_LAST_MEASUREMENT_KEY = 'live_hr_last_measurement_v1';

type LastLiveMeasurement = {
  heartRate: number;
  measuredAt: number;
  deviceId?: string | null;
};

function HeartIcon({ size = 24, color = '#fff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
        fill={color}
      />
    </Svg>
  );
}

function CountdownRing({ seconds, total = MEASURE_DURATION, size = 80 }: { seconds: number; total?: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = seconds / total;
  const dashOffset = circumference * (1 - progress);

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={4}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="rgba(255, 100, 100, 0.9)"
        strokeWidth={4}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation="-90"
        origin={`${size / 2}, ${size / 2}`}
      />
    </Svg>
  );
}

export function LiveHeartRateCard() {
  const homeData = useHomeDataContext();
  const [state, setState] = useState<MeasurementState>('idle');
  const [currentHR, setCurrentHR] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(MEASURE_DURATION);
  const [lastMeasurement, setLastMeasurement] = useState<LastLiveMeasurement | null>(null);
  const currentHRRef = useRef<number | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const nativeSessionActiveRef = useRef(false);

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.3, duration: 400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => {
    pulseAnim.stopAnimation();
    Animated.timing(pulseAnim, { toValue: 1, duration: 150, useNativeDriver: true }).start();
  };

  const cleanup = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (retryTimerRef.current) { clearTimeout(retryTimerRef.current); retryTimerRef.current = null; }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    stopPulse();
  };

  const formatMeasuredTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '--';
    }
  };

  const persistLastMeasurement = async (heartRate: number) => {
    if (!(heartRate > 0)) return;

    let deviceId: string | null = null;
    try {
      const conn = await JstyleService.isConnected();
      deviceId = conn.deviceId;
    } catch {}

    const payload: LastLiveMeasurement = {
      heartRate: Math.round(heartRate),
      measuredAt: Date.now(),
      deviceId,
    };

    try {
      await AsyncStorage.setItem(LIVE_HR_LAST_MEASUREMENT_KEY, JSON.stringify(payload));
      setLastMeasurement(payload);
    } catch (e) {
      console.log('[LiveHR] Failed to persist last measurement:', e);
    }
  };

  const stopNativeSession = async () => {
    if (!nativeSessionActiveRef.current) return;
    nativeSessionActiveRef.current = false;
    try {
      await JstyleService.stopHeartRateMeasuring();
    } catch (e) {
      console.log('[LiveHR] stopHeartRateMeasuring error:', e);
    }
    try {
      await JstyleService.stopRealTimeData();
    } catch (e) {
      console.log('[LiveHR] stopRealTimeData error:', e);
    }
  };

  const startMeasurement = async () => {
    if (!homeData.isRingConnected) return;
    cleanup();
    await stopNativeSession();
    setCurrentHR(null);
    currentHRRef.current = null;
    setSecondsLeft(MEASURE_DURATION);
    setState('measuring');
    startPulse();

    // Primary source: realtime stream heartRate. Keep onMeasurementResult as fallback.
    if (_emitter) {
      const rtSub = _emitter.addListener('onRealTimeData', (data: any) => {
        console.log('[LiveHR] RAW onRealTimeData:', JSON.stringify(data));
        const hr = Number(data?.heartRate ?? 0);
        if (hr > 0) {
          currentHRRef.current = hr;
          setCurrentHR(hr);
        }
      });
      const measurementSub = _emitter.addListener('onMeasurementResult', (data: any) => {
        console.log('[LiveHR] RAW onMeasurementResult:', JSON.stringify(data));
        const hr = Number(data?.heartRate ?? data?.singleHR ?? data?.hr ?? 0);
        if (hr > 0) {
          currentHRRef.current = hr;
          setCurrentHR(hr);
        }
      });
      unsubRef.current = () => {
        rtSub.remove();
        measurementSub.remove();
      };
    }

    try {
      // Only reconnect when actually disconnected to avoid connection-state churn.
      const conn = await JstyleService.isConnected();
      if (!conn.connected) {
        const reconnResult = await UnifiedSmartRingService.autoReconnect();
        console.log('[LiveHR] autoReconnect result:', JSON.stringify(reconnResult));
      }
      nativeSessionActiveRef.current = true;
      const startResult = await JstyleService.startHeartRateMeasuring();
      console.log('[LiveHR] startHeartRateMeasuring result:', JSON.stringify(startResult));
    } catch (e) {
      console.log('[LiveHR] startMeasurement error:', e);
      setState('error');
      cleanup();
      await stopNativeSession();
      return;
    }

    // Retry once if no heart-rate sample was produced after startup.
    retryTimerRef.current = setTimeout(async () => {
      if (!nativeSessionActiveRef.current || currentHRRef.current) return;
      try {
        console.log('[LiveHR] No HR sample yet, retrying manual measurement start');
        await JstyleService.startHeartRateMeasuring();
      } catch (e) {
        console.log('[LiveHR] retry startHeartRateMeasuring error:', e);
      }
    }, 6000);

    // Countdown timer
    timerRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setState('done');
          if (currentHRRef.current && currentHRRef.current > 0) {
            void persistLastMeasurement(currentHRRef.current);
          }
          cleanup();
          void stopNativeSession();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const stopMeasurement = async () => {
    cleanup();
    await stopNativeSession();
    if (currentHRRef.current && currentHRRef.current > 0) {
      await persistLastMeasurement(currentHRRef.current);
    }
    setState(currentHRRef.current ? 'done' : 'idle');
  };

  const reset = () => {
    cleanup();
    setCurrentHR(null);
    currentHRRef.current = null;
    setSecondsLeft(MEASURE_DURATION);
    setState('idle');
  };

  useEffect(() => {
    AsyncStorage.getItem(LIVE_HR_LAST_MEASUREMENT_KEY)
      .then(raw => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as LastLiveMeasurement;
        if (Number(parsed?.heartRate) > 0 && Number(parsed?.measuredAt) > 0) {
          setLastMeasurement({
            heartRate: Number(parsed.heartRate),
            measuredAt: Number(parsed.measuredAt),
            deviceId: parsed.deviceId ?? null,
          });
        }
      })
      .catch((e) => {
        console.log('[LiveHR] Failed to load last measurement:', e);
      });

    return () => {
      cleanup();
      void stopNativeSession();
    };
  }, []);

  const isConnected = homeData.isRingConnected;

  const headerValue = state === 'idle'
    ? (lastMeasurement ? String(lastMeasurement.heartRate) : (isConnected ? 'Ready' : 'N/A'))
    : state === 'measuring'
    ? (currentHR ? String(currentHR) : '…')
    : state === 'done'
    ? (currentHR ? String(currentHR) : '--')
    : '--';

  const headerSubtitle = state === 'idle'
    ? (lastMeasurement
      ? `Last measured ${formatMeasuredTime(lastMeasurement.measuredAt)}`
      : (isConnected ? 'Tap to measure' : 'Ring disconnected'))
    : state === 'measuring'
    ? `${secondsLeft}s remaining`
    : state === 'done'
    ? 'BPM · Tap to re-measure'
    : 'Measurement failed';

  return (
    <GradientInfoCard
      icon={<HeartIcon size={20} color="#FF6B6B" />}
      title="Live Heart Rate"
      headerValue={headerValue}
      headerSubtitle={headerSubtitle}
      gradientStops={[
        { offset: 0, color: 'rgba(180, 20, 20, 0.99)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      showArrow={false}
    >
      <View style={styles.body}>
        {state === 'measuring' ? (
          <View style={styles.measuringContainer}>
            <View style={styles.countdownWrapper}>
              <CountdownRing seconds={secondsLeft} total={MEASURE_DURATION} size={100} />
              <View style={styles.countdownCenter}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <HeartIcon size={28} color="#FF6B6B" />
                </Animated.View>
                {currentHR ? (
                  <Text style={styles.liveHRText}>{currentHR}</Text>
                ) : null}
              </View>
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={stopMeasurement}>
              <Text style={styles.stopBtnText}>Stop</Text>
            </TouchableOpacity>
          </View>
        ) : state === 'done' ? (
          <View style={styles.doneContainer}>
            <View style={styles.resultRow}>
              <HeartIcon size={32} color="#FF6B6B" />
              <Text style={styles.resultHR}>{currentHR ?? '--'}</Text>
              <Text style={styles.resultUnit}>BPM</Text>
            </View>
            <Text style={styles.resultLabel}>
              {currentHR
                ? currentHR < 60 ? 'Low · Rest or sleep detected'
                  : currentHR < 100 ? 'Normal resting rate'
                  : 'Elevated · Consider resting'
                : 'No reading captured'}
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={reset}>
                <Text style={styles.actionBtnText}>Reset</Text>
              </TouchableOpacity>
              {isConnected && (
                <TouchableOpacity style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={startMeasurement}>
                  <Text style={styles.actionBtnTextPrimary}>Measure Again</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : state === 'error' ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>Measurement failed. Ensure ring is worn.</Text>
            <TouchableOpacity style={styles.actionBtn} onPress={reset}>
              <Text style={styles.actionBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // idle
          <TouchableOpacity
            style={[styles.measureBtn, !isConnected && styles.measureBtnDisabled]}
            onPress={startMeasurement}
            disabled={!isConnected}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <HeartIcon size={28} color={isConnected ? '#FF6B6B' : 'rgba(255,255,255,0.3)'} />
            </Animated.View>
            <Text style={[styles.measureBtnText, !isConnected && styles.measureBtnTextDisabled]}>
              {isConnected ? 'Start Measurement' : 'Ring Not Connected'}
            </Text>
            {isConnected && (
              <Text style={styles.measureBtnSub}>30-second reading</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  measuringContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  countdownWrapper: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveHRText: {
    color: '#fff',
    fontSize: 18,
    fontFamily: fontFamily.demiBold,
    marginTop: 2,
  },
  stopBtn: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  stopBtnText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  doneContainer: {
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  resultHR: {
    color: '#fff',
    fontSize: 52,
    fontFamily: fontFamily.demiBold,
    lineHeight: 58,
  },
  resultUnit: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.regular,
    marginBottom: 4,
  },
  resultLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  actionBtnPrimary: {
    backgroundColor: 'rgba(255, 80, 80, 0.25)',
    borderColor: 'rgba(255, 80, 80, 0.4)',
  },
  actionBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  actionBtnTextPrimary: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  errorContainer: {
    alignItems: 'center',
    gap: spacing.md,
  },
  errorText: {
    color: 'rgba(255,120,120,0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
  measureBtn: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    width: '100%',
  },
  measureBtnDisabled: {
    opacity: 0.5,
  },
  measureBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  measureBtnTextDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  measureBtnSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
  },
});

export default LiveHeartRateCard;
