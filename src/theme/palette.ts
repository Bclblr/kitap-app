export type ThemeMode = 'system' | 'light' | 'dark';

export type AppColors = {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSecondary: string;
  input: string;
  text: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  divider: string;
  primary: string;
  accent: string;
  primarySoft: string;
  accentSoft: string;
  secondaryAccent: string;
  onPrimary: string;
  success: string;
  danger: string;
  error: string;
  overlay: string;
  focusRing: string;
};

/** Original purple theme, restored. */
export const palette: Record<'dark' | 'light', AppColors> = {
  dark: {
    background: '#0A0A0E',
    surface: '#15151D',
    surfaceElevated: '#20202B',
    surfaceSecondary: '#20202B',
    input: '#17171F',
    text: '#F5F5F8',
    textPrimary: '#F5F5F8',
    textSecondary: '#A5A5B3',
    textMuted: '#7F7F90',
    border: '#30303D',
    divider: '#252531',
    primary: '#A985FF',
    accent: '#A985FF',
    primarySoft: '#302246',
    accentSoft: '#302246',
    secondaryAccent: '#7C63C7',
    onPrimary: '#FFFFFF',
    success: '#6FA383',
    danger: '#FFB2B2',
    error: '#FFB2B2',
    overlay: 'rgba(0,0,0,0.72)',
    focusRing: '#C8B5FF',
  },
  light: {
    // High-contrast light theme. Keep the purple identity, but avoid the
    // washed-out grey-on-white look on cards, filters and secondary text.
    background: '#ECE8F2',
    surface: '#FFFFFF',
    surfaceElevated: '#DDD6E8',
    surfaceSecondary: '#E4DDEB',
    input: '#E2DCE9',
    text: '#17121F',
    textPrimary: '#17121F',
    textSecondary: '#453B54',
    textMuted: '#5F556C',
    border: '#B7ABBE',
    divider: '#CCC2D2',
    primary: '#6232B5',
    accent: '#6232B5',
    primarySoft: '#CDB8EB',
    accentSoft: '#CDB8EB',
    secondaryAccent: '#6F46BE',
    onPrimary: '#FFFFFF',
    success: '#356948',
    danger: '#9F1830',
    error: '#9F1830',
    overlay: 'rgba(22,16,35,0.66)',
    focusRing: '#6232B5',
  },
};
