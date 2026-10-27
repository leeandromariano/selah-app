# Etapa 21.5 — login com username ou e-mail, somente local

Base: `1bc58bd`, branch `feat/local-auth`, árvore inicialmente limpa.
Esta entrega não habilita homologação, produção ou implantação pública.
O início limpo corresponde ao Prompt 33; a revisão final do Prompt 34 recebeu
os 31 arquivos pendentes da implementação e preservou esse trabalho.

## Contrato e arquitetura

- Um formulário: **Usuário ou e-mail**, **Senha**, **Entrar**. E-mail continua
  funcionando; username aceita um `@` inicial, espaços externos e maiúsculas,
  normalizados para o registro canônico. Não aceita WhatsApp como login.
- Cadastro permanece com username permanente/único, e-mail, senha e WhatsApp
  obrigatórios; nome pessoal e Instagram opcionais. Feedback é opcional,
  separado e revogável. Contas antigas sem username entram por e-mail e podem
  reservar o identificador em Meu perfil.
- Os dois identificadores passam por `POST /functions/v1/password-login`.
  Somente o servidor consulta `account_usernames JOIN auth.users`, com parâmetros
  SQL. Os metadados editáveis de Auth não são fonte de username ou de privilégios.
  Não foi criada RPC pública de resolução, diretório ou consulta de e-mails.
- A Edge Function usa `supabase.auth.signInWithPassword` do SDK oficial. Não
  compara senhas/verificadores, não gera JWT próprio, não confirma e-mails e
  não usa login administrativo. Auth continua exigindo confirmação de e-mail.
- O runtime local recebe a conexão PostgreSQL e as chaves injetadas pelo CLI.
  A chave pública é usada no cliente Auth do servidor; o segredo exclusivo do
  runtime serve como chave HMAC dos contadores. Nenhum segredo entra em `VITE_*`,
  bundle, resposta, fixture versionada ou log da função. A conexão local usa o
  papel `postgres` já fornecido pelo runtime: é um componente de alta confiança.
  Uma conexão dedicada com privilégios mínimos é pendência antes de uso hospedado.

Versões verificadas: `supabase-js`, `auth-js` e `functions-js` **2.118.0**;
Supabase CLI **2.122.0**; Edge runtime **1.77.8**, compatível com Deno **2.1.4**.
Imports fixam `supabase-js@2.118.0` e `postgres@3.4.7`. Dependências transitivas
ainda não têm lock específico da função. O build Vite não verifica o entrypoint
Deno; sua execução real foi validada pelo runtime local.

Referências oficiais consultadas e conferidas com o código instalado:
[autenticação de Edge Functions](https://supabase.com/docs/guides/functions/auth),
[PostgreSQL no servidor](https://supabase.com/docs/guides/functions/connect-to-postgres),
[setSession](https://supabase.com/docs/reference/javascript/auth-setsession) e
[sessões](https://supabase.com/docs/guides/auth/sessions).

## Sessão e privacidade da resposta

Após a senha ser aceita, a função retorna somente `access_token` e `refresh_token`,
sem objeto de resolução ou campo de e-mail. `auth.setSession` valida a sessão
no Auth, persiste pelo mecanismo já existente e emite `SIGNED_IN`.
`getSession`, `onAuthStateChange`, auto refresh, recuperação, logout e a consulta
administrativa controlada pelo banco permanecem no fluxo existente.

**Limite explícito:** um JWT/sessão oficial contém o e-mail do próprio titular
autenticado; `setSession` também obtém o usuário pela API oficial. Esses dados
legítimos chegam ao cliente depois da validação da senha. Não se promete esconder
o próprio e-mail de quem já autenticou. Proibir até esse acesso exigiria outra
arquitetura de sessão, incompatível com preservar o cliente Supabase atual.
Antes da autenticação não se entrega o e-mail resolvido de um username, nem
dados ou tokens de terceiros.

Logout remove a sessão local e revoga o refresh token no Auth, conforme teste HTTP.
Um access token já emitido pode continuar válido até expirar; não se declara
invalidação imediata de todos os JWTs. RLS e membership administrativa continuam
sendo avaliadas pelo banco, sem confiar em metadados do frontend.

## Entrada pública e limites contra abuso

`verify_jwt = false` vale somente para `password-login`, pois o usuário ainda não
entrou. A chave pública identifica o projeto e **não autentica uma pessoa**.
O endpoint deve ser tratado como público, inclusive se o gateway exigir `apikey`.
Não oferece dados administrativos nem opera como sessão privilegiada do leitor.

A migração `20261027000100_password_login_limits.sql` cria somente tabela/função
privadas de contadores, com RLS, `search_path` vazio e acessos revogados de
`PUBLIC`, `anon`, `authenticated` e `service_role`. Só a conexão confiável do
servidor consome os limites. Nenhuma política/grant anterior foi ampliada.

- Até **10 tentativas por identificador normalizado em 10 minutos** e **60
  tentativas globais por minuto**. Sucessos também consomem orçamento. `username`,
  `@USERNAME` e variações de espaços usam o mesmo contador. E-mail e username
  possuem contadores separados; o limite global também se aplica.
- Incrementos atômicos com bloqueio de linha PostgreSQL, compartilhados entre
  requisições/workers. Nenhum contador no navegador participa da decisão.
- Não depende de `X-Forwarded-For`, IP fornecido pelo cliente ou Origin como
  identidade confiável. Forjar esses cabeçalhos não renova o orçamento.
- Contadores guardam HMAC-SHA256, início da janela e quantidade, sem e-mail,
  username, senha, IP ou tokens em claro. HMAC é pseudonimização, não anonimização.
  Janelas expiram logicamente; não há eliminação periódica das linhas. Retenção
  e limpeza desses dados técnicos precisam de revisão futura.
- Falha de banco/infraestrutura recusa login com `503`. Limite excedido retorna
  `429`, mensagem fixa e `Retry-After: 600`. Não há fallback para conexão remota
  ou login direto que burle uma recusa da função.
- Identificador inexistente, senha incorreta e conta não confirmada retornam
  **o mesmo `401`, corpo e mensagem em português**. A mensagem orienta conferir
  a confirmação do e-mail sem revelar o estado da conta. Username inexistente
  também chama o verificador oficial com endereço sintético aleatório; erros
  têm piso de 700 ms e jitter de até 150 ms. Isso reduz diferenças triviais;
  não prova tempo constante ou resistência a análise estatística.
- Corpo limitado a 4096 bytes reais; senha limitada a 1024 caracteres no servidor.
  Métodos inesperados são recusados. Respostas não usam cache. A função não
  registra senha, identificador, token ou diagnóstico interno.

O handler aceita apenas origens locais 5173/4173 em chamadas de navegador.
No teste real, o **Kong local respondeu OPTIONS com `200` e CORS `*`** antes do
handler; o `POST` de origem inesperada recebeu `403`. CORS não bloqueia clientes
HTTP que omitem/forjam Origin e não substitui senha ou orçamento no banco.

Limites deliberados: um agressor pode consumir o orçamento global e impedir
temporariamente logins legítimos. Requisições malformadas não passam pelo Auth,
mas ainda consomem recursos do runtime. O Auth oficial continua acessível
diretamente e tem configuração nativa de rate limit; os limites da função não
abrangem essa rota, cadastro ou recuperação. A resistência dessas rotas nativas
não foi ensaiada até esgotamento nesta etapa. Antes de expor serviços: proxy com
IP confiável, limites de conexão/corpo/tempo, política contra abuso, eventual
CAPTCHA, TLS, retenção e monitoramento sem dados sensíveis. Nenhuma proteção
integral contra enumeração ou negação de serviço é declarada.

## Preparação exclusivamente local

Scripts verificam Docker local, contexto, proxies, portas e URLs antes de agir.
Novos entrypoints também entram nos testes com Docker remoto, URL remota e
contexto malicioso. O entrypoint Deno recusa Auth fora de `kong:8000`/
`supabase_kong_devocionais-app:8000` e PostgreSQL fora de `db:5432`/
`supabase_db_devocionais-app:5432`, banco `postgres`; redirects são recusados.
Esses nomes fazem parte da rede Docker local verificada pelo operador; não são
prova criptográfica do ambiente em outra infraestrutura.

No CMD, com a stack existente ativa:

```bat
node scripts/apply-local-login-migration.mjs --check-local
node scripts/apply-local-login-migration.mjs
node scripts/serve-local-login.mjs
```

A migração é opt-in, fixa `migration up --local` e recusa histórico ou pendências
diferentes das revisadas. Se já aplicada, não escreve dados. Manter o servidor
de funções aberto em terminal separado; depois usar `npm.cmd run dev` em outra
janela. Se a porta 5173 já estiver em uso pelo Selah, reutilizar o servidor.
Interromper o servidor local de funções com Ctrl+C ao terminar. Não usar comandos
de deploy/link/push/reset.

A nova migração foi aplicada e confirmada no histórico **somente do banco local**.
Nenhuma migração anterior foi reescrita. No Prompt 34, as sete migrações também
foram aplicadas em PostgreSQL novo e isolado, conforme registro da revisão abaixo;
não houve reset ou montagem dos volumes atuais nesse contêiner temporário.
Testes HTTP mantêm apenas as contas fictícias criadas por eles. O cenário legado
insere uma fixture nova sem username/WhatsApp, com bypass de triggers limitado à
transação dessa inserção; não altera conta existente. A concessão administrativa
de teste é temporária e revogada ao final.

## Validações da implementação — Prompt 33

Resultados desta implementação, separados do histórico de etapas anteriores:

| Categoria | Comando / evidência | Resultado |
| --- | --- | --- |
| React/TypeScript e fronteiras simuladas | `npm.cmd run test:run` | 240 aprovados em 24 arquivos |
| Auth HTTP nativo | `node scripts/local-auth-smoke.mjs` | 19 aprovadas |
| Login HTTP pela função | `node scripts/local-login-smoke.mjs` | 41 aprovadas |
| Username HTTP, incluindo nova função | `node scripts/local-username-smoke.mjs` | 31 aprovadas |
| WhatsApp/feedback HTTP | `node scripts/local-whatsapp-smoke.mjs` | 40 aprovadas |
| Chromium real isolado | `node scripts/local-login-browser.mjs` | 11 aprovadas |
| SQL local com rollback | autorização 59 + privacidade 16 + usernames 18 + WhatsApp 25 + login 19 | 137 aprovadas |
| Build DEV / lint | `npm.cmd run build` / `npm.cmd run lint` | Aprovados; resultado final em `testing.md` |
| STAGING / PROD | `npm.cmd run build:staging` / `npm.cmd run build:prod` | Recusados como esperado; nenhum destino configurado |

As 41 verificações incluem login real por e-mail/username/@username/maiúsculas,
não confirmação, conta/senha inexistentes, respostas sem resolução de e-mail,
`setSession`, evento `SIGNED_IN`, refresh, revogação do refresh token, legado,
concorrência de 11 chamadas com exatamente 10 recusas genéricas + 1 limite,
isolamento de telefone/consentimento e privilégios administrativos/revogação.
Tempos de quatro falhas observados na execução completa: **761, 851, 837 e 792 ms**;
amostra local, sem ensaio estatístico.

O teste de navegador usou Chrome instalado, headless, perfil novo no cache
ignorado de `node_modules`, rede da página restrita aos dois serviços locais.
Não leu cookies, storage ou perfis pessoais e não imprimiu credenciais. Confirmou
login real, username em Meu perfil, recarga, logout, recarga desconectada, e-mail
e erro pela interface. O conector de navegador falhou antes de abrir páginas;
o fallback isolado executou os 11 cenários. Sem instalação de navegador/Playwright.
Não foi realizada revisão visual responsiva completa.

A primeira integração parou após 21 verificações por esperar `204` no OPTIONS
que o Kong atende com `200`; a expectativa foi ajustada, mantendo o teste de
`POST` negado. O primeiro teste de navegador parou após quatro verificações por
não abrir o painel recolhido de username; foi corrigido para usar o botão real.
Ambos foram repetidos integralmente com aprovação. Essas primeiras tentativas
não são apresentadas como execuções completas.

## Validação manual do responsável — Prompt 34, 13/13 aprovados

O responsável informou nesta sessão a aprovação dos treze cenários abaixo.
Este registro é **validação manual**, distinto dos testes unitários/de integração
simulados, das verificações HTTP, do SQL com rollback e dos onze cenários Chrome
automatizados. Não se atribui aprovação a outros itens do roteiro complementar.

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

## Revisão final para commit — Prompt 34, 27/10/2026

### Auditoria e correções necessárias

Senha continua exclusivamente no `signInWithPassword` oficial. Resolução de
username, conexão PostgreSQL e segredo HMAC ficam no runtime local. A resposta
bem-sucedida contém os dois tokens oficiais; erros não incluem credenciais,
e-mail resolvido ou diagnóstico. O próprio e-mail no JWT/sessão autenticada
permanece um limite explícito, não uma consulta pública. Não foi ampliado acesso
a perfil/telefone/consentimento, inclusive de administradores, e não houve mudança
em cadastro, recuperação, confirmação, logout, RLS ou campos obrigatórios.

A revisão identificou um erro de classificação: `auth-js@2.118.0` usa status `0`
para falhas de transporte. O código anterior retornava `401`, como se a senha
estivesse errada. Resposta sem sessão também era classificada assim. O adaptador
`officialPasswordSession` agora trata transporte/status inesperado, 429/5xx e
ausência de sessão como indisponibilidade `503`, sem expor detalhes. Erros de
credenciais 400/401/403 continuam com o mesmo `401` genérico. A senha e os tokens
continuam sendo processados pelo SDK oficial. O novo teste reproduziu **três
falhas antes da correção**; depois os 33 casos da suíte e os 248 da suíte completa
passaram. Não se derrubou o Auth para testar falha de rede: esse caminho foi
simulado na fronteira, com o formato do erro verificado no SDK instalado.

A automação Chrome teve duas tentativas interrompidas após cinco verificações.
Na reprodução, a sessão seguia autenticada e o painel de username estava
recolhido. O teste passou a aguardar um documento novo e garantir a expansão do
painel até observar os dados, sem fechar um painel já aberto. O cenário de
regressão inclui atraso de rede local de 300 ms. São agora **12 verificações
Chrome**, com recarga autenticada/desconectada e autenticação real. Isso altera
somente a automação, sem mudar comportamento de tela ou conceder novo aceite manual.

### Resultados reexecutados nesta revisão

| Categoria | Resultado final |
| --- | --- |
| `npm.cmd run test:run` | 248 testes aprovados em 24 arquivos; nenhum omitido |
| `npm.cmd run build` / `npm.cmd run lint` | Ambos aprovados, código zero |
| HTTP local | 131: login 41 + Auth 19 + usernames 31 + WhatsApp/feedback 40, todos repetidos após a correção |
| Chrome automatizado local | 12 aprovadas na execução final, incluindo atraso de rede na recarga |
| SQL/RLS no PostgreSQL local atual | 137: autorização 59 + privacidade 16 + usernames 18 + WhatsApp 25 + login 19; rollback em cada suíte |
| Banco PostgreSQL novo e isolado | Sete migrações aplicadas em ordem; outras 137 verificações SQL aprovadas com rollback |
| Concorrência global no banco isolado | 64 chamadas em lotes de até 16 concorrentes: exatamente 60 admitidas e quatro recusadas |
| Concorrência por identificador via API atual | Onze chamadas com variações @/maiúsculas e IP forjado: dez respostas 401 e uma 429 |
| STAGING / PROD | Ambos os builds recusados com código 1 pela configuração de ambientes, como esperado |
| `git diff --check` | Aprovado |

No banco atual, o corpo da função instalada foi comparado com a migração e
corresponde ao arquivo revisado. Owner `postgres`, `SECURITY DEFINER`, `search_path`
vazio, RLS e ausência de grants de tabela/EXECUTE para os papéis de API foram
conferidos pelas consultas e testes. Não há RPC pública de resolução de e-mails.
Os 131 HTTP incluem confirmação Mailpit, refresh, revogação de refresh no logout,
legado e isolamento real pela API. Tempos observados na última execução completa
de quatro erros: **828, 837, 786 e 751 ms**; não constituem prova estatística de
tempo constante ou ausência integral de enumeração.

As suítes HTTP completas de perfis/acervo/admin/privacidade permanecem resultados
anteriores; não foram repetidas integralmente no Prompt 34. Os cenários pertinentes
de autorização foram repetidos pelas suítes acima. Não se somam repetições ou
tentativas parciais aos totais finais. O aceite manual continua limitado aos
treze cenários informados pelo responsável.

### Instalação isolada da sequência SQL

Foi usado PostgreSQL 17.11 da imagem local já disponível, com `--network none`,
sem portas publicadas e sem montar volumes existentes. Dados temporários ficaram
em tmpfs. A preparação leu somente DDL do schema Auth atual, sem proprietários,
grants ou dados; os três vínculos de triggers do aplicativo foram retirados da
cópia estrutural para serem criados pelas próprias migrações. Não foram lidos
arquivos de credenciais nem copiados usuários, verificadores, tokens ou telefones.

As sete migrações foram executadas em ordem, da inicial até `20261027000100`.
Um perfil fictício legado foi criado antes das migrações de username/WhatsApp;
seu fingerprint antes/depois da migração de login permaneceu igual. As cinco
suítes SQL passaram integralmente e terminaram com rollback. O teste de limite
global usou sessões PostgreSQL concorrentes no banco temporário. Contêineres
temporários foram parados; os volumes atuais não foram usados. As tentativas
iniciais de preparação pararam antes de executar assertions e não entram nos totais.

Essa é uma instalação SQL isolada com estrutura Auth compatível, **não uma segunda
stack Supabase completa**: HTTP/Auth/Edge/Mailpit foram testados na stack local
existente. Não houve reset, migração remota ou reescrita de arquivo de migração.

### Parecer e limites

Nenhum bloqueador de versionamento permaneceu após as correções e reexecuções.
Os dados de contas executadas, senhas geradas, dumps, logs, caches, ambientes e
segredos não integram os candidatos. A revisão não inspecionou conteúdo de logs
históricos de terceiros nem comprova ausência de dados em toda a infraestrutura.
Permanecem as pendências de hospedagem descritas abaixo: runtime com conexão
privilegiada, retenção dos HMACs, dependências transitivas, proteção contra abuso
fora da função, DoS/global budget, CORS do gateway, exposição das portas e dados
legados de Auth. JWT emitido pode durar até expirar após logout. Nenhuma dessas
evidências libera STAGING/PROD ou declara segurança integral.

## Roteiro complementar no navegador

1. Executar preflights, confirmar a migração nova e servir a função. Abrir
   `http://127.0.0.1:5173/#login`; verificar os dois campos e o visual.
2. Cadastrar conta fictícia sem marcar feedback: username, e-mail, senha e
   WhatsApp continuam obrigatórios. Conferir rejeição de número/username inválido.
3. Antes da confirmação, tentar login e conferir mensagem genérica. Confirmar
   pelo Mailpit em `http://127.0.0.1:54324`, depois sair da sessão de confirmação.
4. Entrar com e-mail; sair e repetir com username, `@username` e maiúsculas.
   Em Meu perfil, consultar username permanente; conferir telefone e autorização
   opcional, sem nome/Instagram obrigatórios.
5. Recarregar autenticado, navegar por perfil/acervo/histórico e verificar sessão.
   Sair, recarregar e conferir que continua desconectado.
6. Usar senha errada, username/e-mail inexistentes. No Network, comparar `401`
   e corpo genérico; não deve existir resposta de lookup de e-mail. Tokens e
   o próprio e-mail na sessão bem-sucedida são dados oficiais do titular:
   não copiar nem publicar esses valores.
7. Com identificador fictício dedicado, repetir mais de dez tentativas em dez
   minutos; conferir `429`. `@`/maiúsculas não renovam limite. Esperar a janela,
   sem limpar contadores para contornar recusa. Sucessos também contam.
8. Recuperar senha por e-mail no Mailpit; alterar e entrar por username com a
   nova senha. A antiga deve falhar. Sem recuperação por username/WhatsApp.
9. Entrar com legado sem username por e-mail; reservar em Meu perfil, sair e
   testar o novo identificador. Recuperação/sessão não dependem de preencher
   WhatsApp em conta legada.
10. Com dois leitores e admin fictícios, conferir perfil/histórico próprios,
    painel negado a leitor e permitido por membership. Não enviar WhatsApp.
    Network Supabase somente em `127.0.0.1:54321`; testar móvel e teclado.

O aceite manual limita-se aos treze cenários registrados acima. Itens como
esgotamento dos limites, revisão móvel/teclado e outras combinações deste roteiro
não recebem aprovação manual presumida. Os onze cenários Chrome do agente são
automação em navegador real e permanecem uma categoria separada.

## Pendências

- Revisão final para versionamento; os treze cenários manuais acima já foram
  aprovados pelo responsável. Sem staging/commit automático.
- Privilégios do runtime, lock de dependências, retenção de HMACs, infraestrutura
  de limitação e disponibilidade antes de uso hospedado. Sem ensaio de carga
  sustentada, múltiplos servidores, tempo estatístico ou todas as superfícies Auth.
- A stack Docker atual publica portas em todas as interfaces, como já auditado;
  usar firewall/rede restrita. Loopback nas requisições não torna as portas
  automaticamente inacessíveis na LAN. Acesso externo não ensaiado nesta etapa.
- STAGING/PROD e o entrypoint da função continuam restritos/bloqueados. Qualquer
  provisionamento futuro exige arquitetura e autorização próprias.

## Arquivos desta entrega

**31 arquivos: 18 modificados e 13 novos**, sem arquivos staged. Nenhuma migração
anterior alterada; `.env.local`, `.env.development.local`, `supabase/functions/.env`
e cache isolado de navegador continuam ignorados. A revisão dos candidatos não
identificou credenciais, dumps, tokens reais ou URLs de projetos hospedados;
endereços `.invalid` e valores fixos de testes são fictícios. Não foi feito
`git add` ou commit.

| Grupo | Arquivos |
| --- | --- |
| Documentação (9) | `docs/auth-local.md`, `docs/development-workflow.md`, `docs/environments.md`, `docs/pre-deploy-audit.md`, `docs/privacy-essential.md`, `docs/testing.md`, `docs/username-login-local.md` (novo), `docs/usernames-local.md`, `docs/whatsapp-local.md` |
| Scripts (6) | `scripts/apply-local-login-migration.mjs` (novo), `scripts/apply-local-login-migration.d.mts` (novo), `scripts/local-login-browser.mjs` (novo), `scripts/local-login-smoke.mjs` (novo), `scripts/local-username-smoke.mjs`, `scripts/serve-local-login.mjs` (novo) |
| Auth (4) | `src/auth/auth.ts`, `src/auth/passwordLogin.ts` (novo), `src/auth/passwordLogin.test.ts` (novo), `src/auth/passwordGateway.test.ts` (novo) |
| Interface (4) | `src/components/AuthForm.tsx`, `src/components/AuthForm.test.tsx`, `src/components/UsernameField.tsx`, `src/components/UsernameField.test.tsx` |
| Fronteiras de teste (3) | `src/test/setup.ts`, `src/test/localEnvironment.test.ts`, `src/test/localEntrypoints.test.ts` |
| Supabase (5) | `supabase/config.toml`, `supabase/functions/_shared/password-login.ts` (novo), `supabase/functions/password-login/index.ts` (novo), `supabase/migrations/20261027000100_password_login_limits.sql` (novo), `supabase/tests/password-login.sql` (novo) |
