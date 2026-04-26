import { memo, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSize, fontFamily } from '../../theme/colors';
import { formatDurationHm } from '../../utils/time';
import { formatDistance } from '../../utils/ringData/steps';
import type { UnifiedActivity } from '../../types/activity.types';

interface ActivityInfoSheetProps {
  activity: UnifiedActivity | null;
  visible: boolean;
  onClose: () => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const min = d.getMinutes();
  const suffix = h >= 12 ? 'PM' : 'AM';
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayH}:${String(min).padStart(2, '0')} ${suffix}`;
}

function SourceLabel({ source }: { source: string }) {
  const labels: Record<string, string> = {
    strava: 'Strava',
    appleHealth: 'Apple Health',
    ring: 'Ring',
  };
  return (
    <Text style={sheetStyles.sourceLabel}>{labels[source] ?? source}</Text>
  );
}

export const ActivityInfoSheet = memo(function ActivityInfoSheet({
  activity,
  visible,
  onClose,
}: ActivityInfoSheetProps) {
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible && activity) {
      modalRef.current?.present();
    } else {
      modalRef.current?.dismiss();
    }
  }, [visible, activity]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleViewFull = useCallback(() => {
    if (!activity || activity.source !== 'strava') return;
    const numericId = activity.id.replace('strava_', '');
    onClose();
    router.push({ pathname: '/(tabs)/coach/strava-detail', params: { id: numericId } });
  }, [activity, onClose]);

  if (!activity) return null;

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={sheetStyles.background}
      handleIndicatorStyle={sheetStyles.handle}
    >
      <BottomSheetView style={sheetStyles.container}>
        <View style={sheetStyles.headerRow}>
          <View style={[sheetStyles.iconCircle, { backgroundColor: `${activity.color}28` }]}>
            <Ionicons name={activity.icon as any} size={24} color={activity.color} />
          </View>
          <View style={sheetStyles.headerText}>
            <Text style={sheetStyles.activityName} numberOfLines={1}>{activity.name}</Text>
            <SourceLabel source={activity.source} />
          </View>
        </View>

        {/* Stats row */}
        <View style={sheetStyles.statsRow}>
          <StatCell label={t('activity_popup.start_time')} value={formatTime(activity.startDate)} />
          <View style={sheetStyles.statDivider} />
          <StatCell label={t('activity_popup.duration')} value={formatDurationHm(Math.round(activity.durationSec / 60))} />
          {activity.avgHeartRate ? (
            <>
              <View style={sheetStyles.statDivider} />
              <StatCell label={t('activity_popup.avg_hr')} value={`${activity.avgHeartRate}`} unit="bpm" />
            </>
          ) : null}
          {activity.maxHeartRate ? (
            <>
              <View style={sheetStyles.statDivider} />
              <StatCell label={t('activity_popup.max_hr')} value={`${activity.maxHeartRate}`} unit="bpm" />
            </>
          ) : null}
        </View>

        {activity.distanceM ? (
          <View style={sheetStyles.distanceRow}>
            <Text style={sheetStyles.distanceLabel}>{t('activity_popup.distance')}</Text>
            <Text style={sheetStyles.distanceValue}>{formatDistance(activity.distanceM, true)}</Text>
          </View>
        ) : null}

        {activity.source === 'strava' && (
          <TouchableOpacity style={sheetStyles.viewFullBtn} onPress={handleViewFull} activeOpacity={0.8}>
            <Text style={sheetStyles.viewFullText}>{t('activity_popup.view_full')}</Text>
          </TouchableOpacity>
        )}

        <View style={sheetStyles.bottomSpacer} />
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={sheetStyles.statCell}>
      <Text style={sheetStyles.statLabel}>{label}</Text>
      <View style={sheetStyles.statValueRow}>
        <Text style={sheetStyles.statValue}>{value}</Text>
        {unit ? <Text style={sheetStyles.statUnit}> {unit}</Text> : null}
      </View>
    </View>
  );
}

const sheetStyles = StyleSheet.create({
  background: {
    backgroundColor: colors.card ?? '#1E1E32',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  handle: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full ?? 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  activityName: {
    color: '#FFFFFF',
    fontSize: fontSize.md ?? 16,
    fontFamily: fontFamily.demiBold,
  },
  sourceLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs ?? 11,
    fontFamily: fontFamily.regular,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: borderRadius.lg ?? 12,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.sm,
    gap: 0,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: fontSize.md ?? 16,
    fontFamily: fontFamily.demiBold,
  },
  statUnit: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontFamily: fontFamily.regular,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  distanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  distanceLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm ?? 13,
    fontFamily: fontFamily.regular,
  },
  distanceValue: {
    color: '#FFFFFF',
    fontSize: fontSize.sm ?? 13,
    fontFamily: fontFamily.demiBold,
  },
  viewFullBtn: {
    marginTop: spacing.sm,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.lg ?? 12,
    backgroundColor: 'rgba(107,142,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(107,142,255,0.3)',
    alignItems: 'center',
  },
  viewFullText: {
    color: '#6B8EFF',
    fontSize: fontSize.sm ?? 13,
    fontFamily: fontFamily.demiBold,
    letterSpacing: 0.2,
  },
  bottomSpacer: {
    height: spacing.lg,
  },
});
