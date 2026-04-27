import { useEffect, useState } from 'react';
import { useHomeDataContext } from '../context/HomeDataContext';
import { useFocusDataContext } from '../context/FocusDataContext';
import { useSleepDebt } from './useSleepDebt';
import { useCaffeineTimeline } from './useCaffeineTimeline';
import { resolveGaugePhase } from '../utils/overviewGaugePhase';
import type { GaugePhase } from '../utils/overviewGaugePhase';

export function useOverviewGaugePhase(): GaugePhase {
  const homeData = useHomeDataContext();
  const focusData = useFocusDataContext();
  const { sleepDebt } = useSleepDebt();
  const { currentMg } = useCaffeineTimeline();

  const wakeTime =
    homeData.lastNightSleep?.wakeTime instanceof Date
      ? homeData.lastNightSleep.wakeTime
      : null;
  const bedTime =
    homeData.lastNightSleep?.bedTime instanceof Date
      ? homeData.lastNightSleep.bedTime
      : null;

  const sleepScore = homeData.lastNightSleep?.score ?? homeData.sleepScore;
  const readiness = focusData.readiness?.score ?? homeData.readiness;
  const { strain } = homeData;
  const sleepDebtTotalMin = sleepDebt?.totalDebtMin ?? 0;

  // Stable numeric deps to avoid unnecessary re-renders from Date reference changes
  const wakeMs = wakeTime?.getTime() ?? 0;
  const bedMs = bedTime?.getTime() ?? 0;

  const [phase, setPhase] = useState<GaugePhase>(() =>
    resolveGaugePhase({
      now: new Date(),
      wakeTime,
      lastNightBedTime: bedTime,
      sleepScore,
      readiness,
      strain,
      caffeineCurrentMg: currentMg,
      sleepDebtTotalMin,
    }),
  );

  useEffect(() => {
    const tick = () => {
      const next = resolveGaugePhase({
        now: new Date(),
        wakeTime: wakeMs ? new Date(wakeMs) : null,
        lastNightBedTime: bedMs ? new Date(bedMs) : null,
        sleepScore,
        readiness,
        strain,
        caffeineCurrentMg: currentMg,
        sleepDebtTotalMin,
      });
      setPhase(prev => (prev.key === next.key ? prev : next));
    };

    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, [wakeMs, bedMs, sleepScore, readiness, strain, currentMg, sleepDebtTotalMin]);

  return phase;
}
