import { useThemedStyles } from '@/theme/use-themed-styles';
import { useAppTheme } from '@/providers/ThemeProvider';
import { getCurrentAdminAccess } from '@/lib/admin';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { supabase } from '../lib/supabase';
import { signInWithGoogle } from '../lib/google-auth';
import { signInWithApple } from '../lib/apple-auth';

export default function LoginScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors, scheme } = useAppTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function routeAfterLogin() {
    const { data } = await supabase.auth.getUser();
    if (data.user?.user_metadata?.onboarding_pending === true) {
      router.replace('/onboarding');
      return;
    }

    const access = await getCurrentAdminAccess();

    if (access.canOpenAdmin) {
      router.replace('/admin');
      return;
    }

    router.replace('/');
  }

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre alanlarını doldur.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes('email not confirmed') || message.includes('email_not_confirmed')) {
          router.push({ pathname: '/verify-email', params: { email: cleanEmail } });
          return;
        }
        Alert.alert('Giriş başarısız', error.message);
        return;
      }

      await routeAfterLogin();
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setLoading(true);

    try {
      const session = await signInWithGoogle();

      if (session) {
        await routeAfterLogin();
      }
    } catch (error) {
      console.error('Google login error:', error);

      Alert.alert(
        'Google girişi başarısız',
        error instanceof Error
          ? error.message
          : 'Google ile giriş sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleLogin() {
    setLoading(true);

    try {
      const session = await signInWithApple();

      if (session) {
        await routeAfterLogin();
      }
    } catch (error) {
      const errorCode =
        typeof error === 'object' &&
        error !== null &&
        'code' in error
          ? String(error.code)
          : '';

      if (errorCode === 'ERR_REQUEST_CANCELED') {
        return;
      }

      console.error('Apple login error:', error);

      Alert.alert(
        'Apple girişi başarısız',
        error instanceof Error
          ? error.message
          : 'Apple ile giriş sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.brandWrap}>
          <View style={styles.logoMark}>
            <Feather name="book-open" size={28} color="#A985FF" />
          </View>
          <Text style={styles.brandTitle}>Kitap</Text>
          <Text style={styles.brandSubtitle}>Okuma dünyana yeniden dön.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Giriş Yap</Text>
          <Text style={styles.subtitle}>Sana en uygun giriş yöntemini seç.</Text>

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

          <Text style={styles.label}>Şifre</Text>
          <View style={styles.inputWrap}>
            <Feather name="lock" size={18} color="#777783" />
            <TextInput
              value={password}
              keyboardAppearance={scheme}
              onChangeText={setPassword}
              placeholder="Şifren"
              placeholderTextColor="#686873"
              secureTextEntry={!showPassword}
              style={styles.input}
            />
            <Pressable
              onPress={() => setShowPassword((current) => !current)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
            >
              <Feather
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#777783"
              />
            </Pressable>
          </View>

          <View style={styles.forgotRow}>
            <Pressable onPress={() => router.push('/forgot-password')}>
              <Text style={styles.forgotLink}>Şifremi unuttum</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleLogin}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.button,
              (loading || !canSubmit) && styles.disabledButton,
              pressed && !loading && canSubmit && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, (loading || !canSubmit) && styles.disabledButtonText]}>
              {loading ? 'Giriş yapılıyor...' : 'E-posta ile Giriş Yap'}
            </Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>veya</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable onPress={handleGoogleLogin} style={styles.providerButton}>
            <Text style={styles.providerLetter}>G</Text>
            <Text style={styles.providerText}>Google ile devam et</Text>
          </Pressable>

          <Pressable onPress={handleAppleLogin} style={styles.providerButton}>
            <Feather name="smartphone" size={19} color={colors.text} />
            <Text style={styles.providerText}>Apple ile devam et</Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Hesabın yok mu?</Text>
            <Pressable onPress={() => router.replace('/register')}>
              <Text style={styles.switchLink}> Kaydol</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 30, paddingBottom: 32 },
  brandWrap: { alignItems: 'center', marginTop: 18, marginBottom: 24 },
  logoMark: { width: 60, height: 60, borderRadius: 19, backgroundColor: '#17121F', borderWidth: 1, borderColor: '#2E2340', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  brandTitle: { fontSize: 29, fontWeight: '800', color: '#F5F5F8', letterSpacing: -0.7 },
  brandAccent: { color: '#A985FF' },
  brandSubtitle: { marginTop: 7, fontSize: 13, color: '#85858F' },
  card: { backgroundColor: '#111116', borderRadius: 24, borderWidth: 1, borderColor: '#23232B', padding: 20 },
  title: { fontSize: 25, fontWeight: '800', color: '#F4F4F7' },
  subtitle: { marginTop: 7, marginBottom: 20, fontSize: 14, color: '#85858F' },
  providerButton: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, backgroundColor: '#0C0C11', borderWidth: 1, borderColor: '#2B2B34', borderRadius: 15, marginBottom: 10 },
  providerLetter: { color: '#F4F4F7', fontSize: 18, fontWeight: '900' },
  providerText: { color: '#F2F2F5', fontSize: 14, fontWeight: '700' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  orLine: { flex: 1, height: 1, backgroundColor: '#292932' },
  orText: { color: '#666672', fontSize: 12, fontWeight: '700' },
  label: { marginBottom: 8, fontSize: 12, fontWeight: '700', color: '#B5B5BE' },
  forgotRow: { alignItems: 'flex-end', marginTop: -7, marginBottom: 12 },
  forgotLink: { color: '#A985FF', fontSize: 12, fontWeight: '800' },
  inputWrap: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#0C0C11', borderRadius: 15, borderWidth: 1, borderColor: '#292932', paddingHorizontal: 15, marginBottom: 17 },
  input: { flex: 1, height: '100%', color: '#F2F2F5', fontSize: 15 },
  button: { height: 54, borderRadius: 15, backgroundColor: '#A985FF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonPressed: { opacity: 0.84 },
  disabledButton: { opacity: 0.38 },
  disabledButtonText: { color: '#5F5668' },
  buttonText: { color: '#0B0710', fontSize: 15, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 21 },
  switchText: { color: '#85858F', fontSize: 14 },
  switchLink: { color: '#A985FF', fontSize: 14, fontWeight: '800' },
});