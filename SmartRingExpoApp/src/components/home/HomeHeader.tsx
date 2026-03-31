import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { spacing, fontSize, fontFamily, getBatteryColor } from '../../theme/colors';
import * as Haptics from 'expo-haptics';
import { RingIcon, BandIcon, DeviceType } from '../../assets/icons';

interface HomeHeaderProps {
  userName?: string;
  streakDays?: number;
  ringBattery?: number;
  isCharging?: boolean;
  avatarUrl?: string;
  onAvatarPress?: () => void;
  deviceType?: DeviceType;
  isConnected?: boolean;
  isReconnecting?: boolean;
  onReconnect?: () => void;
  isSyncing?: boolean;
  onRefresh?: () => void;
  onBatteryPress?: () => void;
}

// // Battery icon component
// function BatteryIcon({ level }: { level: number }) {
//   const fillWidth = Math.max(0, Math.min(100, level)) / 100 * 18;
//   const fillColor = level > 20 ? '#4ADE80' : '#EF4444';
  
//   return (
//     <Svg width={28} height={14} viewBox="0 0 28 14">
//       <Rect x={0} y={1} width={24} height={12} rx={2} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} fill="none" />
//       <Rect x={3} y={4} width={fillWidth} height={6} rx={1} fill={fillColor} />
//       <Rect x={24} y={4} width={3} height={6} rx={1} fill="rgba(255,255,255,0.6)" />
//     </Svg>
//   );
// }

// Fire/Streak icon
function StreakIcon() {
  return (
    <Svg width={16} height={20} viewBox="0 0 16 20" fill="none">
      <Path
        d="M8 0C8 0 9.5 3 9.5 5.5C9.5 7 8.5 8 7 8C7 8 8 6 7 4C6 6 4 7 4 10C4 13.5 6.5 16 10 16C13.5 16 16 13.5 16 10C16 5 12 2 8 0Z"
        fill="#FF6B35"
      />
      <Path
        d="M7 10C7 8 8 7 8 7C8 7 9 8 9 10C9 12 8 13 7 13C6 13 5 12 5 10C5 8 7 10 7 10Z"
        fill="#FFD700"
      />
    </Svg>
  );
}


// Device icon component - switches between ring and band
function DeviceIcon({ deviceType, color, size = 12 }: { deviceType: DeviceType; color: string; size?: number }) {
  if (deviceType === 'band') {
    return <BandIcon width={size} height={size} fill={color} />;
  }
  return <RingIcon width={size} height={size} fill={color} />;
}

// Compact circular battery indicator
const BATTERY_SIZE = 38;
const BATTERY_STROKE = 2.5;
const BATTERY_RADIUS = (BATTERY_SIZE - BATTERY_STROKE) / 2;
const BATTERY_CIRCUMFERENCE = 2 * Math.PI * BATTERY_RADIUS;

function BatteryCircle({
  level,
  color,
  deviceType,
  isCharging,
}: {
  level: number;
  color: string;
  deviceType: DeviceType;
  isCharging: boolean;
}) {
  const progress = Math.max(0, Math.min(100, level)) / 100;
  const strokeDashoffset = BATTERY_CIRCUMFERENCE * (1 - progress);
  const center = BATTERY_SIZE / 2;

  return (
    <View style={styles.batteryCircleWrap}>
      <Svg width={BATTERY_SIZE} height={BATTERY_SIZE}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {/* Track */}
          <Circle
            cx={center}
            cy={center}
            r={BATTERY_RADIUS}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={BATTERY_STROKE}
            fill="none"
          />
          {/* Battery arc */}
          <Circle
            cx={center}
            cy={center}
            r={BATTERY_RADIUS}
            stroke={color}
            strokeWidth={BATTERY_STROKE}
            fill="none"
            strokeDasharray={BATTERY_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      <View style={styles.batteryCircleCenter}>
        {isCharging ? (
          <ChargingBoltIcon />
        ) : (
          <DeviceIcon deviceType={deviceType} color={color} size={20} />
        )}
      </View>
    </View>
  );
}

// Reconnect icon
function ReconnectIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12C4 7.58172 7.58172 4 12 4C14.5 4 16.75 5.1 18.25 6.85L20 5V11H14L16.1 8.9C15 7.7 13.55 7 12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.06 17 15.84 15.68 16.56 13.8H19.72C18.86 17.38 15.69 20 12 20C7.58172 20 4 16.4183 4 12Z"
        fill="rgba(255,255,255,0.9)"
      />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
        fill="rgba(255,255,255,0.75)"
      />
    </Svg>
  );
}

function RefreshButton({ onPress, spinning }: { onPress?: () => void; spinning: boolean }) {
  const spinAnim = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (spinning) {
      loopRef.current = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
      );
      loopRef.current.start();
    } else {
      loopRef.current?.stop();
      spinAnim.setValue(0);
    }
    return () => { loopRef.current?.stop(); };
  }, [spinning]);

  const rotate = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <TouchableOpacity style={styles.refreshButton} onPress={onPress} disabled={spinning}>
      <Animated.View style={{ transform: [{ rotate }] }}>
        <RefreshIcon />
      </Animated.View>
    </TouchableOpacity>
  );
}

function ChargingBoltIcon() {
  return (
    <Svg width={8} height={12} viewBox="0 0 8 12" fill="none">
      <Path d="M5 0L0 7h4l-1 5 5-7H4l1-5z" fill="rgba(255,255,255,0.9)" />
    </Svg>
  );
}

export function HomeHeader({
  userName = 'there',
  streakDays = 0,
  ringBattery = 100,
  isCharging = false,
  avatarUrl,
  onAvatarPress,
  deviceType = 'ring',
  isConnected = true,
  isReconnecting = false,
  onReconnect,
  isSyncing = false,
  onRefresh,
  onBatteryPress,
}: HomeHeaderProps) {
  const { t } = useTranslation();

  const batteryColor = getBatteryColor(ringBattery);

  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <Text style={styles.initialText}>{userName[0]?.toUpperCase() ?? '?'}</Text>
          )}
        </TouchableOpacity>
        <Text style={styles.dateText}>{dateLabel}</Text>
      </View>

      {/* Right side: Reconnect button (when disconnected and not syncing) or Streak + Battery */}
      <View style={styles.rightSection}>
        {!isConnected && !isSyncing && !isReconnecting && onReconnect ? (
          <TouchableOpacity
            style={styles.reconnectButton}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onReconnect(); }}
            disabled={isReconnecting}
          >
            <ReconnectIcon />
          </TouchableOpacity>
        ) : (
          <>
            {streakDays > 0 && (
              <View style={styles.streakContainer}>
                <StreakIcon />
                <Text style={styles.streakText}>{streakDays}</Text>
              </View>
            )}

            <View style={styles.batteryContainer}>
              {isReconnecting ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.syncingSpinner} />
                  <Text style={styles.syncingText}>{t('home.connecting')}</Text>
                </View>
              ) : isSyncing ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.syncingSpinner} />
                  <Text style={styles.syncingText}>{t('home.syncing')}</Text>
                </View>
              ) : (
                <TouchableOpacity onPress={onBatteryPress} activeOpacity={0.7}>
                  <BatteryCircle
                    level={ringBattery}
                    color={batteryColor}
                    deviceType={deviceType}
                    isCharging={isCharging}
                  />
                </TouchableOpacity>
              )}
              {isConnected && !isReconnecting && onRefresh && (
                <RefreshButton onPress={onRefresh} spinning={isSyncing} />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarContainer: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
  },
  initialText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: fontFamily.demiBold,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  streakText: {
    color: '#FFD700',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryCircleWrap: {
    width: BATTERY_SIZE,
    height: BATTERY_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  batteryCircleCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncingSpinner: {
    marginRight: 4,
    transform: [{ scale: 0.7 }],
  },
  syncingText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  refreshButton: {
    width: BATTERY_SIZE,
    height: BATTERY_SIZE,
    borderRadius: BATTERY_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  reconnectButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: fontSize.md,
    fontFamily: fontFamily.demiBold,
  },
});

export default HomeHeader;

