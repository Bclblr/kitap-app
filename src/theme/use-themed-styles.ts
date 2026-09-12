import { useMemo } from 'react';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppColors } from './palette';

/**
 * Compatibility bridge for legacy StyleSheets.
 * Old screens were authored around a dark purple palette. This mapper keeps
 * layout intact while translating legacy neutrals/purples to the active
 * semantic theme in BOTH light and dark mode.
 */
export function themedColor(value: string, property: string, colors: AppColors) {
  const hex = value.startsWith('#') ? value.slice(1) : '';
  const full = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return value;

  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16));
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  const purpleLike = b > r && b > g && saturation > 8;
  const neutral = saturation < 28;
  const prop = property.toLowerCase();

  if (prop.includes('border')) {
    if (purpleLike || saturation > 70) return colors.primary;
    return colors.border;
  }

  if (property === 'backgroundColor') {
    if (purpleLike) return colors.primarySoft;
    if (brightness < 20) return colors.background;
    if (brightness < 48) return colors.surface;
    if (brightness < 85 && neutral) return colors.surfaceElevated;
    if (brightness > 225 && neutral) return colors.surface;
    return value;
  }

  if (property === 'color' || property === 'tintColor') {
    if (purpleLike) return colors.primary;
    if (neutral) return brightness > 175 ? colors.text : colors.textSecondary;
    if (r > 160 && g < 135 && b < 150) return colors.danger;
  }

  return value;
}

// Backward-compatible export for any direct imports.
export const lightColor = themedColor;

export function useThemedStyles<T extends Record<string, object>>(base: T): T {
  const { scheme, colors } = useAppTheme();

  return useMemo(() => {
    return Object.fromEntries(
      Object.entries(base).map(([name, style]) => {
        // Image/story overlays and intentionally high-contrast action text stay untouched.
        if (/story|splash|myMessage|readStatus|saveButtonText|primarySmallText|sendButtonText/i.test(name)) {
          return [name, style];
        }

        return [
          name,
          Object.fromEntries(
            Object.entries(style).map(([key, value]) => [
              key,
              typeof value === 'string' && /color$/i.test(key)
                ? themedColor(value, key, colors)
                : value,
            ]),
          ),
        ];
      }),
    ) as T;
  }, [base, scheme, colors]);
}
