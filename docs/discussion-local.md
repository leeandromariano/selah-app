# Etapa 22.3.4 — reflexões, reações e moderação local

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



Base `2a60697`, branch `feat/local-auth`, árvore limpa no diagnóstico. Somente
ambiente local. Nenhum staging, commit, push, publicação ou Web Push externo.
22.3.5 não iniciada. Não se afirma conformidade legal definitiva: comunidade com
adolescentes e tratamento de dados de caráter religioso exigem revisão específica
antes de qualquer abertura pública.

## Diagnóstico e arquitetura

React/TypeScript/Vite com rotas hash e Auth local; ReaderLibrary já carrega somente
o acervo publicado autorizado, com leitura/progresso de 60 segundos separado de
ShareDevotional. App remonta conteúdo ao trocar user ID. OWNER usa membership
privada `private.app_owner`, independente de editorial `private.admin_users`.
Não havia comentários ou reações no início desta rodada.

`DiscussionSection` fica após compartilhamento e progresso no final da leitura
publicada, inclusive o destino `/compartilhar` da notificação. É independente de
conclusão: não chama RPCs de tempo, conclusão ou consistência. Nenhum contador de
leitura é escrito ou calculado por reações/comentários. Aparência usa tokens
semânticos existentes, foco visível, botões nativos e CSS com quebra de texto.

`#admin/moderacao` preserva rota com F5 e mostra filas Pendentes, Denúncias e
Histórico de ações. Link aparece após confirmação da capability OWNER no servidor;
entrar pela URL não substitui a autorização. Cada consulta/decisão verifica
novamente a membership existente. O fluxo administrativo anterior continua com
seus mesmos guards; nenhuma conta é promovida nem novo OWNER provisionado.

Repository de discussão usa oito RPCs próprias e nenhuma escrita direta em tabela.
Não recebe autoria, status de publicação ou nome de papel do navegador. Testes de
interface simulam a fronteira Supabase; unitários não importam cliente real.

## Reações e contagens

Uma linha por `(devocional, usuário)` garante unicidade no banco. `like`, `dislike`
ou null (remoção), editáveis pelo próprio usuário derivado de `auth.uid()`.
Mesma intenção é idempotente. Reações são privadas: v1 mostra apenas a escolha do
próprio leitor, sem contagem agregada, votantes ou ranking. Isso evita pressão
social e exposição desnecessária; contagens públicas não foram consideradas
apropriadas nesta versão. Reagir não exige concluir a leitura.

## Comentário principal, estados e concorrência

Texto de 1 a 1000 caracteres, com trim, validação servidor de tamanho/controles,
username já existente e publicação disponível. Sem dados pessoais novos. Uma
linha principal por usuário/devocional, com versão inteira e ID opaco do comentário.
IDs internos necessários a operações nunca são exibidos como identidade do autor.

| Origem | Ação | Destino / efeito |
| --- | --- | --- |
| Sem comentário ou removido | Autor envia texto | Pendente |
| Pendente, aprovado, rejeitado ou oculto | Autor altera texto | Pendente; versão aumenta; sai da lista pública |
| Pendente | OWNER aprova | Aprovado |
| Pendente | OWNER rejeita com motivo | Rejeitado |
| Aprovado | OWNER oculta com motivo | Oculto |
| Aprovado com denúncias | OWNER mantém aprovado | Fecha denúncias e audita revisão |
| Qualquer estado com texto | Autor confirma remoção | Removido; texto apagado imediatamente |
| Não aprovado há mais de 30 dias | Manutenção privada | Removido; texto apagado |

Servidor também aceita reaprovação explícita pelo OWNER de oculto/rejeitado;
na interface desta versão o autor pode editar/reencaminhar para a fila pendente.
Estados não são parâmetros livres de escrita. Moderação e edição usam versão
esperada, bloqueio de linha e rejeição `40001` para não aprovar texto substituído.
Repetição da mesma intenção já confirmada é segura, incluindo resposta perdida.
Mesmo texto não altera uma aprovação existente nem consome quota novamente.

Texto é renderizado pelo React como texto, com quebra de linha. HTML não é
executado e URLs não viram links automáticos. Não há imagens, anexos, chat,
respostas em cadeia ou perfis públicos. Campo HTML `maxLength` conta unidades
UTF-16; por isso alguns emojis podem atingir o limite visual antes do limite
servidor de caracteres Unicode. Essa restrição conservadora não amplia o limite.

Leitores veem aprovados com username e dia aproximado de Brasília, não timestamp
exato ou UUID Auth, e-mail ou telefone. O autor também vê seu próprio estado/texto
pendente, rejeitado ou oculto. Rascunho fica só na memória da seção; atualizar
preserva texto não enviado. Logout/troca de conta/publicação desmontam o componente
e respostas antigas são descartadas. Erros não são apresentados como fila vazia.

## Moderação, adolescentes e denúncia

A Política de privacidade e esta documentação esclarecem que o aprovado será
visível a leitores autenticados e **não é confidencial**. Os avisos removidos dos
formulários nos Prompts 53–55 não foram reintroduzidos. Política da v1:

- Não aprovar contatos (telefone/e-mail/endereço/perfis para contato), exposição
  de terceiros, relatos identificáveis ou informações íntimas desnecessárias.
- Rejeitar assédio, ameaça, intimidação, spam e conteúdo que coloque alguém em
  risco; ocultar imediatamente uma versão aprovada que infrinja a política.
- Evitar discussão pública sobre uma denúncia ou identidade do denunciante.
- Comentários não são canal privado de acolhimento ou emergência. Procedimentos
  operacionais para riscos graves e atendimento a menores precisam de revisão
  especializada antes de disponibilização pública; não há promessa de resposta
  imediata nem detecção automática de dados pessoais/violência.

Moderação é humana: todos os envios ficam pendentes, incluindo texto com contatos;
nenhum classificador automático promete removê-los. OWNER escolhe motivo
estruturado: contato, assédio, ameaça, exposição, spam ou outro; aprovação usa
`reviewed`. Registro mínimo contém comentário, ator interno, ação, versão, motivo
e instante; **não contém snapshots antigos do texto**. Interface mostra username,
data aproximada e ação. OWNER continua responsável por revisar o conteúdo integral.

Denunciar é permitido em comentário aprovado de outra pessoa e publicado naquele
momento. Uma denúncia por autor/comentário/versão; retry não duplica. Categorias
estruturadas evitam coletar dados pessoais em observações livres. Demais leitores
não veem denúncias alheias nem denunciantes; OWNER vê categoria/data, sem lista
de denunciantes. Edição, remoção e decisão resolvem denúncias da versão anterior.
Rate limit global por conta reduz abuso entre devocionais. Conta múltipla/ataque
distribuído e decisões humanas equivocadas não são resolvidos por esses limites.

## Modelo de dados e matriz de acesso

Migração incremental `20261028000700_discussion.sql`, aplicada somente localmente
após teste em PostgreSQL temporário. Treze migrações anteriores preservadas byte a
byte em relação a `2a60697`. Sem backfill ou alteração de usuários, recibos de
leitura, assinatura push, regras RLS anteriores ou memberships existentes.

Tabelas privadas com RLS e sem grants de leitura/escrita às roles API:
`discussion_comments`, `discussion_reactions`, `discussion_reports`,
`discussion_audit`, `discussion_limits`. Unicidades e checks ficam no banco.

| Acesso | Anônimo | Leitor autenticado ativo | Editorial/PUBLISHER | OWNER |
| --- | --- | --- | --- | --- |
| Ler aprovados em publicado | Não | Sim | Como leitor | Como leitor |
| Ver próprio estado/texto e reação | Não | Sim | Somente próprios | Somente próprios na leitura |
| Editar/remover/reagir | Não | Somente próprios | Somente próprios | Somente próprios |
| Ler pendentes alheios / filas / auditoria | Não | Não | Não | RPC exclusiva |
| Aprovar/rejeitar/ocultar | Não | Não | Não | RPC exclusiva |
| Acesso bruto às tabelas privadas | Não | Não | Não | Não pela role API |
| Executar manutenção | Não | Não | Não | Não pela role API; operador servidor |

RPCs: `get_devotional_discussion`, `set_my_devotional_reaction`,
`save_my_devotional_comment`, `remove_my_devotional_comment`,
`report_devotional_comment`, `get_my_discussion_access`, `get_owner_discussion`,
`moderate_devotional_comment`. SECURITY DEFINER com owner postgres e search_path
fixo vazio; helpers privados sem EXECUTE público. O acesso privado é projetado
explicitamente por autoria/estado, não liberado por grant amplo. `service_role`
também não recebe grant nesses objetos. Cadastro confirmado, conta ativa e
membership OWNER vêm de tabelas servidor, nunca de metadata/parametro do cliente.

Publicação é revalidada no servidor; SHARE lock serializa gravações com retirada
do devocional. Remoção própria não depende de publicação disponível, para permitir
erasure mesmo após retirada. A interface de leitura retirada não oferece esse
formulário; nesse caso usar atendimento local autorizado/rotina de privacidade.
Conteúdo retirado não aparece na projeção dos leitores; OWNER pode revisar filas.

## Limites de frequência e retentativas

Advisory transaction lock por usuário coordena as mutações; locks de comentário
e versões coordenam autor/moderador. Quotas persistentes fixas no servidor:

| Operação | Limite |
| --- | --- |
| Envio/edição de comentário | 5 por hora UTC, somando todos os devocionais |
| Alteração/remoção de reação | 60 por hora UTC |
| Nova denúncia | 5 por dia UTC |
| Decisão de moderação | 120 por hora UTC do moderador |

São janelas fixas: a borda de uma janela pode permitir dois lotes próximos.
Exceder retorna `P0429`, sem alterar o conteúdo. Remoção de texto próprio não
tem quota que impeça apagar conteúdo sensível. Intenções repetidas/no-op não
consomem quota. Não há retry automático de gravação na UI: consultar resultado
antes de repetir. Conflito preserva rascunho e exige atualizar seção/versão.

## Retenção e exclusão

- Remoção própria apaga texto imediatamente. Uma tombstone de versão/unicidade
  permanece enquanto conta/devocional existirem; não contém o texto apagado.
- Pendentes/rejeitados/ocultos há mais de 30 dias têm texto apagado pela rotina.
- Aprovados permanecem enquanto conta/devocional existirem, até remoção própria
  ou moderação. Não há garantia de apagamento de cópias já vistas por leitores.
- Denúncias resolvidas: 30 dias; todas as denúncias e auditoria: máximo de 90 dias
  quando a manutenção é executada. Quotas: buckets de mais de dois dias removidos.
- Exclusão legítima de conta/devocional cascata dados vinculados; nenhuma conta
  existente foi excluída por esta implementação. Não se altera o fluxo anterior
  de pedido de exclusão de conta para análise manual.

```cmd
node scripts/apply-local-discussion-migration.mjs
node scripts/local-discussion-readonly-http.mjs
```

Manutenção opt-in do operador, **não executada sobre dados existentes nesta rodada**:

```cmd
node scripts/local-discussion-maintenance.mjs --cleanup
```

A rotina não é pública nem executada no navegador. Nenhum agendador de sistema
foi instalado; o responsável precisa operacionalizar sua execução periódica.
Prazos não são garantidos com operador/serviço parado. Não há dependência nem
mudança nas regras do worker Web Push. Volumes/backups exigem proteção própria;
RLS não equivale a criptografia em repouso. Não há conteúdo de denúncia/endpoint
em logs novos da aplicação. Somente dados fictícios usados nos testes.

## Validações e limitações

Resultados reais em [testing.md](testing.md). SQL/RLS e concorrência são reais em
PostgreSQL novo/descartável, com fixtures próprias e rollback nas suítes principais.
Concorrência precisa de fixtures fictícias commitadas apenas nesse contêiner
isolado, para visibilidade entre conexões; nunca sobre o banco existente.
Chromium usa backend e sessões simulados, com DOM/navegação reais. Não substitui
teste manual com duas contas locais nem validação HTTP positiva autenticada.
Firefox/Safari/dispositivos físicos, leitor de tela e conformidade legal não
foram validados. Bundle DEV permanece acima de 500 kB.

Interface de leitura não busca novos comentários automaticamente em background;
botão Atualizar preserva rascunho. UI de moderação revalida a cada consulta/ação,
sem websocket de revogação. Política exige capacidade operacional de revisão
humana; não publicar enquanto isso, privacidade/menores e retenção não forem
revisados. Nenhuma nova aprovação manual foi informada pelo responsável.

## Checklist manual — leitor

- [ ] Abrir publicado, ver compartilhamento e reflexão antes de concluir.
- [ ] Gostei → Não gostei → remover, sem conclusão/contagem pública.
- [ ] Enviar texto, conferir pendência própria; outra conta não vê pendência.
- [ ] OWNER aprova: conferir username/data, texto puro e ausência de contatos.
- [ ] Editar aprovado: some da lista até nova moderação; remover apaga texto.
- [ ] Denunciar aprovado de outra pessoa; repetir não gera duplicidade.
- [ ] Rascunho/erro/limite/refresh; logout e troca de conta limpam conteúdo privado.
- [ ] Teclado, foco, Claro/Escuro/Sistema e janela pequena/celular.
- [ ] Leitura 60 segundos, ofensiva, Jornada e lembretes/compartilhamento preservados.

## Checklist manual — OWNER

- [ ] Abrir Moderação de reflexões no painel; F5 mantém rota.
- [ ] Revisar texto completo, aprovar/rejeitar com política adequada a adolescentes.
- [ ] Examinar denúncias e ocultar contatos/assédio/ameaças/exposição/spam.
- [ ] Consultar histórico sem snapshots de conteúdo apagado ou denunciantes.
- [ ] Autor edita enquanto fila aberta: versão antiga não pode ser aprovada.
- [ ] Leitor e conta editorial não acessam fila nem decisões por URL/RPC.
- [ ] Retirada de OWNER bloqueia próxima consulta/decisão.
- [ ] Definir operação periódica de retenção, atendimento e revisão legal antes
  de qualquer publicação. Não executar limpeza sobre dados existentes sem escopo.

## Prompt 53 — limpeza visual e coluna de leitura

Relato do responsável: textos excessivos na seção de comentários e cartões de
compartilhamento/comentários mais largos no desktop. Nenhuma imagem veio anexada
nesta rodada. O problema foi reproduzido por medição real no Chromium, viewport
1440 px: artigo/pergunta/progresso com 690 px e esquerda 489,5 px; compartilhar
e comentários com 1085 px e esquerda 292 px. Causa: os dois últimos eram irmãos
fora do artigo `.reading`, único elemento com max-width de 690 px.

Agora `.reading-column` é o contêiner comum, com largura de 100%, max-width 690 px
e centralização por margens automáticas. Variáveis CSS compartilhadas controlam
padding responsivo e espaçamento dos cartões (versículo, pergunta, progresso,
compartilhamento e reflexão). Não há compensação por margem lateral fixa.
Artigo, cartões e campos usam min-width/max-width e quebra de texto coerentes.
Estados de carregamento, vazio e erro mantêm a mesma largura da seção.

Ordem: conteúdo → pergunta, quando existir → progresso/conclusão → compartilhar
→ comentários. ShareDevotional é reutilizado sem alteração funcional. O CSS é
restrito à coluna de leitura; outras páginas `.reading` não foram redesenhadas.

Os três parágrafos extensos indicados pelo responsável foram removidos da seção,
sem remover regras de privacidade, anti-spam, denúncia ou moderação. Junto ao
formulário permanece, associado por aria-describedby, o aviso curto:

> Envios ficam pendentes de moderação. Após aprovação, a reflexão será visível a leitores autenticados.

A Política de privacidade conserva as informações completas. Nada virou conteúdo
acessível sem login; autorização, RLS, banco, OWNER, quotas, reações, conclusões e
Web Push não foram alterados. Não houve SQL, migração, limpeza ou envio externo
nesta rodada. Resultados de banco da seção anterior são históricos do Prompt 52.

Validação desta correção: 465 unitários/integração UI em 43 arquivos, build DEV,
lint e diff aprovados. Chromium: 44 verificações novas de geometria/layout/estados,
mais 39 discussão, 28 lembretes/compartilhamento, 18 navegação e 88 aparência,
total 217 verificações. Backend/sessões simulados; DOM, tamanhos, foco e viewport
reais. Contraste de texto parcialmente automatizado; não substitui leitor de tela
ou testes em dispositivos físicos. Nenhuma aprovação manual nova presumida.

Seis capturas sintéticas foram geradas e as versões claras desktop/mobile
inspecionadas visualmente, em pasta ignorada:
`node_modules/.cache/selah-reading-layout/{desktop,mobile}-{light,dark,system}.png`.
Elas não são candidatas ao commit. Sem rolagem horizontal a 390 px, inclusive com
texto sem espaços de 980 caracteres e username fictício de 24 caracteres.

Arquivos ajustados nesta correção: ReaderLibrary.tsx, App.css, DiscussionSection.tsx,
discussion.css, seus dois arquivos de testes, script local-navigation-browser.mjs,
este documento e testing.md. ShareDevotional foi inspecionado; seu comportamento
não precisou mudar. Total da Etapa 22.3.4: **23 candidatos, 11 modificados/12 novos**.

Checklist curto: conferir alinhamento desktop, avisos reduzidos junto ao envio,
mobile sem overflow, Claro/Escuro/Sistema, cópia/compartilhamento e envio pendente
antes/depois da conclusão. Regras de leitura e moderação continuam cobertas pelas
regressões. Sem staging, commit, publicação ou início da Etapa 22.3.5.

## Resultado da implementação inicial — Prompt 52

462 testes em 43 arquivos, build DEV e lint aprovados. Chromium: 39 de discussão,
28 de lembretes/compartilhamento, 18 de navegação/Jornada/OWNER e 88 de aparência,
total 173. PostgreSQL novo: 14 migrações, 386 verificações SQL/RLS, duas de
concorrência de lembretes e quatro de discussão. HTTP local negativo: 13. Builds
STAGING/PROD bloqueados conforme contrato; `git diff --check` aprovado.
Resultados e falhas intermediárias estão detalhados em `testing.md`.

## Prompt 54 — remoção de textos e subtítulo literal

Executado depois da conclusão do Prompt 53, aproveitando sua coluna, padding e
responsividade. Ajustes exclusivamente de apresentação:

- Retirados o contador textual de segundos, a explicação extensa do progresso
  e a nota de que o histórico registra aberturas. A barra mantém max 60000 e nome
  acessível; botão e estado continuam controlados pelos mesmos valores servidor.
- Retirados os três parágrafos que compunham o bloco explicativo do compartilhamento,
  sem avisos substitutos. Compartilhar, Copiar link e WhatsApp continuam com os
  mesmos handlers, destinos seguros e autenticação do conteúdo.
- Subtítulo substituído literalmente por: **Comente aqui o que você aprendeu e
  refletiu com essa devocional.** No código/UI é uma única frase, sem reformulação.
- Não foi adicionada a frase extra rejeitada nem reintroduzidos os três parágrafos
  removidos no Prompt 53. O aviso breve já existente do formulário não foi ampliado.
  Informações institucionais completas permanecem na Política e documentos próprios.

Nenhuma alteração de contagem, confirmação, conclusão, persistência, ofensivas,
autenticação, RLS, moderação, OWNER ou Web Push. Nenhuma operação no banco nesta
rodada. Os testes de apresentação foram atualizados mantendo os testes funcionais
de 59999/60000 ms, clique voluntário, cópia/compartilhamento, denúncias e segurança.

O Chromium mede novamente todos os cartões em 690 px no desktop, com o mesmo
alinhamento. Desktop/mobile, estados, contraste e os três temas permanecem cobertos.
As capturas na pasta ignorada de leitura foram atualizadas com a nova apresentação.
Nenhuma aprovação manual nova foi presumida; resultados desta rodada em `testing.md`.

Arquivos ajustados neste Prompt: ReadingProgress.tsx, ReaderLibrary.tsx,
ShareDevotional.tsx, DiscussionSection.tsx, ReadingProgress.test.tsx,
ReaderLibrary.test.tsx, DiscussionSection.test.tsx, App.test.tsx,
local-navigation-browser.mjs e os dois documentos de discussão/testes.

## Prompt 55 — formulário sem avisos e sem confirmação de envio

Removidos da área de comentários os três textos solicitados: a explicação após
o contador, o aviso de pendência/visibilidade e a confirmação de envio. Não há
frase substituta após salvar. A indicação própria **Pendente de moderação** é
mantida como estado do comentário, sem confundi-la com confirmação de envio.
As regras continuam documentadas aqui e na Política de privacidade, sem alteração
dessas páginas ou das regras efetivas de autorização/moderação.

O contador permanece como `N/1000 caracteres`, atualizando ao digitar e ligado à
textarea por aria-describedby. `maxLength=1000`, bloqueio acima de 1000, estado
pendente retornado pelo servidor, edição/remoção, reações, denúncia e erros foram
preservados. Não há mudança de banco, RLS, quotas, OWNER, leitura, compartilhamento
ou Web Push. Título/subtítulo exatos e a coluna dos Prompts 53/54 permanecem.

Testes novos/ajustados verificam digitação real de texto, contadores 0/2/1000/1001,
ação bloqueada acima do limite e envio válido de 1000 caracteres para pendência,
sem mensagem de sucesso substituta. Também validam os três temas e fila OWNER.
Somente o mock Chromium de renovação de foco foi corrigido para usar a conta
fictícia atual, em vez de retornar à inicial após troca de conta; nenhum código
de autenticação/notificações do aplicativo foi alterado.

Resultados: 466 testes em 43 arquivos, build DEV/lint/diff aprovados; Chromium
54 layout, 43 discussão, 28 lembretes, 18 navegação e 88 aparência — 231 no total.
Integrações são simuladas nas fronteiras, com DOM/viewport reais; não houve envio
externo. SQL/HTTP não repetidos nesta mudança visual. Nenhuma nova aprovação manual.

Arquivos ajustados neste Prompt: DiscussionSection.tsx, DiscussionSection.test.tsx,
local-navigation-browser.mjs, discussion-local.md e testing.md. Quantidade de
candidatos continua **27: 15 modificados e 12 novos**, sem staging/commit.

## Arquivos candidatos consolidados — Prompt 55

27 arquivos candidatos (15 modificados e 12 novos), sem novas dependências,
segredos, arquivos de ambiente, logs ou caches identificados. Staging vazio.
Migração incremental aplicada apenas localmente; nenhuma alteração de usuário,
leitura, OWNER ou dado preexistente. Sem envio externo, commit ou publicação.

Modificados:

```text
docs/development-workflow.md
docs/journey-roadmap.md
docs/testing.md
scripts/local-navigation-browser.mjs
scripts/verify-local-reading-install.mjs
src/App.css
src/App.test.tsx
src/App.tsx
src/components/AdminPanel.tsx
src/components/PrivacyPolicy.tsx
src/components/ReaderLibrary.test.tsx
src/components/ReaderLibrary.tsx
src/components/ReadingProgress.test.tsx
src/components/ReadingProgress.tsx
src/components/ShareDevotional.tsx
```

Novos:

```text
docs/discussion-local.md
scripts/apply-local-discussion-migration.mjs
scripts/local-discussion-maintenance.mjs
scripts/local-discussion-readonly-http.mjs
src/components/DiscussionSection.test.tsx
src/components/DiscussionSection.tsx
src/components/ModerationPanel.tsx
src/discussion/discussion.css
src/discussion/repository.ts
supabase/migrations/20261028000700_discussion.sql
supabase/tests/discussion-concurrency.sql
supabase/tests/discussion.sql
```
