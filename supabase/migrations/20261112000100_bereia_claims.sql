begin;

-- "Tá na Bíblia ou Tá Amarrado?": cartas com frases conhecidas. O leitor decide se a frase está na Bíblia.
-- O veredito, a explicação e a passagem NUNCA são legíveis diretamente: só as funções abaixo
-- (security definer) os revelam, e apenas depois que o leitor responde.
create table public.claim_cards (
  id uuid primary key default gen_random_uuid(),
  statement text not null check (length(btrim(statement)) between 5 and 300),
  verdict text not null check (verdict in ('biblia', 'distorcida', 'invencao')),
  explanation text not null check (length(btrim(explanation)) between 10 and 600),
  reference text check (reference is null or length(btrim(reference)) between 3 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.claim_cards enable row level security;
revoke all on public.claim_cards from public, anon, authenticated;

-- Só a PRIMEIRA resposta de cada leitor a cada carta vale pontos.
create table public.claim_answers (
  user_id uuid not null references auth.users(id) on delete cascade,
  card_id uuid not null references public.claim_cards(id) on delete cascade,
  said_in_bible boolean not null,
  is_correct boolean not null,
  answered_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.claim_answers enable row level security;
revoke all on public.claim_answers from public, anon, authenticated;

create function public.claims_start(p_count integer default 5) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_count is null or p_count < 1 or p_count > 10 then raise exception 'Invalid size' using errcode = '22023'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'statement', c.statement)), '[]'::jsonb) into v_result
  from (
    select c.* from public.claim_cards c
    where c.active
    order by exists(select 1 from public.claim_answers a where a.user_id = v_user and a.card_id = c.id), random()
    limit p_count
  ) c;
  return v_result;
end $$;

create function public.claims_answer(p_card_id uuid, p_said_in_bible boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_card public.claim_cards;
  v_correct boolean;
  v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_card_id is null or p_said_in_bible is null then raise exception 'Invalid answer' using errcode = '22023'; end if;
  select * into v_card from public.claim_cards where id = p_card_id and active;
  if not found then raise exception 'Card not found' using errcode = 'P0002'; end if;
  -- "Tá na Bíblia" só acerta quando a frase realmente está lá; distorcida e invenção são "Tá amarrado".
  v_correct := p_said_in_bible = (v_card.verdict = 'biblia');
  insert into public.claim_answers (user_id, card_id, said_in_bible, is_correct)
    values (v_user, p_card_id, p_said_in_bible, v_correct)
    on conflict (user_id, card_id) do nothing;
  get diagnostics v_rows = row_count;
  return jsonb_build_object('correct', v_correct, 'verdict', v_card.verdict, 'explanation', v_card.explanation,
    'reference', v_card.reference, 'counted', v_rows > 0);
end $$;

create function public.get_my_claims_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return (select jsonb_build_object('answered', count(*), 'correct', count(*) filter (where a.is_correct),
    'total_cards', (select count(*) from public.claim_cards where active))
    from public.claim_answers a where a.user_id = v_user);
end $$;

alter function public.claims_start(integer) owner to postgres;
alter function public.claims_answer(uuid, boolean) owner to postgres;
alter function public.get_my_claims_stats() owner to postgres;
revoke all on function public.claims_start(integer) from public, anon, authenticated, service_role;
revoke all on function public.claims_answer(uuid, boolean) from public, anon, authenticated, service_role;
revoke all on function public.get_my_claims_stats() from public, anon, authenticated, service_role;
grant execute on function public.claims_start(integer) to authenticated;
grant execute on function public.claims_answer(uuid, boolean) to authenticated;
grant execute on function public.get_my_claims_stats() to authenticated;

-- Banco inicial de cartas (conteúdo bíblico e ditados populares, sem dados de usuários).
insert into public.claim_cards (statement, verdict, explanation, reference) values
  ('Deus ajuda quem cedo madruga.', 'invencao', 'É um ditado popular, não um versículo. O Salmo 127 chega a dizer o contrário: que não adianta se matar de trabalhar, porque Deus cuida de quem Ele ama enquanto descansa.', 'Salmos 127:2'),
  ('O dinheiro é a raiz de todos os males.', 'distorcida', 'O versículo não condena o dinheiro, e sim o amor ao dinheiro. Paulo alerta que a ganância desvia o coração e traz muitas dores.', '1 Timóteo 6:10'),
  ('Caiu na rede é peixe.', 'invencao', 'É uma expressão popular. A Bíblia fala de redes e de pesca (como na pesca maravilhosa que Jesus proporcionou), mas esse dito não está nela.', 'Lucas 5:4-6'),
  ('Ajuda-te, que Deus te ajudará.', 'invencao', 'Muita gente acha que é versículo, mas é um provérbio popular, de origem não bíblica. A Bíblia ensina que o nosso socorro vem do Senhor.', 'Salmos 121:1-2'),
  ('Deus não dá um fardo maior do que podemos carregar.', 'distorcida', 'Paulo fala de tentação, não de sofrimento em geral: Deus é fiel e dá livramento para quem é tentado. A frase popular transforma isso numa promessa sobre qualquer prova.', '1 Coríntios 10:13'),
  ('Deus escreve certo por linhas tortas.', 'invencao', 'É um provérbio popular. A Bíblia ensina algo próximo, mas não com essas palavras: Deus age em todas as coisas para o bem dos que o amam.', 'Romanos 8:28'),
  ('Deus não escolhe os capacitados; Ele capacita os escolhidos.', 'invencao', 'A frase é popular, mas não é versículo. A ideia de que Deus usa os que o mundo despreza aparece em Paulo, com outras palavras.', '1 Coríntios 1:27'),
  ('Faz o bem sem olhar a quem.', 'invencao', 'É um ditado popular. A Bíblia incentiva a fazer o bem a todos, com ênfase especial aos da família da fé.', 'Gálatas 6:10'),
  ('A Bíblia diz que Jesus nasceu em 25 de dezembro.', 'invencao', 'Nenhum texto bíblico dá a data do nascimento de Jesus. O relato menciona pastores no campo guardando rebanhos, e 25 de dezembro é uma tradição posterior.', 'Lucas 2:8'),
  ('Eva comeu uma maçã no Éden.', 'distorcida', 'O texto fala apenas em “fruto” da árvore. A maçã entrou na tradição e na arte muito depois, e não aparece em Gênesis.', 'Gênesis 3:6'),
  ('Três reis magos visitaram o menino Jesus.', 'distorcida', 'O texto fala em “magos”, não em reis, e não diz quantos eram. A tradição dos três vem dos três presentes mencionados.', 'Mateus 2:11'),
  ('Uma baleia engoliu Jonas.', 'distorcida', 'O livro de Jonas diz que Deus preparou “um grande peixe”. A palavra “baleia” é uma tradição posterior.', 'Jonas 1:17'),
  ('“Tudo posso naquele que me fortalece” significa que Deus realizará qualquer sonho meu.', 'distorcida', 'No contexto, Paulo está falando de contentamento: viver bem tanto na fartura quanto na escassez, com a força de Cristo. Não é promessa de realizar todo desejo.', 'Filipenses 4:11-13'),
  ('Não julgueis, para que não sejais julgados.', 'biblia', 'Está nas palavras de Jesus no Sermão do Monte. O contexto é o julgamento hipócrita: logo adiante, Ele fala de tirar primeiro a trave do próprio olho.', 'Mateus 7:1'),
  ('Tudo tem o seu tempo determinado, e há tempo para todo propósito debaixo do céu.', 'biblia', 'É o começo do famoso poema de Eclesiastes sobre as estações da vida.', 'Eclesiastes 3:1'),
  ('A fé é a certeza de coisas que se esperam, a convicção de fatos que se não veem.', 'biblia', 'É a definição de fé que abre o capítulo dos heróis da fé, em Hebreus.', 'Hebreus 11:1'),
  ('Vigiai e orai, para que não entreis em tentação.', 'biblia', 'Jesus disse isso aos discípulos no Getsêmani, na noite em que foi preso.', 'Mateus 26:41'),
  ('Que vos ameis uns aos outros; assim como eu vos amei.', 'biblia', 'É o “novo mandamento” que Jesus deu na última ceia, segundo o Evangelho de João.', 'João 13:34'),
  ('Dai a César o que é de César e a Deus o que é de Deus.', 'biblia', 'Resposta de Jesus a quem perguntou se era lícito pagar imposto ao imperador.', 'Marcos 12:17'),
  ('Pelos seus frutos os conhecereis.', 'biblia', 'Jesus ensina a reconhecer falsos profetas pelo fruto que produzem, não pelas palavras.', 'Mateus 7:20'),
  ('Olho por olho, dente por dente.', 'biblia', 'Está na Lei de Moisés, como limite à vingança (a pena não podia passar do dano). Jesus depois ensinou a ir além e não retribuir o mal.', 'Êxodo 21:24'),
  ('Deus é amor.', 'biblia', 'Está na primeira carta de João, que liga o conhecer a Deus ao amar uns aos outros.', '1 João 4:8'),
  ('Se alguém não quer trabalhar, também não coma.', 'biblia', 'Paulo escreveu isso aos tessalonicenses sobre quem se recusava a trabalhar, e não sobre quem não consegue por doença ou falta de oportunidade.', '2 Tessalonicenses 3:10'),
  ('O Senhor o deu, e o Senhor o tomou; bendito seja o nome do Senhor.', 'biblia', 'São palavras de Jó ao perder tudo. O livro mostra depois que seus amigos erraram ao interpretar o sofrimento dele.', 'Jó 1:21');

commit;
