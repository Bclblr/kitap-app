begin;

-- Private media buckets. Existing objects are preserved; changing public=false
-- prevents direct unauthenticated URL access while signed URLs continue to work.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('post-images', 'post-images', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('story-images', 'story-images', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('avatars', 'avatars', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('event-images', 'event-images', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage object paths are always scoped as <owner_uuid>/<filename>.
create or replace function public.storage_object_owner(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_owner text;
begin
  v_owner := (storage.foldername(p_name))[1];

  if v_owner is null
     or v_owner !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return v_owner::uuid;
exception
  when others then
    return null;
end;
$$;

revoke all on function public.storage_object_owner(text) from public;
grant execute on function public.storage_object_owner(text) to anon, authenticated;

-- Central visibility rule shared by private profile media, posts and stories.
-- Owners always see their own media. Block relationships deny access in either
-- direction. Public accounts are visible to everyone; private accounts only to
-- accepted followers.
create or replace function public.media_owner_visible(p_owner uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer uuid := auth.uid();
  v_private boolean := false;
begin
  if p_owner is null then
    return false;
  end if;

  if v_viewer = p_owner then
    return true;
  end if;

  if v_viewer is not null
     and exists (
       select 1
       from public.user_blocks b
       where
         (b.blocker_id = v_viewer and b.blocked_id = p_owner)
         or
         (b.blocker_id = p_owner and b.blocked_id = v_viewer)
     ) then
    return false;
  end if;

  select coalesce(s.is_private, false)
  into v_private
  from public.profile_privacy_settings s
  where s.user_id = p_owner;

  v_private := coalesce(v_private, false);

  if not v_private then
    return true;
  end if;

  if v_viewer is null then
    return false;
  end if;

  return exists (
    select 1
    from public.follows f
    where f.follower_id = v_viewer
      and f.following_id = p_owner
  );
end;
$$;

revoke all on function public.media_owner_visible(uuid) from public;
grant execute on function public.media_owner_visible(uuid) to anon, authenticated;

-- Remove legacy permissive policies with common names if they exist.
drop policy if exists "Public Access" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01k_0" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01k_1" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01k_2" on storage.objects;
drop policy if exists post_images_public_read on storage.objects;
drop policy if exists story_images_public_read on storage.objects;
drop policy if exists avatars_public_read on storage.objects;
drop policy if exists event_images_public_read on storage.objects;

-- Post media: object must still be referenced by a post, and profile visibility
-- plus blocking rules must permit the requester.
drop policy if exists private_post_media_read on storage.objects;
create policy private_post_media_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'post-images'
  and public.media_owner_visible(public.storage_object_owner(name))
  and exists (
    select 1
    from public.posts p
    where p.user_id = public.storage_object_owner(name)
      and p.image_url is not null
      and position(name in p.image_url) > 0
  )
);

-- Story media additionally expires with the story row.
drop policy if exists private_story_media_read on storage.objects;
create policy private_story_media_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'story-images'
  and public.media_owner_visible(public.storage_object_owner(name))
  and (
    auth.uid() = public.storage_object_owner(name)
    or exists (
      select 1
      from public.stories s
      where s.user_id = public.storage_object_owner(name)
        and s.expires_at > now()
        and s.image_url is not null
        and position(name in s.image_url) > 0
    )
  )
);

-- Profile/cover media follows the same private-account and block rules.
drop policy if exists private_avatar_media_read on storage.objects;
create policy private_avatar_media_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'avatars'
  and public.media_owner_visible(public.storage_object_owner(name))
);

-- Events are currently public content. Only referenced event images are readable;
-- the uploader may also preview the object before the event row is inserted.
drop policy if exists private_event_media_read on storage.objects;
create policy private_event_media_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'event-images'
  and (
    auth.uid() = public.storage_object_owner(name)
    or exists (
      select 1
      from public.events e
      where e.image_url is not null
        and position(name in e.image_url) > 0
    )
  )
);

-- Uploads are always restricted to the authenticated user's UUID folder.
drop policy if exists private_media_insert on storage.objects;
create policy private_media_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('post-images','story-images','avatars','event-images')
  and public.storage_object_owner(name) = auth.uid()
);

drop policy if exists private_media_update on storage.objects;
create policy private_media_update
on storage.objects
for update
to authenticated
using (
  bucket_id in ('post-images','story-images','avatars','event-images')
  and public.storage_object_owner(name) = auth.uid()
)
with check (
  bucket_id in ('post-images','story-images','avatars','event-images')
  and public.storage_object_owner(name) = auth.uid()
);

drop policy if exists private_media_delete on storage.objects;
create policy private_media_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('post-images','story-images','avatars','event-images')
  and public.storage_object_owner(name) = auth.uid()
);

commit;
