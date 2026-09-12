import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/ThemeProvider';

export default function RetryNotice({
  message,
  onRetry,
  busy = false,
}: {
  message: string;
  onRetry: () => void;
  busy?: boolean;
}) {
  const { colors } = useAppTheme();

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.container,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.messageRow}>
        <Feather name="wifi-off" size={18} color={colors.textSecondary} />
        <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tekrar dene"
        disabled={busy}
        onPress={onRetry}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.primary },
          (pressed || busy) && styles.buttonPressed,
        ]}
      >
        <Feather name="refresh-cw" size={15} color={colors.primary} />
        <Text style={[styles.buttonText, { color: colors.primary }]}>
          {busy ? 'Yenileniyor...' : 'Tekrar Dene'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  message: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  button: {
    minHeight: 40,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  buttonPressed: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
