const fs = require('fs');

const file = 'supabase/migrations/202609050001_reader_features.sql';
const backup = file + '.before-gpt-fix-v2.bak';

let sql = fs.readFileSync(file, 'utf8');
const original = sql;

fs.copyFileSync(file, backup);

const blockedRegex =
  /create\s+or\s+replace\s+function\s+public\.readers_blocked\s*\(\s*a\s+uuid\s*,\s*b\s+uuid\s*\)\s+returns\s+boolean[\s\S]*?\$\$;/i;

if (!blockedRegex.test(sql)) {
  throw new Error('readers_blocked() fonksiyonu bulunamadı. Dosya değiştirilmedi.');
}

sql = sql.replace(
  blockedRegex,
`create or replace function public.readers_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
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
$$;`
);

sql = sql.replace(
  /reporter_id\s+uuid\s+not\s+null\s+references\s+auth\.users\(id\)(?!\s+on\s+delete)/i,
  'reporter_id uuid not null references auth.users(id) on delete cascade'
);

sql = sql.replace(
  /reported_id\s+uuid\s+not\s+null\s+references\s+auth\.users\(id\)(?!\s+on\s+delete)/i,
  'reported_id uuid not null references auth.users(id) on delete cascade'
);

sql = sql.replace(/\bselect1\s+from\b/gi, 'select 1 from');

const updatedAtRegex =
  /create\s+or\s+replace\s+function\s+public\.reader_updated_at\s*\(\s*\)\s+returns\s+trigger[\s\S]*?\$\$;/i;

if (!updatedAtRegex.test(sql)) {
  throw new Error('reader_updated_at() fonksiyonu bulunamadı. Dosya değiştirilmedi.');
}

sql = sql.replace(
  updatedAtRegex,
`create or replace function public.reader_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();

  if new.status = 'published'
     and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$$;`
);

const errors = [];

if (/\bselect1\s+from\b/i.test(sql)) {
  errors.push('select1 hatası hâlâ mevcut');
}

if (/beginnew/i.test(sql)) {
  errors.push('beginnew hatası hâlâ mevcut');
}

if (!/set search_path = ''/i.test(sql)) {
  errors.push('güvenli search_path eklenemedi');
}

if (errors.length) {
  fs.writeFileSync(file, original, 'utf8');
  throw new Error(errors.join(', '));
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: reader_features migration düzeltildi.');
console.log('Yedek:', backup);
console.log('select1: düzeltildi');
console.log('reader_updated_at: düzeltildi');
console.log('readers_blocked: güvenliği sıkılaştırıldı');
console.log('user_reports foreign key davranışı: eklendi');
