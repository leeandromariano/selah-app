begin;

-- Authored steps are optional for existing publications. New editorial UI
-- requires both when the guided experience is enabled.
alter table public.devotionals
  add column practical_challenge text,
  add column prayer_prompt text;
alter table public.devotionals add constraint devotionals_guided_steps_pair
  check ((practical_challenge is null and prayer_prompt is null)
    or (practical_challenge is not null and prayer_prompt is not null
      and char_length(btrim(practical_challenge)) between 1 and 500
      and char_length(btrim(prayer_prompt)) between 1 and 500));
grant insert (practical_challenge, prayer_prompt), update (practical_challenge, prayer_prompt)
  on public.devotionals to authenticated;

create or replace function private.advance_reading_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.reading_revision := 1;
  elsif row(new.title, new.bible_reference, new.bible_text, new.bible_selection,
            new.content, new.reflection_question, new.practical_challenge,
            new.prayer_prompt, new.status, new.publish_at)
    is distinct from row(old.title, old.bible_reference, old.bible_text,
            old.bible_selection, old.content, old.reflection_question,
            old.practical_challenge, old.prayer_prompt, old.status, old.publish_at) then
    new.reading_revision := old.reading_revision + 1;
  else new.reading_revision := old.reading_revision;
  end if;
  return new;
end;
$$;

-- A personal response is never part of the moderated public discussion.
-- Preserve it after an editorial deletion, as completion history already does.
create table public.devotional_private_responses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_devotional_id uuid not null,
  devotional_id uuid references public.devotionals(id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 500
    and body !~ '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]'),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, source_devotional_id),
  check (devotional_id is null or devotional_id = source_devotional_id)
);
create index devotional_private_responses_history
  on public.devotional_private_responses (user_id, updated_at desc);
alter table public.devotional_private_responses enable row level security;
revoke all on public.devotional_private_responses from public, anon, authenticated, service_role;
grant select, delete on public.devotional_private_responses to authenticated;
grant insert (source_devotional_id, devotional_id, body) on public.devotional_private_responses to authenticated;
grant update (body) on public.devotional_private_responses to authenticated;

create policy devotional_private_responses_select on public.devotional_private_responses
  for select to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());
create policy devotional_private_responses_insert on public.devotional_private_responses
  for insert to authenticated
  with check (user_id = (select auth.uid()) and not private.google_onboarding_pending()
    and devotional_id = source_devotional_id and exists (
      select 1 from public.devotionals d where d.id = source_devotional_id
        and d.status = 'published' and d.publish_at <= clock_timestamp()));
create policy devotional_private_responses_update on public.devotional_private_responses
  for update to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending())
  with check (user_id = (select auth.uid()) and not private.google_onboarding_pending()
    and devotional_id = source_devotional_id and exists (
      select 1 from public.devotionals d where d.id = source_devotional_id
        and d.status = 'published' and d.publish_at <= clock_timestamp()));
create policy devotional_private_responses_delete on public.devotional_private_responses
  for delete to authenticated
  using (user_id = (select auth.uid()) and not private.google_onboarding_pending());

create function private.touch_devotional_private_response() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function private.touch_devotional_private_response() from public, anon, authenticated;
create trigger devotional_private_response_updated before update on public.devotional_private_responses
  for each row execute function private.touch_devotional_private_response();

commit;
