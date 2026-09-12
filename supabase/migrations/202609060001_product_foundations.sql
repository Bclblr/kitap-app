begin;
alter table public.works add column if not exists language text not null default 'tr';
alter table public.works add column if not exists audience text not null default 'general';
alter table public.works add column if not exists completed boolean not null default false;
-- Keep the established draft/published access model; completion is independent metadata.
create table if not exists public.reader_suggestion_feedback (
 user_id uuid not null references auth.users(id) on delete cascade,
 candidate_id uuid not null references auth.users(id) on delete cascade,
 reason text not null default 'dismissed', hidden_until timestamptz not null default now()+interval '14 days',
 created_at timestamptz not null default now(), primary key(user_id,candidate_id), check(user_id<>candidate_id)
);
alter table public.reader_suggestion_feedback enable row level security;
drop policy if exists suggestion_feedback_owner on public.reader_suggestion_feedback;
create policy suggestion_feedback_owner on public.reader_suggestion_feedback for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant select,insert,update,delete on public.reader_suggestion_feedback to authenticated;
create table if not exists public.saved_works (
 user_id uuid not null references auth.users(id) on delete cascade,
 work_id uuid not null references public.works(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(user_id,work_id)
);
alter table public.saved_works enable row level security;
drop policy if exists saved_works_owner on public.saved_works;
create policy saved_works_owner on public.saved_works for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid() and exists(select 1 from public.works w where w.id=work_id));
grant select,insert,delete on public.saved_works to authenticated;

-- Reject temporary or non-HTTPS image values only when a field is inserted/changed.
-- Existing legacy rows remain untouched and unrelated updates keep working.
create or replace function public.require_permanent_images() returns trigger language plpgsql set search_path='' as $images$
declare field_name text; value text; begin
 foreach field_name in array TG_ARGV loop
  value := to_jsonb(new)->>field_name;
  if TG_OP='UPDATE' and value is not distinct from (to_jsonb(old)->>field_name) then continue; end if;
  if value is not null and value<>'' and (value !~ '^https://[^/@[:space:]]+(/|$)' or value ~ '^https://[^/]*@') then
   raise exception 'Only permanent HTTPS image URLs are allowed' using errcode='23514';
  end if;
 end loop;
 return new;
end;
$images$;
do $guards$ declare target record; args text; begin
 for target in select * from (values
  ('posts',array['image_url']),('stories',array['image_url']),('profiles',array['profile_image','cover_image']),
  ('works',array['cover_url']),('communities',array['image_url']),('events',array['image_url'])
 ) as targets(table_name,columns) loop
  select string_agg(quote_literal(c.column_name),',') into args from information_schema.columns c
   where c.table_schema='public' and c.table_name=target.table_name and c.column_name=any(target.columns);
  if args is not null then
   execute format('drop trigger if exists permanent_image_guard on public.%I',target.table_name);
   execute format('create trigger permanent_image_guard before insert or update on public.%I for each row execute function public.require_permanent_images(%s)',target.table_name,args);
  end if;
 end loop;
end;
$guards$;

-- Private covers: only the author can view drafts; published work covers can be signed by readers.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('work-covers','work-covers',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
do $bucket$ begin
 if exists(select 1 from storage.buckets where id='work-covers' and public) then
  raise exception 'work-covers must be private; review existing bucket before applying migration';
 end if;
end;
$bucket$;
drop policy if exists work_cover_insert on storage.objects;
create policy work_cover_insert on storage.objects for insert to authenticated with check(bucket_id='work-covers' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists work_cover_read on storage.objects;
create policy work_cover_read on storage.objects for select to authenticated using(bucket_id='work-covers' and (
 (storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.works w where w.status='published' and w.author_id::text=(storage.foldername(name))[1] and split_part(w.cover_url,'/object/authenticated/work-covers/',2)=name)
));
-- UI removes/replaces the reference; orphan cleanup is left to a server retention job.
-- Restrictive guards also protect covers from older permissive storage policies.
drop policy if exists work_cover_read_guard on storage.objects;
create policy work_cover_read_guard on storage.objects as restrictive for select to public using(bucket_id<>'work-covers' or (
 auth.uid() is not null and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.works w where w.status='published' and w.author_id::text=(storage.foldername(name))[1] and split_part(w.cover_url,'/object/authenticated/work-covers/',2)=name))
));
drop policy if exists work_cover_insert_guard on storage.objects;
create policy work_cover_insert_guard on storage.objects as restrictive for insert to public with check(bucket_id<>'work-covers' or (auth.uid() is not null and (storage.foldername(name))[1]=auth.uid()::text));
drop policy if exists work_cover_update_guard on storage.objects;
create policy work_cover_update_guard on storage.objects as restrictive for update to public using(bucket_id<>'work-covers') with check(bucket_id<>'work-covers');
drop policy if exists work_cover_delete_guard on storage.objects;
create policy work_cover_delete_guard on storage.objects as restrictive for delete to public using(bucket_id<>'work-covers');
-- Only aggregate counts cross saved_works owner RLS. Never expose saver identities.
create or replace function public.work_popularity(genre_filter text default '') returns table(work_id uuid, saves bigint)
language sql stable security definer set search_path='' as $popularity$
 select w.id,count(s.user_id) from public.works w left join public.saved_works s on s.work_id=w.id
 where auth.uid() is not null and w.status='published' and (genre_filter='' or strpos(lower(coalesce(w.genre,'')),lower(left(genre_filter,100)))>0)
 group by w.id order by count(s.user_id) desc,w.published_at desc nulls last,w.id limit 50;
$popularity$;
revoke all on function public.work_popularity(text) from public,anon;
grant execute on function public.work_popularity(text) to authenticated;
-- Atomic reordering under author RLS; no SECURITY DEFINER needed.
create or replace function public.swap_work_chapters(first_id uuid, second_id uuid) returns setof public.work_chapters
language plpgsql security invoker set search_path='' as $reorder$
declare wid uuid; first_position integer; second_position integer; temporary_position integer;
begin
 select c.work_id into wid from public.work_chapters c where c.id=first_id;
 perform 1 from public.works w where w.id=wid and w.author_id=auth.uid() for update;
 if not found or first_id=second_id then raise exception 'Chapter edit not allowed' using errcode='42501'; end if;
 select c.position into first_position from public.work_chapters c where c.id=first_id and c.work_id=wid for update;
 select c.position into second_position from public.work_chapters c where c.id=second_id and c.work_id=wid for update;
 if first_position is null or second_position is null then raise exception 'Chapters must belong to the same work'; end if;
 select max(c.position)+1 into temporary_position from public.work_chapters c where c.work_id=wid;
 update public.work_chapters set position=temporary_position where id=first_id;
 update public.work_chapters set position=first_position where id=second_id;
 update public.work_chapters set position=second_position where id=first_id;
 return query select c.* from public.work_chapters c where c.work_id=wid order by c.position;
end;
$reorder$;
revoke all on function public.swap_work_chapters(uuid,uuid) from public,anon;
grant execute on function public.swap_work_chapters(uuid,uuid) to authenticated;
commit;
