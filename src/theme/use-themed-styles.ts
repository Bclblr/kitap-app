import { useMemo } from 'react';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppColors } from './palette';

/** Compatibility bridge for existing dark StyleSheets. Layout and original dark colors remain intact. */
export function lightColor(value: string, property: string, colors: AppColors) {
  const hex = value.startsWith('#') ? value.slice(1) : '';
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return value;
  const [r,g,b] = [0,2,4].map(i => parseInt(full.slice(i,i+2),16));
  const brightness = (r+g+b)/3;
  const saturation = Math.max(r,g,b)-Math.min(r,g,b);
  if (property.toLowerCase().includes('border')) return saturation > 60 ? colors.primary : colors.border;
  if (property === 'backgroundColor') {
    if (brightness < 22) return colors.background;
    if (brightness < 65) return saturation > 18 ? colors.primarySoft : colors.surface;
    if (saturation < 35) return colors.surfaceElevated;
    return value;
  }
  if (property === 'color' || property === 'tintColor') {
    if (saturation < 45) return brightness > 185 ? colors.text : colors.textSecondary;
    if (r > 170 && g < 140 && b < 160) return colors.danger;
    if (b > r && b > g) return colors.primary;
  }
  return value;
}
export function useThemedStyles<T extends Record<string, object>>(base: T): T {
  const { scheme, colors } = useAppTheme();
  return useMemo(() => {
    if (scheme === 'dark') return base;
    return Object.fromEntries(Object.entries(base).map(([name, style]) => {
      // Image/story overlays and outgoing bubbles retain intentional contrast.
      if (/story|splash|myMessage|readStatus|saveButtonText|primarySmallText|sendButtonText/i.test(name)) return [name, style];
      return [name, Object.fromEntries(Object.entries(style).map(([key,value]) => [key, typeof value === 'string' && /color$/i.test(key) ? lightColor(value,key,colors) : value]))];
    })) as T;
  }, [base, scheme, colors]);
}
