export type ThemeMode = 'system' | 'light' | 'dark';
export type AppColors = { background: string; surface: string; surfaceElevated: string; input: string; text: string; textSecondary: string; border: string; primary: string; primarySoft: string; onPrimary: string; danger: string; overlay: string };
export const palette: Record<'dark' | 'light', AppColors> = {
  dark: { background: '#0A0A0E', surface: '#15151D', surfaceElevated: '#20202B', input: '#17171F', text: '#F5F5F8', textSecondary: '#A5A5B3', border: '#30303D', primary: '#A985FF', primarySoft: '#302246', onPrimary: '#FFFFFF', danger: '#FFB2B2', overlay: 'rgba(0,0,0,0.72)' },
  light: { background: '#F6F5FA', surface: '#FFFFFF', surfaceElevated: '#EEEBF5', input: '#F0EDF6', text: '#242032', textSecondary: '#686174', border: '#DAD4E4', primary: '#6C3CC5', primarySoft: '#EAE0FC', onPrimary: '#FFFFFF', danger: '#B32638', overlay: 'rgba(22,16,35,0.58)' },
};
