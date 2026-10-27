# Username — ajuste aprovado da Etapa 21.3

> Atualização 21.5: login por username está implementado exclusivamente no
> Supabase local, com ou sem @, mantendo e-mail/senha e o username permanente.
> Ver [login e limites](username-login-local.md). Referências a funcionalidade
> futura abaixo descrevem as entregas anteriores, não o comportamento atual.

> Etapa 21.4: WhatsApp passou a ser obrigatório em novas contas. Autorização de
> feedback continua opcional; login por username ainda é FUTURO. Ver `whatsapp-local.md`.
> As regras de username não mudam; os dados opcionais/testes abaixo registram a Etapa 21.3.

Base `76a6e94`, branch `feat/local-auth`. Alterações de privacidade preexistentes
preservadas. Migrações já aplicadas `20261023000100` e `20261026000100` não foram
reescritas. Nova migração `20261026000200_account_usernames.sql`, aplicada somente
no Supabase LOCAL por CLI `migration up --local` com ambiente Docker fixado pelo guard.
Após sua aplicação, o reforço `20261026000300_bind_username_claim.sql` foi acrescentado
sem reescrevê-la: permite enviar UUID próprio explicitamente, mantendo o WITH CHECK
RLS, para vincular a reserva à conta de origem mesmo durante troca de sessão.

## Contrato de produto e banco

- Novas contas exigem **username, e-mail e senha**; confirmação da senha é local.
  Nome pessoal é opcional em Meu perfil. WhatsApp e Instagram são opcionais e
  disponíveis para todos os perfis, não no cadastro. Faixa etária só aparece se
  já existia dado legado; idade exata não é coletada.
- Login continua exclusivamente **e-mail + senha**, com confirmação/recuperação
  do Supabase Auth. Login com username é **FUTURO**, sem lookup público de e-mail,
  RPC de autenticação, senha paralela ou atalho por chave privilegiada.
- Username canônico: 3–24 caracteres, primeira letra `a-z`, demais `a-z`, `0-9`,
  `_`. Banco normaliza maiúsculas e espaços ASCII nas extremidades com lower/btrim;
  frontend também remove espaços exteriores antes do envio. Não há normalização
  de acentos ou suporte a ponto/hífen. O valor final precisa atender ao CHECK.
- Reservados exatos: `admin`, `administrador`, `administrator`, `root`, `support`,
  `suporte`, `selah`, `system`, `sistema`, `auth`, `api`, `www`, `anonymous`,
  `account`, `perfil`, `login`, `cadastro`, `privacidade`, `null`, `true`, `false`.
- `public.account_usernames` guarda somente UUID Auth e username, com PK no UUID,
  UNIQUE no username, CHECK, FK e RLS. Não duplica e-mail ou nome pessoal.
  A identidade de permissões, conteúdo, histórico e sessão continua sendo UUID.

O trigger AFTER INSERT em `auth.users` exige metadata `username` de tipo string e
reserva o nome na mesma transação do Auth. Ausência, formato inválido ou conflito
abortam o INSERT da conta; não dependem de validação React nem de consulta prévia
de disponibilidade. A normalização também ocorre em inserts diretos na tabela.
O índice UNIQUE serializa a disputa entre transações; não se usa SELECT seguido
de INSERT como garantia de unicidade. Reserva já ocorre antes da confirmação,
sem criar automaticamente uma linha em `profiles`.

`private.reserve_signup_username()` é SECURITY DEFINER, dono postgres,
search_path vazio, SQL qualificado, sem SQL dinâmico ou EXECUTE para API/PUBLIC.
É invocada apenas pelo trigger; a função de normalização é SECURITY INVOKER.
O inventário real local confirmou esses atributos, ACL, triggers e as quatro versões
no histórico de migrações, incluindo o reforço de vínculo à sessão.
Não há função para buscar e-mail a partir de username.

## Privacidade, legado e imutabilidade

Anônimo não consulta a tabela. Uma sessão só vê a própria linha, inclusive numa
consulta sem filtro; não há diretório público nem relação pública username/e-mail.
INSERT de sessão permite `username` e UUID próprio; o frontend envia o UUID da
conta que iniciou a ação, e a policy exige igualdade com `auth.uid()` da requisição.
Isso impede aplicar o pedido à conta seguinte numa troca de sessão. O default de
UUID continua auth.uid() para clientes que o omitem. Não há UPDATE/DELETE para clientes. Administradores da UI
não ganham acesso a usernames alheios por esse novo recurso; operadores SQL
confiáveis continuam privilegiados. Disponibilidade de nome pode ser inferida
por tentativa de reserva, sem revelar e-mail do titular; risco de enumeração/abuso
e rate limiting continuam relevantes para futura infraestrutura.

Contas anteriores à migração não são modificadas, preenchidas ou impedidas de
entrar. Em Meu perfil, “Consultar meu username” mostra o valor ou permite à conta
legada escolher um. Não existe obrigação retroativa de escolher para continuar
usando a conta. Reserva já existente bloqueia uma segunda escolha, mesmo por outro
dispositivo. **Username imutável nesta entrega**: não há renomeação, liberação,
reutilização ou link público baseado nele. Mudanças futuras exigem decisão sobre
redirecionamentos, impersonação e histórico de identidade. Links atuais de
devocionais usam UUID e não foram alterados.

`user_metadata.username` serve apenas como input inicial de signup, não como
identidade autorizadora. A API Auth permite editar os próprios metadados; alterar
esse campo depois não muda a reserva canônica nem privilégios. A UI consulta a
tabela, nunca usa metadata para autorizar ou renomear. A cópia em Auth pode manter
o formato enviado por API direta; o registro canônico é sempre o da tabela.

Não houve limpeza de contas antigas nem de reservas não confirmadas. Quem inicia
cadastro reserva username antes de confirmar e-mail: risco de ocupação/squatting
fica pendente de política de retenção e atendimento pelo responsável. Não foi
criada rotina destrutiva para liberar nomes. Fluxos futuros de OAuth, convite,
OTP com criação automática ou provisionamento devem fornecer username válido;
não desabilitar o trigger para contorná-lo. Não se declara esses fluxos implementados.

## Evidências executadas neste ajuste

| Validação | Resultado |
| --- | --- |
| Schema/trigger/ACL reais locais | Inspeção de metadados em READ ONLY/ROLLBACK, sem valores pessoais existentes |
| `npm.cmd run test:run` | 171 testes em 19 arquivos aprovados, sem falhas/omitidos |
| `npm.cmd run build` / `npm.cmd run lint` | Aprovados; lint sem avisos |
| `build:staging` / `build:prod` | Recusados com código 1 por configuração genérica DEV herdada; nenhum destino remoto configurado |
| SQL/RLS de usernames | 18 verificações aprovadas com ROLLBACK: ausência/número/reservado/caracteres inválidos, normalização, duplicidade, rollback de Auth, RLS, grants, definer e imutabilidade |
| SQL/RLS existentes | 59 autorização + 16 privacidade aprovadas novamente com ROLLBACK; apenas fixtures adaptadas com usernames válidos, sem remover asserts ou desativar trigger |
| HTTP de usernames | 30 verificações aprovadas, incluindo API direta inválida, dois signups simultâneos normalizados com um único vencedor, Auth perdedor ausente no banco, confirmação Mailpit, isolamento, metadata não autorizadora, persistência e login somente por e-mail |
| Compatibilidade legada HTTP | 3 verificações aprovadas: fixture criada/confirmada antes da migração entra depois sem username, não é preenchida automaticamente e reserva o nome pela própria sessão |
| Vínculo de legado SQL | Reserva com UUID explícito de fixture legada própria aprovada, com ROLLBACK; a tentativa de UUID alheio também foi recusada novamente por RLS em SQL/HTTP |
| HTTP de regressão | Auth 19 / perfis 29 / acervo 35 / admin 41 / privacidade 30 aprovadas novamente |

As duas primeiras tentativas HTTP pararam após nove verificações porque o teste
esperava um `error.code` que o Auth local não devolveu. O comportamento observado
foi HTTP 500 sem code. A asserção passou a exigir a rejeição 500 (não 429), um único
vencedor e somente uma conta gravada; não foi retirada a validação de concorrência.
Um teste React reproduz 500 sem code e exige mensagem genérica segura, preservação
de campos e ausência de falso sucesso. Não afirmar que todo erro 500 significa
username ocupado: também pode ser falha temporária do serviço/trigger.

As tentativas intermediárias deixaram duas contas fictícias não confirmadas e suas
reservas; não foram apagadas. Cada execução completa deixou duas contas fictícias
confirmadas, além da fixture legada e das fixtures de regressão. Não houve commit,
reset, conexão remota, publicação ou exclusão de dados preexistentes. Grants
administrativos temporários de regressão foram revogados; SQL próprio teve rollback.
Durante a implementação, o agente não executou novo fluxo manual no navegador;
os 11 testes aprovados posteriormente pelo responsável estão registrados abaixo. Compatibilidade de
recuperação/confirmacão de contas legadas não confirmadas não foi ensaiada por HTTP;
o trigger é apenas de INSERT, sem mudar os caminhos de UPDATE dessas contas.
Não é teste de carga ou comprovação de segurança integral. STAGING/PROD continuam bloqueados.

## Roteiro local

O banco desta sessão já tem a nova migração. Para outro banco local, usar o
procedimento com Docker validado de `privacy-essential.md`; não usar CLI herdando
destino remoto nem reaplicar SQL à mão fora do histórico de migrações.

```cmd
node scripts/local-username-smoke.mjs --check-local
node scripts/local-username-smoke.mjs --sql
node scripts/local-username-smoke.mjs
npm.cmd run test:run
npm.cmd run build
npm.cmd run lint
```

Os testes HTTP retêm fixtures. O modo SQL é integralmente transacional/rollback;
nenhuma dessas ações faz parte dos testes React/build/lint. Todos os modos do novo
entrypoint recebem testes negativos de destino remoto/contexto malicioso.

No navegador local: cadastrar username válido (experimentar caixa/espaços),
confirmar no Mailpit, entrar com e-mail, consultar username em Meu perfil; editar
nome pessoal/WhatsApp/Instagram opcionais e recarregar. Tentar nome ocupado e
verificar mensagem sem e-mail de terceiro. Em conta legada, escolher username
uma única vez e verificar persistência após logout/login. Conferir que não há
edição de username existente nem login por username; testar outra conta e os
fluxos de perfil, pedidos, acervo, histórico e administração. Usar só dados fictícios.

## Encerramento — validação manual informada pelo responsável

Branch `feat/local-auth`, último commit estável anterior `76a6e94`. O responsável
concluiu e aprovou **11/11 testes manuais** no ambiente local:

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

São execuções manuais relatadas pelo responsável, não testes automatizados,
HTTP/SQL reexecutados pelo agente ou certificação de infraestrutura. Regras finais:
username único e permanente, normalizado e validado no PostgreSQL; nome pessoal,
WhatsApp e Instagram opcionais no perfil; login atual somente com e-mail/senha.
Login por username continua FUTURO. Nenhuma implantação pública foi liberada.

### Regressão repetida na preparação final do commit

| Grupo | Execução atual |
| --- | --- |
| Automatizados | `npm.cmd run test:run`: 171 testes em 19 arquivos, sem falhas/omitidos |
| HTTP local | Username 30, perfis 29, privacidade 30, Auth 19, acervo 35, admin 41: 184 verificações aprovadas novamente |
| SQL no Supabase local existente | Autorização 59, privacidade 16, username 18: 93 verificações aprovadas com ROLLBACK |
| Sequência em PostgreSQL local novo | Inicial + `20261026000100` + `20261026000200` + `20261026000300` aplicadas em ordem; as mesmas 93 verificações SQL passaram com ROLLBACK |
| Legado no banco novo | 4 verificações SQL extras: Auth preservado, perfil/contatos preservados, ausência de backfill e reserva pelo próprio UUID; ROLLBACK |
| Build e lint | Executados novamente, código zero, lint sem avisos |
| STAGING/PROD | Builds repetidos e recusados com código 1 por variáveis genéricas DEV herdadas; nenhum destino remoto configurado |

As 3 verificações HTTP legadas da implementação anterior não foram reexecutadas
nesta preparação. A compatibilidade legada atual também tem a evidência manual
11/11 informada pelo responsável e o replay SQL novo; não confundir esses grupos.
As 11 contas, sete devocionais e um pedido fictícios criados pelos seis scripts
HTTP desta preparação foram retidos no Supabase local; grant temporário revogado.
Não se apagou conta/dado preexistente. Fixtures SQL próprias foram revertidas.

### Ensaio isolado de migrações e limites

Foi usado outro contêiner, com a imagem PostgreSQL local já instalada
`public.ecr.aws/supabase/postgres:17.11.0.006`, `--pull=never`, rede `none`, nenhuma
porta publicada e apenas armazenamento `tmpfs`. Nenhum volume atual foi montado
nesse contêiner. A fonte Supabase local foi apenas lida para obter **DDL Auth sem
dados**, sem owners/ACL originais; roles de teste e uso do schema Auth foram
preparados explicitamente no banco novo. Nenhum registro, verificador de senha,
token ou log de usuário foi copiado.

O trigger de username foi retirado apenas da cópia DDL em memória para ser criado
no momento correto pela migração `20261026000200`; nenhum trigger do banco atual
foi desligado/removido. Uma fixture legada sintética foi criada entre a migração
inicial e os incrementos para verificar preservação e escolha posterior do nome.
Após as suítes, apenas o novo contêiner foi parado e seu `tmpfs` liberado; os
contêineres/volumes Supabase atuais permaneceram disponíveis. Runner temporário
removido, sem arquivos de dump/credenciais ou dados de banco nos candidatos Git.

Esse ensaio valida a sequência completa das migrações da aplicação no PostgreSQL
novo com o schema Auth do stack local. **Não foi inicializada outra pilha Supabase
completa nem repetido HTTP nesse banco isolado.** O HTTP acima usa o stack local
existente. Não é evidência de ACLs globais de um futuro host ou infraestrutura
remota. O histórico do Supabase local atual confirmou as quatro versões; nenhum
servidor remoto foi consultado para verificar seu estado.
