/**
 * Shared Expo theme compatibility values.
 * The app's full semantic palette lives in src/theme/palette.ts; these values
 * keep legacy/Themed components visually aligned with the Bordo & Gece theme.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#241B1E',
    background: '#F8F6F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#F1ECEC',
    textSecondary: '#6F6266',
  },
  dark: {
    text: '#F7F2F3',
    background: '#0C0A0B',
    backgroundElement: '#151113',
    backgroundSelected: '#21191C',
    textSecondary: '#C0B2B6',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
