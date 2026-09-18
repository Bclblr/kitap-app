const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const workCover = fs.readFileSync(path.join(root, 'src/lib/upload-cover.ts'), 'utf8');
const eventEditor = fs.readFileSync(path.join(root, 'src/app/event-editor.tsx'), 'utf8');
const home = fs.readFileSync(path.join(root, 'src/app/index.tsx'), 'utf8');
const profile = fs.readFileSync(path.join(root, 'src/app/profile-settings.tsx'), 'utf8');
const mediaCleanup = fs.readFileSync(path.join(root, 'src/lib/media-cleanup.ts'), 'utf8');

const errors = [];

if (!packageJson.dependencies?.['expo-image-picker']) {
  errors.push('expo-image-picker bağımlılığı eksik.');
}
if (!packageJson.dependencies?.['expo-camera']) {
  errors.push('expo-camera bağımlılığı eksik.');
}

const plugins = appJson.expo?.plugins ?? [];
const pickerEntry = plugins.find((item) => Array.isArray(item) && item[0] === 'expo-image-picker');
const cameraEntry = plugins.find((item) => Array.isArray(item) && item[0] === 'expo-camera');

if (!cameraEntry) {
  errors.push('app.json içinde expo-camera config plugin eksik.');
} else {
  const options = cameraEntry[1] ?? {};
  if (typeof options.cameraPermission !== 'string' || !options.cameraPermission.trim()) {
    errors.push('iOS NSCameraUsageDescription için cameraPermission açıklaması tanımlı olmalı.');
  }
  if (options.recordAudioAndroid !== false) {
    errors.push('Video/ses kaydı kullanılmıyorsa Android RECORD_AUDIO izni kapalı olmalı.');
  }
}

if (!pickerEntry) {
  errors.push('app.json içinde expo-image-picker config plugin eksik.');
} else {
  const options = pickerEntry[1] ?? {};
  if (typeof options.photosPermission !== 'string' || !options.photosPermission.trim()) {
    errors.push('iOS photosPermission açıklaması tanımlı olmalı.');
  }
  if (typeof options.cameraPermission !== 'string' || !options.cameraPermission.trim()) {
    errors.push('Kamera kullanıldığı için image-picker cameraPermission açıklaması tanımlı olmalı.');
  }
  if (options.microphonePermission !== false) {
    errors.push('Mikrofon kullanılmıyorsa microphonePermission=false olmalı.');
  }
}

for (const [label, source] of [
  ['Eser kapağı', workCover],
  ['Etkinlik görseli', eventEditor],
]) {
  if (!source.includes('requestMediaLibraryPermissionsAsync')) {
    errors.push(`${label}: galeri izin kontrolü eksik.`);
  }
  if (!source.includes("mediaTypes: ['images']")) {
    errors.push(`${label}: picker yalnızca images ile sınırlandırılmalı.`);
  }
  if (!source.includes("'image/jpeg'")) {
    errors.push(`${label}: JPEG MIME kontrolü eksik.`);
  }
  if (!source.includes("'image/png'")) {
    errors.push(`${label}: PNG MIME kontrolü eksik.`);
  }
  if (!source.includes("'image/webp'")) {
    errors.push(`${label}: WebP MIME kontrolü eksik.`);
  }
  if (!source.includes('10 * 1024 * 1024')) {
    errors.push(`${label}: 10 MB dosya boyutu sınırı eksik.`);
  }
  if (!source.includes('${user.id}/')) {
    errors.push(`${label}: storage path kullanıcı kimliğiyle scope edilmemiş.`);
  }
  if (!source.includes('upsert: false')) {
    errors.push(`${label}: upload upsert=false olmalı.`);
  }
}

for (const [label, source] of [
  ['Ana akış/story', home],
  ['Profil', profile],
]) {
  if (!source.includes("from 'expo-image-picker'")) {
    errors.push(`${label}: expo-image-picker entegrasyonu eksik.`);
  }
}

if (errors.length) {
  console.error('Media upload preflight başarısız:\n- ' + errors.join('\n- '));
  process.exit(1);
}

console.log('Media upload preflight başarılı.');
console.log('Native kamera/galeri izinleri ve temel upload güvenlik kontrolleri statik olarak doğrulandı.');
