import React, { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { SleepTrendCover } from '../components/trends/SleepTrendCover';
import { RecoveryTrendCover } from '../components/trends/RecoveryTrendCover';
import { ActivityTrendCover } from '../components/trends/ActivityTrendCover';
import { RunningTrendCover } from '../components/trends/RunningTrendCover';
import { loadBaselines } from '../services/ReadinessService';
import { useHomeDataContext } from '../context/HomeDataContext';
import { colors, fontFamily, spacing, fontSize } from '../theme/colors';
import type { FocusBaselines } from '../types/focus.types';

const EMPTY_BASELINES: FocusBaselines = {
  hrv: [], restingHR: [], temperature: [], sleepScore: [],
  sleepMinutes: [], respiratoryRate: [], spo2Min: [],
  sleepAwakeMin: [], nocturnalHR: [], updatedAt: null, daysLogged: 0,
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: 10,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  title: {
    color: colors.text,
    fontFamily: fontFamily.demiBold,
    fontSize: fontSize.xl,
    marginBottom: spacing.sm,
    paddingHorizontal: 10,
  },
  bottomPad: {
    height: spacing.xxl,
  },
});

export function TrendsScreen() {
  const { t } = useTranslation();
  const homeData = useHomeDataContext();

  const [baselines, setBaselines] = useState<FocusBaselines>(EMPTY_BASELINES);
  const [refreshing, setRefreshing] = useState(false);

  const fetchBaselines = useCallback(async () => {
    const b = await loadBaselines();
    setBaselines(b);
  }, []);

  useEffect(() => {
    fetchBaselines();
  }, [fetchBaselines]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([homeData.refresh(), fetchBaselines()]);
    setRefreshing(false);
  }, [homeData, fetchBaselines]);

  return (
    <View style={styles.root}>
      {/* Blues / violet background — same layering technique as AIChatScreen */}
      <LinearGradient
        colors={['#06060F', '#0C0C28', 'rgba(22, 8, 55, 0.97)']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={['rgba(50, 20, 120, 0.35)', 'transparent', 'rgba(10, 5, 40, 0.5)']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="rgba(255,255,255,0.4)"
            />
          }
        >
          <Text style={styles.title}>{t('trends.title')}</Text>
          <SleepTrendCover baselines={baselines} />
          <RecoveryTrendCover baselines={baselines} />
          <ActivityTrendCover />
          <RunningTrendCover />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
