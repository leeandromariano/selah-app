begin;

-- Quiz bíblico. As respostas certas NUNCA são legíveis diretamente: só as funções abaixo
-- (security definer) as revelam, e apenas depois que o leitor responde.
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  testament text not null check (testament in ('antigo', 'novo')),
  prompt text not null check (length(btrim(prompt)) between 5 and 400),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  reference text not null check (length(btrim(reference)) between 3 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index quiz_questions_active_testament_idx on public.quiz_questions (testament) where active;
alter table public.quiz_questions enable row level security;
revoke all on public.quiz_questions from public, anon, authenticated;

-- Só a PRIMEIRA resposta de cada leitor a cada pergunta vale para o ranking.
create table public.quiz_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, question_id)
);
create index quiz_answers_correct_idx on public.quiz_answers (user_id) where is_correct;
alter table public.quiz_answers enable row level security;
revoke all on public.quiz_answers from public, anon, authenticated;

create function public.quiz_start(p_mode text, p_count integer default 10) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('antigo', 'novo', 'biblia') or p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'Invalid quiz mode or size' using errcode = '22023';
  end if;
  -- Perguntas ainda não respondidas vêm primeiro; depois, as já respondidas (sem valer pontos de novo).
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'testament', q.testament, 'prompt', q.prompt, 'options', q.options)), '[]'::jsonb)
    into v_result
  from (
    select q.* from public.quiz_questions q
    where q.active and (p_mode = 'biblia' or q.testament = p_mode)
    order by exists(select 1 from public.quiz_answers a where a.user_id = v_user and a.question_id = q.id), random()
    limit p_count
  ) q;
  return v_result;
end $$;

create function public.quiz_answer(p_question_id uuid, p_selected integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_question public.quiz_questions;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_question_id is null or p_selected is null or p_selected < 0 or p_selected > 3 then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  select * into v_question from public.quiz_questions where id = p_question_id and active;
  if not found then raise exception 'Question not found' using errcode = 'P0002'; end if;
  insert into public.quiz_answers (user_id, question_id, selected_index, is_correct)
    values (v_user, p_question_id, p_selected, p_selected = v_question.correct_index)
    on conflict (user_id, question_id) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('correct', p_selected = v_question.correct_index, 'correct_index', v_question.correct_index,
    'reference', v_question.reference, 'counted', v_rows > 0);
end $$;

create function public.get_my_quiz_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where a.is_correct),
    'total_questions', (select count(*) from public.quiz_questions where active))
    from public.quiz_answers a where a.user_id = v_user);
end $$;

create function public.get_owner_quiz_ranking(p_search text default '', p_page integer default 0, p_size integer default 25) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_search text := lower(btrim(coalesce(p_search, '')));
  v_result jsonb;
begin
  if auth.uid() is null or not exists(select 1 from private.app_owner where user_id = auth.uid()) then
    raise exception 'Owner required' using errcode = '42501';
  end if;
  if p_page is null or p_page < 0 or p_page > 1000000 or p_size is null or p_size < 1 or p_size > 100
    or length(v_search) > 24 or v_search !~ '^[a-z0-9_]*$' then
    raise exception 'Invalid pagination or username search' using errcode = '22023';
  end if;
  with metrics as materialized (
    select a.user_id, n.username, count(*) as answered, count(*) filter (where a.is_correct) as correct,
      count(*) filter (where a.is_correct and q.testament = 'antigo') as antigo_correct,
      count(*) filter (where a.is_correct and q.testament = 'novo') as novo_correct,
      max(a.answered_at) as last_answered_at
    from public.quiz_answers a
    join public.quiz_questions q on q.id = a.question_id
    join auth.users u on u.id = a.user_id and u.deleted_at is null
    left join public.account_usernames n on n.user_id = a.user_id
    group by a.user_id, n.username
  ), filtered as materialized (
    select * from metrics where v_search = '' or strpos(coalesce(username, ''), v_search) > 0
  ), page as (
    select username, answered, correct, antigo_correct, novo_correct, last_answered_at,
      round(100.0 * correct / answered)::integer as accuracy
    from filtered order by correct desc, answered asc, username asc nulls last, user_id asc
    limit p_size offset (p_page::bigint * p_size)
  )
  select jsonb_build_object('total_players', (select count(*) from metrics), 'matched_players', (select count(*) from filtered),
    'total_questions', (select count(*) from public.quiz_questions where active), 'page', p_page, 'size', p_size,
    'players', coalesce((select jsonb_agg(to_jsonb(page)) from page), '[]'::jsonb)) into v_result;
  return v_result;
end $$;

alter function public.quiz_start(text, integer) owner to postgres;
alter function public.quiz_answer(uuid, integer) owner to postgres;
alter function public.get_my_quiz_stats() owner to postgres;
alter function public.get_owner_quiz_ranking(text, integer, integer) owner to postgres;
revoke all on function public.quiz_start(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.quiz_answer(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_my_quiz_stats() from public, anon, authenticated, service_role;
revoke all on function public.get_owner_quiz_ranking(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.quiz_start(text, integer) to authenticated;
grant execute on function public.quiz_answer(uuid, integer) to authenticated;
grant execute on function public.get_my_quiz_stats() to authenticated;
grant execute on function public.get_owner_quiz_ranking(text, integer, integer) to authenticated;

-- Banco inicial de perguntas (conteúdo bíblico, sem dados de usuários).
insert into public.quiz_questions (testament, prompt, options, correct_index, reference) values
  ('antigo', 'Quem construiu a arca para sobreviver ao dilúvio?', '["Moisés","Noé","Abraão","Davi"]'::jsonb, 1, 'Gênesis 6:14'),
  ('antigo', 'Em quantos dias Deus criou os céus e a terra, antes de descansar no dia seguinte?', '["Seis dias","Três dias","Sete dias","Quarenta dias"]'::jsonb, 0, 'Gênesis 2:2'),
  ('antigo', 'Qual é o nome do filho que Deus prometeu a Abraão e Sara na velhice?', '["Ismael","Jacó","Esaú","Isaque"]'::jsonb, 3, 'Gênesis 21:1-3'),
  ('antigo', 'Quem foi vendido pelos irmãos e depois se tornou governador do Egito?', '["Benjamim","Judá","José","Rúben"]'::jsonb, 2, 'Gênesis 41:41'),
  ('antigo', 'Qual foi o novo nome dado a Jacó depois que lutou com o anjo?', '["Abraão","Israel","Efraim","Judá"]'::jsonb, 1, 'Gênesis 32:28'),
  ('antigo', 'Quantas pragas Deus enviou sobre o Egito antes de libertar o povo, segundo o relato do Êxodo?', '["Dez","Sete","Doze","Quarenta"]'::jsonb, 0, 'Êxodo 12:29'),
  ('antigo', 'Qual mar Deus abriu para o povo de Israel passar a pé enxuto?', '["Mar Morto","Mar da Galileia","Mar Mediterrâneo","Mar Vermelho"]'::jsonb, 3, 'Êxodo 14:21'),
  ('antigo', 'Quem recebeu de Deus os Dez Mandamentos no monte Sinai?', '["Arão","Josué","Moisés","Elias"]'::jsonb, 2, 'Êxodo 20:1-17'),
  ('antigo', 'Quem liderou Israel quando os muros de Jericó caíram?', '["Moisés","Josué","Calebe","Gideão"]'::jsonb, 1, 'Josué 6:20'),
  ('antigo', 'Qual juiz de Israel era conhecido por sua grande força, ligada ao cabelo sem corte?', '["Sansão","Gideão","Otniel","Eúde"]'::jsonb, 0, 'Juízes 16:17'),
  ('antigo', 'Quem disse: “o teu povo será o meu povo, e o teu Deus será o meu Deus”?', '["Noemi","Ester","Débora","Rute"]'::jsonb, 3, 'Rute 1:16'),
  ('antigo', 'Quem foi o primeiro rei de Israel?', '["Davi","Salomão","Saul","Samuel"]'::jsonb, 2, '1 Samuel 10:1'),
  ('antigo', 'Quem era o pai de Davi?', '["Obede","Jessé","Saul","Boaz"]'::jsonb, 1, '1 Samuel 17:12'),
  ('antigo', 'Quem derrotou o gigante Golias com uma pedra e uma funda?', '["Davi","Saul","Jônatas","Josué"]'::jsonb, 0, '1 Samuel 17:50'),
  ('antigo', 'Qual rei de Israel pediu a Deus “um coração entendido” para governar o povo?', '["Davi","Ezequias","Josias","Salomão"]'::jsonb, 3, '1 Reis 3:9'),
  ('antigo', 'Em qual monte o profeta Elias desafiou os profetas de Baal?', '["Monte Sinai","Monte das Oliveiras","Monte Carmelo","Monte Sião"]'::jsonb, 2, '1 Reis 18:19'),
  ('antigo', 'Qual profeta foi levado ao céu num redemoinho, com um carro de fogo?', '["Eliseu","Elias","Isaías","Jeremias"]'::jsonb, 1, '2 Reis 2:11'),
  ('antigo', 'Quem reconstruiu os muros de Jerusalém depois do exílio?', '["Neemias","Esdras","Zorobabel","Daniel"]'::jsonb, 0, 'Neemias 6:15'),
  ('antigo', 'Qual rainha corajosa arriscou a vida para salvar o povo judeu na Pérsia?', '["Rute","Sara","Rebeca","Ester"]'::jsonb, 3, 'Ester 4:14'),
  ('antigo', 'Quem perdeu bens e filhos, mas disse: “o Senhor o deu, e o Senhor o tomou; bendito seja o nome do Senhor”?', '["Jeremias","Jonas","Jó","Abraão"]'::jsonb, 2, 'Jó 1:21'),
  ('antigo', 'Qual salmo começa com “O Senhor é o meu pastor; nada me faltará”?', '["Salmo 1","Salmo 23","Salmo 91","Salmo 119"]'::jsonb, 1, 'Salmos 23:1'),
  ('antigo', 'Quem foi lançado na cova dos leões por continuar orando a Deus?', '["Daniel","José","Jeremias","Ezequiel"]'::jsonb, 0, 'Daniel 6:16'),
  ('antigo', 'Qual profeta foi engolido por um grande peixe depois de fugir da missão que Deus lhe deu?', '["Oseias","Amós","Miqueias","Jonas"]'::jsonb, 3, 'Jonas 1:17'),
  ('antigo', 'Qual é o primeiro livro da Bíblia, que começa com “No princípio, criou Deus os céus e a terra”?', '["Êxodo","Salmos","Gênesis","Mateus"]'::jsonb, 2, 'Gênesis 1:1'),
  ('novo', 'Em qual cidade Jesus nasceu?', '["Nazaré","Belém","Jerusalém","Cafarnaum"]'::jsonb, 1, 'Mateus 2:1'),
  ('novo', 'Quem batizou Jesus no rio Jordão?', '["João Batista","Pedro","Tiago","André"]'::jsonb, 0, 'Mateus 3:13'),
  ('novo', 'Quantos discípulos Jesus escolheu para estarem com Ele e enviá-los a pregar?', '["Sete","Setenta","Três","Doze"]'::jsonb, 3, 'Marcos 3:14'),
  ('novo', 'Qual foi o primeiro sinal (milagre) de Jesus, segundo o Evangelho de João?', '["Curar um cego","Andar sobre as águas","Transformar água em vinho","Multiplicar os pães"]'::jsonb, 2, 'João 2:11'),
  ('novo', 'Qual discípulo era cobrador de impostos antes de seguir Jesus?', '["Pedro","Mateus","João","Tomé"]'::jsonb, 1, 'Mateus 9:9'),
  ('novo', 'Em que livro do Novo Testamento está o texto “Deus amou o mundo de tal maneira que deu o seu Filho unigênito”?', '["João","Mateus","Romanos","Hebreus"]'::jsonb, 0, 'João 3:16'),
  ('novo', 'Qual discípulo andou sobre as águas ao encontro de Jesus?', '["João","André","Tiago","Pedro"]'::jsonb, 3, 'Mateus 14:29'),
  ('novo', 'O que Jesus usou para alimentar a multidão, segundo o relato de João?', '["Sete pães e três peixes","Doze pães","Cinco pães e dois peixes","Dois pães e cinco peixes"]'::jsonb, 2, 'João 6:9'),
  ('novo', 'Quem era o homem de baixa estatura que subiu num sicômoro para ver Jesus passar?', '["Nicodemos","Zaqueu","Bartimeu","Lázaro"]'::jsonb, 1, 'Lucas 19:4'),
  ('novo', 'Quem Jesus ressuscitou depois de quatro dias no túmulo?', '["Lázaro","Jairo","Tabita","Eutico"]'::jsonb, 0, 'João 11:43-44'),
  ('novo', 'Qual parábola de Jesus conta a história de um filho que gastou a herança e depois voltou arrependido?', '["O bom samaritano","O semeador","Os talentos","O filho pródigo"]'::jsonb, 3, 'Lucas 15:13'),
  ('novo', 'Quem negou Jesus três vezes na noite em que Ele foi preso?', '["Judas","Tomé","Pedro","Filipe"]'::jsonb, 2, 'Lucas 22:61'),
  ('novo', 'Qual discípulo traiu Jesus por trinta moedas de prata?', '["Pedro","Judas Iscariotes","Tomé","Mateus"]'::jsonb, 1, 'Mateus 26:14-16'),
  ('novo', 'Quem foi a mãe de Jesus?', '["Maria","Marta","Isabel","Ana"]'::jsonb, 0, 'Lucas 1:31'),
  ('novo', 'Quais eram os nomes dos pais de João Batista?', '["José e Maria","Joaquim e Ana","Zebedeu e Salomé","Zacarias e Isabel"]'::jsonb, 3, 'Lucas 1:13'),
  ('novo', 'Quem desceu sobre os discípulos no dia de Pentecostes?', '["Um anjo","Uma nuvem de fogo","O Espírito Santo","A glória do templo"]'::jsonb, 2, 'Atos 2:4'),
  ('novo', 'Quem foi o primeiro mártir cristão, apedrejado por testemunhar de Jesus?', '["Tiago","Estêvão","Barnabé","Filipe"]'::jsonb, 1, 'Atos 7:59-60'),
  ('novo', 'Quem se converteu depois de encontrar Jesus no caminho de Damasco?', '["Saulo (Paulo)","Barnabé","Silas","Timóteo"]'::jsonb, 0, 'Atos 9:3-6'),
  ('novo', 'Qual carta de Paulo contém o capítulo sobre o amor, que termina com “o maior destes é o amor”?', '["Romanos","Gálatas","Filipenses","1 Coríntios"]'::jsonb, 3, '1 Coríntios 13:13'),
  ('novo', 'Qual é o primeiro fruto do Espírito listado por Paulo em Gálatas?', '["Alegria","Paz","Amor","Domínio próprio"]'::jsonb, 2, 'Gálatas 5:22'),
  ('novo', 'Em qual carta Paulo escreve: “Pela graça sois salvos, mediante a fé”?', '["Romanos","Efésios","Colossenses","Tito"]'::jsonb, 1, 'Efésios 2:8'),
  ('novo', 'Quem era o médico que escreveu o Evangelho que leva o seu nome e também o livro de Atos?', '["Lucas","Marcos","Mateus","Timóteo"]'::jsonb, 0, 'Colossenses 4:14'),
  ('novo', 'Em qual ilha o apóstolo João recebeu as visões do Apocalipse?', '["Creta","Chipre","Malta","Patmos"]'::jsonb, 3, 'Apocalipse 1:9'),
  ('novo', 'Qual é o último livro da Bíblia?', '["Judas","Hebreus","Apocalipse","Atos"]'::jsonb, 2, 'Apocalipse 22:21');

commit;
