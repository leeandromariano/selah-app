# Etapa 22.3.3 — Lembretes inteligentes locais

Base `91c81d0`, branch `feat/local-auth`. Implementação exclusivamente local;
nenhum staging, commit, publicação ou envio a provedor push foi executado.
Comentários/Reações (22.3.4) continuam sendo a próxima etapa; conquistas não iniciadas.

## Prompt 51 — validação manual informada pelo responsável: 15 aprovações

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

Transcrição literal das aprovações do responsável, sem atribuir execução manual
ao agente ou estender aprovação a outros cenários. Isso não comprova envio ou
recebimento Web Push remoto. Entrega real não está configurada nem validada.
Implementação local pendente de commit. Resultados repetidos no Prompt 51 em
[testing.md](testing.md); resultados das rodadas anteriores são históricos.

## Arquitetura anterior e preservação

React/TypeScript/Vite, rotas por hash, Auth local e aparência Claro/Escuro/Sistema.
Não havia service worker. `devotional_completions` contém conclusões válidas de
60 segundos; aberturas e contadores do navegador não comprovam leitura.
O calendário/Minha Jornada e a RPC pessoal permanecem intactos. Não há alteração
de migrações anteriores, regras de leitura, perfis, contas, OWNER ou editorial.

Agora `#configuracoes` contém Lembretes, apenas para leitor autenticado fora de
recuperação. O repositório faz RPC própria, sem receber ID do proprietário.
O agendador Node usa socket PostgreSQL local e pode continuar sem uma aba aberta.
O transporte padrão registra intenções no servidor, sem acesso a serviço push.
O adaptador real usa `web-push` somente no processo Node, nunca no bundle React.

## Decisão imediatamente anterior à tentativa

1. Buscar dispositivos ativos, conta elegível, permissão registrada concedida,
   sessão Auth ainda existente e preferência explicitamente habilitada.
2. Reservar atomicamente uma tentativa diária e avançar o próximo horário.
3. Antes do transporte, revalidar preferência, sessão, dispositivo, vínculo,
   expiração, prazo de reserva e dia civil de Brasília.
4. Consultar publicação visível de hoje em Brasília. Sem publicação: marcar
   `unavailable`, sem payload nem link. Rascunho/futuro nunca é destino.
5. Consultar conclusões válidas **no banco**, não no navegador: sem conclusão,
   LEITURA; com uma ou mais, COMPARTILHAMENTO. Consulta considera qualquer
   conclusão válida no dia de Brasília, preservando a regra existente.
6. Marcar `dispatching` antes da chamada ao transporte e registrar seu resultado.

Mensagens estáticas do service worker:

| Tipo | Título | Mensagem |
| --- | --- | --- |
| Leitura | Seu momento com Deus está esperando! | Que tal separar alguns minutos para a Palavra hoje? |
| Compartilhamento | Que tal compartilhar a Palavra hoje? | Convide um amigo para conhecer o devocional de hoje. |

O payload contém versão, tipo, vínculo opaco, data e ID da publicação. Não contém
nome, e-mail, telefone, contatos, métricas ou tokens. O tipo revela a finalidade
do convite, mas o texto de compartilhamento não anuncia conclusão nem desempenho.
Novos textos podem ser alterados no protocolo sem mudar a autorização.

## Preferências, permissão e dispositivos

São três estados independentes: preferência da conta; permissão do navegador;
assinatura deste dispositivo. Nada é ativado no cadastro, login ou carregamento.
Salvar horário não solicita permissão nem cria assinatura. A permissão nativa
é solicitada somente pelo botão voluntário. Negação não causa nova solicitação.
API ausente/contexto inseguro mostra explicação, mantendo o restante do app útil.

Preferência de ativação vale para a conta; horário `HH:mm` e fuso IANA valem para
o dispositivo. F5 restaura do servidor. Alterações do sistema não sobrescrevem
silenciosamente o fuso salvo: o leitor vê o detectado e escolhe adotá-lo.
Não há dados pessoais na preferência de aparência, que permanece independente.

Cada conta possui credencial aleatória de dispositivo no storage local. Somente
seu hash vai ao banco. Ela não substitui a sessão Auth. Storage indisponível não
cria inscrição órfã; valor inválido é ignorado. Endpoints e chaves de criptografia
não são persistidos pelo app no localStorage nem retornados na projeção de consulta.
O navegador mantém sua própria PushSubscription. Não há sincronização de contas
via identidade de dispositivo. Limite de dez registros por conta.

Limpar/corromper storage pode perder a credencial de uma inscrição já existente.
O vínculo local é apagado e não se tenta recuperar segredo automaticamente.
Nesse caso, desativar lembretes da conta bloqueia todas as próximas tentativas;
reativação de um endpoint ainda preso à inscrição antiga pode exigir expiração
ou intervenção local autorizada nas novas tabelas. Recuperação automática dessa
situação não foi implementada nem validada com provedor real.

Sair cancela este dispositivo, tenta unsubscribe e limpa o vínculo/notificações
locais. Falhas nessas operações não impedem logout. O agendador também exige a
sessão Auth vinculada. Login posterior exige nova inscrição voluntária; preferência
e horário persistem. Outros dispositivos conservam suas inscrições. Mudanças de
conta/recuperação limpam o vínculo; respostas antigas não podem reativá-lo.

## Modelo de dados e RLS

Migração incremental `20261028000600_smart_reminders.sql`, aplicada somente ao
Supabase local após teste isolado. Sem backfill e sem opt-in de contas existentes.

| Objeto | Finalidade / acesso |
| --- | --- |
| `public.reminder_preferences` | Ativação por usuário; SELECT próprio por RLS, sem escrita direta |
| `private.push_devices` | Proprietário, hash, sessão, horário/fuso, próximo UTC, estado, assinatura, vínculo e prova; sem acesso de clientes |
| `private.reminder_attempts` | Reserva, datas, tipo, conteúdo, resultado; somente servidor |
| `private.push_configuration` | Modo e VAPID **público**; padrão simulation; somente operador altera |

RPCs autenticadas: `get_my_reminders`, `save_my_reminders`,
`revoke_my_push_device`, `confirm_my_push_device`. Propriedade deriva de
`auth.uid()` e credencial de dispositivo, com `search_path` fixo. Não há argumento
de user ID nem função pública de disparo. Funções de agendamento/transporte e
tabelas privadas não são concedidas a anon, authenticated ou service_role.
OWNER e editorial usam o mesmo papel API e não herdam acesso às inscrições.

Endpoints reais aceitam HTTPS somente em hosts de provedores conhecidos;
endpoints de simulação só em `push.test.invalid`. Assinaturas reais ficam
pendentes até confirmação de prova criptografada recebida pelo endpoint e
devolvida via RPC da própria conta. Isso evita ativar um endpoint alheio apenas
por conhecer sua URL/chaves. O aviso de confirmação é visível, não push silencioso.
Provas expiram em dez minutos; nova inscrição explícita é necessária para repetir.
VAPID privado fica exclusivamente no ambiente do processo servidor, fora de VITE.

## Horários, datas diferentes e horário de verão

Agendamento segue o fuso IANA do dispositivo; publicação, conclusão e decisão
seguem **America/Sao_Paulo**. A data local agendada não redefine o dia da leitura.

| Instante UTC | Dia local | Dia de Brasília e decisão |
| --- | --- | --- |
| 2026-10-28 01:00Z | Auckland: 28/10 | Brasília: 27/10; consultar publicação/conclusões de 27/10 |
| 2026-10-28 04:00Z | Los Angeles: 27/10 | Brasília: 28/10; consultar publicação/conclusões de 28/10 |

Assim, “hoje” na notificação significa o dia editorial de Brasília, que pode
ser ontem ou amanhã no calendário local. A configuração explica essa diferença.
No intervalo de horário de verão inexistente, usar o primeiro minuto local
válido posterior (New York 08/03/2026 02:30 → 03:00). Hora repetida usa a primeira
ocorrência (01/11/2026 01:30 → 05:30Z), sem repetir a segunda. Data civil inteira
suprimida (Apia 30/12/2011) não recebe aviso; agenda segue para data válida futura.
Os testes usam relógio fixo; o banco mantém regras IANA, não offset fixo.

Salvar/reativar agenda somente um horário estritamente futuro. O worker aceita
atraso inferior a 15 minutos. Depois disso, avança sem reservar/envio retroativo;
indisponibilidade longa não gera um lote de mensagens atrasadas. Reservas com
mais de dois minutos ou que atravessam meia-noite de Brasília não são enviadas.
Recebimento no SW após mudança de dia de Brasília também é descartado (relógio
do dispositivo é apenas proteção contra mensagem antiga, nunca prova de leitura).
Notificações já exibidas podem permanecer no centro do sistema até serem fechadas;
o app não promete removê-las remotamente enquanto estiver offline.

## Deduplicação, falhas e retenção

`FOR UPDATE SKIP LOCKED` coordena workers. Constraints únicas em
`(user_id, device_id, brt_day)` **e** `(user_id, device_id, local_day)` impedem dois
tipos no mesmo dia e reenvio por edição de fuso/horário. São limites conservadores:
uma mudança de fuso pode suprimir uma ocorrência adicional. Múltiplas conclusões
ou conclusão posterior ao primeiro envio não geram outra mensagem.

Não há retry automático nesta versão. Aceite do provedor não comprova recebimento.
Timeout/queda após reserva ou envio tornam o resultado incerto e consomem o dia.
Falha conhecida também consome a ocorrência; próxima tentativa só em dia futuro.
404/410 expiram o dispositivo e apagam endpoint/chaves. Inscrições expiram em no
máximo 90 dias; renovação é explícita. Limpeza do worker remove tentativas após
31 dias e dispositivos inativos/revogados/expirados após 30 dias. Provas pendentes
com tentativa há dez minutos expiram. Exclusão legítima de conta cascata apenas
esses novos dados; nenhum usuário foi excluído por esta implementação.

Limitações: lote de até 100 reservas pode expirar parcialmente se o transporte
for lento; o próximo ciclo continua. Serviço parado não executa limpeza até voltar.
Nem Web Push nem esta estratégia garantem recebimento exatamente uma vez. Há
corrida inevitável entre a última consulta SQL e aceite pelo provedor: conclusão,
opt-out ou retirada do conteúdo podem ocorrer depois. Destino revalida publicação
e autenticação; vínculo local impede mostrar mensagem de conta anterior.

## Service worker e compartilhamento

`public/selah-sw.js`, escopo `/`, sem fetch handler ou cache de conteúdo/sessão.
Registro existente de outro script não é sobrescrito. IDB guarda só vínculo opaco
e prova, sem sessão ou contatos. Payload inválido/vínculo ausente é descartado;
clique aceita apenas rotas internas construídas pelo protocolo, foca janela da
mesma origem ou abre uma nova. `pushsubscriptionchange` invalida o vínculo;
não cria nova assinatura nem solicita permissão silenciosamente.

Compartilhamento usa `#leitura/<id>/compartilhar`, apenas para publicação retornada
pelo acervo autorizado. Link copiado contém somente origem e ID da publicação,
sem query, tokens ou dados pessoais. Não cria conteúdo público: destinatário deve
entrar/criar conta. Em localhost, o endereço não é publicamente acessível.
Web Share e clipboard só por clique; campo selecionável é fallback. WhatsApp
abre link externo por ação explícita, sem destinatário fixo, acesso a contatos ou
envio automático. Ao escolher esse serviço, o leitor transmite voluntariamente
o texto/link ao fornecedor; nenhum contato de amigo é armazenado no Selah.

### Prompt 50A — correção de visibilidade

Falha real informada pelo responsável: não encontrou compartilhamento ao abrir
um devocional. A causa era a condição `page.endsWith('/compartilhar')` em
ReaderLibrary: só o destino especial da notificação renderizava ShareDevotional,
e ainda antes do artigo. Não era uma regra de conclusão nem ocultação por CSS.

Agora a mesma seção aparece **depois do artigo completo e do progresso**, em toda
rota de leitura publicada autorizada, tanto normal quanto `/compartilhar`.
Há um botão sempre visível chamado **Compartilhar**, além de Copiar link e WhatsApp.
Quando Web Share existe, o botão abre a API nativa por clique; caso contrário,
copia o link e explica o fallback. Falha de clipboard mantém campo selecionável.
Não há dependência de tempo/conclusão, callback de conclusão ou contagem nova.
Os 60 segundos e a ação voluntária de concluir permanecem no controlador existente.

Regressões cobrem duas publicações, zero segundos com conclusão bloqueada,
transição ready → completed, rota normal/notificação, conteúdo indisponível e
leitor sem sessão. Chromium usa backend fictício: antes/depois, clipboard local,
WhatsApp sem navegação externa, três temas e viewport mobile. Aprovação manual
do Prompt 50A não havia sido informada naquela rodada; as quinze aprovações do
Prompt 51 estão transcritas acima. Checklist: abrir normalmente, rolar até o fim, compartilhar
antes de concluir, confirmar aviso de localhost/login, concluir legitimamente e
repetir; abrir também o destino `/compartilhar` e verificar uma única seção.

## Operação local e limites de suporte

```cmd
node scripts/apply-local-reminders-migration.mjs
node scripts/local-reminder-worker.mjs --once
node scripts/local-reminder-worker.mjs --watch
```

O primeiro comando é protegido por histórico exato e `--local`; nunca reset.
`--once`/`--watch` são simulação por padrão. `--watch` roda no processo Node
independente da aba; precisa permanecer ativo. Não foi instalado serviço do Windows,
cron remoto nem agendador de produção; supervisão/reinício e monitoramento serão
necessários antes de uma operação real confiável. Modo local não depende de
provedor externo. Registrar dispositivo fictício não representa permissão real.

O caminho real está implementado, **não executado/não validado**. Exige autorização
específica do responsável, opção `--real`, variável servidor
`SELAH_EXTERNAL_PUSH_AUTHORIZATION=EXPLICIT_AUTHORIZATION_OBTAINED`, VAPID público/
privado/subject no ambiente Node e configuração privada local modo `webpush` com
a mesma chave pública. Esse marcador operacional não substitui autorização humana.
Não colocar chave privada em comandos versionados, logs, VITE, frontend ou docs.
Nenhuma chave VAPID foi gerada nesta rodada. Não habilitar isso para repetir testes.

HTTPS é necessário fora de localhost. Chrome/Edge desktop e APIs Web Push foram
testados aqui somente em Chromium headless local; permissão/SW via CDP não provam
transporte por FCM/APNs/Mozilla. Android depende do navegador/sistema. iOS/iPadOS
compatível pode exigir web app instalado na Tela de Início e gesto do usuário.
Firefox, Safari, Android/iOS e dispositivos físicos **não foram testados**.
Restrições de energia, rede, modo privado e políticas do dispositivo podem impedir
registro/entrega. Não prometer suporte universal com navegador encerrado.

Referências técnicas: [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API),
[WebKit Web Push](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/),
[web-push servidor](https://github.com/web-push-libs/web-push).

## Privacidade, riscos e validação manual pendente

Endpoints/chaves são sensíveis, mesmo privados por ACL/RLS. A implementação não
adiciona criptografia em repouso ao volume Docker; proteção de backup, retenção
operacional e gestão/rotação de VAPID exigem revisão antes de produção. Avisos
podem revelar interesse religioso na tela bloqueada; adesão é voluntária e o texto
é genérico. Sem contatos, analytics, contadores novos ou histórico no payload.
Bundle DEV continua acima de 500 kB. Contraste automatizado é parcial; controles
nativos variam por navegador. As únicas aprovações manuais desta etapa são as
quinze transcritas no início deste documento.

- [ ] Claro/Escuro/Sistema, teclado e celular em Configurações e compartilhar.
- [ ] Alterar horário/fuso, salvar, F5 e confirmar restauração do próprio dispositivo.
- [ ] Permissão não solicitada, negada/revogada e navegador sem suporte.
- [ ] Ativar conta sem assinar não recebe; desativar impede próximas intenções.
- [ ] Cancelar dispositivo, logout, troca de conta e mensagens antigas em fila.
- [ ] Calendário/Minha Jornada: mês estável com Alt+Tab; F5 mantém rota.
- [ ] Compartilhar por clique, copiar, cancelar Web Share e WhatsApp sem envio automático.
- [ ] Link de conteúdo retirado exige autenticação e não expõe publicação privada.
- [ ] Após autorização futura específica: VAPID, assinatura/prova, navegador fechado,
  entrega real, 404/410 e matriz desktop/Android/iOS. Não aprovados nesta rodada.

Resultados executados e distinção entre simulação/integração: [testing.md](testing.md).

## Arquivos desta entrega

31 candidatos: 11 modificados e 20 novos (conferidos no Prompt 51).

```text
MOD  docs/development-workflow.md
MOD  docs/journey-roadmap.md
MOD  docs/testing.md
MOD  package-lock.json
MOD  package.json
MOD  scripts/local-navigation-browser.mjs
MOD  scripts/verify-local-reading-install.mjs
MOD  src/App.tsx
MOD  src/auth/AuthContext.tsx
MOD  src/components/ReaderLibrary.test.tsx
MOD  src/components/ReaderLibrary.tsx
NOVO docs/smart-reminders-local.md
NOVO public/push-protocol.js
NOVO public/selah-sw.js
NOVO scripts/apply-local-reminders-migration.mjs
NOVO scripts/local-reminder-worker.mjs
NOVO scripts/local-reminders-readonly-http.mjs
NOVO scripts/reminder-webpush-transport.mjs
NOVO scripts/reminder-worker-core.mjs
NOVO src/components/ReminderSettings.tsx
NOVO src/components/ShareDevotional.tsx
NOVO src/notifications/device.ts
NOVO src/notifications/reminders.test.tsx
NOVO src/notifications/repository.ts
NOVO src/notifications/session.test.ts
NOVO src/notifications/session.ts
NOVO src/notifications/sharing.ts
NOVO src/notifications/worker.test.ts
NOVO supabase/migrations/20261028000600_smart_reminders.sql
NOVO supabase/tests/reminder-concurrency.sql
NOVO supabase/tests/smart-reminders.sql
```

Auditoria dos candidatos: nenhum arquivo de ambiente, log, cache ou credencial
identificado. Chave privada VAPID ausente do código frontend e do bundle DEV.
As doze migrações anteriores permanecem sem diferenças em relação à base.

## Resultado da auditoria final — Prompt 51

Todos os candidatos, inclusive testes de ReaderLibrary, scripts, lockfile,
service worker e migração incremental foram revisados. Nenhum arquivo fora do
escopo ou segredo identificado; configurações privadas não entram na lista.
O lockfile acrescenta 17 pacotes do adaptador servidor `web-push` 3.6.7, sem
atualizar versões das dependências preexistentes. Staging permanece vazio.

Autorização: RPCs derivam usuário da sessão e exigem credencial própria para o
dispositivo; assinatura real começa pendente de prova recebida por canal cifrado.
A prova é consumida ao confirmar; nova reserva/preparação não reutiliza tentativa
já despachada. Não há RPC pública de disparo nem grants novos a OWNER/editorial.
Esse desenho foi revisado; entrega real/prova com provedor continuam não validadas.
Destino da notificação e link copiado usam a mesma leitura autenticada publicada;
compartilhar não grava conclusão, tempo, ofensiva ou abertura por conta própria.

Sem publicação não há payload; consentimento desativado, revogação ou sessão
encerrada bloqueiam reservas/preparação. Uma reserva diária por cada data local e
Brasília, locks e status consumível impedem repetição entre workers. Em resultado
incerto, não há retry cego; o próximo agendamento válido é futuro. DST, mudança de
dia, conclusão após reserva e ausência de segundo tipo permanecem cobertos.

Nesta rodada passaram 451 testes automatizados, build/lint, 134 verificações
Chromium, 331 SQL/RLS mais duas de concorrência e 12 HTTP negativas locais.
STAGING/PROD permaneceram bloqueados. Nenhuma falha Windows intermitente nesta
rodada; histórico e limitações detalhados em [testing.md](testing.md).

Não há bloqueador técnico identificado para versionar o resultado local, mantendo
o envio externo bloqueado. Antes de operar entrega real ainda são necessários
autorização específica, configuração e gestão de VAPID, supervisão do agendador,
validação fim a fim/compatibilidade e proteção operacional dos dados sensíveis.
Esta auditoria não aplicou migrações, não iniciou worker e não alterou dados,
usuários ou permissões existentes. Nenhum staging, commit, publicação ou envio.

## Comandos de staging — Windows CMD, não executados

Relação completa e explícita dos candidatos, sem glob ou `git add .`.
Estes comandos apenas preparam o staging quando o responsável os executar.
Conferir branch `feat/local-auth` e base `91c81d0` antes do versionamento.

Onze arquivos modificados:

```cmd
git add -- docs/development-workflow.md docs/journey-roadmap.md docs/testing.md
git add -- package.json package-lock.json
git add -- scripts/local-navigation-browser.mjs scripts/verify-local-reading-install.mjs
git add -- src/App.tsx src/auth/AuthContext.tsx
git add -- src/components/ReaderLibrary.tsx src/components/ReaderLibrary.test.tsx
```

Vinte arquivos novos:

```cmd
git add -- docs/smart-reminders-local.md
git add -- public/push-protocol.js public/selah-sw.js
git add -- scripts/apply-local-reminders-migration.mjs scripts/local-reminder-worker.mjs scripts/local-reminders-readonly-http.mjs
git add -- scripts/reminder-webpush-transport.mjs scripts/reminder-worker-core.mjs
git add -- src/components/ReminderSettings.tsx src/components/ShareDevotional.tsx
git add -- src/notifications/device.ts src/notifications/repository.ts src/notifications/session.ts src/notifications/sharing.ts
git add -- src/notifications/reminders.test.tsx src/notifications/session.test.ts src/notifications/worker.test.ts
git add -- supabase/migrations/20261028000600_smart_reminders.sql
git add -- supabase/tests/smart-reminders.sql supabase/tests/reminder-concurrency.sql
```

Mensagem recomendada: `feat: adiciona lembretes inteligentes e compartilhamento de devocionais`.
Nenhum desses comandos foi executado pelo agente.

## Lembrete da Cápsula de Oração (13/11/2026)

- Migração `20261115000100_prayer_push.sql`: `prayer_capsules.notified_on` e `kind = 'prayer'` em `reminder_attempts`. `private.prepare_reminder` passa a escolher, no lembrete do dia de um dispositivo ativo, o tipo `prayer` quando há pedido aberto cuja data de revisão chegou e que ainda não gerou aviso. Cada pedido gera no máximo um aviso por data de revisão (`prayer_snooze` zera `notified_on`). Continua valendo o limite de uma mensagem por dispositivo por dia: nesse dia o lembrete de oração substitui o de leitura.
- Payload: só `{v, kind: 'prayer', binding, day}`. O service worker (`push-protocol.js`) mostra texto fixo ("Chegou a hora de rever um pedido de oração. Como Deus agiu?") e abre `/#inicio`. Nada do pedido trafega.
- **Produção:** o envio real depende do que este documento já exige e que não existe hospedado: worker agendado (não há), VAPID de produção (não há), `private.push_configuration` em modo `webpush` e leitores que ativem lembretes e a permissão do navegador. Hoje o hospedado está em simulação e com zero dispositivos.

## Agendador em produção (GitHub Actions)

- `.github/workflows/reminders.yml` roda a cada 5 minutos (e manualmente) `scripts/hosted-reminder-worker.mjs`, que reaproveita `reminder-worker-core.mjs` e o transporte web-push. Sem o segredo `SELAH_DATABASE_URL` o workflow não faz nada.
- O script só envia se `private.push_configuration.mode = 'webpush'` e a chave pública for a mesma de `SELAH_VAPID_PUBLIC_KEY`; em simulação ele registra "skipped" e não reivindica lembretes. A verificação TLS do banco fica sempre ligada (`SELAH_DATABASE_CA` opcional, em PEM).
- Segredos do repositório: `SELAH_DATABASE_URL`, `SELAH_DATABASE_CA` (se preciso), `SELAH_VAPID_PUBLIC_KEY`, `SELAH_VAPID_PRIVATE_KEY`, `SELAH_VAPID_SUBJECT` (`mailto:`). Etapa do operador: gerar as chaves, cadastrar os segredos e mudar o banco para `webpush`.

## Aviso de devocional nova (13/11/2026)

- Migração `20261116000100_new_devotional_push.sql`: tabela `private.publish_notices` (única por dispositivo e devocional) e as funções `claim_publish_notices`, `prepare_publish_notice` e `finish_publish_notice`; `cleanup_reminders` também apaga avisos com mais de 31 dias.
- Vale para dispositivos ativos de quem tem os lembretes ligados (mesma opção, sem nova permissão), registrados **antes** da publicação, e para devoções publicadas na última hora. É uma mensagem a mais, além do lembrete diário (não entra na regra de uma por dia). Enviado no instante em que o worker (a cada 5 minutos) percebe a publicação, a qualquer hora.
- Payload: `{v, kind: 'new', binding, day, devotional}`. O service worker mostra texto fixo e abre `/#leitura/<id>`; usa tag própria para não substituir o lembrete do dia.
- Worker: o ciclo processa os lembretes e depois os avisos (`repository.notices`).
