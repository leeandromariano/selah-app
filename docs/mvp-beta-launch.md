# MVP Beta com cadastro aberto — preparação de publicação

> Etapa 23.5.1: STAGING tem build local controlado; PROD continua bloqueado.
> Nenhum deploy ou acesso ao projeto hospedado ocorreu. O procedimento e as
> pendências estão em [staging-deployment.md](staging-deployment.md). Os avisos
> anteriores sobre bloqueio de STAGING são registros históricos.

> Etapa 23.4 implementada localmente, aguardando commit; não houve publicação
> nem conexão hospedada. As 12 validações manuais informadas pelo responsável
> constam em [ambientes hospedados](hosted-environments.md).

> Prompt 63: cadastro público está autorizado como decisão de produto, com
> confirmação de e-mail. Convites foram dispensados e não são bloqueador.
> O diagnóstico anterior permanece [arquivado](beta-invitations-local.md).
> Etapa 23.4.2 integra a validação hospedada à fábrica e prepara login por
> e-mail, mantendo a recusa de clientes e builds remotos; ver
> [ambientes hospedados](hosted-environments.md).

Estado em 28/10/2026: diagnóstico local na branch `feat/local-auth`, base
`96a42abdd357522e20bc72ea5fd0e4dc7424465f`, árvore inicialmente limpa. Nenhum
serviço hospedado foi acessado, criado ou alterado. Este plano não autoriza
implantação, migração nem envio de mensagens. O beta com leitores reais
é produção, mesmo que pequeno; homologação é separada e usa dados fictícios.

## Arquitetura recomendada e custos

Frontend estático Vite em Cloudflare Pages ou equivalente, com HTTPS e versões
anteriores preservadas; dois projetos Supabase gerenciados independentes para
homologação e beta, cada um com Auth, PostgreSQL, Edge Functions, configuração e
credenciais próprias. Um SMTP transacional configurado por ambiente envia
confirmação e recuperação. Essa escolha aproveita SDK, SQL, RLS e funções atuais,
reduz operação de servidores e permite crescer por limites de uso; verificar
região, transferência de dados, contrato, quotas e recursos efetivos antes da
contratação. Restringir acesso administrativo, ativar MFA onde disponível e
desativar deploy automático que dispense aprovação. HTTPS é necessário para
origens seguras, mas não comprova funcionamento do app ou de push.

**Estimativas de planejamento, não verificadas:** para 5–10 leitores e baixo
tráfego, frontend pode custar US$ 0/mês dentro de limites gratuitos; Supabase
pode custar US$ 0 em camada gratuita ou cerca de US$ 25/mês por organização/plano
pago, sujeito a cobrança adicional de projetos/compute; SMTP pode começar em
US$ 0 ou cerca de US$ 5–15/mês; domínio próprio aproximadamente US$ 10–20/ano.
Orçamento indicativo US$ 0–50+/mês mais domínio, impostos e excedentes. Não
presumir que dois projetos, disponibilidade, retenção ou restauração de backups
estejam incluídos: confirmar preços, pausa por inatividade, limites e recursos em
fontes oficiais antes de assumir compromisso. Backup recuperável e teste de
restauração são requisitos mesmo se exigirem plano pago ou solução adicional.

## Diagnóstico e bloqueadores

- PROD segue bloqueado; STAGING exige build explícito e configuração revisada.
  DEV só
  inicializa em localhost/127.0.0.1 nas portas 5173/4173 e usa API
  `http://127.0.0.1:54321`. `npm run build` gera DEV, não candidato publicável.
  A liberação precisa de alteração específica autorizada, testes e revisão.
- Cadastro público chama `signUp` diretamente; `supabase/config.toml` local
  permite signup e exige confirmação. Testar confirmação e recuperação no
  ambiente aprovado e configurar limites contra abuso; não depender de CORS
  ou de controles da interface para proteger dados e privilégios.
- Login DEV por e-mail **e** username usa `password-login`, exclusivo local.
  STAGING usa Auth por e-mail; validar limites também para acesso direto
  ao Auth; não adaptar ou apontar os scripts locais ao serviço hospedado.
- Auth local usa Mailpit, `site_url` e redirects locais; SMTP real, domínio e
  redirects exatos precisam ser configurados e exercitados em homologação.
  Cadastro envia username, WhatsApp e consentimento opcional em metadados;
  triggers exigem esses dados. Verificar funcionamento desses triggers e da
  confirmação no ambiente de homologação.
- Provisionamento editorial e OWNER, worker e manutenção são ferramentas
  protegidas para uso local; falta procedimento hospedado restrito, auditável e
  testado. OWNER e editorial são memberships distintas: o painel atual exige
  editorial para entrar e OWNER para recursos exclusivos. Não inferir papéis de
  metadados editáveis. Nenhum endpoint de manutenção deve ser público.
- A política em `src/components/PrivacyPolicy.tsx` declara uso local e dados
  fictícios. Antes de receber leitores reais, definir responsável e canal de
  contato, tratamento de dados de hábitos religiosos, acesso OWNER aos indicadores,
  WhatsApp obrigatório, retenção, exclusão efetiva, incidentes, fornecedores e
  menores; revisar aviso e operação com responsável adequado. O pedido atual de
  exclusão é registro para atendimento manual, não exclusão automática.
- Os 15 arquivos SQL estão ordenados de `20261023000100` a
  `20261028000800`. Há evidência histórica de instalação em PostgreSQL isolado
  e 443 verificações SQL/RLS com rollback no Prompt 59, mas não prova instalação
  numa pilha hospedada nem substitui homologação. Seeds locais estão desativados;
  preparar conteúdo inicial autorizado sem copiar dados de usuários reais.
- Há service worker para lembretes, com caminho absoluto `/selah-sw.js` e escopo
  `/`; compartilhamento usa `/#leitura/...`. Hospedar na raiz da origem, servir
  arquivos corretos e verificar cache/atualização. Não há manifesto web app
  identificado em `index.html`: instalação como PWA e offline não estão prontas
  ou comprovadas. Em HTTPS o navegador pode oferecer APIs de notificações, mas
  suporte varia e entrega externa permanece desativada; modo de simulação não
  envia notificações. Não configurar VAPID nem anunciar entrega ativa.

## Cadastro aberto e proteção

Cada leitor cria sua própria conta e confirma o e-mail; contas novas não recebem
privilégios administrativos. Verificar limites e configuração efetiva de Auth e
SMTP, proteção contra abuso distribuído e respostas que não facilitem enumeração
de contas. Confirmar que RLS e autorização no servidor não dependem de papéis em
metadados editáveis. Testar anon, leitores distintos, editorial e OWNER, inclusive
forja de papel e isolamento de sessão, Jornada e desafios. Comentários aprovados
são visíveis aos leitores autenticados; reações, pendências e denúncias seguem
suas regras próprias. Os limites existentes de comentários devem ser verificados
em homologação. A proposta anterior de convites foi arquivada.

## Contas indevidas: procedimento administrativo futuro

Não há exclusão automática implementada. Antes de operar com leitores reais,
definir responsáveis, critérios de abuso, atendimento, retenção e canal de
contestação; revisar consequências para dados próprios, comentários, auditoria
e conteúdo relacionado. O pedido de exclusão no perfil registra uma solicitação,
sem excluir a conta. Quando for necessário agir, identificar ambiente e UUID
exato por meio autorizado, conferir identidade e impacto, preservar evidência
mínima sem segredos e verificar backup e possibilidade de recuperação. Preparar
operação individual auditável usando canal administrativo de servidor com
privilégio mínimo, nunca chave privilegiada no navegador; testar previamente em
homologação com contas fictícias. Avaliar revogação de sessão e efeitos de JWTs
já emitidos, considerando que exclusão de conta e reversão de dados não são
imediatamente recuperáveis. Exigir autorização explícita específica antes de
qualquer alteração em produção. Registrar resultado sem dados desnecessários e
verificar que outras contas permanecem intactas. Não executar exclusões nesta
rodada e não presumir que scripts de provisionamento local atendem esse fluxo.

## Leitor bíblico nativo

O leitor demonstrativo e modelo para múltiplas versões estão implementados
localmente; não há tradução bíblica completa. Ver [leitor bíblico](bible-reader-local.md).
Definir limites de acesso,
atribuição e distribuição antes de importar ou exibir textos; NVI somente com
fonte e licença expressamente autorizadas para esse uso. Usar texto fictício ou
fonte efetivamente autorizada em testes, sem presumir autorização por acesso
público. Validar integração com leitura e devocionais existentes, acessibilidade,
mobile, temas, erros e disponibilidade da fonte. Integração real e licença ainda
pendentes; manter o objetivo de disponibilizar o MVP aos primeiros leitores.

## Configuração e instalação futuras

O contrato previsto de frontend usa `VITE_APP_ENV` e, por ambiente,
`VITE_STAGING_SUPABASE_URL`, `VITE_STAGING_SUPABASE_PROJECT_REF`,
`VITE_STAGING_SUPABASE_PUBLISHABLE_KEY` ou os equivalentes `VITE_PROD_*`.
Essas variáveis são públicas; somente chave publishable/anon. O contrato ainda
está bloqueado e a fábrica de build atual emite apenas DEV: habilitação requer
implementação e testes, não basta definir variáveis. Evitar `.env` compartilhado.
Segredos de SMTP, banco, função e credenciais de operador ficam exclusivamente
no servidor/cofre do ambiente; nunca em `VITE_*`, repositório ou logs.

Configurar origem HTTPS canônica por ambiente, `site_url` e allowlist precisa
para confirmação e recuperação, sem wildcard amplo ou origem de outro ambiente.
O código usa `location.origin` nos dois redirects e o SDK detecta sessão na URL;
testar links reais em homologação, navegador novo, link vencido, reuso, refresh
e troca de conta. O evento `PASSWORD_RECOVERY` abre formulário e `updateUser`
altera senha. Definir domínio de remetente, autenticação de e-mail e tratamento
de falhas/limites SMTP; Mailpit local não prova entrega externa.

Instalação futura: comparar histórico do destino identificado com os 15 arquivos,
aplicar somente versões pendentes em ordem, uma vez, sem reescrever migrações;
verificar histórico, grants/RLS, funções, dependências e compatibilidade com a
versão gerenciada antes e depois. Em falha, interromper e investigar histórico e
estado parcial antes de retomar; não presumir que SQL é reaplicável diretamente.
Preparar e testar processo específico por ambiente e implantação da Edge Function
após revisão de configuração, segredos, CORS, autenticação e dependências Deno;
Vite não valida o entrypoint. Os instaladores `scripts/apply-local-*` são somente
locais e não são procedimento remoto. Não usar reset para implantação.

## Checklist e sequência segura futura

1. [ ] Implementar login hospedado seguro, configuração remota e
   procedimento de provisionamento; revisar privacidade e operação de exclusão.
   Preservar devocionais/editor, leitura de 60 segundos, Jornada/ofensivas,
   conquistas/desafios, compartilhar, comentários/reações, moderação OWNER,
   temas e lembretes existentes em modo sem entrega externa.
2. [ ] Revisar candidato identificado por commit, `npm run test:run`, build e
   lint, testes novos de regressão e segurança; definir destino, migrações,
   custos, backups e rollback. Solicitar aprovação explícita de homologação.
3. [ ] Após aprovação específica, criar recursos isolados de homologação, aplicar
   migrações e funções com escopo aprovado, configurar HTTPS/Auth/SMTP e validar
   com dados fictícios. Conferir que manutenção e funções privadas não podem ser
   acionadas por anon, leitor, editorial ou service role exposto ao navegador;
   estabelecer limpeza restrita para retenções que hoje dependem de operador.
4. [ ] Ensaiar restauração em ambiente isolado e testar versão anterior da UI
   contra esquema resultante. Definir RPO/RTO, retenção, acesso ao backup e
   recuperação de Auth, banco e configuração; não presumir que backup do banco
   sozinho recupera segredos, configuração ou provedores.
5. [ ] Apresentar resultado de homologação, versão imutável, recursos e impacto
   de produção, migrações, custos, backup e rollback. Solicitar autorizações
   explícitas separadas para alterações do banco de produção e publicação.
6. [ ] Somente após essas autorizações, criar/configurar destino de produção,
   executar mudanças aprovadas e publicar versão exata. Provisionar contas
   administrativas separadas. Registrar versão e monitorar erros sem dados
   pessoais, senha, token, e-mail ou payload privado.

## Aceite mínimo e rollback

- Em homologação, criar OWNER, editorial e dois leitores fictícios; verificar
  cadastro aberto, confirmação, login por e-mail/username, recuperação, logout e troca
  de contas, incluindo callbacks inválidos e erros de rede. Confirmar isolamento
  direto via API/RLS, negações de OWNER e manutenção, e ausência de segredos no
  bundle e logs. Não registrar credenciais ou conteúdos pessoais.
- Verificar leitura de 60 segundos, métricas e Jornada privadas, desafios,
  acervo/editor, compartilhamento, comentários aprovados/pendentes, reações,
  denúncias, moderação OWNER, temas e estado de lembretes. Verificar celular,
  navegador e HTTPS reais, inclusive links com hash e atualização do worker.
- Exigir nenhum bloqueador aberto, testes essenciais aprovados, política e
  atendimento definidos, backup restaurado em ensaio, limites de abuso e
  observabilidade sem segredos, e aprovação explícita do responsável. Custos e
  limites reais devem estar confirmados. Não declarar validação de produção com
  base apenas em mocks ou resultados históricos locais.
- Se publicação falhar, conter o tráfego afetado, registrar versão
  e incidente sem dados sensíveis, restaurar artefato frontend anterior compatível
  e reavaliar. Reverter frontend não reverte banco ou Edge Functions; para dados,
  usar migração corretiva revisada ou restauração aprovada após avaliar perda de
  dados, janela e impacto, nunca reset automático. Testar restauração isolada e
  comunicar responsáveis pelo canal operacional aprovado.

Referências locais: [ambientes](environments.md), [login](username-login-local.md),
[privacidade](privacy-essential.md), [comentários](discussion-local.md),
[lembretes](smart-reminders-local.md), [testes](testing.md) e
[processo](development-workflow.md).
