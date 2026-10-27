> Estado atual — Prompt 43: OWNER local já provisionado; conferência final na
> branch `feat/local-auth`, HEAD `31cb42d`. Os registros dos Prompts 39/40 abaixo
> descrevem o estado histórico anterior ao provisionamento.

## Prompt 43 — validação manual do responsável: 4/4 aprovados

Confirmação comunicada pelo responsável nesta sessão, após as correções do Prompt 42:

1. Calendário pessoal avança e retrocede vários meses.
2. O mês selecionado permanece estável durante atualizações assíncronas.
3. Alt+Tab não fecha a seção Comunidade e Ofensivas.
4. F5 preserva a seção Comunidade e Ofensivas.

Essas quatro aprovações são manuais. Não representam novos testes automatizados,
aprovação de cenários adicionais, uso público, homologação ou produção. Substituem
a pendência de revalidação humana das duas correções registrada no Prompt 42.
Resultados repetidos nesta conferência: [testing.md](testing.md#etapa-222--prompt-43-conferência-final).
Lista e comandos CMD finais: [owner-community-review.md](owner-community-review.md#versionamento-cmd--prompt-43).

Riscos conhecidos mantidos: as fixtures sintéticas influenciam os totais locais e
não devem ser interpretadas como engajamento real. Há sete contas sem proveniência
classificada; nenhuma foi exportada, alterada ou excluída. Indicadores de hábitos
religiosos exigem avaliação de privacidade antes de uso público. Retenção de
recibos, auditoria e atendimento de exclusão continuam sem política operacional
definida; não há limpeza automática nesta entrega. Auditoria privada retém UUIDs
após exclusão de conta. O bundle DEV supera 500 kB. Chromium simula a integração;
não valida por HTTP a sessão OWNER pessoal. A aprovação humana informada cobre
somente os quatro itens acima. STAGING/PROD permanecem desabilitados.

> Prompt 40: o provisionador controlado e a auditoria incremental 00500 estão
> documentados em [owner-local-provisioning.md](owner-local-provisioning.md).
> A conta efetiva continua sem promoção; os 40 candidatos abaixo são do Prompt 39.

# Etapa 22.2 — consistência pessoal e comunidade

Branch `feat/local-auth`, base `31cb42d`. Trabalho anterior preservado; sem staging
Git, commit, operação hospedada ou publicação. Somente dados fictícios locais.

## Fórmula e universo

Cada dia civil com ao menos uma conclusão conta uma vez. O dia é persistido pelo
servidor em America/Sao_Paulo. Vários textos concluídos no mesmo dia não aumentam
a sequência. Abertura, tempo elegível sem ação voluntária e releitura de recibo
anterior não criam outro dia. O protocolo de 60 segundos permanece intacto.

Ofensiva atual é o tamanho da sequência consecutiva cujo último dia é hoje ou
ontem. Se terminou antes de ontem, vale zero. Recorde é a maior sequência de toda
a história. Dias com conclusão é a contagem distinta de dias. Recibos continuam
contando quando o conteúdo original é retirado do acervo; não há edição manual.

Situações: concluído hoje, pendente hoje (sequência terminando ontem), interrompida
(histórico antigo) e sem conclusões (zero, identificado separadamente).

`get_my_consistency(date)` usa SECURITY INVOKER e RLS: somente o próprio leitor,
inclusive quando a sessão é editorial ou OWNER. Traz calendário mensal e totais
pessoais. A seleção do mês não muda contadores e não aceita outro ID ou hoje.
Atualização ao foco/visibilidade e a cada minuto usa novamente o dia do servidor.
Navegação fica disponível durante atualização; respostas antigas são descartadas.

`get_owner_community(text,integer,integer)` é um ranking administrativo de métricas
individuais, sem calendário detalhado ou lista de textos. O universo compreende
**todas as contas Auth não anônimas e não excluídas**, inclusive não confirmadas,
legadas sem username e contas editoriais/proprietário. Uma conta bloqueada ainda
cadastrada continua no universo. Não confundir cadastro com leitor ativo.
Os dois resumos são globais e não mudam com a busca; `matched_readers` é filtrado.
Busca literal por trecho do username, sem wildcard; normaliza caixa/espaços e @
no cliente. Contas legadas aparecem sem username, sem expor identificador.

Ordenação: ofensiva atual decrescente, username crescente (nulos no final), UUID
interno como desempate final, sem retornar esse UUID. Página zero-based, padrão
25, limite 100; limite de página 1.000.000. Cada chamada usa um snapshot SQL.
Paginação por offset é estável com dados imutáveis; novas conclusões/cadastros
entre chamadas podem mover linhas. Não promete snapshot compartilhado entre páginas.

## Autorização efetivamente adotada

| Papel | Fonte confiável | Acesso |
| --- | --- | --- |
| OWNER | `private.app_owner`, singleton, provisionado por operador de banco | RPC de métricas de todas as contas cadastradas |
| Editorial atual / futuro PUBLISHER | `private.admin_users` existente | Permissões editoriais atuais, sem herdar OWNER |
| READER | Sessão Auth | Acervo permitido, perfil e métricas próprias |

PUBLISHER é uma função futura, **sem novo papel Auth, tela ou concessão nesta
etapa**. Os testes de publisher usam administração editorial sem OWNER, que é a
fronteira real adotada. Antes de convidar publicadores, revisar o escopo editorial
existente; ele ainda permite administrar conteúdo de outros autores.

OWNER e editorial são memberships independentes: OWNER não concede editorial em
cascata, nem editorial concede OWNER. Para abrir o painel atual pela interface,
o proprietário precisa das duas autorizações explícitas. OWNER sozinho continua
autorizado na RPC, sem receber permissões editoriais implicitamente.

Nenhuma conta foi promovida automaticamente. A nova tabela nasce vazia. Não se
presume que todos os administradores atuais sejam o proprietário. A promoção do
administrador efetivo **permanece uma operação controlada pendente de auditoria**.

Procedimento de migração segura do proprietário atual:

1. Operador confiável identifica o ambiente local com o preflight protegido.
2. Fora dos relatórios/versionamento, confirma a identidade do responsável, conta
   confirmada, membership editorial e controle da conta. Não escolher simplesmente
   o primeiro/admin mais antigo, nem usar metadados como prova de propriedade.
3. Em transação no servidor, bloquear `private.app_owner` contra concessões
   concorrentes, exigir tabela vazia, conferir conta confirmada e membership
   editorial do alvo e inserir **somente o alvo auditado**. Não alterar admin_users.
   O singleton também impede dois proprietários. Não há endpoint de concessão.
4. Confirmar somente sucesso/quantidade, sem imprimir UUID, e-mail ou credenciais;
   recarregar a sessão e validar o painel. Registrar a autorização com acesso
   restrito no processo operacional, sem dados pessoais neste repositório.
5. Para revogar, remover apenas o vínculo auditado em transação e atualizar o
   painel. A próxima RPC nega acesso mesmo com JWT antigo. Transferência exige
   nova auditoria/autorização; não implementar autoatendimento pelo frontend.

Não executamos esse procedimento em conta preexistente. Os ensaios concedem e
revogam somente memberships de novas fixtures fictícias. A tabela ficou vazia
após os ensaios. Nenhum UUID ou segredo é incluído nesta documentação.

RPC SECURITY DEFINER de owner `postgres`, search_path vazio, nomes qualificados,
sem SQL dinâmico; verifica auth.uid() contra tabela privada a cada chamada.
PUBLIC/anon/service_role não têm EXECUTE; authenticated só executa após verificação
interna. Tabela privada tem RLS sem policies e sem grants de cliente. Metadados,
IDs, parâmetros extras ou componentes montados manualmente não concedem OWNER.
Não mudamos RLS/grants de progresso, conclusões, perfis e contatos. Mesmo OWNER
continua sem SELECT de conclusões de terceiros pela API. Retorno mínimo:
username, ofensiva atual, recorde, dias com conclusão e situação, mais totais e
referência civil. Sem telefone, e-mail, segundos, texto, aberturas ou IDs.

## Transparência e avaliação antes de acesso público

Conclusões geram métricas individuais de consistência. O proprietário do Selah
pode consultar esses indicadores para gestão, acompanhamento e incentivo ao uso,
inclusive conversas voluntárias. O ranking é administrativo, não público. Outros
leitores e futuros publicadores não têm acesso. Não há gamificação pública,
mensagens automáticas, edição de ofensiva ou checkbox de consentimento separado.

O aviso aparece no cadastro/login e em Privacidade e conta no perfil, com links
para a política acessível em #privacidade antes de criar uma conta. WhatsApp
tem finalidade e regras separadas: a autorização opcional de contato para feedback
não é reutilizada como base para métricas e o painel não libera contatos.

Essa transparência **não comprova conformidade integral com legislação**. Antes
de abrir ao público, o responsável deve avaliar e definir, com apoio qualificado:
base aplicável e necessidade/proporcionalidade, retenção e exclusão dos recibos,
atendimento de direitos e pedidos, comunicação a contas preexistentes, segurança
e registro de acesso do proprietário, compartilhamento/exportação e restrições a
inferências sobre hábitos religiosos. Atenção especial a menores: público etário,
tratamento apropriado, participação de responsáveis quando aplicável e limites
de acompanhamento/contato precisam de avaliação específica. Não houve parecer
jurídico, implementação de controle de idade ou autorização para disponibilizar
o produto publicamente. O pedido de exclusão segue manual, sem exclusão automática.

## Crescimento e limites

Agregação no banco evita limite de mil linhas do REST e mantém paginação limitada.
Índice (user_id,completed_day) atende a consistência. O ranking calcula histórico
para toda a base a cada consulta, sem tabela duplicada de contadores. Adequado
para esta fase local; não houve benchmark de carga. Antes de crescer, medir planos
e latência com dados sintéticos, considerar agregados incrementais reconciliáveis,
cache privado com invalidação e cursor estável, preservando checagem OWNER no
servidor e isolamento. Não há exportação nem auditoria persistente de consultas
nesta etapa; consultas já recebidas podem permanecer visíveis até atualizar/sair.

## Migrações, execução e roteiro manual

`20261028000300_reader_consistency.sql` já estava aplicada; seu conteúdo foi
preservado. `20261028000400_owner_community.sql` é incremental, aplicada somente
localmente por `node scripts/apply-local-owner-migration.mjs` com histórico exato
e transação. Não houve reset, db push ou link. Migrações anteriores intactas.
Para banco novo, aplicar incrementos em ordem; o verificador isolado comprova
as onze migrações sem copiar contas ou outros dados da stack atual.

1. Iniciar Supabase local existente, `node scripts/serve-local-login.mjs` e
   `npm.cmd run dev -- --host 127.0.0.1`; usar somente fixtures fictícias.
2. Rodar `node scripts/local-consistency-smoke.mjs --check-local`.
3. Cadastrar conta com username/WhatsApp fictícios, ler o aviso de métricas sem
   novo checkbox, confirmar no Mailpit e entrar por username e por e-mail.
4. Conferir perfil, autorização de feedback separada e aviso de privacidade.
5. Ver ofensiva zero, calendário atual, recorde zero e ausência de conclusão.
6. Abrir texto publicado: antes de 60 segundos confirmados, Concluir bloqueado.
   Ocultar aba, retomar e recarregar: somente tempo aceito pelo servidor persiste.
7. Após 60 segundos reais, nenhuma conclusão automática. Concluir com teclado,
   verificar hoje, sequência e recorde; recarregar/sair/entrar e conferir persistência.
8. Com histórico sintético preparado pelos testes, conferir sequência terminando
   ontem, recorde maior, interrupção, múltiplas conclusões/dia e virada do ano.
9. Em Sua constância, navegar meses por Tab/Enter; focar janela durante consulta,
   verificar foco e navegação, mês atual, limites e erro/repetição sem falsos zeros.
10. Auditar/provisionar somente OWNER fictício em servidor pelo procedimento
    acima; recarregar. No painel, abrir Comunidade e ofensivas e conferir os totais.
11. Buscar username com @/caixa alta por Enter; conferir dados individuais, zero,
    empate, próxima/anterior página, vazio e falha de rede. Voltar a página 1
    ao buscar. Conferir tabela em 390px e desktop, foco visível e rolagem interna.
12. Com leitor e editorial sem OWNER, tentar RPC diretamente: negação, inclusive
    após editar metadados para OWNER; tentativa de selecionar ledger alheio vazia.
    Não usar chaves privilegiadas no navegador. Retirar vínculo fictício ao terminar.
13. Conferir cadastro/login/recuperação, perfil, acervo, aberturas e editor existentes.
14. Inspecionar Network: somente loopback; resposta comunitária sem contatos,
    histórico detalhado ou IDs. Nada acessível anonimamente ou como ranking público.

Os roteiros acima são instruções, não cenários manuais atribuídos ao responsável.
Resultados efetivamente executados estão no inventário `testing.md`.

## Arquivos candidatos e pendências para commit

São 40 arquivos candidatos (incluindo o trabalho recuperado), sem `git add` ou
commit. HEAD continua `31cb42d`. Nenhuma migração anterior à 00300 foi alterada.

- Documentação: este arquivo (novo); `docs/development-workflow.md`,
  `docs/privacy-essential.md`, `docs/testing.md` (modificados).
- Banco (novos): `supabase/migrations/20261028000300_reader_consistency.sql`
  (recuperado, já aplicado), `supabase/migrations/20261028000400_owner_community.sql`,
  `supabase/tests/reader-consistency.sql`, `supabase/tests/owner-community.sql`.
- Scripts modificados: `scripts/local-reading-browser.mjs`,
  `scripts/verify-local-reading-install.mjs`.
- Scripts novos: `scripts/apply-local-consistency-migration.mjs` e seu `.d.mts`,
  `scripts/apply-local-owner-migration.mjs`, `scripts/consistency-local-fixtures.mjs`,
  `scripts/local-consistency-smoke.mjs`, `scripts/local-owner-smoke.mjs`,
  `scripts/run-local-consistency-sql.mjs`, `scripts/run-local-owner-sql.mjs`.
- Aplicação modificada: `src/App.tsx`, `src/App.css`,
  `src/components/AccountPrivacy.tsx`, `src/components/AdminPanel.tsx`,
  `src/components/AuthForm.tsx`, `src/components/ReaderLibrary.tsx`,
  `src/components/UI.tsx`.
- Componentes novos: `src/components/ConsistencySection.tsx`,
  `src/components/CommunityPanel.tsx`, `src/components/PrivacyPolicy.tsx` e os
  três respectivos `.test.tsx`.
- Domínio novo: `src/consistency/calendar.ts`, `calendar.test.ts`,
  `repository.ts`, `repository.test.ts`, `community.ts`.
- Fronteiras/testes: `src/test/consistencyBoundary.ts` (novo),
  `src/test/localEnvironment.test.ts`, `src/test/localReadingEntrypoints.test.ts`,
  `src/test/setup.ts` (modificados).

Antes de preparar um commit, revisar os candidatos e aprovar o resultado local.
O provisionamento da conta efetiva do proprietário depende da auditoria descrita
acima; sua ausência deliberada não deve ser contornada com promoção automática.
Não há autorização de publicação ou migração remota nesta entrega. Não iniciar
a Etapa 22.3 como consequência deste trabalho.
# Prompt 42 — navegação (Etapa 22.2)

Correção local: os destinos anterior/próximo usam o mês selecionado, com atualização
funcional do estado, em vez do mês da última resposta. Assim, cliques rápidos,
inclusive agrupados no mesmo render, acumulam movimentos. Os limites do servidor
continuam valendo: primeiro mês com conclusão até mês atual; sem conclusões,
o intervalo é apenas o mês atual. Meses intermediários vazios são permitidos.
Respostas antigas continuam descartadas pelo cleanup do efeito.

Foco, visibilidade, timer e nova conclusão consultam novamente a seleção vigente,
sem retornar automaticamente ao mês atual. Mouse e Enter usam botões nativos.
Uma recarga completa inicia no mês atual informado pelo servidor; a seleção do
calendário é transitória, sem persistência em storage. “Mês atual” retorna
explicitamente ao mês do servidor. Nenhuma data do relógio local define limites.

A seção administrativa usa `#admin/comunidade`. Ao renovar a sessão, a verificação
editorial continua desmontando o conteúdo enquanto consulta a autorização; ao
voltar, a seção é reconstruída pela rota. A consulta OWNER é refeita e pode negar
o ranking. Refresh preserva essa rota. Busca/página/editor em andamento não são
persistidos durante remontagem; não houve ampliação desse escopo.

Regressões reproduzidas antes da correção, cobertura, validações e comandos exatos
para versionamento: [revisão final](owner-community-review.md#prompt-42--consolidação-final).

