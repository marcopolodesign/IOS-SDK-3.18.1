/**
 * HealthKitPermissions — availability checks and permission requests
 * Uses @kingstinct/react-native-healthkit v13 API
 */

import {
  isHealthDataAvailable,
  getMostRecentQuantitySample,
  getMostRecentCategorySample,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { reportError } from '../../utils/sentry';

class HealthKitPermissions {
  private _hasRequestedAuthorization = false;

  get hasAuthorization(): boolean {
    return this._hasRequestedAuthorization;
  }

  resetAuthorization(): void {
    this._hasRequestedAuthorization = false;
  }

  async checkHealthKitPermissions(): Promise<boolean> {
    try {
      const isAvailable = await isHealthDataAvailable();
      if (!isAvailable) return false;

      let hasAnyPermission = false;

      const checks: Array<() => Promise<any>> = [
        () => getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate'),
        () => getMostRecentQuantitySample('HKQuantityTypeIdentifierStepCount'),
        () => getMostRecentCategorySample('HKCategoryTypeIdentifierSleepAnalysis'),
        () => getMostRecentQuantitySample('HKQuantityTypeIdentifierOxygenSaturation'),
        () => getMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRateVariabilitySDNN'),
      ];

      for (const check of checks) {
        if (hasAnyPermission) break;
        try {
          const result = await check();
          if (result) hasAnyPermission = true;
        } catch (e: any) {
          if (e?.message?.includes('NSSortDescriptor')) throw e;
          reportError(e, { op: 'healthKit.checkPermissions.inner' }, 'warning');
        }
      }

      if (hasAnyPermission) {
        this._hasRequestedAuthorization = true;
      }

      return hasAnyPermission;
    } catch (error) {
      console.error('[HealthKit] Fatal error checking permissions:', error);
      reportError(error, { op: 'healthKit.checkPermissions' });
      this._hasRequestedAuthorization = false;
      return false;
    }
  }

  async requestHealthDataAuthorization(): Promise<boolean> {
    try {
      const isAvailable = await isHealthDataAvailable();
      if (!isAvailable) return false;

      await requestAuthorization({
        toRead: [
          'HKQuantityTypeIdentifierHeartRate',
          'HKQuantityTypeIdentifierStepCount',
          'HKCategoryTypeIdentifierSleepAnalysis',
          'HKQuantityTypeIdentifierOxygenSaturation',
          'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
          'HKQuantityTypeIdentifierActiveEnergyBurned',
          'HKQuantityTypeIdentifierDistanceWalkingRunning',
          'HKWorkoutTypeIdentifier',
        ] as any,
      });

      this._hasRequestedAuthorization = true;
      return true;
    } catch (error) {
      console.log('[HealthKit] Error requesting authorization:', error);
      reportError(error, { op: 'healthKit.requestAuth' }, 'warning');
      return false;
    }
  }
}

export default HealthKitPermissions;
