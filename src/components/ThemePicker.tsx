import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';

const MODE_LABELS = {
  system: 'Sistem ayarı',
  light: 'Açık mod',
  dark: 'Koyu mod',
} as const;

export default function ThemePicker() {
  const router = useRouter();
  const { colors, mode } = useAppTheme();

  return (
    <Pressable
      onPress={() => router.push('/appearance-settings')}
      style={{
        minHeight: 64,
        borderRadius: 18,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
      accessibilityRole="button"
      accessibilityLabel="Ekran görünümü ayarlarını aç"
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 13,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 13,
          backgroundColor: colors.surfaceElevated,
        }}
      >
        <Feather name="moon" size={19} color={colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}>
          Ekran Görünümü
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 3 }}>
          {MODE_LABELS[mode]}
        </Text>
      </View>

      <Feather name="chevron-right" size={22} color={colors.textSecondary} />
    </Pressable>
  );
}
