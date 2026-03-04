export type MetricKey =
  | 'recovery_score'
  | 'sleep_score'
  | 'metric_insight_strain'
  | 'metric_insight_readiness'
  | 'sleep_duration'
  | 'sleep_deep'
  | 'sleep_rem'
  | 'sleep_light'
  | 'sleep_awake'
  | 'resting_hr'
  | 'live_hr'
  | 'daily_hr_chart'
  | 'hrv_sdnn'
  | 'spo2'
  | 'respiratory_rate'
  | 'body_temperature'
  | 'steps'
  | 'calorie_deficit'
  | 'sleep_trend_7d'
  | 'contributor_hrv_balance'
  | 'contributor_resting_hr_delta'
  | 'contributor_sleep_quality'
  | 'contributor_temperature';

export type ChartType = 'score_arc' | 'range_bar' | 'sleep_stages' | 'waveform' | 'none';

export interface RangeEntry {
  label: string;
  min: number;
  max: number;
  color: string;
  isNormal?: boolean;
}

export interface ArcZone {
  label: string;
  min: number;
  max: number;
  color: string;
}

export interface MetricExplanation {
  title: string;
  subtitle: string;
  body: string;
  ranges?: string[];
  chart:
    | { type: 'range_bar'; ranges: RangeEntry[]; unit: string }
    | { type: 'score_arc'; zones: ArcZone[] }
    | { type: 'sleep_stages' }
    | { type: 'waveform' }
    | { type: 'none' };
  accentColor: string;
}

export const METRIC_EXPLANATIONS: Record<MetricKey, MetricExplanation> = {
  recovery_score: {
    title: 'Recovery Score',
    subtitle: 'How ready your body is today',
    body:
      'Recovery score combines HRV, resting heart rate, sleep quality, and body temperature to estimate how well your body recovered overnight. A high score means you can push hard today. A low score suggests prioritizing rest.',
    ranges: ['85–100 → Optimal: push hard', '65–84 → Good: normal training', '40–64 → Fair: moderate effort', '0–39 → Poor: rest day'],
    chart: {
      type: 'score_arc',
      zones: [
        { label: 'Poor', min: 0, max: 39, color: '#FF4444' },
        { label: 'Fair', min: 40, max: 64, color: '#FFD700' },
        { label: 'Good', min: 65, max: 84, color: '#4ADE80' },
        { label: 'Optimal', min: 85, max: 100, color: '#00E5FF' },
      ],
    },
    accentColor: '#00E5FF',
  },

  sleep_score: {
    title: 'Sleep Score',
    subtitle: 'Overall quality of last night\'s sleep',
    body:
      'Sleep score reflects total sleep duration, time in each stage (deep, REM, light), sleep consistency, and restlessness. It ranges from 0–100 and gives you a single number to gauge how restorative your sleep was.',
    ranges: ['85–100 → Excellent', '65–84 → Good', '40–64 → Fair', '0–39 → Poor'],
    chart: {
      type: 'score_arc',
      zones: [
        { label: 'Poor', min: 0, max: 39, color: '#FF4444' },
        { label: 'Fair', min: 40, max: 64, color: '#FFD700' },
        { label: 'Good', min: 65, max: 84, color: '#7B5EE0' },
        { label: 'Excellent', min: 85, max: 100, color: '#A855F7' },
      ],
    },
    accentColor: '#A855F7',
  },

  metric_insight_strain: {
    title: 'Strain',
    subtitle: 'Cardiovascular load from today\'s activity',
    body:
      'Strain measures how much cardiovascular stress your body accumulated during the day based on heart rate data. Higher strain means more exertion. Balancing strain against your recovery score helps avoid overtraining.',
    ranges: ['0–9 → Rest / Light', '10–13 → Moderate', '14–17 → Strenuous', '18–21 → All Out'],
    chart: {
      type: 'score_arc',
      zones: [
        { label: 'Light', min: 0, max: 9, color: '#4ADE80' },
        { label: 'Moderate', min: 10, max: 13, color: '#FFD700' },
        { label: 'Strenuous', min: 14, max: 17, color: '#FF6B35' },
        { label: 'All Out', min: 18, max: 21, color: '#FF4444' },
      ],
    },
    accentColor: '#FF6B35',
  },

  metric_insight_readiness: {
    title: 'Readiness',
    subtitle: 'Balance of recent strain vs. recovery',
    body:
      'Readiness combines your recent training load with overnight recovery to estimate whether your body is prepared for intense effort. It acts as a guide for how aggressively to push workouts or activities today.',
    ranges: ['85–100 → Peak', '65–84 → Ready', '40–64 → Moderate', '0–39 → Rest advised'],
    chart: {
      type: 'score_arc',
      zones: [
        { label: 'Rest', min: 0, max: 39, color: '#FF4444' },
        { label: 'Moderate', min: 40, max: 64, color: '#FFD700' },
        { label: 'Ready', min: 65, max: 84, color: '#4ADE80' },
        { label: 'Peak', min: 85, max: 100, color: '#00E5FF' },
      ],
    },
    accentColor: '#4ADE80',
  },

  sleep_duration: {
    title: 'Sleep Duration',
    subtitle: 'Total time asleep last night',
    body:
      'Sleep duration is the total time you spent asleep, not just in bed. Adults generally need 7–9 hours. Consistently sleeping less than 6 hours raises health risks, while over 10 hours may indicate illness or excessive fatigue.',
    ranges: ['< 6 hrs → Insufficient', '6–7 hrs → Below optimal', '7–9 hrs → Recommended', '> 9 hrs → Extended'],
    chart: { type: 'none' },
    accentColor: '#7B5EE0',
  },

  sleep_deep: {
    title: 'Sleep Stages',
    subtitle: 'Deep, REM, light, and awake time',
    body:
      'Your sleep cycles through light, deep (slow-wave), and REM stages. Deep sleep restores the body physically; REM consolidates memory and emotion. Light sleep bridges the transitions. Awake time should be minimal.',
    ranges: ['Deep: ~15–25% of total', 'REM: ~20–25% of total', 'Light: ~50–60% of total', 'Awake: <5% ideal'],
    chart: { type: 'sleep_stages' },
    accentColor: '#5B3FC4',
  },

  sleep_rem: {
    title: 'REM Sleep',
    subtitle: 'Memory consolidation & emotional reset',
    body:
      'REM (Rapid Eye Movement) sleep is when most dreaming occurs. It plays a critical role in memory formation, creativity, and emotional regulation. Adults typically spend 20–25% of the night in REM across 4–5 cycles.',
    ranges: ['< 15% → Low', '15–25% → Normal', '> 25% → High (unusual)'],
    chart: { type: 'sleep_stages' },
    accentColor: '#8B5CF6',
  },

  sleep_light: {
    title: 'Light Sleep',
    subtitle: 'Transitional restorative sleep',
    body:
      'Light sleep (N1 and N2 stages) accounts for about half your night. It helps consolidate memories and is a transition into deeper sleep. While less restorative than deep sleep, it is a necessary part of healthy sleep architecture.',
    chart: { type: 'sleep_stages' },
    accentColor: '#60A5FA',
  },

  sleep_awake: {
    title: 'Time Awake',
    subtitle: 'Interruptions during the night',
    body:
      'Brief awakenings are normal — you may wake briefly dozens of times without remembering. More than 5% of your sleep window spent awake can reduce overall sleep quality and indicate restlessness or disturbances.',
    ranges: ['< 5% of sleep → Normal', '5–10% → Slightly elevated', '> 10% → Disrupted'],
    chart: { type: 'sleep_stages' },
    accentColor: 'rgba(255,255,255,0.5)',
  },

  resting_hr: {
    title: 'Resting Heart Rate',
    subtitle: 'Beats per minute while at rest',
    body:
      'Resting heart rate (RHR) is the number of times your heart beats per minute while you\'re at rest. Lower RHR generally indicates better cardiovascular fitness. An elevated RHR can signal stress, illness, or insufficient recovery.',
    ranges: ['< 50 bpm → Athletic', '50–60 bpm → Excellent', '60–80 bpm → Normal', '> 80 bpm → Elevated'],
    chart: {
      type: 'range_bar',
      unit: 'bpm',
      ranges: [
        { label: 'Athletic', min: 30, max: 50, color: '#00E5FF' },
        { label: 'Excellent', min: 50, max: 60, color: '#4ADE80', isNormal: true },
        { label: 'Normal', min: 60, max: 80, color: '#FFD700', isNormal: true },
        { label: 'Elevated', min: 80, max: 110, color: '#FF4444' },
      ],
    },
    accentColor: '#FF6B6B',
  },

  live_hr: {
    title: 'Live Heart Rate',
    subtitle: 'Real-time beats per minute',
    body:
      'Live heart rate measures your heart rate in real time using your ring\'s optical sensor. Use this during a workout warm-up, after waking, or to check stress levels. Values vary significantly with activity, stress, and body position.',
    chart: { type: 'waveform' },
    accentColor: '#FF6B6B',
  },

  daily_hr_chart: {
    title: 'Heart Rate Through the Day',
    subtitle: 'Hourly heart rate pattern',
    body:
      'This chart shows how your heart rate changed throughout the day. Peaks typically coincide with activity or stress, while valleys reflect rest and recovery. Consistent, predictable patterns suggest good cardiovascular health.',
    chart: { type: 'waveform' },
    accentColor: '#FF6B6B',
  },

  hrv_sdnn: {
    title: 'HRV — SDNN',
    subtitle: 'Heart rate variability (Standard Deviation)',
    body:
      'Heart Rate Variability (HRV) measures the variation in time between heartbeats. Higher HRV generally indicates better recovery, resilience to stress, and cardiovascular fitness. SDNN is the most common HRV metric from wearables.',
    ranges: ['< 20 ms → Very low', '20–50 ms → Low–moderate', '50–100 ms → Good', '> 100 ms → Excellent'],
    chart: {
      type: 'range_bar',
      unit: 'ms',
      ranges: [
        { label: 'Very low', min: 0, max: 20, color: '#FF4444' },
        { label: 'Low', min: 20, max: 50, color: '#FFD700' },
        { label: 'Good', min: 50, max: 100, color: '#4ADE80', isNormal: true },
        { label: 'Excellent', min: 100, max: 150, color: '#00E5FF' },
      ],
    },
    accentColor: '#4ADE80',
  },

  spo2: {
    title: 'Blood Oxygen (SpO2)',
    subtitle: 'Oxygen saturation in your blood',
    body:
      'SpO2 (blood oxygen saturation) measures the percentage of hemoglobin in your blood that is carrying oxygen. Healthy adults typically read 95–100%. Values below 90% may indicate a medical concern.',
    ranges: ['95–100% → Normal', '90–94% → Slightly low', '< 90% → Seek medical attention'],
    chart: {
      type: 'range_bar',
      unit: '%',
      ranges: [
        { label: 'Seek care', min: 75, max: 90, color: '#FF4444' },
        { label: 'Low', min: 90, max: 95, color: '#FFD700' },
        { label: 'Normal', min: 95, max: 100, color: '#4ADE80', isNormal: true },
      ],
    },
    accentColor: '#3B82F6',
  },

  respiratory_rate: {
    title: 'Respiratory Rate',
    subtitle: 'Breaths per minute while sleeping',
    body:
      'Respiratory rate is how many breaths you take per minute during sleep. It\'s calculated from your ring\'s heart rate sensor. A normal resting rate is 12–20 breaths per minute. Elevated rates can indicate illness, stress, or sleep apnea.',
    ranges: ['< 12 bpm → Low', '12–20 bpm → Normal', '20–25 bpm → Elevated', '> 25 bpm → High'],
    chart: {
      type: 'range_bar',
      unit: 'br/min',
      ranges: [
        { label: 'Low', min: 6, max: 12, color: '#FFD700' },
        { label: 'Normal', min: 12, max: 20, color: '#4ADE80', isNormal: true },
        { label: 'Elevated', min: 20, max: 25, color: '#FFD700' },
        { label: 'High', min: 25, max: 32, color: '#FF4444' },
      ],
    },
    accentColor: '#60A5FA',
  },

  body_temperature: {
    title: 'Body Temperature',
    subtitle: 'Skin temperature relative to baseline',
    body:
      'Your ring measures wrist skin temperature, which correlates with core body temperature. Deviations from your personal baseline of ±0.5°C are normal; deviations greater than 1–2°C may indicate fever, illness, or hormonal shifts.',
    ranges: ['< 35.5°C → Below normal', '36.1–37.2°C → Normal range', '37.3–38°C → Low-grade fever', '> 38°C → Fever'],
    chart: {
      type: 'range_bar',
      unit: '°C',
      ranges: [
        { label: 'Low', min: 34, max: 36.1, color: '#60A5FA' },
        { label: 'Normal', min: 36.1, max: 37.2, color: '#4ADE80', isNormal: true },
        { label: 'Elevated', min: 37.2, max: 38, color: '#FFD700' },
        { label: 'Fever', min: 38, max: 40, color: '#FF4444' },
      ],
    },
    accentColor: '#FF6B35',
  },

  steps: {
    title: 'Active Calories',
    subtitle: 'Energy burned through movement',
    body:
      'Active calories (also called exercise calories) are the calories your body burns beyond its basal metabolic rate due to physical movement. The daily goal of 500–700 kcal is a good target for general health and body composition.',
    ranges: ['< 200 kcal → Sedentary', '200–400 kcal → Lightly active', '400–700 kcal → Active', '> 700 kcal → Very active'],
    chart: { type: 'none' },
    accentColor: '#FF6B35',
  },

  calorie_deficit: {
    title: 'Calorie Deficit',
    subtitle: 'Calories burned vs. consumed',
    body:
      'Calorie deficit shows the gap between energy consumed (food) and energy expended (metabolism + activity). A moderate deficit of 200–500 kcal/day supports gradual, sustainable fat loss. Avoid large deficits — they impair recovery and muscle maintenance.',
    ranges: ['> 500 deficit → Aggressive cut', '200–500 deficit → Moderate cut', '< 200 either side → Maintenance', '> 200 surplus → Building'],
    chart: { type: 'none' },
    accentColor: '#FF6B35',
  },

  sleep_trend_7d: {
    title: '7-Day Sleep Trend',
    subtitle: 'Your sleep pattern over the past week',
    body:
      'The 7-day trend shows your sleep score each night over the past week. Consistency matters as much as individual nights — irregular schedules disrupt your circadian rhythm, which affects energy, mood, and metabolic health.',
    chart: { type: 'none' },
    accentColor: '#7B5EE0',
  },

  contributor_hrv_balance: {
    title: 'HRV Balance',
    subtitle: 'Recent HRV trend vs. your baseline',
    body:
      'HRV Balance compares your recent (3-day) HRV to your longer-term baseline. A positive balance means your HRV is trending above average — a sign of good recovery accumulation. Negative balance indicates recent stress or under-recovery.',
    chart: { type: 'none' },
    accentColor: '#4ADE80',
  },

  contributor_resting_hr_delta: {
    title: 'Resting HR Trend',
    subtitle: 'Today\'s resting HR vs. your personal average',
    body:
      'This contributor compares today\'s resting heart rate to your 30-day baseline. A resting HR that is 3+ bpm above normal often predicts reduced performance or early illness. Lower-than-normal RHR suggests excellent recovery.',
    chart: { type: 'waveform' },
    accentColor: '#FF6B6B',
  },

  contributor_sleep_quality: {
    title: 'Sleep Quality Score',
    subtitle: 'Efficiency and depth of last night\'s sleep',
    body:
      'Sleep quality is a combined measure of sleep efficiency (time asleep ÷ time in bed), the proportion of deep + REM sleep, and the number of awakenings. It contributes to both recovery and readiness scores.',
    chart: { type: 'sleep_stages' },
    accentColor: '#7B5EE0',
  },

  contributor_temperature: {
    title: 'Temperature Deviation',
    subtitle: 'Skin temperature vs. your baseline',
    body:
      'Temperature deviation tracks how much your wrist temperature differs from your personal normal. Small fluctuations are expected. A sustained deviation above +1°C may indicate your body is fighting inflammation, infection, or experiencing hormonal changes.',
    ranges: ['+/− 0.5°C → Normal variation', '+/− 0.5–1°C → Mild deviation', '> 1°C → Notable — monitor closely'],
    chart: {
      type: 'range_bar',
      unit: '°C dev',
      ranges: [
        { label: 'Cold', min: -2, max: -0.5, color: '#60A5FA' },
        { label: 'Normal', min: -0.5, max: 0.5, color: '#4ADE80', isNormal: true },
        { label: 'Warm', min: 0.5, max: 2, color: '#FF6B35' },
      ],
    },
    accentColor: '#FF6B35',
  },
};
