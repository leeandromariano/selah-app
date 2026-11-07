begin;

-- Personal notes and verse identifiers only: Bible text is never stored here.
create table public.bible_personal_annotations (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  translation text not null check (translation in ('nvt', 'ara', 'ntlh')),
  book text not null check (book ~ '^[a-z0-9-]{1,24}$'),
  chapter integer not null check (chapter between 1 and 150),
  verse_start integer not null check (verse_start between 1 and 999),
  verse_end integer not null check (verse_end between verse_start and 999),
  color text check (color in ('yellow', 'blue', 'pink')),
  note text not null default '' check (char_length(note) <= 3000),
  primary key (user_id, translation, book, chapter, verse_start, verse_end),
  check (color is not null or length(btrim(note)) > 0)
);

alter table public.bible_personal_annotations enable row level security;
revoke all on public.bible_personal_annotations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.bible_personal_annotations to authenticated;
create policy bible_annotations_select on public.bible_personal_annotations for select to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy bible_annotations_insert on public.bible_personal_annotations for insert to authenticated
  with check (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy bible_annotations_update on public.bible_personal_annotations for update to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending())
  with check (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy bible_annotations_delete on public.bible_personal_annotations for delete to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());

commit;
