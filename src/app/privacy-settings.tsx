import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

type MessagePermission = 'everyone' | 'followers' | 'nobody';

export default function PrivacySettingsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [discoverable, setDiscoverable] = useState(true);
  const [messagePermission, setMessagePermission] = useState<MessagePermission>('everyone');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { data, error } = await supabase
        .from('profile_privacy_settings')
        .select('discoverable, message_permission')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      setDiscoverable(data?.discoverable ?? true);
      setMessagePermission((data?.message_permission as MessagePermission) ?? 'everyone');
    } catch (error) {
      console.error('Gizlilik ayarları yüklenemedi:', error);
      Alert.alert('Hata', 'Gizlilik ayarları yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings])
  );

  async function saveSettings(nextDiscoverable = discoverable, nextPermission = messagePermission) {
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData.user;
      if (!user) {
        router.replace('/login');
        return;
      }

      const { error } = await supabase
        .from('profile_privacy_settings')
        .upsert(
          {
            user_id: user.id,
            discoverable: nextDiscoverable,
            message_permission: nextPermission,
          },
          { onConflict: 'user_id' }
        );

      if (error) throw error;
    } catch (error) {
      console.error('Gizlilik ayarları kaydedilemedi:', error);
      Alert.alert('Hata', 'Ayar kaydedilemedi.');
      await loadSettings();
    } finally {
      setSaving(false);
    }
  }

  function changeDiscoverable(value: boolean) {
    setDiscoverable(value);
    void saveSettings(value, messagePermission);
  }

  function changePermission(value: MessagePermission) {
    setMessagePermission(value);
    void saveSettings(discoverable, value);
  }

  const options: { key: MessagePermission; title: string; description: string }[] = [
    { key: 'everyone', title: 'Herkes', description: 'Engellemediğin kullanıcılar sana mesaj gönderebilir.' },
    { key: 'followers', title: 'Beni takip edenler', description: 'Yalnızca seni takip eden kullanıcılar yeni mesaj gönderebilir.' },
    { key: 'nobody', title: 'Hiç kimse', description: 'Yeni mesaj gönderimi kapatılır.' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Geri dön">
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Profil Gizliliği</Text>
          <View style={styles.spacer} />
        </View>

        {loading ? (
          <Text style={styles.muted}>Ayarlar yükleniyor...</Text>
        ) : (
          <>
            <View style={styles.card}>
              <View style={styles.rowText}>
                <Text style={styles.cardTitle}>Arama ve Keşfet'te görün</Text>
                <Text style={styles.cardDescription}>Kapalı olduğunda kullanıcı adı aramalarında hesabın gösterilmez.</Text>
              </View>
              <Switch value={discoverable} onValueChange={changeDiscoverable} disabled={saving} />
            </View>

            <Text style={styles.sectionTitle}>Kimler mesaj gönderebilir?</Text>
            <View style={styles.optionCard}>
              {options.map((option) => {
                const selected = messagePermission === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => changePermission(option.key)}
                    disabled={saving}
                    style={[styles.option, selected && styles.optionSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={styles.radioOuter}>{selected ? <View style={styles.radioInner} /> : null}</View>
                    <View style={styles.optionText}>
                      <Text style={styles.optionTitle}>{option.title}</Text>
                      <Text style={styles.cardDescription}>{option.description}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.note}>Engellediğin veya seni engelleyen hesaplar bu ayarlardan bağımsız olarak sana mesaj gönderemez.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0E' },
  content: { padding: 18, paddingBottom: 48 },
  header: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#15151D' },
  backText: { color: '#F5F5F7', fontSize: 32, lineHeight: 34 },
  title: { color: '#F5F5F7', fontSize: 20, fontWeight: '800' },
  spacer: { width: 42 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 16, borderRadius: 18, padding: 16, backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833' },
  rowText: { flex: 1 },
  cardTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 5 },
  cardDescription: { color: '#A7A7B2', fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: '#DADAE0', fontSize: 14, fontWeight: '800', marginTop: 24, marginBottom: 10 },
  optionCard: { borderRadius: 18, overflow: 'hidden', backgroundColor: '#15151D', borderWidth: 1, borderColor: '#282833' },
  option: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#24242D' },
  optionSelected: { backgroundColor: '#1D1728' },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#A985FF', alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#A985FF' },
  optionText: { flex: 1 },
  optionTitle: { color: '#F5F5F7', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  note: { color: '#858590', fontSize: 12, lineHeight: 18, marginTop: 14 },
  muted: { color: '#A7A7B2', textAlign: 'center', marginTop: 32 },
});
