import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { spacing, fontSize } from '../../theme/colors';

interface HomeHeaderProps {
  userName?: string;
  streakDays?: number;
  ringBattery?: number;
  avatarUrl?: string;
  onAvatarPress?: () => void;
}

// Battery icon component
function BatteryIcon({ level }: { level: number }) {
  const fillWidth = Math.max(0, Math.min(100, level)) / 100 * 18;
  const fillColor = level > 20 ? '#4ADE80' : '#EF4444';
  
  return (
    <Svg width={28} height={14} viewBox="0 0 28 14">
      <Rect x={0} y={1} width={24} height={12} rx={2} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} fill="none" />
      <Rect x={3} y={4} width={fillWidth} height={6} rx={1} fill={fillColor} />
      <Rect x={24} y={4} width={3} height={6} rx={1} fill="rgba(255,255,255,0.6)" />
    </Svg>
  );
}

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
      <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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

export function HomeHeader({
  userName = 'there',
  streakDays = 0,
  ringBattery = 100,
  avatarUrl,
  onAvatarPress,
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

      {/* Right side: Streak + Battery */}
      <View style={styles.rightSection}>
        {streakDays > 0 && (
          <View style={styles.streakContainer}>
            <StreakIcon />
            <Text style={styles.streakText}>{streakDays}</Text>
          </View>
        )}
        
        <View style={styles.batteryContainer}>
          <BatteryIcon level={ringBattery} />
          <Text style={styles.batteryText}>{ringBattery}%</Text>
        </View>
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
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  defaultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  },
  userName: {
    color: '#FFFFFF',
    fontSize: fontSize.lg,
    fontWeight: '600',
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
    fontWeight: '700',
  },
  batteryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  batteryText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: fontSize.sm,
  },
});

export default HomeHeader;


