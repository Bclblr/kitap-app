const fs = require('fs');

const file = 'src/components/app-tabs.web.tsx';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  "  const colors = Colors[scheme ?? 'light'];",
  "  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];"
);

fs.writeFileSync(file, text, 'utf8');

console.log('TAMAM: app-tabs.web.tsx renk şeması tipi düzeltildi.');
