# Selah — créditos de autoria e papel PUBLICADOR (revisão para STAGING)

## Objetivo

Permitir que o OWNER publique um texto de qualquer autor, com os devidos créditos
públicos, e que futuros PUBLICADORES escrevam seus próprios devocionais sem
receber privilégios do ADMIN. Esta release não instala Temas e Séries.

## Papéis e autorias

- `author_id`: UUID da conta que criou o registro, protegido por RLS e grants
  de coluna; não é alterável pelo frontend e não aparece no leitor.
- `author_name`: nome público apresentado ao leitor como «Por Nome». É um
  crédito editorial, não uma prova de identidade, pode ser preenchido por
  OWNER/ADMIN em nome de autor externo e exige verificação editorial.
- Registros antigos conservam `author_name = NULL`: não inventar nomes nem
  inferir autor a partir da conta que digitou. Na leitura completa, aparece
  «Autoria não informada»; o painel permite atualizar o crédito.
- `review_requested_at`: registro de envio para revisão escrito por RPC de
  servidor. Enquanto não existir, o PUBLICADOR pode editar seu próprio
  rascunho. Após envio, não pode editar; OWNER/ADMIN podem publicar ou devolver.
- PUBLICADOR é associado por `private.devotional_publishers`, com RLS e nenhum
  acesso direto para API. Não altera `private.admin_users` nem `private.app_owner`.
- OWNER herda ADMIN pela migration anterior `20261104000100`. ADMIN não
  herda OWNER. Somente OWNER elegível pode conferir/revogar PUBLICADOR;
  administração por username exato sem acesso ao diretório completo de leitores.

## Fluxo

1. OWNER abre `#admin`, cadastra «Autor (crédito público)», os campos
   editoriais e publica um devocional com o nome correspondente.
2. OWNER abre `#owner/publicadores`, informa o username de um leitor adulto
   já cadastrado e autorizado e concede PUBLICADOR.
3. PUBLICADOR faz login, acessa `#publicador`, cria e edita somente seus
   rascunhos e seleciona «Enviar para revisão».
4. O editor administrativo identifica «Em revisão» e pode publicar agora ou
   devolver o texto ao autor para revisão. O PUBLICADOR não tem acesso a
   `#admin`, `#owner`, publicação direta, exclusão de devocionais nem
   métricas de usuários.

**Política inicial:** PUBLICADOR não publica diretamente. Para permitir isso
em outra etapa, será necessária autorização específica no banco; mudar só
a interface não concede esse direito.

## Arquivos

- Migração nova: `supabase/migrations/20261104000200_author_credit_publisher.sql`
- Testes SQL em banco **local descartável**:
  `supabase/tests/publisher-author-credit.sql` (nunca executar no remoto)
- Interface: `AdminPanel`, `OwnerPanel`, `PublisherPanel`,
  `PublisherManagement` e leitores.
- Segurança: RLS/credenciais verificadas no servidor, validação de texto
  no frontend, testes unitários e de interface; não usar service_role.

## Dependência e sequência de implantação

Esta branch nasce de `feat/owner-admin-inheritance` (PR #4). A migração
`20261104000100_owner_admin_inheritance.sql` já foi aplicada no STAGING,
mas PR #4 ainda precisa ser integrado no STAGING antes desta release.

1. Executar `npm.cmd run test:run`, `npm.cmd run lint` e
   `.\\node_modules\\.bin\\tsc.cmd -b` na branch desta release.
2. Validar schema/RLS em **Supabase local descartável**, inclusive execução
   do teste SQL; verificar concessão, revogação, isolamento, envio e devolução.
3. Sem credenciais em logs, conferir `supabase link` ao projeto STAGING
   `hepndavkzuktakezrmsj` e `npx.cmd --yes supabase@2.122.0 db push --dry-run --linked`.
   Deve constar apenas a migração `20261104000200` no STAGING.
4. Com testes e aprovação explícita, aplicar a migração em STAGING e conferir
   `supabase_migrations.schema_migrations`.
5. Configurar a URL exata do Preview da branch no Cloudflare sem promover
   nenhum build prematuramente. Executar testes reais com OWNER e uma conta
   PUBLICADOR **fictícia autorizada**, incluindo leitor não autorizado.
6. Verificar publicação e créditos exibidos, isolamento entre contas, tentativas
   de API negadas, cadastro/leitura e logout. Só então fazer merge ao STAGING.
7. Não executar `20261028001000_editorial_structure.sql`. Essa proposta
   antiga deverá ser revista/renumerada após a release atual.

## Atenção ao rollout

Migração e build são mudanças distintas. O schema inicialmente permite
`author_name = NULL` para preservar publicações legadas e compatibilidade
durante a transição. O frontend novo obriga o crédito ao salvar, e a RPC de
envio impede submissão sem crédito. Revisar o preenchimento dos dados legados
antes de exigir esse campo de modo universal por constraint.

Cadastro STAGING ainda informa dados fictícios. Antes de convidar pessoas reais,
validar termos, privacidade, confirmação de e-mail, regras de cadastro e faixa
etária. Não copiar dados de pessoas reais para o projeto de homologação sem
finalidade e consentimento adequado.

## Não realizado nesta preparação

Nenhuma migração desta branch foi executada no Supabase STAGING, nenhum
teste local/SQL foi executado pelo agente e não houve merge nem deploy.
O PR permite revisão e execução controlada pelo responsável.
