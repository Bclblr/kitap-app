const fs = require('fs');

const file = 'supabase/migrations/202609050005_quote_writes.sql';
const backup = file + '.before-gpt-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

const oldGrant =
  'grant insert on public.quotes to authenticated;';

const newGrant =
  'grant insert, update, delete on public.quotes to authenticated;';

if (!sql.includes(oldGrant)) {
  throw new Error('Beklenen quotes grant satırı bulunamadı. Dosya değiştirilmedi.');
}

sql = sql.replace(oldGrant, newGrant);

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: quote_writes migration düzeltildi.');
console.log('Yedek:', backup);
console.log('authenticated: insert/update/delete yetkileri verildi');
console.log('anon: yalnızca select');
