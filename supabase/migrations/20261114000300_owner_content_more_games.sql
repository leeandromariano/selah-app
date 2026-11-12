begin;

-- O editor do OWNER passa a cobrir também: Tá na Bíblia ou Tá Amarrado? (claim_cards), Linha do Tempo
-- (timeline_events) e Versículo Oculto (verse_puzzles). Mesmas garantias: só o owner, tabelas sem acesso direto,
-- e mudar o que define a resposta certa zera as respostas já dadas àquele item.
create or replace function private.content_item(p_game text, p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_game = 'quiz' then
    return (select jsonb_build_object('game', 'quiz', 'id', q.id, 'prompt', q.prompt, 'options', q.options, 'correct_index', q.correct_index,
      'reference', q.reference, 'active', q.active, 'testament', q.testament, 'level', q.level,
      'answers_count', (select count(*) from public.quiz_answers a where a.question_id = q.id))
      from public.quiz_questions q where q.id = p_id);
  elsif p_game = 'who' then
    return (select jsonb_build_object('game', 'who', 'id', c.id, 'prompt', c.quote, 'options', c.options, 'correct_index', c.correct_index,
      'reference', c.reference, 'active', c.active, 'mode', c.mode, 'context', c.context,
      'answers_count', (select count(*) from public.who_answers a where a.card_id = c.id))
      from public.who_cards c where c.id = p_id);
  elsif p_game = 'claims' then
    return (select jsonb_build_object('game', 'claims', 'id', c.id, 'prompt', c.statement, 'verdict', c.verdict, 'explanation', c.explanation,
      'reference', coalesce(c.reference, ''), 'active', c.active,
      'answers_count', (select count(*) from public.claim_answers a where a.card_id = c.id))
      from public.claim_cards c where c.id = p_id);
  elsif p_game = 'timeline' then
    return (select jsonb_build_object('game', 'timeline', 'id', e.id, 'prompt', e.title, 'era', e.era, 'position', e.position,
      'reference', e.reference, 'active', e.active,
      'answers_count', (select count(*) from public.timeline_answers a where a.event_low = e.id or a.event_high = e.id))
      from public.timeline_events e where e.id = p_id);
  end if;
  return (select jsonb_build_object('game', 'verse', 'id', v.id, 'prompt', v.reference, 'reference', v.reference, 'seq', v.seq, 'active', v.active,
    'blanks', (select jsonb_agg(jsonb_build_object('index', (b->>'index')::integer, 'answer', b->>'answer', 'prev', coalesce(b->>'prev', '')) order by (b->>'index')::integer) from jsonb_array_elements(v.blanks) b),
    'answers_count', (select count(*) from public.verse_attempts a where a.puzzle_id = v.id))
    from public.verse_puzzles v where v.id = p_id);
end $$;

create or replace function public.owner_content_list(p_game text, p_search text default '', p_filter text default '', p_page integer default 0, p_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_ids uuid[];
  v_total bigint;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who', 'claims', 'timeline', 'verse') or p_page is null or p_page < 0 or p_page > 100000 or p_size is null or p_size < 1 or p_size > 50
    or length(v_search) > 60 or p_filter is null
    or (p_game = 'quiz' and p_filter not in ('', '1', '2', '3', '4')) or (p_game = 'who' and p_filter not in ('', 'base', 'profundo'))
    or (p_game = 'claims' and p_filter not in ('', 'biblia', 'distorcida', 'invencao')) or (p_game in ('timeline', 'verse') and p_filter <> '') then
    raise exception 'Invalid game, filter or pagination' using errcode = '22023';
  end if;
  if p_game = 'quiz' then
    select count(*) into v_total from public.quiz_questions q where (v_search = '' or strpos(lower(q.prompt), v_search) > 0) and (p_filter = '' or q.level = p_filter::integer);
    select array_agg(id) into v_ids from (select q.id from public.quiz_questions q
      where (v_search = '' or strpos(lower(q.prompt), v_search) > 0) and (p_filter = '' or q.level = p_filter::integer)
      order by q.level, q.testament, q.prompt limit p_size offset (p_page::bigint * p_size)) x;
  elsif p_game = 'who' then
    select count(*) into v_total from public.who_cards c where (v_search = '' or strpos(lower(c.quote), v_search) > 0) and (p_filter = '' or c.mode = p_filter);
    select array_agg(id) into v_ids from (select c.id from public.who_cards c
      where (v_search = '' or strpos(lower(c.quote), v_search) > 0) and (p_filter = '' or c.mode = p_filter)
      order by c.mode, c.quote limit p_size offset (p_page::bigint * p_size)) x;
  elsif p_game = 'claims' then
    select count(*) into v_total from public.claim_cards c where (v_search = '' or strpos(lower(c.statement), v_search) > 0) and (p_filter = '' or c.verdict = p_filter);
    select array_agg(id) into v_ids from (select c.id from public.claim_cards c
      where (v_search = '' or strpos(lower(c.statement), v_search) > 0) and (p_filter = '' or c.verdict = p_filter)
      order by c.verdict, c.statement limit p_size offset (p_page::bigint * p_size)) x;
  elsif p_game = 'timeline' then
    select count(*) into v_total from public.timeline_events e where (v_search = '' or strpos(lower(e.title), v_search) > 0);
    select array_agg(id) into v_ids from (select e.id from public.timeline_events e
      where (v_search = '' or strpos(lower(e.title), v_search) > 0)
      order by e.position limit p_size offset (p_page::bigint * p_size)) x;
  else
    select count(*) into v_total from public.verse_puzzles v where (v_search = '' or strpos(lower(v.reference), v_search) > 0);
    select array_agg(id) into v_ids from (select v.id from public.verse_puzzles v
      where (v_search = '' or strpos(lower(v.reference), v_search) > 0)
      order by v.seq limit p_size offset (p_page::bigint * p_size)) x;
  end if;
  return jsonb_build_object('game', p_game, 'page', p_page, 'size', p_size, 'total', v_total,
    'items', coalesce((select jsonb_agg(private.content_item(p_game, u.id) order by u.ord) from unnest(v_ids) with ordinality u(id, ord)), '[]'::jsonb));
end $$;

create or replace function public.owner_content_save(p_game text, p_id uuid, p_data jsonb) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_prompt text; v_reference text; v_active boolean; v_correct integer; v_options jsonb; v_id uuid := p_id;
  v_old_options jsonb; v_old_correct integer; v_reset integer := 0;
  v_old_text text; v_position integer; v_old_position integer; v_blanks jsonb; v_old_blanks jsonb;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who', 'claims', 'timeline', 'verse') or p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Dados inválidos.' using errcode = '22023';
  end if;
  v_prompt := btrim(coalesce(p_data->>'prompt', ''));
  v_reference := btrim(coalesce(p_data->>'reference', ''));
  v_active := coalesce((p_data->>'active')::boolean, true);

  if p_game in ('quiz', 'who') then
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
  end if;

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

  elsif p_game = 'who' then
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

  elsif p_game = 'claims' then
    if length(v_prompt) not between 5 and 300 then raise exception 'A frase precisa ter entre 5 e 300 caracteres.' using errcode = '22023'; end if;
    if p_data->>'verdict' not in ('biblia', 'distorcida', 'invencao') then raise exception 'Escolha o veredito da frase.' using errcode = '22023'; end if;
    if length(btrim(coalesce(p_data->>'explanation', ''))) not between 10 and 600 then raise exception 'A explicação precisa ter entre 10 e 600 caracteres.' using errcode = '22023'; end if;
    if v_reference <> '' and length(v_reference) not between 3 and 60 then raise exception 'A referência bíblica está inválida.' using errcode = '22023'; end if;
    if v_id is null then
      insert into public.claim_cards (statement, verdict, explanation, reference, active)
        values (v_prompt, p_data->>'verdict', btrim(p_data->>'explanation'), nullif(v_reference, ''), v_active) returning id into v_id;
    else
      select verdict into v_old_text from public.claim_cards where id = v_id for update;
      if not found then raise exception 'Carta não encontrada.' using errcode = 'P0002'; end if;
      update public.claim_cards set statement = v_prompt, verdict = p_data->>'verdict', explanation = btrim(p_data->>'explanation'),
        reference = nullif(v_reference, ''), active = v_active where id = v_id;
      -- "Tá na Bíblia" x "Tá amarrado" só muda quando o veredito entra ou sai de 'biblia'.
      if (v_old_text = 'biblia') <> ((p_data->>'verdict') = 'biblia') then
        delete from public.claim_answers where card_id = v_id; get diagnostics v_reset = row_count;
      end if;
    end if;

  elsif p_game = 'timeline' then
    if length(v_prompt) not between 5 and 160 then raise exception 'O acontecimento precisa ter entre 5 e 160 caracteres.' using errcode = '22023'; end if;
    if length(btrim(coalesce(p_data->>'era', ''))) not between 3 and 60 then raise exception 'Informe a era (por exemplo, Patriarcas).' using errcode = '22023'; end if;
    if length(v_reference) not between 3 and 60 then raise exception 'Informe a referência bíblica (por exemplo, Gênesis 12:1).' using errcode = '22023'; end if;
    if (p_data->>'position') !~ '^[0-9]{1,6}$' or (p_data->>'position')::integer < 1 then raise exception 'Informe a posição na linha do tempo (1 é o mais antigo).' using errcode = '22023'; end if;
    v_position := (p_data->>'position')::integer;
    if v_id is not null then
      select position into v_old_position from public.timeline_events where id = v_id for update;
      if not found then raise exception 'Acontecimento não encontrado.' using errcode = 'P0002'; end if;
    end if;
    if v_old_position is distinct from v_position then
      -- Tira o item do caminho, abre a vaga empurrando os seguintes e só então grava a nova posição.
      if v_id is not null then update public.timeline_events set position = 3000000 where id = v_id; end if;
      if exists(select 1 from public.timeline_events where position = v_position) then
        update public.timeline_events set position = position + 1000000 where position >= v_position and position < 1000000;
        update public.timeline_events set position = position - 999999 where position >= 1000000 and position < 3000000;
      end if;
    end if;
    if v_id is null then
      insert into public.timeline_events (position, era, title, reference, active)
        values (v_position, btrim(p_data->>'era'), v_prompt, v_reference, v_active) returning id into v_id;
    else
      update public.timeline_events set position = v_position, era = btrim(p_data->>'era'), title = v_prompt, reference = v_reference, active = v_active where id = v_id;
      if v_old_position <> v_position then
        delete from public.timeline_answers where event_low = v_id or event_high = v_id; get diagnostics v_reset = row_count;
      end if;
    end if;

  else
    if length(v_reference) not between 3 and 60 then raise exception 'Informe a referência do versículo (por exemplo, João 3:16).' using errcode = '22023'; end if;
    if jsonb_typeof(p_data->'blanks') <> 'array' or jsonb_array_length(p_data->'blanks') not between 2 and 3
      or exists(select 1 from jsonb_array_elements(p_data->'blanks') b where jsonb_typeof(b) <> 'object'
        or coalesce(b->>'index', '') !~ '^[0-9]{1,3}$' or (b->>'index')::integer < 1
        or length(btrim(coalesce(b->>'answer', ''))) not between 1 and 40 or private.verse_norm(b->>'answer') = ''
        or length(coalesce(b->>'prev', '')) > 40)
      or (select count(distinct (b->>'index')::integer) from jsonb_array_elements(p_data->'blanks') b) <> jsonb_array_length(p_data->'blanks') then
      raise exception 'Escolha 2 ou 3 palavras diferentes do versículo para esconder.' using errcode = '22023';
    end if;
    select jsonb_agg(jsonb_build_object('index', (b->>'index')::integer, 'answer', btrim(b->>'answer'), 'prev', btrim(coalesce(b->>'prev', ''))) order by (b->>'index')::integer)
      into v_blanks from jsonb_array_elements(p_data->'blanks') b;
    if v_id is null then
      insert into public.verse_puzzles (seq, reference, blanks, active)
        values ((select coalesce(max(seq), 0) + 1 from public.verse_puzzles), v_reference, v_blanks, v_active) returning id into v_id;
    else
      select blanks, reference into v_old_blanks, v_old_text from public.verse_puzzles where id = v_id for update;
      if not found then raise exception 'Versículo não encontrado.' using errcode = 'P0002'; end if;
      update public.verse_puzzles set reference = v_reference, blanks = v_blanks, active = v_active where id = v_id;
      -- Dias anteriores ficam como estão (são histórico); só as tentativas de hoje deixam de valer se o desafio mudou.
      if v_old_text <> v_reference or (select jsonb_agg(jsonb_build_object('index', (b->>'index')::integer, 'answer', b->>'answer') order by (b->>'index')::integer) from jsonb_array_elements(v_old_blanks) b)
          is distinct from (select jsonb_agg(jsonb_build_object('index', (b->>'index')::integer, 'answer', b->>'answer') order by (b->>'index')::integer) from jsonb_array_elements(v_blanks) b) then
        delete from public.verse_attempts where puzzle_id = v_id and day = v_today; get diagnostics v_reset = row_count;
      end if;
    end if;
  end if;
  return jsonb_build_object('item', private.content_item(p_game, v_id), 'answers_reset', v_reset);
end $$;

create or replace function public.owner_content_delete(p_game text, p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_removed integer := 0; v_rows integer;
begin
  perform private.owner_identity();
  if p_game is null or p_game not in ('quiz', 'who', 'claims', 'timeline', 'verse') or p_id is null then raise exception 'Dados inválidos.' using errcode = '22023'; end if;
  -- As respostas dos leitores ao item saem junto (on delete cascade); contamos antes só para informar.
  if p_game = 'quiz' then
    select count(*) into v_removed from public.quiz_answers where question_id = p_id;
    delete from public.quiz_questions where id = p_id;
  elsif p_game = 'who' then
    select count(*) into v_removed from public.who_answers where card_id = p_id;
    delete from public.who_cards where id = p_id;
  elsif p_game = 'claims' then
    select count(*) into v_removed from public.claim_answers where card_id = p_id;
    delete from public.claim_cards where id = p_id;
  elsif p_game = 'timeline' then
    select count(*) into v_removed from public.timeline_answers where event_low = p_id or event_high = p_id;
    delete from public.timeline_events where id = p_id;
  else
    -- Versículo já sorteado ou jogado faz parte do histórico (sequência de dias): desative em vez de excluir.
    if exists(select 1 from public.verse_days where puzzle_id = p_id) or exists(select 1 from public.verse_attempts where puzzle_id = p_id) then
      raise exception 'Este versículo já foi usado em um desafio. Desative-o em vez de excluir, para manter o histórico dos leitores.' using errcode = '22023';
    end if;
    delete from public.verse_puzzles where id = p_id;
  end if;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
  return jsonb_build_object('deleted', true, 'answers_removed', v_removed);
end $$;

commit;
