/**
 * HealthKitService — Facade that composes HealthKit sub-services
 * Uses @kingstinct/react-native-healthkit (New Architecture compatible)
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import HealthKitPermissions from './HealthKit/HealthKitPermissions';
import HealthKitDataFetchers from './HealthKit/HealthKitDataFetchers';
import HealthKitSleepProcessor from './HealthKit/HealthKitSleepProcessor';
import HealthKitSubscriptions from './HealthKit/HealthKitSubscriptions';
import HealthKitWorkoutFetcher from './HealthKit/HealthKitWorkoutFetcher';
import type { HealthKitCallbacks } from './HealthKit/HealthKitSubscriptions';
import type { HKStepsResult, HKHeartRateResult, HKHRVResult, HKSpO2Result, HKActiveCaloriesResult, HKDistanceResult } from './HealthKit/HealthKitDataFetchers';
import type { HKSleepResult } from './HealthKit/HealthKitSleepProcessor';
import type { HKWorkoutResult } from '../types/activity.types';

const CONNECTED_KEY = 'apple_health_connected_v1';

class HealthKitService {
  private permissions = new HealthKitPermissions();
  private dataFetchers = new HealthKitDataFetchers();
  private sleepProcessor = new HealthKitSleepProcessor();
  private subscriptions = new HealthKitSubscriptions();
  private workoutFetcher = new HealthKitWorkoutFetcher();

  // ── Availability & connection ───────────────────────────────────────

  isHealthKitAvailable(): boolean {
    return Platform.OS === 'ios';
  }

  async isConnected(): Promise<boolean> {
    try {
      const stored = await AsyncStorage.getItem(CONNECTED_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    try {
      const success = await this.permissions.requestHealthDataAuthorization();
      if (success) {
        await AsyncStorage.setItem(CONNECTED_KEY, 'true');
      }
      return success;
    } catch (error) {
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    return this.permissions.checkHealthKitPermissions();
  }

  get hasAuthorization(): boolean {
    return this.permissions.hasAuthorization;
  }

  // ── Data fetchers ───────────────────────────────────────────────────

  async fetchHeartRate(): Promise<HKHeartRateResult | null> {
    return this.dataFetchers.fetchHeartRateData();
  }

  async fetchSteps(): Promise<HKStepsResult> {
    return this.dataFetchers.fetchStepsData();
  }

  async fetchHRV(): Promise<HKHRVResult | null> {
    return this.dataFetchers.fetchHRVData();
  }

  async fetchSpO2(): Promise<HKSpO2Result | null> {
    return this.dataFetchers.fetchSpO2Data();
  }

  async fetchActiveCalories(): Promise<HKActiveCaloriesResult> {
    return this.dataFetchers.fetchActiveCaloriesData();
  }

  async fetchDistance(): Promise<HKDistanceResult> {
    return this.dataFetchers.fetchDistanceData();
  }

  async fetchSleep(): Promise<HKSleepResult | null> {
    return this.sleepProcessor.fetchSleepData();
  }

  async fetchAllHealthData(): Promise<{
    heartRate: HKHeartRateResult | null;
    steps: HKStepsResult;
    sleep: HKSleepResult | null;
    hrv: HKHRVResult | null;
    spo2: HKSpO2Result | null;
  }> {
    if (!this.permissions.hasAuthorization) {
      // Try probing first (cheap if already authorized); only request if probe fails
      const probed = await this.permissions.checkHealthKitPermissions();
      if (!probed) {
        const ok = await this.permissions.requestHealthDataAuthorization();
        if (!ok) throw new Error('HealthKit authorization failed');
      }
    }

    const [heartRate, steps, sleep, hrv, spo2] = await Promise.all([
      this.fetchHeartRate(),
      this.fetchSteps(),
      this.fetchSleep(),
      this.fetchHRV(),
      this.fetchSpO2(),
    ]);

    return { heartRate, steps, sleep, hrv, spo2 };
  }

  // ── Workouts ───────────────────────────────────────────────────────

  async fetchWorkouts(from: Date, to: Date): Promise<HKWorkoutResult[]> {
    if (Platform.OS !== 'ios') return [];
    return this.workoutFetcher.fetchWorkouts(from, to);
  }

  async fetchWeekWorkouts(): Promise<HKWorkoutResult[]> {
    if (Platform.OS !== 'ios') return [];
    return this.workoutFetcher.fetchWeekWorkouts();
  }

  // ── Subscriptions ───────────────────────────────────────────────────

  setupSubscriptions(callbacks: HealthKitCallbacks): void {
    this.subscriptions.setupHealthDataSubscriptions(callbacks, this.permissions.hasAuthorization);
  }

  clearSubscriptions(): void {
    this.subscriptions.clearSubscriptions();
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  cleanup(): void {
    this.clearSubscriptions();
    this.permissions.resetAuthorization();
  }
}

export default new HealthKitService();

export type { HKStepsResult, HKHeartRateResult, HKHRVResult, HKSpO2Result, HKActiveCaloriesResult, HKDistanceResult, HKSleepResult, HKWorkoutResult, HealthKitCallbacks };
