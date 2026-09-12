const fs = require('fs');

const file = 'src/app/register.tsx';
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

const newPending = `  async function handleGoogleRegister() {
    setLoading(true);

    try {
      const session = await signInWithGoogle();

      if (session) {
        router.replace('/');
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

  function pendingProvider(provider: 'Apple') {
    Alert.alert(
      provider,
      provider + ' ile kayıt altyapısını daha sonra bağlayacağız.'
    );
  }`;

if (!oldPending.test(text)) {
  throw new Error('pendingProvider fonksiyonu bulunamadı.');
}

text = text.replace(oldPending, newPending);

const googleButton =
  "onPress={() => pendingProvider('Google')}";

if (!text.includes(googleButton)) {
  throw new Error('Google kayıt butonu bulunamadı.');
}

text = text.replace(
  googleButton,
  'onPress={handleGoogleRegister}'
);

fs.writeFileSync(file, text, 'utf8');

console.log('REGISTER GOOGLE OAUTH BAGLANDI');
