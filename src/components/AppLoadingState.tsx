import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

type LoadingVariant = 'spinner' | 'list' | 'card';

type Props = {
  label?: string;
  variant?: LoadingVariant;
  rows?: number;
  compact?: boolean;
};

export default function AppLoadingState({
  label = 'Yükleniyor...',
  variant = 'spinner',
  rows = 4,
  compact = false,
}: Props) {
  const { colors } = useAppTheme();
  const [pulse] = useState(() => new Animated.Value(0.45));

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.45,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );

    if (variant !== 'spinner') animation.start();
    return () => animation.stop();
  }, [pulse, variant]);

  if (variant === 'spinner') {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        style={[styles.spinnerWrap, compact && styles.spinnerWrapCompact]}
      >
        <ActivityIndicator color={colors.primary} size={compact ? 'small' : 'large'} />
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.cardWrap}>
        <Animated.View
          style={[
            styles.heroSkeleton,
            { backgroundColor: colors.surfaceElevated, opacity: pulse },
          ]}
        />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Animated.View style={[styles.shortLine, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
          <Animated.View style={[styles.titleLine, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
          <Animated.View style={[styles.infoBlock, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
          <Animated.View style={[styles.infoBlock, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
          <Animated.View style={[styles.bodyLine, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
          <Animated.View style={[styles.bodyLineSmall, { backgroundColor: colors.surfaceElevated, opacity: pulse }]} />
        </View>
        <Text style={[styles.srLabel, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    );
  }

  return (
    <View accessibilityRole="progressbar" accessibilityLabel={label} style={styles.listWrap}>
      {Array.from({ length: Math.max(1, rows) }).map((_, index) => (
        <View
          key={index}
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Animated.View
            style={[styles.avatar, { backgroundColor: colors.surfaceElevated, opacity: pulse }]}
          />
          <View style={styles.rowText}>
            <Animated.View
              style={[styles.nameLine, { backgroundColor: colors.surfaceElevated, opacity: pulse }]}
            />
            <Animated.View
              style={[styles.metaLine, { backgroundColor: colors.surfaceElevated, opacity: pulse }]}
            />
          </View>
        </View>
      ))}
      <Text style={[styles.srLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  spinnerWrap: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  spinnerWrapCompact: {
    minHeight: 72,
    padding: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  cardWrap: {
    width: '100%',
    padding: 18,
  },
  heroSkeleton: {
    width: '100%',
    height: 230,
    borderRadius: 22,
  },
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  shortLine: {
    width: 92,
    height: 18,
    borderRadius: 9,
  },
  titleLine: {
    width: '78%',
    height: 28,
    borderRadius: 10,
  },
  infoBlock: {
    width: '100%',
    height: 58,
    borderRadius: 14,
  },
  bodyLine: {
    width: '100%',
    height: 16,
    borderRadius: 8,
  },
  bodyLineSmall: {
    width: '64%',
    height: 16,
    borderRadius: 8,
  },
  listWrap: {
    gap: 10,
  },
  row: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  nameLine: {
    width: '48%',
    height: 15,
    borderRadius: 7,
  },
  metaLine: {
    width: '30%',
    height: 10,
    borderRadius: 5,
  },
  srLabel: {
    marginTop: 8,
    fontSize: 12,
    textAlign: 'center',
  },
});
