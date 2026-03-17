import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { spacing, fontSize, fontFamily } from '../../theme/colors';
import { getNapLabel } from '../../services/NapClassifierService';

function NapIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.1 22c5.5 0 10-4.5 10-10 0-1.1-.2-2.2-.5-3.2-.3-.9-1.4-1.1-2-.4-1.4 1.7-3.5 2.7-5.9 2.7-4.1 0-7.5-3.4-7.5-7.5 0-2.3 1-4.5 2.7-5.9.7-.6.5-1.8-.4-2C7.3 2.2 6.2 2 5.1 2 2.6 2 .1 4.5.1 10c0 5.5 4.5 10 10 10h2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

interface NapSession {
  id: string;
  startTime: string;
  endTime: string;
  deepMin: number;
  lightMin: number;
  remMin: number;
  awakeMin: number;
  napScore: number | null;
  totalMin: number;
  segments?: any[];
}

interface NapCardProps {
  naps: NapSession[];
  totalMinutes: number;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function NapCard({ naps, totalMinutes }: NapCardProps) {
  const { t } = useTranslation();

  if (naps.length === 0) return null;

  const subtitle = naps.length === 1
    ? formatDuration(totalMinutes)
    : t('sleep.nap_count', { count: naps.length });

  return (
    <GradientInfoCard
      icon={<NapIcon />}
      title={t('sleep.naps_today')}
      headerValue={formatDuration(totalMinutes)}
      headerSubtitle={subtitle}
      showArrow={false}
      gradientStops={[
        { offset: 0, color: '#8B5CF6', opacity: 0.9 },
        { offset: 0.65, color: '#8B5CF6', opacity: 0.15 },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
    >
      <View style={styles.body}>
        {naps.map((nap) => {
          const scoreLabel = nap.napScore != null ? getNapLabel(nap.napScore) : null;
          const total = nap.deepMin + nap.lightMin + nap.remMin;
          return (
            <View key={nap.id} style={styles.napRow}>
              <View style={styles.napInfo}>
                <Text style={styles.napTime}>
                  {formatTime(nap.startTime)} – {formatTime(nap.endTime)}
                </Text>
                <Text style={styles.napDuration}>
                  {formatDuration(nap.totalMin)}
                  {scoreLabel && (
                    <Text style={styles.napScoreText}>
                      {' · '}{t(`sleep.nap_score_${scoreLabel}`)}
                    </Text>
                  )}
                </Text>
              </View>
              {/* Mini stage bar — only shown when stages aren't in the hypnogram */}
              {total > 0 && (!nap.segments || nap.segments.length === 0) && (
                <View style={styles.stageBar}>
                  {nap.deepMin > 0 && (
                    <View style={[styles.stageSegment, styles.deepSegment, { flex: nap.deepMin }]} />
                  )}
                  {nap.lightMin > 0 && (
                    <View style={[styles.stageSegment, styles.lightSegment, { flex: nap.lightMin }]} />
                  )}
                  {nap.remMin > 0 && (
                    <View style={[styles.stageSegment, styles.remSegment, { flex: nap.remMin }]} />
                  )}
                </View>
              )}
            </View>
          );
        })}
        {totalMinutes > 0 && (
          <Text style={styles.napContributed}>
            {t('sleep.nap_contributed', { minutes: totalMinutes })}
          </Text>
        )}
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  napRow: {
    gap: 6,
  },
  napInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  napTime: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.demiBold,
  },
  napDuration: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
  },
  napScoreText: {
    color: 'rgba(255,255,255,0.5)',
  },
  stageBar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: '#A78BFA',
  },
  napContributed: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
    marginTop: 2,
  },
});
