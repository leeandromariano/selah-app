# Banco de dados do Selah

## Estado atual — Etapa 22.1

A base `c2fb5b3` recebeu duas migrações incrementais locais:
`20261028000100_reading_completions.sql` e `20261028000200_reading_claims_access.sql`.
Há progresso confirmado, uma autorização temporária por conta e conclusões pessoais
únicas. Nenhuma abertura anterior foi convertida em conclusão. Novas tabelas usam
RLS, privilégios mínimos e RPCs autenticadas; o frontend não escreve tempo/datas.
`devotionals.reading_revision` protege contra uso de tempo de edição anterior.
Excluir conteúdo agora preserva aberturas com FK anulada e preserva conclusões
com UUID original, sem texto copiado. Contagens administrativas partem do conteúdo
atual e ignoram aberturas órfãs; a compatibilidade foi testada. Sem limpeza automática.

Ver [reading-local.md](reading-local.md) para schema, grants, locks, retenção,
limites e instalação local. Não houve migração hospedada nem reset. As descrições
abaixo documentam o contrato original; para alterações posteriores de Auth,
username, campos opcionais e WhatsApp, consultar a documentação específica.

## Base histórica — schema inicial e primeiras integrações

Na Etapa 16, AuthForm usa Supabase Auth exclusivamente local. Confirmação de e-mail,
login, logout e recuperação são reais no ambiente local. Na Etapa 19, AdminPanel
usa a API pública com sessão administrativa para criar, editar, agendar e publicar;
ver admin-local.md. Na Etapa 18.2, publicações e histórico de aberturas dos
leitores usam as tabelas existentes pela API com sessão. Não há conclusão de leitura
no schema; ver devotionals-local.md. O painel exige sessão e autorização confirmada
pela RPC protegida; nenhuma política ou migração foi alterada. Ver auth-local.md.
Na Etapa 18.1, os campos pessoais enviados como rascunho do cadastro podem ser
revisados e salvos em “Meu perfil” após confirmação/login. A tela carrega e edita
o próprio registro em public.profiles pela API com sessão. Ver profiles-local.md.

A migração `supabase/migrations/20261023000100_initial_schema.sql` prepara o banco;
não foi aplicada remotamente. Não contém contas reais, senhas, credenciais nem dados
de menores. Os testes usam exclusivamente identidades fictícias adultas, sem senha.

## Estrutura

| Tabela | Campos e relacionamentos | Acesso pela API |
| --- | --- | --- |
| `profiles` | `id` é PK e FK para `auth.users`; `name`, `phone`, `age_range`, `instagram`, timestamps | Somente o próprio usuário insere, consulta e atualiza campos pessoais |
| `devotionals` | UUID, `title`, `bible_reference`, `bible_text`, `content`, `reflection_question`, `publish_at`, `status`, `author_id` e timestamps | Leitor autenticado consulta publicados com data atingida; administrador gerencia conteúdo |
| `devotional_views` | UUID, FK devocional, FK usuário, `opened_at` do servidor | Usuário registra abertura de publicado e consulta apenas suas próprias aberturas |
| `privacy_notice_versions` | UUID, versão única, conteúdo integral, data de publicação | Visitante e autenticado leem somente versões já publicadas; escrita apenas por SQL confiável |
| `privacy_acknowledgements` | PK composta usuário/versão, FKs e data do servidor | Usuário registra e consulta apenas a própria ciência; sem edição/exclusão pela API |
| `private.admin_users` | FK/PK usuário e data de concessão | Nenhum acesso direto pela API, nem para administradores do aplicativo |

Nomes SQL em inglês: `draft` = rascunho, `scheduled` = agendado,
`published` = publicado. `publish_at` é `timestamptz`, obrigatório fora de rascunhos.
Datas são instantes; exibir em `America/Sao_Paulo` no futuro frontend.
Agendados **não se publicam automaticamente**: uma etapa futura deve mudar seu status
para `published`. Um publicado com data futura também permanece invisível ao leitor.

O perfil é criado explicitamente após autenticação, sem trigger de cadastro ou cópia
automática de metadados não confiáveis. Nome é obrigatório; celular, faixa etária e
Instagram são opcionais, para minimizar coleta nesta fase. Celular usa formato E.164
(normalizar DDD e código do país no frontend); idade exata não é armazenada.
Faixas: `under_18`, `18_24`, `25_34`, `35_44`, `45_59`, `60_plus`.
A existência de `under_18` não habilita nem autoriza cadastro real de menores.

Excluir um usuário em Auth remove perfil, aberturas, ciência e eventual permissão
administrativa. Autores com devocionais impedem essa exclusão (`RESTRICT`): antes,
um operador confiável precisa definir o destino/autoria desses conteúdos.
Excluir um devocional remove suas aberturas; métricas não são um histórico imutável.
Avisos referenciados por ciência não podem ser excluídos. Não se deve editar versões
já publicadas nem via SQL: criar uma nova versão, preservando o conteúdo anterior.

Os campos de apresentação atuais (`summary`, `theme`, `minutes`, `color`) e IDs
numéricos do mock não são migrados. O futuro adaptador de dados precisará tratar
esses campos e usar UUIDs; esta etapa não substitui o acervo demonstrativo.

## Segurança e índices

Todas as seis tabelas têm RLS explicitamente habilitado. Privilégios SQL são
revogados primeiro e concedidos por operação/coluna. Não há `role` editável no perfil.
Metadados enviados pelo usuário não participam da autorização. A primeira concessão
administrativa deve ser feita por operador confiável em SQL, em `private.admin_users`,
usando um UUID de Auth verificado; nunca disponibilizar essa operação no navegador.
Remover a linha revoga a autorização nas próximas consultas, sem depender de renovar JWT.
Não adicionar `private` aos schemas expostos pela Data API.

`private.is_admin()` e `public.devotional_open_counts()` usam `SECURITY DEFINER`,
`search_path` vazio, referências qualificadas e `EXECUTE` explicitamente restrito.
A agregação verifica a autorização internamente antes de acessar registros protegidos.
O dono das funções deve ser o operador de migração confiável (`postgres`), nunca um
usuário do aplicativo. Dono do banco e credenciais com bypass de RLS continuam
privilegiados; RLS não limita esses operadores. O modelo segue as orientações de
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e
[funções seguras](https://supabase.com/docs/guides/database/functions) do Supabase.

Administradores do aplicativo não consultam perfis, ciências ou aberturas de outros
usuários. A função `devotional_open_counts()` retorna somente UUID do devocional,
`count` de aberturas e `count(distinct user_id)`, incluindo zeros. Não retorna IDs
de leitores nem horários individuais. Não há estatísticas públicas.
Repetir uma abertura aumenta o total, sem aumentar leitores únicos.
Sem acesso anônimo a devocionais ou registro de visitas nesta versão; somente os
avisos de privacidade são públicos.

PKs/constraints únicas já criam índices. Índices adicionais cobrem publicação
(`publish_at DESC` parcial para publicados), autoria, agregação
(`devotional_id, user_id`), histórico/exclusão de usuário
(`user_id, opened_at DESC`) e referência de avisos (`notice_id`).
Triggers atualizam `updated_at`. Clientes não escolhem IDs/datas de eventos ou
ciências, não mudam autoria e não editam timestamps de perfil/devocional.

## Autenticação local e integração futura

Usar exclusivamente Supabase Auth com e-mail/senha; nenhuma tabela própria de senhas.
Na futura conexão da interface:

1. `auth.signUp`: habilitar confirmação de e-mail e configurar URLs permitidas de
   retorno; exibir estado pendente e criar perfil apenas após sessão válida.
2. `auth.signInWithPassword`: tratar credenciais inválidas e contas não confirmadas;
   acompanhar sessão com `onAuthStateChange`. Ocultar painel conforme autorização,
   mantendo o banco como barreira real.
3. `auth.resetPasswordForEmail` com URL permitida; na rota de recuperação tratar
   `PASSWORD_RECOVERY` e chamar `auth.updateUser({ password })` com sessão válida.
4. `auth.signOut`: limpar estado pessoal e conteúdo administrativo da interface,
   tratar erros e documentar escopo de encerramento de sessões. Tokens de acesso
   já emitidos podem permanecer válidos até expirar.

Configurar SMTP e testar entrega/links de confirmação e recuperação em ambiente de
teste. A política de senha deve existir também no Auth, não somente no formulário.
Ver [guia oficial de e-mail/senha](https://supabase.com/docs/guides/auth/passwords).
A Etapa 16 implementou Auth local; a Etapa 18.1 implementa perfil persistente local.
Provisionamento de administrador e integrações de conteúdo permanecem futuros.
Nenhuma configuração remota foi alterada.
Variáveis `VITE_` são públicas no bundle: somente URL e chave publishable podem ir
nelas. Nunca adicionar `service_role`, secret key ou senha de banco ao frontend.

## Testes locais de autorização

`supabase/tests/authorization.sql` usa SQL/PLpgSQL e não exige pgTAP. Executar como
`postgres` em **Supabase local descartável**, com Auth e roles padrão disponíveis,
após aplicar a migração. Não apontar esses comandos para produção ou projeto remoto.

Exemplo com Supabase CLI, Docker em execução e `psql` instalado:

```sh
supabase init # somente se o ambiente local ainda não tiver config.toml
supabase start # primeiro início: somente instância NOVA, vazia e descartável
psql -X -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 54322 -U postgres -d postgres -f supabase/tests/authorization.sql
```

Usar a senha exclusivamente do banco local via prompt/gerenciador, sem salvar no
repositório. Conferir host/porta na configuração local. `db reset --local` destrói
dados do banco local: usar só ambiente descartável. Nunca usar `--linked`/`db push`
nesta etapa. A migração não é idempotente; o histórico de migrações controla aplicação.

O teste muda roles com `SET LOCAL ROLE` e simula claims JWT, cobrindo anônimo, dois
leitores e administrador: isolamento de perfil, proibição de autopromoção inclusive
por metadados, estados/datas de publicação, CRUD administrativo, proibição de forjar
identidade/horário, isolamento das aberturas/ciências e contagens agregadas.
Erros abortam com `ON_ERROR_STOP`; a conexão fecha revertendo a transação.
O caminho bem-sucedido também termina com `ROLLBACK` e mensagem explícita de sucesso.
Não executar uma seleção parcial do arquivo nem omitir a parada em erros.

Esses testes verificam o banco, não validam assinatura JWT, SMTP, PostgREST nem os
fluxos de navegador. Esses testes de integração precisam ser feitos posteriormente
em Supabase de teste antes de habilitar dados reais.

## Limitações e decisões pendentes

- Em 26/10/2026 o PostgreSQL local 17.11 foi confirmado saudável, com a migração
  20261023000100 aplicada. A suíte completa executou 59 verificações, todas aprovadas,
  com ROLLBACK confirmado. As políticas e privilégios estão validados nos cenários
  cobertos, sem acesso remoto. Ver o registro de execução em testing.md.
- Não usar dados reais de menores. Antes de qualquer coleta real, definir finalidade,
  necessidade de celular/idade, acesso, retenção e exclusão, e revisar os requisitos
  aplicáveis ao público pretendido. Ciência de aviso não equivale a consentimento
  para todas as finalidades; esta estrutura não registra autorização de responsável.
- Aberturas autenticadas são eventos declarados pelo cliente, não prova de leitura.
  Um usuário pode inflar totais repetindo inserts. Antes de usar métricas para decisões,
  definir limites/deduplicação e retenção. Não coletar IP ou user-agent nesta fase.
- A versão de aviso e a administração inicial precisam ser provisionadas por operação
  confiável, em etapa posterior. Nenhum administrador ou aviso foi criado na migração.
- Agendamento automático, exclusão de conta, integração real da UI e política de
  retenção não estão implementados. Testar restore/backup e revisar permissões no
  ambiente de destino antes de aplicar a migração.

## Revisão prévia local (26/10/2026)

Leitura integral da migração e da suíte de autorização, sem execução SQL. Não foram
identificados erros de sintaxe por inspeção; isso não substitui análise pelo PostgreSQL 17.
As funções privilegiadas mantêm `search_path` vazio, nomes qualificados e execução
restrita; o dono agora é explicitamente `postgres`. O schema `public` concede uso às
roles da API e revoga criação de objetos dessas roles. A configuração desabilita
exposição automática de objetos futuros; os GRANTs explícitos continuam necessários.
`private` permanece fora dos schemas expostos. A CLI aceitou a configuração até a
consulta de containers; compatibilidade completa depende do primeiro início local.

O seed foi desabilitado porque `seed.sql` não existe. URLs de Auth usam a porta
padrão do Vite (5173), com `127.0.0.1` e `localhost` via HTTP; se o Vite escolher
outra porta, alinhar URLs antes de testar Auth. Senha mínima de oito caracteres e
confirmação de e-mail local foram alinhadas ao fluxo planejado. E-mails locais
devem ser inspecionados no servidor de teste (`local_smtp`), sem SMTP externo.

A suíte psql exige parada em erro dentro do próprio arquivo e acrescenta negação
de criação de objetos públicos, autoria forjada, alteração de autoria/datas, acesso
administrativo direto à lista de administradores e revogação com as mesmas claims.
Na revisão prévia esses casos ainda não haviam sido executados; posteriormente,
em 26/10/2026, a suíte integral passou nas 59 verificações com rollback. O arquivo usa comandos psql e
assertions próprias; não é uma suíte pgTAP para `supabase test db`.
`supabase db lint --local` exige banco iniciado e migração aplicada; não foi executado.
O primeiro `supabase start` pode aplicar migrações: verificar antes que a instância
é nova e descartável. Não executar reset sobre dados existentes.

Perfis, telefones, faixas etárias, Instagram e eventos permanecem pessoais mesmo
com RLS. Contagens administrativas podem permitir inferências em grupos pequenos;
não publicar essas métricas. `devotionals.author_id` continua visível ao leitor
autenticado como UUID de autoria: é um identificador correlacionável, sem acesso
ao perfil ou e-mail do autor. Rever esse contrato antes de usar contas reais.
Operadores `postgres` e credenciais com bypass de RLS permanecem privilegiados e
nunca devem ser usados no frontend. Não há retenção automática de eventos.

Referências da revisão: [configuração da CLI](https://supabase.com/docs/guides/local-development/cli/config),
[RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) e
[funções](https://supabase.com/docs/guides/database/functions).
