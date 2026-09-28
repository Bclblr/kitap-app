alter table public.stories
  add column if not exists text_color text not null default '#FFFFFF',
  add column if not exists text_align text not null default 'center',
  add column if not exists text_background boolean not null default false,
  add column if not exists text_style text not null default 'classic';

alter table public.stories drop constraint if exists stories_text_align_check;
alter table public.stories add constraint stories_text_align_check
  check (text_align in ('left','center','right'));

alter table public.stories drop constraint if exists stories_text_style_check;
alter table public.stories add constraint stories_text_style_check
  check (text_style in ('classic','strong'));
