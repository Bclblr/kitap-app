import AsyncStorage from '@react-native-async-storage/async-storage';
import Image from '@/components/SafeImage';
import { getCurrentAdminAccess } from '@/lib/admin';
import { permanentImageUrl } from '@/lib/image-policy';
import { supabase } from '@/lib/supabase';
import { useThemedStyles } from '@/theme/use-themed-styles';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Profile = {
  id: string;
  username: string;
  fullName: string;
  bio: string;
  profileImage: string | null;
  coverImage: string | null;
};

const EMPTY_PROFILE: Profile = {
  id: '',
  username: 'Kitap Okuru',
  fullName: '',
  bio: '',
  profileImage: null,
  coverImage: null,
};

export default function ProfileSettingsScreen() {
  const styles = useThemedStyles(baseStyles);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [canOpenAdmin, setCanOpenAdmin] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace('/login');
      return;
    }

    const [{ data, error }, adminAccess] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, full_name, bio, profile_image, cover_image')
        .eq('id', user.id)
        .maybeSingle(),
      getCurrentAdminAccess(),
    ]);

    setCanOpenAdmin(adminAccess.canOpenAdmin);

    if (error) {
      console.error('Profil ayarları yüklenemedi:', error);
      return;
    }

    const nextProfile: Profile = {
      id: user.id,
      username: data?.username || 'Kitap Okuru',
      fullName: data?.full_name || '',
      bio: data?.bio || '',
      profileImage: data?.profile_image || null,
      coverImage: data?.cover_image || null,
    };

    setProfile(nextProfile);
    setUsername(nextProfile.username);
    setFullName(nextProfile.fullName);
    setBio(nextProfile.bio);
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile])
  );

  async function saveProfile(next?: Partial<Profile>) {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;

    if (!user) {
      router.replace('/login');
      return false;
    }

    const merged = { ...profile, ...next };
    const nextUsername = username.trim() || merged.username || 'Kitap Okuru';

    const { error } = await supabase.from('profiles').upsert(
      {
        id: user.id,
        username: nextUsername,
        full_name: fullName.trim(),
        bio: bio.trim(),
        profile_image: permanentImageUrl(merged.profileImage),
        cover_image: permanentImageUrl(merged.coverImage),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Profil kaydedilemedi:', error);
      Alert.alert('Hata', 'Profil kaydedilemedi.');
      return false;
    }

    setProfile({
      ...merged,
      username: nextUsername,
      fullName: fullName.trim(),
      bio: bio.trim(),
    });

    return true;
  }

  async function uploadImage(uri: string, type: 'profile' | 'cover') {
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) return null;

    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const filePath = `${user.id}/${type}.jpg`;

    const { error } = await supabase.storage.from('avatars').upload(filePath, arrayBuffer, {
      contentType: 'image/jpeg',
      upsert: true,
    });

    if (error) {
      console.error('Fotoğraf yüklenemedi:', error);
      Alert.alert('Hata', 'Fotoğraf yüklenemedi.');
      return null;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    return permanentImageUrl(`${data.publicUrl}?v=${Date.now()}`);
  }

  async function pickImage(type: 'profile' | 'cover') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('İzin gerekli', 'Galeri izni gerekli.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: type === 'profile' ? [1, 1] : [16, 7],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) return;

    const url = await uploadImage(result.assets[0].uri, type);
    if (!url) return;

    const next = type === 'profile' ? { profileImage: url } : { coverImage: url };
    setProfile((old) => ({ ...old, ...next }));
    await saveProfile(next);
  }

  async function handleSave() {
    setSaving(true);
    const ok = await saveProfile();
    setSaving(false);

    if (ok) {
      Alert.alert('Kaydedildi', 'Profil bilgilerin güncellendi.');
    }
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
      return;
    }

    router.replace('/login');
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Hesabı kalıcı olarak sil',
      'Profilin, içeriklerin ve hesabına bağlı veriler silinecek. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Devam Et',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Son onay',
              'Hesabını ve verilerini kalıcı olarak silmek istediğinden emin misin?',
              [
                { text: 'Vazgeç', style: 'cancel' },
                {
                  text: 'Kalıcı Olarak Sil',
                  style: 'destructive',
                  onPress: () => void deleteAccount(),
                },
              ]
            );
          },
        },
      ]
    );
  }

  async function deleteAccount() {
    setSaving(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        await AsyncStorage.clear();
        router.replace('/login');
        return;
      }

      const { error } = await supabase.functions.invoke('delete-account', {
        body: {},
      });

      if (error) {
        console.error('Hesap silinemedi:', error);
        Alert.alert(
          'Hesap silinemedi',
          'Hesap veya bağlı dosyalar güvenli şekilde silinemedi. Hiçbir işlem yarım bırakılmadı; lütfen tekrar dene.'
        );
        return;
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // Auth user has already been deleted server-side; local cleanup below is authoritative.
      }

      await AsyncStorage.clear();
      router.replace('/login');
      Alert.alert('Hesap silindi', 'Hesabın ve hesabına bağlı veriler kalıcı olarak silindi.');
    } catch (error) {
      console.error('Hesap silme hatası:', error);
      Alert.alert('Hata', 'Hesap silinirken bir hata oluştu. Lütfen tekrar dene.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Profil Ayarları</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Pressable onPress={() => void pickImage('cover')} style={styles.coverBox} disabled={saving}>
          {profile.coverImage ? (
            <Image source={{ uri: profile.coverImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Text style={styles.placeholderText}>Kapak fotoğrafı ekle</Text>
            </View>
          )}
          <View style={styles.photoEditBadge}>
            <Text style={styles.photoEditText}>📷</Text>
          </View>
        </Pressable>

        <Pressable onPress={() => void pickImage('profile')} style={styles.avatarButton} disabled={saving}>
          {profile.profileImage ? (
            <Image source={{ uri: profile.profileImage }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarPlaceholderText}>👤</Text>
            </View>
          )}
          <View style={styles.avatarEditBadge}>
            <Text style={styles.photoEditText}>📷</Text>
          </View>
        </Pressable>

        <View style={styles.form}>
          <Text style={styles.label}>Ad Soyad</Text>
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            placeholder="Adın ve soyadın"
            placeholderTextColor="#74747E"
            maxLength={60}
            editable={!saving}
          />

          <Text style={styles.label}>Kullanıcı adı</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            placeholder="Kullanıcı adın"
            placeholderTextColor="#74747E"
            maxLength={30}
            editable={!saving}
          />

          <Text style={styles.label}>Hakkında</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            style={[styles.input, styles.bioInput]}
            placeholder="Kendinden bahset..."
            placeholderTextColor="#74747E"
            multiline
            maxLength={150}
            editable={!saving}
          />

          <Pressable onPress={() => void handleSave()} disabled={saving} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>
              {saving ? 'İşlem yapılıyor...' : 'Değişiklikleri Kaydet'}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/blocked-users')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>🚫 Engellenen Kullanıcılar</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/notification-settings')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>🔔 Bildirim Ayarları</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/privacy-data')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>🔐 Gizlilik ve Verilerim</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/privacy-settings')} style={styles.adminButton} disabled={saving}>
          <Text style={styles.adminButtonText}>👁 Profil Gizliliği</Text>
          <Text style={styles.adminButtonArrow}>›</Text>
        </Pressable>

        {canOpenAdmin ? (
          <Pressable onPress={() => router.push('/admin')} style={styles.adminButton} disabled={saving}>
            <Text style={styles.adminButtonText}>🛡 Yönetim Paneli</Text>
            <Text style={styles.adminButtonArrow}>›</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => void handleLogout()} style={styles.logoutButton} disabled={saving}>
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </Pressable>

        <Pressable onPress={confirmDeleteAccount} disabled={saving} style={styles.deleteAccountButton}>
          <Text style={styles.deleteAccountText}>
            {saving ? 'İşlem yapılıyor...' : 'Hesabımı Kalıcı Olarak Sil'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090A0F',
  },
  content: {
    paddingBottom: 60,
  },
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
    backgroundColor: '#171820',
  },
  backText: {
    color: '#F5F5F7',
    fontSize: 32,
    lineHeight: 34,
  },
  title: {
    color: '#F5F5F7',
    fontSize: 19,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 42,
  },
  coverBox: {
    height: 180,
    marginHorizontal: 18,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#25262F',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#9A9AA4',
    fontWeight: '600',
  },
  photoEditBadge: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(10,10,14,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEditText: {
    fontSize: 17,
  },
  avatarButton: {
    width: 116,
    height: 116,
    borderRadius: 58,
    alignSelf: 'center',
    marginTop: -45,
    borderWidth: 4,
    borderColor: '#7C63E6',
    backgroundColor: '#090A0F',
    position: 'relative',
    padding: 4,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#1A1B23',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 38,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#20212A',
    borderWidth: 2,
    borderColor: '#090A0F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  form: {
    marginTop: 28,
    marginHorizontal: 20,
  },
  label: {
    color: '#DADAE0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#15161D',
    borderWidth: 1,
    borderColor: '#292A33',
    color: '#F5F5F7',
    paddingHorizontal: 14,
    fontSize: 15,
  },
  bioInput: {
    minHeight: 110,
    paddingTop: 14,
    textAlignVertical: 'top',
  },
  saveButton: {
    marginTop: 24,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#7157DD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
  adminButton: {
    marginTop: 30,
    marginHorizontal: 20,
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1D1728',
    borderWidth: 1,
    borderColor: '#4A3569',
  },
  adminButtonText: {
    color: '#C7B3FF',
    fontSize: 15,
    fontWeight: '800',
  },
  adminButtonArrow: {
    color: '#A985FF',
    fontSize: 28,
    lineHeight: 30,
  },
  logoutButton: {
    alignSelf: 'center',
    marginTop: 32,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#55272D',
    backgroundColor: '#201317',
  },
  logoutText: {
    color: '#FF747D',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  deleteAccountButton: {
    alignSelf: 'center',
    marginTop: 14,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  deleteAccountText: {
    color: '#A66A70',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});