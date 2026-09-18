begin;

alter table public.stories
  drop constraint if exists stories_storage_path_owner_check;

alter table public.stories
  add constraint stories_storage_path_owner_check
  check (
    storage_path is null
    or public.storage_object_owner(storage_path) is not distinct from user_id
  );

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'story_cleanup_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'story_cleanup_secret',
      'Shared secret used only by the story-media-cleanup cron invocation.'
    );
  end if;
end
$$;

create or replace function public.validate_story_cleanup_token(p_token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_token is not null
    and length(p_token) >= 32
    and exists (
      select 1
      from vault.decrypted_secrets s
      where s.name = 'story_cleanup_secret'
        and s.decrypted_secret = p_token
    );
$$;

revoke all on function public.validate_story_cleanup_token(text) from public, anon, authenticated;
grant execute on function public.validate_story_cleanup_token(text) to service_role;

create or replace function public.get_expired_story_cleanup_candidates(
  p_cutoff timestamptz,
  p_limit integer default 200
)
returns table (
  id uuid,
  user_id uuid,
  media_path text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    s.id,
    s.user_id,
    case
      when s.storage_path is not null
       and public.storage_object_owner(s.storage_path) is not distinct from s.user_id
        then s.storage_path
      when s.storage_path is null
       and s.image_url is not null
       and s.image_url like '%/storage/v1/object/public/story-images/%'
       and public.storage_object_owner(
         nullif(
           split_part(
             split_part(
               s.image_url,
               '/storage/v1/object/public/story-images/',
               2
             ),
             '?',
             1
           ),
           ''
         )
       ) is not distinct from s.user_id
        then nullif(
          split_part(
            split_part(
              s.image_url,
              '/storage/v1/object/public/story-images/',
              2
            ),
            '?',
            1
          ),
          ''
        )
      else null
    end as media_path
  from public.stories s
  where s.expires_at <= p_cutoff
  order by s.expires_at asc
  limit greatest(1, least(coalesce(p_limit, 200), 200));
$$;

revoke all on function public.get_expired_story_cleanup_candidates(timestamptz, integer)
from public, anon, authenticated;
grant execute on function public.get_expired_story_cleanup_candidates(timestamptz, integer)
to service_role;

do $$
declare
  v_jobid bigint;
begin
  select jobid
  into v_jobid
  from cron.job
  where jobname = 'story-media-cleanup'
  order by jobid desc
  limit 1;

  if v_jobid is not null then
    perform cron.unschedule(v_jobid);
  end if;
end
$$;

select cron.schedule(
  'story-media-cleanup',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/story-media-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_publishable_key'),
        'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_publishable_key'),
        'X-Story-Cleanup-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'story_cleanup_secret')
      ),
      body := jsonb_build_object('scheduled_at', now()),
      timeout_milliseconds := 10000
    );
  $cron$
);

commit;
