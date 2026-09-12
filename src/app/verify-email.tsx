import { Feather } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';

export default function VerifyEmailScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = useMemo(() => (typeof params.email === 'string' ? params.email.trim().toLowerCase() : ''), [params.email]);
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);

  async function resendVerification() {
    if (!email) {
      Alert.alert('E-posta bulunamadı', 'Kayıt olduğun e-posta adresiyle tekrar giriş yapmayı dene.');
      return;
    }

    setSending(true);
    try {
      const emailRedirectTo = Linking.createURL('/auth/callback', {
        queryParams: { next: 'onboarding' },
      });
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });

      if (error) {
        Alert.alert('Gönderilemedi', error.message);
        return;
      }

      Alert.alert('E-posta gönderildi', 'Doğrulama bağlantısını yeniden gönderdik. Gelen kutunu ve spam klasörünü kontrol et.');
    } catch (error) {
      console.error('Doğrulama e-postası gönderilemedi:', error);
      Alert.alert('Hata', 'Doğrulama e-postası gönderilirken bir hata oluştu.');
    } finally {
      setSending(false);
    }
  }

  async function checkVerification() {
    if (!email) {
      router.replace('/login');
      return;
    }

    setChecking(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.email_confirmed_at) {
        const onboardingPending = data.session.user.user_metadata?.onboarding_pending === true;
        router.replace(onboardingPending ? '/onboarding' : '/');
        return;
      }

      Alert.alert(
        'Henüz doğrulanmadı',
        'E-posta doğrulaması henüz tamamlanmamış görünüyor. Bağlantıyı açtıysan giriş ekranından tekrar giriş yapabilirsin.'
      );
    } catch (error) {
      console.error('E-posta doğrulaması kontrol edilemedi:', error);
      Alert.alert('Hata', 'Doğrulama durumu kontrol edilemedi.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconWrap}>
          <Feather name="mail" size={30} color="#A985FF" />
        </View>

        <Text style={styles.title}>E-postanı doğrula</Text>
        <Text style={styles.subtitle}>
          Hesabını kullanmaya devam etmek için e-posta adresine gönderdiğimiz doğrulama bağlantısını aç.
        </Text>

        {email ? (
          <View style={styles.emailCard}>
            <Text style={styles.emailLabel}>Doğrulama gönderilen adres</Text>
            <Text style={styles.emailText}>{email}</Text>
          </View>
        ) : null}

        <Pressable onPress={checkVerification} disabled={checking} style={[styles.primaryButton, checking && styles.disabled]}>
          <Text style={styles.primaryText}>{checking ? 'Kontrol ediliyor...' : 'Doğrulamayı Kontrol Et'}</Text>
        </Pressable>

        <Pressable onPress={resendVerification} disabled={sending} style={[styles.secondaryButton, sending && styles.disabled]}>
          <Text style={styles.secondaryText}>{sending ? 'Gönderiliyor...' : 'Doğrulama E-postasını Yeniden Gönder'}</Text>
        </Pressable>

        <Pressable onPress={() => router.replace('/login')} style={styles.loginButton}>
          <Text style={styles.loginText}>Giriş ekranına dön</Text>
        </Pressable>

        <Text style={styles.helpText}>
          E-posta birkaç dakika içinde gelmezse spam veya gereksiz klasörünü de kontrol et.
        </Text>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  content: { flexGrow: 1, width: '100%', maxWidth: 620, alignSelf: 'center', padding: 24, justifyContent: 'center' },
  iconWrap: { width: 66, height: 66, borderRadius: 21, backgroundColor: '#17121F', borderWidth: 1, borderColor: '#2E2340', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { color: '#F5F5F8', fontSize: 29, fontWeight: '800' },
  subtitle: { marginTop: 10, color: '#92929D', fontSize: 14, lineHeight: 21 },
  emailCard: { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: '#111116', borderWidth: 1, borderColor: '#292932' },
  emailLabel: { color: '#777783', fontSize: 11, fontWeight: '700' },
  emailText: { marginTop: 6, color: '#F0F0F4', fontSize: 14, fontWeight: '700' },
  primaryButton: { marginTop: 28, height: 54, borderRadius: 15, backgroundColor: '#A985FF', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#0B0710', fontSize: 15, fontWeight: '800' },
  secondaryButton: { marginTop: 12, minHeight: 52, borderRadius: 15, borderWidth: 1, borderColor: '#3A3150', backgroundColor: '#17131E', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  secondaryText: { color: '#C7B3FF', fontSize: 13, fontWeight: '800', textAlign: 'center' },
  loginButton: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 12, marginTop: 10 },
  loginText: { color: '#A985FF', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  helpText: { marginTop: 18, color: '#6F6F7B', fontSize: 12, lineHeight: 18 },
});
