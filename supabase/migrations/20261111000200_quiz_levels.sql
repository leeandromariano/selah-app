begin;

-- Níveis de dificuldade do quiz: 1 Iniciante, 2 Intermediário, 3 Avançado, 4 Bigode grosso.
alter table public.quiz_questions add column level smallint not null default 1 check (level between 1 and 4);

-- Classifica as perguntas do banco inicial (pelo começo do enunciado).
update public.quiz_questions q set level = v.level
from (values
  ('Quem construiu a arca', 1), ('Qual mar Deus abriu', 1), ('Quem recebeu de Deus os Dez', 1), ('Quem derrotou o gigante', 1),
  ('Qual profeta foi engolido', 1), ('Quem foi lançado na cova', 1), ('Qual é o primeiro livro da Bíblia', 1), ('Quantas pragas', 1),
  ('Qual salmo começa', 1), ('Em qual cidade Jesus nasceu', 1), ('Quem batizou Jesus', 1), ('Quantos discípulos Jesus escolheu', 1),
  ('Quem foi a mãe de Jesus', 1), ('Qual discípulo traiu', 1), ('Quem negou Jesus', 1), ('Quem desceu sobre os discípulos', 1),
  ('Qual é o último livro', 1),
  ('Em quantos dias Deus criou', 2), ('Qual é o nome do filho que Deus prometeu', 2), ('Quem foi vendido pelos irmãos', 2),
  ('Qual foi o novo nome dado a Jacó', 2), ('Quem liderou Israel quando os muros', 2), ('Qual juiz de Israel era conhecido', 2),
  ('Quem disse: “o teu povo', 2), ('Quem foi o primeiro rei de Israel', 2), ('Quem era o pai de Davi', 2),
  ('Qual rei de Israel pediu a Deus', 2), ('Qual profeta foi levado ao céu', 2), ('Qual rainha corajosa', 2),
  ('Qual foi o primeiro sinal', 2), ('Qual discípulo era cobrador', 2), ('Em que livro do Novo Testamento está o texto', 2),
  ('Qual discípulo andou sobre as águas', 2), ('O que Jesus usou para alimentar', 2), ('Quem era o homem de baixa estatura', 2),
  ('Quem Jesus ressuscitou', 2), ('Qual parábola de Jesus', 2), ('Quem se converteu depois', 2), ('Em qual ilha', 2),
  ('Em qual monte o profeta Elias', 3), ('Quem reconstruiu os muros', 3), ('Quem perdeu bens e filhos', 3),
  ('Quais eram os nomes dos pais de João Batista', 3), ('Quem foi o primeiro mártir', 3), ('Qual carta de Paulo contém o capítulo sobre o amor', 3),
  ('Qual é o primeiro fruto do Espírito', 3), ('Em qual carta Paulo escreve', 3), ('Quem era o médico que escreveu', 3)
) as v(prefix, level)
where left(q.prompt, length(v.prefix)) = v.prefix;

create index quiz_questions_active_level_idx on public.quiz_questions (level, testament) where active;

-- A rodada agora pede também o nível. A assinatura antiga deixa de existir.
drop function public.quiz_start(text, integer);
create function public.quiz_start(p_mode text, p_level integer, p_count integer default 10) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_result jsonb;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_mode is null or p_mode not in ('antigo', 'novo', 'biblia') or p_level is null or p_level < 1 or p_level > 4
    or p_count is null or p_count < 1 or p_count > 20 then
    raise exception 'Invalid quiz mode, level or size' using errcode = '22023';
  end if;
  -- Perguntas ainda não respondidas vêm primeiro; depois, as já respondidas (sem valer pontos de novo).
  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'testament', q.testament, 'level', q.level, 'prompt', q.prompt, 'options', q.options)), '[]'::jsonb)
    into v_result
  from (
    select q.* from public.quiz_questions q
    where q.active and q.level = p_level and (p_mode = 'biblia' or q.testament = p_mode)
    order by exists(select 1 from public.quiz_answers a where a.user_id = v_user and a.question_id = q.id), random()
    limit p_count
  ) q;
  return v_result;
end $$;
alter function public.quiz_start(text, integer, integer) owner to postgres;
revoke all on function public.quiz_start(text, integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.quiz_start(text, integer, integer) to authenticated;

-- Novas perguntas (conteúdo bíblico, sem dados de usuários).
insert into public.quiz_questions (testament, level, prompt, options, correct_index, reference) values
  -- Iniciante
  ('antigo', 1, 'Qual foi o nome do primeiro homem criado por Deus?', '["Abel","Adão","Sete","Enoque"]'::jsonb, 1, 'Gênesis 2:7'),
  ('antigo', 1, 'Quem foi a primeira mulher, esposa de Adão?', '["Sara","Lia","Eva","Raquel"]'::jsonb, 2, 'Gênesis 3:20'),
  ('antigo', 1, 'Quem matou o próprio irmão Abel?', '["Caim","Sete","Lameque","Esaú"]'::jsonb, 0, 'Gênesis 4:8'),
  ('novo', 1, 'Quem seguiu a estrela para adorar o menino Jesus?', '["Os pastores de Belém","Os magos do oriente","Os sacerdotes do templo","Os soldados romanos"]'::jsonb, 1, 'Mateus 2:1-2'),
  ('novo', 1, 'Como se chamava o esposo de Maria, pai terreno de Jesus?', '["Zacarias","Joaquim","José","Simeão"]'::jsonb, 2, 'Mateus 1:16'),
  ('novo', 1, 'Em qual cidade da Galileia Jesus cresceu?', '["Belém","Jericó","Betânia","Nazaré"]'::jsonb, 3, 'Lucas 4:16'),
  -- Intermediário
  ('antigo', 2, 'Por quantos anos o povo de Israel andou pelo deserto antes de entrar em Canaã?', '["Dez anos","Quarenta anos","Setenta anos","Doze anos"]'::jsonb, 1, 'Números 14:33-34'),
  ('antigo', 2, 'Qual rei é identificado nos títulos como autor de muitos Salmos?', '["Davi","Samuel","Josué","Ezequias"]'::jsonb, 0, 'Salmos 3:1'),
  ('antigo', 2, 'Como se chamava a esposa de Abraão?', '["Rebeca","Agar","Sara","Raquel"]'::jsonb, 2, 'Gênesis 17:15'),
  ('antigo', 2, 'Quem foi o irmão gêmeo de Jacó?', '["Ismael","Rúben","Benjamim","Esaú"]'::jsonb, 3, 'Gênesis 25:24-26'),
  ('antigo', 2, 'Junto com Gomorra, qual cidade Deus destruiu com enxofre e fogo?', '["Sodoma","Jericó","Nínive","Babel"]'::jsonb, 0, 'Gênesis 19:24'),
  ('novo', 2, 'Qual discípulo disse que só creria na ressurreição se visse as marcas dos cravos nas mãos de Jesus?', '["Pedro","Tomé","André","Filipe"]'::jsonb, 1, 'João 20:25'),
  ('novo', 2, 'Qual governador romano entregou Jesus para ser crucificado?', '["Herodes","César Augusto","Pilatos","Félix"]'::jsonb, 2, 'Mateus 27:26'),
  ('novo', 2, 'Em qual jardim Jesus orou antes de ser preso?', '["Éden","Betânia","Siloé","Getsêmani"]'::jsonb, 3, 'Mateus 26:36'),
  -- Avançado
  ('antigo', 3, 'Quem era o sogro de Moisés, sacerdote de Midiã?', '["Jetro","Balaão","Eli","Calebe"]'::jsonb, 0, 'Êxodo 3:1'),
  ('antigo', 3, 'Qual profeta viu o vale cheio de ossos secos que voltaram a viver?', '["Isaías","Jeremias","Ezequiel","Zacarias"]'::jsonb, 2, 'Ezequiel 37:1-10'),
  ('antigo', 3, 'Qual profetisa e juíza liderou Israel, junto com Baraque, contra Sísera?', '["Jael","Débora","Miriã","Hulda"]'::jsonb, 1, 'Juízes 4:4-9'),
  ('antigo', 3, 'Qual sacerdote criou o menino Samuel no santuário de Siló?', '["Eli","Zadoque","Abiatar","Arão"]'::jsonb, 0, '1 Samuel 2:11'),
  ('antigo', 3, 'Qual rei de Judá, ao encontrar o Livro da Lei no templo, promoveu uma grande reforma?', '["Ezequias","Acaz","Josias","Manassés"]'::jsonb, 2, '2 Reis 22:8'),
  ('antigo', 3, 'Qual rei de Judá recebeu de Deus mais quinze anos de vida depois de orar doente?', '["Davi","Ezequias","Josias","Asa"]'::jsonb, 1, '2 Reis 20:6'),
  ('antigo', 3, 'Como se chamava a esposa de Moisés, filha de Jetro?', '["Miriã","Zípora","Raabe","Ada"]'::jsonb, 1, 'Êxodo 2:21'),
  ('antigo', 3, 'Qual profeta viu o Senhor assentado num alto trono no ano da morte do rei Uzias?', '["Isaías","Amós","Jeremias","Ezequiel"]'::jsonb, 0, 'Isaías 6:1'),
  ('antigo', 3, 'Quem era o sacerdote e escriba que leu o Livro da Lei ao povo, com Neemias, em Jerusalém?', '["Zorobabel","Mordecai","Malaquias","Esdras"]'::jsonb, 3, 'Neemias 8:1-3'),
  ('antigo', 3, 'Que rei da Babilônia viu uma mão escrever na parede durante um banquete?', '["Nabucodonosor","Dario","Belsazar","Ciro"]'::jsonb, 2, 'Daniel 5:1-5'),
  ('novo', 3, 'Qual fariseu, membro do conselho, visitou Jesus de noite?', '["Nicodemos","Gamaliel","José de Arimateia","Saulo"]'::jsonb, 0, 'João 3:1-2'),
  ('novo', 3, 'Qual discípula de Jope foi ressuscitada por Pedro?', '["Marta","Priscila","Tabita (Dorcas)","Febe"]'::jsonb, 2, 'Atos 9:36-41'),
  ('novo', 3, 'Como se chamava o mendigo cego de Jericó que clamou: “Filho de Davi, tem misericórdia de mim”?', '["Lázaro","Zaqueu","Simeão","Bartimeu"]'::jsonb, 3, 'Marcos 10:46-47'),
  ('novo', 3, 'Por qual escravo fugitivo Paulo intercede na carta a Filemom?', '["Tíquico","Onésimo","Epafras","Tito"]'::jsonb, 1, 'Filemom 1:10'),
  ('novo', 3, 'Quem tomou o menino Jesus nos braços no templo e louvou a Deus?', '["Zacarias","Simeão","Eli","José"]'::jsonb, 1, 'Lucas 2:28'),
  ('novo', 3, 'Qual centurião de Cesareia ouviu Pedro e recebeu o Espírito Santo com sua casa?', '["Júlio","Públio","Cornélio","Sérgio Paulo"]'::jsonb, 2, 'Atos 10:44'),
  ('novo', 3, 'Qual discípulo, chamado “filho da consolação”, acompanhou Paulo na primeira viagem missionária?', '["Silas","Barnabé","Timóteo","Marcos"]'::jsonb, 1, 'Atos 4:36'),
  -- Bigode grosso
  ('antigo', 4, 'Qual rei de Salém e sacerdote do Deus Altíssimo abençoou Abraão?', '["Abimeleque","Jetro","Melquisedeque","Adonias"]'::jsonb, 2, 'Gênesis 14:18-19'),
  ('antigo', 4, 'Quem foi a mãe de Judá, filho de Jacó?', '["Zilpa","Léia","Raquel","Bila"]'::jsonb, 1, 'Gênesis 29:35'),
  ('antigo', 4, 'Quem era o pai do profeta Jonas?', '["Amitai","Hilquias","Josafá","Elcana"]'::jsonb, 0, 'Jonas 1:1'),
  ('antigo', 4, 'Qual profeta, pastor em Tecoa, também cultivava sicômoros?', '["Oseias","Miqueias","Amós","Naum"]'::jsonb, 2, 'Amós 7:14-15'),
  ('antigo', 4, 'Qual juiz canhoto livrou Israel matando o rei Eglom, de Moabe?', '["Sangar","Eúde","Baraque","Jefté"]'::jsonb, 1, 'Juízes 3:15-21'),
  ('antigo', 4, 'Que nome babilônico deram a Daniel na corte de Nabucodonosor?', '["Sadraque","Abede-Nego","Beltessazar","Mesaque"]'::jsonb, 2, 'Daniel 1:7'),
  ('antigo', 4, 'Quem foi o pai de Matusalém, que andou com Deus e foi levado por Ele?', '["Lameque","Enoque","Sete","Cainã"]'::jsonb, 1, 'Gênesis 5:21-24'),
  ('antigo', 4, 'Quantos anos viveu Matusalém, o homem mais longevo registrado na Bíblia?', '["930 anos","950 anos","969 anos","912 anos"]'::jsonb, 2, 'Gênesis 5:27'),
  ('antigo', 4, 'Qual livro profético tem apenas um capítulo e anuncia juízo sobre Edom?', '["Naum","Habacuque","Ageu","Obadias"]'::jsonb, 3, 'Obadias 1:1'),
  ('antigo', 4, 'Em qual terra Deus mandou Abraão ir para oferecer Isaque em holocausto?', '["Horebe","Gerizim","Moriá","Hermom"]'::jsonb, 2, 'Gênesis 22:2'),
  ('antigo', 4, 'De qual monte Moisés contemplou a terra prometida antes de morrer?', '["Nebo","Sinai","Tabor","Carmelo"]'::jsonb, 0, 'Deuteronômio 34:1'),
  ('novo', 4, 'Qual profetisa idosa, filha de Fanuel, falou do menino Jesus a todos no templo?', '["Isabel","Hulda","Miriã","Ana"]'::jsonb, 3, 'Lucas 2:36-38'),
  ('novo', 4, 'Quem foi escolhido por sorteio para ocupar o lugar de Judas entre os doze?', '["Barsabás","Matias","Silas","Barnabé"]'::jsonb, 1, 'Atos 1:26'),
  ('novo', 4, 'Qual casal explicou com mais exatidão o caminho de Deus a Apolo?', '["Ananias e Safira","Zacarias e Isabel","Priscila e Áquila","Filemom e Áfia"]'::jsonb, 2, 'Atos 18:26'),
  ('novo', 4, 'Como se chamava o mágico de Samaria que quis comprar o dom do Espírito Santo?', '["Elimas","Simão","Demas","Alexandre"]'::jsonb, 1, 'Atos 8:18-19'),
  ('novo', 4, 'Como se chamava o servo do sumo sacerdote que teve a orelha cortada por Pedro?', '["Barrabás","Caifás","Malco","Jairo"]'::jsonb, 2, 'João 18:10'),
  ('novo', 4, 'Qual mulher de Filipos, vendedora de púrpura, abriu sua casa a Paulo depois de ouvir a pregação?', '["Febe","Lídia","Dorcas","Eunice"]'::jsonb, 1, 'Atos 16:14-15'),
  ('novo', 4, 'Qual jovem caiu da janela, adormecido, durante a longa pregação de Paulo em Trôade?', '["Timóteo","Tíquico","Marcos","Êutico"]'::jsonb, 3, 'Atos 20:9'),
  ('novo', 4, 'Qual dos sete diáconos explicou as Escrituras ao eunuco etíope?', '["Estêvão","Filipe","Nicanor","Prócoro"]'::jsonb, 1, 'Atos 8:26-38'),
  ('novo', 4, 'Quem era o sogro de Caifás?', '["Nicodemos","Gamaliel","Anás","Herodes"]'::jsonb, 2, 'João 18:13');

commit;
