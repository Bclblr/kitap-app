import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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

function readRecoveryParams(url: string) {
  const normalized = url.replace('#', '?');
  const query = normalized.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  return {
    code: params.get('code'),
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
    type: params.get('type'),
  };
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors, scheme } = useAppTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [preparing, setPreparing] = useState(true);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function prepareFromUrl(url?: string | null) {
      try {
        const currentUrl = url ?? (await Linking.getInitialURL());

        if (currentUrl) {
          const { code, accessToken, refreshToken } = readRecoveryParams(currentUrl);

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (mounted) setReady(!!data.session);
      } catch (error) {
        console.error('Şifre kurtarma oturumu hazırlanamadı:', error);
        if (mounted) setReady(false);
      } finally {
        if (mounted) setPreparing(false);
      }
    }

    void prepareFromUrl();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      setPreparing(true);
      void prepareFromUrl(url);
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  async function saveNewPassword() {
    if (!ready) {
      Alert.alert('Bağlantı geçersiz', 'Yeni bir şifre yenileme bağlantısı iste.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Şifre çok kısa', 'Yeni şifren en az 8 karakter olmalı.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Şifreler eşleşmiyor', 'İki şifre alanını aynı şekilde doldur.');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert('Şifre güncellenemedi', error.message);
        return;
      }

      Alert.alert('Şifre güncellendi', 'Yeni şifrenle giriş yapabilirsin.', [
        {
          text: 'Giriş Yap',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/login');
          },
        },
      ]);
    } catch (error) {
      console.error('Şifre güncelleme hatası:', error);
      Alert.alert('Hata', 'Şifre güncellenirken bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  }

  if (preparing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#A985FF" />
        <Text style={styles.loadingText}>Güvenli bağlantı hazırlanıyor...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.replace('/login')} style={styles.backButton}>
          <Feather name="arrow-left" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.iconWrap}>
          <Feather name="shield" size={28} color="#A985FF" />
        </View>

        <Text style={styles.title}>Yeni şifre oluştur</Text>
        <Text style={styles.subtitle}>
          Hesabın için güçlü ve daha önce kullanmadığın bir şifre belirle.
        </Text>

        {!ready ? (
          <View style={styles.errorCard}>
            <Feather name="alert-circle" size={21} color="#FFB7BE" />
            <View style={styles.errorCopy}>
              <Text style={styles.errorTitle}>Bağlantı geçersiz veya süresi dolmuş</Text>
              <Text style={styles.errorText}>Giriş ekranından yeni bir şifre yenileme bağlantısı iste.</Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.label}>Yeni şifre</Text>
            <View style={styles.inputWrap}>
              <Feather name="lock" size={18} color="#777783" />
              <TextInput
                value={password}
                keyboardAppearance={scheme}
                onChangeText={setPassword}
                placeholder="En az 8 karakter"
                placeholderTextColor="#686873"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Text style={styles.label}>Yeni şifreyi tekrar yaz</Text>
            <View style={styles.inputWrap}>
              <Feather name="check-circle" size={18} color="#777783" />
              <TextInput
                value={confirmPassword}
                keyboardAppearance={scheme}
                onChangeText={setConfirmPassword}
                placeholder="Şifreni tekrar yaz"
                placeholderTextColor="#686873"
                secureTextEntry
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={saveNewPassword}
              disabled={saving}
              style={[styles.primaryButton, saving && styles.disabledButton]}
            >
              <Text style={styles.primaryText}>{saving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}</Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace('/forgot-password')} style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Yeni bağlantı iste</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090D' },
  loadingText: { marginTop: 12, color: '#8A8A95', fontSize: 13 },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingTop: 28 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#24242C', backgroundColor: '#111116', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 62, height: 62, borderRadius: 20, marginTop: 54, marginBottom: 18, backgroundColor: '#17121F', borderWidth: 1, borderColor: '#2E2340', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F5F5F8', fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 9, marginBottom: 28, color: '#8A8A95', fontSize: 14, lineHeight: 21 },
  label: { marginBottom: 8, color: '#B5B5BE', fontSize: 12, fontWeight: '700' },
  inputWrap: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#0C0C11', borderRadius: 15, borderWidth: 1, borderColor: '#292932', paddingHorizontal: 15, marginBottom: 17 },
  input: { flex: 1, height: '100%', color: '#F2F2F5', fontSize: 15 },
  primaryButton: { height: 54, borderRadius: 15, backgroundColor: '#A985FF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B0710', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.55 },
  errorCard: { flexDirection: 'row', gap: 13, padding: 16, borderRadius: 18, backgroundColor: '#25161B', borderWidth: 1, borderColor: '#54272E' },
  errorCopy: { flex: 1 },
  errorTitle: { color: '#FFD7DB', fontSize: 14, fontWeight: '800' },
  errorText: { marginTop: 5, color: '#D3A3AA', fontSize: 13, lineHeight: 19 },
  secondaryButton: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 12, marginTop: 18 },
  secondaryText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
});
