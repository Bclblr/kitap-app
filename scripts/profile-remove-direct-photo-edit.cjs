const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

// Profil ekranında kapak fotoğrafına basarak değiştirmeyi kapat.
s = s.replace(
  /onPress=\{isOwnProfile \? chooseCoverImage : undefined\}/g,
  'disabled'
);

// Kapaktaki kamera/değiştirme ikonunu kaldır.
s = s.replace(
  /\s*\{isOwnProfile && \(\s*<View style=\{styles\.coverCamera\}>[\s\S]*?<\/View>\s*\)\}/g,
  ''
);

// Profil fotoğrafına basarak değiştirmeyi kapat.
s = s.replace(
  /onPress=\{isOwnProfile \? chooseProfileImage : undefined\}/g,
  'disabled'
);

// Profil fotoğrafındaki kamera/değiştirme ikonunu kaldır.
s = s.replace(
  /\s*\{isOwnProfile && \(\s*<View style=\{styles\.profileCamera\}>[\s\S]*?<\/View>\s*\)\}/g,
  ''
);

if (s === before) {
  console.log('Profilde doğrudan fotoğraf düzenleme alanları bulunamadı veya zaten kaldırılmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Profil ekranındaki profil/kapak fotoğrafı değiştirme özelliği kaldırıldı. Fotoğraflar yalnızca ayarlar sayfasından düzenlenecek.');
