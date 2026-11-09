# Inventário e execução de testes

## Rebranding Coram

`appearance/contrast.test.ts` verifica a paleta de ambos os temas; `appearance/bootstrap.test.ts` cobre o novo padrão escuro e a preservação de preferências explícitas. `consistency/calendar.test.ts` cobre a semana civil com virada de mês e futuro; `ConsistencySection.test.tsx` verifica a busca da semana anterior pela RPC e a sequência recebida do servidor. `ReaderLibrary.test.tsx` verifica a escolha opcional de estado de espírito sem abertura ou gravação. A suíte não prova o layout em navegador real nem publicação hospedada. Ver [limites](coram-rebrand-local.md).

`bible/catalog.test.ts` cobre referências com separador `:` ou espaço; `BibleReader.test.tsx` verifica a navegação direta, a grade de livros e a mensagem para entradas sem referência. Não há promessa de busca por assunto nessa etapa.

## Destaques e anotações bíblicas

`hostedGateway.test.ts` exercita o candidato de rota hospedada com dependências
fictícias: autenticação, isolamento do token, limite e falha fechada. Não prova
deploy, D1, quota do fornecedor ou integração hospedada real.

`BibleFavorites.test.tsx` cobre listagem, paginação, atribuição, referência com
intervalo e tratamento de erro; `attribution.test.ts` verifica a preservação do
aviso de direitos ao retirar a apresentação promocional conhecida da ARA.

`annotations.test.ts` testa filtros por conta e resposta recusada;
`BibleVerseList.test.tsx` cobre cor, anotação, cópia com atribuição, remoção e
erros, além de favoritar e desfavoritar; `BibleAnnotationsIntegration.test.tsx` cobre troca de conta enquanto
uma resposta está pendente. `supabase/tests/bible-personal-annotations.sql`
exercita isolamento, alterações e exclusões da própria conta e bloqueio de
acesso anônimo. `supabase/tests/bible-favorite-verses.sql` cobre a mesma fronteira
para favoritos. Testes equivalentes foram executados com contas fictícias e
ROLLBACK, incluindo a proteção para cadastro Google pendente. Nenhum texto real
ou credencial é incluído nas fixtures.

## Seleção bíblica nos devocionais locais

`BiblePassagePicker.test.tsx` cobre escolha de tradução e passagem, intervalos
agrupados e falhas sem persistir o texto da API. `DevotionalPassage.test.tsx`
verifica duplo clique, referência exata e link acessível; o teste de passagem
legada cobre referências reconhecidas e não reconhecidas. Os testes de ADMIN e
PUBLICADOR usam fronteira simulada para salvar a seleção. O roteiro SQL
`supabase/tests/devotional-bible-selection.sql` usa dados fictícios e rollback;
as verificações equivalentes de ADMIN, PUBLICADOR, revisão e negação a leitor
foram exercitadas em transações revertidas no banco local. Não substituem
homologação hospedada ou verificação de licenças para monetização.

## Painel OWNER em STAGING

`OwnerPanel.test.tsx` simula as RPCs na fronteira e cobre as três rotas OWNER,
leitor, ADMIN legado, respostas inválidas ou falha da RPC, troca de sessão,
resposta atrasada e logout. A confirmação de acesso usa exclusivamente
`get_my_discussion_access`; os componentes mantêm as verificações no servidor.
Os testes não conectam ao STAGING e não substituem homologação em navegador.

## Prompt 73 — elegibilidade OWNER e compatibilidade local

O teste novo `owner-eligibility.sql` primeiro falhou contra as 15 migrações:
uma sessão com claims existentes e OWNER suspenso acessava a comunidade. Após
a migração incremental 00900, o runner aplicou 16 migrações em PostgreSQL
temporário sem rede e passou **464 verificações SQL/RLS**, incluindo **21** de
elegibilidade e referências de auditoria; também passou 18 testes concorrentes
existentes. O operador simulado não é superuser, tem CREATEROLE/BYPASSRLS e não
tem grant option de USAGE no schema Auth. Não equivale ao operador Cloud.

O teste cobre suspensão com claims inalterados, confirmação, exclusão lógica,
anonimato, pedido de exclusão, revogação da membership, helper privado e prefixos
LOCAL/STAGING; somente fixtures sintéticas em banco descartável. A fixture da
suíte de comunidade passou a confirmar e-mail para satisfazer o novo contrato;
nenhuma asserção anterior foi removida. `node scripts/local-auth-smoke.mjs`
passou 19 verificações HTTP locais de cadastro, confirmação, login e recuperação
com uma conta fictícia nova mantida localmente; não houve alteração de contas
preexistentes. O stack local existente não recebeu a nova migração.

`npm.cmd run test:run`: 506 testes em 48 arquivos aprovados; `npm.cmd run build`
e `npm.cmd run lint` aprovados, build DEV com aviso de bundle de 556,55 kB.
Não houve teste de interface novo ou execução de migração hospedada. Os testes
de concorrência acima são os existentes de lembretes, discussão e desafios,
não uma prova nova de corrida entre suspensão e consulta OWNER.

## Prompt 71 — pré-instalação de Supabase gerenciado

Branch `feat/local-auth`, base `8fe831c`, árvore limpa no início. Somente
preparação documental: nenhuma migração, RLS, Auth ou dado existente foi
alterado e nenhum serviço hospedado foi acessado.

`node scripts/verify-local-reading-install.mjs` instalou as 15 migrações em
PostgreSQL temporário local sem rede e passou **443 verificações SQL/RLS e 18
de concorrência**. Contêiner descartado; os dados do banco local existente não
foram copiados ou alterados. A estrutura Auth é reconstruída a partir de DDL e
roles de teste, não representa integralmente as permissões do Supabase Cloud.

`npm.cmd run test:run`: 506 testes em 48 arquivos aprovados; `npm.cmd run build`
e `npm.cmd run lint` aprovados; build DEV com JS 556,55 kB e aviso >500 kB.
`git diff --check` aprovado. Testes de UI usam integrações simuladas; não há
nova evidência de Auth, SMTP, Data API ou migrações em ambiente hospedado.

A consulta local `node node_modules/supabase/dist/supabase.js db push --help`
falhou inicialmente por bloqueio de escrita do arquivo de telemetria da CLI no
sandbox. Após aprovação para consultar a ajuda local fora do sandbox, terminou
com sucesso; não executou `db push`, nem conexão hospedada. A CLI 2.122.0 informa
que `db push` pode atualizar Vault por padrão; o roteiro futuro exige
`--skip-vault` e aprovação própria para dry-run e aplicação. O comportamento do
dry-run hospedado e a capacidade de autenticação sem expor segredos não foram
comprovados nesta rodada.

## Prompt 70 — auditoria final de STAGING

`npm.cmd run test:run`: 506 testes em 48 arquivos aprovados. `npm.cmd run
build` e `npm.cmd run lint` aprovados; build DEV com JS 556,55 kB e aviso acima
de 500 kB. `node scripts/build-staging-fixture.mjs` passou e produziu build
STAGING fictício de 556,80 kB; o build sem sinal foi recusado com código 1 e
`build:prod` foi recusado com código 1 por configuração genérica DEV. A suíte
unitária também confirma recusa de PROD com valores fictícios completos.
Após inspecionar STAGING, o build DEV foi gerado novamente em `dist`.

Chromium com backend simulado: `--bible` 18, `--reading-layout` 54,
`--discussion` 45 e `--rewards` 27 verificações aprovadas. Nenhum teste SQL/RLS
foi repetido nesta auditoria, pois não houve alteração de banco; os 443 testes
SQL e 18 concorrentes do Prompt 69 são resultados anteriores. A varredura
limitada do bundle STAGING detectou a chave pública fictícia e não encontrou
prefixos comuns de segredo, chaves privadas ou JWT service_role. Não é garantia
exaustiva de ausência de segredos. Não houve acesso hospedado ou deploy.
`git diff --check` passou; nenhum arquivo foi colocado em staging Git.

## Prompt 69 — build STAGING local controlado

`npm.cmd run test:run`: 506 testes em 48 arquivos aprovados; testes de ambiente
usam origem e cliente simulados, sem rede. `npm.cmd run build` e lint passaram;
build DEV produziu JS 556,55 kB, com aviso acima de 500 kB. `node
scripts/build-staging-fixture.mjs` invocou `npm.cmd run build:staging` com
valores fictícios e passou, JS 556,80 kB com o mesmo aviso. A execução direta
sem sinal de build foi recusada com código 1; `build:prod` recusou código 1
por variável genérica DEV. Testes unitários também recusam PROD com configuração
fictícia válida e sinal presente. O build DEV foi gerado novamente ao final.

Varredura limitada do bundle STAGING encontrou a chave pública fictícia e não
detectou prefixo de chave secreta, JWT service_role ou chave privada. O código
de validação DEV mantém uma string de URL local no bundle, mas o contrato STAGING
recusa esse backend; a presença literal não é fallback. Essa varredura não prova
ausência de todos os segredos possíveis. Nenhum serviço hospedado foi acessado
ou testado e não houve teste do build em domínio HTTPS real.

`node scripts/verify-local-reading-install.mjs`: 15 migrações instaladas em
PostgreSQL temporário isolado, 443 verificações SQL/RLS e 18 de concorrência
aprovadas; contêiner descartado. Isso não reproduz integralmente permissões da
plataforma gerenciada. Chromium com fronteira Supabase simulada: `--bible` 18,
`--discussion` 45, `--reading-layout` 54 e `--rewards` 27 verificações aprovadas.
Não foi repetido HTTP real de Auth nesta rodada. `git diff --check` passou.

## Prompt 68 — validação manual informada pelo responsável: 12/12 aprovados

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

Transcrição literal informada pelo responsável; não demonstra hospedagem real,
SMTP externo, Auth hospedado ou testes adicionais não informados.

Verificações executadas nesta auditoria: `npm.cmd run test:run` passou 504 testes
em 48 arquivos; `npm.cmd run build` passou em DEV (JS 556,53 kB, aviso acima de
500 kB); `npm.cmd run lint` passou. `build:staging` e `build:prod` retornaram
código 1 devido às variáveis genéricas DEV; a suíte também testa recusa antes do
SDK com contrato hospedado fictício válido. `git diff --check` passou.

Auth HTTP local: `node scripts/local-auth-smoke.mjs` passou 19 verificações,
incluindo confirmação e recuperação via Mailpit. Com função local servida,
`node scripts/local-login-browser.mjs` passou 12 verificações Chromium/Auth reais,
incluindo username, e-mail e logout. Cada teste criou uma conta fictícia nova,
mantida localmente; nenhuma conta anterior foi alterada ou excluída. Negativas
HTTP `node scripts/local-community-readonly-http.mjs`: oito aprovadas sem
modificação de dados. Nenhum SQL/RLS novo foi executado.

Chromium com backend simulado: `--bible` 18, `--reading-layout` 54,
`--discussion` 45, `--rewards` 27 e sem opção 18 verificações aprovadas. A
falha histórica de comentários e a intermitência de compartilhamento não se
reproduziram; as causas originais não foram confirmadas. Preview DEV explícito
serviu HTML, bundle, service worker, protocolo e `_headers` com HTTP 200 local;
não valida os cabeçalhos no Cloudflare. Varredura limitada do bundle DEV não
encontrou prefixo conhecido de chave secreta, JWT `service_role` ou chave privada;
não comprova ausência de todo segredo possível.

## Prompt 67 — integração protegida da configuração hospedada

`npm.cmd run test:run`: 504 testes em 48 arquivos aprovados; `npm.cmd run build`
aprovado em DEV (JS 556,53 kB, aviso acima de 500 kB); `npm.cmd run lint`
aprovado sem avisos. Os testes de configuração hospedada preparam parâmetros
fictícios e comprovam que a fábrica não chama o SDK após a recusa; não criam
cliente remoto. O login hospedado é testado com Auth simulado, inclusive
normalização de erro para e-mail não confirmado. Não comprova política de
enumeração do endpoint Auth direto de um projeto hospedado.

Com função local servida, `node scripts/local-login-browser.mjs` passou 12
verificações Chromium com Auth real e conta fictícia nova; `node
scripts/local-auth-smoke.mjs` passou 19 HTTP reais locais com outra conta
fictícia nova, incluindo confirmação e recuperação. Ambas foram mantidas;
nenhuma conta preexistente foi alterada ou apagada e Mailpit permaneceu local.
`node scripts/local-community-readonly-http.mjs` passou oito negativas HTTP.
Chromium com integração Supabase simulada: `--reading-layout` 54,
`--discussion` 45, `--rewards` 27 e `--bible` 18 verificações aprovadas.
As falhas históricas de compartilhamento e comentários não se reproduziram;
sua causa original segue não comprovada.

`build:staging` e `build:prod` retornaram exit 1 por variáveis genéricas DEV;
teste unitário independente confirma que a fábrica recusa contrato hospedado
fictício válido antes de chamar SDK. Nenhum SQL/RLS novo, serviço hospedado ou
e-mail externo foi usado. `git diff --check` passou.

## Prompt 66 — preparação hospedada com bloqueios preservados

`npm.cmd run test:run`: 501 testes em 48 arquivos aprovados. Os testes novos de
configuração e login hospedado usam valores e SDK fictícios, sem rede; os
anteriores permanecem. `npm.cmd run build` passou em DEV (JS 555,34 kB, aviso
acima de 500 kB) e `npm.cmd run lint` passou. `build:staging` e `build:prod`
foram recusados com exit 1 por variáveis genéricas DEV herdadas; os testes
unitários também confirmam bloqueio com contrato fictício válido.

`node scripts/local-auth-smoke.mjs` passou 19 verificações HTTP reais locais,
incluindo confirmação, recuperação e logout, com uma conta fictícia nova retida
e Mailpit local. `node scripts/local-community-readonly-http.mjs` passou oito
negativas locais sem alteração de registros. O primeiro
`node scripts/local-login-browser.mjs` passou três verificações e parou no login
quando a função local não estava servida; depois de iniciar
`node scripts/serve-local-login.mjs`, a reexecução passou 12 verificações reais
de navegador/Auth e função, inclusive username e e-mail. Cada execução criou
uma conta fictícia nova que permaneceu no banco local. Nenhuma conta preexistente
ou permissão OWNER foi alterada; e-mails ficaram no Mailpit local.

Chromium com Supabase simulado: `--bible` 18, `--reading-layout` 54,
`--discussion` 45 e `--rewards` 27 verificações aprovadas. Falhas históricas de
compartilhamento/comentários não se reproduziram; sua causa original não foi
comprovada. Nenhuma migração foi criada ou executada; SQL/RLS não foi repetido.

`npm.cmd run preview` padrão foi recusado pelo modo de produção; com
`npm.cmd run preview -- --mode development`, o artefato DEV serviu HTML, bundle,
service worker e arquivo `_headers` por HTTP local. Inspeção limitada do bundle
não encontrou prefixo de chave secreta conhecido. Isso não verifica aplicação dos
cabeçalhos pelo Cloudflare nem comprova ausência de qualquer segredo possível.
Não houve acesso a provedor hospedado ou envio externo. `git diff --check` passou.

## Prompt 65 — validação manual informada pelo responsável: 9/9 aprovados

1. A seção Bíblia aparece no menu e abre corretamente.
2. Consigo selecionar livros do Antigo e do Novo Testamento.
3. A navegação entre capítulos funciona, incluindo o primeiro e o último.
4. O seletor de traduções identifica corretamente versões indisponíveis.
5. Links internos e destaques de versículos funcionam nos dados demonstrativos.
6. As referências devocionais não abrem conteúdo fictício como se fosse uma tradução real.
7. A seleção permanece ao atualizar a página na mesma aba.
8. Nenhuma alteração prejudicou leitura, comentários ou Minha Jornada.
9. Teclado, celular e os três temas funcionam corretamente.

Transcrição literal de validação manual informada pelo responsável, distinta de
testes executados pelo agente e limitada aos nove itens acima.

Validação local repetida nesta rodada: `npm.cmd run test:run` passou 485 testes
em 46 arquivos; `npm.cmd run build` passou em DEV (JS 554,42 kB, aviso acima de
500 kB); `npm.cmd run lint` passou sem avisos. Com servidor Vite local existente,
`node scripts/local-navigation-browser.mjs --bible`, `--discussion`,
`--reading-layout`, `--rewards` e sem argumento passaram respectivamente 18,
45, 54, 27 e 18 verificações Chromium. A integração Supabase desses testes é
simulada e os conteúdos são fictícios. A tentativa de iniciar outro servidor
Vite foi recusada porque a porta 5173 já estava ocupada; o serviço local existente
servia o módulo bíblico atual e não foi encerrado. `git diff --check` passou.
Não houve nova execução SQL/RLS, HTTP real de Auth, teste com fornecedor bíblico
ou rede hospedada nesta rodada.

As falhas anteriores de comentários e compartilhamento não se reproduziram
nas verificações acima. A fixture de compartilhamento já havia sido ajustada no
Prompt 64 para aguardar habilitação e simular início de leitura; isso não prova
a causa da falha histórica. A causa da falha Chromium de comentários também
permanece não confirmada. Não foram removidas ou enfraquecidas assertivas nesta
auditoria. Há 17 candidatos: sete modificados e dez novos; nenhum staged.

## Prompt 64 — Bíblia demonstrativa

Os novos testes `src/bible/catalog.test.ts` e `src/components/BibleReader.test.tsx`
cobrem catálogo, referências, rotas, estados, versão indisponível e a condição
para habilitar links apenas por provedor licenciado que valide a passagem. Esse
provedor é simulado; não há licença nem API real configurada. O teste de
compartilhamento aguarda o botão de conclusão estar habilitado antes de clicar
e simula `start_reading` com estado coerente quando a página está ativa,
mantendo as mesmas verificações. A fixture anterior não simulava essa chamada;
isso e o clique antes de habilitação são causas possíveis da falha intermitente,
mas a execução histórica não comprova qual ocorreu.

Com Vite local em execução, `node scripts/local-navigation-browser.mjs --discussion`
passou 45 verificações e `--bible` passou 18, usando integração Supabase simulada.
As duas primeiras tentativas do modo `--bible` falharam em `Runtime.evaluate`
porque a nova expressão retornava um elemento DOM em vez de booleano; corrigida
a expressão, passou. A falha histórica de discussão ocorreu antes da renderização;
não se comprovou sua causa apenas pela nova execução aprovada.

Validação final: `npm.cmd run test:run` passou 485 testes em 46 arquivos após o
ajuste da fixture; `npm.cmd run build` e `npm.cmd run lint` passaram, build DEV
com aviso de bundle de 554,42 kB. `--reading-layout` passou 54 verificações e
`--rewards` 27 em Chromium com backend simulado. `git diff --check` passou.
Não houve teste com provedor bíblico real, conteúdo licenciado ou backend remoto.

## Prompt 63 — decisão de cadastro aberto

O cadastro público com confirmação de e-mail passa a ser o comportamento
pretendido; a Etapa 23.2 de convites foi dispensada sem implementação. O signup
direto observado no Prompt 61 não é falha contra o novo produto. Os resultados
históricos abaixo permanecem inalterados, inclusive a falha Chromium. Continuam
necessários testes de Auth, confirmação, recuperação, abuso, RLS e permissões
OWNER na futura homologação. Esta atualização documental não comprova novos
testes de comportamento.

Validação documental desta rodada: `npm.cmd run test:run` inicialmente teve
476 aprovados e uma falha em `ReaderLibrary.test.tsx` ao aguardar a conclusão;
a causa não foi determinada. A reexecução isolada do arquivo passou 21 testes e
a reexecução da suíte completa passou 477 testes em 44 arquivos. `npm.cmd run
build` passou em DEV com aviso de bundle acima de 500 kB; `npm.cmd run lint` e
`git diff --check` passaram. Nenhum teste de Chromium ou integração foi repetido.

## Prompt 61 — diagnóstico de convites, implementação pendente

`node scripts/local-auth-smoke.mjs` passou 19 verificações HTTP locais e criou
uma conta fictícia sem convite, demonstrando que o cadastro direto continua
aberto. A conta fictícia foi mantida; Mailpit é local. A confirmação e a
recuperação exercitadas são as existentes, não um fluxo de convites.
`node scripts/local-achievements-readonly-http.mjs` passou quatro negativas.
`node scripts/verify-local-reading-install.mjs` instalou 15 migrações em
PostgreSQL temporário isolado e passou 443 verificações SQL e 18 verificações
de concorrência existentes; não havia testes de convite. O contêiner temporário
foi descartado. Esses testes não usam backend simulado para o SQL/HTTP.

`npm.cmd run test:run` inicialmente falhou em um dos 477 testes, durante
carregamento do perfil, enquanto outras verificações executavam em paralelo;
na reexecução isolada passou 477 em 44 arquivos. O teste React simula o backend.
`npm.cmd run build` e `npm.cmd run lint` passaram; build DEV manteve aviso de
bundle acima de 500 kB. `node scripts/local-navigation-browser.mjs --discussion`
falhou duas vezes na verificação de renderização da reflexão publicada com
limite de 1000 caracteres, inclusive após a suíte terminar; causa não apurada.
Não alegar validação Chromium ou de convites com esses resultados.

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


## Prompt 57 — Etapa 22.3.5: conquistas e desafios pessoais

Base `412dc4e`, branch `feat/local-auth`, árvore inicialmente limpa. Nenhuma nova
aprovação manual informada. Checklist pendente e arquitetura em
[achievements-local.md](achievements-local.md). Somente ambiente local.

| Comando executado nesta rodada | Resultado |
| --- | --- |
| `npm.cmd run test:run` | 477 testes aprovados em 44 arquivos |
| `npm.cmd run test:run -- src/components/JourneyRewards.test.tsx src/components/JourneyPage.test.tsx` | 22 aprovados na reexecução |
| `npm.cmd run build` | DEV aprovado; JS 545,65 kB, aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado sem avisos na execução final |
| `node scripts/local-navigation-browser.mjs --rewards` | 24 Chromium aprovadas |
| Chromium `--reading-layout` / `--discussion` | 54 / 45 aprovadas |
| Chromium `--reminders` / sem opção / `--appearance` | 29 / 18 / 88 aprovadas nas execuções finais |
| `node scripts/verify-local-reading-install.mjs` | 15 migrações, 434 SQL/RLS com rollback aprovadas, incluindo 48 de conquistas/desafios |
| Mesmo runner, concorrência anterior | 2 verificações de lembretes e 10 de discussão aprovadas, apenas no banco descartado |
| `node scripts/apply-local-achievements-migration.mjs` | Nova estrutura instalada exclusivamente no Supabase local; nenhum backfill/dado anterior modificado |
| `node scripts/local-achievements-readonly-http.mjs` | 4 negativas HTTP aprovadas; três RPCs negadas ao anônimo e tabela privada inacessível |
| `npm.cmd run build:staging` / `npm.cmd run build:prod` | Ambos bloqueados, exit 1 esperado |
| `git diff --check` | Aprovado na revisão final |

Total Chromium: 258 verificações finais. Backend/sessões/resultados são simulados
na fronteira; DOM, teclado, clipboard, geometria e navegação são locais reais.
SW recebe injeção CDP, sem provedor push. Isso não comprova entrega remota nem
fluxo autenticado completo de navegador até PostgreSQL. SQL usa banco temporário
isolado sem rede, fixtures fictícias e rollback; concorrência anterior confirma
transações somente no banco descartado. Nenhum usuário real foi copiado para teste.

Cobertura nova: seis marcos, recorde interrompido, 1001 dias com duplicatas por
dia, ausência de recibos e datas futuras; semana civil de Brasília independente
do fuso de sessão, metas 3/5/7, adesão/retry/conflito/desistência, histórico e
semana encerrada. RLS própria inclusive OWNER/editorial, ausência de grants
diretos e parâmetros de autoria/resultado. Interface verifica estados de erro,
retry, cliques duplicados, teclado, troca de conta/respostas tardias, logout,
foco/reload/calendário, três temas e mobile sem overflow. As suítes anteriores
mantêm regressões de autenticação, leitura de 60s, comentários e notificações.

Falhas intermediárias, sem ocultação: dois testes antigos de Jornada pressupunham
uma única RPC e um único alerta. Passaram a selecionar a RPC/alerta de consistência
especificamente, preservando as assertivas de navegação/privacidade. Lint apontou
referências mutáveis em cleanup; a captura do controle foi movida para dentro dos
efeitos, sem suprimir regras. Chromium de conquistas clicava no calendário ainda
carregando após reload; agora aguarda o botão habilitado antes de interagir.

Chromium de lembretes falhou duas vezes ao exibir notificação CDP: a ponte legítima
de limpeza da segunda conta disputava o binding fictício injetado pelo teste.
Teste de SW isolado em documento estático da mesma origem, após preservar todas
as verificações de configurações/troca de conta. Passou com 29 verificações; nenhum
código de produção de push foi alterado e nenhuma assertiva foi removida.
Instalador inicialmente recusado pelo sandbox; executado depois com permissão
local específica e guardas intactas. Nenhuma falha de subprocesso Windows ocorreu.

Limites: amostra de contraste, sem certificação WCAG/legal, leitor de tela real,
Firefox/Safari ou dispositivo físico. Bundle >500 kB, retenção por vida da conta,
histórico visual limitado às 52 últimas adesões e custo de agregação completa
documentados. Sem staging/commit, publicação ou Web Push externo.

## Prompt 56 — auditoria final e validação manual 13/13

1. Os textos solicitados nos Prompts 53, 54 e 55 desapareceram.
2. O subtítulo aparece exatamente como solicitado.
3. O contador N/1000 funciona e o campo respeita o limite.
4. Os cartões de leitura, compartilhamento e comentários estão alinhados no desktop.
5. Gostei/Não gostei funciona, inclusive troca e remoção.
6. Meu comentário aparece como pendente após o envio.
7. O Owner consegue aprovar e rejeitar comentários.
8. Editar um comentário aprovado exige nova moderação.
9. Um comentário aprovado fica visível a outros leitores autenticados.
10. Exclusão própria, denúncias e ocultação funcionam.
11. Contas sem OWNER não acessam a moderação.
12. A interface funciona no celular e nos três temas.
13. Comentários e reações não afetam a conclusão de 60 segundos.

Transcrição literal das aprovações informadas pelo responsável. Não são testes
manuais executados pelo agente nem aprovação de cenários adicionais, certificação
legal ou recebimento Web Push externo. Registros dos Prompts 52–55 abaixo são
históricos; suas menções a validação manual pendente não substituem estas aprovações.

### Verificacoes repetidas nesta auditoria

| Execucao local — Prompt 56 | Resultado |
| --- | --- |
| npm.cmd run test:run | 466 testes, 43 arquivos aprovados |
| npm.cmd run build | DEV aprovado; JS 540,66 kB, aviso acima de 500 kB |
| npm.cmd run lint | Aprovado |
| node scripts/local-navigation-browser.mjs --reading-layout | 54 verificacoes Chromium aprovadas |
| node scripts/local-navigation-browser.mjs --discussion | 45 aprovadas |
| node scripts/local-navigation-browser.mjs --reminders | 28 aprovadas |
| node scripts/local-navigation-browser.mjs | 18 aprovadas |
| node scripts/local-navigation-browser.mjs --appearance | 88 aprovadas |
| node scripts/verify-local-reading-install.mjs | 14 migracoes, 386 SQL/RLS e 12 verificacoes concorrentes aprovadas |
| node scripts/local-discussion-readonly-http.mjs | 13 negativas HTTP locais aprovadas |
| node scripts/local-community-readonly-http.mjs | 8 negativas HTTP locais aprovadas |
| npm.cmd run build:staging / npm.cmd run build:prod | Ambos bloqueados, exit 1 esperado |
| git diff --check | Aprovado |

Total Chromium: 233 verificacoes. DOM, geometria, clipboard e navegacao locais;
backend, sessoes e confirmacoes de tempo simulados na fronteira. Service worker
exercitado via CDP, sem envio/recebimento push remoto. Sem Firefox/Safari,
dispositivos fisicos ou auditoria completa de acessibilidade/contraste.

SQL usa PostgreSQL temporario isolado e dados sinteticos: 386 verificacoes
com rollback; concorrencia usa transacoes confirmadas somente no banco descartado
para permitir visibilidade entre conexoes. Duas verificacoes de lembretes e dez
de discussao, incluindo edicao concorrente contra aprovacao antiga (40001),
denuncias simultaneas deduplicadas e quota consumida uma unica vez. Os 13 arquivos
de migracao anteriores permanecem identicos ao HEAD. Instalador de migracao e
manutencao nao foram executados no banco existente. HTTP apenas negativo e sem
mutacoes; nao equivale a fluxo positivo autenticado fim a fim com backend real.

A suite de discussao tambem verifica perda/retorno real de visibilidade de aba,
renovacao de sessao na rota de moderacao e F5; nao simula teclas fisicas Alt+Tab.
Nenhuma falha intermitente ou de subprocesso Windows ocorreu nesta rodada.
Resultados historicos abaixo permanecem identificados por prompt.

Auditoria final: 27 candidatos (15 modificados e 12 novos), staging vazio.
Sem alteracoes em dependencias, regras de leitura, autenticacao, consistencia,
transporte push ou nas 13 migracoes anteriores. Sem arquivos de ambiente, logs,
caches ou artefatos temporarios entre os candidatos; preferencias privadas e
credenciais locais nao foram incorporadas. Sem bloqueador identificado para
versionamento local; homologacao/producao continuam bloqueadas.

Moderacao exige supervisao humana; limites por conta nao substituem protecao
operacional contra abuso distribuido. Retencao depende da manutencao explicita,
nao agendada nesta rodada: pendentes/ocultos/rejeitados por 30 dias, denuncias
resolvidas por 30 dias e demais denuncias/auditoria por 90 dias. Aprovados ficam
ate remocao propria ou exclusao de conta/conteudo; tombstone pode permanecer.
Revisao legal especifica continua necessaria antes de abertura publica.
Web Push externo nao validado nem ativado; bundle acima de 500 kB permanece.
Nenhum staging, commit, envio externo, publicacao ou inicio da Etapa 22.3.5.



## Prompt 55 — contador preservado, textos e confirmação removidos

Os três textos foram removidos do formulário sem mensagem substituta. A indicação
do comentário próprio **Pendente de moderação** permanece, pois é um estado
funcional, não confirmação de envio. Título, subtítulo literal, contador e layout
dos Prompts 53/54 preservados. Não foram alterados endpoints, RLS, quotas, OWNER,
autenticação ou regras de leitura/push. Políticas nas páginas próprias intactas.

| Comando executado nesta rodada | Resultado |
| --- | --- |
| `npm.cmd run test:run -- src/components/DiscussionSection.test.tsx` | 13 aprovados |
| `npm.cmd run test:run` | 466 aprovados em 43 arquivos |
| `npm.cmd run build` | DEV aprovado; JS 540,66 kB, aviso >500 kB mantido |
| `npm.cmd run lint` | Aprovado sem avisos |
| Chromium `--reading-layout` | 54 aprovados |
| Chromium `--discussion` | 43 aprovados |
| Chromium `--reminders` | 28 aprovados na reexecução final |
| Chromium sem opção | 18 aprovados |
| Chromium `--appearance` | 88 aprovados |
| `git diff --check` | Aprovado |

Novo teste de interface verifica contador ao digitar/limpar, maxlength, exatos
1000 caracteres aceitos e 1001 programáticos bloqueados, sem chamada de save acima
do limite; envio válido mantém pendência e não cria role=status de sucesso.
Teste existente de envio foi ajustado para ausência dos três textos mantendo a
assertiva da RPC de save e estado pendente. Demais testes de edição, remoção,
reações, denúncia, conflito/frequência e autorização não foram enfraquecidos.

Total Chromium: **231 verificações aprovadas na reexecução final**. Backend,
sessões e confirmações de tempo são simulados; DOM, geometria, teclado/viewport e
clipboard são locais reais. O teste de SW usa CDP, sem provedor externo. Layout
continua em 690 px no desktop e sem overflow mobile nos três temas; counter e
limites são exercitados antes da submissão. OWNER aprova/rejeita/oculta nas filas.

Falha intermediária de Chromium: a checagem de mensagem SW local falhou em duas
tentativas. O mock de foco renovava sempre a sessão fictícia inicial, apesar da
troca de conta anterior, provocando limpeza do vínculo. Ajustado para renovar a
sessão fictícia atual (ou SIGNED_OUT quando ausente), sem mudar código de produção
ou retirar verificações. Suite de lembretes e demais modos repetidos e aprovados.
Não houve erro de subprocesso Windows nem teste ignorado.

SQL/RLS, HTTP e builds STAGING/PROD não repetidos nesta rodada de apresentação;
resultados dessas suítes abaixo são históricos. Sem operações em banco/dados,
envio externo, staging, commit, publicação ou implementação da Etapa 22.3.5.
Nenhuma aprovação manual nova informada. Candidatos: **27 (15 modificados/12 novos)**.

## Prompt 54 — comunicação da leitura, após Prompt 53

Somente JSX/textos/acessibilidade do progresso; coluna de leitura e CSS do Prompt
53 preservados. Retirados os textos solicitados do progresso/histórico e os três
parágrafos do bloco de compartilhamento, sem avisos substitutos. Subtítulo literal:
`Comente aqui o que você aprendeu e refletiu com essa devocional.` Nenhuma nova
frase de publicação/visibilidade foi adicionada. Política e documentação próprias
continuam contendo as regras; RLS, moderação e autenticação não foram alteradas.

Resultados efetivamente executados nesta rodada:

- Testes direcionados (`npm.cmd run test:run -- src/components/ReadingProgress.test.tsx src/components/ReaderLibrary.test.tsx src/components/DiscussionSection.test.tsx src/App.test.tsx`): **43 aprovados**.
- Execução completa `npm.cmd run test:run`: **465 aprovados em 43 arquivos**.
- `npm.cmd run build`: DEV aprovado; JS **540,97 kB**, aviso >500 kB mantido.
- `npm.cmd run lint`: aprovado sem avisos.
- Chromium `--reading-layout`: **54 aprovados**, incluindo todos os cenários de
  geometria/estados/temas do Prompt 53 e ausência dos textos, subtítulo exato,
  barra visual com 59999 ms e botão bloqueado, habilitação após confirmação de
  60000 ms e conclusão apenas por clique. Nome acessível da barra preservado.
- Chromium `--discussion`: **39**, `--reminders`: **28**, sem opção: **18**,
  `--appearance`: **88** aprovados. Total nesta rodada: **227 verificações**.
- `git diff --check`: aprovado. Sem staging, commit, publicação ou envio externo.

Testes de apresentação antigos passaram a verificar ausência dos textos e nome
acessível genérico da barra. Valores max/value, bloqueio em 59999, habilitação em
60000, persistência, histórico sem conclusão automática e proteção do conteúdo
continuam assertados. Regressões de compartilhamento mantêm validação do link e
dos handlers; o destino da notificação é testado sem exigir o aviso removido.
Não foi removido/enfraquecido teste de comportamento ou segurança.

DOM/viewport/clipboard/foco locais reais no Chromium; backend, sessões e tempos
confirmados são simulados na fronteira. Testes não provam entrega Web Push remota,
dispositivo físico ou conformidade legal. SQL/RLS, HTTP e builds STAGING/PROD não
foram repetidos: lógica de servidor, schema, permissões e ambiente não mudaram.
Não houve operação em dados existentes. Resultados de banco abaixo são históricos.
Nenhuma nova validação manual foi informada. Total de candidatos: **27**, sendo
**15 modificados e 12 novos**; manifesto atualizado em `discussion-local.md`.

## Prompt 53 — coluna de leitura e comentários mais limpos

Somente apresentação: os três blocos extensos foram retirados; aviso curto de
pendência e visibilidade autenticada permanece dentro do formulário e associado
à textarea. Política de privacidade e regras backend continuam intactas.
Uma única `.reading-column` controla largura/centro dos cartões; padding responsivo
é compartilhado. Ordem de conteúdo, pergunta opcional, progresso, compartilhar e
comentar preservada. Diagnóstico e capturas: [discussion-local.md](discussion-local.md).

Resultados realmente executados nesta rodada:

| Comando | Resultado |
| --- | --- |
| `npm.cmd run test:run -- src/components/DiscussionSection.test.tsx src/components/ReaderLibrary.test.tsx` | 33 aprovados |
| `npm.cmd run test:run` | 465 aprovados em 43 arquivos |
| `npm.cmd run build` | DEV aprovado; aviso de bundle >500 kB mantido |
| `npm.cmd run lint` | Aprovado, sem avisos |
| `node scripts/local-navigation-browser.mjs --reading-layout` | 44 aprovados |
| `node scripts/local-navigation-browser.mjs --discussion` | 39 aprovados |
| `node scripts/local-navigation-browser.mjs --reminders` | 28 aprovados |
| `node scripts/local-navigation-browser.mjs` | 18 aprovados |
| `node scripts/local-navigation-browser.mjs --appearance` | 88 aprovados |
| `git diff --check` | Aprovado |

As três regressões novas validam ausência literal dos três parágrafos, aviso
breve próximo ao envio com descrição acessível, contêiner/ordem comuns e ausência de cartão vazio quando não há pergunta. Teste
existente de aviso foi atualizado para a apresentação curta, mantendo envio e
estado pendente. Reações, edição/remoção, denúncia, moderação, HTML seguro e
conclusão de 60 segundos continuam exercitados, sem enfraquecer testes funcionais.

Reprodução automatizada antes da correção: a nova verificação Chromium de largura
falhou com 690 px no artigo contra 1085 px nos dois cartões finais. Após a correção,
versículo/pergunta/progresso/compartilhamento/reflexão medem 690 px, mesma esquerda
489,5 px no viewport desktop de 1440 px. Nenhuma imagem do responsável veio anexada;
diagnóstico baseado no código e medição do navegador.

Layout cobre desktop 1440 px/mobile 390 px nos três temas, padding consistente,
centralização, texto contínuo de 980 caracteres, username de 24 caracteres,
controles dentro da coluna, foco visível, contraste de texto e estados de
carregamento/vazio/erro. Seis screenshots sintéticos gerados em
`node_modules/.cache/selah-reading-layout`, ignorados pelo Git; desktop/mobile
claros foram inspecionados visualmente. Total Chromium desta rodada: **217**.
Todos usam backend/sessões fictícios; DOM, viewport e navegação são reais. Mensagens
SW da regressão são injetadas localmente, sem entrega externa. Firefox/Safari,
celulares físicos e leitores de tela não foram testados.

Build intermediário apontou tipagem Element/HTMLElement em uma asserção nova;
querySelector foi tipado corretamente e a repetição de build passou. Nenhuma
asserção removida para contornar a falha. Não houve falha de subprocesso Windows.
SQL/RLS, HTTP e bloqueios de build STAGING/PROD não foram repetidos neste ajuste
visual: nenhuma regra, migração, API, configuração de ambiente ou permissão mudou.
Resultados desses testes nas seções seguintes pertencem às rodadas anteriores.

Validação manual desta apresentação continua pendente. Lista final: **23 arquivos
candidatos, 11 modificados/12 novos**. Sem staging, commit ou publicação.

## Prompt 52 — Etapa 22.3.4: comentários, reações e moderação

Base `2a60697`, branch `feat/local-auth`, árvore limpa no início. Arquitetura,
matriz de permissões, retenção e checklist em [discussion-local.md](discussion-local.md).
Nenhuma aprovação manual nova informada. Testes abaixo não aprovam publicação,
conformidade legal ou operação com usuários reais/menores de idade.

Execuções desta rodada (separadas dos resultados históricos abaixo):

- `npm.cmd run test:run -- src/components/DiscussionSection.test.tsx`: **11 testes
  novos aprovados**, com Supabase simulado na fronteira, sem rede/SQL/credenciais.
  Reagir/trocar/remover, novo pendente, aviso de visibilidade, edição de aprovado,
  remoção confirmada, texto HTML escapado, denúncia, limite, rascunho/retry,
  resposta tardia após logout, RPC sem autoria e moderação exclusiva.
- `npm.cmd run test:run`: **462 testes aprovados em 43 arquivos** na execução
  final, após aviso de privacidade e implementação final. Os 451 anteriores também
  foram executados no primeiro ciclo.
- `node scripts/verify-local-reading-install.mjs`: **14 migrações, 386 verificações
  SQL/RLS** (55 de discussão + 331 anteriores) com rollback nas suítes principais;
  **2 verificações de concorrência de lembretes + 4 de discussão** aprovadas.
  PostgreSQL novo com rede desabilitada, sem volumes existentes, Auth DDL sem dados,
  fixtures fictícias e contêiner descartado. Teste de concorrência com duas conexões
  exige fixtures fictícias commitadas somente nesse contêiner; não no banco existente.
  Segundo escritor fica aguardando o lock por usuário; após commits há uma reação
  e um comentário principal, com retry idempotente da mesma intenção.
- `node scripts/local-navigation-browser.mjs --discussion`: **39 verificações
  Chromium aprovadas**. Backend/sessões simulados; DOM, navegação e teclado reais.
  Cobrem reações, pendência, troca de conta, aprovação/rejeição/ocultação, denúncia,
  histórico, F5, perda de OWNER, texto malicioso seguro, três temas, contraste de
  texto parcialmente automatizado, foco e viewport mobile para leitor e OWNER. Não são testes de
  dispositivo físico, leitor de tela ou autenticação HTTP positiva fim a fim.
- Regressões Chromium: `--reminders` **28**, sem opção **18**, `--appearance`
  **88** aprovadas. Total com discussão: **173**. Nenhuma entrega externa push;
  mensagens SW do teste de lembretes são injetadas localmente por CDP.
- `node scripts/local-discussion-readonly-http.mjs`: **13 verificações HTTP negativas
  locais aprovadas**, oito RPCs anônimas e cinco tabelas privadas; nenhuma mutação.
- `npm.cmd run build`: aprovado, JS **542,39 kB**, aviso >500 kB mantido.
- `npm.cmd run lint`: aprovado sem avisos na execução final.
- `npm.cmd run build:staging` e `npm.cmd run build:prod`: **bloqueados**, ambos
  exit 1 pelo contrato de ambiente (variáveis genéricas exclusivas de DEV).
- `git diff --check`: aprovado. Nenhum arquivo staged ou commit executado.

Instalação: `node scripts/apply-local-discussion-migration.mjs` aplicou apenas a
incremental `20261028000700` local após validação isolada, criando objetos novos;
sem backfill, alteração de usuários, leituras, memberships ou dados preexistentes.
Treze migrações anteriores comparadas byte a byte com `2a60697`, íntegras.
`local-discussion-maintenance.mjs --cleanup` **não foi executado** contra dados
existentes; a função foi testada só nas fixtures do PostgreSQL isolado.

Falhas intermediárias corrigidas: primeira execução de concorrência de discussão
falhou por referência de coluna na montagem do SELECT dblink; ajustada para fonte
lateral, seguida de repetição integral aprovada. Avisos de lint em cleanup de refs
foram corrigidos mantendo cancelamento de respostas antigas. Primeiro teste de
foco Chromium falhou sem interação de teclado prévia; após emular Tab e trazer a
janela ao foco, o foco visível foi confirmado. Nenhum teste removido/enfraquecido.

Cobertura SQL inclui: autoria/unicidade, valores/limites, estado pendente, ausência
de pendente alheio, aprovação OWNER e negação editorial, edição que sai do público,
versão stale rejeitada, denúncia idempotente/cap diário, quotas de edição e reação,
RLS/ACL bruto inclusive OWNER, remoção própria, limpeza de texto e preservação do
histórico de leitura por todas as suítes anteriores. Novos comentários não usam
VAPID nem worker push. Sem novas tabelas públicas, diretório de usuários ou ranking.

Limitações: moderação humana e manutenção precisam de operação definida; approved
persiste até remoção/conta/devocional, demais textos expiram na manutenção conforme
política. Não há filtro automático de contato/assédio nem sistema de emergência.
Bundle >500 kB, cobertura de contraste parcial e Firefox/Safari/dispositivos físicos
não testados. Sem aprovação de conformidade legal definitiva. Checklist manual de
leitor/OWNER segue pendente e está no documento técnico.

## Prompt 51 — auditoria final da Etapa 22.3.3

Branch `feat/local-auth`, HEAD `91c81d0`, 31 candidatos (11 modificados/20 novos),
sem staging. As doze migrações anteriores foram comparadas byte a byte com a base
e permanecem íntegras. Nenhum banco existente foi migrado ou alterado nesta auditoria.

Validação manual informada pelo responsável — transcrição literal, 15 aprovações:

CONFIGURAÇÕES — 8 APROVAÇÕES

1. Configurações → Lembretes aparece após login.
2. É possível escolher o horário e alterar configurações.
3. A permissão é solicitada somente após ação explícita.
4. Ativar e desativar lembretes do dispositivo funciona.
5. F5 e Alt+Tab preservam as configurações.
6. Permissão negada ou incompatibilidade são explicadas.
7. Interface funciona nos modos Claro e Escuro.
8. Configurações são legíveis em janela pequena ou celular.

COMPARTILHAMENTO E PRIVACIDADE — 7 APROVAÇÕES

9. Compartilhar aparece ao final do devocional antes da conclusão.
10. Copiar link funciona sem tokens ou informações privadas.
11. WhatsApp prepara compartilhamento sem envio automático.
12. Compartilhar permanece após conclusão válida de 60 segundos.
13. A interface informa que destinatários precisam fazer login.
14. Compartilhamento funciona em janela pequena e nos três temas.
15. Troca de conta não revela preferências privadas da conta anterior.

Estas aprovações são do responsável, não execuções manuais do agente; não aprovam
outros navegadores/dispositivos nem envio ou recebimento Web Push remoto. A entrega
real não está configurada nem validada. O escopo da preferência é separado:
ativação por conta e horário/assinatura por dispositivo, conforme a interface.

Resultados executados especificamente no Prompt 51 serão registrados abaixo;
as seções Prompt 50A/22.3.3 seguintes preservam o histórico de rodadas anteriores.

### Resultados realmente repetidos no Prompt 51

| Comando | Resultado desta rodada |
| --- | --- |
| `npm.cmd run test:run` | 451 testes aprovados em 42 arquivos; exit 0 |
| `npm.cmd run build` | DEV aprovado; JS 528,52 kB; aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos |
| `node scripts/local-navigation-browser.mjs --reminders` | 28 verificações aprovadas |
| `node scripts/local-navigation-browser.mjs` | 18 verificações aprovadas de calendário/Jornada/OWNER |
| `node scripts/local-navigation-browser.mjs --appearance` | 88 verificações aprovadas |
| `node scripts/verify-local-reading-install.mjs` | 13 migrações, 331 verificações SQL/RLS + 2 de concorrência aprovadas |
| `node scripts/local-reminders-readonly-http.mjs` | 4 rejeições HTTP anônimas aprovadas, sem mutações |
| `node scripts/local-community-readonly-http.mjs` | 8 verificações HTTP negativas aprovadas, sem mutações |
| `npm.cmd run build:staging` | Bloqueado, exit 1, pelo contrato de ambiente DEV |
| `npm.cmd run build:prod` | Bloqueado, exit 1, pelo contrato de ambiente DEV |
| `git diff --check` | Aprovado |

Total Chromium desta rodada: **134 verificações**. UI/backend/sessão são simulados;
navegação, foco/visibilidade por troca de abas, DOM e clipboard são locais reais.
No teste do SW, permissão e mensagem são injetadas por CDP, sem provedor push.
Web Share é validado na fronteira unitária simulada; WhatsApp é inspecionado como
link voluntário, sem navegação externa/envio de mensagem. Nenhuma aprovação de
entrega remota ou de dispositivos físicos é deduzida desses resultados.

PostgreSQL é novo/temporário, sem rede ou volumes existentes. Reutiliza somente
DDL Auth e imagem local; dados são fictícios. As 331 verificações incluem 43 de
lembretes e 288 regressivas, encerradas em rollback. As duas de concorrência usam
conexões/transações sobrepostas e fixture fictícia commitada **somente no contêiner
descartável**, necessário para visibilidade entre conexões. O contêiner desta
execução foi descartado, sem alterar o banco ou volumes existentes.

Não houve testes reprovados nem encerramento intermitente de subprocessos Windows
nesta rodada. O incidente Windows `3221226505` do Prompt 50A é histórico, com causa
não determinada e repetição posterior aprovada. Testes não foram enfraquecidos.

Revisão de arquivos: todos os 31 candidatos inspecionados. `package-lock.json`
adiciona 17 pacotes para `web-push` 3.6.7; entradas preexistentes de dependências
permanecem iguais (somente o manifesto raiz recebe a dependência). Sem arquivo
de ambiente/credencial/cookie/log/cache/artefato temporário entre candidatos.
Arquivos `.env` foram inventariados por nome, sem ler seu conteúdo; somente
`.env.example` já é rastreado e não mudou. Chave privada VAPID ausente dos fontes
frontend e do bundle DEV. Nenhum candidato ignorado nem arquivo fora do escopo.

Limites mantidos: entrega real não configurada/validada, worker precisa permanecer
ativo, matriz de navegadores/dispositivos incompleta, localhost sem acesso público,
endpoint/chaves sensíveis protegidos por ACL/RLS mas sem nova criptografia de
volume, limpeza/retenção dependentes do worker, possível perda de credencial com
storage apagado e bundle >500 kB. Prova criptografada de inscrição real foi revisada
no código, sem validação fim a fim com provedor. Sem bloqueador técnico identificado
para o commit **local com envio externo bloqueado**; essas pendências impedem
declarar a operação externa pronta. Nenhum ciclo do worker ou migração foi executado
contra os dados existentes nesta auditoria.

## Prompt 50A — compartilhamento visível no fim da leitura

Relato real: ação ausente ao abrir devocional normalmente. Causa: componente
condicionado ao sufixo `/compartilhar` e posicionado antes do artigo. Correção:
uma única seção após o conteúdo/progresso em toda leitura publicada autorizada,
com botão Compartilhar sempre presente, Web Share se disponível e fallback de
cópia. Timer/conclusão, banco, RLS e permissões não foram alterados.

Execuções desta correção:

- Testes direcionados `npm.cmd run test:run -- src/components/ReaderLibrary.test.tsx src/notifications/reminders.test.tsx`:
  **37 aprovados**. Cinco regressões novas cobrem visibilidade em duas publicações,
  bloqueio a zero segundos, compartilhamento sem conclusão automática, conclusão
  voluntária aos 60000 ms, destino da notificação/link normal, conteúdo ausente e
  ausência de autenticação. Cobertura existente verifica Web Share/cópia voluntários.
- `npm.cmd run build`: aprovado; JS **528,52 kB**, aviso >500 kB mantido.
- `npm.cmd run lint`: aprovado sem avisos.
- `node scripts/local-navigation-browser.mjs --reminders`: **28 aprovados**.
  Integração simulada; clipboard local real com permissão/gesto emulados por CDP,
  link WhatsApp inspecionado sem abrir/enviar, leitura antes/depois da conclusão,
  localização após artigo, três temas, mobile, navegação, conteúdo indisponível e
  isolamento. Nenhuma notificação externa enviada.
- Primeira suíte completa: 450 aprovados/1 falhou em subprocesso de
  `localEnvironment.test.ts`, que retornou Windows `3221226505` em vez de rejeição
  controlada `1`. Nenhum teste foi removido ou flexibilizado; repetição integral
  sem Chromium simultâneo: **451 testes aprovados em 42 arquivos**. A causa do
  encerramento intermediário do processo Windows não foi determinada.
- Tentativas intermediárias Chromium detectaram limitações do harness: alvo de
  inicialização ausente, permissão/gesto para clipboard, mock de start_reading e
  retorno DOM não serializável via CDP. Reexecução final passou os 28 cenários.
- `git diff --check`: aprovado. SQL/HTTP não repetidos: nenhuma mudança de banco,
  agendador ou autorização nesta correção. Resultados anteriores abaixo são históricos.

Validação manual nova pendente: abrir publicação pelo fluxo normal, rolar até o
fim e testar Compartilhar/Copiar/WhatsApp antes e depois de concluir; conferir
aviso de autenticação/localhost, teclado, celular e Claro/Escuro/Sistema.
Não houve aprovação manual informada para este Prompt. Sem staging/commit.

## Etapa 22.3.3 — notificações inteligentes, base 91c81d0

Somente ambiente local. Implementação e checklist manual em
[smart-reminders-local.md](smart-reminders-local.md). Resultados abaixo são desta
rodada; aprovações humanas anteriores de aparência/Jornada não aprovam push.
Nenhuma aprovação manual nova foi informada para notificações.

Execuções confirmadas nesta rodada:

- `npm.cmd run test:run`: **446 testes aprovados em 42 arquivos** na execução
  final (execuções intermediárias anteriores: 440 e 443).
  As integrações React usam fronteira Supabase simulada, sem cliente real/rede/SQL.
- `npm.cmd run build`: DEV aprovado; bundle JS 528,23 kB (aviso >500 kB).
- `npm.cmd run lint`: aprovado sem avisos na última execução.
- `node scripts/verify-local-reading-install.mjs`: **13 migrações, 331 verificações
  SQL com rollback + 2 verificações de transações sobrepostas** em PostgreSQL NOVO,
  sem rede/portas/volumes existentes, depois descartado. Dessas 331, 43 são de
  lembretes, além das 288 anteriores. Fixture legada preservada.
  Concorrência usa duas conexões com uma reserva ainda bloqueada: segunda ignora
  dispositivo; após commit só existe uma reserva. Somente nesse contêiner temporário
  há fixtures fictícias commitadas para visibilidade entre conexões; não no banco
  existente. A suíte comum e a de lembretes encerram com rollback.
- `node scripts/local-reminders-readonly-http.mjs`: **4 rejeições HTTP reais locais**
  para RPCs anônimas; distingue rejeição 42501 de RPC inexistente; sem mutações.
- `node scripts/local-community-readonly-http.mjs`: **8 verificações HTTP locais**
  de regressão OWNER, consistência pessoal, tabelas privadas e bearer inválido,
  todas aprovadas sem mutações. Total HTTP negativo desta rodada: **12**.
- `node scripts/local-reminder-worker.mjs --once`: processo real em **simulação**,
  zero elegíveis/zero intenções nessa execução. Cenários A/B com destinatários são
  validados por SQL isolado e adaptador falso, não por envio externo.
- `node scripts/local-navigation-browser.mjs --reminders`: **17 verificações**
  Chromium headless. Preferência/foco/F5/troca de conta/tema/mobile/compartilhamento
  usam backend simulado. Três verificações finais executam SW/IDB/Notifications API
  locais reais com permissão emulada e mensagem injetada por CDP: exibe aviso,
  limpa notificação ao remover vínculo e descarta mensagem antiga sem vínculo.
  Isso **não confirma entrega por provedor Web Push** nem gesto de permissão real.
- `node scripts/local-navigation-browser.mjs`: **18 verificações** de regressão
  calendário/Jornada/OWNER; foco/visibilidade por alternância real de abas Chromium
  e renovação simulada da sessão, sem provar Alt+Tab físico no Windows.
- `node scripts/local-navigation-browser.mjs --appearance`: **88 verificações**,
  regressão Claro/Escuro/Sistema, refresh, login/logout, teclado, responsividade,
  redução de movimento e contraste de texto parcialmente automatizado.
- `npm.cmd run build:staging` e `npm.cmd run build:prod`: ambos **bloqueados** com
  exit 1 pelo contrato de ambiente (variáveis genéricas exclusivas de DEV).
- `git diff --check`: aprovado. Sem arquivos staged, commit ou publicação.

Cobertura nova: decisão servidor antes do transporte (inclui conclusão entre
reserva e envio), nunca converter aberturas em conclusão, deduplicação após
conclusão e resultado incerto, publicação ausente/rascunho, opt-out, permissão
negada, revogação/expiração/sessão encerrada, dados próprios por RLS/RPC, OWNER e
editorial sem acesso a inscrições, relógio controlável, DST e dias diferentes
de Brasília, supressão após indisponibilidade/meia-noite, storage corrompido ou
bloqueado, assinatura sem opt-in automático, respostas antigas entre contas,
links internos sem dados privados, clipboard e WhatsApp voluntários.

Falhas intermediárias corrigidas: concorrência inicialmente não pôde conectar
com dblink sem senha sob papel não superuser; o bootstrap **apenas temporário**
concede `dblink_connect_u` ao operador isolado. Reexecução completa passou.
A aplicação local inicialmente foi recusada pelo sandbox; após aprovação de
execução local, migração incremental aplicada e HTTP negativo confirmado.
Não houve reset, ajuste de ACL do banco existente para dblink nem mudança de
migrações anteriores. Instalação de `web-push`: npm reportou zero vulnerabilidades.

Limites: entrega real, VAPID com provedor, inscrição nativa criptografada/prova
fim a fim, Firefox/Safari, Android/iOS e dispositivos físicos não foram validados.
Não há serviço supervisor do Windows/cron de produção instalado. Estado de aceite
não comprova recebimento. Foco e contraste não substituem revisão humana ou leitor
de tela. Volume Docker não ganha criptografia em repouso; retenção depende do
worker ativo. Nenhuma chave privada VAPID foi gerada ou exposta no frontend.

## Etapa 22.3.2 — Prompt 48: auditoria definitiva e preparação de commit

Branch `feat/local-auth`, HEAD `195a9b5`. Mesmos **17 candidatos: nove modificados
e oito novos**; nenhum candidato extra identificado em relação à lista final do
Prompt 47. Esta conferência preserva código/testes/estilos; atualiza documentação.
Sem staging, commit, push ou deploy.

Validação manual informada pelo responsável — **11/11 aprovados**, exatamente:

1. Claro, Escuro e Sistema funcionam antes do login.
2. Todas as telas mudam corretamente entre Claro e Escuro.
3. Modo Sistema acompanha a aparência configurada no Windows.
4. Uma escolha explícita prevalece sobre o tema do Windows.
5. F5 mantém a preferência e não provoca flash perceptível.
6. Login, logout e Alt+Tab não alteram o tema selecionado.
7. Formulários, tabelas, mensagens de erro e carregamento estão legíveis.
8. Foco por teclado, botões e estados desabilitados permanecem visíveis.
9. Redução de movimento é respeitada quando ativada no dispositivo.
10. A interface funciona em uma janela pequena ou celular.
11. Minha Jornada preserva a navegação e o mês escolhido.

Esse registro não aprova cenários adicionais nem representa teste manual feito
pelo agente. Não houve evidência de Firefox/Safari, leitor de tela ou aparelho
físico identificado; o item 10 não autoriza inferir qual dispositivo foi usado.

| Comando realmente repetido agora, no Prompt 48 | Resultado |
| --- | --- |
| `npm.cmd run test:run` | **418 aprovados em 39 arquivos**, sem falhas/omitidos |
| `npm.cmd run build` | DEV aprovado; JS 516,31 kB, gzip 146,81 kB; CSS 30,40 kB; aviso de bundle acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/local-navigation-browser.mjs --appearance` | **88 verificações aprovadas**, Supabase fictício; três modos, mídia, preferência/refresh, foco, telas, contraste, editor/OWNER, mobile emulado, erros/hover/disabled e storage negado |
| `node scripts/local-navigation-browser.mjs` | **18 verificações aprovadas** de regressão 22.2/22.3.1, Supabase fictício; navegação, meses, foco/visibilidade, sessão, refresh e bloqueio OWNER |
| `npm.cmd run build:staging` | Recusado, código 1: variáveis genéricas Supabase DEV não podem configurar STAGING/PROD |
| `npm.cmd run build:prod` | Recusado, código 1, mesma proteção |
| `git diff --check` | Aprovado após documentação final; somente avisos LF/CRLF do Git no Windows |

Os números são novas execuções dos casos existentes, não casos novos nem soma
com o Prompt 47. A execução dirigida dos 20 testes de aparência da rodada anterior
não foi repetida separadamente: os mesmos casos passaram dentro dos 418 agora.
Os resultados anteriores abaixo ficam como histórico, sem atribuição à rodada atual.

SQL/RLS **não repetidos**: as 12 migrações e os arquivos de Auth, leitura de 60s,
RPCs/métricas, RLS, permissões e ambientes estão preservados em relação à base.
Não há alteração nem indício de regressão de banco/autorização que justifique
acesso aos serviços. Não houve HTTP backend, sessão pessoal inspecionada, login
real, nova conclusão real ou alteração de usuários/dados nesta auditoria.
As regressões sem rede pertinentes permanecem na suíte completa.

Limites: Chromium usa preferência do sistema emulada e backend fictício; não
substitui Windows nativo/Alt+Tab informado na validação humana. Teste pré-React
confere paleta já aplicada com main retido, não todos os cenários de cache/rede.
Contraste automatizado cobre tokens e textos/estados observados, não todos os
pixels, dados, fontes, controles nativos ou acessibilidade integral. Select/progress
podem variar por OS. Firefox/Safari/dispositivos físicos não foram testados pelo
agente. O bundle segue acima de 500 kB, sem publicar ou liberar outros ambientes.

Auditoria arquivo a arquivo, riscos e comandos CMD exatos em
[appearance-local.md](appearance-local.md). Bootstrap não usa eval, Function,
innerHTML, document.write, interpolação HTML ou rede: só enum estrito em
dataset/color-scheme/storage. O new Function no setup de testes executa apenas
o arquivo local confiável do bootstrap, nunca conteúdo do storage. Nenhum
segredo/cookie/log/cache/env/dado pessoal real identificado nos candidatos;
arquivos de credenciais não foram abertos. A varredura por padrões não prova
ausência universal de segredos. Nenhuma implementação de push iniciada.

## Etapa 22.3.2 — Prompt 47: Claro, Escuro e Sistema

Base `195a9b5`, branch `feat/local-auth`, árvore limpa no início. Implementação
somente de aparência. Diagnóstico/tokens/store/limites/checklist em
[appearance-local.md](appearance-local.md). À época do Prompt 47 nenhuma aprovação
humana de aparência havia sido informada; o registro específico de onze aprovações
do Prompt 48 está acima. Aprovações 22.3.1/22.2 abaixo permanecem históricas.

Novos testes executam `public/appearance.js` real: 15 casos de bootstrap/store
(ausência, dois explícitos, Sistema/mídia ao vivo, reload, cinco inválidos,
storage negado/cheio, sem mídia, sincronização entre abas, assinaturas/cleanup e
listener legado), dois casos de contraste da paleta e três de seletor React
(teclado/estado, rota/mês/sessão/login/logout e aviso de persistência negada).
O setup simula matchMedia e inicializa o mesmo bootstrap; Supabase continua
simulado na fronteira, sem cliente real ou serviço dentro do Vitest.

| Comando executado | Resultado nesta rodada |
| --- | --- |
| `npm.cmd run test:run -- src/appearance/bootstrap.test.ts src/appearance/contrast.test.ts src/components/AppearanceControl.test.tsx` | 20 testes novos aprovados |
| `npm.cmd run test:run` | **418 aprovados em 39 arquivos**, sem falhas/omitidos, inclusive na execução final; 398 anteriores mais 20 novos |
| `npm.cmd run build` | DEV aprovado; JS 516,31 kB, gzip 146,81 kB; aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros na rodada final |
| `node scripts/local-navigation-browser.mjs --appearance` | **88 verificações aprovadas no código final**, integração Supabase simulada |
| `node scripts/local-navigation-browser.mjs` | 18 regressões 22.2/22.3.1 aprovadas, Supabase simulado |
| `npm.cmd run build:staging` / `npm.cmd run build:prod` | Ambos recusados, código 1: variáveis genéricas Supabase DEV não configuram STAGING/PROD; sem acesso remoto |
| `git diff --check` | Aprovado após fechamento documental; somente avisos LF/CRLF do Git no Windows |

Chromium de aparência: módulo main retido enquanto paleta escura e color-scheme
já estão aplicados antes do React; três modos, alterações de mídia em tempo real,
refresh, logout/login fictícios, opção por teclado/foco visível. Doze rotas em
Claro/Escuro: Início, biblioteca, leitura/progresso, Minhas aberturas, Jornada,
admin/comunidade, perfil, privacidade, login, cadastro, recuperar senha e bloqueio
de link de nova senha sem recuperação válida. Cinco dessas rotas também a 390px.
Inclui editor aberto e tabela comunitária preenchida. Verifica texto renderizado/contraste, formulário inválido, hover sem animação de
cor, disabled sintético, redução de movimento e storage ausente/corrupto/negado.
Capturas desktop/mobile fictícias em cache ignorado foram inspecionadas.

Regressão detectada no Chromium antes da correção: transição de background do
botão do hero gerava 2,37:1 de contraste durante a troca de paleta. Removida
transição de cor; o teste de contraste imediatamente após alternância e o de
hover sem transição passam. Não foram reduzidos os limiares nem removidos casos.

Tentativas intermediárias: três suítes novas não iniciaram ao resolver caminho
de leitura do bootstrap por import.meta.url sob jsdom (URL http). Usar caminho
estático local corrigiu; 20 passaram. Lint inicialmente avisou quatro parâmetros
catch não usados; substituídos por catch sem binding. Foco no Chromium exigiu
modalidade de teclado real, e hover exigiu scroll do botão para viewport; o roteiro
foi corrigido. Nova senha sem recovery foi testada como bloqueio, preservando Auth.
Uma repetição final evidenciou corrida do roteiro após reload: a condição podia
encontrar seletor do documento antigo. O helper agora exige novo performance.timeOrigin
e montagem do seletor antes de prosseguir; a rodada final passou os 88 casos.
Essas tentativas não são aprovação de casos não executados.

SQL/RLS/HTTP backend **não repetidos por ausência de razão técnica**: sem mudanças
em migrations, Auth, RLS, RPCs, repositórios, leitura de 60s, dados ou permissões.
Não houve usuário criado, dado de leitura alterado ou sessão pessoal inspecionada.
Casos anteriores sem rede de autenticação/leitura/OWNER e Jornada permanecem na
suíte completa. Chromium usa módulo fictício, não integrações Auth reais; sua
leitura concluída é resposta simulada, não nova conclusão de 60s no banco.

Limites: contraste de tokens/texto observado não é auditoria WCAG completa; select
e progress nativos variam por OS. Sem inspeção de todos os estados de dados,
leitor de tela, Firefox/Safari ou aparelho real. Checklist humano pendente naquela rodada, sem
aproveitar as oito aprovações de Jornada como aprovação de aparência. Build local
não publica; STAGING/PROD não foram liberados. Sem git add/commit/push/deploy.

## Etapa 22.3.1 — Prompt 46: auditoria final para commit

Branch `feat/local-auth`, HEAD/base `42e6070`. **10 candidatos: sete modificados
e três novos**. Nenhum staging/commit. Código, testes e script Chromium da
implementação preservados nesta auditoria; atualização apenas documental.

Validação manual realizada pelo responsável — **8/8 aprovados**, exatamente:

1. Minha Jornada abre pelo menu e exibe os dados da conta.
2. Ofensiva, recorde e dias concluídos correspondem ao desempenho pessoal.
3. É possível navegar pelos meses e consultar o histórico diário.
4. Alt+Tab preserva a tela e o mês selecionado.
5. F5 mantém Minha Jornada aberta e retorna ao mês atual.
6. A interface funciona em uma janela pequena ou celular.
7. Uma leitura concluída validamente atualiza o desempenho.
8. Uma conta diferente não consegue visualizar os dados de outra conta.

Não são testes manuais refeitos pelo agente. Nenhuma aprovação foi atribuída aos
outros itens do checklist (offline, recuperação, zoom etc.) ou a recursos futuros.

| Comando realmente repetido no Prompt 46 | Resultado |
| --- | --- |
| `npm.cmd run test:run` | **398 aprovados em 36 arquivos**, sem falhas/omitidos |
| `npm.cmd run build` | DEV aprovado; JS 515,64 kB, gzip 146,59 kB; aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/local-navigation-browser.mjs` | **18 Chromium aprovadas**, integração Supabase simulada; calendário, Jornada, foco/visibilidade, sessão, refresh, mobile e bloqueio OWNER |
| `node scripts/verify-local-reading-install.mjs` | **12 migrações e 288 SQL/RLS** aprovadas em PostgreSQL novo isolado; rollback nas suítes; contêiner temporário encerrado |
| `node scripts/local-community-readonly-http.mjs` | **8 HTTP locais negativos** aprovados; sem login, fixture ou mutação |
| `npm.cmd run build:staging` | Recusado, código 1: variáveis genéricas DEV não podem configurar STAGING/PROD |
| `npm.cmd run build:prod` | Recusado, código 1, mesma proteção |
| `git diff --check` | Aprovado após atualização documental final; somente avisos LF/CRLF do Git no Windows |

Os onze casos de `JourneyPage.test.tsx` foram repetidos dentro da suíte completa,
incluindo anon/loading, leitor sem editorial, resumo/histórico, vazio, teclado,
foco/renovação, reload, erro/retry, logout com resposta atrasada, troca de conta e
recuperação. Regressões do calendário/administração 22.2 e leitura de 60s também
permanecem na suíte. SQL inclui 50 consistência, 59 leitura, 29 OWNER e 13
auditoria: isolamento/permissões exercitados em fixtures transacionais isoladas.

Limitações: Chromium usa respostas fictícias, não login HTTP positivo nem sessão
pessoal. Troca de abas simula foco; Alt+Tab nativo é a aprovação humana acima.
HTTP repetido cobre negações, não login ou conclusão real de 60s nesta rodada.
Os oito cenários humanos não aprovam o checklist inteiro. Nenhuma infraestrutura
de tema/push/moderação/conquistas foi ativada. SQL isolado copia DDL Auth, não
registros ou segredos. Não houve ensaio que cria histórico durável na stack
existente, promoção/revogação OWNER, reset ou migração nessa stack.

Consulta adicional `docker ps -a --filter "name=supabase_edge_runtime_devocionais-app"`
confirmou Edge Runtime local em execução; isso não é teste de login. A tentativa
restrita de consultar Docker foi negada por permissão; repetida com autorização
local, sem iniciar/parar contêiner ou inspecionar credenciais. Estado parado
observado antes do Prompt 46 não foi presumido como estado atual.

Revisão integral dos dez candidatos e comparação das 12 migrações da base
(normalizando apenas CRLF/LF): nenhuma migração alterada. Sem mudanças em Auth,
leitura, RPC pessoal ou permissões. Nenhum caminho/assinatura de segredo, token,
cookie, log, ambiente ou artefato temporário identificado entre os candidatos;
arquivos de credenciais não foram abertos. Cache de relatórios/capturas e build
ignorados pelo Git; varredura por assinaturas não prova ausência universal de
dados sensíveis. Riscos: bundle grande, privacidade/retenção antes de uso público
e fixtures locais que não representam engajamento real.

Roadmap definitivo e revisão arquivo a arquivo em
[journey-roadmap.md](journey-roadmap.md): 22.3.1 entregue; 22.3.2 Modo Noturno é
próximo, sem implementação; 22.3.3 Push, 22.3.4 Comentários/Reações e 22.3.5
Conquistas/Desafios planejados. STAGING/PROD continuam bloqueados. Sem bloqueador
técnico identificado para commit local, condicionado à conferência final do diff.

## Etapa 22.3.1 — Prompt 44: Minha Jornada

Base `42e6070`, branch `feat/local-auth`, árvore limpa no início. Rota autenticada
`#minha-jornada`; reutilização do calendário/RPC pessoal e projeção mensal da mesma
resposta. Sem migrações, novos contadores, permissões OWNER ou alterações no
protocolo de conclusão 22.1. Roadmap completo e checklist humano em
[journey-roadmap.md](journey-roadmap.md); demais subetapas somente planejadas.

Novo `JourneyPage.test.tsx`: 11 comportamentos com cliente Supabase simulado na
fronteira: anon/loading, leitor sem editorial, resumo de dois dias/três textos,
vazio, navegação mouse/Enter e foco/renovação, remontagem/reload, erro/retry,
logout com resposta atrasada, troca de conta e recuperação. Nenhum ID do leitor
vai na consulta e não há leitura de acervo/ledger ou RPC OWNER na nova página.
Casos existentes de cliques agrupados e respostas fora de ordem continuam no
componente reutilizado, sem duplicar a implementação.

| Comando realmente executado | Resultado nesta rodada |
| --- | --- |
| `npm.cmd run test:run -- src/components/JourneyPage.test.tsx src/components/ConsistencySection.test.tsx src/components/AdminPanel.test.tsx` | 35 aprovados nos três arquivos |
| `npm.cmd run test:run` | **398 aprovados em 36 arquivos**, sem falhas/omitidos; 387 anteriores mais 11 novos |
| `npm.cmd run build` | DEV aprovado; JS 515,64 kB, gzip 146,59 kB; aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros, inclusive após últimos ajustes do script Chromium |
| `node scripts/verify-local-reading-install.mjs` | 12 migrações e 288 SQL/RLS aprovadas em PostgreSQL novo isolado; rollback nas suítes; contêiner temporário encerrado |
| `node scripts/local-community-readonly-http.mjs` | 8 verificações HTTP locais negativas aprovadas, sem login/fixtures/mutação |
| `node scripts/local-navigation-browser.mjs` | Primeira rodada ampliada: 17 aprovadas; segunda rodada com histórico preenchido: 18 verificações Chromium aprovadas, integração Supabase simulada |
| `npm.cmd run build:staging` / `npm.cmd run build:prod` | Ambos recusados, código 1: variáveis genéricas DEV não podem configurar STAGING/PROD; sem acesso remoto |
| `git diff --check` | Aprovado; somente avisos LF/CRLF do Git no Windows |

SQL reutilizado porque a página consome a mesma RPC/RLS sem alteração de schema:
50 casos de consistência dentro dos 288 incluem isolamento por conta e o papel
editorial; 29 OWNER mantêm negação a leitores/editorial. A base existente foi
consultada somente para DDL/metadados pelo verificador; não houve novo histórico,
aplicação de migração, grant/revoke ou alteração/exclusão de dados preexistentes.

Chromium utiliza perfil novo, módulo Supabase sintético e bloqueio de destinos
fora do frontend loopback. Os dez cenários 22.2 continuam e oito verificam Jornada:
menu ativo, vazio, movimento conjunto calendário/histórico, perda real de
visibilidade por troca de aba, retorno/foco mais sessão, reload, histórico com
dois dias/três textos e 390px sem overflow. Capturas desktop/mobile fictícias
ficam no cache ignorado, inspecionadas visualmente. Não é login HTTP positivo,
Alt+Tab nativo ou uso de sessão pessoal. A pendência manual do Prompt 44 foi
encerrada apenas para os oito cenários informados no Prompt 46; as aprovações
22.2 permanecem históricas.

Não há pedido de permissão push, registro de service worker, formulário de
comentário/reação, distintivos ou desafios. O modo falso de transporte e o modelo
de moderação/conquistas constam somente do planejamento. Limites: evolução mensal,
F5 volta ao mês atual, dia civil Brasília, bundle grande e retenção/privacidade
pendentes antes de uso público. Nenhum staging/commit ou acesso Supabase hospedado.

## Etapa 22.2 — Prompt 43: conferência final

Branch `feat/local-auth`, HEAD/base `31cb42d`. **58 arquivos candidatos: 17
modificados e 41 novos**, incluindo os cinco arquivos individuais de
`src/consistency`. Nenhum staging/commit. Esta rodada altera somente documentação
versionável; código, testes e migrações candidatos preservados.

Validação manual comunicada pelo responsável nesta sessão: **4/4 aprovados**:

1. Calendário pessoal avança e retrocede vários meses.
2. O mês selecionado permanece estável durante atualizações assíncronas.
3. Alt+Tab não fecha a seção Comunidade e Ofensivas.
4. F5 preserva a seção Comunidade e Ofensivas.

São aprovações humanas, não casos executados pelo agente. Encerram a pendência
manual das duas correções do Prompt 42. Não atribuímos aprovação a outros cenários.

| Comando realmente repetido no Prompt 43 | Resultado |
| --- | --- |
| `npm.cmd run test:run` | **387 aprovados em 35 arquivos**, sem falhas/omitidos |
| `npm.cmd run build` | DEV aprovado; JS 513,07 kB, gzip 146,04 kB; aviso acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `npm.cmd run build:staging` | Recusado, código 1: variáveis genéricas Supabase DEV não configuram STAGING/PROD |
| `npm.cmd run build:prod` | Recusado, código 1, mesma proteção |
| `node scripts/provision-local-owner.mjs --check-local` | Preflight aprovado; nenhuma conta inspecionada ou permissão concedida |
| `node scripts/local-community-readonly-http.mjs` | **8 HTTP locais negativos** aprovados; sem login, leitura de token ou mutação |
| `node scripts/verify-local-reading-install.mjs` | **12 migrações e 288 SQL/RLS** aprovadas em PostgreSQL novo isolado; rollback nas suítes; contêiner temporário encerrado |
| `node scripts/audit-local-community.mjs` | READ ONLY/REPEATABLE READ/ROLLBACK aprovado: 192 contas, 15 com conclusão hoje; OWNER único auditado/ativo; RPC igual à candidata |
| `git diff --check` | Aprovado após atualização documental; somente avisos LF/CRLF do Git no Windows |

A auditoria agregada teve uma primeira execução restrita recusada/falha, sem
diagnóstico sensível. A repetição com permissão de execução local passou; não se
atribuem resultados à tentativa inicial. Os testes SQL incluem 29 OWNER e 13
auditoria do provisionador, com negação a editorial sem OWNER (fronteira atual do
PUBLISHER futuro), leitor, anon e metadados forjados. A stack existente foi apenas
consultada; não teve migração, promoção/revogação ou novos históricos sintéticos.

**Não repetidos nesta rodada:** as 10 verificações Chromium com integração
simulada, cujo resultado é histórico do Prompt 42; HTTP positivo de sessão OWNER;
provisionamento mutável e integrações que exigem OWNER vazio ou criam fixtures
persistentes. As quatro validações manuais não foram refeitas pelo agente.

As nove migrações da base foram comparadas ao conteúdo Git (normalizando somente
CRLF/LF): nenhuma diferença. Os três incrementos novos e todos os candidatos
passaram pela revisão de caminhos/assinaturas sensíveis; nenhum `.env`, segredo,
cookie, log, cache ou artefato temporário identificado entre os 58. Não foram
lidos arquivos de credenciais. Varredura por assinaturas não é prova universal de
ausência de dados reais. Riscos de privacidade, retenção, dados sintéticos, tamanho
do bundle e limites de testes: [consistency-local.md](consistency-local.md).
Lista completa e comandos CMD agrupados: [owner-community-review.md](owner-community-review.md#versionamento-cmd--prompt-43).

## Etapa 22.2 — Prompt 42: regressões de navegação

As duas regressões novas falharam antes das correções: cliques com resposta mensal
pendente não chegavam ao segundo mês; comunidade não tinha rota persistente.
Depois, o Chromium identificou ainda o agrupamento de cliques no mesmo render,
corrigido com atualização funcional e coberto por terceiro teste React.
Os 23 casos dos dois arquivos afetados passaram na rodada intermediária; a suíte
completa intermediária passou 386 testes. Resultados finais abaixo substituem
essa evidência intermediária para o código final.

| Comando executado | Resultado final desta rodada |
| --- | --- |
| `npm.cmd run test:run` | **387 aprovados em 35 arquivos**, sem falhas/omitidos, no código final |
| `npm.cmd run build` | DEV aprovado; aviso de chunk acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/local-community-readonly-http.mjs` | 8 HTTP locais negativos aprovados; sem login/mutação |
| `node scripts/verify-local-reading-install.mjs` | 12 migrações e 288 SQL/RLS aprovadas em PostgreSQL novo isolado; rollback nas suítes |
| `node scripts/audit-local-community.mjs` | READ ONLY/ROLLBACK aprovado: 192/15; OWNER único auditado; projeção e RPC coerentes |
| `node scripts/local-navigation-browser.mjs` | 10 verificações Chromium aprovadas, integração Supabase simulada na fronteira |
| `npm.cmd run build:staging` | Recusado, código 1: variáveis genéricas DEV não podem configurar STAGING/PROD |
| `npm.cmd run build:prod` | Recusado, código 1, mesma proteção |
| `git diff --check` | Aprovado; avisos LF/CRLF do Git no Windows |

Chromium testa calendário atual, dois cliques rápidos com atraso, retorno de foco
por troca real de abas, Enter, reload para mês atual, bloqueio futuro, deep link
comunitário, foco mais renovação, refresh da seção e revogação OWNER simulada.
Não acessa banco nem sessão existente. Não representa Alt+Tab nativo nem HTTP
positivo do OWNER provisionado. O servidor Vite já estava em 5173; tentativa de
iniciar outro foi recusada por porta ocupada e não substituiu o servidor existente.
Os sete cenários aprovados pelo responsável e as duas falhas relatadas estão
registrados em [owner-community-review.md](owner-community-review.md), separados
dos testes automatizados. A pendência humana registrada nesta rodada foi encerrada
pelas quatro aprovações comunicadas no Prompt 43 acima.
Nenhum staging/commit ou operação remota executado.

## Etapa 22.2 — Prompt 41: revisão dos dados e layout OWNER

Branch `feat/local-auth`, HEAD `31cb42d`, 56 candidatos totais preservados.
Diagnóstico, limitações e roteiro em [owner-community-review.md](owner-community-review.md).
Nenhuma mudança persistente em dados, permissões, sessões ou migrações na stack
existente. Não houve limpeza; os totais permaneceram 192/15 e um OWNER.

| Comando executado nesta rodada | Resultado |
| --- | --- |
| `node scripts/provision-local-owner.mjs --check-local` | Aprovado, sem inspeção de contas ou concessão |
| `node scripts/audit-local-community.mjs` | Auditoria READ ONLY/REPEATABLE READ/ROLLBACK: 192 contas, 15 com conclusão hoje; duas assinaturas completas de fixture de 1005 dias; OWNER único auditado/ativo; RPC instalada igual à candidata; ordenação, desempates, repetição, busca, paginação e projeção mínima coerentes |
| `node scripts/local-community-readonly-http.mjs` | **8 verificações HTTP locais** aprovadas: anon negado em ranking, métricas próprias, membership, diário, conclusões e progresso; token inválido 401; parâmetro OWNER não concede acesso |
| `node scripts/verify-local-reading-install.mjs` | **12 migrações e 288 SQL/RLS** aprovadas em PostgreSQL novo isolado; suítes com rollback |
| `npm.cmd run test:run` | **384 aprovados em 35 arquivos**, sem omitidos, execução final |
| `npm.cmd run build` | DEV aprovado; aviso de bundle acima de 500 kB |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `git diff --check` | Aprovado; avisos LF/CRLF do Git no Windows |

As 288 SQL/RLS cobrem autorização, privacidade, username, WhatsApp, login, leitura,
consistência, OWNER e auditoria. O banco existente foi consultado apenas para
metadados/DDL e auditoria agregada, sem copiar contas ou credenciais. A execução
isolada preservou dados existentes e descartou somente seu contêiner temporário.
Não se executaram na stack atual os testes que exigem OWNER vazio; não se removeu
o OWNER legítimo para acomodá-los. Não houve novas fixtures persistidas na stack
atual, nem repetição de testes HTTP que acrescentariam outro histórico de 1005 dias.

A primeira rodada React passou 382 testes antes de acrescentar os dois testes
de recusa dos novos entrypoints. A rodada final passou 384, preservando toda a
cobertura anterior. Os fluxos React da comunidade (busca Enter, páginas, loading,
vazio/erro, conta zero, recorde e resposta atrasada) passaram após reorganizar os
elementos e aplicar estilos somente à seção. Não alteramos regras de ordenação,
busca/paginação, fórmulas ou permissões. Build e lint foram executados no código final.

Limites: a tentativa de conexão do navegador falhou e a descoberta foi vazia;
nenhuma captura ou inspeção da sessão autenticada foi realizada. A autorização
positiva do OWNER configurado foi exercitada por SQL em READ ONLY com claims de
transação e role authenticated, sem JWT criado ou token lido. Isso **não é** uma
validação HTTP positiva da sessão aberta. Oito HTTP são testes negativos, sem
login ou mutação. Perguntamos ao responsável se Atualizar ranking retorna HTTP
200; confirmação independente da sessão e revisão visual desktop/390px ficam
pendentes. Não houve Chromium ou builds STAGING/PROD nesta rodada.

O diagnóstico não classifica todas as contas como fictícias: 185 têm padrão de
gerador conhecido, sete permanecem sem classificação. Dos 148 usernames gerados,
147 têm evidência do gerador; um não. Não existe flag de proveniência confiável
para todos os registros, e não houve backfill, filtro ou exclusão por aparência.
Nenhum contato, UUID ou credencial foi emitido na auditoria ou no ranking.

## Etapa 22.2 — Prompt 40: provisionamento seguro do OWNER local

Branch `feat/local-auth`, HEAD/base `31cb42d`. Nenhuma conta preexistente escolhida
ou promovida. Procedimento, identidade, comandos CMD e limites em
[owner-local-provisioning.md](owner-local-provisioning.md). Nenhuma autorização
humana ou UUID do responsável foram presumidos. Os resultados do Prompt 39 abaixo
permanecem históricos, sem somá-los às execuções desta rodada.

| Comando executado | Resultado nesta rodada |
| --- | --- |
| `node scripts/provision-local-owner.mjs --check-local` | Aprovado, sem inspecionar contas nem conceder privilégios |
| `node scripts/apply-local-owner-audit-migration.mjs --check-local` | Aprovado |
| `node scripts/apply-local-owner-audit-migration.mjs` | Migração incremental 00500 aplicada somente localmente; apenas diário privado, sem promoção |
| `npm.cmd run test:run -- src/test/localOwnerTools.test.ts` | 24 testes aprovados na validação inicial, sem serviços externos |
| `npm.cmd run test:run -- src/components/AdminPanel.test.tsx` | 11 aprovados, diagnóstico isolado do timeout |
| `npm.cmd run test:run` | **382 aprovados em 35 arquivos**, sem omitidos, execução final |
| `npm.cmd run build` | DEV aprovado; aviso de bundle acima de 500 kB |
| `npm.cmd run lint` | Aprovado sem avisos na execução final |
| `node scripts/local-owner-provision-smoke.mjs` | **27 verificações CLI/API locais** aprovadas na execução completa final |
| `node scripts/run-local-owner-audit-sql.mjs` | **13 SQL/RLS** aprovadas com rollback |
| `node scripts/run-local-owner-sql.mjs` | **29 SQL/RLS** aprovadas com rollback |
| `node scripts/run-local-consistency-sql.mjs --regression` | **246 SQL/RLS** aprovadas, todas com rollback |
| `node scripts/verify-local-reading-install.mjs` | **12 migrações e 288 SQL/RLS** aprovadas em banco novo isolado, sem copiar contas/segredos |
| `git diff --check` | Aprovado; somente avisos LF/CRLF |

Os 288 SQL/RLS da stack atual são 246 + 29 + 13. Os mesmos 288 no banco novo são
uma segunda execução, sem contagem de novos casos. O verificador descartou somente
seu contêiner novo, sem rede/portas/volumes compartilhados, sem pull ou reset.

As 27 verificações de provisionamento incluem ações por subprocesso do CLI real
e chamadas HTTP autenticadas: inspecionar alvo exato sem promover; recusar UUID
inexistente, leitor comum, não confirmado, confirmação ausente/divergente; negar
editorial/leitor antes da concessão; conceder somente ao alvo confirmado; negar
segundo OWNER e revogação de alvo divergente; recusar transferência inelegível;
reverter mudança quando a referência de auditoria duplica; transferir e revogar
com o mesmo JWT antigo; preservar editorial; impedir acesso de cliente ao diário;
manter projeção mínima do ranking; persistir três transições auditadas; rejeitar
revogação repetida; concorrer duas concessões com um único vencedor e removê-lo
pelo CLI auditado. Todos os vínculos temporários foram removidos. Contas fictícias
e eventos privados de auditoria permanecem locais; nenhum dado preexistente apagado.

Testes sem rede acrescentam validação de argumentos e referências, revalidação
na fronteira SQL, ambiente sanitizado e subprocessos com destinos recusados. Todos
os modos do provisionador são testados contra Docker/URL remotos, proxies,
credenciais injetadas e configuração PROD. Nenhum desses testes chama serviços.

Tentativas intermediárias: preflights novos foram inicialmente recusados pela
execução restrita e passaram após aprovação para executar os comandos locais.
A primeira integração passou 25 verificações; a ampliação com concorrência passou
27, depois repetidas integralmente após ajustar a limpeza. Duas rodadas completas
Vitest tiveram 381 aprovados e timeout de 5s no mesmo teste de formulário editorial.
O arquivo isolado passou seus 11 testes. Com novos testes de subprocessos, a
concorrência automática pressionava CPU/memória; `vitest.config.ts` agora limita
a dois workers. A rodada final passou os 382, mantendo timeouts, assertions e
todos os casos. Um aviso de lint no tratamento de limpeza foi corrigido sem
suprimir a regra. Rodadas incompletas não são declaradas como aprovadas.

Consulta READ ONLY/ROLLBACK final confirmou **zero OWNER**, sem retornar UUIDs.
Não foram executados nesta rodada Chromium, STAGING/PROD ou suites HTTP gerais
de leitura/login/perfil: aplicativo/UI e protocolo de leitura não foram alterados.
As coberturas SQL correspondentes e a suíte React completa foram repetidas.
Pendente: confirmação humana do UUID exato, futura autorização de concessão,
validação manual pelo responsável e revisão para commit. Nenhum git add/commit.

## Etapa 22.2 — Prompt 39 (execuções desta sessão)

Branch `feat/local-auth`, base `31cb42d`. Alterações anteriores preservadas.
Roteiro completo, fórmula, universo de leitores, modelo de autorização e questões
de privacidade em [consistency-local.md](consistency-local.md). Política local
acessível por `#privacidade`, com links no cadastro e no perfil.

| Comando / categoria | Resultado |
| --- | --- |
| `npm.cmd run test:run` | **353 testes em 33 arquivos**, todos aprovados, sem omitidos |
| `npm.cmd run build` | DEV aprovado; aviso de chunk acima de 500 kB, sem publicação |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/run-local-consistency-sql.mjs --regression` | 246 SQL/RLS: 59 autorização, 16 privacidade, 18 username, 25 WhatsApp, 19 login, 59 leitura, 50 consistência; rollback em todas |
| `node scripts/run-local-owner-sql.mjs` | 29 SQL/RLS OWNER aprovadas com rollback |
| `node scripts/verify-local-reading-install.mjs` | Onze migrações em ordem e 275 SQL/RLS aprovadas em PostgreSQL NOVO isolado; fixtures revertidas, contêiner descartado |
| `node scripts/local-consistency-smoke.mjs` | 29 HTTP, conclusão após 60 s reais, calendário, recorde, legado e mais de mil dias |
| `node scripts/local-owner-smoke.mjs` | 13 HTTP, OWNER, editorial sem OWNER, reader/anon, falsificação, projeção mínima e paginação |
| `node scripts/local-reading-smoke.mjs` | 46 HTTP, inclusive 60 s reais e checkpoints/conclusões concorrentes |
| `node scripts/local-reading-sessions.mjs` | 19 HTTP, transferência, sessões distintas e legado |
| `node scripts/local-login-smoke.mjs` | 41 HTTP |
| `node scripts/local-whatsapp-smoke.mjs` | 40 HTTP |
| `node scripts/local-profile-smoke.mjs` | 29 HTTP |
| `node scripts/local-library-smoke.mjs` | 35 HTTP |
| `node scripts/local-admin-smoke.mjs` | 41 HTTP |
| `node scripts/local-privacy-smoke.mjs` | 30 HTTP |
| `node scripts/local-username-smoke.mjs` | 31 HTTP |
| `node scripts/local-auth-smoke.mjs` | 19 HTTP, inclusive recuperação de senha |
| `node scripts/local-reading-browser.mjs` | 35 Chromium aprovadas: calendário por Enter, pausa/retomada/recarga, 60 s reais, conclusão por teclado, persistência, OWNER, busca por teclado e viewport móvel |
| `npm.cmd run build:staging` / `build:prod` | Recusa esperada, código 1: configuração genérica exclusiva de DEV; destinos continuam bloqueados em código |
| `git diff --check` | Aprovado; avisos de normalização LF/CRLF no Windows |

São **373 verificações HTTP** nesta sessão, sem somar SQL, navegador ou rodadas
anteriores. Os 275 SQL na stack atual e 275 no banco isolado são execuções de
mesmos casos em bancos diferentes. A tabela não soma rodadas repetidas.

A regressão de foco já preparada no trabalho anterior agora passa: atualização ao
foco não desabilita a navegação mensal e resposta antiga não sobrescreve o mês.
Não alteramos o protocolo de conclusão. Fronteiras Supabase simuladas em React;
Vitest/build/lint não executam migrações/SQL ou serviços externos.

Novos testes de comunidade verificam loading/vazio/erro, busca Enter, paginação,
zero, recorde, resposta atrasada, projeção de campos e limites. SQL verifica
empates, classificações, universo, negações e ACL/RLS. Os testes de publisher
representam a fronteira editorial atual sem OWNER; PUBLISHER é futuro, sem nova
concessão editorial nesta etapa. Testes de política verificam transparência pública
sem RPC de ranking e somente um checkbox opcional (feedback) no cadastro.

Tentativas intermediárias: o primeiro Chromium parou antes do login com servidor
frontend/gateway indisponível. Depois de iniciar ambos, a rodada pessoal passou
29 verificações. Ao ampliar para OWNER, outra execução passou as mesmas 29 e
parou porque o roteiro não recarregava a sessão após grant; corrigiu-se o roteiro
para revalidar o acesso existente. A execução completa seguinte passou 35.
Uma tentativa de agrupar HTTP num subprocesso foi recusada pelo preflight antes
dos testes; todos os scripts da tabela foram depois executados individualmente.
Essas tentativas incompletas não foram contadas como suítes aprovadas.

As migrações 00300/00400 estão somente locais. Membership OWNER final confirmada
vazia por consulta READ ONLY/ROLLBACK; grants de fixtures removidos. Não houve
promoção de administrador preexistente. O banco retém fixtures fictícias dos
ensaios HTTP; somente fixtures explicitamente criadas pelas suítes podem ser
alteradas/removidas nelas. Nenhum dado preexistente foi apagado.

Imagens fictícias de desktop/celular foram revistas visualmente e permanecem
somente no cache ignorado do navegador isolado. Não houve leitor de tela físico,
teste de carga, celular físico, espera de uma virada de dia real ou avaliação
jurídica. Limites de meia-noite/fuso e DST foram exercitados por SQL e respostas
simuladas, sem mudar o relógio do servidor. Política/avisos finais têm testes React;
a execução Chromium cobre leitura/comunidade. STAGING/PROD não foram liberados.

## Encerramento da Etapa 22.1 — Prompt 37

Branch `feat/local-auth`, commit-base/HEAD `c2fb5b3`. O responsável informou
**12/12 cenários manuais aprovados**, separados das execuções do agente:

1. Devocional abre e exibe indicador de leitura.
2. Botão Concluir permanece bloqueado antes de 60 segundos.
3. Tempo avança durante leitura e pausa ao mudar de aba.
4. Contagem retoma corretamente após voltar.
5. Recarga preserva progresso confirmado.
6. Após 60 segundos, botão habilita sem concluir automaticamente.
7. Concluir registra persistência.
8. Reabertura mostra conclusão existente.
9. Logout/login preserva conclusão.
10. Interface funciona em tela pequena ou celular.
11. Conclusão acessível por teclado.
12. Outro usuário não consegue visualizar o progresso.

Não se presume teste com leitor de tela físico, zoom de 200%, modelo específico de
celular, dois dispositivos ou suspensão real do sistema. Não se atribui ao
responsável a execução dos testes HTTP/SQL ou Chromium abaixo.

| Comando / categoria | Reexecutado agora, Prompt 37 |
| --- | --- |
| `npm.cmd run test:run` | **292 testes em 28 arquivos**, todos aprovados |
| `npm.cmd run build` / `npm.cmd run lint` | Aprovados; build DEV, lint sem avisos/erros |
| `node scripts/local-reading-smoke.mjs` | **46 HTTP**, inclusive sessenta segundos reais e cinco checkpoints/conclusões simultâneos |
| `node scripts/local-reading-sessions.mjs` | **19 HTTP**, sessões Auth distintas, transferência e legado |
| `node scripts/local-login-smoke.mjs` | **41 HTTP**, username/e-mail, sessão, refresh, logout, legado e limitações |
| `node scripts/local-whatsapp-smoke.mjs` | **40 HTTP**, telefone, feedback e isolamento |
| `node scripts/local-profile-smoke.mjs` | **29 HTTP**, perfis e persistência |
| `node scripts/local-library-smoke.mjs` | **35 HTTP**, acervo e aberturas |
| `node scripts/local-admin-smoke.mjs` | **41 HTTP**, administração e permissões negadas |
| `node scripts/run-local-reading-sql.mjs --regression` | **196 SQL/RLS na stack local atual**, todos com rollback: 59 leitura + 59 autorização + 16 privacidade + 18 username + 25 WhatsApp + 19 login |
| `node scripts/verify-local-reading-install.mjs` | **Nove migrações em ordem e 196 SQL/RLS adicionais em PostgreSQL NOVO isolado**, todos os testes com rollback; compatibilidade de fixtures legadas preservada |
| `node scripts/local-reading-browser.mjs` | **19 Chromium automatizadas**, tempo real, aba oculta, retomada, recarga, teclado, viewport de 390 px, logout/login e conclusões |
| `npm.cmd run build:staging` / `build:prod` | Recusa esperada, código 1; conflito de variáveis genéricas de DEV, ambientes também continuam bloqueados em código |
| `git diff --check` | Aprovado; somente avisos LF/CRLF do Git no Windows |

São **251 verificações HTTP** nesta rodada. As duas execuções de 196 SQL são
separadas por banco, não casos de segurança distintos. Os 291 testes, 251 HTTP,
196 SQL e 19 Chromium do Prompt 36 abaixo são históricos e não foram somados aos
totais atuais. Recuperação, privacidade e cadastro de username não tiveram suas
suítes HTTP completas repetidas; a cobertura SQL/unitária correspondente passou.

Foi acrescentado um único script de verificação e um teste do seu entrypoint
contra Docker remoto, URL remota e contexto malicioso; por isso a suíte passou de
291 para 292. Não houve mudança funcional React nem alteração de migrações nesta
auditoria. Os dois corpos de funções de leitura instalados na stack atual foram
comparados com a segunda migração, por consulta somente de leitura, e coincidem.

Instalação nova: mesma imagem local por ID, `--pull=never`, rede `none`, sem portas,
bind mounts ou volumes. Dados do novo cluster ficam em tmpfs e o contêiner dessa
execução é parado/removido ao terminar. Copiou-se **somente DDL Auth**; os triggers
privados do aplicativo são removidos dessa cópia e recriados pelas migrações. Não
se copiaram contas, verificadores de senha, tokens ou dados da stack atual. O
bootstrap reproduz schema Auth separado, acesso sem grant option e operador de
migração sem superuser, com bypass de RLS como operador confiável. Não é uma nova
stack GoTrue/Kong e não inclui novo HTTP nesse contêiner sem rede.

As tentativas de preparar esse harness foram interrompidas antes de completar as
assertions por permissões do operador/SET ROLE; foram corrigidas no bootstrap
descartável, sem alterar migrações ou o banco atual. Somente as rodadas completas
passadas entram nos totais. Todos os contêineres de preparação foram descartados.

Revisão final: **31 candidatos (12 modificados, 19 novos)**, incluindo o novo
verificador. Ambientes/caches ignorados, sem segredos nos candidatos e sem staging
ou commit. O protocolo valida somente seus intervalos aceitos; automação que
aguarde tempo real e validade residual de JWT até expiração continuam limites.
Roteiro ampliado, auditoria e inventário em [reading-local.md](reading-local.md).

## Implementação da Etapa 22.1 — Prompt 36 (resultados anteriores)

Branch `feat/local-auth`, base `c2fb5b3`. Resultados **reexecutados nesta etapa**,
separados de todos os registros históricos abaixo:

| Comando / categoria | Resultado final |
| --- | --- |
| `npm.cmd run test:run` | **291 testes em 28 arquivos**, todos aprovados |
| `npm.cmd run build` | Aprovado, somente DEV |
| `npm.cmd run lint` | Aprovado, sem avisos/erros |
| `node scripts/local-reading-smoke.mjs` | **46 HTTP**, com 60 s reais, pausa, replay, cinco checkpoints/conclusões concorrentes, revisão, exclusão e RLS pela API |
| `node scripts/local-reading-sessions.mjs` | **19 HTTP**, sessões Auth distintas, transferência, progresso após logout/login e fixture legada sem username/WhatsApp |
| `node scripts/local-login-smoke.mjs` | **41 HTTP**, username/@/maiúsculas/e-mail, confirmação, erros, refresh, logout, limites e legado |
| `node scripts/local-whatsapp-smoke.mjs` | **40 HTTP**, WhatsApp obrigatório, feedback opcional/revogável e isolamento |
| `node scripts/local-profile-smoke.mjs` | **29 HTTP**, perfis/persistência/isolamento |
| `node scripts/local-library-smoke.mjs` | **35 HTTP**, acervo/aberturas/publicação e persistência |
| `node scripts/local-admin-smoke.mjs` | **41 HTTP**, administração/negações/persistência |
| `node scripts/run-local-reading-sql.mjs --regression` | **196 SQL**, todos com rollback: 59 leitura + 59 autorização + 16 privacidade + 18 username + 25 WhatsApp + 19 login |
| `node scripts/local-reading-browser.mjs` | **19 Chromium automatizadas**, 60 s reais, aba oculta, recarga, teclado, viewport móvel, logout/login e histórico |
| `npm.cmd run build:staging` / `build:prod` | Ambos recusados, código 1 esperado; variáveis genéricas exclusivas de DEV e ambientes remotos continuam desabilitados em código |
| `git diff --check` | Aprovado; somente avisos de normalização LF/CRLF do Git no Windows |

Total HTTP desta rodada: **251**, sem misturar SQL, testes unitários e navegador.
As suítes HTTP completas de recuperação, privacidade e cadastro de username não
foram repetidas nesta rodada. Os registros manuais e a instalação isolada da etapa
anterior não são novas execuções. Nesta etapa as nove migrações estão aplicadas na
stack local atual; não houve instalação completa em outro banco, reset ou remoto.
Os 59.999/60.000 ms são limites preparados no rollback SQL; HTTP e navegador
validam espera real, sem acelerar o relógio nem editar saldo para concluir.

Novos testes cobrem o controlador de leitura e a fronteira RPC sem cliente real,
eventos de visibilidade/foco, falhas/retomada, respostas atrasadas, ausência de
conclusão automática, histórico separado e nullable FK. Os cinco entrypoints novos
são exercitados com DOCKER_HOST remoto, URL remota e contexto malicioso, incluindo
o caminho `--regression`; todos recusam antes de acessar serviços. Esses testes
simulam rede/ambiente ou recusam destinos; não acessam servidores externos.

Correção com regressão: pausa que falhava offline descartava o token local cedo
demais; agora a autorização é mantida até confirmação da pausa e revogada antes
de retomar, inclusive em falha curta. Nenhum teste foi pulado ou enfraquecido.
A primeira tentativa da migração teve rollback por privilégio de transferência
de owner; depois de aplicada, os testes mostraram a impossibilidade de delegar
USAGE no schema Auth. A correção está em uma **segunda migração incremental**,
sem reescrever a aplicada; o helper só lê identidade da requisição.

Execuções intermediárias não são resultados finais: o harness de navegador parou
após 1 e 14 verificações (seletor/evento CDP), corrigidos antes das rodadas completas
19/19. Uma rodada unitária teve duas falhas na parametrização do teste novo e uma
interrupção de processo Node no Windows durante execução concorrente; a suíte
integral posterior passou 291/291. Um build intermediário apontou a parametrização
TypeScript; o build final passou. O lint intermediário teve um aviso de regex
de diagnóstico, removido; lint final sem avisos. Não se alteraram testes para
ignorar crashes, falhas ou permissões.

No Prompt 36 não havia aceite manual do responsável. Os 12 cenários aprovados
posteriormente estão registrados no Prompt 37 acima. Naquela rodada, leitor de
tela, zoom real de 200%, aparelho móvel físico, suspensão real do SO, carga
sustentada e nova instalação integral estavam fora da cobertura. Registros de tempo não provam compreensão
nem impedem automação que aguarde intervalos reais. STAGING/PROD não foram liberados.

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
# Candidato OWNER STAGING bloqueado

O ensaio descartável `node scripts/verify-local-reading-install.mjs` inclui
`staging-owner-candidate.sql` e seus checks sintéticos, com rollback. Exercita
eligibilidade, pedido de exclusão, repetição, atomicidade da auditoria e RPCs
com claims anteriores à revogação. O teste unitário verifica que a entrada
STAGING recusa todos os destinos e não ecoa argumentos. O novo ensaio usa três
conexões independentes via socket no banco descartável; verifica locks reais,
concorrência de duas concessões e duas revogações, pedido de exclusão antes e
depois da concessão, negação nas RPCs com sessão anterior e rollback por auditoria
duplicada. Ação nula, conta suspensa, excluída, anônima ou sem confirmação de
Auth são recusadas no candidato. O ensaio não comprova identidade remota,
verificação externa de e-mail, TLS ou privilégios mínimos no serviço gerenciado.
Uma exclusão concorrente de `auth.users` também foi ensaiada: ela espera o lock
da concessão e, após commit, remove a membership por cascade sem evento `revoke`.
Isso revela uma lacuna de auditoria para exclusão por outra via, distinta da
revogação explícita. Auditoria duplicada desfaz tanto grant quanto revoke.

Resultados locais desta rodada: 509 testes Vitest em 49 arquivos com
`npm run test:run -- --maxWorkers=2`, lint, build DEV e build com fixture
STAGING aprovados. O ensaio descartável aplicou 16 migrações e passou 464 checks
SQL/RLS, os checks adicionais do candidato e as suítes de concorrência; descartou
o contêiner. Os builds emitiram aviso de bundle maior que 500 kB.

## Refinamento de cadastro DEV/STAGING (Prompt 77)

Os testes de interface simulam a fronteira Auth, incluindo cadastro com sessão
oficial e sem sessão, falhas, confirmação pendente, troca de conta e logout. A
interface distingue DEV e STAGING pela configuração validada; o login hospedado
usa e-mail, enquanto username permanece local. A sessão retornada pelo SDK é
tratada pelos eventos Auth existentes, sem login adicional ou sessão fabricada.
Sem sessão, a mensagem orienta confirmação quando solicitada sem garantir envio.
Os testes não verificam configuração ou entrega real de e-mail no serviço remoto.

Validação final local: `npm.cmd run test:run -- --maxWorkers=2` passou com
515 testes em 50 arquivos; `npm.cmd run lint`, `npm.cmd run build` e
`node scripts/build-staging-fixture.mjs` passaram. Os dois builds avisaram sobre
chunk maior que 500 kB. Não houve ensaio em navegador real ou serviço remoto.

## Prompt 78 — navegação, nome e telefone

Testes de interface com fronteiras simuladas cobrem sessão pendente, visitante,
acesso administrativo, descarte de respostas após logout, saudação com nome ou
fallback, nome obrigatório e telefone brasileiro/internacional. As expectativas
de visitante foram atualizadas para o novo encaminhamento ao login, preservando
as verificações de ausência de consultas e dados privados. Não houve migração;
o nome fica nos metadados Auth, independente do nome editável no perfil, e sua
obrigatoriedade é apenas no formulário.

`npm.cmd run test:run -- --maxWorkers=2 --reporter=dot`: 519 testes em 50
arquivos aprovados; após adicionar asserções visuais administrativas, os 12
testes de `AdminPanel.test.tsx` passaram novamente. `npm.cmd run lint`, build
DEV e fixture STAGING passaram; builds avisaram sobre chunk acima de 500 kB.
O navegador integrado não estava disponível. Não foram executadas medições ou
verificações visuais reais nas larguras 320, 360, 375, 390, 430, 768 e 1280 px;
os ajustes de CSS e a acessibilidade por teclado ainda precisam dessa revisão.
Nenhum serviço remoto foi acessado e nenhuma migração foi aplicada.

## Prompt 79 — telefone e auditoria OAuth

O formulário agrupa país, código e telefone; testes de interface cobrem padrão
brasileiro, código internacional alternativo, código inválido e associação do
erro acessível. Os testes de formulário usam Auth simulado. Não há integração
Google implementada ou habilitada: os gatilhos atuais bloqueiam criação de
contas sem username e WhatsApp e o vínculo automático exige revisão. Assim, não
há teste de OAuth ou conclusão de cadastro a ser declarado como aprovado.
O navegador integrado continuou indisponível; não houve medições reais nas
larguras solicitadas. O detalhamento das pendências está em `journey-roadmap.md`.
Validação final: `npm.cmd run test:run -- --maxWorkers=2` passou com 520 testes
em 50 arquivos; lint, build DEV e fixture STAGING passaram, com aviso de chunk
acima de 500 kB nos builds. `git diff --check` também foi executado.

A retomada local e testada com armazenamento simulado e Chromium com backend ficticio em 390 e 1280 px.

A fronteira de Preview valida origem exata, build autorizado e rejeicao de dominios semelhantes em hostedEnvironment.test.ts.

O acervo testa busca por titulo e referencia sem acentos, ordenacao e resultado vazio com backend simulado.

## Controles de leitura e seleção de versículos

BibleVerseList.test.tsx cobre seleção de versículos avulsos no mesmo capítulo, aplicação de cor e favoritos, preservação de nota prévia e cópia com referência, atribuição e link do aplicativo. ReadingFontControl.test.tsx cobre ajuste e persistência local do tamanho da fonte. A responsividade dos botões de login é uma mudança de CSS e requer conferência visual em navegador estreito.

## Devocional guiado Coram

`GuidedDevotional.test.tsx` percorre as quatro etapas com conteúdo fictício, confere a barra de etapas e verifica a gravação da resposta pela fronteira simulada. `privateResponses.test.ts` cobre validação de texto, identidade da conta e vínculo com o devocional. `ReadingProgress.test.tsx` cobre vibração somente após conclusão explícita confirmada, sem vibração ao reabrir leitura concluída. Os testes existentes de editor, publicador e acervo cobrem a compatibilidade com publicações anteriores. A migração SQL não é executada na suíte automatizada; ela ainda exige aplicação e verificação no Supabase local antes de ativar o fluxo em qualquer ambiente hospedado.
