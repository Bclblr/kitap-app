import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';

export default function AccountDeletionScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setSignedIn(!!data.user);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function deleteAccount() {
    if (deleting) return;
    setDeleting(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setSignedIn(false);
        Alert.alert('Giriş gerekli', 'Hesabını silmek için önce hesabına giriş yapmalısın.');
        return;
      }

      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;

      try { await supabase.auth.signOut(); } catch {}
      await AsyncStorage.clear();
      setSignedIn(false);
      Alert.alert('Hesap silindi', 'Hesabın ve hesabına bağlı veriler kalıcı olarak silindi.');
      router.replace('/login');
    } catch (error) {
      console.error('Web hesap silme hatası:', error);
      Alert.alert('Hesap silinemedi', 'İşlem tamamlanamadı. Lütfen tekrar dene.');
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Hesabı kalıcı olarak sil',
      'Profilin, içeriklerin ve hesabına bağlı veriler kalıcı olarak silinir. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kalıcı Olarak Sil', style: 'destructive', onPress: () => void deleteAccount() },
      ]
    );
  }

  if (loading) {
    return <View style={styles.container}><ActivityIndicator /><Text style={styles.muted}>Oturum kontrol ediliyor…</Text></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Hesap ve Veri Silme</Text>
        <Text style={styles.text}>
          Kitap hesabını mobil uygulamaya ihtiyaç duymadan bu web ekranından silebilirsin. Hesap silindiğinde profilin, kullanıcı içeriklerin ve hesabına bağlı uygulama verileri kalıcı olarak silinir.
        </Text>
        <Text style={styles.text}>Bu işlem geri alınamaz.</Text>

        {signedIn ? (
          <Pressable disabled={deleting} onPress={confirmDelete} style={[styles.dangerButton, deleting && styles.disabled]}>
            <Text style={styles.dangerText}>{deleting ? 'Hesap siliniyor…' : 'Hesabımı Kalıcı Olarak Sil'}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.muted}>Kimliğini doğrulamak için önce hesabına giriş yap.</Text>
            <Pressable onPress={() => router.push('/login')} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Giriş Yap</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090D' },
  card: { width: '100%', maxWidth: 620, padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#2B2B35', backgroundColor: '#111116' },
  title: { color: '#F4F4F7', fontSize: 26, fontWeight: '900', marginBottom: 16 },
  text: { color: '#C4C4CC', fontSize: 15, lineHeight: 23, marginBottom: 12 },
  muted: { color: '#8E8E98', fontSize: 13, lineHeight: 20, marginTop: 8 },
  primaryButton: { marginTop: 20, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A985FF' },
  primaryText: { color: '#0B0710', fontWeight: '900' },
  dangerButton: { marginTop: 20, minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7F1D1D' },
  dangerText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
