# Etapa 22.3 — Minha Jornada e evolução pessoal

Estado atual — Prompt 51 / Etapa 22.3.3: base `91c81d0`, branch `feat/local-auth`.
Minha Jornada e Modo Noturno versionados. Notificações inteligentes implementadas
localmente, pendentes de commit, com transporte simulado por padrão e entrega
externa não configurada nem validada. Quinze aprovações manuais informadas pelo
responsável estão transcritas em `smart-reminders-local.md` e `testing.md`.
Arquitetura, segurança, horários e limites: [smart-reminders-local.md](smart-reminders-local.md).
Comentários/Reações e Conquistas/Desafios continuam sem implementação.

## Roadmap oficial — numeração definitiva (Prompt 46)

| Subetapa | Funcionalidade | Estado |
| --- | --- | --- |
| 22.3.1 | Minha Jornada | Versionada em `195a9b5` |
| 22.3.2 | Modo Noturno | Versionado em `91c81d0`; 11/11 manuais históricos do Prompt 48 |
| 22.3.3 | Notificações Inteligentes | Implementadas localmente, pendentes de commit; entrega externa não validada |
| 22.3.4 | Comentários e Reações | Próxima etapa; planejados |
| 22.3.5 | Conquistas e Desafios | Planejados |

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

## 22.3.4 — planejados: Comentários e Reações

### Contratos e autorização futuros

Comentários ligados ao devocional publicado e autor autenticado no servidor;
texto simples de 1 a 2.000 caracteres após trim, sem HTML, links automáticos,
upload, mensagens diretas ou perfis públicos. React escapa o texto; servidor
normaliza/valida tamanho e caracteres. Paginação por cursor e limite de página.

Um comentário principal por `(usuário, devocional)`, editável/excluível pelo próprio
autor. Estados `pending`, `approved`, `hidden`, `deleted`; edição de aprovado volta
a pending e retira versão anterior da leitura pública. Autoria e status não
editáveis pelo cliente. Controle de versão impede aprovação de texto substituído.
Publicação retirada do acervo retira seus comentários da leitura pública.

RLS: somente autor e OWNER podem ler pendentes/ocultos, quando houver sessão
válida; leitores autenticados veem apenas aprovados de publicação visível.
Anon não lê nem escreve. Projeção pública autenticada retorna username e texto,
data/ID opaco do comentário necessário às ações, nunca UUID Auth, contatos ou
metadados. Conta sem username não publica até regularizar, sem expor identidade
alternativa. Histórico/moderação não entram na projeção dos leitores.

Uma reação ativa por usuário/devocional, enum `like`/`dislike`, única no banco,
editável/removível pelo próprio usuário. Sem payload de autoria confiável do
cliente; atribuir por `auth.uid()`. Leituras de reações individuais privadas;
eventuais totais públicos só por projeção agregada autorizada. Não inventar
contagens no cliente ou usar reação como conclusão/conquista.

Denúncia por autor autenticado com categoria e observação limitada; unicidade
por denunciante/comentário ativo, rate limit servidor. Leitor não vê denunciantes
ou denúncias de terceiros. Reportar não oculta automaticamente conteúdo, evitando
brigadas. Rate limit de criação/edição/reação/denúncia e cooldown transacionais;
nenhum bloqueio depende só de botão desabilitado no frontend.

OWNER exclusivamente pode aprovar/ocultar/excluir por operações de servidor com
motivo obrigatório e versão esperada. Diário privado transacional: ator, ação,
instante, motivo/referência e alvo; não copiar conteúdo em logs gerais. Editorial
e futuro PUBLISHER não herdam moderação. Não ampliar administração existente.
Definir política de conteúdo acessível antes de publicar comentário: respeito,
sem assédio, exposição de dados pessoais, spam ou pedidos de contato privado.

### Retenção e validação antes de publicação

Proposta para decisão expressa do responsável, não política já ativa: pendentes
sem decisão expiram após 30 dias; pedidos de exclusão retiram imediatamente o
texto da leitura e removem corpo após janela operacional de até 30 dias; denúncias
resolvidas por 90 dias e diário de moderação por 180 dias com minimização de texto.
Comentários aprovados permanecem até exclusão/moderação/publicação retirada;
definir também limite de retenção por inatividade antes do lançamento. Exclusão
de conta remove corpo/autoria pública e reações; somente referência mínima
restrita para auditoria pelo prazo aprovado. Avaliar backups e restaurações para
não ressuscitar exclusões. Essa decisão não altera a retenção atual nesta rodada.

Testar matriz de autor/outro leitor/OWNER/editorial/anon, IDOR, falsificação,
pendentes, edição concorrente à aprovação, retirada de publicação, texto malicioso,
tamanhos extremos, spam, dupla reação concorrente, denúncias e expurgo. Entrega
futura exige fluxo de moderação operacional, política aprovada e migrações novas.

## 22.3.5 — planejados: Conquistas e Desafios

Distintivos de 3, 7, 14, 30, 60 e 100 dias consecutivos, conquistados somente por
conclusões válidas. Não usar aberturas, likes, push aberto ou edição de metadados.
Backend calcula a partir do mesmo ledger; não aceitar contadores do cliente.

Registro privado de conquista `(usuário, código, versão)` único, instante do
servidor e referência mínima de evidência. Registrar na transação de conclusão
ou job idempotente de reconciliação; serializar por leitor para concorrência.
Reconciliação inicial apenas por operação futura revisada, sem nova conclusão
fictícia. Conquistas são preservadas quando a sequência reinicia. Exclusão ou
correção excepcional de recibos precisa de política explícita, sem perda silenciosa.

Desafio semanal privado, opt-in, exemplo: três dias distintos com conclusão na
semana de segunda a domingo de Brasília. Escolha/versionamento da regra explícitos;
adesão só conta eventos após adesão, sem obrigar compensação de dias perdidos.
Progresso é consulta ao ledger, não coluna editável. Resultado final e conquista
idempotentes; mudança de regra não reinterpreta desafio em andamento. Sair não
expõe histórico nem remove distintivos já obtidos; adesão/abandono sem punição.

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
