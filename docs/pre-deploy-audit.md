# Etapa 20 — auditoria técnica antes da implantação

> As seções 1–11 preservam o diagnóstico histórico da Etapa 20. A correção de
> scripts da Etapa 21.1 está na seção 12; ambientes da Etapa 21.2 na seção 13. O estado antigo
> de B02 e as contagens históricas abaixo não descrevem essa revisão posterior.

Data: 26/10/2026. Branch: `feat/local-auth`. Referência confirmada:
`2b9ffa7292295f31cc99e53966f3be40737148e6` — painel administrativo local com
provisionamento seguro. A árvore estava limpa antes desta auditoria.

**Parecer técnico: não aprovar publicação com dados reais no estado atual.**
A base local tem controles relevantes e testes aprovados, mas ainda há bloqueios
de configuração, scripts, privacidade e preparação operacional. Homologação
restrita a dados sintéticos pode ser preparada após os critérios específicos abaixo.

Esta é uma auditoria de código/configuração e evidências locais, não um pentest,
certificação WCAG ou parecer jurídico. Somente este documento foi acrescentado;
nenhuma funcionalidade, dependência, migração, política ou configuração foi alterada.
Não houve publicação, commit, reset, criação de contas nem acesso a projeto Supabase
hospedado. Consultaram-se documentação pública e fontes oficiais, não dados remotos.

## 1. Escopo, método e resultados executados agora

Revisados React/TypeScript, repositórios Supabase, Auth, perfis, acervo, aberturas,
editor administrativo, os oito scripts executáveis locais, migração inicial,
suíte SQL, configuração Supabase/Vite, testes e documentação.

| Verificação desta auditoria | Resultado e limite |
| --- | --- |
| `npm.cmd run test:run` | **70 testes aprovados em 12 arquivos**, código zero. Supabase simulado; não comprova HTTP ou navegação real. |
| `npm.cmd run build` | Aprovado, código zero; JS 471,68 kB, gzip 134,72 kB. Compilação não valida inicialização ou configuração de um ambiente hospedado. |
| `npm.cmd run lint` | Aprovado, código zero, sem avisos. |
| Metadados PostgreSQL local | PostgreSQL 17.11; seis tabelas com RLS, 12 políticas, funções/privilégios e histórico da migração `20261023000100` inspecionados. Transação `READ ONLY` encerrada com `ROLLBACK`; nenhum dado pessoal consultado. |
| Portas Docker | Consultadas por socket explicitamente local; portas 54321/54322/54323/54324/54327 publicadas em `0.0.0.0` e IPv6. Não foi testado acesso externo. |
| CORS local | Duas requisições `OPTIONS`, sem sessão ou conteúdo, a `/auth/v1/settings` e `/rest/v1/devotionals`: status 200 e `Access-Control-Allow-Origin: *`. A lista anunciada inclui TRACE/CONNECT; isso **não prova** que esses métodos sejam executáveis. |
| Segredos | 66 arquivos textuais dentre 72 rastreados e um bundle JS examinados por padrões. Nenhuma chave privada/secret ou JWT privilegiado identificado. Não é prova de ausência de todos os formatos de segredo ou no histórico Git. |
| Arquivos de ambiente | Apenas `.env.example` rastreado, com placeholders. `.env.local` e `.env.development.local` presentes e ignorados; **conteúdos não foram lidos**. Regras de ignore também cobrem staging/produção, `.temp`, `.branches` e `dist`. |
| Contraste estático | Calculado com cores declaradas no CSS; resultados abaixo. Sem renderização ou medição de layout nesta auditoria. |

Vitest apresentou somente sugestão informativa de otimização do jsdom. Não se
executaram `npm ci`, scanner de CVEs, suites HTTP, suíte SQL de autorização ou
scripts de grant/revoke. Não houve novo teste de recuperação, publicação ou
persistência por HTTP nesta etapa.

### Evidências históricas, sem nova execução

| Grupo | Resultado registrado anteriormente |
| --- | --- |
| SQL/RLS | 59 verificações aprovadas, com rollback. |
| HTTP de Auth | 19 verificações aprovadas. |
| HTTP de perfis | 29 verificações aprovadas. |
| HTTP de acervo/aberturas | 35 verificações aprovadas. |
| HTTP administrativo | 41 verificações aprovadas; precedem a correção que fixa o socket Docker nos scripts administrativos. Essa versão do provisionamento ainda não recebeu nova execução real de grant/revoke. |
| Manuais informados pelo responsável | Auth: 7; perfis: 8; acervo: 10; administração: 10. Evidência funcional local, não auditoria completa de acessibilidade/segurança. |

## 2. Arquitetura e controles que estão presentes

- SPA React com `StrictMode`, navegação por hash e módulos de repositório por domínio.
  A apresentação usa texto React, sem `dangerouslySetInnerHTML` identificado.
- `getSession` restaura a sessão e `onAuthStateChange` mantém estado com unsubscribe;
  a identidade do usuário é chave de remontagem, reduzindo exposição de estado da
  conta anterior. Respostas de leitura/edição sensíveis têm proteções de ciclo de vida.
- O browser usa chave pública e JWT do usuário. Metadados de usuário não concedem
  administração. Gate visual é complementado por autorização no banco.
- INSERT/UPDATE reconstruídos por listas de campos permitidos. UUIDs, autoria e
  timestamps protegidos não são inputs editáveis. O banco valida conteúdo básico.
- Data editorial do leitor em `America/Sao_Paulo`; datas editoriais do administrador
  convertidas do fuso do dispositivo para UTC. Agendados não se publicam sozinhos.
- Aberturas são eventos, sem alegação de conclusão de leitura.

### RLS, grants e funções privilegiadas

| Recurso | Regra revisada |
| --- | --- |
| `profiles` | SELECT/INSERT/UPDATE do próprio `auth.uid()`; atualização apenas de campos pessoais permitidos. |
| `devotionals` | Leitor vê `published` com `publish_at <= now()` do servidor; administradores podem listar/editar estados ocultos. INSERT administrativo exige autoria da sessão. |
| `devotional_views` | SELECT próprio; INSERT próprio apenas em publicação liberada, com identidade/data do servidor. Sem UPDATE/DELETE para clientes. |
| `private.admin_users` | RLS e ausência de grants diretos à API; schema `private` não está exposto. Membership somente por operador confiável. |
| Avisos/ciências | Avisos liberados são públicos; ciências são próprias e imutáveis pela API. As tabelas não equivalem a integração implementada no produto. |
| `private.is_admin()` | SECURITY DEFINER, dono postgres, search_path vazio, referências qualificadas, EXECUTE restrito; consulta membership atual, não claims editáveis. |
| `public.devotional_open_counts()` | Mesmas salvaguardas; verifica administração antes de agregar e não devolve identificadores de leitores. Risco residual em M02. |
| `private.set_updated_at()` | SECURITY INVOKER, sem EXECUTE para API; trigger preenche updated_at. |

As seis tabelas não usam FORCE RLS; dono/superusuário continuam privilegiados.
Isso não é, isoladamente, um bypass para leitores. Esses operadores e chaves
privilegiadas devem permanecer fora da aplicação. Não se identificou bypass de
leitor nos controles inspecionados; isso não substitui repetir a matriz de
autorização em uma futura homologação. Não se auditou um banco hospedado nem toda
configuração de roles/extensões eventualmente existente fora dos objetos da aplicação.

## 3. Bloqueadores antes da publicação

“Bloqueador” significa condição a resolver antes da aprovação indicada; não
significa que uma exploração tenha sido executada ou comprovada.

| ID | Achado, evidência e impacto | Correção/critério de saída proposto |
| --- | --- | --- |
| B01 — ambientes | `src/lib/localAuthConfig.ts` aceita apenas HTTP loopback:54321. Não há ramificação por modo para URLs HTTPS de homologação/produção. `supabase.ts` lança erro durante import quando a configuração falta/falha. O build pode passar e a aplicação hospedada não inicializar. | Antes de homologar, implementar contrato explícito por ambiente e validação do artefato em runtime; bloquear destino incorreto sem enfraquecer os scripts locais. Cada ambiente deve ter recursos e credenciais próprios. |
| B02 — scripts antigos | `configure-local-auth.mjs`, `local-auth-smoke.mjs`, `local-profile-smoke.mjs` e `local-library-smoke.mjs` chamam status CLI sem ambiente Docker fixado. O último também usa `spawnSync('docker', ['exec', ...])` diretamente para INSERT/COMMIT de fixtures. Uma URL HTTP loopback no status não prova que o daemon escolhido pelo Docker é local. | Antes de reutilizar essas ferramentas, centralizar a proteção de socket dos scripts administrativos em todos os caminhos, inclusive status/preparação SQL. Testar contexto remoto/DOCKER_HOST remoto com mocks e depois executar a versão corrigida somente em instância local descartável. Não executar o script antigo para tentar demonstrar o risco. |
| B03 — dados reais e menores | Cadastro aceita idade de 1 a 120, exige celular e envia dados pessoais a Auth antes da confirmação. Não há definição implementada de público etário, tratamento de menores, aviso de privacidade acessível no fluxo, registro de base legal/finalidade, mecanismo de responsável ou ciclo de direitos/retencão. Existem tabelas de aviso/ciência, mas não são usadas pelo frontend. | Bloqueia dados reais. Responsável jurídico/produto deve aprovar público, bases legais, minimização e salvaguardas; implementar e testar os fluxos correspondentes. Homologação inicialmente fechada e apenas sintética. Não tratar checkbox genérico ou ciência do aviso como autorização universal. |
| B04 — perímetro e operação sem evidência | Configuração é local: HTTP, redirecionamentos de localhost, Mailpit e MFA desabilitado. Portas locais escutam todas as interfaces. Não há configuração de hospedagem/pipeline que demonstre HTTPS, headers, isolamento, SMTP, backup/restore e reversão. Não foi consultado nenhum destino hospedado. | Antes de disponibilizar homologação, preparar infraestrutura exclusiva/restrita, allowlists exatas de callbacks, SMTP de teste, controles de acesso e plano operacional. Antes de produção, demonstrar backup/restore, gestão de segredos, proteção administrativa e aprovação do candidato concreto. Não expor Docker local, Studio, PostgreSQL ou Mailpit à internet. |

Não foi encontrada chave privilegiada versionada. O bloqueio de segredos é uma
condição permanente, não uma vulnerabilidade afirmada sem evidência nesta revisão.

## 4. Problemas importantes

| ID | Evidência/risco | Ação e teste exigido antes de dados reais |
| --- | --- | --- |
| M01 — minimização e cópias | `AuthForm` exige nome completo/celular/idade, embora telefone/faixa sejam opcionais no banco e no editor. `user_metadata.profile` conserva rascunho com nome, celular, faixa e Instagram; editar `profiles` não atualiza/apaga essa cópia. | Justificar cada campo, remover obrigatoriedades desnecessárias e decidir transferência/limpeza de metadados. Testar correção/eliminação em Auth e profiles, inclusive conta ainda não confirmada. |
| M02 — métricas e autorização | `AuthContext` e repositório administrativo usam a RPC de métricas para uma decisão booleana. Um administrador recebe contagens exatas no tráfego mesmo que o painel só mostre conteúdo. Há risco de inferência em grupos pequenos e custo de agregação crescente. | Criar verificação administrativa mínima separada, com revisão SQL incremental; restringir/definir finalidade das métricas. Testar privacidade na resposta da API, não só ausência de números na tela. |
| M03 — proteção de sessão/admin | Persistência padrão do SDK expõe tokens ao JavaScript do origin; fluxo implicit usa fragmentos. Não há MFA/AAL2 no painel/RLS nem reautenticação para ações sensíveis. `secure_password_change=false`. `signOut()` não define scope explicitamente. | Aprovar modelo de sessão, TTL, MFA administrativa e hardening contra XSS. Testar multiaba/dispositivo, expiração, renovação, replay após logout, recuperação com sessão prévia e falha de storage. Não concluir que revogação de refresh token invalida imediatamente todo access token. |
| M04 — recuperação | `recovery` existe só em estado React. Recarregar após consumir o link pode bloquear nova senha; sucesso/erro e tokens inválidos ainda precisam de regressão em navegador. | Definir recuperação robusta e retorno aprovado por ambiente; testar recarga, link expirado/reutilizado, outro browser e mudança de origin/porta. |
| M05 — acessibilidade | Cores declaradas produzem contrastes abaixo de 4,5:1 para texto normal: parágrafo da saudação 3,56:1, nota do header 3,67:1 e navegação lateral 4,47:1. `App.css` oculta `.admin-row .chip` abaixo de 900px, removendo a indicação de status da lista administrativa no móvel. Erros de perfil/editor não possuem associação por campo/foco equivalente ao cadastro. | Corrigir cores/status móvel e validar foco, zoom/reflow, teclado, leitor de tela e mensagens anunciadas. Adotar WCAG 2.2 AA como critério; os cálculos são estáticos, não certificação do layout renderizado. |
| M06 — fronteiras de erro/tipagem | Não há ErrorBoundary. Cliente é inicializado no import; retornos do banco usam casts sem tipos Database gerados. tsconfig não habilita strict. | Tratar inicialização/configuração inválida com tela útil e diagnóstico sem segredos; introduzir tipos gerados/strict gradualmente e validar respostas críticas. Testar erro de render, datas inválidas e falhas do SDK, sem mascarar erro como lista vazia. |
| M07 — consistência | Em ReaderLibrary, uma consulta inicial de histórico pendente pode sobrescrever o evento recém-adicionado por `open()`. Editor administrativo usa última escrita, sem verificação de versão. Conteúdo já carregado permanece até nova consulta. | Reconciliar histórico por IDs/versão e testar essa ordem de respostas; testar duas abas editando e conteúdo retirado do ar durante leitura. Não há evidência de perda persistida: o risco identificado é de estado visual temporário e sobrescrita editorial concorrente. |
| M08 — poder administrativo/auditoria | O banco concede DELETE administrativo de devotionals, com cascade para aberturas, apesar de não haver botão de exclusão. author_id/updated_at não identificam todos os editores nem toda mudança de privilégio. | Aprovar necessidade de DELETE, política de retenção e trilha confiável de ações administrativas. Testar a permissão decidida por API direta; não usar ausência de botão como barreira de segurança. |
| M09 — documentação enganosa | README ainda afirma login fictício, painel público e nenhum envio/persistência. `index.html` ainda descreve aplicativo demonstrativo. | Atualizar onboarding e descrição antes de homologação; comunicar corretamente o envio e persistência de dados e os limites do agendamento. |
| M10 — operação e dependências | Não há workflow CI no repositório, auditoria de CVEs/SBOM executada ou evidência de restauração, alertas e resposta a incidente. Build/lint não substituem isso. | Instalação limpa por lockfile em ambiente isolado, scanner de dependências, revisão de licenças e gate CI. Definir logs sem PII/tokens, retenção, monitoramento e responsáveis por incidente/rollback. Ausência de scanner não é evidência de ausência de CVEs. |

O logout sem scope explícito usa o comportamento global do SDK: encerra refresh
tokens das sessões atingidas, mas access tokens podem continuar válidos até expirar.
A membership administrativa consultada no banco continua sendo uma proteção
independente. Referência: [Supabase — sign out](https://supabase.com/docs/guides/auth/signout).

### CORS, URLs e segredos

- O preflight local aceita origem externa fictícia com `*`. Isso pode ser intencional
  para API com Bearer token; não é bypass de RLS nem garante que qualquer método
  anunciado funcione. CORS não impede clientes fora do navegador. Rever política
  do origin da aplicação e do provedor, sem presumir que o local reflita o hospedado.
- `site_url` aponta a 127.0.0.1:5173 e só há localhost:5173 adicional; o frontend
  envia `location.origin` para confirmação/recuperação. Outra porta, caminho-base
  ou domínio pode quebrar o retorno. Não há wildcard de produção a remover no arquivo.
- Não foi encontrada configuração de CSP/HSTS/frame-ancestors/Referrer-Policy
  na aplicação; headers efetivos do futuro host não foram medidos. A proteção
  precisa ser planejada no host, especialmente com tokens em storage/fragmento.
- Arquivos `.env` ignorados não são arquivos seguros por definição. O scan não os
  leu e não garante o seu conteúdo. A validação da chave pública no browser não
  verifica assinatura/origem; a verificação real cabe ao servidor Supabase.
- A publicação de portas em todas as interfaces amplia o perímetro local, embora
  firewall/roteador possam restringi-lo. A auditoria não testou alcance pela LAN.

## 5. Todos os scripts locais

| Script | Limite encontrado e avaliação |
| --- | --- |
| `configure-local-auth.mjs` | Preserva arquivo existente e só grava URL/chave pública, mas o status CLI herda Docker; B02. Não valida o conteúdo de arquivo existente. |
| `local-auth-smoke.mjs` | HTTP fixo em loopback, redirects manuais e senha aleatória; status CLI sem socket fixado; B02. Mantém conta fictícia local. |
| `local-profile-smoke.mjs` | Mesmo limite anterior; usa API pública e mantém duas contas/perfis fictícios; B02. |
| `local-library-smoke.mjs` | Confere API/DB loopback, mas executa INSERT SQL com Docker herdado; principal risco de escrita remota acidental em B02. |
| `local-docker.mjs` | Aceita socket Unix ou named pipe local; rejeita TCP/SSH, fixa --host e remove DOCKER_CONTEXT herdado. Há cinco regressões simuladas. |
| `local-admin-tools.mjs` | Usa o helper antes do status, fixa ambiente do subprocesso e confere mapeamento/portas. UUID validado, usuário confirmado e transação; sem e-mail fixo. |
| `provision-local-admin.mjs` | Só grant/revoke por UUID; revoga apenas membership específica. Operação de operador, nunca endpoint frontend. Não executado nesta auditoria. |
| `local-admin-smoke.mjs` | Usa configuração/helper protegidos e API pública com contas aleatórias; finally tenta revogar grant. Dados de teste permanecem; validar limpeza de privilégios em falhas e a versão pós-correção em instância local. |

`supabase/tests/authorization.sql` usa ON_ERROR_STOP/BEGIN/ROLLBACK, mas o arquivo
não prova o ambiente da conexão fornecida pelo operador. Exigir wrapper/destino
local validado antes de sua execução. Rollback limita persistência; não autoriza
rodar testes num banco hospedado. Nenhum desses scripts foi executado para criar
fixtures ou mudar permissões nesta auditoria.

## 6. Separação desenvolvimento / homologação / produção

**Resposta: o Vite suporta modos distintos; a aplicação ainda não oferece três
ambientes operacionais.** A trava exclusivamente local deve ser evoluída por
mudança revisada, não removida indiscriminadamente. VITE_* é público no bundle;
modo staging/production não transforma uma chave privilegiada em segredo.
`.env`/`.env.local` entram em todos os modos, e variáveis do processo prevalecem.
[Documentação Vite](https://vite.dev/guide/env-and-mode).

| Ambiente | Estado observado | Contrato mínimo futuro |
| --- | --- | --- |
| Desenvolvimento | HTTP loopback, Docker, Mailpit, dados fictícios; operacional localmente. | Manter guardas locais em todos os scripts e nenhum reaproveitamento de recursos reais. |
| Homologação | Não inspecionada/criada; URL HTTPS seria recusada pelo cliente atual. | Projeto/recurso exclusivo, acesso restrito, dados sintéticos, chave pública própria, callbacks exatos, SMTP de teste e secrets apenas no backend/CI apropriado. |
| Produção | Não consultada nem autorizada. | Recursos distintos, configuração HTTPS explícita, aprovações técnica/jurídica, backup/restore, monitoramento, mínimo privilégio e reversão documentada. |

Gerar artefatos por modo e verificar o destino efetivo sem imprimir chaves.
Não fornecer VITE_service_role/secret, não copiar `.env.local` local para o host,
não compartilhar usuários ou bancos entre ambientes. O script de provisionamento
local não deve ser adaptado com uma URL arbitrária para administrar produção.
Redirecionamentos devem corresponder ao ambiente e a caminhos aprovados, conforme
[Supabase — redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).

## 7. Privacidade e análise jurídica brasileira pendente

Avaliação de engenharia para encaminhamento jurídico; não é declaração de
conformidade ou escolha automática de base legal.

A LGPD classifica convicção religiosa como dado sensível. Histórico de devocionais
vinculado a UUID pode permitir essa inferência: avaliar art. 11, sem presumir que
todo leitor tenha uma convicção específica. Finalidade, necessidade, transparência
e direitos dos titulares exigem definição concreta. A idade exata não é armazenada
no perfil, mas é solicitada no cadastro; a faixa under_18 não distingue criança
de adolescente. O tratamento de menores deve observar melhor interesse, e o
consentimento de responsável, quando aplicável, exige verificação apropriada.
[LGPD, arts. 5º, 6º, 11, 14 e 18](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm).

O Enunciado CD/ANPD nº 1/2023 admite hipóteses dos arts. 7º/11 para menores, sempre
com prevalência do melhor interesse; não é correto afirmar que qualquer tratamento
de adolescente exige necessariamente consentimento parental. O enquadramento deve
ser avaliado, incluindo dados sensíveis. [Orientação oficial ANPD](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes).

A Lei 15.211/2025, ECA Digital, alcança serviços dirigidos a menores ou de acesso
provável por eles. O texto atualizado fixa vigência em 17/03/2026; portanto não deve
ser tratado como mera obrigação futura nesta data. Cabe ao jurídico avaliar o
enquadramento do Selah, o público e as medidas proporcionais. Uma declaração
“somente adultos” não resolve automaticamente acesso provável por menores.
[Texto atualizado, arts. 1º e 41-A](https://www2.camara.leg.br/legin/fed/lei/2025/lei-15211-17-setembro-2025-797997-normaatualizada-pl.html).
O Decreto 12.880/2026 regulamenta a lei e detalha proteção e aferição etária; não
se recomenda coletar documento/biometria por iniciativa técnica sem avaliar
necessidade, proporcionalidade e alternativas de menor coleta.
[Decreto oficial](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/decreto/d12880.htm).

Decisões necessárias antes de usuários reais:

- Responsável pelo tratamento, canal de direitos/privacidade e aviso acessível,
  com propósitos por dado, fornecedores, retenção e destinação de contas não confirmadas.
- Público etário e controles compatíveis; bases para cadastro, perfil e eventos.
  Se consentimento for a base de alguma finalidade, definir prova e revogação
  específicas. Ciência de aviso não é consentimento nem autorização de responsável.
- Processo seguro de acesso/correção/eliminação nas duas cópias de perfil e nos
  eventos; destinação de conteúdo de autores, cuja FK pode impedir excluir Auth.
- Necessidade e prazo para histórico, avaliação de impacto apropriada ao risco,
  grupos pequenos, exposição do UUID de autoria e uso restrito de estatísticas.
- Contratos/operadores, região e transferências de dados na hospedagem planejada;
  resposta a incidente e análise das licenças dos textos/imagens antes de conteúdo real.

Os tópicos são perguntas para aprovação jurídica/produto, não autorização para
coletar dados reais ou implementar mecanismos invasivos de verificação etária.

## 8. Acessibilidade, erros e lacunas de testes

Pontos positivos: lang pt-BR, skip link, botões reais nos cards, labels nativos,
foco visível, mensagens role alert/status, erros de cadastro associados ao input,
layout com breakpoints e prefers-reduced-motion. Não houve teste novo em navegador.
Critérios de referência: [WCAG 2.2](https://www.w3.org/WAI/WCAG22/quickref/), em
especial contraste, reflow, teclado, foco e identificação de erros.

Lacunas a cobrir sem enfraquecer os 70 testes existentes:

1. Browser E2E: cadastro, Mailpit, callback, recuperação/recarga, logout multiaba,
   viewport móvel/320px, zoom 200–400%, teclado e leitor de tela. Erros de configuração
   e falta de storage devem ter cenários próprios.
2. Scripts: testes de todos os entrypoints com Docker remoto, resultado CLI inválido,
   falha de provisionamento e falha da revogação final. Os cinco testes atuais do
   helper não demonstram proteção dos scripts antigos que não o utilizam.
3. HTTP/RLS: repetir fixtures sintéticas em banco isolado após correções; cobrir
   GraphQL exposto, insert/update por coluna, permissões privadas, DELETE direto
   administrativo, token expirado, grant/revoke sem renovação e ausência de métricas
   pessoais no tráfego de uma futura RPC booleana.
4. Concorrência/carga: histórico inicial atrasado versus nova abertura, duas abas
   editoriais, mais de uma página de dados, erros na página intermediária, volume
   de eventos e retirada de uma publicação enquanto uma URL está aberta.
5. Operação: smoke do artefato correto em modo staging, headers/CORS efetivos,
   link por SMTP de teste, backup restaurado e reversão exercitada.
6. Segurança e suprimentos: scanner de segredos no histórico/artefatos e dependências,
   revisão de licenças e testes de XSS com conteúdo como texto, sem tokens nos logs.

## 9. Melhorias futuras, após os bloqueios

- F01: tipos Database gerados, strict gradual, componentes menores e documentação
  de contratos para reduzir casts e regressões de schema.
- F02: paginação visível, busca no servidor e RPC booleana barata em lugar de
  carregar todo acervo/histórico/agregados em memória.
- F03: controle de versão editorial, trilha de mudanças e política de cache/revalidação.
- F04: agendador automático somente se aprovado como funcionalidade; hoje scheduled
  exige publicação explícita. Conclusão de leitura exige modelo separado de aberturas.
- F05: padronizar observabilidade sem PII e mensagens de erro/estado entre formulários.

## 10. Plano de preparação de homologação e critérios de aprovação

| Etapa | Responsável sugerido | Entrega e critério para avançar |
| --- | --- | --- |
| H0 — escopo e dados | Produto + jurídico + responsável técnico | Público, base/finalidades, minimização e tratamento de menores decididos; homologação inicialmente fechada/sintética. Pendências de dados reais listadas e atribuídas. |
| H1 — correções locais | Engenharia | B01/B02 resolvidos com regressões; recuperação, minimização e contraste tratados conforme escopo; 70 testes existentes e novos passam, sem exclusão/skip. |
| H2 — candidato revisável | Engenharia + revisão | Commit identificado, lockfile/install limpo, build por modo, lint, scanner de segredos/dependências e notas de versão. Artefato sem URL/key errada ou fixtures de runtime. |
| H3 — infraestrutura planejada | Operação/segurança | Inventário de recursos exclusivos de staging, acesso restrito, HTTPS, callbacks exatos, SMTP de teste, headers e política de CORS; sem Studio/DB/Mailpit públicos. Secrets por ambiente e plano de revogação. |
| H4 — aprovação prévia | Responsável | Aprovar explicitamente candidato, destino, mudanças de banco necessárias, validações e reversão. Esta auditoria não autoriza criar projeto, migrar ou publicar. |
| H5 — implantação autorizada | Operação + engenharia | Aplicar somente migrações revisadas no recurso de homologação aprovado; sem reset/produção. Executar matriz RLS/HTTP/GraphQL e fluxos browser com dados sintéticos. Scripts travados em local não devem ser apontados ao staging. |
| H6 — ensaio e aceite | QA + operação + responsável | Matriz de Auth/perfil/acervo/histórico/admin aprovada; acessibilidade verificada; logs sem segredos; restore e rollback demonstrados; zero bloqueadores e riscos importantes aceitos por responsável identificado. |
| H7 — porta de produção | Responsável + jurídico + segurança | Aprovação distinta para produção e seus dados, com versão/destino/backup/reversão e pendências legais fechadas. Autorizar staging não autoriza produção. |

Critério mínimo de aceite: nenhum B aberto no escopo liberado; nenhum achado
importante sem correção ou exceção explícita, responsável e prazo; evidências
reprodutíveis de isolamento e dos fluxos críticos; retorno ao artefato anterior
planejado. Rollback do frontend não desfaz uma mudança de dados/schema: banco
precisa de plano próprio, sem restaurar por cima de dados reais de forma improvisada.

## 11. Limites da conclusão

Não foram lidos arquivos de credenciais ou registros de usuários, testados ataques
contra serviços hospedados, rodadas suites que criam contas ou avaliadas configurações
reais de produção. O scan de padrões não substitui ferramenta dedicada, e a revisão
legal exige profissional responsável. Nenhum achado foi corrigido nesta auditoria:
o produto e seus scripts continuam exatamente no comportamento de 2b9ffa7.

## 12. Etapa 21.1 — proteção dos scripts locais

Revisão em 26/10/2026, branch `feat/local-auth`; árvore inicialmente limpa,
HEAD `5f27a4d` (auditoria), código de referência `2b9ffa7`. Esta revisão altera
somente scripts, testes dos scripts e documentação. Nenhum arquivo de `supabase/`,
migração, RLS, componente React, dependência ou configuração de ambiente foi alterado.
Não houve acesso hospedado, publicação, commit, link, db push ou reset.

**B02 corrigido para os caminhos inventariados e cenários testados.** Isso não
representa comprovação universal de segurança nem aprovação para implantação.
B01/B03/B04 e os demais achados fora do escopo permanecem pendentes.

### Destinos e conflitos

- `local-docker.mjs` consulta apenas metadados de contexto antes de acessar o daemon.
  Recusa TCP/SSH (inclusive TCP loopback), pipes de outra máquina, contexto com
  sintaxe de argumento/caminho e metadados inválidos. Se host e contexto estiverem
  definidos, ambos precisam apontar ao mesmo socket local. Cada operação posterior
  recebe `--host` fixo; o subprocesso CLI recebe `DOCKER_HOST` fixo, sem contexto/TLS herdados.
- `local-environment.mjs` centraliza status CLI, URLs, portas, chave pública,
  transporte do SDK e psql. Antes de fixtures/grants, valida API:54321,
  DB:54322/postgres, Mailpit:54324 e os mapeamentos dos três contêineres esperados.
  Todas as URLs anunciadas no status devem pertencer aos serviços locais permitidos.
- Somente HTTP loopback nas portas explícitas; `localhost` é convertido a
  `127.0.0.1` antes do transporte, evitando resolução DNS. IPv6 literal `::1`
  é aceito. Studio:54323 é validado como metadado e frontend:5173 como destino
  de retorno; nenhum deles pode ser buscado pelo transporte dos testes.
- API/DB remotos em variáveis conhecidas, overrides PostgreSQL conflitantes,
  PGSERVICE/PGSERVICEFILE e proxies HTTP/HTTPS/ALL_PROXY são recusados. Não há
  leitura automática de arquivos `.env`. Variáveis são revalidadas antes de SQL/HTTP.
- O SDK e Mailpit compartilham fetch protegido com `redirect: manual` forçado.
  O Location de confirmação/recuperação é validado separadamente como frontend
  local; não é seguido. Teste reproduziu perda do modo manual ao reconstruir
  Request e orientou sua correção, preservando POST, headers e corpo.
- psql usa `-X`, socket `/var/run/postgresql`, porta interna 5432, usuário/banco
  explícitos e `ON_ERROR_STOP=1`, dentro do contêiner no daemon fixado. Não herda
  destino TCP do PostgreSQL. Falhas são relatadas sem saída bruta ou credenciais.

### Matriz de execução desta etapa

| Rota | Evidência real local / limite |
| --- | --- |
| Todos os sete entrypoints | `--check-local` aprovado: configure, Auth, perfis, acervo, admin, provisionamento e wrapper SQL. Esse modo valida metadados/portas, não a saúde HTTP nem executa fixtures. |
| Configuração do frontend | Execução normal preservou `.env.development.local` existente sem ler seu conteúdo. Criação com `wx`, recusa antes de escrita e preservação são cobertas com filesystem simulado; criação real de novo arquivo não foi executada. |
| `local-auth-smoke.mjs` | 19 verificações HTTP aprovadas; cadastro, Mailpit, login, recuperação, sessão, logout e negação de métricas. Repetida após ajuste da asserção do destino. |
| `local-profile-smoke.mjs` | 29 verificações HTTP aprovadas; persistência e acesso negado entre leitores. |
| `local-library-smoke.mjs` | 35 verificações aprovadas, incluindo INSERT SQL pelo socket fixado, persistência e isolamento. Repetida após ajuste da confirmação do INSERT de cinco fixtures. |
| `local-admin-smoke.mjs` | 41 verificações HTTP aprovadas; grant/revoke pelo helper, edição/publicação, persistência e negações. Grant do teste revogado. |
| CLI `provision-local-admin.mjs` | Grant e revoke executados com sucesso para fixture confirmada `selah-editor-…@example.invalid` sem membership prévia. Seleção limitada a esse padrão sintético, sem exibir UUID ou credenciais; revoke em finally. Runner temporário removido. |
| `run-local-authorization.mjs` | 59 verificações SQL existentes aprovadas; término com ROLLBACK e mensagem de fixtures revertidas. SQL integral sem alterações. |
| CMD / Docker Desktop | `cmd.exe /d /c node scripts/local-auth-smoke.mjs --check-local` aprovado. Não houve teste real em Linux/macOS; socket Unix é coberto por simulação. |
| Regressões sem serviços | 105 testes em 14 arquivos aprovados, sem omitidos; 65 da aplicação e 40 dos scripts. Entrypoints em modo normal e preflight recusam host remoto, URL remota e contexto malicioso; grant/revoke também são exercitados nessas recusas. Contextos remotos válidos, conflitos host/context, status/JSON/portas inválidos, chave privilegiada, proxy, PG overrides e redirects cobertos por mocks. Nenhum daemon remoto foi consultado. |
| Build / lint | `npm.cmd run build` e `npm.cmd run lint` aprovados, lint sem avisos. |

As integrações deixaram **10 contas e 12 devocionais fictícios** no banco local:
Auth e acervo rodaram duas vezes; perfis e admin uma vez. Não houve limpeza de
dados, exclusão de conteúdo ou mudança de schema. A suíte SQL reverteu suas
próprias fixtures. Não confundir esses resultados novos com o histórico das seções anteriores.

Na primeira execução dos novos testes, o caso de redirecionamento falhou; foi
corrigido sem remover ou afrouxar o teste. Duas tentativas intermediárias de build
falharam por declarações TypeScript dos testes/scripts; corrigidas com tipos locais,
sem mudar a configuração do aplicativo. Lint inicialmente indicou variáveis não
usadas, depois removidas. Tentativas de acesso ao Docker no sandbox foram recusadas
antes de operações e repetidas com autorização fora dele. Um comando auxiliar de
grant/revoke falhou no parsing de aspas antes de executar; a repetição em arquivo
temporário passou. Os resultados finais acima correspondem às execuções corrigidas.

### Repetição e limites residuais

No CMD da raiz do projeto, começar com
`node scripts/local-auth-smoke.mjs --check-local`. Se houver recusa, corrigir a
seleção de ambiente/contexto na sessão local; não remover as guardas nem fornecer
URLs de homologação/produção. Os executáveis aceitam o mesmo modo de leitura.
Integrações completas são opt-in e retêm dados fictícios. Para SQL usar
`node scripts/run-local-authorization.mjs`, nunca uma conexão arbitrária passada ao psql.
`npm.cmd run test:run`, build e lint não executam SQL ou integrações reais.

Supõe-se máquina, executáveis, contêineres, sockets e configuração Docker locais
confiáveis. Não se comprova que um socket/porta local não seja um túnel/proxy montado
por um operador hostil, nem se protege contra runtime/OS comprometido ou comandos
manuais fora desses scripts. Publicação de portas na LAN permanece como achado
operacional; esta etapa não altera Docker/Supabase config. Criação real de novo
`.env`, plataformas Unix, interrupção abrupta durante grant e falha real de revoke
não foram ensaiadas; não há alegação de cobertura integral dessas rotas/falhas.

Revisão final: `git diff --check` sem erros; 19 arquivos modificados/novos,
nenhum em `supabase/` ou código da aplicação fora de testes. Scan restrito a
esses candidatos não encontrou blocos de chave privada ou chaves `sb_secret_`
de tamanho plausível; não é scanner completo de segredos/histórico.
`.env.local`, `.env.development.local`, `.env.staging.local` e
`.env.production.local` confirmados ignorados, sem leitura de conteúdo.

## 13. Etapa 21.2 — contratos independentes de ambientes

Branch `feat/local-auth`, HEAD inicial `59e2082`, árvore limpa antes desta etapa.
Configuração Vite, cliente Supabase, exemplos, scripts locais e documentação
inspecionados sem ler arquivos de credenciais para inspeção geral. O carregamento
normal do Vite durante build usa as configurações locais sem imprimir valores.

B01 avançou no código: contrato DEV/STAGING/PROD explícito, namespaces próprios,
validação antes de build e cliente, conflitos recusados e origem DEV restrita.
**B01 não está encerrado para implantação:** STAGING/PROD continuam desabilitados
em código e não há projeto/artefato hospedado validado. B03/B04 e achados de
privacidade, sessão, recuperação, acessibilidade e operação permanecem pendentes.
Produção não está pronta. Não houve acesso, provisionamento, migração ou publicação remota.

`npm.cmd run build` agora escolhe mode development explicitamente, mantendo build
otimizado. O bundle recebe apenas configuração DEV selecionada; `envPrefix: []`
desativa exposição automática do restante das variáveis. Cliente revalida antes
de criar SDK. Configuração ausente/insegura não cai para outro ambiente. DEV
exige exatamente HTTP 127.0.0.1:54321; nomes legados só funcionam em DEV e conflitos
são rejeitados. Origem do browser deve ser HTTP 127.0.0.1/localhost:5173 ou :4173.
Servidor e preview ficam em loopback com porta fixa. Sessão e privilégios do banco
não mudam. Contratos remotos futuros exigem projeto/ref/chave próprios, mas nenhuma
variável habilita conexão remota nesta etapa. Detalhamento em `environments.md`.

Resultados e limites desta revisão:

- `npm.cmd run test:run`: 149 testes em 15 arquivos aprovados; 105 anteriores e
  44 novos cenários de ambientes. Integrações simuladas na fronteira, sem rede.
- `npm.cmd run build` e `npm.cmd run lint`: aprovados; lint sem avisos.
- `npm.cmd run build:staging` e `npm.cmd run build:prod`: ambos recusados com código
  1 por variáveis genéricas herdadas, como previsto. Não produziram artefato remoto.
  Testes unitários também cobrem contratos futuros válidos recusados por bloqueio
  em código, inclusive tentativas de habilitação por flags.
- Nenhum script local, arquivo de `supabase/`, migração ou RLS alterado. Restrições
  Docker/HTTP da Etapa 21.1 preservadas e seus testes incluídos na execução atual.
- As 59 verificações SQL e 19/29/35/41 verificações HTTP continuam sendo os resultados
  anteriores da Etapa 21.1; não foram reexecutadas nesta etapa. Não houve criação
  de contas ou alterações de dados para validar configuração.
- Durante a implementação, o agente não reexecutou fluxos de navegador/auth HTTP.
  Na conclusão, o responsável informou sete testes manuais locais aprovados,
  registrados em `environments.md` e `testing.md`. Isso não valida infraestrutura remota.

Formato de chave pública não comprova assinatura, pertença da publishable key ou
titularidade do recurso; comparar contratos só detecta reutilização se ambos estão
disponíveis. JavaScript/configuração alterável pelo usuário não substitui RLS.
Ainda são necessários projeto STAGING novo (sem reutilizar o hospedado existente),
aprovação explícita para habilitação, infraestrutura exclusiva, callbacks/SMTP,
HTTPS/headers/CORS/MFA, privacidade/menores, backup/restore e plano de implantação
autorizado. Build recusado pode deixar `dist` DEV anterior intacto; não confundir
presença de artefato com aprovação nem reutilizá-lo como produção.

## 14. Etapa 21.3 — minimização e pedidos não destrutivos

Referência `76a6e94`, árvore inicialmente limpa. Inventário real local de colunas,
RLS, triggers/FKs e fluxos registrado em `privacy-essential.md`. Não se leram
valores de contas/logs preexistentes para auditoria nem arquivos secretos.

Na primeira implementação, o cadastro foi reduzido a e-mail/senha/confirmação, sem rascunho pessoal
em Auth. Nome de exibição opcional por migração incremental local; campos legados
preservados para acesso/correção/limpeza. Pedidos próprios de exclusão persistem
com UUID e timestamp do servidor, RLS e grants mínimos; confirmação explícita,
sem excluir/suspender contas, prazo prometido, notificações ou processamento automático.
Inicial e políticas existentes não alteradas. Na primeira implementação de
privacidade não houve nova função privilegiada; o ajuste de username abaixo
acrescenta um trigger Auth com função SECURITY DEFINER restrita.

Verificações executadas: 162 testes em 17 arquivos, build DEV e lint aprovados;
HTTP locais 19 Auth / 29 perfis / 35 acervo / 41 admin / 30 privacidade aprovados;
59 SQL existentes + 16 novos aprovados com ROLLBACK. Nove contas, sete devocionais
e um pedido fictícios retidos localmente; grant temporário revogado. Sem apagar
contas/dados preexistentes, commit, reset, migração ou acesso remoto. STAGING/PROD
continuam bloqueados. Nenhuma validação manual nova de navegador foi declarada.

B03/M01 avançam tecnicamente, mas **não estão encerrados para implantação**:
metadados legados, retenção/logs/backup, público/menores, finalidade do histórico,
aviso/canal/responsável e atendimento de pedidos exigem decisões proporcionais
do responsável. Cadastro local continua habilitado sem novo controle de convites.
A fila local não é serviço de exclusão completo; remoção de autores tem FK RESTRICT.
M02 (métricas) e demais riscos de sessão/infraestrutura permanecem. Não há parecer
de conformidade legal, dispensa normativa por uso entre amigos ou liberação pública.

### Ajuste de produto da Etapa 21.3 — usernames

Decisões aprovadas implementadas: username obrigatório em novas contas, nome
pessoal opcional, WhatsApp/Instagram opcionais em Meu perfil; login por username
permanece FUTURO. Migração adicional `20261026000200`, aplicada somente localmente,
sem reescrever as anteriores. Trigger de INSERT Auth com SECURITY DEFINER, dono
postgres, search_path vazio, sem EXECUTE público e sem SQL dinâmico; reserva
atômica em tabela RLS com UNIQUE/CHECK. Cadastros diretos sem username falham,
inclusive antes da confirmação. Legados continuam entrando sem backfill destrutivo.
Não há diretório público, associação pública a e-mail, customização de autenticação
ou privilégio derivado de username/metadata. Username imutável nesta versão.
O reforço incremental `20261026000300` vincula o INSERT ao UUID explícito da
conta de origem, com RLS contra troca de identidade durante sessão pendente;
SQL/HTTP de usernames foram repetidos e passaram, incluindo UUID alheio negado.

SQL/RLS 18 novos + 59 autorização + 16 privacidade aprovados com ROLLBACK.
HTTP local 30 usernames (inclui concorrência real de dois signups), 3 de legado,
19 Auth/29 perfis/35 acervo/41 admin/30 privacidade aprovados. Duas execuções
intermediárias pararam por expectativa incorreta de code de erro; identificou-se
HTTP 500 sem code e criou-se regressão/mensagem segura. Reservas não confirmadas
dessas fixtures foram preservadas. Inventário e limites em `usernames-local.md`.
Ocupação de nomes antes da confirmação, retenção, convites, atendimento de pedidos,
metadados legados e infraestrutura continuam decisões/riscos pendentes. A condição
de segurança de frontend não substitui RLS, servidor confiável ou análise normativa.

Validação final do ajuste: 171 testes em 19 arquivos, build DEV e lint aprovados,
sem avisos de lint. STAGING/PROD recusaram build com código 1 por configuração
genérica DEV herdada, sem destino remoto. Após o reforço de vínculo à sessão,
18 SQL de username e 30 HTTP foram repetidos e passaram; reserva de legado com
UUID próprio passou em transação revertida. Também se repetiram os 59/16 SQL
existentes com rollback. Migrações anteriores não reescritas, nenhuma conta apagada.

### Encerramento da Etapa 21.3

Responsável informou 11/11 testes manuais locais aprovados, registrados em
`usernames-local.md` e `testing.md`. Preparação final repetiu 171 testes em 19
arquivos, 184 verificações HTTP no stack local e 93 SQL com rollback. Sequência
inicial + três migrações incrementais também passou num PostgreSQL novo, separado,
sem rede/portas/volumes compartilhados: 93 SQL com rollback e quatro verificações
extras de preservação/registro de legado. O schema Auth foi copiado apenas como
DDL sem dados e sem owners/ACL originais; bootstrap de roles explícito. Não foi
ensaiada outra pilha Supabase completa ou HTTP no banco isolado. Contêiner de
teste parado; runner removido. As três verificações HTTP legadas anteriores não
foram reexecutadas agora. Essas evidências não liberam implantação pública.
Nesta preparação, build DEV e lint também passaram, sem avisos de lint;
builds STAGING/PROD foram novamente recusados com código 1, sem conexão remota.

## 15. Etapa 21.4 — WhatsApp e feedback

Base `366f94a`, árvore inicialmente limpa. Inspeção de schema/RLS/triggers/ACL locais
e formulários confirmou reutilização de profiles.phone. Novas migrações 00400 e
00500 aplicadas somente pelo CLI local com Docker validado; anteriores intactas.
Contas novas exigem número no Auth e perfil; legados preservados sem bloqueio de
login/recuperação. Cadastro pode recusar feedback sem impedir signup. Momento e
propósito da escolha são server-side; RPC vincula UUID e número, RLS SELECT própria,
sem CRUD direto e sem leitura administrativa ampla. Mudança de número retira opt-in.

40 HTTP novos e 8 legados aprovados; regressões 19/29/35/41/30/30 HTTP aprovadas.
25 novos SQL e 59/16/18 anteriores aprovados com rollback. 189 testes em 22 arquivos,
build e lint aprovados. Perfis de terceiros continuaram invisíveis por API real,
inclusive para admin e quando o titular autorizou contato. Métricas sem telefones.

Intake novo retirado dos metadados Auth e ausente do JWT de confirmação testado.
Metadados legados podem conter telefone e aparecer em tokens implicit antigos;
não houve limpeza global ou comprovação de todos os logs/URLs históricos. Formato
não comprova titularidade/número WhatsApp real. Sem fluxo de contato administrativo
ou envio implementado; planejar escopo mínimo só para autorizados/confirmados.
Retenção de números sem opt-in, atendimento e obrigações proporcionais seguem
decisões do responsável antes de uso público. Sem conformidade legal declarada.

No encerramento, o responsável confirmou funcionamento geral de WhatsApp
obrigatório e autorização de feedback na interface, sem especificar cenários
individuais ou contagem manual. Não se atribui aprovação a todo o roteiro nem
se considera essa confirmação uma validação de infraestrutura ou conformidade.
Preparação do commit repetiu 189 testes em 22 arquivos, build/lint aprovados e
118 SQL com rollback, além de preflight e metadados reais locais. STAGING/PROD
recusaram os builds. As verificações HTTP continuam resultados da implementação,
sem reexecução agora. Migrações/funcionalidades não foram modificadas na preparação.
