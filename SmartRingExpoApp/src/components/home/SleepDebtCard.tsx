import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { GradientInfoCard } from '../common/GradientInfoCard';
import { InfoButton } from '../common/InfoButton';
import { SleepDebtGauge } from './SleepDebtGauge';
import { useSleepDebt } from '../../hooks/useSleepDebt';
import { spacing, fontSize, fontFamily } from '../../theme/colors';

function MoonIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12.1 22c5.5 0 10-4.5 10-10 0-1.1-.2-2.2-.5-3.2-.3-.9-1.4-1.1-2-.4-1.4 1.7-3.5 2.7-5.9 2.7-4.1 0-7.5-3.4-7.5-7.5 0-2.3 1-4.5 2.7-5.9.7-.6.5-1.8-.4-2C7.3 2.2 6.2 2 5.1 2 2.6 2 .1 4.5.1 10c0 5.5 4.5 10 10 10h2z"
        fill="rgba(255,255,255,0.85)"
      />
    </Svg>
  );
}

function formatDebtTime(minutes: number): string {
  if (minutes < 1) return '0m';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface SleepDebtCardProps {
  refreshTrigger?: number;
}

export default function SleepDebtCard({ refreshTrigger }: SleepDebtCardProps) {
  const { t } = useTranslation();
  const { sleepDebt, refresh } = useSleepDebt();

  React.useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) refresh();
  }, [refreshTrigger, refresh]);

  if (!sleepDebt.isReady) {
    return (
      <GradientInfoCard
        icon={<MoonIcon />}
        title={t('sleep_debt.card_title')}
        showArrow={false}
        gradientStops={[
          { offset: 0, color: '#6B8EFF', opacity: 0.9 },
          { offset: 0.65, color: '#6B8EFF', opacity: 0.15 },
        ]}
        gradientCenter={{ x: 0.51, y: -0.86 }}
        gradientRadii={{ rx: '80%', ry: '300%' }}
        headerRight={<InfoButton metricKey="sleep_debt" />}
      >
        <View style={styles.notReady}>
          <Text style={styles.notReadyText}>
            {t('sleep_debt.not_enough_data', { count: 3 - sleepDebt.daysWithData })}
          </Text>
        </View>
      </GradientInfoCard>
    );
  }

  return (
    <GradientInfoCard
      icon={<MoonIcon />}
      title={t('sleep_debt.card_title')}
      headerValue={formatDebtTime(sleepDebt.totalDebtMin)}
      headerSubtitle={t(`sleep_debt.category_${sleepDebt.category}`)}
      showArrow={true}
      onHeaderPress={() => router.push('/detail/sleep-debt-detail')}
      gradientStops={[
        { offset: 0, color: '#6B8EFF', opacity: 0.9 },
        { offset: 0.65, color: '#6B8EFF', opacity: 0.15 },
      ]}
      gradientCenter={{ x: 0.51, y: -0.86 }}
      gradientRadii={{ rx: '80%', ry: '300%' }}
      headerRight={<InfoButton metricKey="sleep_debt" />}
    >
      <View style={styles.body}>
        <SleepDebtGauge
          totalDebtMin={sleepDebt.totalDebtMin}
          category={sleepDebt.category}
        />
      </View>
    </GradientInfoCard>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.sm,
  },
  notReady: {
    paddingVertical: spacing.md,
  },
  notReadyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontFamily: fontFamily.regular,
    textAlign: 'center',
  },
});
