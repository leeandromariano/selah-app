# Privacidade essencial — Etapa 21.3

> Atualização 22.1: [permanência confirmada e conclusões](reading-local.md)
> acrescentam saldo por devocional, autorização operacional temporária e recibos
> pessoais. RLS limita leitura ao titular, sem diretório administrativo ou logs
> de pulsos. Não há limpeza automática nem declaração de conformidade legal.

> Atualização 21.5: [login com username ou e-mail](username-login-local.md) resolve
> username somente no servidor local e acrescenta contadores privados com HMAC,
> janela e quantidade. Nenhum diretório/e-mail de terceiros é exposto; a sessão
> oficial contém dados do próprio titular após autenticação. Retenção dos novos
> contadores permanece pendência. Referências a username futuro são históricas.

Referência `76a6e94`, branch `feat/local-auth`, árvore inicialmente limpa.
O ajuste de produto posterior exige username em novas contas e mantém WhatsApp/
Instagram opcionais para todos os perfis. Evidências atuais em `usernames-local.md`;
os resultados da primeira implementação de privacidade abaixo são históricos.
Escopo: controles técnicos proporcionais para preparar uso restrito entre amigos.
Não constitui parecer jurídico, declaração de conformidade, segurança integral
ou autorização de publicação. STAGING/PROD continuam bloqueados; nenhum projeto
remoto foi acessado. “Entre amigos” não significa dispensa das normas aplicáveis.

Atualização aprovada da Etapa 21.4: WhatsApp obrigatório no cadastro novo, com
opção independente de contato para feedback. Phone continua no perfil; preferências
guardam UUID, allowed, momento do servidor e propósito feedback-v1, sem copiar
número. Campos de intake novos são removidos do Auth, sem limpeza dos metadados
legados. Nome/Instagram opcionais; requisitos e inventário adicional em `whatsapp-local.md`.

## Inventário com evidências

Schema real inspecionado no PostgreSQL LOCAL antes e depois da migração, somente
metadados: colunas, nulabilidade, políticas, triggers e FKs, em READ ONLY/ROLLBACK.
Revisados formulário, Auth/session, repositórios, configuração e scripts. Não foram
lidos conteúdos de contas/logs existentes, arquivos secretos ou backups. Testes
consultam apenas suas próprias fixtures fictícias.

| Local / dados | Finalidade e acessos | Riscos e decisão |
| --- | --- | --- |
| `auth.users`: UUID, e-mail, verificador de senha (`encrypted_password`), confirmação, datas, campos de telefone, tokens de recuperação/confirmação e metadados | Auth gerencia login/recuperação; frontend usa API Auth da própria sessão, não consulta tabela Auth. Operador SQL confiável tem acesso privilegiado. | Cadastro envia username/e-mail/senha e URL de retorno. Não envia rascunho de perfil, idade ou papéis. Username vai aos metadados para reserva transacional, sem autoridade posterior. Auth gera dados técnicos adicionais. Não se inspecionaram valores de verificadores/tokens. |
| `auth.identities`, `sessions`, `refresh_tokens`, `audit_log_entries` | Schema contém identidade/provider, dados JSON, UUIDs, horários, IP/user-agent, estado de revogação e tokens. Serviços Auth/operador são privilegiados. | Presença de coluna não prova preenchimento de todos os campos. Retenção real e conteúdo dos logs não foram examinados. Não alegar que “só e-mail/senha” esgota todos os dados técnicos do serviço. |
| Browser: sessão persistente do SDK, access/refresh tokens; fragmento de callback implicit | Restauração/renovação de sessão. JavaScript do origin e pessoa com acesso ao dispositivo podem ter acesso. | Opções de sessão preservadas. Não copiar tokens para relatórios; XSS, dispositivo compartilhado, renovação e expiração continuam riscos. Logout não é garantia de invalidação imediata de todo access token. |
| `public.profiles`: UUID FK Auth, nome, telefone, faixa etária, Instagram, criação/atualização | Perfil próprio; SELECT/INSERT/UPDATE com RLS `auth.uid()`. IDs e timestamps não são campos editáveis. | Nome pessoal opcional/null. WhatsApp (coluna phone) e Instagram opcionais para todos os perfis por decisão aprovada; faixa etária apenas para dados legados. Não se pede idade exata. |
| `public.account_usernames` (ajuste): UUID Auth e username canônico | Identificador único, obrigatório em novas contas, consultável apenas pela própria sessão | PK/UNIQUE/CHECK/RLS e trigger Auth transacional. Sem e-mail ou diretório público. Legados escolhem voluntariamente; imutável nesta versão. Reserva anterior à confirmação exige futura política contra ocupação abusiva. |
| `raw_user_meta_data.profile` legado | Cadastro antigo copiava nome/telefone/faixa/Instagram; perfil ausente ainda permite revisar esse rascunho. | Novo cadastro não cria essa cópia. Limpar `profiles` não limpa Auth. Dados existentes não foram apagados/migrados automaticamente; limpeza coordenada depende de decisão e testes próprios. Metadados nunca concedem administração. |
| `devotional_views`: UUID evento, UUID leitor, UUID devocional, horário | Histórico pessoal de aberturas; RLS SELECT próprio, INSERT próprio apenas para conteúdo liberado. | Histórico permite inferências sobre interesses religiosos. Abertura não é conclusão. Nenhuma coleta de religião declarada. Não há opt-out/retensão automática nesta etapa; precisa de decisão do produto. |
| `reading_progress`: UUID leitor/devocional, revisão, saldo até 60.000 ms e atualização | Permanência confirmada para habilitar conclusão; SELECT apenas próprio e escrita por RPC restrita. | Novo registro de hábito, distinto da abertura. Sem eventos individuais, IP ou rastreamento de movimentos; retenção de incompletos pendente, sem exclusão automática. |
| `private.reading_leases`: UUID da conta/sessão/visualização, token operacional, sequência e âncoras do servidor | Impedir contagem simultânea/replay; nenhum acesso API direto ou acesso a contatos. | Uma linha operacional por conta; expiração lógica não apaga a linha. Limpeza futura exige política e tarefa restrita. Não registrar token em logs. |
| `devotional_completions`: UUID leitor/original do texto, FK atual anulável, revisão, instante/dia/fuso | Recibo voluntário único após tempo confirmado; SELECT próprio. Admin não ganha leitura de terceiros. | Pode inferir hábito religioso. Sobrevive à retirada do conteúdo sem copiar seu texto; retenção/exclusão da conta exige política própria. Compartilhamento não implementado. |
| RPC `devotional_open_counts` | Administrador autorizado recebe contagens totais e leitores distintos, sem lista de UUIDs de leitores. | Agregados exatos podem permitir inferência em grupos pequenos. Auth ainda chama essa RPC para verificar autorização; separar verificação booleana/métricas continua pendente (M02). |
| `devotionals`: conteúdo, autoria UUID, status/datas | Admins gerenciam; leitor vê publicados liberados. | Autoria identifica uma conta. FK `author_id` com DELETE RESTRICT impede apagar um autor sem tratar conteúdo. Não foi alterada. |
| `private.admin_users`: UUID e criação | Operador confiável provisiona membership local. Sem acesso direto da API de leitores/admins. | Preservado, sem privilégio derivado do cadastro. Operador SQL continua fora do alcance da proteção RLS aplicada a leitores. |
| `privacy_notice_versions` / `privacy_acknowledgements` | Versão/conteúdo/data de aviso; UUID leitor/aviso e horário de ciência, próprios e imutáveis pela API | Schema existente, sem integração nova no produto. Não inventar registro de consentimento ou interpretar checkbox de pedido de exclusão como consentimento legal. |
| `account_deletion_requests` (novo): UUID próprio, horário do servidor | Registro mínimo de intenção de exclusão para análise manual. Leitor só insere/lê o próprio; não atualiza/apaga nem define horário. | Não contém justificativa livre, cópia de e-mail, telefone, senha ou status editável. Um pedido por conta; duplicidade conserva horário. Não é exclusão nem atendimento automático. |
| Mailpit, Docker, serviços Supabase/analytics locais | E-mails de teste, links/token de confirmação/recuperação; logs operacionais. Analytics local configurado com backend PostgreSQL. | Operador com acesso à máquina/serviços pode acessar dados. Retenção de mensagens, logs, IPs e backups não foi medida nem alterada. Não exportar para ambientes reais. |
| Scripts e testes | Contas `@example.invalid`, senhas aleatórias em memória, fixtures UUID, perfis legados fictícios para regressão | Integrações retêm fixtures locais por projeto; não versionam credenciais geradas. Scripts antigos podem deliberadamente testar metadados forjados/dados legados: não representam o novo cadastro da UI. |

Não se identificou analytics de terceiros, geolocalização, coleta de endereço,
religião declarada ou logging explícito de dados no código da interface revisado.
Isso não certifica ausência desses dados em payloads livres, logs de serviços,
histórico Git ou dados existentes. IP técnico não é o mesmo que localização
solicitada no formulário, mas também exige tratamento proporcional.

## Decisões implementadas e compatibilidade

- Cadastro: username obrigatório, e-mail, senha e confirmação local da senha.
  `signUp` envia apenas username em `options.data`; confirmação da senha não é
  persistida/enviada separadamente. Login por username continua FUTURO.
- Nome de exibição opcional apenas em Meu perfil; vazio normalizado a null, sem
  pseudônimo ou nome fictício inventado para preencher obrigação do schema.
- Dados antigos continuam legíveis/editáveis/limpáveis pelo titular. WhatsApp e
  Instagram estão disponíveis como opcionais para todos os perfis; apenas faixa
  etária fica restrita a dados legados na UI. A API mantém essas colunas e
  validações antigas para compatibilidade; não se proibiu globalmente seu uso
  via API ou metadados arbitrários enviados diretamente a Auth.
- RLS/grants/triggers existentes preservados. Leitura de perfil e pedido também
  recusam uma resposta com identidade diferente antes de apresentá-la na UI.
- Mensagens de erro ao usuário são fixas em português; não exibem diagnósticos SQL,
  e-mail/UUID de terceiros ou conteúdo bruto do backend. Erros não viram sucesso.

Migração incremental `20261026000100_privacy_essential.sql`: remove somente NOT NULL
de `profiles.name` e cria a tabela RLS de pedidos com dois campos. O CHECK de nome
continua validando nomes preenchidos (1–150 caracteres); campos vazios são null.
Migração inicial e essa migração de privacidade inalteradas pelo ajuste. A nova
`20261026000200` adiciona a reserva de username e o trigger SECURITY DEFINER do Auth
com privilégios mínimos, detalhados em `usernames-local.md`; não apaga dados.
O reforço incremental `20261026000300` vincula a escolha ao UUID explícito da
sessão de origem via RLS, sem modificar as migrações já aplicadas.

## Fluxo de pedido de exclusão — para revisão

1. Titular autenticado acessa Meu perfil e abre “Solicitar exclusão da conta”.
2. A interface consulta apenas o pedido da sessão atual e explica que não há
   exclusão/suspensão automática, prazo definido ou processamento automático.
3. Checkbox explícito de intenção é obrigatório antes do botão de confirmação.
4. API pública com sessão registra somente UUID próprio. Banco fornece data e
   RLS bloqueia terceiros; nenhum endpoint de Auth admin/delete é chamado.
5. Pedido persistido reaparece após recarga/login; duplicidade não atualiza a data.
   Falha de consulta bloqueia envio até nova tentativa. Não há botão de exclusão real.

**Ainda não há responsável/canal de atendimento, notificações, prazo, status de
processamento ou cancelamento definidos.** O registro é uma fila técnica local,
sem painel administrativo de pedidos e sem promessa de serviço operacional.
Operador SQL confiável pode revisar a fila local; a conta admin da interface não
ganha acesso a pedidos de terceiros. Antes do uso com outras pessoas, o responsável
precisa aprovar o atendimento e os impactos; não considerar esta fila um processo
de exercício de direitos completo.

Uma eventual exclusão real exigiria revisão separada: verificar identidade e
intenção, tratar autoria (FK RESTRICT), sessões/tokens, Auth/identidades, cópias
de metadados, perfis, eventos/ciências/pedidos (FKs cascade), mensagens, logs e
backups. Não haverá exclusão automática/cascade de contas por esta interface.
Esses impactos são proposta para análise, não autorização para executar exclusões.

## Decisões pendentes do responsável

- Público e regra para menores: remover idade exata minimiza coleta, mas não é
  controle etário nem aprovação de acesso de crianças/adolescentes. Não foi criada
  barreira etária, coleta documental ou novo consentimento sem escopo aprovado.
- Finalidades, responsável/canal, aviso de privacidade acessível, destinatários,
  prazos de retenção de contas não confirmadas, histórico, pedidos, Mailpit/logs e
  backups. Uso restrito entre amigos não está garantido por convite/allowlist nova;
  o signup local segue habilitado. Não houve liberação pública.
- Aprovar minimização/limpeza da cópia legada em Auth e eventual remoção futura
  das colunas antigas, sem apagar informações existentes nesta etapa.
- Decidir se histórico deve ser opcional e por quanto tempo, além da finalidade e
  granularidade das métricas administrativas em grupos pequenos.
- Aprovar fluxo operacional de solicitações e futura exclusão/exportação/correção
  de e-mail Auth; nenhum desses procedimentos destrutivos foi implementado.
- Infraestrutura, segurança de sessão, logs sem tokens, MFA e análise proporcional
  das obrigações aplicáveis antes de qualquer publicação, sem declaração legal aqui.

## Validação realmente executada

| Comando / ação | Resultado |
| --- | --- |
| Inspeção de metadados antes/depois | PostgreSQL local, READ ONLY/ROLLBACK; sem registros pessoais existentes |
| CLI migration up com `--local` | Migração incremental aplicada via runner temporário com Docker/env fixados pelo guard, depois removido; nenhuma operação remota |
| `npm.cmd run test:run` | 162 testes em 17 arquivos aprovados, 149 anteriores adaptados ao contrato + 13 novos; nenhum removido/skip |
| `npm.cmd run build` / `npm.cmd run lint` | Aprovados, lint sem avisos |
| `npm.cmd run build:staging` / `npm.cmd run build:prod` | Recusados com código 1 por variáveis genéricas DEV herdadas; bloqueio em código também coberto por testes |
| `node scripts/local-privacy-smoke.mjs` | 30 verificações HTTP reais aprovadas, incluindo Mailpit, minimização, null, persistência, pedidos e API negada |
| `node scripts/local-privacy-smoke.mjs --sql` | 16 verificações SQL novas aprovadas, ROLLBACK |
| `node scripts/run-local-authorization.mjs` | 59 verificações SQL existentes aprovadas novamente, ROLLBACK |
| Scripts HTTP Auth/perfis/acervo/admin | 19/29/35/41 verificações aprovadas novamente nesta etapa |

As regressões do cadastro foram adaptadas legitimamente: o teste de cadastro
exige ausência dos campos removidos e payload exato sem rascunho de perfil em
metadados; o ajuste aprovado acrescenta apenas username. Nome vazio deixou de ser inválido; teste de null e salvamento real
substitui essa expectativa. Validações de campos legados preenchidos permanecem.
Novos testes cobrem pedidos sem confirmação, negação, duplicidade, erros sem dados
privados, envio pendente repetido e desmontagem/troca de conta. Testes da interface
simulam a fronteira Supabase; HTTP/SQL são opt-in e nunca parte de test/build/lint.

Integrações deixaram nove contas, sete devocionais e um pedido fictícios adicionais
no banco local. Nenhuma conta/dado preexistente foi apagado; grant administrativo
temporário de teste revogado. Fixtures SQL próprias revertidas. Não se mediu
retenção/volume real, não houve teste E2E novo no navegador ou ensaio de atendimento
humano de pedido, limpeza de metadados, remoção de backups ou exclusão de contas.
STAGING/PROD não foram habilitados nem acessados. Não há segurança integral comprovada.

## Repetição local e roteiro manual

O banco precisa da migração incremental antes de usar o novo frontend. Nesta sessão
ela já foi aplicada e registrada pelo CLI local. Para outro banco local, revisar as
migrações pendentes e executar com ambiente Docker validado, sem conexão arbitrária:

```cmd
node --input-type=module -e "import { spawnSync } from 'node:child_process'; import { openLocalEnvironment } from './scripts/local-environment.mjs'; const local=openLocalEnvironment(); const r=spawnSync(process.execPath,['node_modules/supabase/dist/supabase.js','migration','up','--local'],{env:local.docker.env,stdio:'ignore'}); console.log(r.status===0?'Migracao local aplicada.':'Falha local; interrompa a validacao.'); process.exit(r.status??1);"
node scripts/local-privacy-smoke.mjs --check-local
node scripts/local-privacy-smoke.mjs --inventory
node scripts/local-privacy-smoke.mjs --sql
node scripts/local-privacy-smoke.mjs
```

O helper recusa contexto/Docker/URLs remotos ou configurações conflitantes antes
da escrita. Não usar esse procedimento com recursos remotos. Integração HTTP cria
novas fixtures em cada execução e não as apaga. Inventário SQL não lê valores de usuários.

1. `npm.cmd run dev`, abrir 127.0.0.1:5173; manter apenas Supabase local.
2. Cadastro fictício: verificar username/e-mail/senha/confirmação; confirmar pelo
   Mailpit e entrar. Não inspecionar/copiar tokens para relatórios.
3. Meu perfil novo: nome opcional, WhatsApp/Instagram opcionais, sem faixa etária; salvar vazio,
   definir apelido, recarregar e limpar. Confirmar persistência após novo login.
4. Com fixture legada, conferir dados antigos e corrigir/limpar opcionais, ciente
   de que isso não remove metadados Auth antigos.
5. Abrir pedido: sem checkbox não é possível enviar. Confirmar e verificar mensagem
   de registro, sem perda de acesso/perfil/conteúdo. Recarregar/novo login mantém pedido.
6. Outra conta fictícia não deve exibir pedido, perfil ou aberturas da anterior.
   Não tentar excluir contas: não existe ação destrutiva implementada.
7. Simular conexão indisponível: mensagens genéricas, sem falso sucesso. Conferir
   login/logout, acervo/histórico e painel com fixture admin autorizada.
8. Revisar atendimento/retenção/público com o responsável antes de uso entre amigos.
   Esses passos são roteiro, não testes manuais já executados pelo agente.
