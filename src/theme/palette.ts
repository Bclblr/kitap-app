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
 * Açık modda kırık beyaz + derin bordo,
 * koyu modda sıcak siyah + canlı ama ağır bordo.
 * Amaç: kitap uygulamasına premium, editoryal ve özgün bir marka hissi vermek.
 */
export const palette: Record<'dark' | 'light', AppColors> = {
  light: {
    background: '#F8F6F5',
    surface: '#FFFFFF',
    surfaceElevated: '#F1ECEC',
    surfaceSecondary: '#F3EFEF',
    input: '#F5F1F1',
    text: '#241B1E',
    textPrimary: '#241B1E',
    textSecondary: '#6F6266',
    textMuted: '#9A8D91',
    border: '#DED5D7',
    divider: '#EAE3E4',
    primary: '#7A2436',
    accent: '#7A2436',
    primarySoft: '#F0DEE3',
    accentSoft: '#F0DEE3',
    secondaryAccent: '#9C5868',
    onPrimary: '#FFFFFF',
    success: '#4F7A61',
    danger: '#B84E5A',
    error: '#B84E5A',
    overlay: 'rgba(31, 16, 21, 0.56)',
  },
  dark: {
    background: '#0C0A0B',
    surface: '#151113',
    surfaceElevated: '#21191C',
    surfaceSecondary: '#1B1517',
    input: '#1A1416',
    text: '#F7F2F3',
    textPrimary: '#F7F2F3',
    textSecondary: '#C0B2B6',
    textMuted: '#8F8085',
    border: '#35282C',
    divider: '#2A2023',
    primary: '#B33A55',
    accent: '#B33A55',
    primarySoft: '#341820',
    accentSoft: '#341820',
    secondaryAccent: '#D06A80',
    onPrimary: '#FFFFFF',
    success: '#79A287',
    danger: '#E17886',
    error: '#E17886',
    overlay: 'rgba(0, 0, 0, 0.76)',
  },
};
