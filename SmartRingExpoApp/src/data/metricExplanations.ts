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
  | 'sleep_debt'
  | 'sleep_baseline'
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

type TFunc = (key: string) => string;

export function getMetricExplanations(t: TFunc): Record<MetricKey, MetricExplanation> {
  return {
    recovery_score: {
      title: t('explainer.recovery_score_title'),
      subtitle: t('explainer.recovery_score_subtitle'),
      body: t('explainer.recovery_score_body'),
      ranges: [
        t('explainer.recovery_score_range_0'),
        t('explainer.recovery_score_range_1'),
        t('explainer.recovery_score_range_2'),
        t('explainer.recovery_score_range_3'),
      ],
      chart: {
        type: 'score_arc',
        zones: [
          { label: t('explainer.lbl_poor'), min: 0, max: 39, color: '#FF4444' },
          { label: t('explainer.lbl_fair'), min: 40, max: 64, color: '#FFD700' },
          { label: t('explainer.lbl_good'), min: 65, max: 84, color: '#4ADE80' },
          { label: t('explainer.lbl_optimal'), min: 85, max: 100, color: '#00E5FF' },
        ],
      },
      accentColor: '#00E5FF',
    },

    sleep_score: {
      title: t('explainer.sleep_score_title'),
      subtitle: t('explainer.sleep_score_subtitle'),
      body: t('explainer.sleep_score_body'),
      ranges: [
        t('explainer.sleep_score_range_0'),
        t('explainer.sleep_score_range_1'),
        t('explainer.sleep_score_range_2'),
        t('explainer.sleep_score_range_3'),
      ],
      chart: {
        type: 'score_arc',
        zones: [
          { label: t('explainer.lbl_poor'), min: 0, max: 39, color: '#FF4444' },
          { label: t('explainer.lbl_fair'), min: 40, max: 64, color: '#FFD700' },
          { label: t('explainer.lbl_good'), min: 65, max: 84, color: '#7B5EE0' },
          { label: t('explainer.lbl_excellent'), min: 85, max: 100, color: '#A855F7' },
        ],
      },
      accentColor: '#A855F7',
    },

    metric_insight_strain: {
      title: t('explainer.strain_title'),
      subtitle: t('explainer.strain_subtitle'),
      body: t('explainer.strain_body'),
      ranges: [
        t('explainer.strain_range_0'),
        t('explainer.strain_range_1'),
        t('explainer.strain_range_2'),
        t('explainer.strain_range_3'),
      ],
      chart: {
        type: 'score_arc',
        zones: [
          { label: t('explainer.lbl_light'), min: 0, max: 9, color: '#4ADE80' },
          { label: t('explainer.lbl_moderate'), min: 10, max: 13, color: '#FFD700' },
          { label: t('explainer.lbl_strenuous'), min: 14, max: 17, color: '#FF6B35' },
          { label: t('explainer.lbl_all_out'), min: 18, max: 21, color: '#FF4444' },
        ],
      },
      accentColor: '#FF6B35',
    },

    metric_insight_readiness: {
      title: t('explainer.readiness_title'),
      subtitle: t('explainer.readiness_subtitle'),
      body: t('explainer.readiness_body'),
      ranges: [
        t('explainer.readiness_range_0'),
        t('explainer.readiness_range_1'),
        t('explainer.readiness_range_2'),
        t('explainer.readiness_range_3'),
      ],
      chart: {
        type: 'score_arc',
        zones: [
          { label: t('explainer.lbl_rest'), min: 0, max: 39, color: '#FF4444' },
          { label: t('explainer.lbl_moderate'), min: 40, max: 64, color: '#FFD700' },
          { label: t('explainer.lbl_ready'), min: 65, max: 84, color: '#4ADE80' },
          { label: t('explainer.lbl_peak'), min: 85, max: 100, color: '#00E5FF' },
        ],
      },
      accentColor: '#4ADE80',
    },

    sleep_duration: {
      title: t('explainer.sleep_duration_title'),
      subtitle: t('explainer.sleep_duration_subtitle'),
      body: t('explainer.sleep_duration_body'),
      ranges: [
        t('explainer.sleep_duration_range_0'),
        t('explainer.sleep_duration_range_1'),
        t('explainer.sleep_duration_range_2'),
        t('explainer.sleep_duration_range_3'),
      ],
      chart: { type: 'none' },
      accentColor: '#7B5EE0',
    },

    sleep_deep: {
      title: t('explainer.sleep_deep_title'),
      subtitle: t('explainer.sleep_deep_subtitle'),
      body: t('explainer.sleep_deep_body'),
      ranges: [
        t('explainer.sleep_deep_range_0'),
        t('explainer.sleep_deep_range_1'),
        t('explainer.sleep_deep_range_2'),
        t('explainer.sleep_deep_range_3'),
      ],
      chart: { type: 'sleep_stages' },
      accentColor: '#5B3FC4',
    },

    sleep_rem: {
      title: t('explainer.sleep_rem_title'),
      subtitle: t('explainer.sleep_rem_subtitle'),
      body: t('explainer.sleep_rem_body'),
      ranges: [
        t('explainer.sleep_rem_range_0'),
        t('explainer.sleep_rem_range_1'),
        t('explainer.sleep_rem_range_2'),
      ],
      chart: { type: 'sleep_stages' },
      accentColor: '#8B5CF6',
    },

    sleep_light: {
      title: t('explainer.sleep_light_title'),
      subtitle: t('explainer.sleep_light_subtitle'),
      body: t('explainer.sleep_light_body'),
      chart: { type: 'sleep_stages' },
      accentColor: '#60A5FA',
    },

    sleep_awake: {
      title: t('explainer.sleep_awake_title'),
      subtitle: t('explainer.sleep_awake_subtitle'),
      body: t('explainer.sleep_awake_body'),
      ranges: [
        t('explainer.sleep_awake_range_0'),
        t('explainer.sleep_awake_range_1'),
        t('explainer.sleep_awake_range_2'),
      ],
      chart: { type: 'sleep_stages' },
      accentColor: 'rgba(255,255,255,0.5)',
    },

    resting_hr: {
      title: t('explainer.resting_hr_title'),
      subtitle: t('explainer.resting_hr_subtitle'),
      body: t('explainer.resting_hr_body'),
      ranges: [
        t('explainer.resting_hr_range_0'),
        t('explainer.resting_hr_range_1'),
        t('explainer.resting_hr_range_2'),
        t('explainer.resting_hr_range_3'),
      ],
      chart: {
        type: 'range_bar',
        unit: 'bpm',
        ranges: [
          { label: t('explainer.lbl_athletic'), min: 30, max: 50, color: '#00E5FF' },
          { label: t('explainer.lbl_excellent'), min: 50, max: 60, color: '#4ADE80', isNormal: true },
          { label: t('explainer.lbl_normal'), min: 60, max: 80, color: '#FFD700', isNormal: true },
          { label: t('explainer.lbl_elevated'), min: 80, max: 110, color: '#FF4444' },
        ],
      },
      accentColor: '#FF6B6B',
    },

    live_hr: {
      title: t('explainer.live_hr_title'),
      subtitle: t('explainer.live_hr_subtitle'),
      body: t('explainer.live_hr_body'),
      chart: { type: 'waveform' },
      accentColor: '#FF6B6B',
    },

    daily_hr_chart: {
      title: t('explainer.daily_hr_title'),
      subtitle: t('explainer.daily_hr_subtitle'),
      body: t('explainer.daily_hr_body'),
      chart: { type: 'waveform' },
      accentColor: '#FF6B6B',
    },

    hrv_sdnn: {
      title: t('explainer.hrv_sdnn_title'),
      subtitle: t('explainer.hrv_sdnn_subtitle'),
      body: t('explainer.hrv_sdnn_body'),
      ranges: [
        t('explainer.hrv_sdnn_range_0'),
        t('explainer.hrv_sdnn_range_1'),
        t('explainer.hrv_sdnn_range_2'),
        t('explainer.hrv_sdnn_range_3'),
      ],
      chart: {
        type: 'range_bar',
        unit: 'ms',
        ranges: [
          { label: t('explainer.lbl_very_low'), min: 0, max: 20, color: '#FF4444' },
          { label: t('explainer.lbl_low'), min: 20, max: 50, color: '#FFD700' },
          { label: t('explainer.lbl_good'), min: 50, max: 100, color: '#4ADE80', isNormal: true },
          { label: t('explainer.lbl_excellent'), min: 100, max: 150, color: '#00E5FF' },
        ],
      },
      accentColor: '#4ADE80',
    },

    spo2: {
      title: t('explainer.spo2_title'),
      subtitle: t('explainer.spo2_subtitle'),
      body: t('explainer.spo2_body'),
      ranges: [
        t('explainer.spo2_range_0'),
        t('explainer.spo2_range_1'),
        t('explainer.spo2_range_2'),
      ],
      chart: {
        type: 'range_bar',
        unit: '%',
        ranges: [
          { label: t('explainer.lbl_seek_care'), min: 75, max: 90, color: '#FF4444' },
          { label: t('explainer.lbl_low'), min: 90, max: 95, color: '#FFD700' },
          { label: t('explainer.lbl_normal'), min: 95, max: 100, color: '#4ADE80', isNormal: true },
        ],
      },
      accentColor: '#3B82F6',
    },

    respiratory_rate: {
      title: t('explainer.respiratory_title'),
      subtitle: t('explainer.respiratory_subtitle'),
      body: t('explainer.respiratory_body'),
      ranges: [
        t('explainer.respiratory_range_0'),
        t('explainer.respiratory_range_1'),
        t('explainer.respiratory_range_2'),
        t('explainer.respiratory_range_3'),
      ],
      chart: {
        type: 'range_bar',
        unit: 'br/min',
        ranges: [
          { label: t('explainer.lbl_low'), min: 6, max: 12, color: '#FFD700' },
          { label: t('explainer.lbl_normal'), min: 12, max: 20, color: '#4ADE80', isNormal: true },
          { label: t('explainer.lbl_elevated'), min: 20, max: 25, color: '#FFD700' },
          { label: t('explainer.lbl_high'), min: 25, max: 32, color: '#FF4444' },
        ],
      },
      accentColor: '#60A5FA',
    },

    body_temperature: {
      title: t('explainer.body_temp_title'),
      subtitle: t('explainer.body_temp_subtitle'),
      body: t('explainer.body_temp_body'),
      ranges: [
        t('explainer.body_temp_range_0'),
        t('explainer.body_temp_range_1'),
        t('explainer.body_temp_range_2'),
        t('explainer.body_temp_range_3'),
      ],
      chart: {
        type: 'range_bar',
        unit: '°C',
        ranges: [
          { label: t('explainer.lbl_low'), min: 34, max: 36.1, color: '#60A5FA' },
          { label: t('explainer.lbl_normal'), min: 36.1, max: 37.2, color: '#4ADE80', isNormal: true },
          { label: t('explainer.lbl_elevated'), min: 37.2, max: 38, color: '#FFD700' },
          { label: t('explainer.lbl_fever'), min: 38, max: 40, color: '#FF4444' },
        ],
      },
      accentColor: '#FF6B35',
    },

    steps: {
      title: t('explainer.steps_title'),
      subtitle: t('explainer.steps_subtitle'),
      body: t('explainer.steps_body'),
      ranges: [
        t('explainer.steps_range_0'),
        t('explainer.steps_range_1'),
        t('explainer.steps_range_2'),
        t('explainer.steps_range_3'),
      ],
      chart: { type: 'none' },
      accentColor: '#FF6B35',
    },

    calorie_deficit: {
      title: t('explainer.calorie_deficit_title'),
      subtitle: t('explainer.calorie_deficit_subtitle'),
      body: t('explainer.calorie_deficit_body'),
      ranges: [
        t('explainer.calorie_deficit_range_0'),
        t('explainer.calorie_deficit_range_1'),
        t('explainer.calorie_deficit_range_2'),
        t('explainer.calorie_deficit_range_3'),
      ],
      chart: { type: 'none' },
      accentColor: '#FF6B35',
    },

    sleep_trend_7d: {
      title: t('explainer.sleep_trend_7d_title'),
      subtitle: t('explainer.sleep_trend_7d_subtitle'),
      body: t('explainer.sleep_trend_7d_body'),
      chart: { type: 'none' },
      accentColor: '#7B5EE0',
    },

    sleep_debt: {
      title: t('explainer.sleep_debt_title'),
      subtitle: t('explainer.sleep_debt_subtitle'),
      body: t('explainer.sleep_debt_body'),
      ranges: [
        t('explainer.sleep_debt_range_0'),
        t('explainer.sleep_debt_range_1'),
        t('explainer.sleep_debt_range_2'),
        t('explainer.sleep_debt_range_3'),
      ],
      chart: { type: 'none' },
      accentColor: '#6B8EFF',
    },

    sleep_baseline: {
      title: t('explainer.sleep_baseline_title'),
      subtitle: t('explainer.sleep_baseline_subtitle'),
      body: t('explainer.sleep_baseline_body'),
      ranges: [
        t('explainer.sleep_baseline_range_0'),
        t('explainer.sleep_baseline_range_1'),
        t('explainer.sleep_baseline_range_2'),
        t('explainer.sleep_baseline_range_3'),
      ],
      chart: {
        type: 'score_arc',
        zones: [
          { label: t('explainer.lbl_low'), min: 0, max: 49, color: '#FF6B6B' },
          { label: 'Developing', min: 50, max: 64, color: '#FFB84D' },
          { label: t('explainer.lbl_good'), min: 65, max: 79, color: '#6B8EFF' },
          { label: t('explainer.lbl_optimal'), min: 80, max: 100, color: '#00D4AA' },
        ],
      },
      accentColor: '#6B8EFF',
    },

    contributor_hrv_balance: {
      title: t('explainer.contributor_hrv_title'),
      subtitle: t('explainer.contributor_hrv_subtitle'),
      body: t('explainer.contributor_hrv_body'),
      chart: { type: 'none' },
      accentColor: '#4ADE80',
    },

    contributor_resting_hr_delta: {
      title: t('explainer.contributor_rhr_title'),
      subtitle: t('explainer.contributor_rhr_subtitle'),
      body: t('explainer.contributor_rhr_body'),
      chart: { type: 'waveform' },
      accentColor: '#FF6B6B',
    },

    contributor_sleep_quality: {
      title: t('explainer.contributor_sleep_title'),
      subtitle: t('explainer.contributor_sleep_subtitle'),
      body: t('explainer.contributor_sleep_body'),
      chart: { type: 'sleep_stages' },
      accentColor: '#7B5EE0',
    },

    contributor_temperature: {
      title: t('explainer.contributor_temp_title'),
      subtitle: t('explainer.contributor_temp_subtitle'),
      body: t('explainer.contributor_temp_body'),
      ranges: [
        t('explainer.contributor_temp_range_0'),
        t('explainer.contributor_temp_range_1'),
        t('explainer.contributor_temp_range_2'),
      ],
      chart: {
        type: 'range_bar',
        unit: '°C dev',
        ranges: [
          { label: t('explainer.lbl_cold'), min: -2, max: -0.5, color: '#60A5FA' },
          { label: t('explainer.lbl_normal'), min: -0.5, max: 0.5, color: '#4ADE80', isNormal: true },
          { label: t('explainer.lbl_warm'), min: 0.5, max: 2, color: '#FF6B35' },
        ],
      },
      accentColor: '#FF6B35',
    },
  };
}
