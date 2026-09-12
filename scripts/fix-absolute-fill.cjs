const fs = require('fs');

const file = 'src/components/animated-icon.tsx';
let text = fs.readFileSync(file, 'utf8');

if (!text.includes('StyleSheet.absoluteFillObject')) {
  throw new Error('absoluteFillObject bulunamadı. Dosya değiştirilmedi.');
}

text = text.replace(
  'StyleSheet.absoluteFillObject',
  'StyleSheet.absoluteFill'
);

fs.writeFileSync(file, text, 'utf8');

console.log('TAMAM: absoluteFillObject -> absoluteFill olarak düzeltildi.');
