import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
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

import { safeBack } from '@/lib/navigation';
import { supabase } from '@/lib/supabase';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useThemedStyles } from '@/theme/use-themed-styles';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const styles = useThemedStyles(baseStyles);
  const { colors, scheme } = useAppTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Expo Go can restore this route as the first screen after a previous
    // development session. If there is no navigation history on native,
    // return to the actual unauthenticated entry screen instead of trapping
    // the user on password recovery. Keep direct web links working.
    if (Platform.OS !== 'web' && !router.canGoBack()) {
      router.replace('/login');
    }
  }, [router]);

  async function sendResetLink() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      Alert.alert('E-posta gerekli', 'Hesabına ait e-posta adresini yaz.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = Linking.createURL('/reset-password');
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo,
      });

      if (error) {
        Alert.alert('Bağlantı gönderilemedi', error.message);
        return;
      }

      setSent(true);
    } catch (error) {
      console.error('Şifre sıfırlama bağlantısı gönderilemedi:', error);
      Alert.alert('Hata', 'Şifre sıfırlama bağlantısı gönderilirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  function goBackSafely() {
    if (router.canGoBack()) safeBack(router, '/login');
    else router.replace('/login');
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
        <Pressable onPress={goBackSafely} style={styles.backButton}>
          <Feather name="arrow-left" size={21} color={colors.text} />
        </Pressable>

        <View style={styles.iconWrap}>
          <Feather name="key" size={28} color="#A985FF" />
        </View>

        <Text style={styles.title}>Şifreni mi unuttun?</Text>
        <Text style={styles.subtitle}>
          Hesabına ait e-posta adresini yaz. Sana güvenli bir şifre yenileme bağlantısı göndereceğiz.
        </Text>

        {sent ? (
          <View style={styles.successCard}>
            <Feather name="mail" size={22} color="#B8F3D1" />
            <View style={styles.successCopy}>
              <Text style={styles.successTitle}>E-postanı kontrol et</Text>
              <Text style={styles.successText}>
                Şifre yenileme bağlantısı gönderildi. Bağlantıyı açarak yeni şifreni belirleyebilirsin.
              </Text>
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.label}>E-posta</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={18} color="#777783" />
              <TextInput
                value={email}
                keyboardAppearance={scheme}
                onChangeText={setEmail}
                placeholder="ornek@email.com"
                placeholderTextColor="#686873"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <Pressable
              onPress={sendResetLink}
              disabled={loading}
              style={[styles.primaryButton, loading && styles.disabledButton]}
            >
              <Text style={styles.primaryText}>
                {loading ? 'Gönderiliyor...' : 'Şifre Yenileme Bağlantısı Gönder'}
              </Text>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.replace('/login')} style={styles.loginButton}>
          <Text style={styles.loginText}>Giriş ekranına dön</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', padding: 20, paddingTop: 28 },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#24242C', backgroundColor: '#111116', alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 62, height: 62, borderRadius: 20, marginTop: 54, marginBottom: 18, backgroundColor: '#17121F', borderWidth: 1, borderColor: '#2E2340', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#F5F5F8', fontSize: 28, fontWeight: '800' },
  subtitle: { marginTop: 9, marginBottom: 28, color: '#8A8A95', fontSize: 14, lineHeight: 21 },
  label: { marginBottom: 8, color: '#B5B5BE', fontSize: 12, fontWeight: '700' },
  inputWrap: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#0C0C11', borderRadius: 15, borderWidth: 1, borderColor: '#292932', paddingHorizontal: 15 },
  input: { flex: 1, height: '100%', color: '#F2F2F5', fontSize: 15 },
  primaryButton: { height: 54, marginTop: 16, borderRadius: 15, backgroundColor: '#A985FF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B0710', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  disabledButton: { opacity: 0.55 },
  successCard: { flexDirection: 'row', gap: 13, padding: 16, borderRadius: 18, backgroundColor: '#101B16', borderWidth: 1, borderColor: '#1E3B2C' },
  successCopy: { flex: 1 },
  successTitle: { color: '#DDF9E8', fontSize: 15, fontWeight: '800' },
  successText: { marginTop: 5, color: '#A8CDB7', fontSize: 13, lineHeight: 19 },
  loginButton: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 12, marginTop: 18 },
  loginText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
});
