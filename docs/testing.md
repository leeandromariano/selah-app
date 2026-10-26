# Inventário e execução de testes

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
| `src/App.test.tsx` | Busca por referência sem diferenciar maiúsculas combinada com tema, resultado vazio e recuperação; marcação de leitura com botão desabilitado e descarte em nova montagem; remoção de itens, preservação do último devocional e restauração do acervo em nova montagem |

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
