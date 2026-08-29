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

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      Alert.alert(
        'Eksik bilgi',
        'E-posta ve şifre alanlarını doldur.'
      );
      return;
    }

    setLoading(true);

    try {
      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        Alert.alert(
          'Giriş başarısız',
          error.message
        );
        return;
      }

      router.replace('/');
    } catch (error) {
      console.error(error);

      Alert.alert(
        'Hata',
        'Giriş sırasında bir hata oluştu.'
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
          Hoş Geldin
        </Text>

        <Text style={styles.subtitle}>
          Hesabına giriş yap
        </Text>

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
          onPress={handleLogin}
          disabled={loading}
          style={[
            styles.button,
            loading && styles.disabledButton,
          ]}
        >
          <Text style={styles.buttonText}>
            {loading
              ? 'Giriş yapılıyor...'
              : 'Giriş Yap'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() =>
            router.replace('/register')
          }
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>
            Hesabın yok mu? Kayıt ol
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