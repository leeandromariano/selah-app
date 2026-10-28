# Preparação controlada de STAGING — Etapa 23.5.1

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
