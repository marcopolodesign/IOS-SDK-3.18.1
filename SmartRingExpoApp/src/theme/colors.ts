// Smart Ring App - Dark Theme Colors
// Premium dark theme with vibrant accents

export const colors = {
  // Backgrounds
  background: '#0D0D0D',
  backgroundSecondary: '#141414',
  surface: '#1A1A2E',
  surfaceLight: '#252542',
  card: '#1E1E32',
  cardHover: '#282848',
  
  // Primary accent - Teal/Mint
  primary: '#00D4AA',
  primaryDark: '#00A88A',
  primaryLight: '#33DDBB',
  primaryGlow: 'rgba(0, 212, 170, 0.2)',
  
  // Secondary accent - Coral/Red (for heart rate)
  secondary: '#FF6B6B',
  secondaryDark: '#E55555',
  secondaryLight: '#FF8888',
  secondaryGlow: 'rgba(255, 107, 107, 0.2)',
  
  // Tertiary - Blue (for sleep)
  tertiary: '#6B8EFF',
  tertiaryDark: '#5070E0',
  tertiaryLight: '#8AAAFF',
  tertiaryGlow: 'rgba(107, 142, 255, 0.2)',
  
  // Health metric colors
  heartRate: '#FF6B6B',
  steps: '#00D4AA',
  sleep: '#6B8EFF',
  calories: '#FFB84D',
  spo2: '#B16BFF',
  bloodPressure: '#FF6BCC',
  stress: '#FF9F6B',
  temperature: '#6BFFF5',
  hrv: '#C4FF6B',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#A0A0A0',
  textMuted: '#666666',
  textInverse: '#0D0D0D',
  
  // Status
  success: '#00D4AA',
  warning: '#FFB84D',
  error: '#FF6B6B',
  info: '#6B8EFF',
  
  // Battery
  batteryFull: '#00D4AA',
  batteryMedium: '#FFB84D',
  batteryLow: '#FF6B6B',
  
  // Borders
  border: '#2A2A4A',
  borderLight: '#3A3A5A',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.3)',
  
  // Gradients (as arrays for LinearGradient)
  gradients: {
    primary: ['#00D4AA', '#00A88A'],
    secondary: ['#FF6B6B', '#E55555'],
    tertiary: ['#6B8EFF', '#5070E0'],
    card: ['#1A1A2E', '#252542'],
    dark: ['#0D0D0D', '#1A1A2E'],
    heartRate: ['#FF6B6B', '#FF8888'],
    sleep: ['#6B8EFF', '#8AAAFF'],
  },
} as const;

// Spacing system
export const spacing = {
  xs: 2,
  sm: 6,
  md: 12,
  lg: 18,
  xl: 24,
  xxl: 30,
} as const;

// Border radius
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

// Font sizes
export const fontSize = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
  display: 48,
} as const;

// Font families
export const fontFamily = {
  regular: 'TT-Interphases-Pro-Regular',
  demiBold: 'TT-Interphases-Pro-DemiBold',
} as const;

// Font weights
export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Shadows (for iOS)
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 0,
  }),
};

export default colors;





