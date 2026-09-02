import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { supabase } from '../lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    const cleanUsername = username.trim();
    const cleanFullName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanFullName || !cleanUsername || !cleanEmail || !password) {
      Alert.alert(
        'Eksik bilgi',
        'Lütfen tüm alanları doldur.'
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Şifre çok kısa',
        'Şifren en az 6 karakter olmalı.'
      );
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              username: cleanUsername,
              full_name: cleanFullName,
            },
          },
        });

      if (error) {
        Alert.alert(
          'Kayıt başarısız',
          error.message
        );
        return;
      }

      if (!data.user) {
        Alert.alert(
          'Kayıt başarısız',
          'Kullanıcı oluşturulamadı.'
        );
        return;
      }

      // Kullanıcı oturumu oluştuysa profil oluştur
      if (data.session) {
        const { error: profileError } =
          await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: cleanFullName,
              username: cleanUsername,
              bio: 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚',
            });

        if (profileError) {
          console.error(
            'Profil oluşturulamadı:',
            profileError
          );
        }
      }

      Alert.alert(
        'Kayıt başarılı 🎉',
        data.session
          ? 'Hesabın oluşturuldu.'
          : 'Hesabın oluşturuldu. E-postanı kontrol et.',
        [
          {
            text: 'Tamam',
            onPress: () =>
              router.replace('/login'),
          },
        ]
      );
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Hata',
        'Kayıt sırasında bir hata oluştu.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>📚</Text>

        <Text style={styles.title}>
          Hesap Oluştur
        </Text>

        <Text style={styles.subtitle}>
          Kitap dünyasına katıl
        </Text>

        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Ad soyad"
          placeholderTextColor="#999"
          autoCapitalize="words"
          style={styles.input}
        />

        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="Kullanıcı adı"
          placeholderTextColor="#999"
          autoCapitalize="none"
          style={styles.input}
        />

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor="#999"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
        />

        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor="#999"
          secureTextEntry
          style={styles.input}
        />

        <Pressable
          onPress={handleRegister}
          disabled={loading}
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Kayıt yapılıyor...'
              : 'Kayıt Ol'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace('/login')
          }
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Zaten hesabın var mı? Giriş yap
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F5',
    justifyContent: 'center',
    padding: 20,
  },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 24,
  },

  logo: {
    fontSize: 45,
    textAlign: 'center',
  },

  title: {
    marginTop: 10,
    fontSize: 28,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
  },

  subtitle: {
    marginTop: 6,
    marginBottom: 25,
    color: '#777',
    textAlign: 'center',
  },

  input: {
    height: 52,
    backgroundColor: '#F7F7F5',
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 12,
    color: '#222',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },

  button: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },

  disabledButton: {
    opacity: 0.6,
  },

  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },

  linkButton: {
    marginTop: 18,
    alignItems: 'center',
  },

  linkText: {
    color: '#555',
    fontSize: 14,
    fontWeight: '600',
  },
});
