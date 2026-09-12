const fs = require('fs');

const file = 'supabase/migrations/202609050004_access_hardening.sql';
const backup = file + '.before-gpt-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

function replaceBlock(regex, replacement, name) {
  if (!regex.test(sql)) {
    throw new Error(name + ' bloğu bulunamadı. Dosya değiştirilmedi.');
  }

  sql = sql.replace(regex, () => replacement);
}

/* readers_blocked */
replaceBlock(
  /create\s+or\s+replace\s+function\s+public\.readers_blocked\s*\(\s*a\s+uuid\s*,\s*b\s+uuid\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.readers_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $access_readers_blocked$
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
$access_readers_blocked$;

revoke all on function public.readers_blocked(uuid, uuid) from public;
grant execute on function public.readers_blocked(uuid, uuid) to authenticated;`,
  'readers_blocked'
);

/* message immutable */
replaceBlock(
  /create\s+or\s+replace\s+function\s+public\.reader_message_immutable\s*\(\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.reader_message_immutable()
returns trigger
language plpgsql
set search_path = ''
as $reader_message_immutable$
begin
  if new.id is distinct from old.id
     or new.conversation_id is distinct from old.conversation_id
     or new.sender_id is distinct from old.sender_id
     or new.created_at is distinct from old.created_at
     or new.content is distinct from old.content then
    raise exception 'Message identity and content cannot be changed';
  end if;

  if auth.uid() = old.sender_id
     and new.is_read is distinct from old.is_read then
    raise exception 'Only recipient can mark messages read';
  end if;

  return new;
end;
$reader_message_immutable$;`,
  'reader_message_immutable'
);

/* conversation immutable */
replaceBlock(
  /create\s+or\s+replace\s+function\s+public\.reader_conversation_immutable\s*\(\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.reader_conversation_immutable()
returns trigger
language plpgsql
set search_path = ''
as $reader_conversation_immutable$
begin
  if new.id is distinct from old.id
     or new.user1_id is distinct from old.user1_id
     or new.user2_id is distinct from old.user2_id then
    raise exception 'Conversation participants cannot change';
  end if;

  return new;
end;
$reader_conversation_immutable$;`,
  'reader_conversation_immutable'
);

const checks = [
  ['$access_readers_blocked$', 2],
  ['$reader_message_immutable$', 2],
  ['$reader_conversation_immutable$', 2],
];

for (const [tag, expected] of checks) {
  const count = sql.split(tag).length - 1;

  if (count !== expected) {
    throw new Error(tag + ' doğrulaması başarısız. Adet: ' + count);
  }
}

if (/search_path\s*=\s*public/i.test(sql)) {
  throw new Error('Güvensiz search_path=public hâlâ mevcut.');
}

if (/publicas/i.test(sql)) {
  throw new Error('publicas sözdizimi hatası hâlâ mevcut.');
}

if (/else\s+true/i.test(sql)) {
  throw new Error('readers_blocked içindeki else true hâlâ mevcut.');
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: access_hardening migration düzeltildi.');
console.log('Yedek:', backup);
console.log('readers_blocked: önceki güvenli davranış korundu');
console.log('reader_message_immutable: düzeltildi');
console.log('reader_conversation_immutable: publicas hatası düzeltildi');
console.log('search_path fonksiyonlarda sıkılaştırıldı');
