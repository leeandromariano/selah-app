# Inventário e execução de testes

## Encerramento da Etapa 21.5 — Prompt 34

Branch `feat/local-auth`, commit-base `1bc58bd`. O responsável informou nesta
sessão **13/13 cenários manuais aprovados**, separados de testes unitários,
HTTP, SQL/RLS e automação Chrome:

1. Login usando apenas username.
2. Login usando @username.
3. Login usando username com maiúsculas.
4. Login por e-mail e senha.
5. Username inexistente recebe erro genérico.
6. Senha incorreta não revela dados da conta.
7. Conta não confirmada não autentica.
8. Sessão persiste após atualizar a página.
9. Logout exige nova autenticação.
10. Acervo, histórico e painel administrativo continuam funcionando.
11. Recuperação de senha por e-mail funciona.
12. Conta antiga sem username autentica por e-mail.
13. Perfil conserva WhatsApp e preferências de feedback.

Não se presume aprovação manual de testes de carga, limites, móvel, teclado,
infraestrutura ou de qualquer outro cenário não especificado pelo responsável.
As execuções do Prompt 33 abaixo são históricas. A revisão final de 27/10/2026
reexecutou os seguintes comandos/cenários, sem presumir cobertura adicional:

| Comando / categoria | Resultado final do Prompt 34 |
| --- | --- |
| `npm.cmd run test:run` | **248 testes aprovados em 24 arquivos**, nenhum omitido |
| `npm.cmd run build` / `npm.cmd run lint` | Ambos aprovados com código zero |
| `node scripts/local-login-smoke.mjs` | **41 HTTP aprovadas** no runtime atualizado |
| `node scripts/local-auth-smoke.mjs` | **19 HTTP aprovadas** |
| `node scripts/local-username-smoke.mjs` | **31 HTTP aprovadas** |
| `node scripts/local-whatsapp-smoke.mjs` | **40 HTTP aprovadas** |
| `node scripts/local-login-browser.mjs` | **12 Chrome automatizadas aprovadas**, incluindo recarga com latência local de 300 ms |
| SQL/RLS no banco local atual | **137 aprovadas**: 59 autorização + 16 privacidade + 18 usernames + 25 WhatsApp + 19 login, todas com rollback |
| SQL em PostgreSQL novo isolado | Sete migrações aplicadas em ordem e **137 assertions adicionais**, todas as suítes com rollback |
| Concorrência global no banco isolado | **64 chamadas**, até 16 em paralelo: 60 admitidas e quatro recusadas |
| `npm.cmd run build:staging` / `build:prod` | Ambos recusados pela configuração de ambientes (código 1 esperado) |
| `git diff --check` | Aprovado |

As 131 HTTP foram repetidas depois da correção pontual de erros Auth. Por
identificador, a integração verificou onze chamadas simultâneas normalizadas com
dez 401 e um 429. A função SQL instalada corresponde ao corpo da migração, com
owner postgres, SECURITY DEFINER e search_path vazio. RLS/grants permaneceram
restritos. As suítes HTTP completas de perfis/acervo/admin/privacidade não foram
repetidas; seus resultados anteriores não entram nesses 131. Os dois conjuntos
de 137 SQL pertencem a bancos distintos; não se misturam às verificações HTTP.

Correção de regressão: o SDK instalado produz status `0` em erros de transporte.
O código anterior convertia isso em 401. O teste dirigido reproduziu três falhas
(status 0, ausente e resposta sem sessão). A correção retorna indisponibilidade
503, conserva erro genérico 401 para credenciais inválidas e acrescenta oito
cenários à suíte anterior de 240. Os 33 casos do arquivo e a suíte completa
passaram depois da correção. Falhas de transporte/respostas inesperadas foram
simuladas na fronteira; não se derrubou o serviço Auth nem se atribui aceite manual
a esses casos. Senhas continuam verificadas exclusivamente pelo Auth oficial.

A automação Chrome parou duas vezes após cinco verificações durante recarga.
O diagnóstico da reprodução mostrou sessão autenticada e painel de username
recolhido. O teste agora espera um documento novo e garante a expansão do painel,
incluindo uma verificação de regressão e latência controlada; a rodada final
aprovou 12/12. Não se enfraqueceram as assertions de sessão/perfil/logout. As
tentativas parciais e repetições não são contadas como novas aprovações completas.

Instalação isolada: imagem PostgreSQL local, sem rede/portas/volumes existentes,
com dados temporários em RAM. Somente DDL Auth foi lido, retirando da cópia os três
triggers do aplicativo que as migrações recriam. Nenhum dado de usuário ou segredo
foi copiado. Perfil legado fictício permaneceu inalterado pela migração de login.
Não é uma segunda stack Supabase completa; os HTTP foram feitos na stack local
existente. Preparações interrompidas antes das assertions não entram nos totais.
Contêineres temporários foram parados. Detalhes e limites em
[username-login-local.md](username-login-local.md).

## Etapa 21.5 — username ou e-mail, execução local em 26/10/2026

Base `1bc58bd`, branch `feat/local-auth`. Resultados **reexecutados nesta etapa**:

| Comando / categoria | Resultado |
| --- | --- |
| `npm.cmd run test:run` | **240 testes aprovados em 24 arquivos**, zero falhas/omitidos |
| `npm.cmd run build` | Aprovado, build DEV; não publica |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/local-login-smoke.mjs` | **41 verificações HTTP aprovadas** |
| `node scripts/local-auth-smoke.mjs` | **19 verificações HTTP aprovadas** |
| `node scripts/local-username-smoke.mjs` | **31 verificações HTTP aprovadas**; inclui gateway novo |
| `node scripts/local-whatsapp-smoke.mjs` | **40 verificações HTTP aprovadas** |
| `node scripts/local-login-browser.mjs` | **11 verificações em Chrome real isolado aprovadas** |
| `node scripts/run-local-authorization.mjs` | **59 SQL/RLS aprovadas**, rollback |
| `node scripts/local-privacy-smoke.mjs --sql` | **16 SQL aprovadas**, rollback |
| `node scripts/local-username-smoke.mjs --sql` | **18 SQL aprovadas**, rollback |
| `node scripts/local-whatsapp-smoke.mjs --sql` | **25 SQL aprovadas**, rollback |
| `node scripts/local-login-smoke.mjs --sql` | **19 SQL novas aprovadas**, rollback |
| `npm.cmd run build:staging` / `build:prod` | Ambos recusados com código 1, como esperado; continuam bloqueados |
| `node scripts/apply-local-login-migration.mjs` | Migração já aplicada confirmada; caminho sem novas escritas aprovado |

São **131 verificações HTTP**, **137 SQL** e **11 de navegador** nesta rodada
completa. Não somar tentativas interrompidas ou repetições para inflar esses totais.
As suítes HTTP de perfis/acervo/admin/privacidade não foram repetidas integralmente;
seus números em seções anteriores continuam históricos. A suíte de login nova
testou diretamente isolamento de perfil/telefone/consentimento, admin e revogação.

Os testes novos simulam SDK/HTTP/SQL na fronteira: normalização, instalação da
sessão oficial, respostas inválidas, erro genérico, limites persistentes e falha
fechada. Testam origem local, tamanho do corpo e ausência de dados/logs sensíveis.
Scripts novos recusam Docker remoto, URLs remotas e contextos maliciosos antes
de operar, inclusive modos `--check-local`, execução normal e SQL quando aplicável.
O aplicador de migração também tem testes sem serviços para histórico inesperado,
migração futura pendente, caminho já aplicado e chamada CLI fixada em `--local`.
Nenhum SQL ou serviço real é executado por Vitest/build/lint.

Navegador: o conector falhou antes de abrir páginas. O fallback usa Chrome já
instalado, headless, perfil novo no cache ignorado de `node_modules`, sem leitura
de cookies/storage pessoal. Passou login por @username/maiúsculas e por e-mail,
perfil/username, recarga autenticada, logout, recarga desconectada e erro genérico.
Não é aprovação manual do responsável nem revisão visual/responsiva completa.

As primeiras execuções HTTP/navegador pararam em expectativas do teste (OPTIONS
atendido pelo Kong e painel de username recolhido); foram corrigidas e repetidas
integralmente. O build intermediário detectou declaração ausente do script novo;
foi acrescentada sem ignorar o erro, e o build final passou. Não se removeram
cenários para obter aprovação. Os tempos HTTP observados não provam tempo constante.

Sem acesso hospedado, link/push/reset/publicação, staging ou commit. Migração nova
`20261027000100` aplicada somente localmente, sem reescrever as anteriores.
Sessão oficial contém e-mail do próprio titular após senha válida; não há lookup
público de e-mail. JWT emitido pode durar até expirar após logout, embora refresh
tenha sido revogado no teste real. Operação, limites e roteiro manual completo em
[username-login-local.md](username-login-local.md).

## Comandos

Após `npm ci`:

```sh
npm test
npm run test:run
npm run build
npm run lint
```

`npm test` abre Vitest em observação; `npm run test:run` executa uma vez e termina com código de falha se um teste falhar. Em PowerShell com restrições a scripts, usar `npm.cmd`. Build e lint não substituem testes.

`vitest.config.ts` usa jsdom e React Testing Library, sem carregar `.env` (`envDir: false`). `src/test/setup.ts` limpa a árvore React e a URL entre testes, simula rolagem e substitui `fetch` por uma função que lança erro. Isso detecta chamadas fetch inesperadas; não é um firewall para outros transportes. Testes não devem importar clientes reais ou usar credenciais. Integrações futuras devem ser simuladas na fronteira.

## Cobertura inicial

| Arquivo | Comportamentos exercitados |
| --- | --- |
| `src/components/UI.test.tsx` | Teste unitário do card isolado: ativação por teclado chama o callback com o devocional correspondente, somente após interação |
| `src/components/AuthForm.test.tsx` | Entrada inválida, mensagens e foco no primeiro erro; cadastro via fronteira Auth simulada sem Instagram, limpeza de campos, ausência de fetch real e remoção da mensagem ao editar; cadastro incompleto e senhas divergentes |
| `src/App.test.tsx` | Busca por referência sem diferenciar maiúsculas, resultado vazio e recuperação; registro de abertura e histórico restaurado ao remontar; edição administrativa e restauração da resposta persistida ao remontar |

A base inicial tinha sete testes de comportamento local, incluindo um teste unitário de componente e integração entre App, componentes e estado React. Não há extração artificial de regras para duplicar a implementação em testes. Novos casos unitários podem ser adicionados quando surgirem módulos de domínio independentes.

O arquivo preexistente `supabase/tests/authorization.sql` é uma suíte SQL separada. Não faz parte do Vitest e não deve ser executado contra banco remoto nesta etapa. Sua existência não comprova que permissões ou migrações foram validadas.

## Testes ainda necessários

A revisão prévia de 26/10/2026 ampliou a suíte SQL com criação indevida de objetos
no schema público, autoria forjada, alterações de autoria/timestamps, leitura direta
da lista administrativa e revogação de administrador sem troca de claims. O arquivo
ativa `ON_ERROR_STOP` e deve ser executado integralmente com psql em banco local
descartável; não usa pgTAP e não é executado por `supabase test db`. Esses novos
casos passaram na execução integral local de 26/10/2026 (59 verificações, zero falhas). Ver `database.md` para configuração e limitações.

- Limites de idade (1/120 e fora do intervalo), celular inválido, Instagram inválido e senha com menos de oito caracteres no cadastro.
- Inclusão, edição e cancelamento no painel; campos obrigatórios no navegador real.
- Navegação por links, voltar/avançar, rota desconhecida e seleção do devocional correto.
- Independência da marcação entre devocionais e comportamento após editar/remover o item selecionado.
- Acessibilidade por teclado, foco, responsividade e inspeção visual em navegador real.
- E2E com Playwright conforme `development-workflow.md`; começar pequeno, sem instalação nesta etapa.
- Quando houver backend real: erros de rede, sessão, autorização administrativa, persistência, isolamento entre usuários e RLS em banco local descartável com dados sintéticos.
- Para cada bug futuro: teste específico que reproduza o problema antes da correção.

Não há cobertura percentual mínima estabelecida. Priorizar riscos e comportamentos em vez de perseguir números ou testar constantes. A autenticação agora usa Supabase Auth local; testes React simulam a integração e não comprovam HTTP. O painel exige sessão e autorização no banco, mas ainda edita apenas o acervo em memória. Remontar App verifica o descarte de estado React, mas não substitui recarregar uma página em E2E.

Resultados de execução devem acompanhar o relatório da tarefa; não presumir aprovação porque existe um teste no repositório.

## Execução SQL local em 26/10/2026

Suíte authorization.sql revisada e executada integralmente com psql do contêiner
supabase_db_devocionais-app, PostgreSQL 17.11, correspondente à porta local
127.0.0.1:54322. Migração 20261023000100 confirmada no histórico.
Resultado: 59 assertions aprovadas, zero falhas, nenhuma omitida; término com
ROLLBACK e mensagem de sucesso. Foram usados papéis anon/authenticated e fixtures
sintéticas. Nenhum comando remoto, reset ou alteração na migração foi necessário.
A conexão psql foi feita pelo socket interno do contêiner identificado pelo
mapeamento de porta, sem credenciais na linha de comando. Valida RLS e privilégios
no banco para os cenários cobertos; não valida JWT real, Auth HTTP ou PostgREST.

Verificações complementares da mesma sessão: npm.cmd run test:run (7 testes
aprovados), npm.cmd run build e npm.cmd run lint concluídos com código zero.
Consulta após o rollback confirmou ausência das fixtures de Auth e dos
devocionais fictícios criados pela suíte.

## Etapa 16 — Auth local

A suíte mantém os sete cenários originais, adaptando o contrato do cadastro para
Auth e exigindo administrador simulado no teste de edição do painel. As demais
interações do acervo continuam em memória. Novos testes cobrem login, erros,
restauração de sessão, listeners, resposta atrasada após logout, autorização
negada inclusive por metadado admin forjado, recuperação e alteração de senha.
`src/lib/localAuthConfig.test.ts` verifica recusa de URL remota e chaves privilegiadas
sem importar o cliente real. O módulo Supabase é simulado globalmente na fronteira.

`scripts/local-auth-smoke.mjs` é opt-in e separado de Vitest/build/lint. Foi
executado nesta etapa com 19 verificações HTTP aprovadas, incluindo recebimento
no Mailpit, confirmação e recuperação de senha. Usa uma identidade adulta fictícia
por execução, que permanece somente no banco local; não apaga dados. Nunca imprime
chaves, senhas, conteúdo de e-mail ou tokens. Não testa DOM ou armazenamento do navegador.
A execução SQL de 59 verificações registrada acima pertence à etapa anterior;
as políticas e a suíte SQL não foram modificadas nem reexecutadas na Etapa 16.

Validação final da Etapa 16 (26/10/2026): `npm.cmd run test:run` aprovou 22 testes
em cinco arquivos; `npm.cmd run build` e `npm.cmd run lint` terminaram com código
zero, sem avisos. As primeiras execuções identificaram duas falhas nos testes
(referência ao DOM desmontado após troca de identidade e preenchimento repetido
do e-mail); elas foram corrigidas sem remover cenários. O conector de navegador
não disponibilizou navegador ao agente, portanto não houve validação visual/E2E
pelo agente durante a implementação. A validação manual posterior está registrada abaixo.

## Validação manual da Etapa 16 — informada pelo responsável

Em 26/10/2026, o responsável confirmou nesta sessão **sete testes manuais aprovados**
na interface local: abertura, cadastro, confirmação por Mailpit, retorno do link,
login, persistência da sessão após recarga e logout. Esses resultados foram
relatados pelo responsável; não são testes automatizados executados pelo agente.
O detalhamento está em `auth-local.md`.

Recuperação e atualização de senha não foram incluídas nesse relato manual.
As 19 verificações HTTP e as 59 verificações SQL são registros de execuções
anteriores, sem nova execução durante a preparação do commit.

Na preparação do commit em `feat/local-auth`, foram executados novamente:
`npm.cmd run test:run` (22 testes aprovados em cinco arquivos),
`npm.cmd run build` e `npm.cmd run lint` (ambos com código zero, sem avisos).
Esta preparação alterou somente a documentação; migrações, políticas RLS
e funcionalidades foram preservadas.

## Etapa 18.1 — perfis persistentes locais

Schema real, constraints, trigger e RLS inspecionados por leitura de metadados
no PostgreSQL local. Nenhuma migração ou política foi alterada.

`src/components/ProfileForm.test.tsx` acrescenta nove testes de leitura do próprio
perfil, criação explícita com rascunho permitido, edição, remontagem, campos
opcionais, carregamento/erros, nova tentativa, acesso negado, submissão pendente
e resposta atrasada após logout. `src/profiles/profile.test.ts` acrescenta três
testes de normalização, limites de dados, campos protegidos e zero linhas em update.
São mocks na fronteira Supabase; não comprovam persistência por si só.
O teste de cadastro passou a exigir o rascunho permitido, sem papel administrativo,
conforme o novo contrato de signUp; os cenários anteriores foram mantidos.

Execução: `npm.cmd run test:run` aprovou **34 testes em sete arquivos**;
`npm.cmd run build` e `npm.cmd run lint` terminaram com código zero, sem avisos.
`node scripts/local-profile-smoke.mjs` aprovou **29 verificações HTTP locais**,
incluindo criação, edição, timestamps do servidor, leitura por cliente novo,
logout/novo login, tentativa de leitura/edição do perfil alheio e campos protegidos.
Usa duas contas fictícias confirmadas pelo Mailpit; não usa chaves privilegiadas
nas operações nem apaga dados. Nenhuma verificação dessa execução foi omitida.

As 59 verificações SQL/RLS, 19 HTTP de Auth e sete testes manuais de Auth permanecem
registros das etapas anteriores; não foram reexecutados nesta etapa. A nova tela
de perfil recebeu posteriormente a validação manual registrada abaixo.

## Conclusão da Etapa 18.1 — validação manual informada pelo responsável

Na preparação do commit da branch `feat/local-auth`, referência `171bf26`, o
responsável confirmou nesta sessão **oito testes manuais aprovados**:

1. Acesso à página Meu perfil.
2. Carregamento correto dos dados do cadastro.
3. Salvamento com confirmação.
4. Edição de informações pessoais.
5. Persistência após recarregar a página.
6. Persistência após logout e novo login.
7. Isolamento visual entre contas.
8. Salvamento com campos opcionais vazios.

Esses resultados foram relatados pelo responsável no navegador local; não são
execuções automatizadas do agente. O detalhamento e as limitações estão em
`profiles-local.md`. Os 29 testes HTTP de perfis e as 59 verificações SQL/RLS
permanecem resultados anteriores, sem nova execução nesta preparação do commit.
Nenhuma migração, política RLS ou funcionalidade foi alterada nesta preparação.

Verificações executadas novamente nesta preparação: `npm.cmd run test:run`
aprovou 34 testes em sete arquivos; `npm.cmd run build` e `npm.cmd run lint`
terminaram com código zero, sem avisos. Esses resultados são independentes
dos oito testes manuais relatados acima.

## Etapa 18.2 — publicações e histórico de aberturas

Schema, constraints, trigger e RLS de devotionals/devotional_views conferidos no
PostgreSQL local em execução. Não há campo/tabela de conclusão; a interface agora
explica aberturas, sem fabricar conclusão. Não houve mudança em supabase/.

Os dois testes de App relacionados ao acervo foram adaptados legitimamente ao novo
contrato: busca em publicações persistentes sem filtro de tema inexistente no schema,
e abertura persistente sem marcação volátil de conclusão. O teste do painel mantém
o contrato demonstrativo isolado. Nenhum teste foi removido ou pulado.

`src/devotionals/repository.test.ts` verifica fronteira de dia em São Paulo, seleção
sem fallback de dia antigo, prévia/tempo derivados, projeção, filtros, ordenação,
paginação além de 100 registros e payload de abertura restrito. Os testes em
`src/components/ReaderLibrary.test.tsx` cobrem destaque, ausência de publicação
hoje, acervo/histórico vazios, negação/nova tentativa, falha de histórico, abertura
negada, recarga por UUID sem duplicar evento, conteúdo indisponível e respostas
atrasadas após logout. A fronteira Supabase é simulada; não usa credenciais/rede.

`node scripts/local-library-smoke.mjs` executou **35 verificações HTTP locais**,
todas aprovadas, incluindo persistência e tentativas diretas de acesso negado.
Preparou duas contas e cinco publicações fictícias locais, sem exclusões ou
mudança de schema. Ver `devotionals-local.md` para escopo e limitações.
As 59 verificações SQL/RLS e 29 HTTP de perfis são resultados anteriores, não
reexecutados aqui. A nova experiência de leitura recebeu posteriormente a
validação manual informada pelo responsável, registrada abaixo.

Validação final da Etapa 18.2: `npm.cmd run test:run` aprovou **49 testes em nove
arquivos**; `npm.cmd run build` e `npm.cmd run lint` terminaram com código zero.
Lint não emitiu avisos. Vitest apresentou apenas uma sugestão informativa de
otimização do ambiente jsdom; nenhum teste falhou ou foi omitido na execução final.

## Conclusão da Etapa 18.2 — validação manual informada pelo responsável

Na preparação do commit da branch `feat/local-auth`, referência `6e2c793`, o
responsável confirmou nesta sessão **dez testes manuais aprovados**:

1. O acervo carrega publicações do banco.
2. O destaque apresenta o devocional do dia ou mensagem apropriada quando não existe.
3. A busca encontra devocionais anteriores.
4. Os devocionais abrem e exibem o conteúdo.
5. A página do devocional permanece correta após recarga.
6. Minhas aberturas registra os acessos.
7. O histórico persiste após recarga, logout e novo login.
8. O histórico é isolado entre usuários.
9. A interface funciona em telas móveis.
10. Falhas de conexão apresentam erro sem inventar conteúdo.

Esses resultados foram relatados pelo responsável na interface local; não são
testes automatizados executados pelo agente. Ver `devotionals-local.md` para
limitações e roteiro de repetição. As 35 verificações HTTP de acervo, 29 de perfis
e 59 verificações SQL/RLS permanecem resultados anteriores, sem nova execução
nesta preparação. Nenhuma migração, política RLS ou funcionalidade foi alterada
durante a preparação do commit.

Nesta preparação da Etapa 18.2 foram executados novamente:
`npm.cmd run test:run` (49 testes aprovados em nove arquivos),
`npm.cmd run build` e `npm.cmd run lint` (código zero; lint sem avisos).
Vitest apresentou somente sugestão informativa de otimização do jsdom.

## Etapa 19 — administração editorial local

Árvore limpa confirmada antes da implementação; HEAD c564d28 e script de integração
do acervo confirmados como versionados. Schema real, constraints, trigger, funções,
grants e RLS inspecionados no PostgreSQL local. Nenhuma migração foi necessária.

O teste de App que removia demonstrações foi adaptado ao novo contrato editorial:
edição via fronteira API simulada, seguida de restauração ao remontar. Exclusão
definitiva não integra o novo painel; voltar a Rascunho oculta conteúdo sem apagar
dados. Os demais cenários de autenticação, perfil, acervo e histórico foram mantidos.

`src/components/AdminPanel.test.tsx` cobre carregamento da autorização, leitor
negado, todos os status, ausência de métricas pessoais, criação/validação, edição,
agendamento, publicação, falha de conexão/nova tentativa, revogação e gravação
pendente seguida de logout. `src/admin/repository.test.ts` cobre campos/limites,
datas, preservação de segundos, revalidação de autorização, paginação e zero linhas.
As integrações são simuladas na fronteira Supabase, sem serviços ou credenciais.

`node scripts/local-admin-smoke.mjs` executou **41 verificações HTTP locais**,
todas aprovadas. Provisionou temporariamente uma conta administrativa fictícia
por SQL local confiável, sem e-mail fixo, depois de confirmar a conta pelo Mailpit.
Criação, edição, agendamento oculto, publicação explícita, retorno a rascunho,
persistência em cliente novo/novo login, permissões negadas por API direta e
revogação com as mesmas claims foram comprovados. O grant temporário foi revogado;
duas contas e dois textos fictícios permanecem locais. Não houve exclusão de conteúdo.

As 59 verificações SQL/RLS, 35 HTTP de acervo e 29 HTTP de perfis são resultados
anteriores, não reexecutados nesta etapa. O roteiro manual do painel está em
`admin-local.md`; nenhuma operação editorial no navegador foi declarada validada.

Esse registro corresponde à implementação inicial; a validação manual posterior
informada pelo responsável está registrada na conclusão abaixo.

Validação final: `npm.cmd run test:run` aprovou **65 testes em 11 arquivos**,
incluindo os 49 cenários anteriores adaptados ao contrato atual, 11 testes de painel
e cinco de repositório editorial. `npm.cmd run build` e `npm.cmd run lint` terminaram
com código zero; lint sem avisos. Vitest mostrou apenas sugestão de otimização de jsdom.
A execução concorrente com build teve um timeout em teste do acervo ainda em
carregamento; a execução final isolada da suíte completa passou sem mudar limites,
remover ou pular testes. A revisão também corrigiu a mensagem transitória de acesso
negado durante autorização pendente, coberta por teste de regressão.

## Conclusão da Etapa 19 — validação manual informada pelo responsável

Branch feat/local-auth, referência c564d28. O responsável confirmou nesta sessão
**dez testes manuais aprovados** na interface local:

1. Acesso administrativo com conta autorizada.
2. Criação e salvamento de rascunho.
3. Persistência do rascunho após recarga.
4. Edição e salvamento.
5. Agendamento de publicação futura.
6. Ocultação do conteúdo agendado para leitores comuns.
7. Publicação de devocionais.
8. Exibição no acervo quando a data permite.
9. Bloqueio do painel para contas comuns.
10. Mensagens de erro e validação funcionando corretamente.

Esses resultados são manuais e relatados pelo responsável, não execuções
automatizadas do agente. As 41 verificações HTTP administrativas e as 59 SQL/RLS
permanecem resultados anteriores, sem reexecução nesta preparação.

Uma correção de segurança necessária restringiu os scripts administrativos a
sockets Docker locais fixados explicitamente, eliminando herança de contexto
remoto. `src/test/localDocker.test.ts` acrescenta cinco testes de regressão sem
rede, SQL ou subprocessos reais. A concessão/revogação real não foi reexecutada
após essa correção; o registro HTTP anterior permanece identificado como tal.
Não houve alteração de migrações, RLS ou comportamento editorial nesta preparação.

Verificações executadas nesta preparação: `npm.cmd run test:run` aprovou
**70 testes em 12 arquivos** (65 anteriores e cinco de proteção Docker);
`npm.cmd run build` e `npm.cmd run lint` concluíram com código zero, lint sem
avisos. Vitest apresentou apenas sugestão informativa de otimização de jsdom.
HTTP, SQL e scripts de concessão/revogação real não foram executados novamente.

## Etapa 21.1 — destinos dos scripts locais

Validação final desta etapa: `npm.cmd run test:run` aprovou **105 testes em 14
arquivos**; build e lint aprovados, lint sem avisos. Os 65 cenários da aplicação
permanecem; há 40 testes dos scripts (sete Docker, 29 ambiente/transporte/entrypoints,
quatro de filesystem/wrapper SQL). Não houve remoção ou skip.

- `src/test/localDocker.test.ts`: sockets locais, host/context remoto ou conflitante,
  nomes maliciosos, metadados inválidos e fixação do endpoint/ambiente.
- `src/test/localEnvironment.test.ts`: URLs/portas, proxies, PG overrides, status CLI,
  chave pública, psql fixado/falha sem diagnóstico sensível, SDK com transporte
  simulado, POST preservado e redirects manuais. Subprocessos dos sete entrypoints
  são exercitados com configurações recusadas antes de acessar serviços: modos
  normal/preflight e grant/revoke. Não usam banco, credenciais ou serviços externos.
- `src/test/localEntrypoints.test.ts`: criação exclusiva de `.env` com chave pública
  fictícia, preservação sem leitura, recusa antes de escrita e SQL integral enviado
  à fronteira protegida. Filesystem, preflight e psql simulados; nenhum `.env` real lido.

Os testes de scripts podem exercitar o SDK com fetch simulado; os testes da
interface continuam simulando a integração sem importar o cliente Supabase real.
O caso de redirecionamento falhou antes da correção da reconstrução de Request.
Erros intermediários de build (tipos) e avisos de lint foram corrigidos; não são
ocultados pelo resultado final.

Integrações **executadas novamente nesta etapa**, exclusivamente locais:
Auth **19**, perfis **29**, acervo **35**, administração **41** verificações aprovadas;
SQL/RLS **59** aprovadas pelo novo `node scripts/run-local-authorization.mjs`, com
ROLLBACK. Não são apenas reaproveitamento dos resultados históricos anteriores.
Sete entrypoints passaram em `--check-local`; CMD/Docker Desktop confirmado por
preflight no CMD. Configuração normal preservou o arquivo existente; CLI grant/revoke
passou com conta fictícia confirmada e removeu o grant temporário.

Auth e acervo foram repetidos após ajustes das asserções: ficaram 10 contas e 12
devocionais fictícios adicionais no banco local, sem exclusões destrutivas. Não
rodar as integrações para limpar dados ou como parte do Vitest/build/lint. A suíte
SQL não mudou e reverte suas próprias fixtures. Nenhuma migração/RLS/React alterada.

Cada executável local aceita `--check-local` para validar status/portas sem mudar
fixtures ou permissões; não confundir esse modo com teste de saúde HTTP. Corrigir
configurações conflitantes em vez de enfraquecer as guardas. Não usar os scripts em
homologação/produção. Matriz completa e limites em `pre-deploy-audit.md`, seção 12:
criação de novo `.env` e Unix somente simulados; falha real de revoke/interrupção
abrupta e ambiente hostil/túneis locais não foram comprovados.

## Etapa 21.2 — seleção segura de ambiente

`src/lib/environment.test.ts` acrescenta 44 cenários sem rede/credenciais: modos e
declarações divergentes, configuração ausente, namespace DEV/legado e conflitos,
URL DEV exata, chaves públicas/privilegiadas, referências futuras e reutilização
entre STAGING/PROD. Contratos remotos válidos continuam bloqueados em código,
mesmo com flags de habilitação. A fábrica de cliente é simulada: nenhuma chamada
ocorre se configuração/origem for inválida ou o ambiente estiver desabilitado.
Também verifica que somente a configuração DEV selecionada vai ao artefato e que
as opções de sessão existentes são preservadas. Testes da interface continuam
simulando o cliente Supabase na fronteira.

Validação: `npm.cmd run test:run` aprovou **149 testes em 15 arquivos** (105 anteriores
e 44 novos), build DEV e lint aprovados sem avisos. Os comandos `build:staging` e
`build:prod` foram realmente executados e recusados com código 1 por configuração
genérica herdada; são testes negativos esperados, não builds remotos aprovados.
Na implementação, o agente não reexecutou HTTP/SQL ou fluxos manuais. Os 59 SQL/RLS
e 19/29/35/41 HTTP registrados na Etapa 21.1 permanecem evidências anteriores.

Não houve alteração de scripts locais, migrações/RLS ou dados. Limites e roteiro
para navegador em `environments.md`; B01 ainda depende de habilitação futura
autorizada e infraestrutura própria. Produção permanece desabilitada.

## Conclusão da Etapa 21.2 — preparação do commit

Branch `feat/local-auth`, referência `59e2082`. O responsável informou **sete
testes manuais locais aprovados**:

1. O Selah abriu normalmente.
2. O login funcionou.
3. Meu perfil carregou e salvou dados.
4. O preflight `--check-local` foi aprovado.
5. O acervo e o histórico funcionaram.
6. O logout funcionou.
7. As requisições Supabase observadas no Network apontaram somente para `127.0.0.1:54321`.

Validação manual relatada pelo responsável; não equivale a teste automatizado
executado pelo agente. O preflight local consulta metadados/portas, e o Network
comprova apenas as requisições observadas nessas interações. Não há validação de
infraestrutura remota, projetos separados, HTTPS, SMTP, MFA, backups ou implantação.
STAGING/PROD permanecem bloqueados. As 59 verificações SQL e 19/29/35/41 HTTP da
Etapa 21.1 não foram reexecutadas nesta preparação.

Verificações repetidas na preparação do commit: `npm.cmd run test:run` aprovou
**149 testes em 15 arquivos**, sem falhas/omitidos; `npm.cmd run build` e
`npm.cmd run lint` terminaram com código zero, lint sem avisos. Os comandos
`npm.cmd run build:staging` e `npm.cmd run build:prod` foram novamente recusados
com código 1 por variáveis genéricas herdadas de DEV, sem produzir artefato remoto.
Os testes unitários também confirmam o bloqueio em código com contratos futuros
válidos. Não houve mudança funcional durante esta preparação.

## Etapa 21.3 — privacidade essencial

Primeira implementação, depois ajustada abaixo, referência `76a6e94`: cadastro reduzido a e-mail/senha/confirmação, sem rascunho
pessoal em Auth. Nome de exibição opcional/null em perfis; dados legados continuam
editáveis/limpáveis. As expectativas antigas de campos obrigatórios foram adaptadas
ao contrato aprovado, preservando os testes de validação de legados preenchidos.
Migração incremental aplicada somente no banco local; inicial/RLS existentes intactos.

`src/profiles/privacy.test.ts` e `src/components/AccountPrivacy.test.tsx` cobrem
confirmação obrigatória, payload próprio mínimo, duplicidade, negações, erros sem
diagnósticos privados, persistência simulada ao remontar, envio repetido pendente
e desmontagem/troca de conta. Testes de perfil acrescentam nome null, nova UI sem
campos legados e negação de resposta com ID estranho. O novo script tem regressão
de entrypoint com destino remoto/contexto malicioso, sem rede real.

Execuções desta etapa: **162 testes em 17 arquivos aprovados**, sem falhas/skip;
`npm.cmd run build` e `npm.cmd run lint` aprovados, sem avisos de lint. Fronteiras
Supabase simuladas nos testes React, sem importar cliente real ou executar SQL.

Integrações realmente executadas novamente, exclusivamente locais com fixtures:
Auth **19**, perfis **29**, acervo **35**, admin **41**, privacidade **30** verificações
HTTP aprovadas. SQL: **59** existentes e **16** novas aprovadas, ambas com ROLLBACK.
`node scripts/local-privacy-smoke.mjs --sql` executa a nova suíte; `--inventory`
consulta somente metadados em READ ONLY/ROLLBACK; `--check-local` faz preflight.
Sem flags, executa os 30 cenários HTTP. Nenhuma dessas ações integra test/build/lint.

Os testes deixaram nove contas, sete devocionais e um pedido fictícios locais;
grant de teste revogado, sem apagar contas/dados existentes. Registro de pedido
não executa exclusão. Não houve validação nova de navegador, retenção ou atendimento
humano/exclusão real. Ver inventário, impactos e roteiro em `privacy-essential.md`.
`build:staging` e `build:prod` também foram executados: ambos recusados com código
1 por variáveis genéricas DEV herdadas. Nenhum destino remoto foi configurado.

## Ajuste aprovado da Etapa 21.3 — username obrigatório

As decisões atuais substituem o contrato inicial acima: novas contas exigem
username/e-mail/senha; nome pessoal opcional, WhatsApp e Instagram opcionais em
Meu perfil para todos. Login por username é FUTURO. A primeira migração incremental
de privacidade permanece intacta; nova `20261026000200` reserva username por trigger
Auth transacional e UNIQUE, com RLS própria e sem modificar contas legadas.

`src/profiles/username.test.ts`, `src/components/UsernameField.test.tsx` e os testes
de Auth cobrem regras/normalização, payload mínimo, isolamento de resposta, legado,
duplicidade, imutabilidade, erros genéricos e HTTP 500 sem code (comportamento
observado no Auth local). Cadastro sem username não chama a fronteira Auth. Os
testes antigos foram adaptados ao contrato aprovado, sem retirar validações de
senha/e-mail ou validações de perfil legado. Entrypoint novo testa recusas de
destinos remotos também em `--sql`; não há rede real na suíte React.

Nesta revisão, SQL/RLS de username aprovou **18** verificações com ROLLBACK;
autorização **59** e privacidade **16** passaram novamente com ROLLBACK. As fixtures
Auth agora fornecem usernames válidos; nenhum trigger foi desligado ou assert
removido. `node scripts/local-username-smoke.mjs` aprovou **30** verificações HTTP
reais locais, incluindo duas requisições simultâneas com username canônico igual:
um vencedor, rejeição do outro e somente uma conta gravada. Outras **3** verificações
HTTP comprovaram conta legada criada antes da migração: login depois da migração,
ausência de backfill e escolha pela própria sessão. Auth **19**, perfis **29**,
acervo **35**, admin **41** e privacidade **30** HTTP passaram novamente neste ajuste.

Duas execuções HTTP intermediárias pararam após nove verificações por asserção
incompatível com o Auth local: HTTP 500 sem code, não o code esperado. O teste foi
corrigido para exigir status 500, excluir rate limit e verificar unicidade/rollback
real no banco, sem tratar falha como sucesso. Há duas fixtures não confirmadas
retidas dessas tentativas; não foram apagadas. Na implementação, o agente não
validou manualmente navegador, carga ou recuperação específica de conta legada não confirmada.
Veja regras, restrições, riscos residuais e roteiro em `usernames-local.md`.

Validação final do ajuste: `npm.cmd run test:run` aprovou **171 testes em 19
arquivos**; `npm.cmd run build` e `npm.cmd run lint` aprovados, lint sem avisos.
As contagens anteriores de 162/170 são etapas intermediárias, não testes omitidos.
A migração adicional `20261026000300` permite UUID explícito na reserva, ainda
exigindo igualdade com auth.uid() por RLS. SQL/HTTP de usernames foram repetidos
após o reforço, aprovados (18/30). Um teste SQL de fixture legada existente comprovou
reserva com seu próprio UUID, revertida com ROLLBACK. Não houve reescrita de migração.

## Encerramento da Etapa 21.3 — validação manual do responsável

Branch `feat/local-auth`, referência estável anterior `76a6e94`. O responsável
informou **11/11 testes manuais aprovados**:

1. Cadastro exige username, e-mail e senha.
2. Cadastro com username válido funciona.
3. Username inválido ou duplicado é rejeitado.
4. E-mail de confirmação chega ao Mailpit.
5. Confirmação e login funcionam.
6. Username aparece em Meu perfil.
7. Username não pode ser alterado após cadastro.
8. Nome, WhatsApp e Instagram permanecem opcionais e editáveis.
9. Campos opcionais persistem após recarga e novo login.
10. Conta antiga pode entrar e escolher username.
11. Acervo, histórico, administração e privacidade continuam funcionando.

Essa validação manual é distinta dos testes React com fronteiras simuladas, dos
testes HTTP reais locais, das assertions SQL com rollback e dos ensaios de
infraestrutura. Username é obrigatório em novas contas, único/normalizado no
banco e permanente; contatos/nome pessoal opcionais; login por username é FUTURO.
Não há aprovação de infraestrutura remota, produção ou conformidade legal.

Na preparação final foram executados novamente: **171 testes em 19 arquivos**;
HTTP local **184** verificações (30 username, 29 perfis, 30 privacidade, 19 Auth,
35 acervo e 41 admin); SQL **93** verificações (59 autorização, 16 privacidade
e 18 username), todas aprovadas e com ROLLBACK nas suítes SQL.

Também se validou a sequência completa em um PostgreSQL novo isolado: migração
inicial e os três incrementos em ordem, as mesmas **93** verificações SQL com
ROLLBACK e **4** verificações extras de preservação/reserva legada. Sem rede,
portas ou volumes compartilhados; imagem existente sem pull, armazenamento tmpfs.
Bootstrap de DDL Auth local sem dados, owners/ACL originais não copiados, roles de
teste explícitas; não houve uma segunda pilha Supabase/HTTP completa. O contêiner
novo foi parado e o runner temporário removido. Limites em `usernames-local.md`.

As 3 verificações HTTP de legado registradas na implementação são anteriores,
não repetidas nesta preparação. O legado atual foi exercitado por SQL no novo
banco e pela validação manual do responsável. Não atribuir esses resultados a HTTP
novo do agente. Nenhuma funcionalidade ou migração foi reescrita nesta preparação.
`npm.cmd run build` e `npm.cmd run lint` também passaram novamente, código zero,
lint sem avisos. `build:staging` e `build:prod` foram recusados com código 1 por
variáveis genéricas DEV herdadas; contratos remotos válidos também permanecem
bloqueados em código, conforme os testes unitários.

## Etapa 21.4 — WhatsApp obrigatório e feedback opcional

Base `366f94a`. Cadastro passou a exigir WhatsApp no servidor; autorizá-lo para
feedback é escolha separada, opcional e inicialmente false. Nome/Instagram seguem
opcionais. Novo perfil nasce no signup; perfil antigo sem número continua válido.
Testes anteriores foram adaptados ao contrato: fixtures Auth incluem WhatsApp,
perfis criados pelo trigger são atualizados, e admin só pode ver seu próprio
perfil recém-criado. Nenhuma asserção de isolamento foi removida ou enfraquecida.

`src/profiles/whatsapp.test.ts`, `feedback.test.ts`, `FeedbackContact.test.tsx`
e os testes de cadastro/perfil verificam formatos, normalização, ausência de
WhatsApp, opt-in desmarcado/true, alteração/retirada, falhas sem dados privados,
perfil legado e flag obrigatória. Fronteiras simuladas; sem cliente real/SQL no React.
O entrypoint de WhatsApp também tem regressões de destino remoto/contexto malicioso.

Execução: **189 testes em 22 arquivos aprovados**, build DEV e lint aprovados,
lint sem avisos. Nova integração `node scripts/local-whatsapp-smoke.mjs` aprovou
**40 HTTP locais**, incluindo negações por API real para anon/leitor/admin,
opt-in separado e revogável, troca de número, JWT confirmado sem campos de intake,
grants protegidos e persistência. **8 verificações HTTP legadas** passaram com
fixture criada antes da migração: login/recuperação sem telefone, preenchimento
posterior, autorização e retirada. Nenhuma senha/número impresso; fixture retida.

Nova SQL `node scripts/local-whatsapp-smoke.mjs --sql`: **25 aprovadas com rollback**.
SQL anteriores repetidas: **59 autorização + 16 privacidade + 18 username** aprovadas
com rollback. A primeira tentativa de autorização falhou na expectativa antiga
de zero perfis para admin; agora exige exatamente o próprio, sem acesso aos demais.
Um teste de cadastro encontrou o label instável após erro; corrigido no componente
com nome acessível estável. Resultados finais preservam todos os testes.

HTTP de regressão reexecutados: **19 Auth, 29 perfis, 35 acervo, 41 admin, 30
privacidade, 30 username**, aprovados. Não houve novo teste manual do agente,
mensagem de WhatsApp, provedor externo ou infraestrutura remota. Roteiro e limites
incluindo metadados legados em `whatsapp-local.md`. Migrações 00400/00500 apenas
locais; histórico e ACL/triggers reais inspecionados. STAGING/PROD seguem bloqueados.
Os comandos `build:staging` e `build:prod` foram executados nesta etapa e recusados
com código 1 por configuração genérica DEV herdada, sem conexão remota.

## Encerramento da Etapa 21.4 — preparação do commit

Branch `feat/local-auth`, referência anterior `366f94a`. O responsável confirmou
que WhatsApp obrigatório e autorização de feedback estão funcionando na interface.
É uma confirmação manual geral, sem detalhamento de casos ou quantidade de
cenários individuais aprovados. Não representa execução integral do roteiro
manual ou aprovação de infraestrutura/produção.

As 40 verificações HTTP novas, oito legadas e 184 de regressão da implementação
continuam evidências anteriores, sem nova execução nesta preparação. Os comandos
repetidos e seus resultados finais são registrados separadamente abaixo.

Reexecutados nesta preparação: `npm.cmd run test:run` (**189 aprovados em 22
arquivos**, sem falhas/omitidos), `npm.cmd run build` e `npm.cmd run lint` (código
zero, lint sem avisos). Preflight local aprovado; inspeção real READ ONLY/ROLLBACK
confirmou seis versões de migração, RLS, grants e funções restritas. SQL/RLS
repetidos integralmente com rollback: **59 autorização, 16 privacidade, 18 username
e 25 WhatsApp**, total **118 verificações aprovadas**. Builds STAGING/PROD repetidos
e recusados com código 1 por variáveis genéricas DEV herdadas, sem conexão remota.
Nenhum teste HTTP, cenário manual específico ou novo banco isolado foi executado
agora. A confirmação geral do responsável não altera essas distinções.
