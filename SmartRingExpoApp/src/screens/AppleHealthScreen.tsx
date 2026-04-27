/**
 * AppleHealthScreen — View and sync data with Apple Health
 * Glassmorphism design, all strings via t()
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { HeartIcon } from '../components/common/HeartIcon';
import { useTranslation } from 'react-i18next';
import { colors, spacing, borderRadius, fontSize, fontFamily } from '../theme/colors';
import { useHealthKit } from '../hooks';
import { formatSleepDuration } from '../utils/ringData/sleep';
import type { HKSleepResult } from '../services/HealthKitService';

export const AppleHealthScreen: React.FC = () => {
  const { t } = useTranslation();
  const {
    isAvailable,
    isConnected,
    isLoading,
    error,
    steps,
    heartRate,
    hrv,
    spo2,
    sleep,
    initialize,
    refreshAll,
  } = useHealthKit();

  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const handleConnect = async () => {
    const success = await initialize();
    if (success) {
      Alert.alert(t('apple_health.alert_success_title'), t('apple_health.alert_success_msg'));
      setLastRefresh(new Date());
    } else {
      Alert.alert(t('apple_health.alert_error_title'), t('apple_health.alert_error_msg'));
    }
  };

  const handleRefresh = async () => {
    await refreshAll();
    setLastRefresh(new Date());
  };

  if (Platform.OS !== 'ios') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centerContent}>
          <HeartIcon size={48} color="#FF375F" />
          <Text style={styles.title}>{t('apple_health.title')}</Text>
          <Text style={styles.subtitle}>{t('apple_health.ios_only')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const formatSleepTime = (s: HKSleepResult) =>
    formatSleepDuration(s.totalSleep);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('apple_health.title')}</Text>
        {isConnected && (
          <View style={styles.connectedBadge}>
            <Text style={styles.connectedText}>{t('apple_health.connected_badge')}</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!isConnected ? (
          <View style={styles.connectCard}>
            <View style={{ marginBottom: spacing.lg }}>
              <HeartIcon size={48} color="#FF375F" />
            </View>
            <Text style={styles.connectTitle}>{t('apple_health.connect_title')}</Text>
            <Text style={styles.connectDescription}>{t('apple_health.connect_desc')}</Text>
            <Pressable
              style={[styles.connectButton, isLoading && styles.buttonDisabled]}
              onPress={handleConnect}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.connectButtonText}>{t('apple_health.button_connect')}</Text>
              )}
            </Pressable>
            {error && <Text style={styles.errorText}>{error}</Text>}
          </View>
        ) : (
          <>
            {/* Refresh bar */}
            <View style={styles.refreshRow}>
              <Text style={styles.lastRefreshText}>
                {lastRefresh
                  ? t('apple_health.last_updated', { time: lastRefresh.toLocaleTimeString() })
                  : t('apple_health.last_updated_never')}
              </Text>
              <Pressable style={styles.refreshButton} onPress={handleRefresh} disabled={isLoading}>
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.refreshButtonText}>{t('apple_health.button_refresh')}</Text>
                )}
              </Pressable>
            </View>

            {/* Steps */}
            <GlassDataCard
              title={t('apple_health.card_steps')}
              icon="walk-outline"
              value={steps?.steps?.toLocaleString() || '--'}
              unit={t('activity.steps').toLowerCase()}
              color={colors.steps}
            />

            {/* Heart Rate */}
            <GlassDataCard
              title={t('apple_health.card_heart_rate')}
              icon="heart-outline"
              value={heartRate?.heartRate?.toString() || '--'}
              unit="bpm"
              color={colors.heartRate}
              details={[
                { label: t('apple_health.label_hrv_sdnn'), value: hrv?.sdnn ? `${hrv.sdnn.toFixed(0)} ms` : '--' },
              ]}
            />

            {/* Sleep */}
            <GlassDataCard
              title={t('apple_health.card_sleep')}
              icon="moon-outline"
              value={sleep ? formatSleepTime(sleep) : '--'}
              unit=""
              color={colors.sleep}
              details={sleep ? [
                { label: t('apple_health.label_deep'), value: `${sleep.deep} min` },
                { label: t('apple_health.label_light'), value: `${sleep.light} min` },
                { label: t('apple_health.label_rem'), value: `${sleep.rem} min` },
                { label: t('apple_health.label_awake'), value: `${sleep.awake} min` },
                { label: t('apple_health.label_efficiency'), value: `${sleep.sleepEfficiency}%` },
              ] : undefined}
            />

            {/* Blood Oxygen */}
            <GlassDataCard
              title={t('apple_health.card_blood_oxygen')}
              icon="water-outline"
              value={spo2?.spo2?.toString() || '--'}
              unit="%"
              color={colors.spo2}
            />

            {/* Info */}
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>{t('apple_health.info_title')}</Text>
              <Text style={styles.infoText}>{t('apple_health.info_desc')}</Text>
              <Text style={styles.infoText}>• {t('apple_health.info_watch')}</Text>
              <Text style={styles.infoText}>• {t('apple_health.info_iphone')}</Text>
              <Text style={styles.infoText}>• {t('apple_health.info_third_party')}</Text>
              <Text style={styles.infoText}>• {t('apple_health.info_manual')}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Glass Data Card ─────────────────────────────────────────────────────────

const GlassDataCard: React.FC<{
  title: string;
  icon: string;
  value: string;
  unit: string;
  color: string;
  details?: { label: string; value: string }[];
}> = ({ title, icon, value, unit, color, details }) => (
  <View style={styles.dataCard}>
    <View style={styles.dataCardHeader}>
      {icon === 'heart-outline'
        ? <HeartIcon size={20} color={color} />
        : <Ionicons name={icon as any} size={20} color={color} />}
      <Text style={styles.dataCardTitle}>{title}</Text>
    </View>
    <View style={styles.dataCardValue}>
      <Text style={[styles.valueText, { color }]}>{value}</Text>
      {unit ? <Text style={styles.unitText}>{unit}</Text> : null}
    </View>
    {details && details.length > 0 && (
      <View style={styles.detailsContainer}>
        {details.map((d, i) => (
          <View key={i} style={styles.detailRow}>
            <Text style={styles.detailLabel}>{d.label}</Text>
            <Text style={styles.detailValue}>{d.value}</Text>
          </View>
        ))}
      </View>
    )}
  </View>
);

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: { fontSize: fontSize.xxl, fontFamily: fontFamily.demiBold, color: colors.text },
  connectedBadge: {
    backgroundColor: `${colors.success}20`,
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  connectedText: { fontSize: fontSize.xs, fontFamily: fontFamily.demiBold, color: colors.success },
  scrollView: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  title: { fontSize: fontSize.xxl, fontFamily: fontFamily.demiBold, color: colors.text, marginTop: spacing.md, marginBottom: spacing.sm, textAlign: 'center' },
  subtitle: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  connectCard: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: borderRadius.xl,
    padding: spacing.xl, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  connectTitle: { fontSize: fontSize.xl, fontFamily: fontFamily.demiBold, color: colors.text, marginBottom: spacing.sm },
  connectDescription: { fontSize: fontSize.md, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg, lineHeight: 22 },
  connectButton: {
    backgroundColor: '#FF375F', paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, minWidth: 150, alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  connectButtonText: { fontSize: fontSize.md, fontFamily: fontFamily.demiBold, color: '#fff' },
  errorText: { fontSize: fontSize.sm, color: colors.error, marginTop: spacing.md, textAlign: 'center' },
  refreshRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.lg },
  lastRefreshText: { fontSize: fontSize.sm, color: colors.textSecondary },
  refreshButton: { backgroundColor: 'rgba(255,255,255,0.07)', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.md },
  refreshButtonText: { fontSize: fontSize.sm, fontFamily: fontFamily.demiBold, color: colors.primary },
  dataCard: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: borderRadius.xl,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  dataCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm },
  dataCardTitle: { fontSize: fontSize.md, fontFamily: fontFamily.demiBold, color: colors.text },
  dataCardValue: { flexDirection: 'row', alignItems: 'baseline' },
  valueText: { fontSize: 36, fontFamily: fontFamily.demiBold },
  unitText: { fontSize: fontSize.lg, color: colors.textSecondary, marginLeft: spacing.xs },
  detailsContainer: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs },
  detailLabel: { fontSize: fontSize.sm, color: colors.textSecondary },
  detailValue: { fontSize: fontSize.sm, fontFamily: fontFamily.demiBold, color: colors.text },
  infoCard: {
    backgroundColor: 'rgba(0, 212, 170, 0.05)', borderRadius: borderRadius.xl,
    padding: spacing.lg, marginTop: spacing.md,
    borderWidth: 1, borderColor: 'rgba(0, 212, 170, 0.15)',
  },
  infoTitle: { fontSize: fontSize.md, fontFamily: fontFamily.demiBold, color: colors.text, marginBottom: spacing.sm },
  infoText: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.xs },
});

export default AppleHealthScreen;
