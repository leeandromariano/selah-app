begin;

-- Existing editorial text is preserved; new API selections store only references.
alter table public.devotionals add column bible_selection jsonb;
alter table public.devotionals alter column bible_text drop not null;

create function private.valid_devotional_bible_selection(value jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare chapter_number integer; first_verse integer; last_verse integer;
begin
  if value is null or jsonb_typeof(value) <> 'object'
     or coalesce(value->>'translation', '') not in ('nvt', 'ara', 'ntlh')
     or coalesce(value->>'book', '') !~ '^[a-z0-9-]{1,24}$'
     or coalesce(value->>'chapter', '') !~ '^[1-9][0-9]{0,2}$'
     or coalesce(value->>'verse', '') !~ '^[1-9][0-9]{0,2}$'
     or coalesce(value->>'endVerse', '') !~ '^[1-9][0-9]{0,2}$' then
    return false;
  end if;
  chapter_number := (value->>'chapter')::integer;
  first_verse := (value->>'verse')::integer;
  last_verse := (value->>'endVerse')::integer;
  return chapter_number <= 150 and last_verse >= first_verse and last_verse <= 999
    and value = jsonb_build_object('translation', value->>'translation', 'book', value->>'book', 'chapter', chapter_number, 'verse', first_verse, 'endVerse', last_verse);
end;
$$;
revoke all on function private.valid_devotional_bible_selection(jsonb) from public, anon, authenticated, service_role;
grant execute on function private.valid_devotional_bible_selection(jsonb) to authenticated;
alter table public.devotionals add constraint devotionals_bible_selection_valid
  check ((bible_selection is null and bible_text is not null and length(btrim(bible_text)) > 0)
      or (bible_selection is not null and bible_text is null and private.valid_devotional_bible_selection(bible_selection)));
grant insert (bible_selection), update (bible_selection) on public.devotionals to authenticated;

create or replace function private.advance_reading_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.reading_revision := 1;
  elsif row(new.title, new.bible_reference, new.bible_text, new.bible_selection, new.content, new.reflection_question, new.status, new.publish_at)
    is distinct from row(old.title, old.bible_reference, old.bible_text, old.bible_selection, old.content, old.reflection_question, old.status, old.publish_at) then
    new.reading_revision := old.reading_revision + 1;
  else new.reading_revision := old.reading_revision;
  end if;
  return new;
end;
$$;

create or replace function public.submit_devotional_for_review(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_publisher() then raise exception 'Publisher required' using errcode = '42501'; end if;
  update public.devotionals set review_requested_at = clock_timestamp()
    where id = p_id and author_id = (select auth.uid()) and status = 'draft' and publish_at is null
      and review_requested_at is null and author_name is not null
      and char_length(btrim(author_name)) between 2 and 120
      and char_length(btrim(title)) > 0 and char_length(btrim(bible_reference)) > 0
      and (char_length(btrim(bible_text)) > 0 or private.valid_devotional_bible_selection(bible_selection))
      and char_length(btrim(content)) > 0 and char_length(btrim(reflection_question)) > 0;
  if not found then raise exception 'Draft unavailable for submission' using errcode = '42501'; end if;
end;
$$;
commit;
