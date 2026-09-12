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
  },
  light: {
    background: '#F6F5FA',
    surface: '#FFFFFF',
    surfaceElevated: '#EEEBF5',
    surfaceSecondary: '#EEEBF5',
    input: '#F0EDF6',
    text: '#242032',
    textPrimary: '#242032',
    textSecondary: '#686174',
    textMuted: '#91899C',
    border: '#DAD4E4',
    divider: '#E5E0EC',
    primary: '#6C3CC5',
    accent: '#6C3CC5',
    primarySoft: '#EAE0FC',
    accentSoft: '#EAE0FC',
    secondaryAccent: '#8A67D6',
    onPrimary: '#FFFFFF',
    success: '#4F7A61',
    danger: '#B32638',
    error: '#B32638',
    overlay: 'rgba(22,16,35,0.58)',
  },
};
