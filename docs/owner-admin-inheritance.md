# OWNER herda ADMIN no STAGING

## Regra de acesso

- OWNER é um superset do ADMIN legado: pode gerenciar e publicar devocionais,
  inclusive criar rascunho, editar, colocar em rascunho, publicar imediatamente
  e consultar a lista editorial. Continuam valendo os limites de campos e as
  regras de publicação da Etapa 19.
- A herança é verificada no banco por `private.is_admin()`, usado pelas
  políticas RLS de `public.devotionals` e pela RPC `public.devotional_open_counts()`.
  O frontend atual também usa essa RPC para habilitar o menu administrativo.
- Somente um OWNER ativo e elegível herda o ADMIN. Os mesmos critérios de
  `private.owner_identity()` devem ser preservados: e-mail confirmado, conta
  não anônima, não suspensa, não excluída e sem pedido de exclusão pendente.
- ADMIN legado **não** se torna OWNER e não obtém os recursos exclusivos
  `#owner`, comunidade ou moderação, nem a gestão futura de papéis OWNER.
- A migração não insere o OWNER em `private.admin_users`, não altera a
  auditoria de provisionamento e não concede papéis automaticamente a leitores.
- O Painel OWNER inclui atalho para `#admin`; o painel editorial existente é
  reutilizado, sem duplicar operações de escrita.

## Escopo e publicação

Migration: `20261104000100_owner_admin_inheritance.sql`.
**Aplicar apenas no Supabase STAGING** após verificar projeto e migrações;
não executar em PROD. O commit e o PR não aplicam SQL remoto automaticamente.

A release editorial de Temas e Séries permanece separada; a proposta antiga
`20261028001000_editorial_structure.sql` não foi incluída nem aplicada.
Ao prepará-la depois, reavaliar ordem/versão das migrations porque
`20261028001000` antecede `20261104000100`; não tentar enviar versões fora
de ordem sem revisão.

## Validação obrigatória antes do merge

1. Confirmar as 16 migrations já aplicadas no Supabase STAGING e verificar
   que a nova versão é a única pendente para esta alteração.
2. Aplicar a migração no STAGING com operador autorizado, sem alterar
   manualmente `private.admin_users` ou `private.app_owner`.
3. Entrar com a conta OWNER existente no Preview da branch; confirmar
   os dois menus: Painel OWNER e Painel administrativo.
4. Em `#admin`, criar um rascunho fictício e testar a edição. Publicar um
   conteúdo de teste somente com aprovação do responsável.
5. Entrar com uma conta leitor: não deve aparecer Painel administrativo,
   e a API deve negar inserção, edição e acesso à RPC de contagens.
6. Em conta ADMIN legado (quando disponível), conferir acesso editorial
   sem acesso ao Painel OWNER. Conferir logout e troca de sessão.
7. Revisar o estado de publicação no Cloudflare e só então fazer merge.

**Limites da validação neste PR:** os testes de React são simulados e não
substituem teste real de RLS/Auth no Supabase STAGING. Nenhum teste SQL remoto,
build de Preview ou publicação é afirmado até execução.

## Rollback

Em caso de problema, revisar e restaurar com uma nova migration a implementação
anterior de `private.is_admin()` (membership exclusiva em
`private.admin_users`), preservando schema e dados. Não excluir tabelas,
contas ou devocionais para reverter esta alteração.
