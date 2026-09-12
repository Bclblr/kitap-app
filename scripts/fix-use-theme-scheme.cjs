const fs = require('fs');

const file = 'src/hooks/use-theme.ts';
let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  "  const theme = scheme ?? 'light';",
  "  const theme = scheme === 'dark' ? 'dark' : 'light';"
);

fs.writeFileSync(file, text, 'utf8');

console.log('TAMAM: use-theme.ts renk şeması tipi düzeltildi.');
