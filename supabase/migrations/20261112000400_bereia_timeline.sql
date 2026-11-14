begin;

-- "Linha do Tempo (Antes ou Depois?)": o leitor vê dois acontecimentos e escolhe qual veio primeiro.
-- A ordem (position) NUNCA é legível diretamente: só as funções abaixo (security definer) a revelam, depois de responder.
create table public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  position integer not null unique check (position > 0),
  era text not null check (length(btrim(era)) between 3 and 60),
  title text not null check (length(btrim(title)) between 5 and 160),
  reference text not null check (length(btrim(reference)) between 3 and 60),
  active boolean not null default true
);
alter table public.timeline_events enable row level security;
revoke all on public.timeline_events from public, anon, authenticated;

-- Só a PRIMEIRA resposta de cada leitor a cada par (em qualquer ordem) vale pontos.
create table public.timeline_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  event_low uuid not null references public.timeline_events(id) on delete cascade,
  event_high uuid not null references public.timeline_events(id) on delete cascade,
  chosen_id uuid not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, event_low, event_high),
  check (event_low < event_high)
);
alter table public.timeline_answers enable row level security;
revoke all on public.timeline_answers from public, anon, authenticated;

create function public.timeline_start(p_count integer default 10) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 20 then raise exception 'Invalid size' using errcode = '22023'; end if;
  -- Pares ainda não respondidos vêm primeiro; o lado em que cada evento aparece é sorteado.
  select coalesce(jsonb_agg(jsonb_build_object(
      'left', jsonb_build_object('id', case when p.flip then p.b_id else p.a_id end, 'title', case when p.flip then p.b_title else p.a_title end),
      'right', jsonb_build_object('id', case when p.flip then p.a_id else p.b_id end, 'title', case when p.flip then p.a_title else p.b_title end))), '[]'::jsonb)
    into v_result
  from (
    select a.id as a_id, a.title as a_title, b.id as b_id, b.title as b_title, random() < 0.5 as flip
    from public.timeline_events a
    join public.timeline_events b on b.position > a.position and b.active
    where a.active
    order by exists(select 1 from public.timeline_answers x where x.user_id = v_user and x.event_low = least(a.id, b.id) and x.event_high = greatest(a.id, b.id)), random()
    limit p_count
  ) p;
  return v_result;
end $$;

create function public.timeline_answer(p_left uuid, p_right uuid, p_chosen uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_left public.timeline_events;
  v_right public.timeline_events;
  v_first public.timeline_events;
  v_second public.timeline_events;
  v_correct boolean;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_left is null or p_right is null or p_chosen is null or p_left = p_right or p_chosen not in (p_left, p_right) then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  select * into v_left from public.timeline_events where id = p_left and active;
  select * into v_right from public.timeline_events where id = p_right and active;
  if v_left.id is null or v_right.id is null then raise exception 'Event not found' using errcode = 'P0002'; end if;
  if v_left.position < v_right.position then v_first := v_left; v_second := v_right; else v_first := v_right; v_second := v_left; end if;
  v_correct := p_chosen = v_first.id;
  insert into public.timeline_answers (user_id, event_low, event_high, chosen_id, is_correct)
    values (v_user, least(p_left, p_right), greatest(p_left, p_right), p_chosen, v_correct)
    on conflict (user_id, event_low, event_high) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('correct', v_correct, 'counted', v_rows > 0,
    'first', jsonb_build_object('id', v_first.id, 'title', v_first.title, 'era', v_first.era, 'reference', v_first.reference),
    'second', jsonb_build_object('id', v_second.id, 'title', v_second.title, 'era', v_second.era, 'reference', v_second.reference));
end $$;

create function public.get_my_timeline_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where a.is_correct),
    'total_events', (select count(*) from public.timeline_events where active))
    from public.timeline_answers a where a.user_id = v_user);
end $$;

alter function public.timeline_start(integer) owner to postgres;
alter function public.timeline_answer(uuid, uuid, uuid) owner to postgres;
alter function public.get_my_timeline_stats() owner to postgres;
revoke all on function public.timeline_start(integer) from public, anon, authenticated, service_role;
revoke all on function public.timeline_answer(uuid, uuid, uuid) from public, anon, authenticated, service_role;
revoke all on function public.get_my_timeline_stats() from public, anon, authenticated, service_role;
grant execute on function public.timeline_start(integer) to authenticated;
grant execute on function public.timeline_answer(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_my_timeline_stats() to authenticated;

-- Acontecimentos em ordem cronológica segundo a narrativa bíblica (eras amplas, sem datas exatas).
insert into public.timeline_events (position, era, title, reference) values
  (1, 'Origens', 'A criação do mundo', 'Gênesis 1:1'),
  (2, 'Origens', 'Adão e Eva comem do fruto proibido', 'Gênesis 3:6'),
  (3, 'Origens', 'Caim mata Abel', 'Gênesis 4:8'),
  (4, 'Origens', 'O Dilúvio e a arca de Noé', 'Gênesis 7:17'),
  (5, 'Origens', 'A Torre de Babel', 'Gênesis 11:9'),
  (6, 'Patriarcas', 'O chamado de Abraão', 'Gênesis 12:1'),
  (7, 'Patriarcas', 'A destruição de Sodoma e Gomorra', 'Gênesis 19:24'),
  (8, 'Patriarcas', 'O nascimento de Isaque', 'Gênesis 21:2'),
  (9, 'Patriarcas', 'Jacó recebe a bênção de Isaque no lugar de Esaú', 'Gênesis 27:27'),
  (10, 'Patriarcas', 'Jacó luta com o anjo e recebe o nome Israel', 'Gênesis 32:28'),
  (11, 'Patriarcas', 'José é vendido pelos irmãos', 'Gênesis 37:28'),
  (12, 'Patriarcas', 'José se torna governador do Egito', 'Gênesis 41:41'),
  (13, 'Êxodo e conquista', 'O nascimento de Moisés', 'Êxodo 2:2'),
  (14, 'Êxodo e conquista', 'A sarça ardente', 'Êxodo 3:2'),
  (15, 'Êxodo e conquista', 'As dez pragas do Egito', 'Êxodo 12:29'),
  (16, 'Êxodo e conquista', 'A travessia do Mar Vermelho', 'Êxodo 14:21'),
  (17, 'Êxodo e conquista', 'Os Dez Mandamentos no monte Sinai', 'Êxodo 20:1'),
  (18, 'Êxodo e conquista', 'O bezerro de ouro', 'Êxodo 32:4'),
  (19, 'Êxodo e conquista', 'Os espias enviados a Canaã', 'Números 13:2'),
  (20, 'Êxodo e conquista', 'A morte de Moisés no monte Nebo', 'Deuteronômio 34:5'),
  (21, 'Êxodo e conquista', 'A queda dos muros de Jericó', 'Josué 6:20'),
  (22, 'Juízes', 'Débora e Baraque vencem Sísera', 'Juízes 4:4'),
  (23, 'Juízes', 'Gideão e os trezentos homens', 'Juízes 7:7'),
  (24, 'Reino unido', 'Samuel é chamado por Deus', '1 Samuel 3:10'),
  (25, 'Reino unido', 'Saul é ungido o primeiro rei de Israel', '1 Samuel 10:1'),
  (26, 'Reino unido', 'Davi derrota Golias', '1 Samuel 17:50'),
  (27, 'Reino unido', 'Davi se torna rei sobre todo Israel', '2 Samuel 5:3'),
  (28, 'Reino unido', 'Davi e Bate-Seba', '2 Samuel 11:4'),
  (29, 'Reino unido', 'Salomão pede sabedoria a Deus', '1 Reis 3:9'),
  (30, 'Reino unido', 'Salomão constrói o Templo', '1 Reis 6:14'),
  (31, 'Reino dividido', 'O reino se divide em Israel e Judá', '1 Reis 12:16'),
  (32, 'Reino dividido', 'Elias no monte Carmelo', '1 Reis 18:38'),
  (33, 'Reino dividido', 'Elias é levado ao céu num redemoinho', '2 Reis 2:11'),
  (34, 'Reino dividido', 'Jonas prega em Nínive', 'Jonas 3:5'),
  (35, 'Reino dividido', 'A queda de Samaria, capital de Israel', '2 Reis 17:6'),
  (36, 'Exílio e volta', 'A queda de Jerusalém para a Babilônia', '2 Reis 25:9'),
  (37, 'Exílio e volta', 'A mão que escreve na parede, no banquete de Belsazar', 'Daniel 5:5'),
  (38, 'Exílio e volta', 'Daniel na cova dos leões', 'Daniel 6:16'),
  (39, 'Exílio e volta', 'O decreto de Ciro e a volta dos exilados', 'Esdras 1:1'),
  (40, 'Exílio e volta', 'Ester salva o povo judeu', 'Ester 4:16'),
  (41, 'Exílio e volta', 'Neemias reconstrói os muros de Jerusalém', 'Neemias 6:15'),
  (42, 'Vida de Jesus', 'O anjo anuncia a Maria que ela será mãe de Jesus', 'Lucas 1:38'),
  (43, 'Vida de Jesus', 'O nascimento de Jesus em Belém', 'Lucas 2:7'),
  (44, 'Vida de Jesus', 'O batismo de Jesus', 'Mateus 3:16'),
  (45, 'Vida de Jesus', 'Jesus transforma água em vinho, em Caná', 'João 2:9'),
  (46, 'Vida de Jesus', 'O Sermão do Monte', 'Mateus 5:1'),
  (47, 'Vida de Jesus', 'Jesus alimenta cinco mil pessoas', 'João 6:11'),
  (48, 'Vida de Jesus', 'A ressurreição de Lázaro', 'João 11:43'),
  (49, 'Vida de Jesus', 'A entrada de Jesus em Jerusalém', 'Mateus 21:9'),
  (50, 'Vida de Jesus', 'A última ceia', 'Lucas 22:19'),
  (51, 'Vida de Jesus', 'A crucificação de Jesus', 'Lucas 23:33'),
  (52, 'Vida de Jesus', 'A ressurreição de Jesus', 'Lucas 24:6'),
  (53, 'Igreja primitiva', 'A ascensão de Jesus', 'Atos 1:9'),
  (54, 'Igreja primitiva', 'O Pentecostes', 'Atos 2:4'),
  (55, 'Igreja primitiva', 'Estêvão é apedrejado', 'Atos 7:59'),
  (56, 'Igreja primitiva', 'A conversão de Saulo (Paulo)', 'Atos 9:3'),
  (57, 'Igreja primitiva', 'Pedro visita Cornélio', 'Atos 10:44'),
  (58, 'Igreja primitiva', 'Paulo e Barnabé são enviados na primeira viagem missionária', 'Atos 13:2'),
  (59, 'Igreja primitiva', 'O Concílio de Jerusalém', 'Atos 15:6'),
  (60, 'Igreja primitiva', 'Paulo chega a Roma', 'Atos 28:16'),
  (61, 'Igreja primitiva', 'João recebe as visões do Apocalipse em Patmos', 'Apocalipse 1:9');

commit;
