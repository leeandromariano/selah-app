begin;

-- "Versículo Oculto": um desafio por dia (fuso de São Paulo). Guardamos apenas a referência e as palavras
-- escondidas, NUNCA o texto do versículo: ele vem da API da Bíblia (ARA) no aplicativo.
-- As palavras escondidas só são reveladas depois que o leitor termina o desafio do dia.
create function private.verse_norm(p_text text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(translate(lower(coalesce(p_text, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'), '[^a-z0-9]', '', 'g')
$$;

create table public.verse_puzzles (
  id uuid primary key default gen_random_uuid(),
  seq integer not null unique,
  reference text not null check (length(btrim(reference)) between 3 and 60),
  -- [{ "index": posição da palavra (1 = primeira) no versículo, "answer": palavra, "prev": palavra anterior }]
  blanks jsonb not null check (jsonb_typeof(blanks) = 'array' and jsonb_array_length(blanks) between 2 and 3),
  active boolean not null default true
);
alter table public.verse_puzzles enable row level security;
revoke all on public.verse_puzzles from public, anon, authenticated;

create table public.verse_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  attempt_no smallint not null check (attempt_no between 1 and 4),
  puzzle_id uuid not null references public.verse_puzzles(id),
  results boolean[] not null,
  solved boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day, attempt_no)
);
alter table public.verse_attempts enable row level security;
revoke all on public.verse_attempts from public, anon, authenticated;

create function private.verse_state(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_number integer := v_day - date '2026-11-11';
  v_total integer;
  v_puzzle public.verse_puzzles;
  v_attempts jsonb;
  v_count integer;
  v_solved boolean;
  v_finished boolean;
  v_streak integer := 0;
  v_cursor date;
begin
  select count(*) into v_total from public.verse_puzzles where active;
  if v_total = 0 then raise exception 'No puzzle available' using errcode = 'P0002'; end if;
  select * into v_puzzle from public.verse_puzzles where active order by seq offset ((v_number - 1) % v_total) limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('results', to_jsonb(a.results)) order by a.attempt_no), '[]'::jsonb), count(*), coalesce(bool_or(a.solved), false)
    into v_attempts, v_count, v_solved
  from public.verse_attempts a where a.user_id = p_user and a.day = v_day;
  v_finished := v_solved or v_count >= 4;
  -- Sequência: dias seguidos com o desafio resolvido, contando a partir de hoje (ou de ontem, se hoje ainda não foi resolvido).
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

create function public.verse_today() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return private.verse_state(v_user);
end $$;

create function public.verse_guess(p_words text[]) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_day date := (now() at time zone 'America/Sao_Paulo')::date;
  v_number integer := v_day - date '2026-11-11';
  v_total integer;
  v_puzzle public.verse_puzzles;
  v_blanks jsonb[];
  v_results boolean[] := '{}';
  v_count integer;
  v_solved boolean;
  v_i integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select count(*) into v_total from public.verse_puzzles where active;
  if v_total = 0 then raise exception 'No puzzle available' using errcode = 'P0002'; end if;
  select * into v_puzzle from public.verse_puzzles where active order by seq offset ((v_number - 1) % v_total) limit 1;
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

alter function private.verse_state(uuid) owner to postgres;
alter function public.verse_today() owner to postgres;
alter function public.verse_guess(text[]) owner to postgres;
revoke all on function private.verse_state(uuid) from public, anon, authenticated, service_role;
revoke all on function private.verse_norm(text) from public, anon, authenticated, service_role;
revoke all on function public.verse_today() from public, anon, authenticated, service_role;
revoke all on function public.verse_guess(text[]) from public, anon, authenticated, service_role;
grant execute on function public.verse_today() to authenticated;
grant execute on function public.verse_guess(text[]) to authenticated;

insert into public.verse_puzzles (seq, reference, blanks) values
  (1, 'João 3:16', '[{"index":3,"answer":"amou","prev":"Deus"},{"index":14,"answer":"unigênito","prev":"Filho"},{"index":28,"answer":"eterna","prev":"vida"}]'),
  (2, 'Salmos 23:1', '[{"index":2,"answer":"Senhor","prev":"O"},{"index":6,"answer":"pastor","prev":"meu"},{"index":9,"answer":"faltará","prev":"me"}]'),
  (3, 'Provérbios 3:5', '[{"index":3,"answer":"Senhor","prev":"no"},{"index":8,"answer":"coração","prev":"teu"},{"index":16,"answer":"entendimento","prev":"próprio"}]'),
  (4, 'Romanos 8:28', '[{"index":6,"answer":"cooperam","prev":"coisas"},{"index":12,"answer":"amam","prev":"que"},{"index":22,"answer":"propósito","prev":"seu"}]'),
  (5, 'Mateus 11:28', '[{"index":8,"answer":"cansados","prev":"estais"},{"index":10,"answer":"sobrecarregados","prev":"e"},{"index":14,"answer":"aliviarei","prev":"vos"}]'),
  (6, 'Isaías 41:10', '[{"index":2,"answer":"temas","prev":"Não"},{"index":9,"answer":"assombres","prev":"te"},{"index":28,"answer":"destra","prev":"minha"}]'),
  (7, 'Filipenses 4:13', '[{"index":1,"answer":"Tudo","prev":""},{"index":3,"answer":"naquele","prev":"posso"},{"index":6,"answer":"fortalece","prev":"me"}]'),
  (8, 'Josué 1:9', '[{"index":8,"answer":"corajoso","prev":"e"},{"index":13,"answer":"espantes","prev":"te"},{"index":25,"answer":"andares","prev":"que"}]'),
  (9, 'Salmos 46:1', '[{"index":5,"answer":"refúgio","prev":"nosso"},{"index":8,"answer":"socorro","prev":"fortaleza"},{"index":12,"answer":"angústia","prev":"na"}]'),
  (10, '1 Coríntios 13:13', '[{"index":3,"answer":"permanecem","prev":"pois"},{"index":7,"answer":"esperança","prev":"a"},{"index":15,"answer":"maior","prev":"o"}]'),
  (11, 'Eclesiastes 3:1', '[{"index":6,"answer":"determinado","prev":"tempo"},{"index":12,"answer":"propósito","prev":"todo"},{"index":15,"answer":"céu","prev":"do"}]'),
  (12, 'Mateus 6:33', '[{"index":8,"answer":"reino","prev":"seu"},{"index":12,"answer":"justiça","prev":"sua"},{"index":19,"answer":"acrescentadas","prev":"serão"}]'),
  (13, 'Hebreus 11:1', '[{"index":6,"answer":"certeza","prev":"a"},{"index":11,"answer":"esperam","prev":"se"},{"index":13,"answer":"convicção","prev":"a"}]'),
  (14, 'João 14:6', '[{"index":6,"answer":"caminho","prev":"o"},{"index":9,"answer":"verdade","prev":"a"},{"index":13,"answer":"ninguém","prev":"vida"}]'),
  (15, '1 João 4:8', '[{"index":4,"answer":"ama","prev":"não"},{"index":6,"answer":"conhece","prev":"não"},{"index":12,"answer":"amor","prev":"é"}]'),
  (16, 'Jeremias 29:11', '[{"index":17,"answer":"paz","prev":"de"},{"index":21,"answer":"mal","prev":"de"},{"index":28,"answer":"desejais","prev":"que"}]');

commit;
