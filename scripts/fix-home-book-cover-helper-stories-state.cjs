const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'home-book-cover-cards.cjs');

if (!fs.existsSync(file)) {
  console.error('HATA: scripts/home-book-cover-cards.cjs bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');

const oldPattern = "const marker = /const \\\[stories, setStories\\\\] = useState<Story\\\\[]>\\\\(\\\\);?/;";
const newPattern = "const marker = /const \\\[stories, setStories\\\\]\\\\s*=\\\\s*useState<Story\\\\[]>\\\\(\\\\[\\\\]\\\\);?/;";

if (source.includes(newPattern)) {
  console.log('Helper stories state kontrolü zaten düzeltilmiş.');
  process.exit(0);
}

if (!source.includes(oldPattern)) {
  console.error('HATA: Helper içindeki eski stories state kalıbı bulunamadı. Dosyada değişiklik yapılmadı.');
  process.exit(1);
}

source = source.replace(oldPattern, newPattern);
fs.writeFileSync(file, source, 'utf8');

console.log('TAMAM: home-book-cover-cards.cjs stories state kontrolü düzeltildi.');
