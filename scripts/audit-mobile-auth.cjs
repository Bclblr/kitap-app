const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const googleAuth = fs.readFileSync(path.join(root, 'src/lib/google-auth.ts'), 'utf8');
const appleAuth = fs.readFileSync(path.join(root, 'src/lib/apple-auth.ts'), 'utf8');
const callback = fs.readFileSync(path.join(root, 'src/app/auth/callback.tsx'), 'utf8');
const register = fs.readFileSync(path.join(root, 'src/app/register.tsx'), 'utf8');
const login = fs.readFileSync(path.join(root, 'src/app/login.tsx'), 'utf8');
const verifyEmail = fs.readFileSync(path.join(root, 'src/app/verify-email.tsx'), 'utf8');

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

for (const dep of [
  'expo-auth-session',
  'expo-web-browser',
  'expo-apple-authentication',
  '@supabase/supabase-js',
]) {
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

if (!appleAuth.includes('AppleAuthentication.signInAsync')) {
  errors.push('Native Apple Sign In çağrısı eksik.');
}
if (!appleAuth.includes("provider: 'apple'")) {
  errors.push('Apple kimlik tokenı Supabase apple provider ile doğrulanmalı.');
}
if (!appleAuth.includes('getCredentialStateAsync')) {
  errors.push('Apple credential state doğrulaması eksik.');
}

if (!register.includes('supabase.auth.signUp')) {
  errors.push('E-posta kayıt akışında signUp çağrısı eksik.');
}
if (!register.includes('onboarding_pending: true')) {
  errors.push('Yeni e-posta hesabı onboarding_pending=true ile oluşturulmalı.');
}
if (!register.includes("Linking.createURL('/auth/callback'")) {
  errors.push('E-posta doğrulama callback adresi auth/callback olmalı.');
}
if (!register.includes("next: 'onboarding'")) {
  errors.push('E-posta doğrulama callbacki onboarding hedefine dönmeli.');
}
if (!register.includes("pathname: '/verify-email'")) {
  errors.push('Oturumsuz yeni kayıt verify-email ekranına yönlenmeli.');
}

if (!verifyEmail.includes("type: 'signup'")) {
  errors.push('Doğrulama e-postası yeniden gönderme tipi signup olmalı.');
}
if (!verifyEmail.includes("Linking.createURL('/auth/callback'")) {
  errors.push('Yeniden doğrulama callback adresi auth/callback olmalı.');
}
if (!verifyEmail.includes('email_confirmed_at')) {
  errors.push('Doğrulama ekranı email_confirmed_at durumunu kontrol etmeli.');
}

if (!login.includes('supabase.auth.signInWithPassword')) {
  errors.push('E-posta login akışında signInWithPassword çağrısı eksik.');
}
if (!login.includes('email not confirmed') || !login.includes("'/verify-email'")) {
  errors.push('Doğrulanmamış e-posta login akışı verify-email ekranına yönlenmeli.');
}

if (errors.length) {
  console.error('Mobil auth preflight başarısız:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Mobil auth preflight başarılı.');
console.log(`Scheme: ${scheme}`);
console.log(`iOS bundle: ${expo.ios.bundleIdentifier}`);
console.log(`Android package: ${expo.android.package}`);
console.log('Google OAuth, Apple Sign In ve e-posta doğrulama zinciri statik olarak doğrulandı.');
