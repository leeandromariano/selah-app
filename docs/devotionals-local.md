# Etapa 18.2 — publicações e aberturas persistentes locais

> Atualização 22.1: conclusões voluntárias e tempo confirmado agora existem em
> registros separados. Aberturas continuam independentes. Após exclusão, a FK de
> uma abertura fica nula, preservando o evento. Regras atuais, limites e resultados
> em [reading-local.md](reading-local.md). O relato da Etapa 18.2 abaixo é histórico.

Branch `feat/local-auth`, referência `6e2c793`. Não houve publicação, commit
automático, reset ou acesso ao Supabase remoto. Nenhuma migração foi necessária;
todo o diretório supabase permanece igual à referência.

## Diferenças identificadas antes da implementação

A inspeção do PostgreSQL local em execução confirmou `devotionals`: id UUID,
title, bible_reference, bible_text, content, reflection_question, publish_at
(timestamptz), status (draft/scheduled/published), author_id, created_at e updated_at.
`devotional_views` possui id UUID, devotional_id, user_id e opened_at. Não há
tabela de conclusões nem coluna que distinga leitura concluída de visualização.

O modelo demonstrativo tinha IDs numéricos, tema, resumo, minutos e uma marcação
volátil de conclusão, ausentes no schema. A solução mais simples preserva as
tabelas e RLS existentes: UUIDs na navegação, prévia derivada de content e tempo
estimado em 200 palavras/minuto. O marcador genérico “Devocional” substitui temas
inventados; busca por título/referência permanece. Filtros de tema sem fonte no
banco foram removidos. O texto bíblico é exibido como armazenado, sem atribuir
uma tradução inexistente no schema. Cards, hero, tipografia e cores são mantidos.

## Regras de consulta e autorização

- O leitor deve ter sessão; visitantes e sessões em recuperação não acessam o acervo.
- O repositório seleciona somente campos necessários à apresentação. Aplica
  status = published, publish_at <= instante atual e ordena por publish_at DESC,
  id DESC. Busca páginas de 100 registros até completar o resultado, evitando
  truncamento silencioso pelo limite da API.
- A RLS existente permite aos leitores apenas published com publish_at <= now()
  do servidor. Agendado com data passada continua oculto; publicado futuro também.
  Não há job que transforme scheduled em published automaticamente.
- Administradores mantêm seus privilégios existentes no banco. Mesmo na sessão
  administrativa, a tela do leitor aplica os filtros de publicado/data.
- A projeção do leitor omite author_id, status e timestamps administrativos. Isso
  não altera os privilégios SELECT existentes: author_id já faz parte do contrato
  SQL e pode ser consultado por leitor em publicações liberadas, sem acesso ao
  perfil do autor ou à lista privada de administradores.
- Aberturas são inseridas pela API com somente devotional_id; user_id = auth.uid()
  e opened_at = now() são definidos no servidor. A consulta de histórico filtra
  user_id da sessão e a RLS também impede acesso aos eventos de outro leitor.
  A API não permite forjar identidade/timestamps nem editar os eventos.

## Data e devocional do dia

A data editorial do Selah é sempre `America/Sao_Paulo`, independente do fuso do
navegador ou UTC. Por exemplo, 27/10/2026 02:59:59Z ainda pertence a 26/10 em São
Paulo; às 03:00Z começa o dia 27. Intl aplica o fuso IANA, inclusive regras
históricas de horário de verão, sem deslocamento fixo de horas.

O destaque é a publicação liberada mais recente cuja data nesse fuso é a de hoje;
empate usa UUID descendente. Sem publicação naquele dia, aparece “Nenhum devocional
publicado para hoje”, sem promover automaticamente um texto de outro dia.
O acervo lista os dias anteriores, do mais recente para o mais antigo. Outras
edições no mesmo dia não entram no acervo de dias anteriores; permanecem acessíveis
por UUID se liberadas. A tela renova publicações/data a cada minuto e ao receber
foco. O relógio do dispositivo define o instante de consulta, mas a RLS usa o
relógio do servidor e continua impedindo antecipar conteúdo futuro. Relógio local
atrasado pode ocultar temporariamente uma publicação já liberada.

## Histórico de aberturas

“Minhas aberturas” abre #minhas-leituras. Cada clique explícito para abrir ou reabrir
um texto grava um evento e, após confirmação da API, navega a #leitura/UUID.
Reaberturas são eventos distintos. Consultar a lista, atualizar uma URL de leitura
ou apenas restaurar uma sessão não registra outro evento automaticamente.
Uma falha na gravação informa erro e permite tentar abrir novamente.

O histórico não indica conclusão nem duração de leitura. A antiga marcação
demonstrativa “Marcar como lido” foi substituída por essa explicação, sem converter
aberturas em conclusões. Se o devocional ficar indisponível, o evento mostra
“Devocional indisponível”, sem revelar conteúdo nem oferecer abertura.
Trocar conta/logout descarta estado da sessão anterior; consultas e registros
atrasados não voltam a mostrar dados ou redirecionar após desmontar a tela.

## Integração HTTP local executada

Validação automatizada final: **49 testes aprovados em nove arquivos** com
`npm.cmd run test:run`; `npm.cmd run build` e `npm.cmd run lint` com código zero,
lint sem avisos. Esses testes simulam Supabase na fronteira e são separados da
integração HTTP real abaixo.

```sh
node scripts/local-library-smoke.mjs
```

Foram aprovadas **35 verificações HTTP**, sem omissões, usando Auth/API em
127.0.0.1:54321 e Mailpit em 127.0.0.1:54324. O status local confirmou o PostgreSQL
em 127.0.0.1:54322. A preparação criou duas contas fictícias por Auth, confirmou-as
pelo Mailpit e inseriu cinco publicações fictícias por psql no contêiner local,
em uma transação com commit apenas dos dados de teste. Essa preparação SQL não
alterou schema, privilégios ou políticas e não criou administradores.

As operações comuns testadas usaram exclusivamente a API pública com sessão de
leitor: acervo, regra de data, projeção, registro de aberturas, consulta por cliente
novo e persistência após logout/novo login. Consultas diretas à API não revelaram
rascunhos, agendados ou publicados futuros. Foram negados criação/publicação por
leitor, aberturas de conteúdo oculto, autoria/timestamps forjados, alteração de
eventos, acesso ao histórico alheio, acesso anônimo e métricas administrativas.

O script mantém duas contas e cinco publicações fictícias no banco local, sem
exclusões, senhas fixas ou impressão de credenciais/tokens. Requer Node 24 com
suporte a importação TypeScript, dependências, Docker e Supabase local já ativos.
Não integra os comandos de teste/build/lint e nunca deve apontar a outro ambiente.

## Limitações e validação manual

Na Etapa 18.2 o painel administrativo ainda era demonstrativo. A Etapa 19 substitui
esse painel por edição/publicação persistente no Supabase local; ver admin-local.md.
Não foi implementado agendador automático ou persistência de conclusões. Uma conclusão futura exige modelo
explícito e migração incremental, sem reinterpretar eventos de abertura antigos.
As respostas já carregadas ficam em memória até a próxima consulta; não há Realtime.
O histórico não comprova leitura e seus eventos podem ser repetidos pelo cliente.
Filtros/busca são locais sobre as páginas carregadas; paginação visível/infinita
e otimizações para um acervo muito grande ficam para outra etapa.

Persistência e isolamento foram comprovados pela execução HTTP anterior. Na
conclusão da Etapa 18.2, o responsável informou nesta sessão a aprovação dos
dez testes manuais abaixo, realizados na interface local. São resultados
relatados pelo responsável, distintos dos testes automatizados do agente.

| Teste manual | Resultado informado |
| --- | --- |
| O acervo carrega publicações do banco | Aprovado |
| O destaque apresenta o devocional do dia ou mensagem apropriada quando não existe | Aprovado |
| A busca encontra devocionais anteriores | Aprovado |
| Os devocionais abrem e exibem o conteúdo | Aprovado |
| A página do devocional permanece correta após recarga | Aprovado |
| Minhas aberturas registra os acessos | Aprovado |
| O histórico persiste após recarga, logout e novo login | Aprovado |
| O histórico é isolado entre usuários | Aprovado |
| A interface funciona em telas móveis | Aprovado |
| Falhas de conexão apresentam erro sem inventar conteúdo | Aprovado |

As 35 verificações HTTP locais e as 59 verificações SQL/RLS são resultados
anteriores; não foram reexecutadas durante a preparação do commit. O relato
manual não constitui execução E2E automatizada nem auditoria completa de
acessibilidade ou da virada de data em Brasília.

## Roteiro para repetir a validação manual

1. Inicie Vite em 127.0.0.1:5173 com a configuração local ignorada pelo Git.
2. Execute o script acima se precisar de publicações fictícias. Ele deixa um texto
   publicado hoje e outro anterior, além de três conteúdos ocultos de teste.
3. Entre com um leitor fictício confirmado que você controle. Confira o destaque
   do dia, data de Brasília, acervo ordenado, busca e ausência de conteúdo oculto.
4. Abra um texto, confira referência, conteúdo e pergunta. A URL deve conter UUID;
   não deve existir marca de conclusão. Recarregue e confira o mesmo texto.
5. Abra “Minhas aberturas”, confira data/hora e reabra um texto. Recarregue, faça
   logout e novo login; os registros devem permanecer nessa conta.
6. Entre em outra conta fictícia: seu histórico deve começar vazio e não mostrar
   eventos da primeira conta. Sem sessão, o acervo deve solicitar login.
7. Simule falha de rede e confira erro/nova tentativa, sem falso sucesso.
8. Confira em largura móvel a navegação com “Minhas aberturas”. Valide também
   um dia sem publicação e a virada da data de Brasília.

As 59 verificações SQL/RLS, 29 HTTP de perfis e 19 HTTP de Auth permanecem resultados
anteriores; não foram reexecutadas nesta etapa. Nenhum usuário real foi criado.

## Revisão para commit

Referência `6e2c793`, branch `feat/local-auth`. Nenhuma alteração funcional foi
necessária nesta preparação; somente o registro da documentação foi atualizado.
Na revisão da Etapa 18.2, o acervo persistente não importava fixtures nem usava
conteúdo de demonstração como fallback. O mock antigo ainda existia no painel DEMO;
a Etapa 19 remove esse uso em runtime. As fixtures ficam nos testes e scripts opt-in.
O script gera contas/senhas aleatórias em memória, sem incluir credenciais de
contas criadas ou tokens no repositório. Arquivos de ambiente e dados temporários
permanecem fora dos candidatos ao commit. Migrações e RLS seguem inalteradas.

Executados novamente nesta preparação: `npm.cmd run test:run` aprovou 49 testes
em nove arquivos; `npm.cmd run build` e `npm.cmd run lint` terminaram com código
zero, lint sem avisos. HTTP e SQL não foram reexecutados.
