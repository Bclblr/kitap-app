begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-images',
  'event-images',
  true,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists event_images_public_read on storage.objects;
create policy event_images_public_read
on storage.objects
for select
using (bucket_id = 'event-images');

drop policy if exists event_images_user_insert on storage.objects;
create policy event_images_user_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists event_images_user_update on storage.objects;
create policy event_images_user_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists event_images_user_delete on storage.objects;
create policy event_images_user_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'event-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;
