import { useMemo } from 'react';
import { useAppTheme } from '@/providers/ThemeProvider';
import { AppColors } from './palette';
import { resolveLightStyle } from './light-styles';

function parseHex(value: string) {
  const hex = value.startsWith('#') ? value.slice(1) : '';
  const full = hex.length === 3 ? hex.split('').map((char) => char + char).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;

  const [r, g, b] = [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16));
  return {
    r,
    g,
    b,
    brightness: (r + g + b) / 3,
    saturation: Math.max(r, g, b) - Math.min(r, g, b),
  };
}

/**
 * Converts legacy hard-coded colors into semantic palette colors.
 * Transparent/rgba/image-overlay colors are intentionally left untouched.
 */
export function themeColor(value: string, property: string, colors: AppColors) {
  const parsed = parseHex(value);
  if (!parsed) return value;

  const { r, g, b, brightness, saturation } = parsed;
  const propertyName = property.toLowerCase();

  if (propertyName.includes('border')) {
    if (b > r && b > g && saturation > 35) return colors.primary;
    return colors.border;
  }

  if (property === 'backgroundColor') {
    if (brightness < 22) return colors.background;
    if (brightness < 72 && saturation < 38) return colors.surface;
    if (brightness < 105 && saturation < 42) return colors.surfaceElevated;
    if (b > r && b > g && saturation > 25) return colors.primarySoft;
    return value;
  }

  if (property === 'color' || property === 'tintColor') {
    if (saturation < 45) {
      if (brightness > 185) return colors.text;
      if (brightness > 105) return colors.textSecondary;
      return colors.textMuted;
    }

    if (r > 170 && g < 145 && b < 165) return colors.danger;
    if (b > r && b > g) return colors.primary;
  }

  return value;
}

// Backwards-compatible export for any callers that still import the old helper.
export const lightColor = themeColor;

export function useThemedStyles<T extends Record<string, object>>(base: T): T {
  const { scheme, colors } = useAppTheme();

  return useMemo(() => {
    return Object.fromEntries(
      Object.entries(base).map(([name, style]) => {
        if (scheme === 'light') {
          const fallback = Object.fromEntries(Object.entries(style).map(([key, value]) => [
            key,
            typeof value === 'string' && /color$/i.test(key) ? themeColor(value, key, colors) : value,
          ]));
          return [name, resolveLightStyle(name, style as Record<string, unknown>, fallback, base, colors)];
        }
        // Ana sayfadaki hikâye oluşturma halkası ve hızlı oluşturma butonu
        // her temada uygulamanın semantik mor vurgu rengini kullanır.
        if (name === 'addStoryCircle') {
          return [name, { ...style, borderColor: colors.primary }];
        }
        if (name === 'addStoryBadge') {
          return [name, { ...style, borderColor: colors.primary }];
        }
        if (name === 'addStoryIcon') {
          return [name, { ...style, color: colors.primary }];
        }
        if (name === 'floatingCreateButton') {
          return [name, {
            ...style,
            backgroundColor: colors.primary,
            borderColor: colors.primary,
          }];
        }
        if (name === 'floatingCreateIcon') {
          return [name, { ...style, color: colors.background }];
        }

        // Image/story overlays and controls that require fixed contrast keep their authored colors.
        if (/story|splash|myMessage|readStatus|saveButtonText|primarySmallText|sendButtonText/i.test(name)) {
          return [name, style];
        }

        const themedStyle = Object.fromEntries(
          Object.entries(style).map(([key, value]) => [
            key,
            typeof value === 'string' && /color$/i.test(key)
              ? themeColor(value, key, colors)
              : value,
          ])
        );

        // Keşfet/Gündem bölümündeki hashtagler her iki temada da tema morunu kullanır.
        if (name === 'trendingHashtag') {
          themedStyle.color = colors.primary;
        }

        return [name, themedStyle];
      })
    ) as T;
  }, [base, scheme, colors]);
}

/** Explicit semantic overrides for components whose dark styles are already authored. */
export function useLightStyles<T extends Record<string, object>>(
  base: T,
  tokens: Partial<Record<keyof T, Record<string, keyof AppColors>>>,
): T {
  const { scheme, colors } = useAppTheme();
  return useMemo(() => {
    if (scheme === 'dark') return base;
    return Object.fromEntries(Object.entries(base).map(([name, style]) => [name, {
      ...style,
      ...Object.fromEntries(Object.entries(tokens[name] ?? {}).map(([property, token]) => [property, colors[token]])),
    }])) as T;
  }, [base, tokens, scheme, colors]);
}

/** Keeps a legacy dark literal exact while giving light UI a semantic color. */
export function useLightColor() {
  const { scheme, colors } = useAppTheme();
  return (token: keyof AppColors, darkValue: string) => scheme === 'light' ? colors[token] : darkValue;
}
