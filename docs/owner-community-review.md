# Etapa 22.2 — conferência final (Prompt 43)

Estado atual: `feat/local-auth`, HEAD/base `31cb42d`; **58 candidatos, 17
modificados e 41 novos**. As quatro validações manuais de calendário, estabilidade
assíncrona, Alt+Tab e F5 foram aprovadas pelo responsável nesta sessão e registradas
em [consistency-local.md](consistency-local.md) e [testing.md](testing.md).
Encerrada a pendência humana das duas correções do Prompt 42; nenhuma aprovação
adicional foi presumida. Os registros anteriores abaixo permanecem históricos.

Revisão final de todos os candidatos: seis documentos, vinte scripts/declarações
e SQL auxiliar, 25 arquivos de código/testes, seis migrações/testes SQL e uma
configuração Vitest. Lista exata nos comandos agrupados ao final deste documento.
Nenhum código, teste ou migração foi alterado nesta conferência documental.

As nove migrações da base estão iguais ao Git, normalizando apenas CRLF/LF. Os
incrementos 00300/00400/00500 continuam candidatos novos e não foram reescritos.
O verificador repetiu 12 migrações e 288 SQL/RLS em contêiner temporário isolado,
sem rede/volumes compartilhados, copiando apenas DDL Auth; suítes com rollback.

Ranking: a RPC verifica `auth.uid()` contra `private.app_owner` a cada consulta;
security definer, search_path vazio e projeção mínima. Membership e diário têm
RLS e nenhum acesso de cliente. `authenticated` ter EXECUTE não basta para passar
pela verificação OWNER. Editorial sem OWNER, leitor, anon e metadados forjados
foram negados na suíte SQL repetida. Futuro PUBLISHER continua representado pela
fronteira editorial sem OWNER, sem implementar novo papel nesta etapa.

Provisionador: nenhum UUID literal nos módulos operacionais ou aplicadores OWNER,
nenhuma conta selecionada por antiguidade/contato ou promovida automaticamente.
Exige UUID/confirmador/referência explícitos, valida elegibilidade e estado sob
locks e grava auditoria na mesma transação. Esses argumentos não autenticam a
pessoa: aprovação humana externa continua exigida. Os scripts opt-in de ensaio
criam/concedem fixtures próprias; não são autorização embutida para a conta real
e não foram executados contra a stack atual com OWNER provisionado.

Auditoria de caminhos e conteúdo integral dos 58: nenhum arquivo de ambiente,
credencial, token completo, chave privada, cookie, log, cache ou artefato temporário
identificado. Nenhum UUID pessoal fixo no provisionador. Varredura por assinaturas
não prova ausência universal de dados sensíveis. `.env.*.local`, `node_modules/.cache`
e `dist` ignorados pelo Git; não foram abertos arquivos de credenciais.
O relatório auxiliar de conferência ficou somente no cache ignorado.

Repetidos: 387 testes/35 arquivos, build DEV, lint, bloqueios STAGING/PROD, oito
HTTP negativos, 288 SQL/RLS, preflight OWNER e auditoria agregada somente leitura.
A primeira auditoria agregada foi recusada/falhou em execução restrita; sua
repetição permitida passou. Chromium não repetido: dez verificações do Prompt 42
com integração simulada continuam evidência histórica. A auditoria existente
confirmou 192/15, OWNER único ativo/auditado e RPC igual à candidata, sem mutação.

Riscos conhecidos: fixtures influenciam os totais e duas ofensivas de 1005 dias;
sete contas continuam sem proveniência classificada, sem exportação/limpeza.
Privacidade de hábitos religiosos, retenção de recibos/diário e operação de
exclusão precisam de decisão antes de uso público. O diário retém UUIDs após
exclusão; não há expurgo automático. Bundle JS de 513,07 kB (gzip 146,04 kB),
com aviso acima de 500 kB. Chromium não substitui HTTP positivo do OWNER; os
quatro testes humanos aprovam somente os cenários informados.

**Sem bloqueador técnico identificado para o commit local.** Esses riscos não
constituem autorização para uso público. STAGING/PROD continuam bloqueados.
Nenhum staging, commit, deploy, acesso hospedado, concessão/revogação, migração
na stack existente ou início da Etapa 22.3. Mensagem recomendada:
`feat(consistency): consolida etapa 22.2 e corrige navegação local`.

# Etapa 22.2 — revisão de dados e interface (Prompt 41)

Branch `feat/local-auth`, HEAD/base `31cb42d`. Trabalho dos Prompts 39/40 preservado.
Nenhuma migração, concessão/revogação de papel, limpeza ou edição de registros
na stack existente. Sem staging Git, commit, acesso hospedado ou publicação.

## Diagnóstico reproduzível, sem identificação de pessoas

Executado `node scripts/audit-local-community.mjs` com as guardas de ambiente do
provisionador. O SQL usa `BEGIN READ ONLY`, isolamento REPEATABLE READ e ROLLBACK.
Os resultados contêm somente contagens, data civil e booleanos. Não selecionam
contatos, usernames completos, UUIDs, tokens ou conteúdo para saída do processo.
O domínio/padrão de endereço é comparado **dentro** do banco para investigar a
origem, sem retornar o endereço. Não se leem arquivos de credenciais.

Snapshot do servidor em **27/10/2026, America/Sao_Paulo**:

| Verificação | Resultado |
| --- | --- |
| Contas no universo da RPC | 192 |
| Com conclusão hoje | 15 |
| Confirmadas | 187 (portanto, 5 não confirmadas) |
| Sem username | 40 |
| Sem dias com conclusão | 172 |
| Com padrão de endereço dos geradores conhecidos | 185 |
| Com domínio utilizado nas fixtures, incluindo outros padrões | 187 |
| Sem correspondência com gerador conhecido | 7; não classificadas como pessoas reais |
| Usernames no formato `u` + 20 dígitos hexadecimais | 148 |
| Desses, com evidência adicional do gerador | 147 |
| Desses, sem evidência adicional do gerador | 1; classificação pendente |
| Correspondências ao prefixo observado `u8031ded…` | 1, com evidência do gerador |
| Ofensivas atuais de 1005 dias | 2, ambas com assinatura completa da fixture |

Categorias se sobrepõem e não devem ser somadas. O universo é Auth não anônimo,
não excluído, inclusive contas não confirmadas, legadas e editoriais/proprietário.
Assim, **192 não é contagem de leitores reais/ativos nem audiência de produção**.
Os dados locais acumulam fixtures retidas pelas integrações anteriores. Não se
consideraram as sete contas sem padrão conhecido como reais por exclusão.

### As duas ofensivas de 1005 dias

`scripts/local-consistency-smoke.mjs` prepara uma nova conta fictícia via
`readingAccount` e executa:

```js
seedConsistency(local, b.id, { offsets: Array.from({ length: 1005 }, (_, n) => -n) })
```

O caso verifica agregação acima de mil registros, para não depender da paginação
REST. O helper `scripts/consistency-local-fixtures.mjs` insere recibos históricos
com IDs de conteúdo aleatórios, horário civil do meio-dia e datas explícitas.
Esses preparos são de operador de testes local, nunca uma API para o leitor.

As duas contas observadas coincidem com: endereço no padrão exato do gerador,
domínio das fixtures, 1005 dias distintos, 1005 recibos, intervalo de 1004 dias,
recibos todos ao meio-dia e fontes ausentes do acervo; ambas terminam hoje.
Portanto, os dois valores têm evidência conjunta de **histórico sintético de
teste**, não erro matemático. Não demonstram mil dias de uso ou leitura real.
Não houve acesso a senhas, texto de leituras ou listagem de contas na investigação.
Nenhuma fixture foi apagada ou corrigida. Também não repetimos o smoke que cria
outra sequência de 1005 dias na stack atual.

### Usernames gerados e legado

`readingAccount` gera username `u` + 20 caracteres hexadecimais e endereço
`selah-reading-<UUID aleatório>@example.invalid`. Outros scripts seguem padrões
próprios de fixture. O prefixo citado pelo responsável é compatível com essa
origem e a consulta agregada confirmou a correspondência ao gerador.

A interface **não abrevia usernames nem inventa esse identificador**: mostra o
username integral recebido na projeção. Em tela estreita, a tabela tem rolagem
interna. Apenas username nulo recebe `Conta legada sem username` (40 contas).
O formato gerado sozinho não prova que uma conta é fictícia: há uma conta nesse
formato sem a evidência adicional dos geradores conhecidos. Não a rotulamos.

### Como distinguir sem depender da aparência

Nesta base, cruzamos convenção de endereço de fixture, código gerador e assinatura
dos recibos. A evidência é forte nos dois casos de 1005 dias, mas **não existe
atualmente um registro imutável de proveniência/run_id para cada conta**. Padrões
de endereço/metadados também não provam, isoladamente, qual execução criou a conta.

Para futura identificação inequívoca, a proposta é registrar UUID interno, ambiente,
run_id e gerador num inventário privado controlado pelo operador de testes e
vinculado à criação da fixture. Não confiar em flag alterável pelo usuário ou
username; não fazer backfill automático por aparência. Contas não classificadas
exigem verificação controlada. Não implementamos esse inventário, filtro, exclusão
ou nova regra de participação nesta revisão. Separação de ambientes continua
obrigatória; nunca importar dados reais/produção para testar.

## Autorização e revisão do ranking

Confirmado no backend: **um OWNER**, conta ativa/confirmada e editorial, diário
de concessão existente e último evento coerente com o vínculo atual. A tabela
continua privada; anon sem EXECUTE. A função instalada coincide com a candidata
00400, com SECURITY DEFINER, search_path vazio e verificação do vínculo privado.
Nenhuma operação de provisionamento foi executada nesta rodada.

No SQL somente de leitura, usamos claims locais do OWNER já configurado e role
authenticated para exercitar a RPC; não criamos JWT nem inspecionamos tokens ou
sessões. A RPC autorizou o vínculo e retornou os mesmos 192/15, página de 25 e
projeção mínima. Isso confirma a autorização **do OWNER configurado**, sem escolher
ou promover conta. Não equivale a login HTTP ou prova da sessão no navegador.

A integração de navegador informou que não há navegador conectado, confirmada
pela descoberta vazia. Não inspecionamos armazenamento, perfil, cookies ou
credenciais nem tentamos controlar a sessão por outro mecanismo. O responsável
relatou painel aberto; a confirmação independente da sessão atual permanece
manual: clicar Atualizar ranking e confirmar HTTP 200 na RPC local, sem compartilhar
headers, tokens, contatos ou UUID. A pergunta foi enviada ao responsável.

Com snapshot consistente, a auditoria confirmou:

- Ordenação decrescente por ofensiva, depois username crescente/nulos ao final.
- Empates visíveis coerentes e primeira página idêntica ao repetir a chamada.
  O desempate final por UUID interno é confirmado no corpo da função; não é
  exposto na resposta nem pode ser distinguido por usernames nulos na interface.
- Paginação cobre os 192 registros; padrão 25, limite 100. O diagnóstico percorre
  no máximo 100 páginas de 100 e sinaliza incompletude acima desse limite.
- Busca normalizada do prefixo com caixa alta/espaços retorna uma correspondência.
  A interface continua removendo @ antes da chamada. Totais globais não dependem
  da busca. Não há filtro que esconda fixtures nesta entrega.
- Recorde >= ofensiva atual e dias com conclusão >= recorde; estado sem conclusões
  tem todos os contadores zero. Classificações de hoje/ontem/interrompida também
  são cobertas nos testes SQL isolados e React.
- Resposta mínima sem e-mail, telefone, ID, textos, segundos ou histórico detalhado.

Paginação por offset não congela dados entre requisições normais; novas conclusões
podem mudar posições. Repetibilidade observada aqui usa snapshot de auditoria,
não promessa de snapshot compartilhado no frontend.

## Ajuste visual limitado

Somente `CommunityPanel.tsx` e estilos `.community` em `App.css`: seção em cartão
branco com borda lilás, resumo em duas colunas (uma no celular), busca agrupada,
tabela delimitada com cabeçalho e situação destacados, paginação com quebra.
Username completo preservado, rolagem horizontal contida, foco visível e controles
por teclado mantidos. Não se alteraram payload, filtros, fórmula, textos editoriais,
protocolo de 60 segundos, autorização ou design das demais telas.

Não houve revisão visual do resultado no navegador nesta sessão, porque o conector
não estava disponível. Os testes React verificam os fluxos existentes. Antes do
commit, validar manualmente em desktop/390px: cartões, busca Enter, paginação,
rolagem/foco, nome integral e ausência de contatos. Usar somente dados fictícios
em capturas; não registrar a conta não classificada nem seus dados pessoais.

## Arquivos e execução

Novos: este documento; `scripts/audit-local-community.mjs`,
`scripts/audit-local-community.sql`, `scripts/local-community-readonly-http.mjs`.
Modificados nesta rodada: `src/components/CommunityPanel.tsx`, `src/App.css`,
`src/test/localOwnerEntrypoints.test.ts`, `docs/testing.md`,
`docs/development-workflow.md`. Nenhuma migração criada ou anterior alterada.

```bat
cd /d "C:\Users\leand\Documents\devocionais-app"
node scripts/audit-local-community.mjs
node scripts/local-community-readonly-http.mjs
node scripts/verify-local-reading-install.mjs
npm.cmd run test:run
npm.cmd run build
npm.cmd run lint
git diff --check
```

Não executar na stack atual suítes que exigem OWNER vazio nem remover o OWNER
para testá-las. O verificador novo isolado executa as 288 SQL/RLS, incluindo OWNER,
com fixtures revertidas, sem copiar contas ou tocar dados da stack existente.
HTTP nesta revisão cobre negações anônimas/token inválido; não reutiliza uma sessão
privada para simular teste positivo. Resultados exatos estão em `testing.md`.

Pendências: confirmação manual da sessão aberta, layout desktop/celular e revisão
dos candidatos antes de eventual commit autorizado. Não há limpeza autorizada,
mudança da classificação de contas, publicação ou início da Etapa 22.3.
# Prompt 42 — consolidação final

Branch `feat/local-auth`, base `31cb42d`. Trabalho anterior preservado. Nenhum
staging/commit, acesso hospedado, migração aplicada na stack existente, promoção,
revogação ou alteração de dados de usuários nesta rodada.

Validação manual comunicada pelo responsável, anterior às correções: (1) cartões
organizados; (2) ranking carrega; (3) busca por username; (4) paginação; (5) ofensiva
e recorde; (6) conta comum bloqueada no ranking OWNER; (7) layout pequeno/celular.
São sete aprovações humanas, não sete testes automatizados desta execução.
Falhas relatadas: navegação mensal pessoal e retorno ao painel principal após
Alt+Tab. Ambas motivaram regressões novas.

Causas e correções:

- Calendário: destino calculado por `data.month`, ainda antigo durante requisição.
  Dois movimentos pediam o mesmo mês. Teste com resposta pendente falhou antes;
  Chromium também reproduziu agrupamento de cliques no mesmo render. Agora o
  destino usa seleção e atualização funcional com limites. Respostas fora de
  ordem são ignoradas; foco/visibilidade atualizam o mês escolhido.
- Administração: `AuthContext` invalida a autorização em eventos de sessão e
  `App.tsx` desmonta `AdminPanel` durante a consulta. O booleano local da comunidade
  era reiniciado. Agora `#admin/comunidade` mantém a seção após revalidação e
  refresh. Autorização editorial e RPC OWNER continuam obrigatórias; nada foi
  relaxado no AuthContext, no banco ou nas permissões.

O calendário volta ao mês atual do servidor em recarga completa, conforme seu
estado transitório. Durante foco/visibilidade permanece no escolhido. Limites:
primeiro mês com conclusão até atual; sem histórico, apenas atual. Estado vazio,
erros, teclado e corridas têm cobertura automatizada. Busca/página da comunidade
podem reiniciar após revalidação; a seção permanece aberta.

Execuções e resultados estão também no início de [testing.md](testing.md).
Chromium usa `scripts/local-navigation-browser.mjs`, perfil novo ignorado pelo Git,
interceptação do módulo Supabase com respostas fictícias e bloqueio de destinos
fora de `127.0.0.1:5173`. Exercita UI real com troca de abas como simulação de
perda/retorno de foco e eventos SIGNED_IN/TOKEN_REFRESHED. Não é login HTTP OWNER
nem Alt+Tab nativo do Windows. A primeira execução encontrou o agrupamento de
cliques; a execução final passou após atualização funcional. O mock da comunidade
foi ajustado ao contrato `abortSignal` e exige resumo autorizado antes da revogação.

Pendência histórica do Prompt 42 (encerrada pelas quatro aprovações do Prompt 43):
repetir as duas falhas na sessão local do responsável, usando
Alt+Tab nativo, cliques rápidos/teclado e refresh. Não há acesso automatizado à
sessão pessoal. Os sete itens anteriores não foram revalidados manualmente pelo
agente. O calendário não preserva seleção em reload; a seção administrativa sim.

Auditoria dos 58 candidatos: varredura integral de texto, sem correspondências
para JWTs completos, chaves privadas, tokens GitHub ou chaves Supabase longas.
Nenhum arquivo de ambiente, cache, build, log ou credencial entre os candidatos;
`git check-ignore` confirmou cache do navegador, `dist` e `.env.development.local`
ignorados. Arquivos de credenciais não foram lidos. Essa varredura por assinaturas
não prova ausência universal de segredos/dados reais; os sete registros locais
sem proveniência continuam sem classificação e não foram exportados.

Revisão por grupo: migrações incrementais 00300/00400/00500 preservadas; RLS,
`security definer` com search_path vazio, projeção mínima e autorização OWNER
verificados por SQL. CLI OWNER valida UUID/confirmadores/referência, destino local,
elegibilidade e estado sob locks; mutação/auditoria na mesma transação. Não foi
executada concessão ou revogação. Scripts que exigem OWNER vazio não foram
executados contra a stack atual. O Chromium antigo de leitura permanece candidato
histórico, mas cria fixtures e tenta concessão sintética; não serve para repetir
esta revisão com OWNER já provisionado. Usar o novo script de navegação.
Testes e fixtures usam identidades fictícias; documentação distingue implementado,
testado, histórico e pendências. UI mantém mudanças previamente autorizadas.

Auditoria READ ONLY/REPEATABLE READ/ROLLBACK repetida: 192 contas, 15 com conclusão
hoje, OWNER único ativo/confirmado/editorial e auditado; RPC igual à candidata,
projeção mínima, ordenação, busca e paginação coerentes. Sem identificadores ou
contatos emitidos. Integrações HTTP desta rodada são oito negativas sem login.
As 288 SQL/RLS foram executadas em PostgreSQL temporário sem rede/volumes
compartilhados, com rollback nas suítes; somente DDL Auth copiado, nenhum usuário.
O contêiner temporário foi encerrado. Não repetimos provisionamento mutável
na stack existente nem as integrações que criam históricos sintéticos extensos.

Mensagem sugerida: `feat(consistency): consolida etapa 22.2 e corrige navegação local`.
Bloqueio humano registrado no Prompt 42: encerrado pelas aprovações do Prompt 43.
STAGING/PROD continuam bloqueados; build DEV mantém aviso de chunk acima de 500 kB.


## Versionamento CMD — Prompt 43

Total exato: **58 arquivos (17 modificados e 41 novos)**. A lista abaixo é também
o inventário completo dos candidatos; cada argumento é um arquivo explícito.
Executar somente se o responsável decidir preparar o staging. Nada foi executado
pelo agente. CMD aceita a continuação com `^`; não adicionar espaços após `^`.

### Documentação — 6 arquivos

```cmd
git add -- ^
  "docs\consistency-local.md" ^
  "docs\development-workflow.md" ^
  "docs\owner-community-review.md" ^
  "docs\owner-local-provisioning.md" ^
  "docs\privacy-essential.md" ^
  "docs\testing.md"
```

### Scripts locais, declarações e SQL auxiliar — 20 arquivos

```cmd
git add -- ^
  "scripts\apply-local-consistency-migration.d.mts" ^
  "scripts\apply-local-consistency-migration.mjs" ^
  "scripts\apply-local-owner-audit-migration.mjs" ^
  "scripts\apply-local-owner-migration.mjs" ^
  "scripts\audit-local-community.mjs" ^
  "scripts\audit-local-community.sql" ^
  "scripts\consistency-local-fixtures.mjs" ^
  "scripts\local-community-readonly-http.mjs" ^
  "scripts\local-consistency-smoke.mjs" ^
  "scripts\local-navigation-browser.mjs" ^
  "scripts\local-owner-provision-smoke.mjs" ^
  "scripts\local-owner-smoke.mjs" ^
  "scripts\local-owner-tools.d.mts" ^
  "scripts\local-owner-tools.mjs" ^
  "scripts\local-reading-browser.mjs" ^
  "scripts\provision-local-owner.mjs" ^
  "scripts\run-local-consistency-sql.mjs" ^
  "scripts\run-local-owner-audit-sql.mjs" ^
  "scripts\run-local-owner-sql.mjs" ^
  "scripts\verify-local-reading-install.mjs"
```

### Código e testes — 25 arquivos

```cmd
git add -- ^
  "src\App.css" ^
  "src\App.tsx" ^
  "src\components\AccountPrivacy.tsx" ^
  "src\components\AdminPanel.test.tsx" ^
  "src\components\AdminPanel.tsx" ^
  "src\components\AuthForm.tsx" ^
  "src\components\CommunityPanel.test.tsx" ^
  "src\components\CommunityPanel.tsx" ^
  "src\components\ConsistencySection.test.tsx" ^
  "src\components\ConsistencySection.tsx" ^
  "src\components\PrivacyPolicy.test.tsx" ^
  "src\components\PrivacyPolicy.tsx" ^
  "src\components\ReaderLibrary.tsx" ^
  "src\components\UI.tsx" ^
  "src\consistency\calendar.test.ts" ^
  "src\consistency\calendar.ts" ^
  "src\consistency\community.ts" ^
  "src\consistency\repository.test.ts" ^
  "src\consistency\repository.ts" ^
  "src\test\consistencyBoundary.ts" ^
  "src\test\localEnvironment.test.ts" ^
  "src\test\localOwnerEntrypoints.test.ts" ^
  "src\test\localOwnerTools.test.ts" ^
  "src\test\localReadingEntrypoints.test.ts" ^
  "src\test\setup.ts"
```

### Migrações incrementais e testes SQL — 6 arquivos

```cmd
git add -- ^
  "supabase\migrations\20261028000300_reader_consistency.sql" ^
  "supabase\migrations\20261028000400_owner_community.sql" ^
  "supabase\migrations\20261028000500_owner_provision_audit.sql" ^
  "supabase\tests\owner-community.sql" ^
  "supabase\tests\owner-provision-audit.sql" ^
  "supabase\tests\reader-consistency.sql"
```

### Configuração de testes — 1 arquivo

```cmd
git add -- ^
  "vitest.config.ts"
```

Depois do staging opcional, conferir `git diff --cached --stat` e
`git diff --cached --check`. Mensagem recomendada:
`feat(consistency): consolida etapa 22.2 e corrige navegação local`.
Nenhum staging ou commit foi executado pelo agente.
