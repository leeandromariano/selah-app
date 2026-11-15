-- Raio-X do Texto: explicações curtas de termos bíblicos (sentido no original, contexto da época e um versículo
-- paralelo), ligadas aos versículos onde valem. O leitor só recebe o que está publicado; o OWNER edita e publica.
-- Os termos iniciais entram como RASCUNHO: nada aparece para os leitores até o OWNER revisar e publicar.
-- Segue o padrão do projeto: RLS ligado, nenhum acesso direto, tudo por funções security definer.

create table public.study_terms (
  id uuid primary key default gen_random_uuid(),
  term text not null check (char_length(btrim(term)) between 2 and 60),
  words text[] not null check (cardinality(words) between 1 and 10),
  original text not null check (char_length(btrim(original)) between 1 and 300),
  context text not null check (char_length(btrim(context)) between 1 and 500),
  parallel_reference text not null check (char_length(btrim(parallel_reference)) between 3 and 80),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create table public.study_term_verses (
  term_id uuid not null references public.study_terms(id) on delete cascade,
  book text not null check (book ~ '^[a-z0-9-]{2,30}$'),
  chapter integer not null check (chapter between 1 and 150),
  verse_start integer not null check (verse_start between 1 and 176),
  verse_end integer not null check (verse_end between 1 and 176),
  primary key (term_id, book, chapter, verse_start, verse_end),
  check (verse_end >= verse_start)
);
create index study_term_verses_lookup on public.study_term_verses (book, chapter);
alter table public.study_terms enable row level security;
alter table public.study_term_verses enable row level security;
revoke all on public.study_terms, public.study_term_verses from public, anon, authenticated, service_role;

-- Leitor: termos PUBLICADOS que valem em algum versículo do capítulo.
create function public.get_study_terms(p_book text, p_chapter integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_book is null or p_book !~ '^[a-z0-9-]{2,30}$' or p_chapter is null or p_chapter not between 1 and 150 then
    raise exception 'Invalid chapter' using errcode = '22023';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'term', t.term, 'words', to_jsonb(t.words), 'original', t.original, 'context', t.context,
      'parallel_reference', t.parallel_reference,
      'verses', (select jsonb_agg(jsonb_build_object('start', v.verse_start, 'end', v.verse_end) order by v.verse_start)
                 from public.study_term_verses v where v.term_id = t.id and v.book = p_book and v.chapter = p_chapter)
    ) order by t.term)
    from public.study_terms t
    where t.status = 'published'
      and exists (select 1 from public.study_term_verses v where v.term_id = t.id and v.book = p_book and v.chapter = p_chapter)
  ), '[]'::jsonb);
end $$;
alter function public.get_study_terms(text, integer) owner to postgres;
revoke all on function public.get_study_terms(text, integer) from public, anon, authenticated, service_role;
grant execute on function public.get_study_terms(text, integer) to authenticated;

-- OWNER: lista tudo (rascunhos e publicados), com os versículos de cada termo.
create function public.owner_list_study_terms() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'term', t.term, 'words', to_jsonb(t.words), 'original', t.original, 'context', t.context,
      'parallel_reference', t.parallel_reference, 'status', t.status,
      'verses', coalesce((select jsonb_agg(jsonb_build_object('book', v.book, 'chapter', v.chapter, 'start', v.verse_start, 'end', v.verse_end)
                          order by v.book, v.chapter, v.verse_start) from public.study_term_verses v where v.term_id = t.id), '[]'::jsonb)
    ) order by t.term)
    from public.study_terms t
  ), '[]'::jsonb);
end $$;
alter function public.owner_list_study_terms() owner to postgres;
revoke all on function public.owner_list_study_terms() from public, anon, authenticated, service_role;
grant execute on function public.owner_list_study_terms() to authenticated;

-- OWNER: cria (p_id nulo) ou atualiza um termo e troca a lista de versículos. p_verses: [{book, chapter, start, end}].
create function public.owner_save_study_term(
  p_id uuid, p_term text, p_words text[], p_original text, p_context text, p_parallel text, p_status text, p_verses jsonb
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_clean text[]; item jsonb;
begin
  perform private.owner_identity();
  if p_status is null or p_status not in ('draft', 'published') then raise exception 'Invalid status' using errcode = '22023'; end if;
  select coalesce(array_agg(w), '{}') into v_clean from (select distinct btrim(w) as w from unnest(coalesce(p_words, '{}')) w where char_length(btrim(w)) between 1 and 40) s;
  if p_term is null or cardinality(v_clean) = 0 or jsonb_typeof(p_verses) is distinct from 'array' or jsonb_array_length(p_verses) = 0 or jsonb_array_length(p_verses) > 60 then
    raise exception 'Invalid study term' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.study_terms(term, words, original, context, parallel_reference, status)
    values (btrim(p_term), v_clean, btrim(p_original), btrim(p_context), btrim(p_parallel), p_status) returning id into v_id;
  else
    update public.study_terms set term = btrim(p_term), words = v_clean, original = btrim(p_original), context = btrim(p_context),
      parallel_reference = btrim(p_parallel), status = p_status, updated_at = clock_timestamp()
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
alter function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb) owner to postgres;
revoke all on function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb) from public, anon, authenticated, service_role;
grant execute on function public.owner_save_study_term(uuid, text, text[], text, text, text, text, jsonb) to authenticated;

create function public.owner_delete_study_term(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  delete from public.study_terms where id = p_id;
end $$;
alter function public.owner_delete_study_term(uuid) owner to postgres;
revoke all on function public.owner_delete_study_term(uuid) from public, anon, authenticated, service_role;
grant execute on function public.owner_delete_study_term(uuid) to authenticated;

-- Primeiro lote, como RASCUNHO para revisão teológica do OWNER. Linguagem direta, em até três ideias por termo.
with seed(term, words, original, context, parallel_reference, verses) as (values
  ('Graça', array['graça','graças'],
   'Do grego charis: favor dado de graça, sem ser merecido nem comprado.',
   'No mundo greco-romano, um favor criava dívida: quem recebia ficava devendo ao benfeitor. A graça de Deus quebra essa lógica: não cobra retribuição.',
   'Romanos 11:6', 'efesios:2:8-8,romanos:3:24-24,tito:2:11-11,romanos:5:20-20,2-corintios:12:9-9'),
  ('Aliança', array['aliança','alianças'],
   'Do hebraico berit: compromisso solene entre duas partes, selado com juramento. No Antigo Testamento se "cortava" uma aliança.',
   'Reis do Antigo Oriente firmavam alianças com povos menores: o rei prometia proteção; o povo, lealdade. Deus usa uma linguagem que todos conheciam para se comprometer com o seu povo.',
   'Hebreus 8:10', 'genesis:15:18-18,genesis:17:7-7,exodo:24:8-8,jeremias:31:31-31,lucas:22:20-20,hebreus:8:6-6'),
  ('Propiciação', array['propiciação','propiciatório'],
   'Do grego hilasmos: o que aplaca a justa ira e restaura a amizade com Deus.',
   'Nos templos pagãos, o povo oferecia sacrifícios para acalmar deuses irritados. Na Bíblia é diferente: é o próprio Deus quem providencia o sacrifício, em Cristo.',
   'Hebreus 2:17', 'romanos:3:25-25,1-joao:2:2-2,1-joao:4:10-10,hebreus:2:17-17'),
  ('Justificação', array['justificação','justificados','justificado','justifica','justificou','justificar','declarados justos'],
   'Do grego dikaioo: declarar justo. É um veredito, não um processo de melhora.',
   'Era linguagem de tribunal: o juiz declarava o réu inocente. Paulo usa essa cena: Deus, o juiz, declara justo quem confia em Cristo.',
   'Romanos 4:5', 'romanos:3:24-24,romanos:3:28-28,romanos:5:1-1,galatas:2:16-16'),
  ('Redenção', array['redenção','redimir','redimiu','redimidos','resgate'],
   'Do grego apolytrosis: pagar o preço para libertar alguém.',
   'No Império Romano, escravos eram libertados mediante um resgate. É a imagem usada para dizer que Cristo pagou o preço da nossa liberdade.',
   '1 Pedro 1:18-19', 'efesios:1:7-7,colossenses:1:14-14,marcos:10:45-45,romanos:3:24-24,tito:2:14-14'),
  ('Arrependimento', array['arrependimento','arrepender','arrependam','arrependei','arrependido','arrependida','arrependidos'],
   'Do grego metanoia: mudança de mente. No hebraico, shuv: voltar, mudar de direção.',
   'Para um judeu, voltar (shuv) era voltar à aliança, como o filho que retorna à casa do pai. Não é só sentir culpa: é virar-se por inteiro para Deus.',
   'Lucas 15:20', 'marcos:1:15-15,atos:3:19-19,lucas:15:7-7,2-corintios:7:10-10,mateus:3:2-2'),
  ('Fé', array['fé'],
   'Do grego pistis: confiança e fidelidade. É apoiar-se em alguém, não só concordar com ideias.',
   'No mundo romano, pistis também era a lealdade numa relação, como a de um cliente com o seu protetor. Fé bíblica é confiar e permanecer fiel.',
   'Hebreus 11:6', 'hebreus:11:1-1,romanos:10:17-17,efesios:2:8-8,tiago:2:17-17'),
  ('Reconciliação', array['reconciliação','reconciliou','reconciliar','reconciliados'],
   'Do grego katallage: troca de inimizade por amizade.',
   'Era palavra do mundo diplomático e dos tratados de paz: inimigos passavam a ser aliados. Paulo diz que foi Deus quem tomou a iniciativa do tratado.',
   'Colossenses 1:20', '2-corintios:5:18-19,romanos:5:10-10,colossenses:1:20-20'),
  ('Santo', array['santo','santa','santos','santificação','santificados','santificar'],
   'Do hebraico qadosh: separado, reservado para Deus.',
   'No templo, objetos santos eram separados do uso comum e reservados para o culto. Povo santo é povo reservado para Deus, não povo perfeito.',
   '1 Pedro 1:15-16', '1-pedro:1:16-16,levitico:19:2-2,1-tessalonicenses:4:3-3,hebreus:12:14-14'),
  ('Misericórdia', array['misericórdia','misericórdias','amor leal','amor fiel'],
   'Do hebraico hesed: amor leal, que não larga mesmo quando o outro falha. Rachamim vem da palavra para "ventre": compaixão profunda.',
   'Hesed é o compromisso de aliança em ação: Deus continua fiel mesmo quando o povo não é.',
   'Lamentações 3:22-23', 'salmos:23:6-6,lamentacoes:3:22-22,miqueias:6:8-8,efesios:2:4-4,lucas:6:36-36'),
  ('Paz', array['paz'],
   'Do hebraico shalom: inteireza, bem-estar completo. Vai além da ausência de conflito.',
   'Shalom era a saudação do dia a dia: desejar que o outro esteja inteiro, no corpo, na família, nas relações e na comunidade.',
   'Isaías 26:3', 'joao:14:27-27,filipenses:4:7-7,isaias:26:3-3,romanos:5:1-1,numeros:6:26-26'),
  ('Evangelho', array['evangelho'],
   'Do grego euangelion: boa notícia, notícia de vitória.',
   'Euangelion anunciava a vitória do exército ou a chegada de um novo imperador. Dizer que Jesus é Senhor, nesse vocabulário, é dizer: o verdadeiro Rei chegou.',
   'Romanos 1:16', 'marcos:1:1-1,marcos:1:15-15,romanos:1:16-16,1-corintios:15:1-1'),
  ('Expiação', array['expiação','expiar','expiou'],
   'Do hebraico kipper: cobrir, limpar, fazer a reparação.',
   'No Dia da Expiação, o sacerdote entrava uma vez por ano no lugar santíssimo com o sangue do sacrifício. Hebreus mostra Cristo fazendo isso de uma vez por todas.',
   'Hebreus 9:12', 'levitico:16:30-30,levitico:17:11-11,hebreus:9:12-12,hebreus:2:17-17'),
  ('Amor (ágape)', array['amor','amai','amar'],
   'Do grego agape: amor que se entrega por escolha, e não só por sentimento.',
   'O grego tinha outras palavras para amor (eros, philia). Os autores do Novo Testamento escolheram agape, pouco usada, para falar de um amor que se doa sem esperar retorno.',
   '1 João 4:10', 'joao:3:16-16,romanos:5:8-8,1-joao:4:8-8,1-corintios:13:4-4'),
  ('Glória', array['glória','glorificar','glorificado'],
   'Do hebraico kavod: peso, valor real. Dar glória a alguém é reconhecer o peso dele.',
   'Kavod vem da ideia de peso. A presença de Deus era descrita como uma nuvem densa e luminosa, impossível de ignorar.',
   'João 1:14', 'exodo:33:18-18,salmos:19:1-1,joao:1:14-14,romanos:3:23-23')
), inserted as (
  insert into public.study_terms(term, words, original, context, parallel_reference, status)
  select term, words, original, context, parallel_reference, 'draft' from seed returning id, term
)
insert into public.study_term_verses(term_id, book, chapter, verse_start, verse_end)
select i.id, split_part(ref, ':', 1), split_part(ref, ':', 2)::integer, split_part(split_part(ref, ':', 3), '-', 1)::integer, split_part(split_part(ref, ':', 3), '-', 2)::integer
from seed s join inserted i on i.term = s.term, unnest(string_to_array(s.verses, ',')) as ref
on conflict do nothing;
