# Etapa 22.3 — Minha Jornada e evolução pessoal

> Prompt 73: elegibilidade OWNER foi unificada em migração incremental testada
> em PostgreSQL temporário; procedimento hospedado permanece pendente de
> identidade do projeto vinculada e aprovação. Ver [staging-deployment.md](staging-deployment.md).

> Etapa 23.5.1: build STAGING controlado preparado localmente; PROD segue
> bloqueado. Nenhuma implantação ou conexão hospedada nesta rodada. Ver
> [procedimento e pendências](staging-deployment.md). Os bloqueios STAGING
> indicados nas notas antigas abaixo são históricos.

> Etapa 23.4 implementada localmente e aguardando commit, com 12/12 validações
> manuais informadas pelo responsável. STAGING/PROD permanecem bloqueados; ver
> [ambientes hospedados](hosted-environments.md).

> Etapa 23.4.2: contrato HTTPS integrado à fábrica e login por e-mail testável
> em fronteira simulada. STAGING/PROD continuam bloqueados; detalhes e
> pendências em [hosted-environments.md](hosted-environments.md).

> Etapa 23.3: leitor bíblico local demonstrativo implementado com catálogo de 66
> livros e arquitetura de provedores. NVI inativa e conteúdo bíblico real ainda
> dependem de autorização; detalhes em [bible-reader-local.md](bible-reader-local.md).
> Cadastro aberto com confirmação continua sendo a decisão do MVP.

> Prioridade atual — disponibilizar o MVP aos primeiros leitores, com cadastro
> público e confirmação de e-mail. As etapas 22.3.1–22.3.5 estão versionadas, incluindo 22.3.5 em
> `96a42ab`. A auditoria integrada ampla foi adiada; executar as verificações
> essenciais de lançamento descritas em [mvp-beta-launch.md](mvp-beta-launch.md).
> Leitor bíblico nativo demonstrativo implementado para múltiplas versões; NVI
> somente com fonte e licença autorizadas. Web Push externo permanece desativado.
> O estado e a ausência de commit descritos a seguir são registros históricos.

> Etapa 23.2 de convites dispensada por decisão do responsável no Prompt 63;
> não foi implementada. Diagnóstico histórico em
> [beta-invitations-local.md](beta-invitations-local.md).

Estado atual — Prompt 59 / auditoria final da Etapa 22.3.5. Branch `feat/local-auth`, HEAD `412dc4e`.
22.3.1 a 22.3.4 versionadas. Conquistas e Desafios implementados localmente,
validados localmente, com 14/14 aprovações manuais do responsável registradas
literalmente, ainda sem commit. Regras, privacidade e limites em
[achievements-local.md](achievements-local.md). Entrega Web Push externa permanece
não validada e desativada. Nenhum staging, commit ou publicação nesta rodada.

## Roadmap oficial — numeração definitiva (Prompt 46)

| Subetapa | Funcionalidade | Estado |
| --- | --- | --- |
| 22.3.1 | Minha Jornada | Versionada em `195a9b5` |
| 22.3.2 | Modo Noturno | Versionado em `91c81d0`; 11/11 manuais históricos do Prompt 48 |
| 22.3.3 | Notificações Inteligentes | Versionadas em `2a60697`; entrega externa não validada/desativada |
| 22.3.4 | Comentários, Reações e Moderação | Versionados em `412dc4e` |
| 22.3.5 | Conquistas e Desafios | Implementados e validados localmente; 14/14 manuais; aguardando commit |

Esta numeração substitui a proposta de quatro subetapas do Prompt 44. Apenas a
documentação foi atualizada no Prompt 46; o Prompt 47 implementa somente aparência.

## Validação manual — responsável, Prompt 46: 8/8 aprovados

1. Minha Jornada abre pelo menu e exibe os dados da conta.
2. Ofensiva, recorde e dias concluídos correspondem ao desempenho pessoal.
3. É possível navegar pelos meses e consultar o histórico diário.
4. Alt+Tab preserva a tela e o mês selecionado.
5. F5 mantém Minha Jornada aberta e retorna ao mês atual.
6. A interface funciona em uma janela pequena ou celular.
7. Uma leitura concluída validamente atualiza o desempenho.
8. Uma conta diferente não consegue visualizar os dados de outra conta.

Aprovações informadas pelo responsável, sem repetição manual pelo agente e sem
estender aprovação a outros cenários do checklist, testes ou ambientes. Nenhum
resultado de Modo Noturno, push, comentários/reações ou conquistas foi aprovado.

## Diagnóstico da arquitetura

- React/TypeScript/Vite; navegação por hash em `App.tsx`; AuthProvider usa SDK
  oficial local. Troca de conta remonta conteúdo; recuperação/logout bloqueiam
  dados pessoais. Renovar sessão não deve reiniciar calendário do mesmo leitor.
- `devotional_completions` é o recibo servidor de conclusão válida. O protocolo
  de 60 segundos da Etapa 22.1 não muda; aberturas não são conclusões.
- `get_my_consistency(p_month)` é SECURITY INVOKER com RLS existente, usuário
  derivado de `auth.uid()`, hoje civil de America/Sao_Paulo. Retorna ofensiva,
  recorde, totais e calendário em um snapshot SQL. Não recebe ID do leitor.
- `ConsistencySection` já controla mês, limite futuro/primeiro mês, foco,
  visibilidade, timer, retry e descarte de respostas antigas. É o único dono
  desses estados também em Minha Jornada. Não há store global de métricas.
- `ReaderLibrary` depende de acervo/aberturas/recibos. A nova página é independente
  dessa consulta: falha de acervo não deve bloquear as métricas pessoais.
- OWNER é membership privada separada de editorial. A RPC comunitária verifica
  OWNER em cada consulta. Não é usada pela página pessoal; PUBLISHER futuro não
  herda poderes de proprietário. Não alterar essas permissões nesta etapa.
- Diagnóstico anterior à 22.3.3: não havia infraestrutura push, moderação ou conquistas pronta. Links, estados
  fictícios e tabelas vazias não devem sugerir que esses recursos já funcionam.

## 22.3.1 — implementada nesta rodada

Rota `#minha-jornada`, link Minha Jornada na navegação e página autenticada
`JourneyPage`. Reutiliza `ConsistencySection` com histórico mensal opcional.
O padrão anterior do componente é preservado no Início e nas Minhas aberturas.
Não cria migração, contador mutável, nova RPC, permissão ou escrita no banco.

Além dos indicadores/calendário já existentes, exibe dias e textos concluídos
no mês e lista de dias com conclusão, do mais recente ao mais antigo. Esses dois
totais mensais são projeções somente leitura de `data.days` da mesma resposta;
não substituem totais históricos nem calculam ofensiva/recorde no cliente.
Um dia com duas conclusões aparece uma vez, com dois textos. Mês sem conclusões
tem estado acolhedor; falha de rede/autorização não é apresentada como vazio.

O calendário é também a evolução visual entre meses, com texto acessível além
de cor. Não há comparação percentual, meta obrigatória ou conquista fictícia.
Link para Minhas aberturas e conclusões conserva o histórico detalhado existente;
a nova lista mensal não consulta conteúdo retirado nem expõe UUIDs de recibos.

Consistência de navegação: cliques rápidos acumulam por atualização funcional;
teclado usa botões nativos; foco/visibilidade consultam o mês escolhido; respostas
antigas são descartadas. Renovação da mesma conta preserva seleção. F5 preserva
a rota e inicia no mês atual do servidor, conforme o contrato da Etapa 22.2.
Sair, trocar conta ou entrar em recuperação remove os dados anteriores.

Privacidade: apenas dados pessoais da RPC; nenhuma consulta ao ranking, listagem
de usuários ou ledger de terceiros. A página comunica acesso limitado de outros
leitores e a consulta administrativa resumida já descrita na política existente.
Não persiste métricas no localStorage, URL ou analytics. Nenhum ID vem da rota.

Critérios de saída: unitários/integração React com fronteira Supabase simulada;
suíte regressiva 22.2; SQL/RLS existente repetido em PostgreSQL isolado; build DEV,
lint e diff limpos. Revisão visual/mobile e sessão real local têm checklist abaixo.

## 22.3.2 — implementada: Modo Noturno (Prompt 47)

Claro, Escuro e Sistema implementados localmente. Bootstrap pré-React, store
independente de sessão, preferência local e tokens semânticos compartilhados.
Diagnóstico, decisões, cobertura, suporte e checklist atuais em
[appearance-local.md](appearance-local.md). Requisitos planejados no Prompt 46
abaixo passam a ser contrato de implementação; testes/resultados reais em
`testing.md`. As oito aprovações humanas da Jornada não aprovam aparência;
as onze aprovações específicas de aparência foram informadas no Prompt 48 e
transcritas em `appearance-local.md` e `testing.md`, sem presumir outros cenários.

### Experiência e preferência local

- Três modos explícitos: Claro, Escuro e Sistema; padrão Sistema.
  Seleção acessível por teclado, com nome/estado reconhecíveis, sem depender só
  de ícone ou cor. Não alterar conteúdo, contratos de navegação ou autorização.
- Preferência persistente do dispositivo/navegador, sem serviço remoto ou
  credencial. Proposta: chave local versionada com enum estrito; não associar
  dados pessoais nem sincronizar conta. Login/logout/troca de conta mantêm a
  preferência do dispositivo; comunicar esse alcance na configuração.
- Valor ausente/inválido ou storage indisponível não bloqueia a aplicação;
  usar Sistema em memória, permitindo seleção enquanto a página estiver aberta.
  Eventos de storage podem sincronizar outras abas do mesmo navegador.
- Sistema deriva o tema efetivo de `prefers-color-scheme` e acompanha mudanças
  automaticamente; Claro/Escuro explícitos não são sobrescritos pelo sistema.
  Separar preferência escolhida do tema efetivo para evitar persistir resolução
  temporária do Sistema como se fosse escolha manual.

### Inicialização e tokens

- Resolver preferência e esquema do sistema antes da primeira pintura, aplicando
  atributo de tema e `color-scheme` na raiz antes do React. Evitar flash de tema
  incorreto em acesso direto/refresh; primeiro render React deve concordar com
  a resolução inicial, sem escrever preferência em render.
- Bootstrap pequeno, estático e revisado, com tratamento de erro de
  storage; sem interpolar conteúdo fornecido pelo usuário. Compatibilizar com
  política CSP da versão publicada quando houver, sem relaxá-la para resolver tema.
- Centralizar cores/superfícies em tokens CSS semânticos: fundo, superfície,
  superfície elevada, texto principal/secundário, bordas, ação, foco, hover,
  selecionado, desabilitado, erro, sucesso e destaque. Mapear hardcodes atuais
  antes da troca; manter identidade visual e contratos existentes.
- Cobrir todas as telas: login/cadastro/recuperação, perfil/privacidade,
  biblioteca, devocional/leitura e progresso, Minha Jornada, calendário e
  administração/comunidade. Incluir formulários, tabelas, legendas, badges,
  ícones e campos nativos; não aplicar somente a fundo/texto da página.

### Acessibilidade, atualização e validação

- Contraste acessível de textos/ícones/controles em ambos os temas, foco sempre
  visível e hover/seleção/disabled legíveis. Hoje/conclusão no calendário e erros
  continuam identificáveis por texto/marcador, além de cor.
- Mudanças de tema não movem foco, não remontam a sessão e não reiniciam mês,
  edição, leitor ou progresso. Ouvir alterações de `prefers-color-scheme` com
  cleanup; alternância do sistema só afeta quem selecionou Sistema.
- Respeitar `prefers-reduced-motion`; não criar animações obrigatórias ou
  transições globais que causem desconforto/flash na inicialização.
- Testes de Claro/Escuro/Sistema em desktop e celular, preferência
  persistida após refresh, login/logout/troca de conta, sistema alterado com
  página aberta e abas sincronizadas. Cobrir valor inválido, storage bloqueado,
  redução de movimento, foco/hover, contraste e primeira pintura sem flash.
- Testes unitários com `matchMedia`/storage simulados; Chromium com preferência
  de cor emulada antes da navegação, screenshots de todas as telas com dados
  fictícios e verificação humana de legibilidade. Nenhum SQL, serviço remoto,
  permissão push, novo papel ou API de recursos futuros nesta entrega.

## 22.3.3 — implementadas localmente: Notificações inteligentes

Configurações autenticadas em `#configuracoes`; preferências por conta e horário/fuso
por dispositivo. Permissão apenas por gesto voluntário. Service worker sem cache
autenticado e com vínculo revogável por sessão; compartilhamento apenas de publicação
visível e com aviso de autenticação. RPCs próprias, endpoints privados, RLS e migração
incremental, sem alteração das regras de 60 segundos ou dos privilégios OWNER.

Agendador Node independente da aba, relógio controlável nos testes, reserva atômica
e dupla unicidade de dia local/Brasília. Imediatamente antes da tentativa, consulta
publicação e conclusões válidas no servidor: sem conclusão → LEITURA; com conclusão
→ COMPARTILHAMENTO. Ausência de publicação, opt-out, revogação ou mudança de dia
suprimem o envio. Isso substitui a proposta antiga de suprimir toda conclusão.

Simulação é o padrão. Entrega real exige autorização específica, VAPID privado
somente no servidor, configuração local correspondente e confirmação criptografada
da assinatura. Não houve envio externo. Política completa de DST, datas diferentes,
janela de 15 minutos, deduplicação, resultados incertos, retenção e validações em
[smart-reminders-local.md](smart-reminders-local.md) e [testing.md](testing.md).

## 22.3.4 — implementados localmente: Comentários, Reações e Moderação

Uma reação privada por leitor/devocional, editável/removível; nenhum placar ou
ranking. Uma reflexão principal de até **1000 caracteres**, com edição/remoção
própria. Novos textos e edições ficam pendentes; leitores autenticados só veem
aprovados, com username e dia aproximado. Texto seguro sem HTML executável, links
automáticos, mídia, mensagens diretas ou respostas em cadeia.

OWNER existente revisa Pendentes/Denúncias/Histórico em `#admin/moderacao`. Servidor
verifica autoria, publicação, versões/transições e membership em cada operação.
Editorial/PUBLISHER não herda moderação. Nenhuma ampliação da membership OWNER,
regra de leitura/conclusão, push ou métricas. Denúncias únicas por versão, limites
de frequência backend e auditoria sem cópias antigas do texto.

Migração incremental `20261028000700_discussion.sql`, tabelas privadas com RLS e
RPCs de projeção restrita, sem alteração das treze migrações anteriores. Retenção,
política de proteção a adolescentes, responsabilidades operacionais e testes
executados: [discussion-local.md](discussion-local.md), [testing.md](testing.md).
Não há aprovação manual nova nem afirmação de conformidade legal definitiva.

## 22.3.5 — implementados localmente: Conquistas e Desafios

Distintivos de 3, 7, 14, 30, 60 e 100 dias consecutivos, conquistados somente por
conclusões válidas. Não usar aberturas, likes, push aberto ou edição de metadados.
Backend calcula a partir do mesmo ledger; não aceitar contadores do cliente.

Decisão final do Prompt 57: distintivos derivados do recorde histórico completo
pela RPC pessoal existente no backend, sem materializar concessões ou duplicar
contadores. Isso substitui a proposta inicial de registro/job: o ledger já retém
a evidência e nenhuma escrita/backfill na leitura é necessária. Conquistas são
preservadas quando a sequência reinicia. Correção excepcional de recibos precisa
de política explícita; nenhuma correção de dados foi feita nesta rodada.

Desafios privados opt-in de 3, 5 ou 7 dias distintos na semana de segunda a domingo
de Brasília. Regra final explícita: dias concluídos desde segunda contam mesmo
antes da adesão, substituindo a proposta inicial de contar só após adesão. Uma
meta imutável por semana; desistir mantém a adesão encerrada sem reiniciar naquela
semana e sem punição. Progresso/resultado são consultas ao ledger, não colunas
editáveis. Histórico mostra até 52 adesões recentes; dados anteriores permanecem
privados até exclusão da conta. Sem job, notificações novas ou ranking.

RLS estritamente própria inclusive para editorial; sem nova visão administrativa,
ranking, notificação automática ou exposição compulsória. Linguagem de convite e
recomeço, sem “fracasso”, perda de valor ou cobrança. Indicadores não medem fé.
Testar limiares, dias duplicados, fusos/viradas, 100+ dias, concorrência, recorde
interrompido, persistência de distintivos, desafio opcional e isolamento por conta.

## Sequência de entrega e limites comuns

Cada uma das cinco subetapas requer escopo próprio, revisão de dados/privacidade e nova validação;
planejar não autoriza instalar infraestrutura, executar migrações ou publicar.
Módulos futuros de reminders/discussion/achievements devem depender de contratos
de sessão/conclusão, não do estado React do calendário nem da RPC OWNER.
Preferir adaptadores substituíveis para relógio/transporte/agendador e testes sem
rede. Só criar esses módulos quando usados; nenhum esqueleto morto nesta rodada.

Separar DEV/STAGING/PROD e credenciais; migrações apenas incrementais e testes com
dados fictícios/rollback. Gates: RLS, privacidade, falhas/limites, regressões 22.1 e
22.2, build/lint, roteiro humano, retenção e autorização concreta para publicação.
Nenhum desses gates libera STAGING/PROD automaticamente.

Limitações atuais: histórico da Jornada é mensal, não timeline paginada de todos
os textos; navega do primeiro mês com conclusão até atual. Recarga reinicia mês.
Fuso das conclusões continua Brasília. Consulta agregada pode exigir otimização
com crescimento, sem cache global de dados privados. Bundle já excedia 500 kB.
Há fixtures de 1005 dias e contas sem classificação na stack local; não exportar
ou interpretar como hábitos reais. Retenção atual de recibos/diário OWNER e base
de privacidade continuam pendências antes de uso público, sem expurgo agora.

## Checklist manual — apenas 22.3.1

- [ ] Entrar como leitor local fictício sem editorial; abrir Minha Jornada pelo
  menu e diretamente por `#minha-jornada`; conferir link ativo e ausência de erro.
- [ ] Comparar ofensiva/recorde/totais ao Início e Minhas aberturas da mesma conta.
- [ ] Conferir mês vazio e dia com mais de uma conclusão: dias e textos distintos.
- [ ] Navegar vários meses, clicar rapidamente, alternar Enter/Tab e mouse; não
  ultrapassar primeiro mês disponível nem mês atual. Conferir virada de ano.
- [ ] Alt+Tab/voltar e atualizar sessão: mês permanece; F5 preserva rota e abre mês
  atual do servidor. Testar também a seção administrativa 22.2 após Alt+Tab/F5.
- [ ] Simular offline: erro sem diagnóstico privado, retry e identificação de
  dados anteriores; sem falso histórico vazio. Retorno ao foco reconsulta seleção.
- [ ] Sair/trocar conta e recuperar senha: nenhum histórico anterior permanece;
  rota anônima não faz consulta pessoal. Não compartilhar tokens/capturas privadas.
- [ ] Conferir 390px e desktop, calendário/lista sem overflow, zoom e teclado.
- [ ] Conclusão voluntária real local após 60s aparece ao voltar à Jornada;
  leitura/aberturas não criam progresso. Nenhum dado preexistente deve ser editado.
- [ ] Verificar links de privacidade/histórico/acervo. Nenhum botão de push,
  comentário, reação, distintivo ou desafio desta etapa aparece como funcional.

Resultados efetivamente executados nesta rodada são registrados em `testing.md`;
este checklist não representa aprovação integral. Somente os oito cenários
listados no registro do Prompt 46 acima foram aprovados pelo responsável.

## Auditoria final e candidatos — Prompt 46

Branch `feat/local-auth`, HEAD `42e6070`; sete arquivos modificados e três novos,
total **10**. Todos revisados individualmente, inclusive os não rastreados:

| Arquivo | Estado | Escopo conferido |
| --- | --- | --- |
| `docs/consistency-local.md` | Modificado | Reutilização da RPC/calendário e referência ao roadmap definitivo |
| `docs/development-workflow.md` | Modificado | Fluxo local e cinco subetapas, sem implementação futura |
| `docs/testing.md` | Modificado | Oito aprovações humanas exatas, resultados repetidos e limitações |
| `docs/journey-roadmap.md` | Novo | Arquitetura da Jornada, cinco subetapas, requisitos de tema e auditoria |
| `scripts/local-navigation-browser.mjs` | Modificado | Oito casos Jornada adicionados aos dez anteriores, respostas fictícias e capturas em cache ignorado |
| `src/App.css` | Modificado | Somente estilos de histórico/links da Jornada; nenhum modo noturno |
| `src/App.tsx` | Modificado | Link/rota Minha Jornada; mantém guardas e rotas existentes |
| `src/components/ConsistencySection.tsx` | Modificado | Histórico mensal opcional derivado do mesmo snapshot; calendário preservado |
| `src/components/JourneyPage.test.tsx` | Novo | Onze casos de autenticação, isolamento, histórico, erros, foco e reload |
| `src/components/JourneyPage.tsx` | Novo | Guarda sessão/recuperação e reutiliza componente pessoal, sem consulta OWNER |

Revisão de segurança: a seleção de rota não concede acesso. `JourneyPage` aguarda
sessão, nega anon/recuperação e desmonta dados após logout; conta é key do conteúdo.
A RPC continua derivando autoria de `auth.uid()` sob RLS, sem ID do leitor na
requisição. Respostas antigas são descartadas; renovação da mesma conta preserva
seleção. Soma de textos/dias mensais é projeção de leitura, não contador mutável
ou fonte de autorização. Nenhuma chamada de escrita ou nova permissão de admin.

As 12 migrações de `42e6070` estão preservadas, comparando conteúdo com normalização
somente CRLF/LF. Sem mudança em autenticação, leitura de 60s, RPC pessoal ou schema.
Varredura integral dos dez candidatos sem caminhos/assinaturas sensíveis
identificados: nenhum `.env`, chave, token completo, cookie, senha real, contato
pessoal, log, cache ou temporário. Os dados literais de testes são fictícios.
Arquivos de credenciais não foram abertos. A varredura por padrões não prova
ausência universal de segredos; revisão de código/contexto complementa a checagem.
Capturas/relatório auxiliar ficam em `node_modules/.cache` ignorado; `dist` e
arquivos locais de ambiente também ignorados, fora dos comandos de staging.

Repetidos no Prompt 46: 398 testes/36 arquivos, build DEV, lint, 18 Chromium
simuladas, 288 SQL/RLS com rollback em PostgreSQL isolado, oito HTTP locais
negativos e bloqueios dos builds STAGING/PROD. Resultados e limites em `testing.md`.
Sem bloqueador técnico identificado para commit local. Bundle >500 kB,
privacidade/retenção e proveniência de dados sintéticos continuam riscos conhecidos
antes de uso público; não foram apagados registros para acomodar testes.

### Comandos exatos — Windows CMD (somente fornecidos)

Os argumentos abaixo também constituem a lista completa dos dez candidatos.
Não adicionar espaços após o caractere de continuação `^`. Nenhum `git add`,
commit, push ou deploy foi executado pelo agente.

```cmd
git add -- ^
  "docs\consistency-local.md" ^
  "docs\development-workflow.md" ^
  "docs\journey-roadmap.md" ^
  "docs\testing.md"

git add -- "scripts\local-navigation-browser.mjs"

git add -- ^
  "src\App.css" ^
  "src\App.tsx" ^
  "src\components\ConsistencySection.tsx" ^
  "src\components\JourneyPage.test.tsx" ^
  "src\components\JourneyPage.tsx"
```

Após staging decidido pelo responsável: `git diff --cached --stat` e
`git diff --cached --check`. Mensagem recomendada:
`feat(journey): adiciona Minha Jornada e atualiza roadmap da etapa 22.3`.
