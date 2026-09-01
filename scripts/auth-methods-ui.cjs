const fs = require('fs');

const loginPath = 'src/app/login.tsx';
const registerPath = 'src/app/register.tsx';

if (!fs.existsSync(loginPath)) throw new Error('src/app/login.tsx bulunamadı.');
if (!fs.existsSync(registerPath)) throw new Error('src/app/register.tsx bulunamadı.');

const login = `import { Feather } from '@expo/vector-icons';
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

type LoginMethod = 'email' | 'phone';

export default function LoginScreen() {
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>('email');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (method === 'phone') {
      Alert.alert('Telefonla giriş', 'Telefon doğrulama altyapısını bir sonraki adımda bağlayacağız.');
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      Alert.alert('Eksik bilgi', 'E-posta ve şifre alanlarını doldur.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      if (error) {
        Alert.alert('Giriş başarısız', error.message);
        return;
      }
      router.replace('/');
    } catch (error) {
      console.error(error);
      Alert.alert('Hata', 'Giriş sırasında bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }

  function pendingProvider(provider: string) {
    Alert.alert(provider, provider + ' ile giriş altyapısını bir sonraki adımda bağlayacağız.');
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Feather name="arrow-left" size={22} color="#F1F1F5" />
          </Pressable>
        </View>

        <View style={styles.brandWrap}>
          <View style={styles.logoMark}><Feather name="book-open" size={28} color="#A985FF" /></View>
          <Text style={styles.brandTitle}>1000<Text style={styles.brandAccent}>Kitap</Text></Text>
          <Text style={styles.brandSubtitle}>Okuma dünyana yeniden dön.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Giriş Yap</Text>
          <Text style={styles.subtitle}>Sana en uygun giriş yöntemini seç.</Text>

          <Pressable onPress={() => pendingProvider('Google')} style={styles.providerButton}>
            <Text style={styles.providerLetter}>G</Text>
            <Text style={styles.providerText}>Google ile devam et</Text>
          </Pressable>

          <Pressable onPress={() => pendingProvider('Apple')} style={styles.providerButton}>
            <Feather name="smartphone" size={19} color="#F4F4F7" />
            <Text style={styles.providerText}>Apple ile devam et</Text>
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>veya</Text>
            <View style={styles.orLine} />
          </View>

          <View style={styles.methodTabs}>
            <Pressable onPress={() => setMethod('email')} style={[styles.methodTab, method === 'email' && styles.methodTabActive]}>
              <Feather name="mail" size={16} color={method === 'email' ? '#D9C8FF' : '#777783'} />
              <Text style={[styles.methodTabText, method === 'email' && styles.methodTabTextActive]}>E-posta</Text>
            </Pressable>
            <Pressable onPress={() => setMethod('phone')} style={[styles.methodTab, method === 'phone' && styles.methodTabActive]}>
              <Feather name="phone" size={16} color={method === 'phone' ? '#D9C8FF' : '#777783'} />
              <Text style={[styles.methodTabText, method === 'phone' && styles.methodTabTextActive]}>Telefon</Text>
            </Pressable>
          </View>

          {method === 'email' ? (
            <>
              <Text style={styles.label}>E-posta</Text>
              <View style={styles.inputWrap}>
                <Feather name="mail" size={18} color="#777783" />
                <TextInput value={email} onChangeText={setEmail} placeholder="ornek@email.com" placeholderTextColor="#686873" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.input} />
              </View>
              <Text style={styles.label}>Şifre</Text>
              <View style={styles.inputWrap}>
                <Feather name="lock" size={18} color="#777783" />
                <TextInput value={password} onChangeText={setPassword} placeholder="Şifren" placeholderTextColor="#686873" secureTextEntry style={styles.input} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Telefon numarası</Text>
              <View style={styles.inputWrap}>
                <Feather name="phone" size={18} color="#777783" />
                <TextInput value={phone} onChangeText={setPhone} placeholder="+90 5xx xxx xx xx" placeholderTextColor="#686873" keyboardType="phone-pad" style={styles.input} />
              </View>
              <Text style={styles.phoneHint}>Telefon girişinde doğrulama kodu kullanılacak.</Text>
            </>
          )}

          <Pressable onPress={handleLogin} disabled={loading} style={({ pressed }) => [styles.button, loading && styles.disabledButton, pressed && !loading && styles.buttonPressed]}>
            <Text style={styles.buttonText}>{loading ? 'Giriş yapılıyor...' : method === 'email' ? 'Giriş Yap' : 'Doğrulama Kodu Gönder'}</Text>
          </Pressable>

          <View style={styles.switchRow}>
            <Text style={styles.switchText}>Hesabın yok mu?</Text>
            <Pressable onPress={() => router.replace('/register')}><Text style={styles.switchLink}> Kaydol</Text></Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090D' },
  scrollContent: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  topBar: { paddingTop: 18, minHeight: 62, justifyContent: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, borderColor: '#24242C', backgroundColor: '#111116', alignItems: 'center', justifyContent: 'center' },
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
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  orLine: { flex: 1, height: 1, backgroundColor: '#292932' },
  orText: { color: '#666672', fontSize: 12, fontWeight: '700' },
  methodTabs: { flexDirection: 'row', backgroundColor: '#0C0C11', borderRadius: 14, padding: 4, marginBottom: 20, borderWidth: 1, borderColor: '#24242D' },
  methodTab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 11 },
  methodTabActive: { backgroundColor: '#1D1728', borderWidth: 1, borderColor: '#352649' },
  methodTabText: { color: '#777783', fontSize: 13, fontWeight: '700' },
  methodTabTextActive: { color: '#D9C8FF' },
  label: { marginBottom: 8, fontSize: 12, fontWeight: '700', color: '#B5B5BE' },
  inputWrap: { height: 54, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#0C0C11', borderRadius: 15, borderWidth: 1, borderColor: '#292932', paddingHorizontal: 15, marginBottom: 17 },
  input: { flex: 1, height: '100%', color: '#F2F2F5', fontSize: 15 },
  phoneHint: { color: '#73737D', fontSize: 12, lineHeight: 18, marginTop: -5, marginBottom: 17 },
  button: { height: 54, borderRadius: 15, backgroundColor: '#A985FF', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  buttonPressed: { opacity: 0.84 },
  disabledButton: { opacity: 0.55 },
  buttonText: { color: '#0B0710', fontSize: 15, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 21 },
  switchText: { color: '#85858F', fontSize: 14 },
  switchLink: { color: '#A985FF', fontSize: 14, fontWeight: '800' },
});
`;

const register = login
  .replace('LoginScreen', 'RegisterScreen')
  .replace("type LoginMethod = 'email' | 'phone';", "type RegisterMethod = 'email' | 'phone';")
  .replace("useState<LoginMethod>('email')", "useState<RegisterMethod>('email')")
  .replace("const [email, setEmail] = useState('');", "const [username, setUsername] = useState('');\n  const [email, setEmail] = useState('');")
  .replace('async function handleLogin()', 'async function handleRegister()')
  .replace("Alert.alert('Telefonla giriş', 'Telefon doğrulama altyapısını bir sonraki adımda bağlayacağız.');", "Alert.alert('Telefonla kayıt', 'Telefon doğrulama altyapısını bir sonraki adımda bağlayacağız.');")
  .replace("const cleanEmail = email.trim().toLowerCase();\n    if (!cleanEmail || !password)", "const cleanUsername = username.trim();\n    const cleanEmail = email.trim().toLowerCase();\n    if (!cleanUsername || !cleanEmail || !password)")
  .replace("Alert.alert('Eksik bilgi', 'E-posta ve şifre alanlarını doldur.');", "Alert.alert('Eksik bilgi', 'Kullanıcı adı, e-posta ve şifre alanlarını doldur.');")
  .replace(/const \{ error \} = await supabase\.auth\.signInWithPassword\(\{ email: cleanEmail, password \}\);[\s\S]*?router\.replace\('\/'\);/, `const { data, error } = await supabase.auth.signUp({\n        email: cleanEmail,\n        password,\n        options: { data: { username: cleanUsername } },\n      });\n      if (error) {\n        Alert.alert('Kayıt başarısız', error.message);\n        return;\n      }\n      if (!data.user) {\n        Alert.alert('Kayıt başarısız', 'Kullanıcı oluşturulamadı.');\n        return;\n      }\n      if (data.session) {\n        const { error: profileError } = await supabase.from('profiles').insert({\n          id: data.user.id,\n          username: cleanUsername,\n          bio: 'Kitaplar, hikâyeler ve keşfedilecek yeni dünyalar 📚',\n        });\n        if (profileError) console.error('Profil oluşturulamadı:', profileError);\n      }\n      Alert.alert('Kayıt başarılı 🎉', data.session ? 'Hesabın oluşturuldu.' : 'Hesabın oluşturuldu. E-postanı kontrol et.', [{ text: 'Tamam', onPress: () => router.replace('/login') }]);`)
  .replace("Alert.alert('Hata', 'Giriş sırasında bir hata oluştu.');", "Alert.alert('Hata', 'Kayıt sırasında bir hata oluştu.');")
  .replace("provider + ' ile giriş altyapısını bir sonraki adımda bağlayacağız.'", "provider + ' ile kayıt altyapısını bir sonraki adımda bağlayacağız.'")
  .replace('Okuma dünyana yeniden dön.', 'Okuyanların topluluğuna katıl.')
  .replace('<Text style={styles.title}>Giriş Yap</Text>', '<Text style={styles.title}>Hesap Oluştur</Text>')
  .replace('Sana en uygun giriş yöntemini seç.', 'Sana en uygun kayıt yöntemini seç.')
  .replace('Google ile devam et', 'Google ile kaydol')
  .replace('Apple ile devam et', 'Apple ile kaydol')
  .replace("{method === 'email' ? (\n            <>\n              <Text style={styles.label}>E-posta</Text>", "{method === 'email' ? (\n            <>\n              <Text style={styles.label}>Kullanıcı adı</Text>\n              <View style={styles.inputWrap}>\n                <Feather name=\"user\" size={18} color=\"#777783\" />\n                <TextInput value={username} onChangeText={setUsername} placeholder=\"Kullanıcı adın\" placeholderTextColor=\"#686873\" autoCapitalize=\"none\" style={styles.input} />\n              </View>\n              <Text style={styles.label}>E-posta</Text>")
  .replace('onPress={handleLogin}', 'onPress={handleRegister}')
  .replace("{loading ? 'Giriş yapılıyor...' : method === 'email' ? 'Giriş Yap' : 'Doğrulama Kodu Gönder'}", "{loading ? 'Kayıt yapılıyor...' : method === 'email' ? 'Kaydol' : 'Doğrulama Kodu Gönder'}")
  .replace('Hesabın yok mu?', 'Zaten hesabın var mı?')
  .replace("router.replace('/register')", "router.replace('/login')")
  .replace(' Kaydol</Text>', ' Giriş Yap</Text>');

fs.writeFileSync(loginPath, login, 'utf8');
fs.writeFileSync(registerPath, register, 'utf8');

console.log('Giriş ve kayıt ekranlarına Google, Apple, E-posta ve Telefon seçenekleri eklendi.');
console.log('Mevcut e-posta/şifre Supabase akışı çalışmaya devam ediyor.');
console.log('Google, Apple ve telefon butonları şimdilik tasarım/yer tutucu; altyapıları sonraki adımlarda bağlanacak.');