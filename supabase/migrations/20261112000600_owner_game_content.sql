begin;

-- Edição de conteúdo pelo OWNER: perguntas e alternativas do Quiz bíblico (quiz_questions) e das frases de
-- "Quem disse isso?" (who_cards). As tabelas continuam sem acesso direto: tudo passa por funções security definer
-- que exigem o owner (private.owner_identity). Mudar as alternativas ou a resposta certa zera as respostas já dadas
-- àquela pergunta, para o ranking nunca ficar com acertos de uma versão antiga.
create function private.content_item(p_game text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_game = 'quiz' then
    return (select jsonb_build_object('game', 'quiz', 'id', q.id, 'prompt', q.prompt, 'options', q.options, 'correct_index', q.correct_index,
      'reference', q.reference, 'active', q.active, 'testament', q.testament, 'level', q.level,
      'answers_count', (select count(*) from public.quiz_answers a where a.question_id = q.id))
      from public.quiz_questions q where q.id = p_id);
  end if;
  return (select jsonb_build_object('game', 'who', 'id', c.id, 'prompt', c.quote, 'options', c.options, 'correct_index', c.correct_index,
    'reference', c.reference, 'active', c.active, 'mode', c.mode, 'context', c.context,
    'answers_count', (select count(*) from public.who_answers a where a.card_id = c.id))
    from public.who_cards c where c.id = p_id);
end $$;

create function public.owner_content_list(p_game text, p_search text default '', p_filter text default '', p_page integer default 0, p_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who') or p_page is null or p_page < 0 or p_page > 100000 or p_size is null or p_size < 1 or p_size > 50
    or length(v_search) > 60 or p_filter is null
    or (p_game = 'quiz' and p_filter not in ('', '1', '2', '3', '4')) or (p_game = 'who' and p_filter not in ('', 'base', 'profundo')) then
    raise exception 'Invalid game, filter or pagination' using errcode = '22023';
  end if;
  if p_game = 'quiz' then
    select jsonb_build_object('game', 'quiz', 'page', p_page, 'size', p_size,
      'total', (select count(*) from public.quiz_questions q where (v_search = '' or strpos(lower(q.prompt), v_search) > 0) and (p_filter = '' or q.level = p_filter::integer)),
      'items', coalesce((select jsonb_agg(private.content_item('quiz', x.id) order by x.level, x.testament, x.prompt) from (
        select q.id, q.level, q.testament, q.prompt from public.quiz_questions q
        where (v_search = '' or strpos(lower(q.prompt), v_search) > 0) and (p_filter = '' or q.level = p_filter::integer)
        order by q.level, q.testament, q.prompt limit p_size offset (p_page::bigint * p_size)) x), '[]'::jsonb)) into v_result;
  else
    select jsonb_build_object('game', 'who', 'page', p_page, 'size', p_size,
      'total', (select count(*) from public.who_cards c where (v_search = '' or strpos(lower(c.quote), v_search) > 0) and (p_filter = '' or c.mode = p_filter)),
      'items', coalesce((select jsonb_agg(private.content_item('who', x.id) order by x.mode, x.quote) from (
        select c.id, c.mode, c.quote from public.who_cards c
        where (v_search = '' or strpos(lower(c.quote), v_search) > 0) and (p_filter = '' or c.mode = p_filter)
        order by c.mode, c.quote limit p_size offset (p_page::bigint * p_size)) x), '[]'::jsonb)) into v_result;
  end if;
  return v_result;
end $$;

create function public.owner_content_save(p_game text, p_id uuid, p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_prompt text; v_reference text; v_active boolean; v_correct integer; v_options jsonb; v_id uuid := p_id;
  v_old_options jsonb; v_old_correct integer; v_reset integer := 0;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who') or p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  v_prompt := btrim(coalesce(p_data->>'prompt', ''));
  v_reference := btrim(coalesce(p_data->>'reference', ''));
  v_active := coalesce((p_data->>'active')::boolean, true);
  v_correct := (p_data->>'correct_index')::integer;
  if v_correct is null or v_correct < 0 or v_correct > 3 then raise exception 'Escolha qual alternativa é a resposta certa.' using errcode = '22023'; end if;
  if jsonb_typeof(p_data->'options') <> 'array' or jsonb_array_length(p_data->'options') <> 4
    or exists(select 1 from jsonb_array_elements(p_data->'options') o where jsonb_typeof(o) <> 'string' or length(btrim(o #>> '{}')) not between 1 and 120) then
    raise exception 'Informe exatamente 4 alternativas, com até 120 caracteres cada.' using errcode = '22023';
  end if;
  select jsonb_agg(to_jsonb(btrim(o #>> '{}')) order by ord) into v_options from jsonb_array_elements(p_data->'options') with ordinality t(o, ord);
  if (select count(distinct lower(o #>> '{}')) from jsonb_array_elements(v_options) o) <> 4 then
    raise exception 'As alternativas precisam ser diferentes entre si.' using errcode = '22023';
  end if;
  if length(v_reference) not between 3 and 60 then raise exception 'Informe a referência bíblica (por exemplo, João 3:16).' using errcode = '22023'; end if;
  if p_game = 'quiz' then
    if length(v_prompt) not between 5 and 400 then raise exception 'A pergunta precisa ter entre 5 e 400 caracteres.' using errcode = '22023'; end if;
    if p_data->>'testament' not in ('antigo', 'novo') or (p_data->>'level') !~ '^[1-4]$' then raise exception 'Escolha o testamento e o nível.' using errcode = '22023'; end if;
    if v_id is null then
      insert into public.quiz_questions (testament, level, prompt, options, correct_index, reference, active)
        values (p_data->>'testament', (p_data->>'level')::smallint, v_prompt, v_options, v_correct, v_reference, v_active) returning id into v_id;
    else
      select options, correct_index into v_old_options, v_old_correct from public.quiz_questions where id = v_id for update;
      if not found then raise exception 'Pergunta não encontrada.' using errcode = 'P0002'; end if;
      update public.quiz_questions set testament = p_data->>'testament', level = (p_data->>'level')::smallint, prompt = v_prompt, options = v_options,
        correct_index = v_correct, reference = v_reference, active = v_active where id = v_id;
      if v_old_options is distinct from v_options or v_old_correct <> v_correct then
        delete from public.quiz_answers where question_id = v_id; get diagnostics v_reset = row_count;
      end if;
    end if;
  else
    if length(v_prompt) not between 5 and 300 then raise exception 'A frase precisa ter entre 5 e 300 caracteres.' using errcode = '22023'; end if;
    if p_data->>'mode' not in ('base', 'profundo') or length(btrim(coalesce(p_data->>'context', ''))) not between 10 and 500 then
      raise exception 'Escolha o modo e escreva o contexto (de 10 a 500 caracteres).' using errcode = '22023';
    end if;
    if v_id is null then
      insert into public.who_cards (mode, quote, options, correct_index, context, reference, active)
        values (p_data->>'mode', v_prompt, v_options, v_correct, btrim(p_data->>'context'), v_reference, v_active) returning id into v_id;
    else
      select options, correct_index into v_old_options, v_old_correct from public.who_cards where id = v_id for update;
      if not found then raise exception 'Frase não encontrada.' using errcode = 'P0002'; end if;
      update public.who_cards set mode = p_data->>'mode', quote = v_prompt, options = v_options, correct_index = v_correct,
        context = btrim(p_data->>'context'), reference = v_reference, active = v_active where id = v_id;
      if v_old_options is distinct from v_options or v_old_correct <> v_correct then
        delete from public.who_answers where card_id = v_id; get diagnostics v_reset = row_count;
      end if;
    end if;
  end if;
  return jsonb_build_object('item', private.content_item(p_game, v_id), 'answers_reset', v_reset);
end $$;

create function public.owner_content_delete(p_game text, p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_removed integer := 0; v_rows integer;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who') or p_id is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  -- As respostas dos leitores a esta pergunta saem junto (on delete cascade); contamos antes só para informar.
  if p_game = 'quiz' then
    select count(*) into v_removed from public.quiz_answers where question_id = p_id;
    delete from public.quiz_questions where id = p_id;
  else
    select count(*) into v_removed from public.who_answers where card_id = p_id;
    delete from public.who_cards where id = p_id;
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
  return jsonb_build_object('deleted', true, 'answers_removed', v_removed);
end $$;

alter function private.content_item(text, uuid) owner to postgres;
alter function public.owner_content_list(text, text, text, integer, integer) owner to postgres;
alter function public.owner_content_save(text, uuid, jsonb) owner to postgres;
alter function public.owner_content_delete(text, uuid) owner to postgres;
revoke all on function private.content_item(text, uuid) from public, anon, authenticated, service_role;
revoke all on function public.owner_content_list(text, text, text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.owner_content_save(text, uuid, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.owner_content_delete(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.owner_content_list(text, text, text, integer, integer) to authenticated;
grant execute on function public.owner_content_save(text, uuid, jsonb) to authenticated;
grant execute on function public.owner_content_delete(text, uuid) to authenticated;

commit;
