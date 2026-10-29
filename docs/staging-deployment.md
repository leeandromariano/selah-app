# Preparação controlada de STAGING — Etapa 23.5.1

## Candidato de OWNER bloqueado — preparação local

`scripts/staging-owner.mjs` recusa todas as operações e não conecta a nenhum
ambiente. `supabase/tests/staging-owner-candidate.sql` é apenas um modelo para
banco descartável; não é migração nem ferramenta operacional. O ensaio exige
membership editorial, confirmação no Auth e atestado externo fictício, bloqueia
pedidos de exclusão e serializa alterações e auditoria. A revogação não depende
de elegibilidade e preserva o papel editorial. O teste de transação usa claims
inalterados após revogar. Esses testes não validam identidade de conexão Cloud.

O responsável informou projeto `hepndavkzuktakezrmsj`, 16 migrações e Pages
publicado; são informações fornecidas, não verificadas nesta rodada. Confirm Email
está temporariamente desligado: `email_confirmed_at` não comprova controle do
e-mail. Antes de qualquer implementação operacional, definir e revisar método
externo confiável para verificar controle do endereço associado ao UUID, sem
copiar dados ou expor credenciais; documentar evidência opaca no processo humano.
Um booleano no ensaio não comprova essa verificação.

Antes de autorizar qualquer execução futura, revisar uma ferramenta que valide
por fontes independentes o inventário do projeto e o host efetivo autenticado
por TLS, rejeite pooler/host ambíguo, proxies e qualquer divergência ou PROD;
confirmar permissões reais sem criar privilégios nem contornar RLS. Exigir
aprovação específica da operação, UUID repetido, estado esperado e referência
opaca única `STAGING-`; obter backup e plano de recuperação. Após resultado
incerto, parar e inspecionar membership e auditoria antes de repetir. Verificar
revogação com a mesma sessão e RPCs após autorização específica. O candidato
atual não implementa validação de host nem executor e não autoriza execução.
Nunca reutilizar ou enfraquecer as guardas dos scripts exclusivamente locais.

> Etapa 23.5.2 / Prompt 73: proposta incremental `20261028000900` acrescenta
> elegibilidade OWNER e referências de auditoria STAGING. O conjunto agora tem
> 16 migrações; os textos sobre 15 abaixo registram a base histórica. Nenhuma
> migração foi aplicada ao banco existente ou ao projeto hospedado nesta rodada.

## Compatibilidade e OWNER — preparação local do Prompt 73

O responsável informou que STAGING usa PostgreSQL 17.11, `pgcrypto` em
`extensions`, Data API ligada, exposição automática desativada, RLS automático
ativado e schema `public` sem tabelas Selah; `anon` e `authenticated` têm USAGE,
mas não CREATE, enquanto `postgres` tem ambos. Não há schema
`supabase_migrations`. Esses fatos foram informados pelo responsável, sem acesso
do agente ao Cloud. Não provam grants efetivos futuros, capacidade de criar roles,
alterar ownership ou instalar triggers em `auth.users`.

A migração incremental `20261028000900_owner_eligibility_staging_audit.sql`
preserva as anteriores, aceita apenas prefixos `LOCAL-` ou `STAGING-` na
auditoria e aplica a comunidade e moderação a mesma checagem: membership OWNER,
conta existente, não anônima, e-mail confirmado, não suspensa, não excluída e
sem solicitação de exclusão registrada. Um pedido em
`account_deletion_requests` bloqueia o uso de OWNER imediatamente, sem apagar
conta ou revogar membership; o atendimento precisa de processo apropriado antes
de qualquer eventual reativação. `get_my_discussion_access` continua retornando
false para leitor comum e recusa OWNER inelegível. A migração não concede OWNER
e não altera o papel editorial.

Ensaio descartável usa operador `postgres` sem superuser, com CREATEROLE e
BYPASSRLS, e sem grant option para USAGE em `auth`; aplicou as 16 migrações.
Isso é um modelo parcial: não comprova que o operador Cloud tenha esses poderes,
nem que as permissões padrão reais correspondam às do ensaio. Verificar no
projeto confirmado criação e transferência de papel, schemas, triggers Auth,
funções/EXECUTE, ACLs e efeitos de DEFAULT PRIVILEGES antes de autorizar escrita.
Não há incompatibilidade Cloud comprovada por testes locais, nem se deve
reescrever as duas migrações históricas de leitura.

### Provisionamento OWNER de STAGING — desenho, não executar agora

Não existe ainda ferramenta hospedada com identidade do projeto vinculada e
testada de ponta a ponta. O prefixo `STAGING-` identifica a referência, mas não
prova o ambiente nem impede uso em produção. **Esse é um bloqueador operacional
para executar o provisionamento**: primeiro implementar e testar uma ferramenta
ou procedimento que valide, por fontes confiáveis e independentes, a referência
do projeto e a identidade da conexão de banco; recusar qualquer divergência ou
indefinição antes de SQL. Os scripts `provision-local-owner.mjs` e helpers recusam
remoto e não devem ser adaptados por remoção de guardas. Nunca solicitar senha,
token ou chave no chat e nunca enviar a credencial para o navegador.
O provisionador local histórico também não consulta pedidos de exclusão na sua
verificação de elegibilidade: embora a nova RPC negue acesso ao OWNER com pedido
pendente, não usá-lo para conceder membership nessa situação. Essa divergência
precisa ser tratada antes de qualquer operação de provisionamento aplicável.

Após validação da ferramenta e aprovação explícita específica do responsável,
o procedimento deve: (1) confirmar projeto e identidade do operador, ambiente
e backup; (2) inspecionar somente leitura o UUID exato, pertencimento editorial,
conta confirmada/ativa e ausência de pedido de exclusão, e confirmar controle da
conta; (3) exigir a repetição explícita do UUID e uma referência opaca única
`STAGING-` em operação separada de qualquer criação de conta; (4) em transação
com locks e validação novamente após adquirir locks, conferir que não há OWNER,
inserir membership e registrar `grant`, UUID e referência em
`private.owner_provision_audit` atomicamente, sem dados de contato ou credenciais;
(5) confirmar por consulta somente leitura a membership, auditoria e negações
de leitor/editorial, com conta fictícia em homologação. Não usar metadados do
frontend como autorização. Credenciais e detalhes do projeto ficam no ambiente
confiável do operador; não registrar tokens ou senhas.

Para revogar, exigir identidade do mesmo projeto e UUID do OWNER atual confirmado,
referência opaca única, autorização específica e expectativa exata de estado;
após locks, remover a membership e inserir registro `revoke` na mesma transação.
Verificar em leitura que a membership foi removida e que o mesmo JWT anterior
é negado nas RPCs. Revogação não altera editorial nem apaga dados. Falha ou
timeout exigem inspecionar membership e diário antes de repetir; divergência ou
resultado ambíguo bloqueia nova escrita. Recuperação/transferência requer
aprovação específica e uma ferramenta revisada, confirmação de ambas identidades
e transação auditada, nunca substituir registros ou copiar credenciais. Nada
disso foi executado nesta rodada.

> Prompt 71 / Etapa 23.5.2: procedimento de pré-instalação abaixo é preparação
> local. O projeto informado não foi acessado; os comandos remotos são somente
> para rodada futura, após autorização específica e verificação do destino.

Nenhum recurso hospedado foi acessado ou modificado nesta etapa. O projeto
informado pelo responsável não foi inspecionado. Build local não é deploy nem
prova funcionamento de Auth, SMTP, RLS, cabeçalhos ou banco hospedados. PROD
permanece bloqueado; dados de homologação são exclusivamente fictícios.

## Build e Cloudflare Pages futuro

STAGING requer `VITE_APP_ENV=STAGING`, `VITE_STAGING_SUPABASE_URL` exatamente
`https://<referência>.supabase.co`, `VITE_STAGING_SUPABASE_PROJECT_REF`,
`VITE_STAGING_SUPABASE_PUBLISHABLE_KEY` pública e `VITE_STAGING_SITE_ORIGIN`
HTTPS exata, sem caminho. A origem do navegador deve corresponder exatamente.
`SELAH_STAGING_BUILD=LOCAL_STAGING_BUILD` precisa estar no processo do build;
não é segredo nem mecanismo de autorização. Sem esse sinal, com configuração
incompleta ou com chave privilegiada, o build falha. Variáveis genéricas DEV
não podem preencher STAGING.
Para exercitar apenas fixture fixa fictícia, executar
`node scripts/build-staging-fixture.mjs`: ele invoca `npm.cmd run build:staging`
no Windows com variáveis sintéticas e não realiza deploy. O artefato em `dist`
é substituído; `npm.cmd run build` volta a gerar DEV. Nunca publicar fixture.

Em futura operação explicitamente aprovada: projeto Pages sugerido
`selah-staging`; branch candidata `feat/local-auth` ou branch de homologação
identificada no pedido de aprovação; build command `npm run build:staging`,
output `dist`, variáveis públicas acima e sinal de build no ambiente do provedor.
Não conectar automaticamente o repositório ou habilitar builds/deploys automáticos
que contornem aprovação: primeiro verificar os controles efetivos do provedor e
adotar processo manual aprovado. Confirmar origem HTTPS, domínio, cabeçalhos e
variáveis do projeto correto antes de executar. A chave publishable é pública;
senhas, service_role, tokens e outros segredos nunca vão ao frontend. Separação
real do projeto de produção deve ser verificada pelo operador: uma chave
publishable não prova a referência nem que o destino é de staging.

O app usa hash routing; testar reload e links `/#...` no domínio aprovado.
`public/_headers` propõe `nosniff`, `DENY`, `no-referrer` e revalidação de HTML,
service worker e protocolo; conferir efeito real e cache na raiz e em `index.html`
antes do aceite. O SW não armazena páginas; atualização e HTTPS exigem teste.
Web Push externo permanece desativado. Definir CSP compatível com Auth e API e
testá-la no ambiente aprovado; não afirmar que já está aplicada.

## Revisão das 15 migrações

Ordem: `20261023000100` inicial; `20261026000100` privacidade;
`20261026000200` usernames; `20261026000300` vínculo; `20261026000400`
WhatsApp/feedback; `20261026000500` remoção de metadados; `20261027000100`
limites do login local; `20261028000100` leitura; `20261028000200` claims;
`20261028000300` consistência; `20261028000400` OWNER/comunidade;
`20261028000500` auditoria OWNER; `20261028000600` lembretes;
`20261028000700` discussão; `20261028000800` conquistas/desafios.
Não reescrever arquivos anteriores nem presumir reaplicação idempotente.

Pontos para verificar no projeto novo, sem presumir equivalência ao local:

- `extensions.digest` depende de `pgcrypto` instalado no schema `extensions`;
  conferir extensão e acesso. UUID usa `gen_random_uuid()`.
- A migração de leitura cria `selah_reading_owner` e concede/revoga membership,
  privilégios de schema e ownership; confirmar que o operador gerenciado pode
  executar cada ação. As migrações também criam triggers em `auth.users` e
  alteram owners para `postgres`; testar compatibilidade com permissões reais.
- `private` não deve estar exposto na Data API. Há RLS, `GRANT` e `REVOKE`
  explícitos, permissões por coluna e funções SECURITY DEFINER com search_path
  vazio; conferir ACL efetiva e exposição real de `public`, inclusive com
  exposição automática de novas tabelas desativada. Não presumir grants padrão.
- Políticas e RPCs usam `auth.uid()`/claims e sessões confirmadas em diferentes
  pontos; verificar anon, dois leitores, editorial e OWNER e tentativa de
  forjar metadados. Isolamento OWNER usa membership privada separada de editorial.
- `password-login` é exclusivamente local e recusa destinos hospedados; não
  implantá-la como login de staging. O cliente STAGING usa Auth por e-mail.
  Lembretes e manutenção usam processos locais protegidos, não são serviços
  hospedados prontos; não expor endpoints de manutenção nem ativar push.
- A suíte isolada local não reproduz integralmente os roles, ACL e políticas do
  projeto gerenciado. Se houver incompatibilidade comprovada, preparar migração
  incremental e testes; nenhuma correção de banco foi aplicada nesta rodada.

## Pré-instalação verificável — Prompt 71

### A. Identidade e estado, antes de qualquer conexão

O responsável deve confirmar por canal apropriado, sem enviar senhas, chaves
`service_role`, tokens ou string de conexão para o chat/logs:

- [ ] Nome e Project Reference ID exatos do projeto; classificação STAGING e
  comparação com o inventário do responsável para excluir produção. Referência
  é identificador, não prova isolada de ambiente. Conferir organização/região.
- [ ] Ausência de usuários reais e dados de produção; projeto gerenciado novo
  ainda possui schemas e objetos do próprio Supabase, não é banco literalmente
  vazio. Confirmar schema de aplicação e histórico de migrações esperados.
- [ ] Postgres gerenciado compatível com versão 17 local; `auth.users`, `auth.uid()`
  e `auth.jwt()` disponíveis; `pgcrypto` e `extensions.digest` no schema esperado.
- [ ] Data API habilitada conforme intenção, apenas schemas necessários expostos,
  especialmente `private` não exposto; exposição automática de tabelas desligada.
  RLS automático não substitui inspeção de políticas, grants e EXECUTE efetivos.
- [ ] Perfil local autorizado da CLI e conectividade TLS para o projeto exato;
  definir como fornecer credenciais por mecanismo privado do operador, sem
  colocá-las em Git, argumentos de processo, relatório ou log. Caso não seja
  possível sem expor segredo, parar e preparar método seguro; não improvisar.
- [ ] Plano de backup/snapshot disponível e ensaio de recuperação isolado;
  limitar acesso ao projeto e não expor o serviço aos leitores. Não incluir seeds.

Após autorização específica para leitura do projeto e confirmação de identidade,
um operador pode executar no SQL Editor de STAGING, em transação somente leitura,
as consultas abaixo. Elas mostram metadados e contagem, não registros pessoais;
contagem não comprova que todos os dados são fictícios. Conferir manualmente sem
copiar dados ao ambiente local. Se uma consulta falhar, interromper a operação.

```sql
begin read only;
select current_database(), current_user, current_setting('server_version');
select extname, extnamespace::regnamespace from pg_extension where extname = 'pgcrypto';
select to_regprocedure('extensions.digest(text,text)') is not null as digest_available,
       to_regclass('auth.users') is not null as auth_users_available,
       to_regprocedure('auth.uid()') is not null as uid_available,
       to_regprocedure('auth.jwt()') is not null as jwt_available;
select count(*) as auth_user_count from auth.users;
select has_database_privilege(current_user, current_database(), 'CREATE') as can_create_schema,
       has_table_privilege(current_user, 'auth.users', 'TRIGGER') as can_trigger_auth_users,
       rolcreaterole, rolsuper from pg_roles where rolname = current_user;
select to_regclass('public.profiles') is not null as profiles_exist,
       to_regclass('public.devotionals') is not null as devotionals_exist,
       to_regclass('supabase_migrations.schema_migrations') is not null as migration_history_exists;
rollback;
```

As permissões acima são apenas indicadores: conferir ownership e possibilidade
efetiva de atribuir funções e revogar a membership do papel `selah_reading_owner`.
Sem aprovação, não executar as consultas; não registrar referências, contatos ou
credenciais em artefatos públicos. Histórico de migração, configuração Data API e
projeto alvo também devem ser conferidos pelo operador no painel autorizado.

### B. Plano de migrações

Fixar commit/candidato, comparar os 15 IDs da seção anterior com os arquivos
locais e com o histórico remoto identificado; projetos em estado inesperado,
versões conflitantes ou permissões insuficientes bloqueiam a execução. O ensaio
local de PostgreSQL temporário comprova apenas a estrutura simulada, não os ACLs
gerenciados. Não ajustar migrações já existentes nem presumir que serão repetíveis.
Caso incompatibilidade seja comprovada, projetar migração incremental e testes
apropriados antes de qualquer instalação; ainda não há correção específica
comprovadamente necessária para o gerenciado. O primeiro OWNER e o privilégio
editorial exigem procedimento próprio, auditável e aprovado; não criar OWNER.

Comandos de inspeção local para Windows CMD, sem conexão hospedada:

```cmd
git status --short --branch
git log -1 --format=%H
dir /b /on supabase\migrations\*.sql
node scripts/verify-local-reading-install.mjs
```

O último comando é opt-in e cria um PostgreSQL temporário isolado, sem rede,
com fixtures fictícias; consulta somente metadados e DDL Auth do stack local e
descarta o contêiner criado. Não executa instalação no banco local existente.

### C. Dry-run futuro — separado da aplicação

A ajuda **local** da CLI instalada 2.122.0 indica `--project-ref`, `--dry-run` e
`--skip-vault`. O comando de dry-run acessa o projeto e requer autorização
explícita de leitura/ensaio no STAGING confirmado. `--skip-vault` é necessário:
a CLI informa que `db push` normalmente atualiza segredos Vault antes das
migrações. Não se comprovou que o dry-run seja inteiramente isento de efeitos
colaterais em projeto hospedado; revisar a versão da CLI e autorizar o impacto
antes de executá-lo. Ele lista migrações, mas não comprova execução de SQL,
privilégios, ausência de falhas ou restauração. Não passar `--include-seed`,
`--include-roles`, `--include-all`, `--yes`, `--debug` ou senhas por argumento.

Somente em futura rodada aprovada, no **Windows CMD**, a partir da raiz do repo,
o operador define uma referência STAGING não secreta, previamente validada como
20 caracteres minúsculos ASCII/dígitos e comparada com o inventário. Não inserir
tokens, senhas ou URL de conexão no prompt:

```cmd
set /p SELAH_STAGING_PROJECT_REF=Project Reference STAGING confirmado:
node node_modules/supabase/dist/supabase.js db push --project-ref %SELAH_STAGING_PROJECT_REF% --skip-vault --dry-run
```

Não executar se o valor não tiver sido validado, se a CLI exigir exposição de
credencial, se houver dúvida sobre o destino ou se o plano diferir dos 15 IDs.
Não usar saída bruta com credenciais em logs; guardar apenas resultado sanitizado.
Nenhum `supabase link`, `db push`, SQL remoto ou dry-run foi executado nesta
rodada. O comando acima é um plano proposto, não validado contra Supabase Cloud.

### D–G. Aprovação, aplicação futura e recuperação

Antes de qualquer escrita, apresentar destino STAGING confirmado, commit,
resultado do dry-run e preflight, lista exata de pendências, privilégios,
backup e plano de recuperação; obter autorização explícita para a aplicação.
Essa aprovação é separada de deploy do frontend, OWNER e produção. Revalidar
identidade e plano imediatamente antes de aplicar; interromper se mudarem.

Após essa aprovação, e **somente em rodada futura**, no mesmo CMD com referência
STAGING confirmada e credenciais tratadas privadamente:

```cmd
node node_modules/supabase/dist/supabase.js db push --project-ref %SELAH_STAGING_PROJECT_REF% --skip-vault
```

Não usar flags de seed nem confirmação automática. Comparar o histórico antes e
depois; não concluir com base apenas em código de saída. Validar objetos, RLS,
grants/EXECUTE, funções e triggers, schema `private` não exposto, regras de leitura
e negações de anon e leitor com contas fictícias **após autorização própria para
as operações que criem ou alterem dados**. Verificar que não foi concedido OWNER.
Auth/SMTP, deploy de Edge Functions e provisionamento têm planos e autorizações
próprios; a função `password-login` local não funciona no serviço gerenciado.

Se houver falha, parar, preservar histórico e identificar última transação
confirmada, estado do schema e impacto sem imprimir segredos. Não fazer reset,
apagar objetos, editar a tabela de histórico ou reexecutar indiscriminadamente.
Propor migração corretiva ou restauração a partir do backup testado, avaliar
perda e compatibilidade e obter autorização específica antes de modificar dados.

## Sequência futura — somente após autorização específica

1. Identificar organização, projeto, região e ambiente; confirmar que é staging,
   projeto vazio e separado de produção, sem expor credenciais. Registrar versão,
   histórico de migrações, schemas expostos, extensões e capacidade de backup.
2. Preparar backup/snapshot inicial ou alternativa verificável; confirmar plano
   de retorno. Revisar permissões do operador e dependências acima. Obter aprovação
   explícita para alterações do destino e para eventual publicação; não usar
   `db reset`, `db push` ou `supabase link` como procedimento desta rodada.
3. Aplicar somente migrações pendentes em ordem, com ferramenta e destino
   previamente revisados, registrar versões e parar em qualquer erro. Após cada
   fase verificar histórico e estado; uma falha pode exigir análise de transação,
   migração corretiva ou restauração antes de repetir. Nunca reescrever histórico.
4. Verificar tabelas, schemas, grants, RLS e RPCs via contas fictícias isoladas.
   Preparar provisionamento editorial e OWNER separado, por operador confiável,
   confirmação da identidade e auditoria, sem exposição de service_role ou
   concessão por metadados; scripts atuais são exclusivamente locais. Não existe
   procedimento hospedado executável validado para o primeiro OWNER.
5. Revisar se alguma Edge Function realmente é necessária antes de autorizar
   implantação individual e seus segredos; a função de login local não serve
   STAGING. Configurar Auth e frontend somente após revisões e aprovação próprias.
6. Testar anon, dois leitores, editorial e OWNER; login, confirmação, recuperação,
   logout e troca de contas, leitura de 60 s, Jornada, desafios, comentários,
   moderação, compartilhamento e Bíblia demonstrativa. Testar limites de abuso,
   segurança de logs, URLs e ausência de push externo com dados fictícios.

## Auth, SMTP e privacidade

Definir `Site URL` e allowlist exata de redirects da origem canônica HTTPS;
confirmação e recuperação usam `location.origin`. Habilitar confirmação de
e-mail, configurar SMTP transacional por ambiente e domínio remetente, conferir
limites, reenvio, erro, expiração e abuso de cadastro. O login hospedado usa
e-mail, com username como perfil. Não configurar SMTP nem enviar mensagens agora.

O texto atual de `PrivacyPolicy` é exclusivo de testes locais e não deve ser
usado como aviso de serviço real. Proposta a completar antes da homologação com
leitores: identificar **[responsável pelo tratamento]**, **[canal de contato]**,
**[fornecedores e região]**, **[prazos e critérios de retenção]** e **[procedimento
e prazo de atendimento/exclusão]**, sem inventar dados. Explicar conta, username,
e-mail e WhatsApp obrigatório; aberturas e conclusões; métricas de consistência
acessíveis ao OWNER; conquistas e desafios pessoais; comentários aprovados
visíveis a leitores, pendências e denúncias, moderação, registros de auditoria,
retenção e exclusão. O pedido atual é manual e não exclui a conta automaticamente.
Revisar dados sobre hábitos religiosos, tratamento de menores e base aplicável;
não afirmar conformidade jurídica completa. Definir comunicação e operação antes
de receber usuários reais, inclusive em beta.

## Rollback e critérios

Antes do primeiro deploy apresentar candidato identificado, destino, resultados,
configuração e estimativa, migrações e plano de reversão ao responsável; obter
aprovação explícita. Preservar artefato anterior e comprovar compatibilidade
com esquema; em primeira implantação planejar desativar acesso ao frontend.
Rollback do frontend não reverte banco, Auth ou dados. Restaurar ou executar
migração corretiva somente após analisar impacto e perda, ensaiar em ambiente
isolado e obter aprovação aplicável. Exigir teste de restauração de backup,
SMTP e redirects, isolamento RLS/OWNER, limites de abuso e monitoramento sem
segredos antes de considerar homologação aceita.
