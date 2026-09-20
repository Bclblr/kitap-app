drop policy if exists "private_post_media_read" on storage.objects;
create policy "private_post_media_read"
on storage.objects
as permissive
for select
to anon, authenticated
using (
  bucket_id = 'post-images'
  and public.media_owner_visible(public.storage_object_owner(name))
  and exists (
    select 1
    from public.posts p
    where p.user_id = public.storage_object_owner(storage.objects.name)
      and (
        (p.image_url is not null and position(storage.objects.name in p.image_url) > 0)
        or exists (
          select 1
          from unnest(coalesce(p.image_urls, '{}'::text[])) as image_url
          where position(storage.objects.name in image_url) > 0
        )
      )
  )
);

drop policy if exists "private_media_read_guard" on storage.objects;
create policy "private_media_read_guard"
on storage.objects
as restrictive
for select
to public
using (
  bucket_id <> all (array['post-images'::text, 'story-images'::text, 'avatars'::text, 'event-images'::text])
  or (
    bucket_id = 'post-images'
    and public.media_owner_visible(public.storage_object_owner(name))
    and exists (
      select 1
      from public.posts p
      where p.user_id = public.storage_object_owner(storage.objects.name)
        and (
          (p.image_url is not null and position(storage.objects.name in p.image_url) > 0)
          or exists (
            select 1
            from unnest(coalesce(p.image_urls, '{}'::text[])) as image_url
            where position(storage.objects.name in image_url) > 0
          )
        )
    )
  )
  or (
    bucket_id = 'story-images'
    and public.media_owner_visible(public.storage_object_owner(name))
    and (
      auth.uid() = public.storage_object_owner(name)
      or exists (
        select 1
        from public.stories s
        where s.user_id = public.storage_object_owner(storage.objects.name)
          and s.expires_at > now()
          and s.image_url is not null
          and position(storage.objects.name in s.image_url) > 0
      )
    )
  )
  or (
    bucket_id = 'avatars'
    and public.media_owner_visible(public.storage_object_owner(name))
  )
  or (
    bucket_id = 'event-images'
    and (
      auth.uid() = public.storage_object_owner(name)
      or exists (
        select 1
        from public.events e
        where e.image_url is not null
          and position(storage.objects.name in e.image_url) > 0
      )
    )
  )
);
