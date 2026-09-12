const fs = require('fs');

const file = 'src/app/book.tsx';
let text = fs.readFileSync(file, 'utf8');

const conflicts = [...text.matchAll(
  /<<<<<<< ours\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> theirs/g
)];

if (conflicts.length !== 2) {
  throw new Error(`Beklenen 2 conflict yerine ${conflicts.length} bulundu. Dosya değiştirilmedi.`);
}

let index = 0;

text = text.replace(
  /<<<<<<< ours\r?\n([\s\S]*?)=======\r?\n([\s\S]*?)>>>>>>> theirs/g,
  (_, ours, theirs) => {
    index++;

    // flexShrink olan responsive değişikliği koru.
    if (ours.includes('flexShrink') || theirs.includes('flexShrink')) {
      return ours.includes('flexShrink') ? ours : theirs;
    }

    // Metin/apostrof çatışmasında ilk sürümü koru.
    return ours;
  }
);

if (
  text.includes('<<<<<<<') ||
  text.includes('=======') ||
  text.includes('>>>>>>>')
) {
  throw new Error('Conflict işaretlerinin tamamı temizlenemedi.');
}

fs.writeFileSync(file, text, 'utf8');

console.log('TAMAM: book.tsx conflictleri çözüldü.');
console.log('flexShrink korundu.');
