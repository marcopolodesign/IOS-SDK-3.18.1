import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { SleepSegment, generateMockSleepData } from '../components/home/SleepStagesChart';

// Types
export interface SleepData {
  score: number;
  timeAsleep: string; // "7h 32m"
  timeAsleepMinutes: number;
  restingHR: number;
  respiratoryRate: number;
  segments: SleepSegment[];
  bedTime: Date;
  wakeTime: Date;
}

export interface ActivityData {
  score: number;
  steps: number;
  calories: number;
  activeMinutes: number;
  workouts: Workout[];
}

export interface Workout {
  id: string;
  name: string;
  type: string;
  duration: number; // minutes
  calories: number;
  date: Date;
}

export interface HomeData {
  overallScore: number;
  strain: number;
  readiness: number;
  sleepScore: number;
  lastNightSleep: SleepData;
  activity: ActivityData;
  ringBattery: number;
  streakDays: number;
  insight: string;
  insightType: 'sleep' | 'activity' | 'nutrition' | 'general';
  isLoading: boolean;
  error: string | null;
}

// Mock data generators
function generateMockSleepScore(): SleepData {
  const mockData = generateMockSleepData();
  const totalMinutes = Math.round(
    (mockData.wakeTime.getTime() - mockData.bedTime.getTime()) / (1000 * 60)
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    score: Math.floor(Math.random() * 20) + 75, // 75-95
    timeAsleep: `${hours}h ${minutes}m`,
    timeAsleepMinutes: totalMinutes,
    restingHR: Math.floor(Math.random() * 15) + 50, // 50-65 bpm
    respiratoryRate: Math.floor(Math.random() * 4) + 12, // 12-16 rpm
    ...mockData,
  };
}

function generateMockActivityData(): ActivityData {
  return {
    score: Math.floor(Math.random() * 30) + 60, // 60-90
    steps: Math.floor(Math.random() * 8000) + 4000, // 4000-12000
    calories: Math.floor(Math.random() * 600) + 300, // 300-900
    activeMinutes: Math.floor(Math.random() * 60) + 20, // 20-80
    workouts: [
      {
        id: '1',
        name: 'Morning Run',
        type: 'running',
        duration: 32,
        calories: 280,
        date: new Date(),
      },
      {
        id: '2',
        name: 'Strength Training',
        type: 'gym',
        duration: 45,
        calories: 320,
        date: new Date(Date.now() - 86400000),
      },
    ],
  };
}

function generateInsight(sleepScore: number, activityScore: number): { insight: string; type: 'sleep' | 'activity' | 'general' } {
  const insights = [
    {
      condition: sleepScore > 85,
      insight: "Great sleep last night! Your recovery is optimal. Consider a higher intensity workout today.",
      type: 'sleep' as const,
    },
    {
      condition: sleepScore < 70,
      insight: "Your sleep quality was below average. Try to wind down earlier tonight and limit screen time before bed.",
      type: 'sleep' as const,
    },
    {
      condition: activityScore < 50,
      insight: "You've been less active lately. Even a short 10-minute walk can boost your energy and mood.",
      type: 'activity' as const,
    },
    {
      condition: activityScore > 80,
      insight: "You're crushing it! Your activity levels are excellent. Remember to stay hydrated and fuel properly.",
      type: 'activity' as const,
    },
    {
      condition: true,
      insight: "Your vitals look good today. Keep up the consistent routine for optimal health.",
      type: 'general' as const,
    },
  ];

  const match = insights.find(i => i.condition);
  return match || insights[insights.length - 1];
}

// Calculate overall score from components
function calculateOverallScore(sleep: number, activity: number, hrv?: number): number {
  // Weighted average: sleep 40%, activity 30%, HRV 30%
  const hrvScore = hrv || 70; // Default HRV score if not available
  return Math.round(sleep * 0.4 + activity * 0.3 + hrvScore * 0.3);
}

// Hook
export function useHomeData(): HomeData & { refresh: () => Promise<void> } {
  const [data, setData] = useState<HomeData>({
    overallScore: 0,
    strain: 0,
    readiness: 0,
    sleepScore: 0,
    lastNightSleep: {
      score: 0,
      timeAsleep: '0h 0m',
      timeAsleepMinutes: 0,
      restingHR: 0,
      respiratoryRate: 0,
      segments: [],
      bedTime: new Date(),
      wakeTime: new Date(),
    },
    activity: {
      score: 0,
      steps: 0,
      calories: 0,
      activeMinutes: 0,
      workouts: [],
    },
    ringBattery: 100,
    streakDays: 0,
    insight: '',
    insightType: 'general',
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setData(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // In a real app, fetch from HealthKit and Ring services
      // For now, use mock data
      const sleep = generateMockSleepScore();
      const activity = generateMockActivityData();
      const { insight, type } = generateInsight(sleep.score, activity.score);

      const overallScore = calculateOverallScore(sleep.score, activity.score);

      // Strain is inverse of readiness (high activity = high strain = lower recovery)
      const strain = Math.min(100, Math.round(activity.score * 1.1));
      const readiness = Math.max(0, 100 - strain + Math.floor(Math.random() * 20));

      setData({
        overallScore,
        strain,
        readiness,
        sleepScore: sleep.score,
        lastNightSleep: sleep,
        activity,
        ringBattery: Math.floor(Math.random() * 30) + 70, // 70-100%
        streakDays: Math.floor(Math.random() * 10) + 1, // 1-10 days
        insight,
        insightType: type,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Error fetching home data:', error);
      setData(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load health data',
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...data,
    refresh: fetchData,
  };
}

// Score interpretation helpers
export function getScoreMessage(score: number): string {
  if (score >= 90) return "Rise and shine! You're at your peak.";
  if (score >= 80) return "Great day ahead! You're well-recovered.";
  if (score >= 70) return "Solid baseline. Ready for a productive day.";
  if (score >= 60) return "Take it easy today. Focus on recovery.";
  return "Rest up. Your body needs recovery time.";
}

export function getSleepMessage(score: number): string {
  if (score >= 90) return "Exceptional sleep quality!";
  if (score >= 80) return "Great night's rest.";
  if (score >= 70) return "Good sleep overall.";
  if (score >= 60) return "Room for improvement.";
  return "Poor sleep quality. Prioritize rest tonight.";
}

export function getActivityMessage(score: number): string {
  if (score >= 90) return "Outstanding activity level!";
  if (score >= 80) return "Very active day.";
  if (score >= 70) return "Good activity level.";
  if (score >= 60) return "Moderate activity.";
  return "Time to get moving!";
}

export default useHomeData;


