const fs = require('fs');

const file = 'supabase/migrations/202609050001_reader_features.sql';
const backup = file + '.before-gpt-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

const oldBlocked = `create or replace function public.readers_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.user_blocks where (blocker_id=a and blocked_id=b) or (blocker_id=b and blocked_id=a));
$$;`;

const newBlocked = `create or replace function public.readers_blocked(a uuid, b uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when auth.uid() <> a and auth.uid() <> b then false
    else exists(
      select 1
      from public.user_blocks
      where (blocker_id = a and blocked_id = b)
         or (blocker_id = b and blocked_id = a)
    )
  end;
$$;`;

if (!sql.includes(oldBlocked)) {
  throw new Error('readers_blocked eski fonksiyon bloğu bulunamadı. Dosya değiştirilmedi.');
}

sql = sql.replace(oldBlocked, newBlocked);

sql = sql.replace(
  'reporter_id uuid not null references auth.users(id)',
  'reporter_id uuid not null references auth.users(id) on delete cascade'
);

sql = sql.replace(
  'reported_id uuid not null references auth.users(id)',
  'reported_id uuid not null references auth.users(id) on delete cascade'
);

sql = sql.replaceAll(
  'select1 from',
  'select 1 from'
);

const oldTrigger = `create or replace function public.reader_updated_at() returns trigger language plpgsql set search_path=public as $$ beginnew.updated_at=now(); if new.status='published' and new.published_at is null then new.published_at=now(); end if; return new; end $$;`;

const newTrigger = `create or replace function public.reader_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();

  if new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;

  return new;
end;
$$;`;

if (!sql.includes(oldTrigger)) {
  throw new Error('reader_updated_at eski fonksiyon bloğu bulunamadı. Dosya değiştirilmedi.');
}

sql = sql.replace(oldTrigger, newTrigger);

if (sql.includes('select1 from')) {
  throw new Error('select1 hatası hâlâ mevcut.');
}

if (sql.includes('beginnew')) {
  throw new Error('beginnew hatası hâlâ mevcut.');
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: 202609050001_reader_features.sql düzeltildi.');
console.log('Yedek:', backup);
console.log('- select1 düzeltildi');
console.log('- trigger fonksiyonu düzeltildi');
console.log('- readers_blocked güvenliği sıkılaştırıldı');
console.log('- report foreign key ON DELETE davranışları eklendi');
