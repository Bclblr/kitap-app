alter table public.stories
  add column if not exists image_scale double precision not null default 1,
  add column if not exists image_offset_x double precision not null default 0,
  add column if not exists image_offset_y double precision not null default 0,
  add column if not exists text_offset_x double precision not null default 0,
  add column if not exists text_offset_y double precision not null default 0;

alter table public.stories drop constraint if exists stories_image_scale_check;
alter table public.stories add constraint stories_image_scale_check
  check (image_scale between 1 and 4);

alter table public.stories drop constraint if exists stories_image_offset_x_check;
alter table public.stories add constraint stories_image_offset_x_check
  check (image_offset_x between -2 and 2);

alter table public.stories drop constraint if exists stories_image_offset_y_check;
alter table public.stories add constraint stories_image_offset_y_check
  check (image_offset_y between -2 and 2);

alter table public.stories drop constraint if exists stories_text_offset_x_check;
alter table public.stories add constraint stories_text_offset_x_check
  check (text_offset_x between -0.5 and 0.5);

alter table public.stories drop constraint if exists stories_text_offset_y_check;
alter table public.stories add constraint stories_text_offset_y_check
  check (text_offset_y between -0.5 and 0.5);
