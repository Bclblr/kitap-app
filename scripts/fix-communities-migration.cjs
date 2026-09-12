const fs = require('fs');

const file = 'supabase/migrations/202609050002_communities.sql';
const backup = file + '.before-gpt-fix.bak';

let sql = fs.readFileSync(file, 'utf8');
fs.copyFileSync(file, backup);

function replaceFunction(regex, replacement, name) {
  if (!regex.test(sql)) {
    throw new Error(name + ' fonksiyonu bulunamadı. Dosya değiştirilmedi.');
  }
  sql = sql.replace(regex, () => replacement);
}

replaceFunction(
  /create\s+or\s+replace\s+function\s+public\.community_access\s*\(\s*cid\s+uuid\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.community_access(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $community_access$
  select exists (
    select 1
    from public.communities c
    where c.id = cid
      and (
        c.visibility = 'public'
        or c.created_by = auth.uid()
        or exists (
          select 1
          from public.community_members m
          where m.community_id = cid
            and m.user_id = auth.uid()
        )
      )
  );
$community_access$;`,
  'community_access'
);

replaceFunction(
  /create\s+or\s+replace\s+function\s+public\.community_admin\s*\(\s*cid\s+uuid\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.community_admin(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $community_admin$
  select
    exists (
      select 1
      from public.communities c
      where c.id = cid
        and c.created_by = auth.uid()
    )
    or exists (
      select 1
      from public.community_members m
      where m.community_id = cid
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    );
$community_admin$;`,
  'community_admin'
);

sql = sql.replace(
  /revoke\s+all\s+on\s+function\s+public\.community_access\(uuid\)\s*,\s*public\.community_admin\(uuid\)\s+from\s+public\s*;/i,
`revoke all on function public.community_access(uuid) from public;
revoke all on function public.community_admin(uuid) from public;`
);

sql = sql.replace(
  /grant\s+execute\s+on\s+function\s+public\.community_access\(uuid\)\s*,\s*public\.community_admin\(uuid\)\s+to\s+anon\s*,\s*authenticated\s*;/i,
`grant execute on function public.community_access(uuid) to anon, authenticated;
grant execute on function public.community_admin(uuid) to authenticated;`
);

replaceFunction(
  /create\s+or\s+replace\s+function\s+public\.community_owner_join\s*\(\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.community_owner_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $community_owner_join$
begin
  insert into public.community_members (
    community_id,
    user_id,
    role
  )
  values (
    new.id,
    new.created_by,
    'owner'
  );

  return new;
end;
$community_owner_join$;`,
  'community_owner_join'
);

replaceFunction(
  /create\s+or\s+replace\s+function\s+public\.community_owner_immutable\s*\(\s*\)[\s\S]*?\$\$;/i,
`create or replace function public.community_owner_immutable()
returns trigger
language plpgsql
set search_path = ''
as $community_owner_immutable$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'Community owner cannot change';
  end if;

  return new;
end;
$community_owner_immutable$;`,
  'community_owner_immutable'
);

sql = sql.replace(
  /drop trigger if exists community_owner_join on public\.communities;/i,
`revoke all on function public.community_owner_join() from public;

drop trigger if exists community_owner_join on public.communities;`
);

sql = sql.replace(
  /drop trigger if exists community_owner_immutable on public\.communities;/i,
`revoke all on function public.community_owner_immutable() from public;

drop trigger if exists community_owner_immutable on public.communities;`
);

if (/\borexists\b/i.test(sql)) {
  throw new Error('orexists hatası hâlâ mevcut.');
}

const required = [
  '$community_access$',
  '$community_admin$',
  '$community_owner_join$',
  '$community_owner_immutable$'
];

for (const tag of required) {
  const count = sql.split(tag).length - 1;
  if (count !== 2) {
    throw new Error(tag + ' dollar-quote doğrulaması başarısız. Adet: ' + count);
  }
}

fs.writeFileSync(file, sql, 'utf8');

console.log('TAMAM: communities migration düzeltildi.');
console.log('Yedek:', backup);
console.log('orexists: düzeltildi');
console.log('community_access: güvenli');
console.log('community_admin: güvenli');
console.log('community_owner_join: güvenli');
console.log('community_owner_immutable: güvenli');
