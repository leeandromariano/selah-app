# Acesso beta por convite — diagnóstico local

## Arquivado — decisão de produto no Prompt 63

Convites foram dispensados e não foram implementados. O MVP terá cadastro
público com confirmação de e-mail; a ausência de convite não bloqueia o
lançamento. O material abaixo é histórico e não integra o escopo atual. Não
criar bloqueadores adicionais de signup com base nesta proposta.

Na Etapa 23.2, o teste HTTP local `node scripts/local-auth-smoke.mjs` criou
uma conta fictícia por `signUp` sem convite e confirmou que o Auth exigiu
confirmação de e-mail. Portanto o signup direto é efetivamente possível; a
confirmação de e-mail não é um mecanismo de convite. O teste usou Mailpit local,
não enviou mensagens externas e conservou a conta fictícia criada. Contas
preexistentes não foram alteradas por esse teste.

Não há migração, RPC, painel ou fluxo de convites implementados nesta rodada.
Não afirmar que cadastro fechado, concorrência ou prevenção de bypass foram
validados. A arquitetura abaixo é uma proposta técnica, não uma garantia de
compatibilidade com Auth gerenciado ou uma autorização de publicação.

## Proposta histórica arquivada

Um mecanismo servidor deve verificar, na própria transação de criação de
`auth.users`, token aleatório de uso único, hash armazenado, e-mail normalizado,
validade e revogação. Um trigger `BEFORE INSERT` de acesso restrito é candidato
para bloquear chamadas diretas de Auth e consumir o convite atomicamente; precisa
ser demonstrado com o Auth local real, inclusive concorrência e falhas, e depois
verificado em homologação com a versão gerenciada. O token deve ser removido dos
metadados antes de persistir o usuário, e tráfego, logs, rastreamento e respostas
de erro não podem armazenar o token. Se o provedor não permitir garantir essas
propriedades, não usar esse mecanismo: adotar criação mediada por servidor e
controle de acesso no servidor que impeça uso por contas não convidadas, além de
bloquear os demais caminhos de criação ou habilitação.

OWNER seria verificado a cada RPC contra membership privada, com emissão e
revogação serializadas, validade fixada no servidor e limites de emissão. A
listagem mostraria apenas e-mail, status e datas; token apareceria somente na
resposta inicial, entregue manualmente ao convidado por meio autorizado. Nenhum
papel é aceito do cliente. As tabelas privadas precisam de RLS e revogação de
grants diretos, inclusive `service_role` quando adequado; `SECURITY DEFINER`
precisa de owner, `search_path` e EXECUTE explicitamente restritos.

Uma falha em triggers existentes deve reverter tanto criação quanto consumo.
Após criação bem-sucedida, mesmo sem confirmação, o convite fica consumido;
interrupção ou e-mail não confirmado precisa de fluxo de reenvio seguro e
genérico ou reemissão auditada pelo OWNER, sem expor a existência de conta.
Testar também revogação concorrente e repetição de requisição após timeout: o
cliente não pode presumir que erro de rede implica rollback. A limitação de
tentativas precisa persistir apesar de transações rejeitadas: contador gravado
na mesma transação que lança erro é revertido e, sozinho, não serve para isso.

## Critérios históricos da proposta arquivada

- Migração incremental e testes em PostgreSQL temporário para convite válido,
  inválido, vencido, revogado, usado e e-mail divergente; corrida de consumo e
  revogação; falha de trigger e preservação de usuários anteriores.
- HTTP real local contra signup direto, inclusive SDK/REST, confirmação,
  recuperação, repetição e interrupção; verificar também caminhos de criação
  alternativos habilitados e que ninguém ganha privilégios por metadados.
- Painel acessível e responsivo para OWNER, estados, revogação e exibição única
  do token; testes de troca de sessão e negações reais por RLS/RPC.
- Testes de regressão de leitura, Jornada, comentários e moderação, temas,
  teclado e mobile; distinguir navegador com fronteira simulada de backend real.
- Avaliar limites de abuso do Auth e borda, política de privacidade, retenção de
  convites e logs, envio seguro e operação de recuperação de contas pendentes.
  Não usar credenciais privilegiadas no frontend. Preservar bloqueios de
  STAGING/PROD e Web Push externo desativado.
