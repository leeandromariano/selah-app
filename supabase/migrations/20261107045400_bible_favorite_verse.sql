begin;
-- Separate from notes so existing highlights and annotations are untouched.
create table public.bible_favorite_verses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  translation text not null check (translation in ('nvt', 'ara', 'ntlh')),
  book text not null check (book ~ '^[a-z0-9-]{1,24}$'),
  chapter integer not null check (chapter between 1 and 150),
  verse_start integer not null check (verse_start between 1 and 999),
  verse_end integer not null check (verse_end between verse_start and 999),
  primary key (user_id, translation, book, chapter, verse_start, verse_end)
);
alter table public.bible_favorite_verses enable row level security;
revoke all on public.bible_favorite_verses from public, anon, authenticated, service_role;
grant select, insert, delete on public.bible_favorite_verses to authenticated;
create policy bible_favorites_select on public.bible_favorite_verses for select to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy bible_favorites_insert on public.bible_favorite_verses for insert to authenticated
  with check (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy bible_favorites_delete on public.bible_favorite_verses for delete to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());
commit;
