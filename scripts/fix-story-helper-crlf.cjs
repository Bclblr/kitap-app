const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'home-instagram-stories.cjs');

if (!fs.existsSync(file)) {
  console.error('HATA: scripts/home-instagram-stories.cjs bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');
const original = source;

const replacements = [
  [
    "/storyModalOverlay: \\{[\\s\\S]*?storyViewerText: \\{[\\s\\S]*?\\n\\s*\\},\\n\\n\\s*sectionHeader:/,",
    "/storyModalOverlay: \\{[\\s\\S]*?storyViewerText: \\{[\\s\\S]*?\\r?\\n\\s*\\},\\r?\\n\\r?\\n\\s*sectionHeader:/,",
  ],
  [
    "/storyItem: \\{[\\s\\S]*?storyName: \\{[\\s\\S]*?\\n\\s*\\},\\n\\n\\s*storyCreateBox:/,",
    "/storyItem: \\{[\\s\\S]*?storyName: \\{[\\s\\S]*?\\r?\\n\\s*\\},\\r?\\n\\r?\\n\\s*storyCreateBox:/,",
  ],
];

for (const [from, to] of replacements) {
  if (!source.includes(from)) {
    console.error('HATA: Beklenen helper kalıbı bulunamadı. Dosyada değişiklik yapılmadı.');
    process.exit(1);
  }
  source = source.replace(from, to);
}

if (source === original) {
  console.log('Helper zaten CRLF uyumlu görünüyor.');
  process.exit(0);
}

fs.writeFileSync(file, source, 'utf8');
console.log('TAMAM: home-instagram-stories.cjs CRLF uyumlu hale getirildi.');
