import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

const GOALS = [10, 20, 30, 50];

export default function OnboardingScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors } = useAppTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [goal, setGoal] = useState(20);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);

  const goalText = useMemo(() => `${goal} sayfa`, [goal]);

  useEffect(() => {
    let active = true;

    async function loadExistingProfile() {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        if (!user || !active) return;

        const metadataUsername =
          typeof user.user_metadata?.username === 'string'
            ? user.user_metadata.username.trim()
            : '';
        const fallbackUsername = user.email?.split('@')[0] || 'kitapokuru';

        const { data } = await supabase
          .from('profiles')
          .select('username, full_name, bio')
          .eq('id', user.id)
          .maybeSingle();

        if (!active) return;

        setUsername(data?.username?.trim() || metadataUsername || fallbackUsername);
        setFullName(data?.full_name?.trim() || '');
        setBio(data?.bio?.trim() || '');
      } catch (error) {
        console.error('Onboarding profil bilgileri yüklenemedi:', error);
      } finally {
        if (active) setLoadingProfile(false);
      }
    }

    void loadExistingProfile();
    return () => {
      active = false;
    };
  }, []);

  async function finish(skipDetails = false) {
    setSaving(true);
    try {
      const { data, error: userError } = await supabase.auth.getUser();
      if (userError || !data.user) {
        Alert.alert('Oturum bulunamadı', 'Lütfen tekrar giriş yap.');
        router.replace('/login');
        return;
      }

      const user = data.user;
      const metadataUsername =
        typeof user.user_metadata?.username === 'string'
          ? user.user_metadata.username.trim()
          : '';
      const fallbackUsername = user.email?.split('@')[0] || 'kitapokuru';
      const cleanUsername = username.trim() || metadataUsername || fallbackUsername;

      if (!skipDetails && (cleanUsername.length < 3 || cleanUsername.length > 30)) {
        Alert.alert('Kullanıcı adı', 'Kullanıcı adın 3 ile 30 karakter arasında olmalı.');
        return;
      }

      const profilePayload: Record<string, unknown> = {
        id: user.id,
        username: cleanUsername,
      };

      if (!skipDetails) {
        profilePayload.full_name = fullName.trim() || null;
        profilePayload.bio = bio.trim() || 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚';
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

      if (profileError) throw profileError;

      if (!skipDetails) {
        const timezone = (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
          } catch {
            return 'UTC';
          }
        })();

        const { error: preferenceError } = await supabase
          .from('reading_preferences')
          .upsert(
            {
              user_id: user.id,
              daily_page_goal: goal,
              timezone,
            },
            { onConflict: 'user_id' }
          );

        if (preferenceError) throw preferenceError;
      }

      const { error: metadataError } = await supabase.auth.updateUser({
        data: {
          onboarding_pending: false,
          username: cleanUsername,
        },
      });
      if (metadataError) throw metadataError;

      router.replace(skipDetails ? '/' : '/explore');
    } catch (error) {
      console.error('Onboarding kaydedilemedi:', error);
      Alert.alert('Kaydedilemedi', 'Başlangıç ayarların kaydedilirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Profilin hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.heroIcon}>
          <Feather name="book-open" size={30} color={colors.primary} />
        </View>
        <Text style={styles.eyebrow}>HOŞ GELDİN</Text>
        <Text style={styles.title}>Okuma dünyanı hazırlayalım.</Text>
        <Text style={styles.subtitle}>
          Profilini tamamlayıp okuma hedefini seçerek sana daha iyi bir başlangıç hazırlayalım.
        </Text>

        <View style={styles.card}>
          <Text style={styles.step}>1 / 3</Text>
          <Text style={styles.cardTitle}>Sana nasıl hitap edelim?</Text>
          <Text style={styles.cardDescription}>Adını veya görünen adını ekleyebilirsin. Bu alan isteğe bağlıdır.</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="Adın veya görünen adın"
            placeholderTextColor="#6E6E7A"
            style={styles.input}
            maxLength={60}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.step}>2 / 3</Text>
          <Text style={styles.cardTitle}>Profilini tamamla</Text>
          <Text style={styles.cardDescription}>Kullanıcı adını kontrol et ve istersen kendinden kısaca bahset.</Text>
          <Text style={styles.fieldLabel}>Kullanıcı adı</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="kullaniciadi"
            placeholderTextColor="#6E6E7A"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            maxLength={30}
          />
          <Text style={styles.fieldLabel}>Hakkında</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Kitap zevkinden veya okumayı sevdiğin türlerden bahset…"
            placeholderTextColor="#6E6E7A"
            multiline
            style={[styles.input, styles.bioInput]}
            maxLength={150}
          />
          <Text style={styles.profileHint}>Profil fotoğrafı ve kapak görselini daha sonra Profil Ayarları'ndan ekleyebilirsin.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.step}>3 / 3</Text>
          <Text style={styles.cardTitle}>Günlük okuma hedefin</Text>
          <Text style={styles.cardDescription}>Bunu daha sonra Oku ekranından değiştirebilirsin.</Text>
          <View style={styles.goalGrid}>
            {GOALS.map((item) => {
              const active = item === goal;
              return (
                <Pressable
                  key={item}
                  onPress={() => setGoal(item)}
                  style={[styles.goalButton, active && styles.goalButtonActive]}
                >
                  <Text style={[styles.goalValue, active && styles.goalValueActive]}>{item}</Text>
                  <Text style={[styles.goalLabel, active && styles.goalLabelActive]}>sayfa</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.selectedGoal}>Seçili hedef: {goalText}</Text>
        </View>

        <Pressable
          disabled={saving}
          onPress={() => void finish(false)}
          style={[styles.primaryButton, saving && styles.disabled]}
        >
          {saving ? (
            <ActivityIndicator color="#0B0710" />
          ) : (
            <>
              <Text style={styles.primaryText}>Profilimi Tamamla</Text>
              <Feather name="arrow-right" size={18} color="#0B0710" />
            </>
          )}
        </Pressable>

        <Pressable disabled={saving} onPress={() => void finish(true)} style={styles.skipButton}>
          <Text style={styles.skipText}>Şimdilik geç</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  loadingContainer: { flex: 1, backgroundColor: '#09090D', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#92929D', fontSize: 13 },
  content: { flexGrow: 1, width: '100%', maxWidth: 660, alignSelf: 'center', padding: 22, paddingTop: 54, paddingBottom: 42 },
  heroIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#17121F', borderWidth: 1, borderColor: '#302342', marginBottom: 22 },
  eyebrow: { color: '#A985FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  title: { marginTop: 8, color: '#F5F5F8', fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { marginTop: 10, marginBottom: 24, color: '#92929D', fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: '#111116', borderRadius: 20, borderWidth: 1, borderColor: '#24242D', padding: 18, marginBottom: 14 },
  step: { color: '#A985FF', fontSize: 11, fontWeight: '900' },
  cardTitle: { marginTop: 7, color: '#F2F2F5', fontSize: 18, fontWeight: '800' },
  cardDescription: { marginTop: 6, color: '#85858F', fontSize: 13, lineHeight: 19 },
  fieldLabel: { color: '#B5B5BE', fontSize: 12, fontWeight: '700', marginTop: 14, marginBottom: -7 },
  input: { marginTop: 16, minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: '#2B2B35', backgroundColor: '#0C0C11', paddingHorizontal: 14, paddingVertical: 12, color: '#F4F4F7', fontSize: 15 },
  bioInput: { minHeight: 92, textAlignVertical: 'top' },
  profileHint: { marginTop: 12, color: '#737380', fontSize: 11, lineHeight: 17 },
  goalGrid: { marginTop: 16, flexDirection: 'row', gap: 8 },
  goalButton: { flex: 1, minHeight: 70, borderRadius: 15, borderWidth: 1, borderColor: '#2B2B35', backgroundColor: '#0C0C11', alignItems: 'center', justifyContent: 'center' },
  goalButtonActive: { borderColor: '#A985FF', backgroundColor: '#21182F' },
  goalValue: { color: '#D4D4DC', fontSize: 18, fontWeight: '900' },
  goalValueActive: { color: '#C7B3FF' },
  goalLabel: { marginTop: 2, color: '#737380', fontSize: 10, fontWeight: '700' },
  goalLabelActive: { color: '#A985FF' },
  selectedGoal: { marginTop: 13, color: '#8E8E9D', fontSize: 12 },
  primaryButton: { marginTop: 10, height: 56, borderRadius: 16, backgroundColor: '#A985FF', flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B0710', fontSize: 15, fontWeight: '900' },
  skipButton: { height: 48, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: '#85858F', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
