import { useThemedStyles } from '@/theme/use-themed-styles';
import { useAppTheme } from '@/providers/ThemeProvider';
import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
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

export default function RegisterScreen() {
  const styles = useThemedStyles(baseStyles);
  const { colors, scheme } = useAppTheme();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit =
    username.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8;

  async function handleRegister() {
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || !cleanEmail || !password) {
      Alert.alert('Eksik bilgi', 'Lütfen tüm alanları doldur.');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Şifre çok kısa', 'Şifren en az 8 karakter olmalı.');
      return;
    }

    setLoading(true);
    try {
      const emailRedirectTo = Linking.createURL('/auth/callback', {
        queryParams: { next: 'onboarding' },
      });

      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            username: cleanUsername,
            onboarding_pending: true,
          },
        },
      });

      if (error) {
        Alert.alert('Kayıt başarısız', error.message);
        return;
      }

      if (!data.user) {
        Alert.alert('Kayıt başarısız', 'Kullanıcı oluşturulamadı.');
        return;
      }

      if (data.session) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            username: cleanUsername,
            bio: 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚',
          },
          { onConflict: 'id' }
        );
        if (profileError) console.error('Profil oluşturulamadı:', profileError);
      }

      if (!data.session) {
        router.replace({
          pathname: '/verify-email',
          params: { email: cleanEmail },
        });
        return;
      }

      router.replace('/onboarding');
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Kayıt sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  async function markSocialRegistrationPending() {
    const { error } = await supabase.auth.updateUser({
      data: { onboarding_pending: true },
    });
    if (error) throw error;
  }

  async function handleGoogleRegister() {
    setLoading(true);

    try {
      const session = await signInWithGoogle();

      if (session) {
        await markSocialRegistrationPending();
        router.replace('/onboarding');
      }
    } catch (error) {
      console.error('Google register error:', error);

      Alert.alert(
        'Google kaydı başarısız',
        error instanceof Error
          ? error.message
          : 'Google ile kayıt sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAppleRegister() {
    setLoading(true);

    try {
      const session = await signInWithApple();

      if (session) {
        await markSocialRegistrationPending();
        router.replace('/onboarding');
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

      console.error('Apple register error:', error);

      Alert.alert(
        'Apple kaydı başarısız',
        error instanceof Error
          ? error.message
          : 'Apple ile kayıt sırasında bir hata oluştu.'
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
            <Feather name="user-plus" size={28} color="#A985FF" />
          </View>
          <Text style={styles.brandTitle}><Text style={styles.brandAccent}>Kitap</Text></Text>
          <Text style={styles.brandSubtitle}>Okuyanların topluluğuna katıl.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Hesap Oluştur</Text>
          <Text style={styles.subtitle}>Sana en uygun kayıt yöntemini seç.</Text>

          <Pressable onPress={handleGoogleRegister} style={styles.providerButton}>
            <Text style={styles.providerLetter}>G</Text>
            <Text style={styles.providerText}>Google ile kaydol</Text>
          </Pressable>

          <Pressable onPress={handleAppleRegister} style={styles.providerButton}>
            <Feather name="smartphone" size={19} color={colors.text} />
            <Text style={styles.providerText}>Apple ile kaydol</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>veya</Text>
            <View style={styles.orLine} />
          </View>

          <Text style={styles.label}>Kullanıcı adı</Text>
          <View style={styles.inputWrap}>
            <Feather name="user" size={18} color="#777783" />
            <TextInput
              value={username}
              keyboardAppearance={scheme}
              onChangeText={setUsername}
              placeholder="Kullanıcı adın"
              placeholderTextColor="#686873"
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

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
              placeholder="En az 8 karakter"
              placeholderTextColor="#686873"
              secureTextEntry
              style={styles.input}
            />
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={loading || !canSubmit}
            style={({ pressed }) => [
              styles.button,
              (loading || !canSubmit) && styles.disabledButton,
              pressed && !loading && canSubmit && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.buttonText, !canSubmit && styles.disabledButtonText]}>
              {loading ? 'Kayıt yapılıyor...' : 'E-posta ile Kaydol'}
            </Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Zaten hesabın var mı?</Text>
            <Pressable onPress={() => router.replace('/login')}>
              <Text style={styles.switchLink}> Giriş Yap</Text>
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