const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const googleAuth = fs.readFileSync(path.join(root, 'src/lib/google-auth.ts'), 'utf8');
const callback = fs.readFileSync(path.join(root, 'src/app/auth/callback.tsx'), 'utf8');

const errors = [];
const expo = appJson.expo ?? {};
const scheme = expo.scheme;

if (!scheme || typeof scheme !== 'string') {
  errors.push('app.json expo.scheme tanımlı olmalı.');
}
if (!expo.ios?.bundleIdentifier) {
  errors.push('iOS bundleIdentifier tanımlı olmalı.');
}
if (!expo.android?.package) {
  errors.push('Android package tanımlı olmalı.');
}
if (expo.ios?.usesAppleSignIn !== true) {
  errors.push('iOS usesAppleSignIn true olmalı.');
}

for (const dep of ['expo-auth-session', 'expo-web-browser', '@supabase/supabase-js']) {
  if (!packageJson.dependencies?.[dep]) errors.push(`${dep} bağımlılığı eksik.`);
}

if (!googleAuth.includes("path: 'auth/callback'")) {
  errors.push('Google OAuth redirect path auth/callback olmalı.');
}
if (!googleAuth.includes("scheme: 'kitapapp'")) {
  errors.push('Google OAuth redirect scheme kitapapp olmalı.');
}
if (scheme && scheme !== 'kitapapp') {
  errors.push(`app.json scheme (${scheme}) ile OAuth scheme (kitapapp) eşleşmiyor.`);
}
if (!callback.includes('exchangeCodeForSession')) {
  errors.push('Auth callback PKCE code dönüşünü işlemiyor.');
}
if (!callback.includes('createSessionFromUrl')) {
  errors.push('Auth callback token dönüşünü işlemiyor.');
}

if (errors.length) {
  console.error('Mobil auth preflight başarısız:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Mobil auth preflight başarılı.');
console.log(`Scheme: ${scheme}`);
console.log(`iOS bundle: ${expo.ios.bundleIdentifier}`);
console.log(`Android package: ${expo.android.package}`);
