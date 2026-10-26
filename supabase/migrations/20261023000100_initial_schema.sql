begin;

-- API roles may use explicitly granted objects, never create API objects.
revoke create on schema public from public, anon, authenticated;
grant usage on schema public to anon, authenticated;

-- Not exposed through the Data API. Membership is managed only by trusted SQL.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table private.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table private.admin_users enable row level security;
revoke all on private.admin_users from public, anon, authenticated;

create function private.is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from private.admin_users where user_id = (select auth.uid())); $$;
alter function private.is_admin() owner to postgres;
revoke all on function private.is_admin() from public, anon, authenticated;
grant execute on function private.is_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 150),
  phone text check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  age_range text check (age_range in ('under_18', '18_24', '25_34', '35_44', '45_59', '60_plus')),
  instagram text check (instagram ~ '^@?[A-Za-z0-9._]{1,30}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devotionals (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 200),
  bible_reference text not null check (char_length(trim(bible_reference)) between 1 and 200),
  bible_text text not null check (length(trim(bible_text)) > 0),
  content text not null check (length(trim(content)) > 0),
  reflection_question text not null check (length(trim(reflection_question)) > 0),
  publish_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'published')),
  author_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or publish_at is not null)
);

create table public.devotional_views (
  id uuid primary key default gen_random_uuid(),
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opened_at timestamptz not null default now()
);

-- Published versions are immutable to API clients, including administrators.
create table public.privacy_notice_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique check (char_length(trim(version)) between 1 and 50),
  content text not null check (length(trim(content)) > 0),
  published_at timestamptz not null default now()
);
create table public.privacy_acknowledgements (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  notice_id uuid not null references public.privacy_notice_versions(id) on delete restrict,
  acknowledged_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

create index devotionals_publication_idx on public.devotionals (publish_at desc) where status = 'published';
create index devotionals_author_idx on public.devotionals (author_id);
create index devotional_views_metrics_idx on public.devotional_views (devotional_id, user_id);
create index devotional_views_user_idx on public.devotional_views (user_id, opened_at desc);
create index privacy_acknowledgements_notice_idx on public.privacy_acknowledgements (notice_id);

create function private.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.set_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
for each row execute function private.set_updated_at();
create trigger devotionals_updated_at before update on public.devotionals
for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;
alter table public.devotionals enable row level security;
alter table public.devotional_views enable row level security;
alter table public.privacy_notice_versions enable row level security;
alter table public.privacy_acknowledgements enable row level security;

-- Explicit privileges also constrain client-supplied IDs and timestamps.
revoke all on public.profiles, public.devotionals, public.devotional_views,
  public.privacy_notice_versions, public.privacy_acknowledgements from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant insert (id, name, phone, age_range, instagram) on public.profiles to authenticated;
grant update (name, phone, age_range, instagram) on public.profiles to authenticated;
grant select, delete on public.devotionals to authenticated;
grant insert (title, bible_reference, bible_text, content, reflection_question, publish_at, status, author_id)
  on public.devotionals to authenticated;
grant update (title, bible_reference, bible_text, content, reflection_question, publish_at, status)
  on public.devotionals to authenticated;
grant select on public.devotional_views to authenticated;
grant insert (devotional_id) on public.devotional_views to authenticated;
grant select on public.privacy_notice_versions to anon, authenticated;
grant select on public.privacy_acknowledgements to authenticated;
grant insert (notice_id) on public.privacy_acknowledgements to authenticated;

create policy profiles_read_own on public.profiles for select to authenticated
using (id = (select auth.uid()));
create policy profiles_insert_own on public.profiles for insert to authenticated
with check (id = (select auth.uid()));
create policy profiles_update_own on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy devotionals_read on public.devotionals for select to authenticated
using (private.is_admin() or (status = 'published' and publish_at <= now()));
create policy devotionals_admin_insert on public.devotionals for insert to authenticated
with check (private.is_admin() and author_id = (select auth.uid()));
create policy devotionals_admin_update on public.devotionals for update to authenticated
using (private.is_admin()) with check (private.is_admin());
create policy devotionals_admin_delete on public.devotionals for delete to authenticated
using (private.is_admin());

create policy views_read_own on public.devotional_views for select to authenticated
using (user_id = (select auth.uid()));
create policy views_insert_own_published on public.devotional_views for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.devotionals d where d.id = devotional_id
    and d.status = 'published' and d.publish_at <= now()
));
create policy notices_read_published on public.privacy_notice_versions for select to anon, authenticated
using (published_at <= now());
create policy acknowledgements_read_own on public.privacy_acknowledgements for select to authenticated
using (user_id = (select auth.uid()));
create policy acknowledgements_insert_own on public.privacy_acknowledgements for insert to authenticated
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.privacy_notice_versions n where n.id = notice_id and n.published_at <= now()
));

-- Deliberate privileged aggregation: never return user IDs or individual events.
create function public.devotional_open_counts()
returns table (devotional_id uuid, total_opens bigint, unique_readers bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
    select d.id, count(v.id), count(distinct v.user_id)
    from public.devotionals d left join public.devotional_views v on v.devotional_id = d.id
    group by d.id;
end;
$$;
revoke all on function public.devotional_open_counts() from public, anon, authenticated;
alter function public.devotional_open_counts() owner to postgres;
grant execute on function public.devotional_open_counts() to authenticated;

commit;
