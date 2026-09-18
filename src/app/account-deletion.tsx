import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';

export default function AccountDeletionScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState('');

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

      const { data: result, error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;

      try { await supabase.auth.signOut(); } catch {}
      await AsyncStorage.clear();
      setSignedIn(false);
      setConfirming(false);
      setConfirmText('');

      if (result?.storage_cleanup_warning) {
        Alert.alert(
          'Hesap silindi',
          'Hesabın silindi. Bazı medya dosyalarının sunucu temizliği ayrıca tamamlanacak.'
        );
      } else {
        Alert.alert('Hesap silindi', 'Hesabın ve hesabına bağlı veriler kalıcı olarak silindi.');
      }

      router.replace('/login');
    } catch (error) {
      console.error('Web hesap silme hatası:', error);
      Alert.alert('Hesap silinemedi', 'İşlem tamamlanamadı. Lütfen tekrar dene.');
    } finally {
      setDeleting(false);
    }
  }

  function confirmDelete() {
    setConfirmText('');
    setConfirming(true);
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
      <Modal
        visible={confirming}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deleting) setConfirming(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Hesabı kalıcı olarak sil</Text>
            <Text style={styles.confirmText}>
              Profilin, içeriklerin ve hesabına bağlı veriler kalıcı olarak silinir. Bu işlem geri alınamaz.
            </Text>
            <Text style={styles.confirmLabel}>Devam etmek için SİL yaz.</Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              editable={!deleting}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="SİL"
              placeholderTextColor="#6F6F7B"
              style={styles.confirmInput}
            />
            <View style={styles.confirmActions}>
              <Pressable
                disabled={deleting}
                onPress={() => {
                  setConfirming(false);
                  setConfirmText('');
                }}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Vazgeç</Text>
              </Pressable>
              <Pressable
                disabled={deleting || confirmText.trim().toLocaleUpperCase('tr-TR') !== 'SİL'}
                onPress={() => void deleteAccount()}
                style={[
                  styles.dangerButton,
                  styles.confirmDangerButton,
                  (deleting || confirmText.trim().toLocaleUpperCase('tr-TR') !== 'SİL') && styles.disabled,
                ]}
              >
                <Text style={styles.dangerText}>{deleting ? 'Siliniyor…' : 'Kalıcı Olarak Sil'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  confirmCard: { width: '100%', maxWidth: 520, borderRadius: 20, borderWidth: 1, borderColor: '#3A2A2A', backgroundColor: '#111116', padding: 22 },
  confirmTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  confirmText: { marginTop: 10, color: '#C4C4CC', fontSize: 14, lineHeight: 21 },
  confirmLabel: { marginTop: 18, color: '#F0B9B9', fontSize: 13, fontWeight: '800' },
  confirmInput: { marginTop: 9, minHeight: 50, borderRadius: 13, borderWidth: 1, borderColor: '#563535', backgroundColor: '#0B0B0F', color: '#FFFFFF', paddingHorizontal: 14, fontSize: 16, fontWeight: '800' },
  confirmActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 14, borderWidth: 1, borderColor: '#34343D', backgroundColor: '#1A1A20', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#D0D0D7', fontWeight: '800' },
  confirmDangerButton: { flex: 1, marginTop: 0 },
});
