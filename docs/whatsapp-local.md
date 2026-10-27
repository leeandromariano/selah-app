# Etapa 21.4 — WhatsApp e autorização de feedback

> Atualização 21.5: login aceita username ou e-mail no servidor local; WhatsApp
> não é identificador de login. Obrigatoriedade do número no cadastro e feedback
> opcional/revogável permanecem. Ver [login local](username-login-local.md).
> Referências a username futuro abaixo são históricas.

Base `366f94a`, branch `feat/local-auth`, árvore inicialmente limpa. Implementação
e testes somente no Supabase LOCAL. Nenhum envio de WhatsApp, publicação, commit,
reset ou acesso remoto. STAGING/PROD continuam bloqueados.

## Regras atuais

- Novas contas: username único/permanente, e-mail, senha e WhatsApp obrigatórios.
  Login continua por e-mail/senha; login por username é FUTURO.
- Informar `+` e código do país/DDD. Cadastro normaliza espaços, parênteses,
  pontos e hífens para E.164: 8–15 dígitos, primeiro dígito não zero. Para +55,
  exige DDD com dois dígitos não zero e celular de nove dígitos iniciado em 9.
  Outros países usam verificação estrutural E.164, não uma base mundial de numeração.
- Formato válido não comprova titularidade, existência, disponibilidade no WhatsApp
  ou autorização do dono real do número. Não há OTP/SMS/verificação de WhatsApp.
- Nome pessoal e Instagram opcionais no perfil. Faixa etária somente para revisão
  de dados legados. Nenhuma coleta de idade exata, localização ou dados adicionais.
- Checkbox de feedback separado, opcional, inicialmente desmarcado. Não marcar
  permite cadastrar normalmente. Texto explica finalidade de pedidos individuais
  de feedback; sem autorização o número não é liberado por uma funcionalidade de
  contato. Não há funcionalidade de envio nem diretório administrativo nesta entrega.

## Banco, fluxo e dados existentes

`20261026000400_whatsapp_feedback.sql` acrescenta `profiles.whatsapp_required`
com default false, sem preencher/apagar telefones existentes. Contas anteriores
continuam válidas sem número. Novo trigger AFTER INSERT de Auth valida WhatsApp,
cria o perfil com `phone` normalizado e flag true, e registra a escolha de feedback
na mesma transação. Falha reverte usuário, username, perfil e preferência.
Não há dependência da validação visual. Cliente não pode alterar a flag; contas
novas não podem limpar o número pela API. Nome e Instagram continuam opcionais.

Trigger de perfil normaliza pontuação; a exigência estrita de WhatsApp aplica-se
aos perfis novos com flag true. Perfis legados mantêm compatibilidade com o formato
E.164 anterior, podem completar o número depois e não têm sessão/recuperação
bloqueadas. Não há redirecionamento obrigatório ou bloqueio do acervo por falta
de número em conta antiga. WhatsApp usa `public.profiles.phone`, não o campo Auth
de telefone/SMS; e-mail continua sendo confirmado pelo fluxo existente.

`20261026000500_whatsapp_intake_metadata.sql` foi criado depois da aplicação do
incremento anterior, sem reescrevê-lo. Após copiar os dados para perfil/preferência,
o trigger remove somente os campos novos `whatsapp` e `feedback_contact_allowed`
dos metadados Auth. Um BEFORE UPDATE evita reinseri-los como fonte de verdade.
No fluxo local com confirmação de e-mail, o JWT do callback foi decodificado em
memória e verificado sem esses dados. O cadastro ainda transmite o número ao Auth
no corpo HTTPS/HTTP local da requisição, e a resposta inicial pode conter dados
do próprio payload. Não há número em filtros GET, links construídos pela aplicação
ou logs explícitos do código; RPC usa POST com corpo JSON.

Não se removeu a cópia antiga `user_metadata.profile` de cadastros legados.
Ela pode conter telefone e aparecer em tokens do fluxo implicit anterior. **Não
há garantia global de ausência de PII em todo token/URL legado.** Limpeza dessa
cópia, revisão do fluxo implicit/PKCE e redaction de corpos em logs do servidor
continuam trabalhos separados, sem apagar números existentes nesta etapa. Tokens
e respostas Auth nunca devem ser copiados para relatórios. Não se auditaram logs
históricos, backups ou configurações de logging hospedadas.

Os triggers novos convivem com a reserva transacional de username. Atuam em
INSERT de Auth, sem bloquear UPDATE de login, confirmação ou recuperação de contas
antigas. Os provedores habilitados continuam os mesmos. Futuras integrações OAuth,
convites/provisionamento ou OTP que criem usuários deverão fornecer os metadados
exigidos ou receber um desenho próprio revisado; não se declara compatibilidade
com provedores futuros nem se desabilitam triggers para contorná-los.

## Autorização separada e isolamento

`public.feedback_contact_preferences`: UUID próprio, `allowed`, `decided_at` do
servidor e `purpose_version='feedback-v1'`. Ausência de escolha no cadastro vira
false; tipo diferente de boolean é recusado. Guarda a última escolha, não uma
trilha imutável completa nem prova jurídica de consentimento. Não copia o número.

RLS SELECT apenas própria, sem grants diretos de INSERT/UPDATE/DELETE aos clientes.
A RPC `set_feedback_contact(uuid,text,boolean)` verifica auth.uid() e UUID de origem,
trava o perfil e exige o número salvo esperado para opt-in. Somente essa RPC permite
ao titular alterar a escolha, com timestamp do servidor. Retirada false funciona
mesmo sem número. Campos de identidade/data/versão não são entradas editáveis.

Troca de telefone revoga uma autorização true na mesma transação, exigindo nova
escolha. RPC e trigger usam ordem de locks perfil → preferência; requisição com
número antigo ou UUID de outra sessão é rejeitada. Funções SECURITY DEFINER têm
dono postgres, search_path vazio, SQL qualificado e EXECUTE restrito. Não retornam
telefones. Não houve ampliação das políticas de leitura de perfis.

API real confirmou: leitores, anônimos e administradores da interface não obtêm
número/preferência de outra conta, inclusive quando esta autorizou contato.
Métricas administrativas continuam retornando somente IDs de devocionais e
contagens. Operador SQL privilegiado continua tendo acesso ao banco; RLS de
leitores não o restringe. A etapa não implementa tela de contatos administrativos.

## Plano para acesso administrativo futuro — não implementado

Usar operação backend/RPC estreita, após autorização específica do produto:
operador com escopo explícito para feedback, sem liberar SELECT geral de perfis;
retornar só os campos necessários de contatos com `allowed=true`, telefone atual
e e-mail confirmado. Consultar a tabela autoritativa, nunca metadados Auth, cache
de uma escolha antiga ou simples posse de membership administrativa. Paginação,
limites, auditoria sem números e nova checagem antes do contato são necessários.
Sem exportação indiscriminada e sem mensagens automáticas. Definir responsável,
retenção e atendimento da retirada antes de habilitar esse recurso.

A obrigatoriedade do número mesmo sem opt-in é decisão de produto aprovada.
Sua necessidade, retenção para não autorizados, texto informativo e obrigações
aplicáveis continuam exigindo avaliação proporcional antes de uso público.
Não há declaração de conformidade legal ou segurança integral.

## Validações executadas

- Inspeção real local de schema, RLS, constraints, triggers, ACL e histórico:
  seis versões de migração, funções restritas e policies próprias confirmadas.
- Migrações 00400 e 00500 aplicadas pelo CLI `migration up --local`, com Docker/URLs
  validados pelo guard. Migrações anteriores não modificadas; sem reset.
- **8 verificações HTTP legadas**: fixture criada antes do incremento, perfil sem
  telefone preservado, login, recuperação Mailpit e nova senha sem bloqueio,
  preenchimento posterior, autorização e retirada. Runner temporário removido.
- `node scripts/local-whatsapp-smoke.mjs`: **40 HTTP aprovadas**, incluindo API
  direta sem/contra formato, opt-in ausente/true, confirmação, JWT sem campos novos,
  escrita protegida, admin/leitor/anônimo negados, troca/revogação, persistência.
- `node scripts/local-whatsapp-smoke.mjs --sql`: **25 SQL aprovadas com rollback**.
- Regressões HTTP repetidas: Auth **19**, perfis **29**, acervo **35**, admin **41**,
  privacidade **30**, username **30**, todas aprovadas. Contas e conteúdo fictícios
  retidos, grants de teste revogados; nenhuma conta preexistente apagada.
- SQL existentes: **59 autorização + 16 privacidade + 18 username**, aprovadas com
  rollback. Fixtures agora incluem WhatsApp e usam o perfil criado no signup.
- `npm.cmd run test:run`: **189 testes em 22 arquivos** aprovados. Build DEV e lint
  aprovados, lint sem avisos. Fronteiras simuladas nos testes React, sem SQL/rede real.
- `build:staging` e `build:prod` executados e recusados com código 1 por configuração
  genérica DEV herdada; bloqueio em código também permanece coberto pelos testes.

Uma tentativa SQL anterior falhou porque o admin agora possui seu próprio perfil:
a expectativa de zero perfis foi substituída por exatamente um, com id=auth.uid(),
preservando a proibição de ler terceiros. Não se afrouxou a RLS. Um teste novo
também reproduziu perda do nome acessível do input após erro; o label acessível foi
estabilizado, e o mesmo teste passou. Nenhum teste foi removido ou omitido.

Não houve validação manual nova pelo agente, carga, novo stack descartável,
verificação real de titularidade, entrega de WhatsApp ou acesso administrativo
futuro implementado. Não confundir RLS verificada com certificação da infraestrutura.

## Roteiro completo no navegador local

1. Confirmar migrações 00400/00500 locais aplicadas e executar preflight:
   `node scripts/local-whatsapp-smoke.mjs --check-local`. Em outro banco local,
   usar o procedimento protegido de migrações em `privacy-essential.md`.
2. `npm.cmd run dev`, abrir `http://127.0.0.1:5173`, usar somente dados fictícios.
3. Cadastro: username/e-mail/senha e WhatsApp obrigatórios; tentar vazio, sem `+`,
   formato inválido e +55 com DDD/celular. Conferir erro/foco sem perder campos.
4. Verificar checkbox de feedback separado/desmarcado. Cadastrar sem marcar:
   deve funcionar. Em outra conta fictícia, marcar explicitamente.
5. Confirmar e-mail pelo Mailpit e entrar por e-mail/senha. Não compartilhar tokens
   ou screenshots com números pessoais. Login por username não deve ser oferecido.
6. Meu perfil: conferir número normalizado, editar número, nome e Instagram;
   salvar, recarregar e fazer logout/login. Nome/Instagram podem ficar vazios.
   Contas novas não devem salvar telefone vazio; username continua permanente.
7. Abrir “Gerenciar autorização de feedback”: conferir escolha inicial; marcar,
   salvar, recarregar; depois retirar e confirmar persistência da retirada.
8. Autorizar, trocar o número e salvar: a autorização deve voltar a false. Autorizar
   o número novo somente após nova escolha explícita. Campo ainda não salvo não
   altera a autorização do número persistido.
9. Em conta antiga sem número, confirmar sessão/acervo/recuperação utilizáveis;
   preencher WhatsApp depois. Sem número, opt-in deve ficar indisponível, mas
   retirada deve continuar possível. Não apagar conta/dados para simular legado.
10. Trocar de contas e testar visitante/admin: nenhum telefone de outra conta,
    diretório de escolhas ou número nas métricas/acervo. Conferir Network apenas
    local e sem número em query de URL; não copiar corpos/tokens para relatórios.
11. Simular falha de conexão: mensagem genérica e sem falso sucesso. Verificar
    carregamento, bloqueio de envios repetidos e novo acesso após recarregar.
12. Repetir acervo, histórico, solicitações de privacidade e painel autorizado.
    Nada deve enviar mensagem. Registrar resultados como manuais, separadamente
    das suítes automatizadas e de HTTP/SQL acima.

## Encerramento — confirmação manual geral

Branch `feat/local-auth`, referência anterior `366f94a`. O responsável confirmou
que a implementação de WhatsApp obrigatório e autorização de feedback está
funcionando na interface. Essa é uma confirmação manual geral: não foi fornecida
uma lista de cenários individuais ou contagem de casos aprovados. O roteiro acima
não passa, por isso, a ser considerado integralmente executado ou aprovado.

Essa confirmação é distinta dos testes automatizados, HTTP/SQL e de infraestrutura.
As 40 verificações HTTP novas, oito legadas e 184 de regressão registradas acima
são resultados anteriores da implementação; não foram reexecutadas nesta
preparação do commit. As regressões efetivamente repetidas estão em `testing.md`.

Nesta preparação: `npm.cmd run test:run` aprovou **189 testes em 22 arquivos**;
build DEV e lint aprovados, lint sem avisos. O preflight local e a inspeção de
schema/ACL/histórico foram repetidos. As quatro suítes SQL passaram integralmente
com ROLLBACK: **59 autorização + 16 privacidade + 18 username + 25 WhatsApp = 118**.
STAGING/PROD recusaram novamente os builds com código 1 por variáveis genéricas
DEV herdadas. Nenhuma migração, funcionalidade, conta existente ou dado persistido
foi modificado nesta preparação. Nenhuma migração foi reaplicada ou reescrita.
