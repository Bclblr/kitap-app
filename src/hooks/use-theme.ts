/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useAppTheme } from '@/providers/ThemeProvider';

export function useTheme() {
  const { scheme, colors } = useAppTheme();
  return { ...Colors[scheme], ...colors, backgroundElement: colors.surface, backgroundSelected: colors.surfaceElevated };
}
