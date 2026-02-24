import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import { RingIcon, BandIcon, DeviceType } from '../../assets/icons';

interface HomeHeaderProps {
  userName?: string;
  streakDays?: number;
  ringBattery?: number;
  avatarUrl?: string;
  onAvatarPress?: () => void;
  deviceType?: DeviceType;
  isConnected?: boolean;
  isReconnecting?: boolean;
  onReconnect?: () => void;
  isSyncing?: boolean;
  onRefresh?: () => void;
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

// Default avatar
function DefaultAvatar() {
  return (
    <View style={styles.defaultAvatar}>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Circle cx={12} cy={8} r={4} fill="rgba(255,255,255,0.8)" />
        <Path
          d="M4 20C4 16 8 14 12 14C16 14 20 16 20 20"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

// Device icon component - switches between ring and band
function DeviceIcon({ deviceType }: { deviceType: DeviceType }) {
  if (deviceType === 'band') {
    return <BandIcon width={16} height={16} fill="rgba(255,255,255,0.7)" />;
  }
  return <RingIcon width={16} height={16} fill="rgba(255,255,255,0.7)" />;
}

// Reconnect icon
function ReconnectIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 12C4 7.58172 7.58172 4 12 4C14.5 4 16.75 5.1 18.25 6.85L20 5V11H14L16.1 8.9C15 7.7 13.55 7 12 7C9.24 7 7 9.24 7 12C7 14.76 9.24 17 12 17C14.06 17 15.84 15.68 16.56 13.8H19.72C18.86 17.38 15.69 20 12 20C7.58172 20 4 16.4183 4 12Z"
        fill="rgba(255,255,255,0.9)"
      />
    </Svg>
  );
}

function RefreshIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
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

export function HomeHeader({
  userName = 'there',
  streakDays = 0,
  ringBattery = 100,
  avatarUrl,
  onAvatarPress,
  deviceType = 'ring',
  isConnected = true,
  isReconnecting = false,
  onReconnect,
  isSyncing = false,
  onRefresh,
}: HomeHeaderProps) {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <View style={styles.container}>
      {/* Left side: Avatar + Greeting */}
      <View style={styles.leftSection}>
        <TouchableOpacity onPress={onAvatarPress} style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <DefaultAvatar />
          )}
        </TouchableOpacity>

        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>{getGreeting()},</Text>
          <Text style={styles.userName}>{userName}</Text>
        </View>
      </View>

      {/* Right side: Reconnect button (when disconnected and not syncing) or Streak + Battery */}
      <View style={styles.rightSection}>
        {!isConnected && !isSyncing && !isReconnecting && onReconnect ? (
          <TouchableOpacity
            style={styles.reconnectButton}
            onPress={onReconnect}
            disabled={isReconnecting}
          >
            <ReconnectIcon />
            <Text style={styles.reconnectText}>Reconnect</Text>
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
              <DeviceIcon deviceType={deviceType} />
              {isReconnecting ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.syncingSpinner} />
                  <Text style={styles.syncingText}>Connecting</Text>
                </View>
              ) : isSyncing ? (
                <View style={styles.syncingContainer}>
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" style={styles.syncingSpinner} />
                  <Text style={styles.syncingText}>Syncing</Text>
                </View>
              ) : (
                <Text style={styles.batteryText}>{ringBattery}%</Text>
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
  defaultAvatar: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  greetingContainer: {
    gap: 2,
  },
  greeting: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
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
  batteryText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
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
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  reconnectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 107, 53, 0.3)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.5)',
  },
  reconnectText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
});

export default HomeHeader;


