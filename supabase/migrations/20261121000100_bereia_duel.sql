begin;

-- Bereia 1v1 (Duelo Relâmpago): o criador escolhe modalidade, nível e tamanho (5 ou 10 perguntas); o servidor sorteia as perguntas
-- UMA vez e guarda a lista. Quem abrir o link responde exatamente as mesmas perguntas, cronometradas. As respostas certas nunca
-- saem do banco antes de a pessoa responder (mesma regra do quiz). Dados só do próprio duelo: ninguém lê as tabelas diretamente.
create table public.quiz_duels (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]{10}$'),
  creator_id uuid not null references auth.users(id) on delete cascade,
  mode text not null check (mode in ('antigo', 'novo', 'biblia')),
  level smallint not null check (level between 1 and 4),
  size smallint not null check (size in (5, 10)),
  question_ids uuid[] not null check (cardinality(question_ids) between 5 and 10),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index quiz_duels_creator_idx on public.quiz_duels (creator_id, created_at desc);
alter table public.quiz_duels enable row level security;
revoke all on public.quiz_duels from public, anon, authenticated;

create table public.quiz_duel_players (
  duel_id uuid not null references public.quiz_duels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  finished_at timestamptz,
  correct smallint not null default 0 check (correct >= 0),
  answered smallint not null default 0 check (answered between 0 and 10),
  total_ms integer not null default 0 check (total_ms >= 0),
  primary key (duel_id, user_id)
);
create index quiz_duel_players_user_idx on public.quiz_duel_players (user_id, joined_at desc);
alter table public.quiz_duel_players enable row level security;
revoke all on public.quiz_duel_players from public, anon, authenticated;

create table public.quiz_duel_answers (
  duel_id uuid not null,
  user_id uuid not null,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected smallint not null check (selected between -1 and 3), -- -1 = o tempo acabou
  is_correct boolean not null,
  elapsed_ms integer not null check (elapsed_ms between 0 and 15000),
  primary key (duel_id, user_id, question_id),
  foreign key (duel_id, user_id) references public.quiz_duel_players(duel_id, user_id) on delete cascade
);
alter table public.quiz_duel_answers enable row level security;
revoke all on public.quiz_duel_answers from public, anon, authenticated;

-- Apelido público do jogador (o mesmo do ranking); sem apelido, o app mostra "Jogador".
create function private.duel_username(p_user uuid) returns text
language sql stable set search_path = '' as $$
  select n.username from public.account_usernames n where n.user_id = p_user
$$;

-- Abre o duelo pelo código: entra como jogador (até 20) e devolve as perguntas SEM respostas, mais o que a pessoa já respondeu.
create function public.duel_open(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_duel public.quiz_duels;
  v_player public.quiz_duel_players;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then raise exception 'Duelo não encontrado.' using errcode = 'P0002'; end if;
  select * into v_duel from public.quiz_duels where code = p_code and expires_at > now();
  if not found then raise exception 'Duelo não encontrado ou expirado.' using errcode = 'P0002'; end if;
  select * into v_player from public.quiz_duel_players where duel_id = v_duel.id and user_id = v_user;
  if not found then
    if (select count(*) from public.quiz_duel_players where duel_id = v_duel.id) >= 20 then
      raise exception 'Este duelo já está cheio.' using errcode = '22023';
    end if;
    insert into public.quiz_duel_players (duel_id, user_id) values (v_duel.id, v_user) returning * into v_player;
  end if;
  return jsonb_build_object(
    'code', v_duel.code, 'mode', v_duel.mode, 'level', v_duel.level, 'size', v_duel.size, 'expires_at', v_duel.expires_at,
    'creator', private.duel_username(v_duel.creator_id), 'is_creator', v_duel.creator_id = v_user,
    'finished', v_player.finished_at is not null,
    'questions', (select jsonb_agg(jsonb_build_object('id', q.id, 'prompt', q.prompt, 'options', q.options) order by t.ord)
      from unnest(v_duel.question_ids) with ordinality as t(id, ord) join public.quiz_questions q on q.id = t.id),
    'answers', coalesce((select jsonb_agg(jsonb_build_object('question_id', a.question_id, 'selected', a.selected, 'correct', a.is_correct,
        'correct_index', q.correct_index, 'reference', q.reference) order by a.question_id)
      from public.quiz_duel_answers a join public.quiz_questions q on q.id = a.question_id
      where a.duel_id = v_duel.id and a.user_id = v_user), '[]'::jsonb));
end $$;

create function public.duel_create(p_mode text, p_level integer, p_size integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_ids uuid[];
  v_code text;
  v_duel public.quiz_duels;
  v_try integer := 0;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('antigo', 'novo', 'biblia') or p_level is null or p_level not between 1 and 4 or p_size is null or p_size not in (5, 10) then
    raise exception 'Escolha modalidade, nível e tamanho válidos.' using errcode = '22023';
  end if;
  if (select count(*) from public.quiz_duels where creator_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'Você criou muitos duelos agora há pouco. Tente de novo mais tarde.' using errcode = '22023';
  end if;
  select array_agg(q.id) into v_ids from (
    select id from public.quiz_questions
    where active and level = p_level and (p_mode = 'biblia' or testament = p_mode)
    order by random() limit p_size) q;
  if v_ids is null or cardinality(v_ids) < p_size then
    raise exception 'Ainda não há perguntas suficientes nesta combinação. Escolha outro nível ou outra modalidade.' using errcode = '22023';
  end if;
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      insert into public.quiz_duels (code, creator_id, mode, level, size, question_ids)
        values (v_code, v_user, p_mode, p_level, p_size, v_ids) returning * into v_duel;
      exit;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try >= 5 then raise; end if;
    end;
  end loop;
  insert into public.quiz_duel_players (duel_id, user_id) values (v_duel.id, v_user);
  return jsonb_build_object('code', v_duel.code);
end $$;

create function public.duel_answer(p_code text, p_question_id uuid, p_selected integer, p_elapsed_ms integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_duel public.quiz_duels;
  v_question public.quiz_questions;
  v_rows integer;
  v_correct boolean;
  v_answered smallint;
  v_elapsed integer := greatest(0, least(coalesce(p_elapsed_ms, 15000), 15000));
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' or p_question_id is null or p_selected is null or p_selected not between -1 and 3 then
    raise exception 'Resposta inválida.' using errcode = '22023';
  end if;
  select * into v_duel from public.quiz_duels where code = p_code and expires_at > now();
  if not found then raise exception 'Duelo não encontrado ou expirado.' using errcode = 'P0002'; end if;
  if not (p_question_id = any (v_duel.question_ids)) then raise exception 'Pergunta fora do duelo.' using errcode = '22023'; end if;
  if not exists (select 1 from public.quiz_duel_players where duel_id = v_duel.id and user_id = v_user) then
    raise exception 'Abra o duelo antes de responder.' using errcode = '22023';
  end if;
  select * into v_question from public.quiz_questions where id = p_question_id;
  v_correct := p_selected = v_question.correct_index;
  insert into public.quiz_duel_answers (duel_id, user_id, question_id, selected, is_correct, elapsed_ms)
    values (v_duel.id, v_user, p_question_id, p_selected, v_correct, v_elapsed)
    on conflict (duel_id, user_id, question_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    update public.quiz_duel_players
      set answered = answered + 1, correct = correct + case when v_correct then 1 else 0 end, total_ms = total_ms + v_elapsed
      where duel_id = v_duel.id and user_id = v_user
      returning answered into v_answered;
    if v_answered >= v_duel.size then
      update public.quiz_duel_players set finished_at = now() where duel_id = v_duel.id and user_id = v_user;
    end if;
  end if;
  return jsonb_build_object('correct', v_correct, 'correct_index', v_question.correct_index, 'reference', v_question.reference,
    'counted', v_rows > 0,
    'finished', (select finished_at is not null from public.quiz_duel_players where duel_id = v_duel.id and user_id = v_user));
end $$;

-- Placar: só depois de terminar o próprio duelo. Mostra o criador, você e os demais que já terminaram (até 20).
create function public.duel_result(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_duel public.quiz_duels;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^[a-z0-9]{10}$' then raise exception 'Duelo não encontrado.' using errcode = 'P0002'; end if;
  select * into v_duel from public.quiz_duels where code = p_code and expires_at > now();
  if not found then raise exception 'Duelo não encontrado ou expirado.' using errcode = 'P0002'; end if;
  if not exists (select 1 from public.quiz_duel_players where duel_id = v_duel.id and user_id = v_user and finished_at is not null) then
    raise exception 'Termine o duelo para ver o placar.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'code', v_duel.code, 'mode', v_duel.mode, 'level', v_duel.level, 'size', v_duel.size,
    'players', coalesce((select jsonb_agg(jsonb_build_object('username', private.duel_username(p.user_id), 'correct', p.correct, 'total_ms', p.total_ms,
        'is_me', p.user_id = v_user, 'is_creator', p.user_id = v_duel.creator_id) order by p.correct desc, p.total_ms asc, p.finished_at asc)
      from public.quiz_duel_players p where p.duel_id = v_duel.id and p.finished_at is not null), '[]'::jsonb),
    'waiting', (select count(*) from public.quiz_duel_players p where p.duel_id = v_duel.id and p.finished_at is null));
end $$;

-- Meus duelos recentes (para voltar ao placar ou ao link).
create function public.duel_mine() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('code', d.code, 'mode', d.mode, 'level', d.level, 'size', d.size, 'created_at', d.created_at,
      'creator', private.duel_username(d.creator_id), 'is_creator', d.creator_id = v_user, 'finished', p.finished_at is not null, 'correct', p.correct)
      order by p.joined_at desc)
    from (select * from public.quiz_duel_players where user_id = v_user order by joined_at desc limit 10) p
    join public.quiz_duels d on d.id = p.duel_id and d.expires_at > now()), '[]'::jsonb);
end $$;

revoke all on function public.duel_open(text), public.duel_create(text, integer, integer), public.duel_answer(text, uuid, integer, integer), public.duel_result(text), public.duel_mine() from public, anon;
grant execute on function public.duel_open(text), public.duel_create(text, integer, integer), public.duel_answer(text, uuid, integer, integer), public.duel_result(text), public.duel_mine() to authenticated;

commit;
