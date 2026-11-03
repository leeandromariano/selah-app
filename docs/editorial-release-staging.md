# Release editorial para STAGING - preparacao, nao executar

Base local: e0a17d9826c7bd5ee495a219939b8c34fee2c338.
Candidata: docs/proposals/sql/NAO_APLICAR_20261028001000_editorial_structure.sql.
SHA-256: 057403f6706cebae37fb011c2577205df17d121e7eaa745910f5b4577b4658a3.
Continua fora de supabase/migrations e NAO foi aplicada remotamente.

## Efeito da candidata

Cria quatro tabelas privadas de temas, series e associacoes, indices, constraints e triggers de normalizacao/slug. Cria as RPCs publicas owner_editorial_change e reader_editorial_catalog, com EXECUTE somente authenticated; escrita requer OWNER elegivel verificado no banco. Leitura filtra explicitamente status published e publish_at <= now(). Nao concede DML direto nas tabelas privadas.

A trigger em account_deletion_requests coordena INSERT pela linha auth.users da identidade e impede alterar o user_id de um pedido (23514), inclusive por manutencao privilegiada. O lock editorial adquire auth.users, depois app_owner, e revalida elegibilidade. A retirada futura dessa trigger nao deve preceder a restauracao de uma coordenacao segura equivalente. O OWNER das funcoes e postgres, privilegiado; a revisao dos grants e predicados e indispensavel.

## Preview fechado por padrao

A aplicacao exige configuracao ja existente de STAGING e de origem Preview exata. A opcao local nao ativa builds hospedados. Para produzir um futuro Preview editorial sao exigidos, em conjunto, modo staging/build, SELAH_STAGING_BUILD=LOCAL_STAGING_BUILD, SELAH_STAGING_PREVIEW_BUILD=LOCAL_STAGING_PREVIEW_BUILD, SELAH_EDITORIAL_PREVIEW_BUILD=REVIEWED_EDITORIAL_PREVIEW e SELAH_EDITORIAL_BACKEND_VALIDATED_REF igual a VITE_STAGING_SUPABASE_PROJECT_REF. VITE_STAGING_SITE_ORIGIN e VITE_STAGING_PREVIEW_ORIGIN devem ser HTTPS validas e distintas; o cliente aceita somente a origem Preview exata.

A variavel de backend e uma declaracao operacional, NAO prova tecnica de instalacao ou autorizacao. So preenche-la depois de registrar as verificacoes abaixo e obter aprovacao do responsavel. Nao colocar service_role, senhas ou tokens no bundle. A fixture scripts/build-editorial-preview-fixture.mjs usa somente valores ficticios e nao implanta.

## Procedimento futuro - sujeito a autorizacao explicita

1. Preparar versao revisada com commit identificado, SHA da SQL, validacoes, responsavel, janela e aprovacao especifica. Confirmar ambiente e referencia do projeto STAGING por canal confiavel; parar se houver qualquer divergencia. Confirmar backup/PITR restauravel e retencao em local aprovado, sem copiar dados reais para DEV.
2. Em sessao read-only autorizada ao STAGING, conferir identidade e historico. Por exemplo: SELECT current_database(), current_user, current_setting('server_version'); SELECT version FROM supabase_migrations.schema_migrations ORDER BY version; comparar com as 16 migrations oficiais locais; parar se faltar, sobrar ou divergir alguma versao, ou se 20261028001000 ja existir.
3. Conferir objetos existentes, ownership, RLS e grants dos schemas private/public, auth.users e account_deletion_requests, extensao unaccent, dono postgres e a funcao private.owner_identity(). Verificar elegibilidade/fluxo de exclusao com responsavel autorizado; nao provisionar OWNER.
4. Somente apos aprovacao especifica da migracao, preparar migration oficial incremental revisada byte a byte conforme o SHA acima e executar o procedimento de migration aprovado para o projeto STAGING identificado. Nao usar PROD nem comandos que apontem ao DEV persistente. Se falhar, parar e inspecionar transacao e historico; nao repetir as cegas.
5. Confirmar versao instalada, dono/search_path/EXECUTE, RLS/grants, trigger e integridade. Com contas exclusivamente sinteticas autorizadas, testar OWNER elegivel e inelegivel, leitor, acesso privado negado, rascunhos/futuros ocultos, series e paginacao, e pedidos de exclusao em identidades diferentes. Parar imediatamente em qualquer divergencia.
6. Registrar evidencias do backend validado e solicitar autorizacao separada para build/deploy Preview. Definir origem Preview HTTPS exata e distinta da principal; configurar as variaveis de build acima somente nesse contexto e a chave publica apropriada. Nunca usar o sinal local para habilitar hospedagem.
7. No Preview autorizado, homologar login, temas, series, proximo episodio entre paginas, abertura unica, retomada, conclusao apos tempo real, conteudo indisponivel, erros, acervo, Jornada, mobile e autenticacao. Em falha, encerrar Preview e manter principal anterior.
8. Somente com aprovacao posterior e explicita, revisar diff e versao para merge e ativacao no STAGING principal. A opcao Preview nao habilita o principal. PROD permanece fora deste plano.

## Reversao

Primeira resposta: fechar o acesso editorial e retornar o frontend ao build anterior. Preservar dados editoriais e obter aprovacao antes de qualquer SQL. Preparar e revisar migration compensatoria transacional especifica: restaurar coordenacao segura do fluxo de exclusao/OWNER antes de remover ou substituir a trigger; nao apagar tabelas ou associacoes por padrao. Conferir historico, locks, integridade e leitura existente apos reversao. Nao presumir que reverter arquivos reverta o banco.

## Consultas de conferencia propostas - somente apos autorizacao

Depois da instalacao autorizada, executar em sessao read-only do projeto identificado:

```sql
select version from supabase_migrations.schema_migrations
where version = '20261028001000';

select c.relname, c.relrowsecurity,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('anon', c.oid, 'insert,update,delete') as anon_dml,
       has_table_privilege('authenticated', c.oid, 'select') as authenticated_select,
       has_table_privilege('authenticated', c.oid, 'insert,update,delete') as authenticated_dml
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private' and c.relname in
  ('editorial_themes','editorial_series','editorial_devotional_themes','editorial_episodes')
order by c.relname;

select n.nspname, p.proname, pg_get_userbyid(p.proowner) as owner,
       p.prosecdef, p.proconfig,
       has_function_privilege('anon', p.oid, 'execute') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'execute') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where (n.nspname = 'public' and p.proname in ('owner_editorial_change','reader_editorial_catalog'))
   or (n.nspname = 'private' and p.proname in ('editorial_owner_lock','editorial_deletion_identity_lock'))
order by n.nspname, p.proname;

select tgname, tgenabled, pg_get_triggerdef(oid)
from pg_trigger
where tgrelid = 'public.account_deletion_requests'::regclass
  and not tgisinternal and tgname = 'editorial_deletion_identity_lock';
```

Esperado: uma versao; quatro tabelas com RLS e sem SELECT ou DML direto para anon/authenticated; funcoes publicas com EXECUTE somente authenticated, helpers sem EXECUTE para ambos; owner postgres, SECURITY DEFINER e search_path vazio nas quatro funcoes; trigger habilitada. Se qualquer resultado diferir, parar e nao construir Preview.
