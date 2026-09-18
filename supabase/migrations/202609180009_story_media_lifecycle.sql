begin;

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.stories
  add column if not exists storage_path text;

update public.stories
set storage_path = split_part(image_url, '/storage/v1/object/public/story-images/', 2)
where storage_path is null
  and image_url like '%/storage/v1/object/public/story-images/%';

create index if not exists stories_expires_at_idx
  on public.stories (expires_at);

create or replace function public.get_orphan_story_storage_paths(p_limit integer default 200)
returns table (storage_path text)
language sql
stable
security invoker
set search_path = ''
as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'story-images'
    and o.created_at < now() - interval '48 hours'
    and not exists (
      select 1
      from public.stories s
      where s.storage_path = o.name
         or (
           s.storage_path is null
           and s.image_url is not null
           and s.image_url like '%/storage/v1/object/public/story-images/' || o.name
         )
    )
  order by o.created_at asc
  limit greatest(1, least(coalesce(p_limit, 200), 1000));
$$;

revoke all on function public.get_orphan_story_storage_paths(integer) from public, anon, authenticated;
grant execute on function public.get_orphan_story_storage_paths(integer) to service_role;

select cron.schedule(
  'story-media-cleanup',
  '*/15 * * * *',
  $$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/story-media-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_publishable_key'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_publishable_key')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 10000
    );
  $$
);

commit;
