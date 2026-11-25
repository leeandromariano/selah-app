begin;

-- Optional for existing publications. The authored phrase is public content,
-- never a copy of the licensed Bible text selected for the devotional.
alter table public.devotionals
  add column share_phrase text
  constraint devotionals_share_phrase_length
  check (share_phrase is null or
    (char_length(btrim(share_phrase)) between 1 and 180
      and share_phrase !~ '[\x00-\x1F\x7F]'));

grant insert (share_phrase), update (share_phrase)
  on public.devotionals to authenticated;

create or replace function private.advance_reading_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.reading_revision := 1;
  elsif row(new.title, new.share_phrase, new.bible_reference, new.bible_text,
            new.bible_selection, new.content, new.reflection_question,
            new.practical_challenge, new.prayer_prompt, new.status, new.publish_at)
    is distinct from row(old.title, old.share_phrase, old.bible_reference,
            old.bible_text, old.bible_selection, old.content,
            old.reflection_question, old.practical_challenge,
            old.prayer_prompt, old.status, old.publish_at) then
    new.reading_revision := old.reading_revision + 1;
  else new.reading_revision := old.reading_revision;
  end if;
  return new;
end;
$$;

commit;
