# Preparação local para hospedagem — Etapa 23.4

## Validação manual informada pelo responsável — 12/12 aprovados

1. Cadastro de nova conta fictícia funciona no ambiente local.
2. Confirmação de cadastro pelo Mailpit funciona.
3. Login com username funciona.
4. Login com e-mail funciona.
5. Recuperação e redefinição de senha funcionam.
6. Logout encerra a sessão corretamente.
7. Troca de conta não mantém dados da conta anterior.
8. Leitura e conclusão após 60 segundos continuam funcionando.
9. Minha Jornada, conquistas e desafios funcionam.
10. Comentários, reações e moderação continuam funcionando.
11. Bíblia e navegação interna continuam funcionando.
12. Temas Claro, Escuro e Sistema continuam funcionando.

Transcrição literal informada pelo responsável, limitada aos itens acima. Não
representa testes de hospedagem real, SMTP externo ou Auth hospedado. Etapa
23.4 implementada localmente e aguardando commit; não há publicação autorizada.

STAGING e PROD continuam deliberadamente bloqueados na fábrica e no build. A
preparação abaixo é código testável com fronteiras simuladas, não habilitação
de hospedagem nem aprovação para conexão. A branch parte de `40375a5`.

`prepareHostedEnvironment` valida contrato tipado de projeto Supabase HTTPS,
chave pública e origem HTTPS canônica separada para cada ambiente; rejeita
localhost, endereço IP, origem inválida, mistura de projeto/chave e configurações
genéricas DEV. `validateHostedOrigin` compara a origem recebida com a origem
aprovada. `prepareClientConfiguration`, usado pela fábrica real, aplica esse
contrato e a origem correspondente, e define as mesmas opções do Auth para os
dois caminhos; é uma preparação pura, sem criar cliente ou fazer rede. Em seguida,
a fábrica chama a guarda obrigatória `requireEnabledEnvironment`, que recusa
STAGING/PROD antes de chamar o SDK, mesmo para configuração válida. O build
continua recusando esses modos e injetando somente DEV. Não há flag para contornar
essas guardas. Antes da homologação é necessária alteração específica revisada e
autorizada dos bloqueios e do empacotamento de variáveis, além de validação real
em ambiente isolado. Não se alegou criação real de cliente hospedado nesta etapa.

DEV continua usando `.env.development.local` e somente API local fixa; os
scripts locais e a função `password-login` mantêm suas guardas. Para futura
homologação, definir `VITE_APP_ENV=STAGING`, `VITE_STAGING_SUPABASE_URL`,
`VITE_STAGING_SUPABASE_PROJECT_REF`, `VITE_STAGING_SUPABASE_PUBLISHABLE_KEY`
e `VITE_STAGING_SITE_ORIGIN`; beta futuro usa os equivalentes `PROD`. Ver
`.env.example`. Nunca incluir segredos em `VITE_*`: essa proteção valida nomes e
formatos conhecidos, mas não prova autenticidade de chave nem detecta todo
segredo disfarçado. Separação real de projetos precisa ser verificada pelo
operador, inclusive quando o outro ambiente não está presente na configuração.

Para hospedagem futura, o formulário tem caminho de login por e-mail usando
`signInWithPassword` oficial, sem consulta de username ou e-mail de terceiros;
o DEV continua usando a Edge Function local para username ou e-mail. Username
permanece nome de perfil, sem migração de identidade. Essa seleção hospedada
foi testada com SDK simulado; o código remoto não está ativo. As telas ainda
contêm avisos e políticas específicos de teste local, que devem ser revisados
antes da abertura a leitores reais. Confirmar política de enumeração, limites
de Auth e equivalência de mensagens com a configuração real do provedor.

Cadastro e recuperação usam `location.origin` para redirects; o plano da fábrica
exige correspondência exata com `siteOrigin` antes de qualquer criação futura de
cliente hospedado. Configurar Site URL e lista de redirects exata em
cada projeto, confirmação por e-mail, remetente e SMTP transacional, sem copiar
credenciais de um ambiente a outro. Validar no navegador homologado confirmação,
expiração/reenvio, recuperação e troca de conta; Mailpit só demonstra local.
Templates devem preservar o link oficial e usar HTTPS; nenhum SMTP foi criado.

Cloudflare Pages: build Vite estático com raiz em `dist` após liberação futura;
o `npm run build` atual é DEV e não é publicável. Hash routing não requer
rewrites por rota. `public/_headers` propõe cabeçalhos básicos e revalidação de
HTML/service worker para Pages; verificar aplicação efetiva no provedor, CSP
apropriada à origem Supabase autorizada e política de cache antes do lançamento.
O service worker existente não faz cache de conteúdo nem ativa entrega externa;
confirmar atualização e compatibilidade HTTPS em homologação. Nenhuma garantia
de funcionamento de Cloudflare ou Supabase gerenciado decorre dos testes locais.
O comando padrão `npm.cmd run preview` atualmente escolhe modo production e é
recusado. Para inspecionar somente o build DEV local, usar
`npm.cmd run preview -- --mode development`; isso não produz build hospedado.

Antes de homologar: revisar histórico e instalar as 15 migrações em ordem apenas
no projeto identificado e autorizado; conferir RLS/RPC, sessões, acesso OWNER,
limites de signup/comentários e manutenção privada. Projetar provisionamento
OWNER hospedado auditável: scripts existentes recusam remoto. Manter contas de
administração separadas. Testar backup e restauração isolada e definir retenção,
RPO/RTO. Revisar política de privacidade, atendimento e exclusão; configurar
observabilidade sem senhas, tokens, contatos ou conteúdo privado. Não ativar
Web Push externo ou NVI. Publicação e alteração de banco de produção exigem
autorizações explícitas separadas, com candidato, destino, validações e rollback.

Rollback: preservar artefato anterior e verificar sua compatibilidade com o
esquema; reverter frontend não reverte migrações, Auth ou dados. Qualquer
restauração ou migração corretiva exige avaliação de perda, teste isolado e
aprovação apropriada. Não usar reset ou os instaladores locais em hospedagem.

Para regressão local: confirmar branch e configuração exclusivamente DEV, rodar
testes, iniciar Supabase local e servir a Edge Function local protegida conforme
[username-login-local.md](username-login-local.md). Se houver problema, voltar
ao código local revisado após preservar alterações não commitadas; não apontar
DEV para projeto remoto, alterar banco de produção ou desativar as guardas.
