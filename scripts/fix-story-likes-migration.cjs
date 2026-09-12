const fs = require('fs');

const file = 'supabase/migrations/202609050003_story_likes.sql';
const backup = file + '.before-gpt-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

sql = sql.replace(/\bselect1\s+from\b/gi, 'select 1 from');

if (!/revoke\s+all\s+on\s+public\.story_likes\s+from\s+anon\s*;/i.test(sql)) {
  sql = sql.replace(
    /grant\s+select\s*,\s*insert\s*,\s*delete\s+on\s+public\.story_likes\s+to\s+authenticated\s*;/i,
    `revoke all on public.story_likes from anon;
grant select, insert, delete on public.story_likes to authenticated;`
  );
}

if (/\bselect1\b/i.test(sql)) {
  throw new Error('select1 hatası hâlâ mevcut.');
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: story_likes migration düzeltildi.');
console.log('Yedek:', backup);
console.log('select1: düzeltildi');
console.log('anon erişimi: kapatıldı');
