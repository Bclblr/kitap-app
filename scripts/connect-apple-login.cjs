const fs = require('fs');

const file = 'src/app/login.tsx';
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

const appleHandler = `  async function handleAppleLogin() {
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

      console.error('Apple login error:', error);

      Alert.alert(
        'Apple girişi başarısız',
        error instanceof Error
          ? error.message
          : 'Apple ile giriş sırasında bir hata oluştu.'
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
  throw new Error('Apple giriş butonu bulunamadı.');
}

text = text.replace(
  oldButton,
  'onPress={handleAppleLogin}'
);

fs.writeFileSync(file, text, 'utf8');

console.log('LOGIN APPLE AUTH BAGLANDI');
