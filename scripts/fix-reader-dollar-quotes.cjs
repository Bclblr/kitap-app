const fs = require('fs');

const file = 'supabase/migrations/202609050001_reader_features.sql';
const backup = file + '.before-dollarquote-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

const blockedRegex =
  /create\s+or\s+replace\s+function\s+public\.readers_blocked\s*\(\s*a\s+uuid\s*,\s*b\s+uuid\s*\)[\s\S]*?\n\$;/i;

const blockedFunction = `create or replace function public.readers_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $reader_blocked$
  select case
    when auth.uid() is null then false
    when auth.uid() <> a and auth.uid() <> b then false
    else exists (
      select 1
      from public.user_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$reader_blocked$;`;

if (!blockedRegex.test(sql)) {
  throw new Error('readers_blocked mevcut fonksiyon bloğu bulunamadı.');
}

sql = sql.replace(blockedRegex, () => blockedFunction);

const triggerRegex =
  /create\s+or\s+replace\s+function\s+public\.reader_updated_at\s*\(\s*\)[\s\S]*?\n\$;/i;

const triggerFunction = `create or replace function public.reader_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $reader_updated_at$
begin
  new.updated_at = now();

  if new.status = 'published'
     and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$reader_updated_at$;`;

if (!triggerRegex.test(sql)) {
  throw new Error('reader_updated_at mevcut fonksiyon bloğu bulunamadı.');
}

sql = sql.replace(triggerRegex, () => triggerFunction);

const checks = [
  ['BLOCKED_OPEN', /as\s+\$reader_blocked\$/i],
  ['BLOCKED_CLOSE', /\$reader_blocked\$;/i],
  ['UPDATED_OPEN', /as\s+\$reader_updated_at\$/i],
  ['UPDATED_CLOSE', /\$reader_updated_at\$;/i],
];

for (const [name, regex] of checks) {
  if (!regex.test(sql)) {
    throw new Error(name + ' doğrulaması başarısız.');
  }
}

if (/\bselect1\b/i.test(sql)) {
  throw new Error('select1 hatası hâlâ mevcut.');
}

if (/beginnew/i.test(sql)) {
  throw new Error('beginnew hatası hâlâ mevcut.');
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: PostgreSQL function dollar-quote blokları düzeltildi.');
console.log('Yedek:', backup);
console.log('readers_blocked: OK');
console.log('reader_updated_at: OK');
