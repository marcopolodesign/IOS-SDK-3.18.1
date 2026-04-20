import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, NativeModules, NativeEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import UnifiedSmartRingService from '../../services/UnifiedSmartRingService';
import { useHomeDataContext } from '../../context/HomeDataContext';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import { reportError } from '../../utils/sentry';

// Get event emitters for both SDKs so we can listen to measurement results
let _jstyleEmitter: NativeEventEmitter | null = null;
let _v8Emitter: NativeEventEmitter | null = null;
try {
  const JstyleBridge = NativeModules.JstyleBridge;
  if (JstyleBridge) _jstyleEmitter = new NativeEventEmitter(JstyleBridge);
} catch {}
try {
  const V8Bridge = NativeModules.V8Bridge;
  if (V8Bridge) _v8Emitter = new NativeEventEmitter(V8Bridge);
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


type LiveHeartRateCardProps = {
  headerRight?: React.ReactNode;
};

export function LiveHeartRateCard({ headerRight }: LiveHeartRateCardProps = {}) {
  const { t } = useTranslation();
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
      const conn = await UnifiedSmartRingService.isConnected();
      deviceId = conn.deviceMac;
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
      reportError(e, { op: 'liveHR.persist' }, 'info');
    }
  };

  const stopNativeSession = async () => {
    if (!nativeSessionActiveRef.current) return;
    nativeSessionActiveRef.current = false;
    try {
      await UnifiedSmartRingService.stopHeartRateMeasuring();
    } catch (e) {
      console.log('[LiveHR] stopHeartRateMeasuring error:', e);
    }
    try {
      await UnifiedSmartRingService.stopRealTimeData();
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
    // Listen to both Jstyle and V8 event emitters — only the active SDK will fire.
    const subs: Array<{ remove: () => void }> = [];

    const handleHR = (hr: number) => {
      if (hr > 0) {
        currentHRRef.current = hr;
        setCurrentHR(hr);
      }
    };

    if (_jstyleEmitter) {
      subs.push(_jstyleEmitter.addListener('onRealTimeData', (data: any) => {
        console.log('[LiveHR] RAW onRealTimeData:', JSON.stringify(data));
        handleHR(Number(data?.heartRate ?? 0));
      }));
      subs.push(_jstyleEmitter.addListener('onMeasurementResult', (data: any) => {
        console.log('[LiveHR] RAW onMeasurementResult:', JSON.stringify(data));
        handleHR(Number(data?.heartRate ?? data?.singleHR ?? data?.hr ?? 0));
      }));
    }

    if (_v8Emitter) {
      subs.push(_v8Emitter.addListener('V8RealTimeData', (data: any) => {
        console.log('[LiveHR] RAW V8RealTimeData:', JSON.stringify(data));
        handleHR(Number(data?.heartRate ?? 0));
      }));
      subs.push(_v8Emitter.addListener('V8MeasurementResult', (data: any) => {
        console.log('[LiveHR] RAW V8MeasurementResult:', JSON.stringify(data));
        if (data.type === 'heartRate') handleHR(Number(data?.heartRate ?? 0));
      }));
    }

    if (subs.length > 0) {
      unsubRef.current = () => subs.forEach(s => s.remove());
    }

    try {
      // Only reconnect when actually disconnected to avoid connection-state churn.
      const conn = await UnifiedSmartRingService.isConnected();
      if (!conn.connected) {
        const reconnResult = await UnifiedSmartRingService.autoReconnect();
        console.log('[LiveHR] autoReconnect result:', JSON.stringify(reconnResult));
      }
      nativeSessionActiveRef.current = true;
      const startResult = await UnifiedSmartRingService.startHeartRateMeasuring();
      console.log('[LiveHR] startHeartRateMeasuring result:', JSON.stringify(startResult));
    } catch (e) {
      console.log('[LiveHR] startMeasurement error:', e);
      reportError(e, { op: 'liveHR.bleStart' }, 'warning');
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
        await UnifiedSmartRingService.startHeartRateMeasuring();
      } catch (e) {
        console.log('[LiveHR] retry startHeartRateMeasuring error:', e);
        reportError(e, { op: 'liveHR.measure' }, 'warning');
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

  // idle/done: static heart on the right
  const staticHeart = (state === 'idle' || state === 'done' || state === 'error')
    ? <HeartIcon size={26} color="rgba(255,107,107,0.55)" />
    : null;

  // measuring: body owns the full layout; headerValue not used
  const cardHeaderValue = state === 'measuring'
    ? undefined
    : state === 'idle'
      ? (lastMeasurement ? String(lastMeasurement.heartRate) : (isConnected ? t('hr_live.status_ready') : t('hr_live.value_na')))
      : state === 'done'
        ? (currentHR ? String(currentHR) : '--')
        : '--';

  const cardHeaderSubtitle = state === 'measuring'
    ? undefined
    : state === 'idle'
      ? (lastMeasurement
        ? t('hr_live.subtitle_last_measured', { time: formatMeasuredTime(lastMeasurement.measuredAt) })
        : (isConnected ? t('hr_live.subtitle_idle') : t('hr_live.status_disconnected')))
      : state === 'done'
        ? t('hr_live.bpm_unit')
        : undefined;

  const hrStatusLabel = currentHR
    ? currentHR < 60 ? t('hr_live.result_low')
      : currentHR < 100 ? t('hr_live.result_normal')
      : t('hr_live.result_elevated')
    : null;

  return (
    <GradientInfoCard
      icon={<HeartIcon size={20} color="#FF6B6B" />}
      title={t('hr_live.card_title')}
      headerValue={cardHeaderValue}
      headerSubtitle={cardHeaderSubtitle}
      gradientStops={[
        { offset: 0, color: 'rgba(180, 20, 20, 0.99)' },
        { offset: 0.75, color: 'rgba(0, 0, 0, 0.27)' },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      showArrow={false}
      headerRight={headerRight ?? staticHeart}
      contentContainerStyle={styles.transparentBody}
    >
      {state === 'measuring' ? (
        <View style={styles.measuringRow}>
          <View style={styles.measuringLeft}>
            <Text style={styles.bigNumber}>{currentHR ?? '...'}</Text>
            <Text style={styles.timeRemaining}>{secondsLeft}s remaining</Text>
          </View>
          <Animated.View style={[styles.pulsingHeart, { transform: [{ scale: pulseAnim }] }]}>
            <HeartIcon size={44} color="#FF6B6B" />
          </Animated.View>
        </View>
      ) : state === 'done' ? (
        <View style={styles.doneBody}>
          {isConnected && (
            <TouchableOpacity onPress={startMeasurement}>
              <Text style={styles.tapRemeasure}>{t('hr_live.tap_to_remeasure')}</Text>
            </TouchableOpacity>
          )}
          {hrStatusLabel && (
            <View style={styles.statusChip}>
              <Text style={styles.statusChipText}>{hrStatusLabel}</Text>
            </View>
          )}
        </View>
      ) : state === 'error' ? (
        <TouchableOpacity style={styles.startBtn} onPress={reset}>
          <Text style={styles.startBtnText}>{t('hr_live.button_try_again')}</Text>
        </TouchableOpacity>
      ) : (
        // idle
        <TouchableOpacity
          style={[styles.startBtn, !isConnected && styles.startBtnDisabled]}
          onPress={startMeasurement}
          disabled={!isConnected}
        >
          <Text style={[styles.startBtnText, !isConnected && styles.disabledText]}>
            {isConnected ? t('hr_live.button_start') : t('hr_live.status_disconnected')}
          </Text>
        </TouchableOpacity>
      )}
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  transparentBody: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    paddingTop: 0,
    paddingBottom: spacing.md,
  },
  // measuring: full-width row
  measuringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  measuringLeft: {
    flex: 1,
  },
  bigNumber: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '100',
    fontFamily: fontFamily.regular,
    lineHeight: 52,
  },
  timeRemaining: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    marginTop: 2,
  },
  pulsingHeart: {
    paddingLeft: spacing.md,
  },
  // done
  doneBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  tapRemeasure: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  statusChipText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.demiBold,
  },
  // idle / error
  startBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
    alignSelf: 'flex-start',
  },
  startBtnDisabled: {
    opacity: 0.4,
  },
  startBtnText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  disabledText: {
    color: 'rgba(255,255,255,0.4)',
  },
});

export default LiveHeartRateCard;
