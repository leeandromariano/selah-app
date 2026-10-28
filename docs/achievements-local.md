# Etapa 22.3.5 — conquistas e desafios pessoais

## Prompt 59 — auditoria definitiva e validação manual 14/14

1. Minhas Conquistas aparece dentro de Minha Jornada.
2. Os distintivos desbloqueados correspondem ao recorde histórico.
3. Distintivos alcançados permanecem após interrupção da ofensiva.
4. É possível iniciar voluntariamente um desafio de 3, 5 ou 7 dias.
5. O progresso corresponde aos dias distintos concluídos na semana.
6. Mais de um devocional concluído no mesmo dia não aumenta indevidamente o progresso.
7. É possível desistir de um desafio sem reiniciá-lo na mesma semana.
8. F5 e Alt+Tab preservam a tela e o estado do desafio.
9. Claro, Escuro e Sistema exibem corretamente conquistas e desafios.
10. Outra conta não consegue acessar desafios privados alheios.
11. Troca de conta remove os dados da conta anterior da interface.
12. Navegar entre meses preserva as conquistas e o desafio ativo.
13. Controles funcionam por teclado e em janela pequena ou celular.
14. Uma leitura válida de 60 segundos atualiza corretamente o desafio.

Transcrição literal das aprovações informadas pelo responsável. Não corresponde
a testes manuais executados pelo agente nem aprova cenários adicionais. Não
comprova entrega Web Push externa ou certificação legal/acessibilidade completa.
Etapa 22.3.5 implementada e validada localmente, ainda sem commit. Os resultados
do Prompt 57 abaixo são históricos; suas pendências manuais não substituem o
registro acima. Nesta auditoria, nenhum instalador/manutenção foi executado no
banco existente: somente metadados de leitura e HTTP negativo, além do banco
temporário isolado com fixtures sintéticas.

### Resultados executados no Prompt 59

| Comando local repetido | Resultado desta auditoria |
| --- | --- |
| `npm.cmd run test:run` | 477 testes aprovados em 44 arquivos |
| `npm.cmd run build` | DEV aprovado; JS 545,65 kB, aviso >500 kB |
| `npm.cmd run lint` | Aprovado sem avisos |
| `node scripts/local-navigation-browser.mjs --rewards` | 27 verificações Chromium aprovadas na execução final |
| Mesmo script `--reading-layout` / `--discussion` | 54 / 45 aprovadas |
| Mesmo script `--reminders` / sem opção / `--appearance` | 29 / 18 / 88 aprovadas |
| `node scripts/verify-local-reading-install.mjs` | 15 migrações e 443 SQL/RLS aprovadas com rollback; 57 próprias de conquistas/desafios |
| Mesmo runner, concorrência | 18 verificações aprovadas: 6 de desafios, 10 de discussão e 2 de lembretes |
| `node scripts/local-achievements-readonly-http.mjs` | 4 negativas HTTP locais aprovadas, sem mutações |
| `npm.cmd run build:staging` / `npm.cmd run build:prod` | Ambos bloqueados, exit 1 esperado |
| `git diff --check` | Aprovado |

Total final Chromium: **261 verificações**. A primeira execução SQL passou 434
verificações; a final passou 443 após acrescentar nove casos de limites inferiores
dos distintivos, semanas consecutivas, transição de mês e congelamento após
desistência. Nenhuma assertiva anterior foi removida ou enfraquecida.

Novo arquivo `supabase/tests/personal-achievements-concurrency.sql` exercita duas
conexões autenticadas simultâneas: uma única adesão, espera pelo índice único,
desistência concorrente idempotente, proibição de reativação e zero escrita em
conclusões. Por isso os **16 candidatos anteriores passam a 17: 7 modificados e
10 novos**. É cobertura da etapa atual; nenhum arquivo está fora do escopo.
Essa suíte confirma fixtures apenas no banco temporário sem rede, descartado
depois; as 443 verificações principais usam rollback. Não confundir isso com
mutação no banco existente, teste com dados reais ou SQL executado pelos testes npm.

Falhas intermediárias desta rodada: a primeira tentativa em lote de regressões
Chromium terminou em `CDP timeout`, antes de apresentar aprovações. A execução
individual de layout e os demais modos passaram, sem aumento de timeout ou
supressão de assertivas. A nova checagem de foco inicialmente usava foco
programático em modalidade de ponteiro, sem ativar `:focus-visible`; o teste
passou após enviar Tab real por CDP antes de verificar foco e Enter. Nenhuma
alteração de produção foi necessária. Não houve falha de subprocesso Windows.

Backend e sessões do Chromium são simulados na fronteira. DOM, geometrias,
teclado, recarga e troca real de abas/visibilidade são locais reais; troca de abas
é a simulação automatizada de perda/retorno de foco, sem teclas físicas Alt+Tab.
SQL é integração real com PostgreSQL isolado e identidades sintéticas. HTTP é
somente negativo. SW recebe payload via CDP, sem provedor push ou entrega externa.
Firefox/Safari, dispositivos físicos, leitor de tela real e auditoria completa
WCAG/legal não foram executados. Bundle acima de 500 kB permanece conhecido.

Auditoria de regras: seis marcos derivados exclusivamente de `best_streak` do
histórico completo do backend, incluindo 1001 dias e dias duplicados; nenhuma
escrita em recibos, ofensivas ou contadores de cliente. Semana segunda–domingo
de Brasília, dias anteriores à adesão incluídos, uma meta por semana imutável,
desistência sem reinício; progresso por dia distinto do ledger válido.
Autoria sempre `auth.uid()`, sem parâmetro de conta/resultado; SECURITY DEFINER
com search_path vazio e identidade confirmada/ativa, tabela privada com RLS,
sem grants diretos. OWNER/editorial/PUBLISHER não ganham consulta de terceiros.
Histórico visual de 52 adesões, retenção enquanto a conta existe e exclusão em
cascata pela conta; desistência não é exclusão. Sem ranking ou ampliação de
métricas administrativas. Correções excepcionais do ledger exigem política
própria; não houve correção de dados nesta auditoria.

Todos os candidatos revisados; as 14 migrações anteriores permanecem idênticas
ao HEAD. Migração da etapa já aplicada no Prompt 57 não foi reescrita. Nenhuma
dependência, autenticação, regra de 60s, permissão OWNER ou transporte push foi
alterado nesta auditoria. Sem arquivos de ambiente, credenciais, cookies, logs,+caches ou temporários entre os candidatos; varredura por padrões sem segredos
identificados, complementada pela revisão de contexto. Arquivos de credenciais
não foram abertos. Staging vazio. Sem bloqueador técnico identificado para commit
local; isso não libera STAGING/PROD nem equivale a autorização de publicação.

Prompt 57. Base `412dc4e`, branch `feat/local-auth`, árvore inicialmente limpa.
Implementação exclusivamente local, sem staging/commit/publicação. Etapas
anteriores preservadas. Web Push externo continua desativado.

## Arquitetura e autoridade

Minha Jornada mantém `ConsistencySection` e acrescenta `JourneyRewards`, com
estados independentes de carregamento/erro e remount pela identidade da conta.
Foco/visibilidade e atualização de um minuto reconsultam o servidor; não mudam o
mês do calendário. F5 mantém a rota e retorna ao mês atual, como anteriormente.
Respostas obsoletas não atualizam outra conta; recuperação/logout fecham a página.

`get_my_journey_rewards()` reutiliza `get_my_consistency()` no servidor. Os seis
distintivos são derivados do recorde histórico completo do mesmo ledger de
conclusões válidas, não da ofensiva atual nem de contadores do navegador:

| Dias consecutivos | Distintivo |
| --- | --- |
| 3 | Primeiros passos |
| 7 | Uma semana |
| 14 | Perseverança |
| 30 | Constância |
| 60 | Dedicação |
| 100 | Jornada de fé |

Não há novo registro materializado de concessão: o ledger existente já é a
evidência persistente autorizada. Essa escolha evita backfill, trigger novo na
conclusão e duplicação de estado. Uma pausa não remove o recorde nem o distintivo.
Não há limite de 1000 linhas REST: o cálculo acontece sobre todo o histórico no
PostgreSQL. Dias futuros anômalos são excluídos até a data válida do servidor.
Não é guardada a data exata de concessão. Exclusão da própria conta elimina a
história; uma futura correção excepcional de recibos exigirá política explícita
antes de modificar essa evidência. Nenhuma correção/limpeza foi feita agora.

Aberturas, comentários, reações, compartilhamentos e notificações não são fontes
de progresso. RPCs novas não inserem/alteram conclusões e não recebem usuário,
data, duração, progresso ou resultado do cliente.

## Desafios voluntários

Metas de 3, 5 ou 7 dias distintos. Semana civil de segunda a domingo em
`America/Sao_Paulo`, independente do fuso/relógio do dispositivo. A adesão é
explícita em Minha Jornada. Dias já concluídos desde segunda contam, inclusive
antes da adesão; começar no meio da semana não estende a semana. Isso difere da
proposta inicial do roadmap, substituída pela regra explícita desta implementação.
Uma conclusão em qualquer devocional dá um dia; múltiplas conclusões não duplicam.

Uma adesão por usuário/semana, com meta imutável. Repetir a mesma requisição é
idempotente; tentar outra meta na mesma semana gera conflito `40001`. A chave
primária serializa adesões concorrentes. Ao desistir, o estado fica encerrado por
você; não reinicia nem troca a meta naquela semana. Semana seguinte permite nova
escolha. Não existe punição, ranking ou exposição de resultado a outras pessoas.

Progresso e resultado são derivados no servidor: `active`, `completed`, `ended`
(semana encerrada) e `cancelled`. Desistência congela a contagem no instante
servidor; conclusões posteriores não reativam o desafio. Um resultado já
concluído não é apagado pela desistência. Encerramento semanal não precisa de job.
A barra limita-se à meta; o texto mantém a quantidade real de dias da semana.
Interface mostra no máximo as 52 adesões mais recentes, sem apagar as anteriores.

## Migração, segurança e retenção

`20261028000800_personal_achievements.sql` é incremental; as 14 migrações anteriores
não foram reescritas. Cria somente `private.personal_challenges` e RPCs/helpers.
Colunas: usuário, segunda-feira, meta, instante de adesão e desistência. Sem novos
contatos ou dados de perfil. RLS ativada, política de seleção própria e nenhum
grant direto de tabela para clientes. APIs são SECURITY DEFINER com search_path
vazio, identidade autenticada confirmada/não anônima, sem conta removida/banida,
filtros próprios explícitos; helper sem EXECUTE público. Apenas authenticated
executa as três RPCs. OWNER/editorial/futuro PUBLISHER não recebem acesso novo.

Adesões/resultados privados ficam enquanto a conta existir; exclusão da conta
propaga por FK. Desistir não é apagar a adesão. Não há expurgo automático ou nova
ferramenta OWNER. A política de retenção deve ser revista antes de publicação,
assim como a política geral de dados religiosos; testes não certificam adequação
legal. Nenhum dado de leitor é incluído em logs, URL ou payload público.

Instalação local protegida: `node scripts/apply-local-achievements-migration.mjs`.
Verifica histórico, Docker e endpoints locais antes de `migration up --local`.
Foi executada no Prompt 57 após validação isolada: somente novas estruturas e
registro de migração, sem backfill ou alteração de dados anteriores. Nunca usar
link, db push/reset ou apontar para serviço hospedado. Testes npm não executam SQL.

## Validação automatizada e limites

Comandos/resultados completos em [testing.md](testing.md), seção Prompt 57.
Unitários simulam Supabase na fronteira; Chromium também usa sessões/resultados
fictícios. O armazenamento `__fiction_reward_` existe apenas no mock do teste de
navegador; produção não usa localStorage para decidir conquistas ou progresso.
SQL/RLS exercita PostgreSQL temporário sem rede, com fixtures fictícias e rollback.
Nenhuma linha de usuário é copiada do banco existente. HTTP local é negativo,
sem sessões de leitores nem mutações.

Não houve validação manual nova informada, teste de dispositivo físico,
Firefox/Safari ou leitor de tela real. Contraste Chromium é uma amostra de texto
renderizado, não auditoria completa WCAG. Bundle segue acima de 500 kB. Consultas
agregadas podem precisar de otimização para históricos maiores; não há cache
global com dados privados. Entrega push remota não foi ativada nem validada.

## Checklist original do Prompt 57 — dados fictícios

As aprovações efetivas são somente as 14 transcritas no Prompt 59 acima; este
roteiro mais amplo não implica aprovação adicional de seus itens.

- [ ] Abrir Minha Jornada por menu e hash autenticado; conferir seis distintivos
  comparando o recorde, inclusive conta sem conclusões e com sequência interrompida.
- [ ] Escolher voluntariamente 3, 5 e 7 em contas/semanas fictícias separadas;
  verificar dias prévios da semana e ausência de adesão automática.
- [ ] Concluir após 60 segundos confirmados; voltar à Jornada e conferir um único
  dia adicional, inclusive após concluir dois textos no mesmo dia.
- [ ] Desistir de desafio ativo; confirmar histórico privado e nova escolha
  somente na próxima semana. Resultado concluído não pode ser apagado.
- [ ] Testar F5, Alt+Tab, navegação de meses e mudança de dia de Brasília.
- [ ] Sair/trocar conta; nenhum distintivo/desafio anterior permanece na tela.
- [ ] Conferir Claro/Escuro/Sistema, celular, zoom, Tab/Enter e leitor de tela.
- [ ] Confirmar leitura, compartilhar, comentários e moderação OWNER preservados.

Não editar recibos nem relógio servidor do banco existente para simular dias.
Usar a suíte isolada para históricos longos e transições de calendário.

## Arquivos desta etapa

17 candidatos: 7 modificados e 10 novos. Revisão final sem caminhos sensíveis ou assinaturas de segredo identificados nos candidatos; arquivos de credenciais não foram abertos. As 14 migrações anteriores permanecem idênticas ao HEAD. Staging vazio.

- docs/development-workflow.md
- docs/journey-roadmap.md
- docs/testing.md
- scripts/local-navigation-browser.mjs
- scripts/verify-local-reading-install.mjs
- src/components/JourneyPage.test.tsx
- src/components/JourneyPage.tsx
- docs/achievements-local.md
- scripts/apply-local-achievements-migration.mjs
- scripts/local-achievements-readonly-http.mjs
- src/components/JourneyRewards.test.tsx
- src/components/JourneyRewards.tsx
- src/journey/journey.css
- src/journey/repository.ts
- supabase/migrations/20261028000800_personal_achievements.sql
- supabase/tests/personal-achievements.sql
- supabase/tests/personal-achievements-concurrency.sql

## Preparação de versionamento — CMD Windows, somente comandos fornecidos

Modificados (7):

```cmd
git add -- docs/development-workflow.md docs/journey-roadmap.md docs/testing.md
git add -- scripts/local-navigation-browser.mjs scripts/verify-local-reading-install.mjs
git add -- src/components/JourneyPage.tsx src/components/JourneyPage.test.tsx
```

Novos (10):

```cmd
git add -- docs/achievements-local.md
git add -- scripts/apply-local-achievements-migration.mjs scripts/local-achievements-readonly-http.mjs
git add -- src/components/JourneyRewards.tsx src/components/JourneyRewards.test.tsx
git add -- src/journey/journey.css src/journey/repository.ts
git add -- supabase/migrations/20261028000800_personal_achievements.sql
git add -- supabase/tests/personal-achievements.sql supabase/tests/personal-achievements-concurrency.sql
```

Mensagem recomendada: `feat: adiciona conquistas e desafios pessoais privados`.
Nenhum comando de staging ou commit foi executado. Sem envio externo, push ou deploy.
