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
    // Light mode keeps the same purple identity as dark mode, but with
    // stronger separation between canvas, cards and interactive surfaces.
    background: '#F3F0F8',
    surface: '#FFFFFF',
    surfaceElevated: '#E7E1F0',
    surfaceSecondary: '#ECE7F3',
    input: '#EAE5F1',
    text: '#1D1828',
    textPrimary: '#1D1828',
    textSecondary: '#554C63',
    textMuted: '#746A82',
    border: '#C9C0D5',
    divider: '#D8D0E1',
    primary: '#6232B5',
    accent: '#6232B5',
    primarySoft: '#DED0F5',
    accentSoft: '#DED0F5',
    secondaryAccent: '#7650C1',
    onPrimary: '#FFFFFF',
    success: '#3F7153',
    danger: '#A91F33',
    error: '#A91F33',
    overlay: 'rgba(22,16,35,0.62)',
    focusRing: '#6232B5',
  },
};
