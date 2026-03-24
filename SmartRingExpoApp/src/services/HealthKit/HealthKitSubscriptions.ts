/**
 * HealthKitSubscriptions — real-time change listeners for Apple Health data
 * Uses @kingstinct/react-native-healthkit v13 API
 */

import { subscribeToChanges } from '@kingstinct/react-native-healthkit';

export interface HealthKitCallbacks {
  onHeartRateChange?: () => void;
  onStepsChange?: () => void;
  onSleepChange?: () => void;
}

class HealthKitSubscriptions {
  private subscriptions: Array<{ remove: () => boolean }> = [];

  setupHealthDataSubscriptions(callbacks: HealthKitCallbacks, hasAuthorization: boolean): void {
    if (!hasAuthorization) return;
    this.clearSubscriptions();

    const subs: Array<{ type: string; cb?: () => void }> = [
      { type: 'HKQuantityTypeIdentifierHeartRate', cb: callbacks.onHeartRateChange },
      { type: 'HKQuantityTypeIdentifierStepCount', cb: callbacks.onStepsChange },
      { type: 'HKCategoryTypeIdentifierSleepAnalysis', cb: callbacks.onSleepChange },
    ];

    for (const { type, cb } of subs) {
      try {
        const sub = subscribeToChanges(type as any, () => cb?.());
        this.subscriptions.push(sub);
      } catch (error) {
        console.log(`[HealthKit] Error subscribing to ${type} changes:`, error);
      }
    }
  }

  clearSubscriptions(): void {
    for (const sub of this.subscriptions) {
      try { sub.remove(); } catch {}
    }
    this.subscriptions = [];
  }

  get hasActiveSubscriptions(): boolean {
    return this.subscriptions.length > 0;
  }
}

export default HealthKitSubscriptions;
