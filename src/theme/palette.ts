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
 * Mürekkep & Safran
 *
 * Kitap ve sosyal ağ karakterini birlikte taşıyan, sıcak kâğıt yüzeyleri ile
 * mürekkep/teal ve safran vurgularını birleştiren özgün uygulama paleti.
 * Semantic alias'lar eski ekranları bozmadan yeni ekranların daha açık token
 * isimleri kullanabilmesini sağlar.
 */
export const palette: Record<'dark' | 'light', AppColors> = {
  light: {
    background: '#F4F1EA',
    surface: '#FCFAF6',
    surfaceElevated: '#EAE5DB',
    surfaceSecondary: '#EAE5DB',
    input: '#F0ECE4',
    text: '#1E2933',
    textPrimary: '#1E2933',
    textSecondary: '#66717A',
    textMuted: '#8D959B',
    border: '#D8D2C7',
    divider: '#E3DED5',
    primary: '#C88A2D',
    accent: '#C88A2D',
    primarySoft: '#F1E3C4',
    accentSoft: '#F1E3C4',
    secondaryAccent: '#486A6F',
    onPrimary: '#FFFFFF',
    success: '#4F7C65',
    danger: '#B95656',
    error: '#B95656',
    overlay: 'rgba(20, 29, 34, 0.54)',
  },
  dark: {
    background: '#11171B',
    surface: '#182025',
    surfaceElevated: '#202B31',
    surfaceSecondary: '#202B31',
    input: '#1D272C',
    text: '#F1EEE7',
    textPrimary: '#F1EEE7',
    textSecondary: '#AAB4B8',
    textMuted: '#7F8A8F',
    border: '#2D393E',
    divider: '#263136',
    primary: '#D8A14B',
    accent: '#D8A14B',
    primarySoft: '#322A1D',
    accentSoft: '#322A1D',
    secondaryAccent: '#6F999D',
    onPrimary: '#15120C',
    success: '#75A68A',
    danger: '#DF7777',
    error: '#DF7777',
    overlay: 'rgba(4, 8, 10, 0.74)',
  },
};
