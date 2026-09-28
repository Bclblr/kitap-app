create table if not exists public.academic_search_cache (
  cache_key text primary key,
  entity_type text not null check (entity_type in ('works','theses','authors','journals','institutions')),
  query_text text not null,
  result_limit integer not null default 24 check (result_limit between 1 and 50),
  results jsonb not null default '[]'::jsonb,
  result_count integer not null default 0,
  expires_at timestamptz not null,
  hit_count bigint not null default 0,
  last_accessed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academic_search_cache enable row level security;

revoke all on table public.academic_search_cache from anon, authenticated;
grant select, insert, update, delete on table public.academic_search_cache to service_role;

create index if not exists academic_search_cache_expires_at_idx
  on public.academic_search_cache (expires_at);

create index if not exists academic_search_cache_lookup_idx
  on public.academic_search_cache (entity_type, query_text, result_limit);
