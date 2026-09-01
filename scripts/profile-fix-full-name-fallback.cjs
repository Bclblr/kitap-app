const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');
const before = s;

// Ad Soyad boşsa kullanıcı adını Ad Soyad gibi göstermesin.
// Kullanıcı adı her zaman ayrı @kullaniciadi satırında kalır.
s = s.replace(
  /\{profile\.fullName \|\| profile\.username\}/g,
  "{profile.fullName || 'Ad Soyad'}"
);

if (s === before) {
  console.log('Ad Soyad fallback alanı bulunamadı veya zaten düzeltilmiş.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Ad Soyad ile kullanıcı adı birbirinden ayrıldı.');
