begin;

-- "Quem disse isso?": uma frase bíblica e quatro personagens. A resposta e o contexto
-- NUNCA são legíveis diretamente: só as funções abaixo (security definer) os revelam, depois de responder.
create table public.who_cards (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('base', 'profundo')),
  quote text not null check (length(btrim(quote)) between 5 and 300),
  options jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) = 4),
  correct_index smallint not null check (correct_index between 0 and 3),
  context text not null check (length(btrim(context)) between 10 and 500),
  reference text not null check (length(btrim(reference)) between 3 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index who_cards_active_mode_idx on public.who_cards (mode) where active;
alter table public.who_cards enable row level security;
revoke all on public.who_cards from public, anon, authenticated;

-- Só a PRIMEIRA resposta de cada leitor a cada frase vale pontos.
create table public.who_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.who_cards(id) on delete cascade,
  selected_index smallint not null check (selected_index between 0 and 3),
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.who_answers enable row level security;
revoke all on public.who_answers from public, anon, authenticated;

create function public.who_start(p_mode text, p_count integer default 10) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('base', 'profundo') or p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'Invalid mode or size' using errcode = '22023';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'mode', c.mode, 'quote', c.quote, 'options', c.options)), '[]'::jsonb) into v_result
  from (
    select c.* from public.who_cards c
    where c.active and c.mode = p_mode
    order by exists(select 1 from public.who_answers a where a.user_id = v_user and a.card_id = c.id), random()
    limit p_count
  ) c;
  return v_result;
end $$;

create function public.who_answer(p_card_id uuid, p_selected integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.who_cards;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_card_id is null or p_selected is null or p_selected < 0 or p_selected > 3 then
    raise exception 'Invalid answer' using errcode = '22023';
  end if;
  select * into v_card from public.who_cards where id = p_card_id and active;
  if not found then raise exception 'Card not found' using errcode = 'P0002'; end if;
  insert into public.who_answers (user_id, card_id, selected_index, is_correct)
    values (v_user, p_card_id, p_selected, p_selected = v_card.correct_index)
    on conflict (user_id, card_id) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('correct', p_selected = v_card.correct_index, 'correct_index', v_card.correct_index,
    'context', v_card.context, 'reference', v_card.reference, 'counted', v_rows > 0);
end $$;

create function public.get_my_who_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where a.is_correct),
    'total_cards', (select count(*) from public.who_cards where active))
    from public.who_answers a where a.user_id = v_user);
end $$;

alter function public.who_start(text, integer) owner to postgres;
alter function public.who_answer(uuid, integer) owner to postgres;
alter function public.get_my_who_stats() owner to postgres;
revoke all on function public.who_start(text, integer) from public, anon, authenticated, service_role;
revoke all on function public.who_answer(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.get_my_who_stats() from public, anon, authenticated, service_role;
grant execute on function public.who_start(text, integer) to authenticated;
grant execute on function public.who_answer(uuid, integer) to authenticated;
grant execute on function public.get_my_who_stats() to authenticated;

-- Banco inicial (conteúdo bíblico, sem dados de usuários).
insert into public.who_cards (mode, quote, options, correct_index, context, reference) values
  ('base', 'Por acaso sou eu tutor do meu irmão?', '["Esaú","Caim","Ló","Jacó"]'::jsonb, 1, 'Caim respondeu assim a Deus depois de matar o irmão, Abel, no campo.', 'Gênesis 4:9'),
  ('base', 'Eis-me aqui, envia-me a mim.', '["Samuel","Jeremias","Isaías","Moisés"]'::jsonb, 2, 'Isaías respondeu assim ao chamado de Deus, numa visão no templo, quando ouviu: “A quem enviarei?”.', 'Isaías 6:8'),
  ('base', 'Quem és tu, Senhor?', '["Pedro","Saulo","Estêvão","Ananias"]'::jsonb, 1, 'Saulo, que ainda perseguia a igreja, ouviu uma voz no caminho de Damasco e perguntou quem falava. A resposta foi: “Eu sou Jesus”.', 'Atos 9:5'),
  ('base', 'Eu e a minha casa serviremos ao Senhor.', '["Calebe","Moisés","Gideão","Josué"]'::jsonb, 3, 'Em Siquém, Josué desafiou o povo a escolher a quem serviria e declarou a própria decisão.', 'Josué 24:15'),
  ('base', 'Aqui está a serva do Senhor; cumpra-se em mim segundo a tua palavra.', '["Isabel","Maria","Ana","Marta"]'::jsonb, 1, 'Resposta de Maria ao anjo Gabriel, que lhe anunciou que seria mãe de Jesus.', 'Lucas 1:38'),
  ('base', 'Tu és o Cristo, o Filho do Deus vivo.', '["João","André","Pedro","Tomé"]'::jsonb, 2, 'Pedro respondeu assim quando Jesus perguntou aos discípulos quem eles diziam que Ele era.', 'Mateus 16:16'),
  ('base', 'Senhor meu e Deus meu!', '["Tomé","Filipe","Natanael","André"]'::jsonb, 0, 'Tomé disse isso ao ver Jesus ressuscitado, depois de ter duvidado que Ele havia voltado à vida.', 'João 20:28'),
  ('base', 'Aonde quer que fores, irei eu, e onde quer que pousares, pousarei.', '["Orfa","Noemi","Ester","Rute"]'::jsonb, 3, 'Rute disse isso à sogra, Noemi, recusando-se a voltar para a sua terra e ficando com ela.', 'Rute 1:16'),
  ('base', 'Se perecer, pereci.', '["Rute","Ester","Raabe","Jael"]'::jsonb, 1, 'Ester decidiu se apresentar ao rei sem ser chamada, para tentar salvar o povo judeu.', 'Ester 4:16'),
  ('base', 'Fala, que o teu servo ouve.', '["Eli","Davi","Samuel","Isaías"]'::jsonb, 2, 'O menino Samuel respondeu assim depois de Deus o chamar, à noite, no santuário.', '1 Samuel 3:10'),
  ('base', 'Pai, perdoa-lhes, porque não sabem o que fazem.', '["Estêvão","Jesus","Pedro","Paulo"]'::jsonb, 1, 'Jesus disse isso na cruz, a respeito de quem o crucificava.', 'Lucas 23:34'),
  ('base', 'Senhor, não sou digno de que entres debaixo do meu teto.', '["Zaqueu","Nicodemos","Um centurião romano","Pedro"]'::jsonb, 2, 'Um centurião pediu a cura do seu servo e disse que bastava Jesus dar a ordem, sem precisar ir à sua casa.', 'Mateus 8:8'),
  ('base', 'Eis o Cordeiro de Deus, que tira o pecado do mundo.', '["André","João Batista","Pedro","Simeão"]'::jsonb, 1, 'João Batista disse isso ao ver Jesus se aproximar dele, junto ao rio Jordão.', 'João 1:29'),
  ('base', 'Não te deixarei ir, se me não abençoares.', '["Esaú","Isaque","José","Jacó"]'::jsonb, 3, 'Jacó lutou com um homem (um mensageiro de Deus) até o amanhecer e pediu a bênção antes de soltá-lo.', 'Gênesis 32:26'),
  ('base', 'Quem sou eu, para ir a Faraó e tirar do Egito os filhos de Israel?', '["Arão","Josué","Moisés","Gideão"]'::jsonb, 2, 'Moisés respondeu assim a Deus, diante da sarça ardente, quando foi chamado para libertar o povo.', 'Êxodo 3:11'),
  ('base', 'O Senhor é o meu pastor; nada me faltará.', '["Salomão","Davi","Asafe","Moisés"]'::jsonb, 1, 'É o começo do salmo mais conhecido, atribuído a Davi, que também foi pastor de ovelhas.', 'Salmos 23:1'),
  ('profundo', 'Vaidade de vaidades, tudo é vaidade.', '["Davi","Jó","Salomão","Asafe"]'::jsonb, 2, 'É o refrão de Eclesiastes, dito pelo Pregador, tradicionalmente identificado com Salomão.', 'Eclesiastes 1:2'),
  ('profundo', 'O justo viverá pela sua fé.', '["Naum","Habacuque","Ageu","Sofonias"]'::jsonb, 1, 'Palavra anunciada pelo profeta Habacuque, citada depois por Paulo, em Romanos, e pela carta aos Hebreus.', 'Habacuque 2:4'),
  ('profundo', 'Que pratiques a justiça, e ames a misericórdia, e andes humildemente com o teu Deus.', '["Amós","Oseias","Joel","Miqueias"]'::jsonb, 3, 'O profeta Miqueias resume o que o Senhor espera do seu povo.', 'Miqueias 6:8'),
  ('profundo', 'Corra, porém, o juízo como as águas, e a justiça, como o ribeiro perene.', '["Amós","Oseias","Obadias","Naum"]'::jsonb, 0, 'O profeta Amós, pastor de Tecoa, denunciou a injustiça social e o culto vazio.', 'Amós 5:24'),
  ('profundo', 'Nele vivemos, e nos movemos, e existimos.', '["Pedro","Apolo","Paulo","Estêvão"]'::jsonb, 2, 'Paulo disse isso aos filósofos de Atenas, no Areópago.', 'Atos 17:28'),
  ('profundo', 'Todas as coisas me são lícitas, mas nem todas convêm.', '["Tiago","Paulo","Barnabé","Apolo"]'::jsonb, 1, 'Paulo escreveu isso à igreja de Corinto, que confundia liberdade com permissão para tudo.', '1 Coríntios 6:12'),
  ('profundo', 'Combati o bom combate, completei a carreira, guardei a fé.', '["Pedro","João","Tiago","Paulo"]'::jsonb, 3, 'Palavras de Paulo, perto do fim da vida, na última carta a Timóteo.', '2 Timóteo 4:7'),
  ('profundo', 'Eu sei que o meu Redentor vive.', '["Jó","Elifaz","Jeremias","Davi"]'::jsonb, 0, 'Jó disse isso em meio ao sofrimento, respondendo aos amigos que o acusavam.', 'Jó 19:25'),
  ('profundo', 'Ó Deus, graças te dou porque não sou como os demais homens.', '["O publicano","O fariseu da parábola","Nicodemos","Gamaliel"]'::jsonb, 1, 'É a oração do fariseu na parábola de Jesus: ele se comparava aos outros, enquanto o publicano pedia misericórdia.', 'Lucas 18:11-13'),
  ('profundo', 'Tomai-me e lançai-me ao mar, e o mar se aquietará.', '["Joel","Oseias","Jonas","Miqueias"]'::jsonb, 2, 'Jonas disse isso aos marinheiros durante a tempestade, ao reconhecer que ela vinha por causa da sua fuga.', 'Jonas 1:12'),
  ('profundo', 'A fé, se não tiver obras, por si só está morta.', '["Paulo","Tiago","Judas","Pedro"]'::jsonb, 1, 'O autor da carta de Tiago insiste que a fé verdadeira aparece nas atitudes.', 'Tiago 2:17'),
  ('profundo', 'Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós.', '["Paulo","Tiago","Barnabé","Pedro"]'::jsonb, 3, 'Pedro escreveu isso a cristãos que enfrentavam perseguição, na sua primeira carta.', '1 Pedro 5:7'),
  ('profundo', 'Até quando coxeareis entre dois pensamentos?', '["Eliseu","Elias","Samuel","Micaías"]'::jsonb, 1, 'Elias falou assim ao povo no monte Carmelo, antes de desafiar os profetas de Baal.', '1 Reis 18:21'),
  ('profundo', 'Estou fazendo uma grande obra, de modo que não posso descer.', '["Esdras","Zorobabel","Mordecai","Neemias"]'::jsonb, 3, 'Neemias respondeu assim aos inimigos que o chamavam para uma reunião enquanto reconstruía os muros de Jerusalém.', 'Neemias 6:3');

commit;
