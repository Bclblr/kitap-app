const fs = require('fs');

const file = 'src/app/login.tsx';
let text = fs.readFileSync(file, 'utf8');

const supabaseImport = "import { supabase } from '../lib/supabase';";

if (!text.includes("import { signInWithGoogle } from '../lib/google-auth';")) {
  text = text.replace(
    supabaseImport,
    `${supabaseImport}
import { signInWithGoogle } from '../lib/google-auth';`
  );
}

const oldPending = /  function pendingProvider\(provider: 'Google' \| 'Apple'\) \{[\s\S]*?\n  \}/;

const newPending = `  async function handleGoogleLogin() {
    setLoading(true);

    try {
      const session = await signInWithGoogle();

      if (session) {
        router.replace('/');
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

  function pendingProvider(provider: 'Apple') {
    Alert.alert(
      provider,
      provider + ' ile giriş altyapısını daha sonra bağlayacağız.'
    );
  }`;

if (!oldPending.test(text)) {
  throw new Error('pendingProvider fonksiyonu bulunamadı.');
}

text = text.replace(oldPending, newPending);

const googleButton =
  "onPress={() => pendingProvider('Google')}";

if (!text.includes(googleButton)) {
  throw new Error('Google butonu bulunamadı.');
}

text = text.replace(
  googleButton,
  'onPress={handleGoogleLogin}'
);

fs.writeFileSync(file, text, 'utf8');

console.log('LOGIN GOOGLE OAUTH BAGLANDI');
