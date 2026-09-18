import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Pressable,
} from 'react-native';

import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

type Preferences = {
  likes_enabled: boolean;
  comments_enabled: boolean;
  reposts_enabled: boolean;
  follows_enabled: boolean;
  messages_enabled: boolean;
  system_enabled: boolean;
};

const DEFAULTS: Preferences = {
  likes_enabled: true,
  comments_enabled: true,
  reposts_enabled: true,
  follows_enabled: true,
  messages_enabled: true,
  system_enabled: true,
};

const ROWS: Array<{
  key: keyof Preferences;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
}> = [
  { key: 'likes_enabled', title: 'Beğeniler', description: 'İçeriklerin beğenildiğinde bildirim al.', icon: 'heart' },
  { key: 'comments_enabled', title: 'Yorumlar', description: 'İçeriklerine yorum geldiğinde bildirim al.', icon: 'message-circle' },
  { key: 'reposts_enabled', title: 'Yeniden paylaşımlar', description: 'İçeriklerin yeniden paylaşıldığında bildirim al.', icon: 'repeat' },
  { key: 'follows_enabled', title: 'Yeni takipçiler', description: 'Biri seni takip ettiğinde bildirim al.', icon: 'user-plus' },
  { key: 'messages_enabled', title: 'Mesajlar', description: 'Yeni özel mesajlar için bildirim al.', icon: 'mail' },
  { key: 'system_enabled', title: 'Sistem ve duyurular', description: 'Önemli uygulama duyuruları ve sistem bildirimlerini al.', icon: 'bell' },
];

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [preferences, setPreferences] = useState<Preferences>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<keyof Preferences | null>(null);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('likes_enabled, comments_enabled, reposts_enabled, follows_enabled, messages_enabled, system_enabled')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setPreferences(data ? { ...DEFAULTS, ...data } : DEFAULTS);
    } catch (error) {
      console.error('Bildirim tercihleri yüklenemedi:', error);
      Alert.alert('Hata', 'Bildirim tercihleri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadPreferences();
    }, [loadPreferences])
  );

  async function updatePreference(key: keyof Preferences, value: boolean) {
    const previous = preferences;
    setPreferences((current) => ({ ...current, [key]: value }));
    setSavingKey(key);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('notification_preferences')
        .upsert(
          {
            user_id: user.id,
            ...preferences,
            [key]: value,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Bildirim tercihi kaydedilemedi:', error);
      setPreferences(previous);
      Alert.alert('Hata', 'Tercih kaydedilemedi.');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => safeBack(router, '/profile-settings')} style={styles.backButton} accessibilityRole="button">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Bildirim Ayarları</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Tercihler yükleniyor...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <Text style={styles.sectionTitle}>Hangi bildirimleri almak istiyorsun?</Text>
          <Text style={styles.sectionText}>
            Buradaki değişiklikler hesabına kaydedilir ve giriş yaptığın diğer cihazlarda da geçerli olur.
          </Text>

          <View style={styles.card}>
            {ROWS.map((row, index) => (
              <View key={row.key} style={[styles.row, index !== ROWS.length - 1 && styles.rowBorder]}>
                <View style={styles.iconWrap}>
                  <Feather name={row.icon} size={18} color={colors.primary} />
                </View>
                <View style={styles.rowTextWrap}>
                  <Text style={styles.rowTitle}>{row.title}</Text>
                  <Text style={styles.rowDescription}>{row.description}</Text>
                </View>
                <Switch
                  value={preferences[row.key]}
                  onValueChange={(value) => void updatePreference(row.key, value)}
                  disabled={savingKey === row.key}
                  trackColor={{ false: '#32323C', true: colors.primary }}
                  thumbColor="#F5F5F7"
                  accessibilityLabel={`${row.title} bildirimleri`}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  header: {
    height: 64,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17171F',
  },
  backText: { color: '#F5F5F7', fontSize: 32, lineHeight: 34 },
  title: { color: '#F5F5F7', fontSize: 19, fontWeight: '800' },
  headerSpacer: { width: 42 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#8E8E9D', marginTop: 10, fontSize: 14 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },
  sectionTitle: { color: '#F3F3F6', fontSize: 18, fontWeight: '800' },
  sectionText: { color: '#8E8E9D', marginTop: 7, fontSize: 13, lineHeight: 19 },
  card: {
    marginTop: 20,
    borderRadius: 18,
    backgroundColor: '#15151D',
    borderWidth: 1,
    borderColor: '#292934',
    overflow: 'hidden',
  },
  row: {
    minHeight: 82,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#25252E' },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#21182F',
  },
  rowTextWrap: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  rowTitle: { color: '#F0F0F3', fontSize: 14.5, fontWeight: '700' },
  rowDescription: { color: '#85858F', marginTop: 4, fontSize: 12.5, lineHeight: 17 },
});
