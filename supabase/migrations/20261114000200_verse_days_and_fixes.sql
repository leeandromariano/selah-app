begin;

-- 1) Correções conferidas com o texto da ARA (Sociedade Bíblica do Brasil).
--    Salmos 46:1 termina em "socorro bem-presente nas tribulações"; Jeremias 29:11 começa com "Eu é que sei que pensamentos...".
update public.verse_puzzles set blanks = '[{"index":5,"answer":"refúgio","prev":"nosso"},{"index":8,"answer":"socorro","prev":"fortaleza"},{"index":11,"answer":"tribulações","prev":"nas"}]'
  where reference = 'Salmos 46:1';
update public.verse_puzzles set blanks = '[{"index":16,"answer":"paz","prev":"de"},{"index":20,"answer":"mal","prev":"de"},{"index":27,"answer":"desejais","prev":"que"}]'
  where reference = 'Jeremias 29:11';

-- 2) Sorteio diário estável: o versículo de cada dia fica gravado. Assim o owner pode adicionar, editar ou
--    desativar versículos sem trocar o desafio de um dia que já começou (antes dependia da quantidade de versículos).
create table public.verse_days (
  day date primary key,
  puzzle_id uuid not null references public.verse_puzzles(id)
);
alter table public.verse_days enable row level security;
revoke all on public.verse_days from public, anon, authenticated;

-- Dias já jogados mantêm o versículo que tiveram; hoje mantém o que a regra antiga escolheria.
insert into public.verse_days (day, puzzle_id)
  select distinct on (a.day) a.day, a.puzzle_id from public.verse_attempts a order by a.day, a.created_at
  on conflict (day) do nothing;
insert into public.verse_days (day, puzzle_id)
  select t.day, p.id from (select (now() at time zone 'America/Sao_Paulo')::date as day) t
  cross join lateral (
    select id from public.verse_puzzles where active order by seq
    offset (((t.day - date '2026-11-11') - 1) % greatest(1, (select count(*) from public.verse_puzzles where active)::integer)) limit 1) p
  on conflict (day) do nothing;

create function private.verse_puzzle_of(p_day date) returns uuid
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
  v_last integer;
begin
  select puzzle_id into v_id from public.verse_days where day = p_day;
  if v_id is not null then return v_id; end if;
  -- Próximo ativo depois do último sorteado; ao chegar no fim, volta ao começo.
  select p.seq into v_last from public.verse_days d join public.verse_puzzles p on p.id = d.puzzle_id where d.day < p_day order by d.day desc limit 1;
  select id into v_id from public.verse_puzzles where active and seq > coalesce(v_last, 0) order by seq limit 1;
  if v_id is null then select id into v_id from public.verse_puzzles where active order by seq limit 1; end if;
  if v_id is null then raise exception 'No puzzle available' using errcode = 'P0002'; end if;
  insert into public.verse_days (day, puzzle_id) values (p_day, v_id) on conflict (day) do nothing;
  select puzzle_id into v_id from public.verse_days where day = p_day;
  return v_id;
end $$;

create or replace function private.verse_state(p_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_number integer := v_day - date '2026-11-11';
  v_puzzle public.verse_puzzles;
  v_attempts jsonb;
  v_count integer;
  v_solved boolean;
  v_finished boolean;
  v_streak integer := 0;
  v_cursor date;
begin
  select * into v_puzzle from public.verse_puzzles where id = private.verse_puzzle_of(v_day);
  select coalesce(jsonb_agg(jsonb_build_object('results', to_jsonb(a.results)) order by a.attempt_no), '[]'::jsonb), count(*), coalesce(bool_or(a.solved), false)
    into v_attempts, v_count, v_solved
  from public.verse_attempts a where a.user_id = p_user and a.day = v_day;
  v_finished := v_solved or v_count >= 4;
  v_cursor := case when v_solved then v_day else v_day - 1 end;
  while exists(select 1 from public.verse_attempts a where a.user_id = p_user and a.day = v_cursor and a.solved) loop
    v_streak := v_streak + 1; v_cursor := v_cursor - 1;
  end loop;
  return jsonb_build_object(
    'number', v_number, 'reference', v_puzzle.reference, 'max_attempts', 4,
    'blanks', (select jsonb_agg(jsonb_build_object('index', (b->>'index')::integer, 'length', char_length(private.verse_norm(b->>'answer')), 'prev', private.verse_norm(b->>'prev')) order by (b->>'index')::integer)
               from jsonb_array_elements(v_puzzle.blanks) b),
    'attempts', v_attempts, 'finished', v_finished, 'solved', v_solved, 'streak', v_streak,
    'answers', case when v_finished then (select jsonb_agg(b->>'answer' order by (b->>'index')::integer) from jsonb_array_elements(v_puzzle.blanks) b) else null end);
end $$;

create or replace function public.verse_today() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return private.verse_state(v_user);
end $$;

create or replace function public.verse_guess(p_words text[]) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_puzzle public.verse_puzzles;
  v_blanks jsonb[];
  v_results boolean[] := '{}';
  v_count integer;
  v_solved boolean;
  v_i integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_puzzle from public.verse_puzzles where id = private.verse_puzzle_of(v_day);
  select array_agg(b order by (b->>'index')::integer) into v_blanks from jsonb_array_elements(v_puzzle.blanks) b;
  if p_words is null or coalesce(array_length(p_words, 1), 0) <> array_length(v_blanks, 1) then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  for v_i in 1..array_length(p_words, 1) loop
    if p_words[v_i] is null or char_length(p_words[v_i]) > 40 then raise exception 'Invalid answer' using errcode = '22023'; end if;
  end loop;
  select count(*), coalesce(bool_or(solved), false) into v_count, v_solved
    from public.verse_attempts where user_id = v_user and day = v_day;
  if v_solved or v_count >= 4 then raise exception 'Challenge already finished' using errcode = 'P0001'; end if;
  for v_i in 1..array_length(v_blanks, 1) loop
    v_results := v_results || (private.verse_norm(p_words[v_i]) = private.verse_norm(v_blanks[v_i]->>'answer'));
  end loop;
  insert into public.verse_attempts (user_id, day, attempt_no, puzzle_id, results, solved)
    values (v_user, v_day, v_count + 1, v_puzzle.id, v_results, not (false = any(v_results)));
  return private.verse_state(v_user) || jsonb_build_object('results', to_jsonb(v_results));
end $$;

alter function private.verse_puzzle_of(date) owner to postgres;
revoke all on function private.verse_puzzle_of(date) from public, anon, authenticated, service_role;

commit;
