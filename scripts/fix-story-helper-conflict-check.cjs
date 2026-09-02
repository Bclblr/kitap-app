const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'scripts', 'home-instagram-stories.cjs');

if (!fs.existsSync(file)) {
  console.error('HATA: scripts/home-instagram-stories.cjs bulunamadı.');
  process.exit(1);
}

let source = fs.readFileSync(file, 'utf8');

const oldBlock = `// Basit güvenlik kontrolleri.\nconst forbiddenMarkers = ['<<<<<<<', '=======', '>>>>>>>'];\nfor (const marker of forbiddenMarkers) {\n  if (source.includes(marker)) {\n    console.error(\`HATA: index.tsx içinde çözülmemiş conflict işareti var: \${marker}\`);\n    process.exit(1);\n  }\n}`;

const oldBlockCrLf = oldBlock.replace(/\n/g, '\r\n');

const newBlock = `// Basit güvenlik kontrolleri. Sadece gerçek Git conflict satırlarını yakala.\nconst conflictMatch = source.match(/^\\s*(<<<<<<<|=======|>>>>>>>)(?:\\s.*)?$/m);\nif (conflictMatch) {\n  console.error(\`HATA: index.tsx içinde çözülmemiş conflict işareti var: \${conflictMatch[1]}\`);\n  process.exit(1);\n}`;

if (source.includes(oldBlock)) {
  source = source.replace(oldBlock, newBlock);
} else if (source.includes(oldBlockCrLf)) {
  source = source.replace(oldBlockCrLf, newBlock.replace(/\n/g, '\r\n'));
} else if (source.includes('const conflictMatch = source.match(')) {
  console.log('Helper conflict kontrolü zaten düzeltilmiş.');
  process.exit(0);
} else {
  console.error('HATA: Helper içindeki eski conflict kontrol bloğu bulunamadı. Dosyada değişiklik yapılmadı.');
  process.exit(1);
}

fs.writeFileSync(file, source, 'utf8');
console.log('TAMAM: story helper conflict kontrolü düzeltildi.');
