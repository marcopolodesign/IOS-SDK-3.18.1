/**
 * FocusScreen -- Coach tab root screen.
 * Oura-style insight headline + explanation, inline chat bar, then metric cards.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors, fontFamily, fontSize, spacing } from '../theme/colors';
import { useFocusDataContext } from '../context/FocusDataContext';
import { FocusScoreRing } from '../components/focus/FocusScoreRing';
import { ReadinessCard } from '../components/focus/ReadinessCard';
import { IllnessWatchCard } from '../components/focus/IllnessWatchCard';
import { LastRunContextCard } from '../components/focus/LastRunContextCard';
import { AskCoachButton } from '../components/focus/AskCoachButton';
import { BaselineJourneyCard } from '../components/focus/BaselineJourneyCard';

function getTodayLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FocusScreen() {
  const { t } = useTranslation();
  const focusData = useFocusDataContext();
  const hasStrava = focusData.lastRun != null || focusData.isLoading;
  const daysLogged = focusData.baselines?.daysLogged ?? 0;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={focusData.isLoading}
              onRefresh={focusData.refresh}
              tintColor="rgba(255,255,255,0.7)"
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>{t('focus.title')}</Text>
            <Text style={styles.headerDate}>{getTodayLabel()}</Text>
          </View>

          {/* Score Ring */}
          <FocusScoreRing
            score={focusData.readiness?.score ?? null}
            recommendation={focusData.readiness?.recommendation ?? null}
            isLoading={focusData.isLoading}
          />

          {/* Recovery timeline — inline, no card wrapper */}
          {!focusData.isLoading && (
            <View style={styles.inlineSection}>
              <BaselineJourneyCard
                daysLogged={daysLogged}
                baselines={focusData.baselines}
                readiness={focusData.readiness}
              />
            </View>
          )}

          {/* Loading skeleton */}
          {focusData.isLoading && (
            <View style={styles.inlineSection}>
              <View style={[styles.skeletonLine, { height: 24, width: '55%', marginBottom: 16 }]} />
              <View style={[styles.skeletonLine, { height: 10, borderRadius: 5, marginBottom: 8 }]} />
              <View style={[styles.skeletonLine, { height: 80, borderRadius: 12 }]} />
            </View>
          )}

          {/* ── Ask Coach button -- inline, above metric cards ── */}
          <View style={styles.cardWrap}>
            <AskCoachButton />
          </View>

          {/* Metric cards */}
          <View style={styles.cardWrap}>
            <ReadinessCard
              readiness={focusData.readiness}
              baselines={focusData.baselines}
              isLoading={focusData.isLoading}
            />
          </View>

          <View style={styles.cardWrap}>
            <IllnessWatchCard
              illness={focusData.illness}
              isLoading={focusData.isLoading}
            />
          </View>

          <View style={styles.cardWrap}>
            <LastRunContextCard
              lastRun={focusData.lastRun}
              isLoading={focusData.isLoading}
              hasStrava={hasStrava}
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xxl,
    color: '#FFFFFF',
  },
  headerDate: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.4)',
    paddingBottom: 3,
  },
  inlineSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  skeletonLine: {
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cardWrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
});
