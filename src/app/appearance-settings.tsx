import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { safeBack } from '@/lib/navigation';
import { useAppTheme } from '@/providers/ThemeProvider';
import { ThemeMode } from '@/theme/palette';

const OPTIONS: Array<{
  value: ThemeMode;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  {
    value: 'system',
    title: 'Sistem ayarını kullan',
    description: 'Telefonunun açık veya koyu görünümünü otomatik takip eder.',
    icon: 'smartphone',
  },
  {
    value: 'light',
    title: 'Açık mod',
    description: 'Uygulamayı her zaman açık görünümde kullan.',
    icon: 'sun',
  },
  {
    value: 'dark',
    title: 'Koyu mod',
    description: 'Uygulamayı her zaman koyu görünümde kullan.',
    icon: 'moon',
  },
];

export default function AppearanceSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mode, colors, setMode } = useAppTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}> 
      <View style={[styles.header, { borderBottomColor: colors.border }]}> 
        <Pressable
          onPress={() => {
            if (router.canGoBack()) safeBack(router, '/profile-settings');
            else router.replace('/profile-settings');
          }}
          style={[styles.backButton, { backgroundColor: colors.surface }]}
          accessibilityLabel="Geri"
        >
          <Feather name="chevron-left" size={25} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Ekran Görünümü</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Görünümünü seç</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Seçimin bu cihazda kaydedilir ve uygulamanın tamamına uygulanır.</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          {OPTIONS.map((option, index) => {
            const selected = mode === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => void setMode(option.value)}
                style={[
                  styles.option,
                  index !== OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
              >
                <View style={[styles.iconWrap, { backgroundColor: selected ? colors.primarySoft : colors.surfaceElevated }]}> 
                  <Feather name={option.icon} size={20} color={selected ? colors.primary : colors.textSecondary} />
                </View>

                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionTitle, { color: colors.text }]}>{option.title}</Text>
                  <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{option.description}</Text>
                </View>

                <View
                  style={[
                    styles.radio,
                    { borderColor: selected ? colors.primary : colors.textMuted },
                    selected && { borderWidth: 6 },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    minHeight: 64,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 42,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  title: {
    fontSize: 23,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    minHeight: 88,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  optionTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  optionDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
});
