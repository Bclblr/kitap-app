const fs = require('fs');

const path = 'src/app/profile.tsx';
let s = fs.readFileSync(path, 'utf8');

const before = s;

// Kapak fotoğrafının üzerine eklenen koyu/siyah katmanı kaldır.
s = s.replace(/\s*<View style=\{styles\.coverShade\} \/>/g, '');

if (s === before) {
  console.log('coverShade katmanı bulunamadı veya zaten kaldırılmış.');
  process.exit(0);
}

fs.writeFileSync(path, s, 'utf8');
console.log('Kapak fotoğrafındaki siyah karartma kaldırıldı.');
