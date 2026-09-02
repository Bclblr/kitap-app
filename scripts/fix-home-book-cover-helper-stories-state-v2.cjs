const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'home-book-cover-cards.cjs');

if (!fs.existsSync(file)) {
  console.error('HATA: scripts/home-book-cover-cards.cjs bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');

const oldLine = String.raw`  const marker = /const \[stories, setStories\] = useState<Story\[]>\(\);?/;`;
const newLine = String.raw`  const marker = /const \[stories, setStories\]\s*=\s*useState<Story\[]>\(\[\]\);?/;`;

if (source.includes(newLine)) {
  console.log('Helper stories state kontrolü zaten düzeltilmiş.');
  process.exit(0);
}

if (!source.includes(oldLine)) {
  console.error('HATA: Beklenen stories state satırı bulunamadı. Dosyada değişiklik yapılmadı.');
  process.exit(1);
}

source = source.replace(oldLine, newLine);
fs.writeFileSync(file, source, 'utf8');

console.log('TAMAM: home-book-cover-cards.cjs stories state kontrolü düzeltildi.');
