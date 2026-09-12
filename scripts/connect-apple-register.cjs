const fs = require('fs');

const file = 'src/app/register.tsx';
let text = fs.readFileSync(file, 'utf8');

const googleImport =
  "import { signInWithGoogle } from '../lib/google-auth';";

if (!text.includes("import { signInWithApple } from '../lib/apple-auth';")) {
  text = text.replace(
    googleImport,
    `${googleImport}
import { signInWithApple } from '../lib/apple-auth';`
  );
}

const pendingRegex =
  /  function pendingProvider\(provider: 'Apple'\) \{[\s\S]*?\n  \}/;

const appleHandler = `  async function handleAppleRegister() {
    setLoading(true);

    try {
      const session = await signInWithApple();

      if (session) {
        router.replace('/');
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
  }`;

if (!pendingRegex.test(text)) {
  throw new Error('Apple placeholder fonksiyonu bulunamadı.');
}

text = text.replace(pendingRegex, appleHandler);

const oldButton =
  "onPress={() => pendingProvider('Apple')}";

if (!text.includes(oldButton)) {
  throw new Error('Apple kayıt butonu bulunamadı.');
}

text = text.replace(
  oldButton,
  'onPress={handleAppleRegister}'
);

fs.writeFileSync(file, text, 'utf8');

console.log('REGISTER APPLE AUTH BAGLANDI');
