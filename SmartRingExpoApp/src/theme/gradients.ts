// Gradient definitions for each tab
// Based on Figma Focus design

export type TabType = 'overview' | 'sleep' | 'nutrition' | 'activity';

export interface GradientConfig {
  colors: string[];
  locations: number[];
  // For radial gradient simulation - center point (0-1)
  center: { x: number; y: number };
  // Radial gradient radius as percentage
  radius: { width: number; height: number };
}

export const gradients: Record<TabType, GradientConfig> = {
  overview: {
    // fill: radial-gradient(53.75% 98.16% at 14.43% 0%, #FFAC3F 31%, #F36D9C 38.84%, #E7E39C 46.47%, #2EA8EF 60.62%, #0042A8 94.88%, #000 100%)
    colors: ['#FFAC3F', '#F36D9C', '#E7E39C', '#2EA8EF', '#0042A8', '#000000'],
    locations: [0.31, 0.39, 0.46, 0.61, 0.95, 1.0],
    center: { x: 0.1443, y: 0 },
    radius: { width: 0.5375, height: 0.9816 },
  },
  sleep: {
    // fill: radial-gradient(28.62% 45.22% at 87.94% 55.04%, #000 45.09%, #BB6DF3 58.48%, rgba(32, 12, 119, 0.99) 81.98%)
    colors: ['#000000', '#BB6DF3', '#200C77'],
    locations: [0.45, 0.58, 0.82],
    center: { x: 0.8794, y: 0.5504 },
    radius: { width: 0.2862, height: 0.4522 },
  },
  nutrition: {
    // Maroon theme - similar structure to sleep
    colors: ['#000000', '#8B0000', '#4A0020', '#2D0015'],
    locations: [0.3, 0.55, 0.75, 1.0],
    center: { x: 0.5, y: 0.3 },
    radius: { width: 0.6, height: 0.8 },
  },
  activity: {
    // Orange/red theme - energetic gradient
    colors: ['#000000', '#FF4500', '#FF6B35', '#FFD700'],
    locations: [0.25, 0.5, 0.7, 1.0],
    center: { x: 0.8, y: 0.2 },
    radius: { width: 0.5, height: 0.7 },
  },
};

// Linear gradient fallbacks for simpler rendering
export const linearGradients: Record<TabType, { colors: string[]; start: { x: number; y: number }; end: { x: number; y: number } }> = {
  overview: {
    colors: ['#FFAC3F', '#F36D9C', '#2EA8EF', '#0042A8', '#000000'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  sleep: {
    colors: ['#BB6DF3', '#200C77', '#000000'],
    start: { x: 1, y: 0 },
    end: { x: 0, y: 1 },
  },
  nutrition: {
    colors: ['#8B0000', '#4A0020', '#000000'],
    start: { x: 0.5, y: 0 },
    end: { x: 0.5, y: 1 },
  },
  activity: {
    colors: ['#FFD700', '#FF6B35', '#FF4500', '#000000'],
    start: { x: 1, y: 0 },
    end: { x: 0, y: 1 },
  },
};

// Insight card colors per type
export const insightColors = {
  sleep: {
    background: ['#1E88E5', '#1565C0'],
    text: '#FFFFFF',
    icon: '#FFFFFF',
  },
  activity: {
    background: ['#FF6B35', '#FF4500'],
    text: '#FFFFFF',
    icon: '#FFFFFF',
  },
  nutrition: {
    background: ['#8B0000', '#4A0020'],
    text: '#FFFFFF',
    icon: '#FFFFFF',
  },
  general: {
    background: ['#6366F1', '#4F46E5'],
    text: '#FFFFFF',
    icon: '#FFFFFF',
  },
};

// Glass card styling
export const glassStyle = {
  background: 'rgba(255, 255, 255, 0.15)',
  border: 'rgba(255, 255, 255, 0.2)',
  blur: 50,
};

export default gradients;



