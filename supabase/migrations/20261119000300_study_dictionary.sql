-- Raio-X do Texto: "Dicionário de teologia". Cada termo ganha um verbete opcional (definição teológica mais longa),
-- mostrado na gaveta/aba do Raio-X. Sem verbete, nada muda para o leitor. Mesmo padrão: tudo por funções security definer.

alter table public.study_terms
  add column dictionary text check (dictionary is null or char_length(btrim(dictionary)) between 1 and 1500);

-- Leitor: passa a devolver o verbete (nulo quando não existe).
create or replace function public.get_study_terms(p_book text, p_chapter integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_book is null or p_book !~ '^[a-z0-9-]{2,30}$' or p_chapter is null or p_chapter not between 1 and 150 then
    raise exception 'Invalid chapter' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'term', t.term, 'words', to_jsonb(t.words), 'original', t.original, 'context', t.context,
      'parallel_reference', t.parallel_reference, 'dictionary', t.dictionary,
      'verses', (select jsonb_agg(jsonb_build_object('start', v.verse_start, 'end', v.verse_end) order by v.verse_start)
                 from public.study_term_verses v where v.term_id = t.id and v.book = p_book and v.chapter = p_chapter)
    ) order by t.term)
    from public.study_terms t
    where t.status = 'published'
      and exists (select 1 from public.study_term_verses v where v.term_id = t.id and v.book = p_book and v.chapter = p_chapter)
  ), '[]'::jsonb);
end $$;

create or replace function public.owner_list_study_terms() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'term', t.term, 'words', to_jsonb(t.words), 'original', t.original, 'context', t.context,
      'parallel_reference', t.parallel_reference, 'dictionary', t.dictionary, 'status', t.status,
      'verses', coalesce((select jsonb_agg(jsonb_build_object('book', v.book, 'chapter', v.chapter, 'start', v.verse_start, 'end', v.verse_end)
                          order by v.book, v.chapter, v.verse_start) from public.study_term_verses v where v.term_id = t.id), '[]'::jsonb)
    ) order by t.term)
    from public.study_terms t
  ), '[]'::jsonb);
end $$;

-- Salvar ganha p_dictionary: nulo MANTÉM o verbete atual; texto vazio APAGA; texto grava. Assim um cliente antigo nunca apaga sem querer.
drop function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb);
create function public.owner_save_study_term(
  p_id uuid, p_term text, p_words text[], p_original text, p_context text, p_parallel text, p_status text, p_verses jsonb,
  p_dictionary text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_clean text[]; item jsonb; v_dict text := nullif(btrim(coalesce(p_dictionary, '')), '');
begin
  perform private.owner_identity();
  if p_status is null or p_status not in ('draft', 'published') then raise exception 'Invalid status' using errcode = '22023'; end if;
  select coalesce(array_agg(w), '{}') into v_clean from (select distinct btrim(w) as w from unnest(coalesce(p_words, '{}')) w where char_length(btrim(w)) between 1 and 40) s;
  if p_term is null or cardinality(v_clean) = 0 or jsonb_typeof(p_verses) is distinct from 'array' or jsonb_array_length(p_verses) = 0 or jsonb_array_length(p_verses) > 60 then
    raise exception 'Invalid study term' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.study_terms(term, words, original, context, parallel_reference, status, dictionary)
    values (btrim(p_term), v_clean, btrim(p_original), btrim(p_context), btrim(p_parallel), p_status, v_dict) returning id into v_id;
  else
    update public.study_terms set term = btrim(p_term), words = v_clean, original = btrim(p_original), context = btrim(p_context),
      parallel_reference = btrim(p_parallel), status = p_status, updated_at = clock_timestamp(),
      dictionary = case when p_dictionary is null then dictionary else v_dict end
    where id = p_id returning id into v_id;
    if v_id is null then raise exception 'Study term not found' using errcode = '42501'; end if;
    delete from public.study_term_verses where term_id = v_id;
  end if;
  for item in select * from jsonb_array_elements(p_verses) loop
    insert into public.study_term_verses(term_id, book, chapter, verse_start, verse_end)
    values (v_id, item->>'book', (item->>'chapter')::integer, (item->>'start')::integer, coalesce((item->>'end')::integer, (item->>'start')::integer))
    on conflict do nothing;
  end loop;
  return v_id;
end $$;
alter function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb, text) owner to postgres;
revoke all on function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb, text) from public, anon, authenticated, service_role;
grant execute on function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb, text) to authenticated;

-- OWNER: preenche verbetes em lote pelo nome do termo, sem tocar no resto. p_entries: [{term, dictionary}].
-- Devolve {updated: n, missing: ["termo sem cadastro", ...]}. Texto vazio apaga o verbete.
create function public.owner_set_study_dictionary(p_entries jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare item jsonb; v_text text; v_id uuid; v_updated integer := 0; v_missing jsonb := '[]'::jsonb;
begin
  perform private.owner_identity();
  if jsonb_typeof(p_entries) is distinct from 'array' or jsonb_array_length(p_entries) = 0 or jsonb_array_length(p_entries) > 300 then
    raise exception 'Invalid dictionary entries' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_entries) loop
    v_text := nullif(btrim(coalesce(item->>'dictionary', '')), '');
    if v_text is not null and char_length(v_text) > 1500 then raise exception 'Dictionary entry too long' using errcode = '22023'; end if;
    select id into v_id from public.study_terms where lower(btrim(term)) = lower(btrim(coalesce(item->>'term', ''))) limit 1;
    if v_id is null then
      v_missing := v_missing || to_jsonb(coalesce(item->>'term', ''));
    else
      update public.study_terms set dictionary = v_text, updated_at = clock_timestamp() where id = v_id;
      v_updated := v_updated + 1;
    end if;
  end loop;
  return jsonb_build_object('updated', v_updated, 'missing', v_missing);
end $$;
alter function public.owner_set_study_dictionary(jsonb) owner to postgres;
revoke all on function public.owner_set_study_dictionary(jsonb) from public, anon, authenticated, service_role;
grant execute on function public.owner_set_study_dictionary(jsonb) to authenticated;
