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

/**
 * Bordo & Gece
 *
 * Açık mod: bordo ile uyumlu soğuk gül-gri arka plan + beyaz yüzeyler.
 * Koyu mod: nötr siyah/antrasit yüzeyler + bordo vurgular.
 */
export const palette: Record<'dark' | 'light', AppColors> = {
  light: {
    background: '#F3EFF0',
    surface: '#FFFFFF',
    surfaceElevated: '#ECE6E8',
    surfaceSecondary: '#F7F3F4',
    input: '#F5F1F2',
    text: '#261A1E',
    textPrimary: '#261A1E',
    textSecondary: '#6D5E63',
    textMuted: '#978A8E',
    border: '#DCCFD3',
    divider: '#E8DFE2',
    primary: '#7A2436',
    accent: '#7A2436',
    primarySoft: '#F0DDE2',
    accentSoft: '#F0DDE2',
    secondaryAccent: '#9A5263',
    onPrimary: '#FFFFFF',
    success: '#4F7A61',
    danger: '#B84E5A',
    error: '#B84E5A',
    overlay: 'rgba(31, 16, 21, 0.56)',
  },
  dark: {
    background: '#090909',
    surface: '#121212',
    surfaceElevated: '#1C1A1B',
    surfaceSecondary: '#171516',
    input: '#181617',
    text: '#F7F3F4',
    textPrimary: '#F7F3F4',
    textSecondary: '#BEB4B7',
    textMuted: '#8C8285',
    border: '#332A2D',
    divider: '#292224',
    primary: '#B33A55',
    accent: '#B33A55',
    primarySoft: '#35171F',
    accentSoft: '#35171F',
    secondaryAccent: '#D06A80',
    onPrimary: '#FFFFFF',
    success: '#79A287',
    danger: '#E17886',
    error: '#E17886',
    overlay: 'rgba(0, 0, 0, 0.78)',
  },
};
