# OWNER local — auditoria e provisionamento (Prompt 40)

Branch `feat/local-auth`, HEAD/base `31cb42d`. Nenhuma conta preexistente foi
selecionada ou promovida. Trabalho do Prompt 39 preservado, sem commit ou staging.
Este procedimento é exclusivamente local, para operador confiável da máquina e
do PostgreSQL. Não serve como procedimento de produção.

## Arquitetura e identidade

`20261028000400_owner_community.sql` cria `private.app_owner` com singleton booleano
obrigatoriamente true como PK, UUID único e FK para Auth. RLS habilitada, sem
policies e sem grants para PUBLIC/anon/authenticated/service_role. Somente operador
servidor confiável pode alterar o vínculo. Nenhuma RPC de autoatribuição é exposta.

`get_owner_community` é SECURITY DEFINER de postgres, search_path vazio, objetos
qualificados, EXECUTE apenas para authenticated e verificação de auth.uid()
contra membership privada em cada consulta. Papel nos metadados não concede OWNER.
A consulta retorna apenas username, ofensiva atual, recorde, dias com conclusão,
situação, totais e referência civil. Não retorna e-mail, telefone, UUID, textos,
segundos ou histórico detalhado. READER continua com métricas próprias. Editorial
sem OWNER (fronteira do PUBLISHER futuro) não acessa ranking.

Editorial e OWNER são independentes. O painel existente exige editorial para
entrada e OWNER para a RPC comunitária. O provisionador exige que o alvo já tenha
editorial, **sem criar ou remover esse papel**. O fato de ser editorial é apenas
pré-requisito técnico; não prova propriedade. Revogar/transferir OWNER mantém os
papéis editoriais exatamente como estavam.

Verificação de identidade exigida antes de qualquer concessão:

1. O responsável entra **na própria conta local** usando Auth oficial e confirma
   controle da conta. Confirmação de e-mail sozinha não prova que é o proprietário.
2. Obtém o UUID Auth exato da própria sessão validada pelo servidor (campo `id`
   de `auth.getUser()` ou resposta autenticada `/auth/v1/user`), ou confere esse
   UUID no Studio **local** (`http://127.0.0.1:54323`) por operador confiável.
   Não enviar tokens, senhas, números ou capturas com contatos.
3. Confere a correspondência com a conta pretendida e declara explicitamente ao
   operador o UUID completo e que essa conta é sua conta proprietária local.
   Não escolher por username, e-mail aproximado, ordem, antiguidade ou primeiro admin.
4. Operador executa `inspect` somente para o UUID fornecido. O comando retorna
   apenas exists/eligible/is_owner/owner_count, nunca listas ou dados de contato.
5. O responsável confirma o resultado concreto e autoriza a concessão para esse
   UUID. Registrar essa aprovação em controle restrito, associado a referência
   opaca `LOCAL-...`. Não colocar identidade, UUID ou credenciais no repositório.

Repetir o UUID em `--confirm` previne erros de alvo e exige intenção explícita;
**não autentica o ser humano nem substitui a confirmação acima**. O script não
consegue provar propriedade ou que houve aprovação em uma conversa. A fronteira
de confiança é o operador autorizado com acesso local ao banco.

## Proteções do provisionador

`scripts/provision-local-owner.mjs` usa `local-owner-tools.mjs` e as guardas
existentes de ambiente/Docker. Não lê `.env`, não resolve conta por contato,
não recebe senha, conexão ou chave e não usa Auth Admin API/service_role.

- Recusa proxies HTTP/HTTPS/ALL, URLs fora do loopback/portas previstas, overrides
  PG perigosos, Docker remoto, contexto malicioso ou contexto/host conflitantes.
- Recusa credenciais Supabase em variáveis de ambiente, inclusive DEV; recusa
  configurações STAGING/PROD, URLs de conexão injetadas, PGPASSWORD/PGPASSFILE,
  PGOPTIONS e NODE_OPTIONS. Não imprimir valores ao corrigir o ambiente.
- Subprocessos recebem uma lista restrita de variáveis operacionais. Chaves
  arbitrárias não são encaminhadas. O status local é validado sem imprimir sua
  saída; somente a chave pública local é usada pelo helper de testes HTTP.
- Docker é fixado a socket Unix/named pipe validado; PostgreSQL usa contêiner
  `supabase_db_devocionais-app`, socket interno e database/role fixos, `psql -X`,
  `ON_ERROR_STOP=1`. Não segue URL de banco fornecida externamente.
- UUID, ação e flags são estritos. Referência de auditoria única e opaca, com
  formato `LOCAL-[A-Za-z0-9_-]{8,80}`. Sem SQL dinâmico de parâmetros livres.
- Grant exige ausência de OWNER; revoke/transfer exigem OWNER atual exatamente
  igual ao esperado. Alvo de grant/transfer deve existir, estar confirmado,
  não excluído, não anônimo, não banido e já ser editorial.
- Transação única, lock exclusivo na tabela OWNER, lock compartilhado editorial
  e na conta alvo; lock_timeout 5s e statement_timeout 15s. Concessões concorrentes
  têm um vencedor; não há `ON CONFLICT` que substitua o dono ou finja sucesso.
- Erro de alvo, elegibilidade ou auditoria reverte **toda** a operação. Não há
  inserção editorial, grant em cascata nem mudança nas permissões do aplicativo.
- Saídas são genéricas ou booleanas, sem imprimir UUID, SQL ou credenciais.

Preflight valida o destino técnico, não a identidade da pessoa. Uma máquina
comprometida, socket local encaminhado deliberadamente ou operador superuser
malicioso ficam fora dessa proteção. Não executar comandos em terminal cuja
configuração/origem não seja confiável.

## Auditoria e migração incremental

`20261028000500_owner_provision_audit.sql` acrescenta somente a tabela privada
`owner_provision_audit`, com RLS e sem acesso de cliente, inclusive para OWNER.
Não altera funções de métricas, Auth, papel editorial ou migrações anteriores;
não promove contas. Aplicação protegida/idempotente por histórico conhecido em
`scripts/apply-local-owner-audit-migration.mjs`, somente no banco local.

Cada alteração bem-sucedida pelo provisionador grava na mesma transação ação,
instante do servidor, UUID anterior/próximo, referência única e session_user do
banco. Não há FK dos UUIDs do diário para Auth, preservando auditoria após eventual
exclusão da conta. Nenhuma credencial ou contato é armazenado nesse diário.
Falhas/negações não gravam eventos de sucesso; registrar incidentes separadamente
sem dados sensíveis. Reuso de referência falha e desfaz a alteração do vínculo.

O ator de banco é postgres, **não uma identidade humana verificada**. A referência
liga a operação à aprovação externa restrita. O diário não é imutável contra
superuser e não captura SQL manual ou exclusão por cascata da FK original; acesso
direto de operador deve continuar controlado. Não usar SQL manual para contornar
o provisionador. Retenção/acesso humano à auditoria precisam de decisão antes
de qualquer uso público; não há implantação ou conformidade jurídica presumida.

Para conferir um evento, operador no SQL Editor do **Studio local** pode executar
consulta somente de leitura que não retorna UUIDs:

```sql
begin read only;
select action, recorded_at, database_actor
from private.owner_provision_audit
where audit_ref = 'LOCAL-P40-GRANT-20261027-A1';
rollback;
```

Use a referência efetivamente aprovada. O diário completo contém identificadores
privados: não exportar nem publicar. A implementação nesta etapa reteve apenas
eventos de novas fixtures fictícias.

## Comandos exatos no CMD

Abrir CMD confiável, sem proxies, variáveis de credenciais hospedadas ou overrides
de runtime/PG. Se uma guarda recusar, corrigir a configuração; não remover guardas
nem despejar `set`/status/arquivos de credenciais para diagnosticar.

```bat
cd /d "C:\Users\leand\Documents\devocionais-app"
git branch --show-current
git log -1 --oneline
node scripts/provision-local-owner.mjs --check-local
node scripts/apply-local-owner-audit-migration.mjs --check-local
node scripts/apply-local-owner-audit-migration.mjs
```

A migração já foi aplicada localmente nesta etapa. Repetir não promove ninguém.

Após o responsável fornecer o UUID **exato**, substitua o placeholder abaixo em
terminal restrito. `inspect` é somente leitura, não uma autorização para promover.

```bat
set "SELAH_OWNER_UUID=SUBSTITUIR_PELO_UUID_EXATO_CONFIRMADO"
node scripts/provision-local-owner.mjs inspect "%SELAH_OWNER_UUID%"
```

**Não executar o próximo comando nesta entrega.** Somente após confirmação humana
e autorização explícita, usar referência nova vinculada à aprovação:

```bat
node scripts/provision-local-owner.mjs grant "%SELAH_OWNER_UUID%" --confirm "%SELAH_OWNER_UUID%" --audit-ref "LOCAL-P40-GRANT-20261027-A1"
node scripts/provision-local-owner.mjs inspect "%SELAH_OWNER_UUID%"
```

Se um OWNER já existir, grant deve falhar; não limpar a tabela ou substituir o
vínculo para fazê-lo passar. Se a conta não for elegível, não criar editorial
automaticamente. Investigar/autorizá-lo como operação separada, se necessário.

Revogação controlada, após nova autorização referente ao OWNER atual exato:

```bat
node scripts/provision-local-owner.mjs revoke "%SELAH_OWNER_UUID%" --confirm "%SELAH_OWNER_UUID%" --audit-ref "LOCAL-P40-REVOKE-20261027-A1"
node scripts/provision-local-owner.mjs inspect "%SELAH_OWNER_UUID%"
```

Transferência exige confirmar identidade/controle de **ambas** as contas, OWNER
atual esperado e novo alvo elegível. Troca atômica, sem período com dois OWNERS:

```bat
set "SELAH_NEW_OWNER_UUID=SUBSTITUIR_PELO_NOVO_UUID_EXATO_CONFIRMADO"
node scripts/provision-local-owner.mjs inspect "%SELAH_OWNER_UUID%"
node scripts/provision-local-owner.mjs inspect "%SELAH_NEW_OWNER_UUID%"
node scripts/provision-local-owner.mjs transfer "%SELAH_OWNER_UUID%" "%SELAH_NEW_OWNER_UUID%" --confirm "%SELAH_OWNER_UUID%" --confirm-target "%SELAH_NEW_OWNER_UUID%" --audit-ref "LOCAL-P40-TRANSFER-20261027-A1"
```

Reversão de uma concessão é revoke do alvo exato com nova aprovação/referência;
reversão de transferência é transferência explícita inversa após nova auditoria.
Não reverter apagando o diário ou reescrevendo migrações.

## Validação com dados fictícios e revisão manual

```bat
node scripts/local-owner-provision-smoke.mjs --check-local
node scripts/local-owner-provision-smoke.mjs
node scripts/run-local-owner-audit-sql.mjs
node scripts/run-local-owner-sql.mjs
node scripts/run-local-consistency-sql.mjs --regression
node scripts/verify-local-reading-install.mjs
npm.cmd run test:run
npm.cmd run build
npm.cmd run lint
git diff --check
```

A integração de provisionamento recusa iniciar se já houver OWNER; nunca usa nem
revoga conta preexistente. Cria contas fictícias, concede/revoga seus próprios
vínculos e retém contas/eventos fictícios. O ensaio não é aprovação para promover
o responsável. A verificação isolada usa imagem local sem pull, sem rede/portas
ou volumes compartilhados e copia somente DDL Auth, nunca contas ou segredos.

Depois de futura concessão autorizada, recarregar/login local, abrir painel >
Comunidade e ofensivas, conferir RPC e busca de username, projeção mínima e
ausência de contatos. Conferir negação com leitor/editorial sem OWNER. Depois de
revogar/transferir, atualizar a consulta: o backend deve negar imediatamente ao
antigo OWNER mesmo com JWT anterior. Dados já recebidos no navegador não podem
ser retirados retroativamente; fechar/recarregar a tela. Confirmar que editor
continua funcionando e que ninguém ganhou editorial por receber OWNER.

Resultados efetivamente executados e falhas intermediárias estão em `testing.md`.
Sem validação manual pelo responsável ou nova execução Chromium neste Prompt 40;
a interface da Etapa 22.2 não foi alterada. Pendente: UUID exato, confirmação humana,
autorização da concessão futura, roteiro manual e revisão dos candidatos para commit.
Nenhum git add/commit, acesso hospedado, STAGING/PROD ou Etapa 22.3 autorizados.

## Arquivos desta rodada

Novos: este documento; `scripts/local-owner-tools.mjs` e `.d.mts`,
`scripts/provision-local-owner.mjs`, `scripts/local-owner-provision-smoke.mjs`,
`scripts/apply-local-owner-audit-migration.mjs`, `scripts/run-local-owner-audit-sql.mjs`,
`supabase/migrations/20261028000500_owner_provision_audit.sql`,
`supabase/tests/owner-provision-audit.sql`, `src/test/localOwnerTools.test.ts`,
`src/test/localOwnerEntrypoints.test.ts`.

Atualizados: `docs/development-workflow.md`, `docs/testing.md`,
`docs/consistency-local.md`, `scripts/verify-local-reading-install.mjs`,
`scripts/apply-local-owner-migration.mjs`,
`scripts/apply-local-consistency-migration.mjs`,
`src/test/localReadingEntrypoints.test.ts`, `vitest.config.ts`. Os dois aplicadores
anteriores apenas reconhecem 00500 já instalada para não tentar reaplicar versões
anteriores; continuam recusando histórico desconhecido. Nenhuma migração anterior
foi reescrita. São 52 candidatos totais, incluindo o trabalho preservado do Prompt 39.
# Atualização de estado — Prompt 43

O OWNER local já foi provisionado antes desta conferência, sem UUID pessoal
versionado. As quatro validações manuais de navegação foram aprovadas pelo
responsável. As pendências de identidade/concessão descritas no registro histórico
do Prompt 40 abaixo não representam o estado atual. Nenhuma nova concessão,
revogação ou transferência foi executada no Prompt 43; nenhuma autorização futura
de operação OWNER é presumida. Conferência final e comandos Git agrupados em
[owner-community-review.md](owner-community-review.md).

