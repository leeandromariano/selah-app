# Etapa 19 — painel administrativo local

Antes de implementar, a árvore Git estava limpa na branch feat/local-auth.
Referência confirmada: c564d28d124b6effde2fd79c276d021e97cb095b,
“test: adiciona verificacoes HTTP do acervo local”. git ls-files confirmou que
scripts/local-library-smoke.mjs já estava versionado nesse estado.
Não houve commit automático, publicação, reset ou acesso remoto nesta etapa.

## Banco conferido em execução

PostgreSQL e API locais foram identificados pelas portas 54322 e 54321 do host.
A inspeção SQL leu somente metadados de schema, constraints, trigger, RLS, grants
e funções, sem consultar dados pessoais. Nenhuma migração foi necessária.

devotionals possui id UUID, title, bible_reference, bible_text, content,
reflection_question, publish_at timestamptz, status draft/scheduled/published,
author_id vinculado a auth.users, created_at e updated_at.
title e bible_reference permitem até 200 caracteres; os textos são obrigatórios.
publish_at é obrigatório fora de draft. O trigger controla updated_at.

private.admin_users é a fonte confiável de administração. A API não expõe private,
não há grants diretos à tabela para anon/authenticated, e não existe papel editável
no perfil. private.is_admin usa SECURITY DEFINER, search_path vazio e auth.uid().
devotionals_admin_insert exige membership e author_id = auth.uid(); update/delete
exigem membership. Grants de coluna impedem alterar autoria e timestamps.
O frontend não consulta lista de usuários nem concede privilégios.

public.devotional_open_counts é SECURITY DEFINER, pertence a postgres e verifica
membership atual. Sua execução é restrita a authenticated; leitores recebem
42501. O cliente usa essa RPC existente para verificar autorização, descartando
as contagens retornadas. O painel revalida antes de cada listagem e gravação;
novas claims não são necessárias para a revogação ter efeito no servidor.
O carregamento de autorização é mostrado separadamente de uma negação efetiva.

## Operações e datas

O painel lista todos os estados pela API pública com JWT do administrador, com
paginação de 100 registros. Não há conteúdo de demonstração no caminho de produção.
Criação envia somente campos editoriais e author_id da sessão. Edição envia
somente título, referência, texto bíblico, reflexão, pergunta, status e publish_at.
IDs, autoria e timestamps não são editáveis. Uma gravação exige retorno de uma
linha; zero linhas/negação não produzem sucesso.

- Rascunho: salvar com status Rascunho; a data é opcional e o leitor não vê o texto.
- Agendamento: escolher Agendado e uma data futura. O banco mantém o conteúdo
  oculto mesmo após essa data enquanto o status continuar scheduled.
- Publicação: “Publicar agora” envia published com o instante atual; ou selecionar
  Publicado com uma data já atingida e salvar. A interface recusa published futuro
  e orienta usar Agendado. O banco já admite published futuro para operadores
  autorizados, mas a RLS continua impedindo leitura antecipada.
- Edição de publicado preserva o instante original, inclusive segundos, quando a
  data não é alterada. Voltar a Rascunho oculta o conteúdo sem excluí-lo.

O datetime-local usa o fuso do dispositivo, explicitamente informado no editor,
e converte para ISO UTC. A lista administrativa e o acervo usam America/Sao_Paulo.
Confira o fuso antes de agendar; horários locais inexistentes são rejeitados.
Horários ambíguos na volta de horário de verão seguem a interpretação de Date
do navegador; use um horário inequívoco. Não há agendador automático, exclusão
definitiva, upload, tema/resumo persistidos ou publicação para ambiente remoto.
“Publicar agora” publica conteúdo somente na instância local.

Sucesso, carregamento, erros de campos, rede e autorização têm mensagens em
português. O editor é bloqueado durante gravação e respostas atrasadas após logout
não reapresentam conteúdo. Não há controle otimista de versões: em edições
simultâneas, prevalece a última gravação.

## Privacidade das métricas

A RPC existente retorna UUID do devocional, total de aberturas e leitores únicos,
sem IDs de leitores ou eventos individuais. Apesar da agregação, números exatos
de grupos pequenos ou comparações sucessivas permitem inferências. Aberturas
também podem ser repetidas pelo cliente e não comprovam conclusão de leitura.

Por isso, esta etapa não exibe contagens de leitores/aberturas, e removeu os
indicadores fictícios. Os cards mostram apenas quantidade de conteúdo por status.
Nenhum perfil, e-mail, ciência de privacidade ou histórico individual é consultado
pelo painel. Descartar os valores no render não altera a RPC: um administrador
autorizado ainda pode inspecionar a resposta agregada existente. Antes de habilitar
estatísticas de público, definir limiares para grupos pequenos, retenção e finalidade;
qualquer contrato novo de métricas deve ter revisão e testes próprios.

## Administrador fictício local — provisionamento manual seguro

1. Confirme o Supabase local ativo. Use exclusivamente a aplicação local, com
   .env.development.local ignorado pelo Git e chave pública local.
2. Cadastre um adulto fictício na interface, confirme o e-mail no Mailpit local
   (127.0.0.1:54324) e faça login. O cadastro não concede administração.
3. No Studio LOCAL (127.0.0.1:54323), abra Authentication / Users, identifique a
   conta fictícia criada e copie somente seu UUID. Não copie tokens ou senhas.
4. No CMD, na raiz do repositório, substitua UUID_DA_CONTA_FICTICIA e execute:

```sh
node scripts/provision-local-admin.mjs grant UUID_DA_CONTA_FICTICIA
```

O script exige UUID válido de usuário confirmado; verifica status CLI local e
mapeamento do contêiner para 127.0.0.1:54322. Antes de conectar, aceita somente
pipe local do Windows ou socket Unix local; hosts TCP/SSH e pipes de outra máquina
são recusados. O endpoint é fixado nas chamadas Docker e no ambiente do subprocesso
Supabase, sem herdar DOCKER_CONTEXT que possa redirecioná-las. Executa SQL confiável apenas dentro
do PostgreSQL local, com transação e ON_ERROR_STOP, inserindo private.admin_users
de forma idempotente. Não usa e-mail fixo, não cria usuários, não lê arquivos de
credenciais, não imprime segredos e não usa service_role no frontend ou na API.
Quem executa deve ser o operador confiável com acesso ao Docker local.
Entrar novamente atualiza a autorização visual; a RLS já usa a membership atual.

Para retirar a permissão específica, preservando conta e conteúdo:

```sh
node scripts/provision-local-admin.mjs revoke UUID_DA_CONTA_FICTICIA
```

Essa revogação remove somente a linha de membership do UUID indicado. Não é reset
nem exclusão da conta ou de devocionais. Não expor esses scripts pela aplicação web.

## HTTP real executado

Validação automatizada final: **65 testes aprovados em 11 arquivos** por
`npm.cmd run test:run`, build aprovado e lint aprovado sem avisos. São verificações
com Supabase simulado na fronteira, separadas do HTTP real abaixo. O inventário em
testing.md registra a execução e suas limitações.

```sh
node scripts/local-admin-smoke.mjs
```

Foram **41 verificações aprovadas**, nenhuma omitida. Duas contas fictícias foram
criadas via Auth e confirmadas pelo Mailpit. A conta editorial recebeu permissão
temporária por SQL local confiável e teve essa permissão revogada ao final.
Operações editoriais e de leitura usaram somente API pública e sessões próprias.

Foram comprovados criação, edição, agendamento oculto, publicação explícita,
retorno a rascunho sem exclusão, ocultação de publicado futuro por RLS, leitura
no acervo, persistência em cliente novo e após novo login; leitores não conseguiram
criar/editar, forjar autoria/timestamps ou acessar métricas. A lista privada não
foi exposta pela API. Revogação impediu edição tanto no repositório quanto por
API direta sem renovar claims. Contas e dois textos fictícios permanecem locais;
o script não imprime credenciais e tenta revogar o grant temporário mesmo em erro.

O CLI de provisionamento também foi executado com UUID inválido e recusou a ação
antes de acessar o banco, com código 1 esperado. As verificações anteriores de
acervo (35), perfis (29) e SQL/RLS (59) são registros históricos, não reexecutados
nesta etapa. As migrações e políticas permanecem iguais à referência c564d28.

## Validação manual aprovada pelo responsável

Na conclusão da Etapa 19, o responsável informou nesta sessão a aprovação dos dez
testes abaixo na interface local. São resultados manuais relatados pelo responsável,
distintos dos testes automatizados do agente e da execução HTTP anterior.

| Teste manual | Resultado informado |
| --- | --- |
| Acesso administrativo com conta autorizada | Aprovado |
| Criação e salvamento de rascunho | Aprovado |
| Persistência do rascunho após recarga | Aprovado |
| Edição e salvamento | Aprovado |
| Agendamento de publicação futura | Aprovado |
| Ocultação do conteúdo agendado para leitores comuns | Aprovado |
| Publicação de devocionais | Aprovado |
| Exibição no acervo quando a data permite | Aprovado |
| Bloqueio do painel para contas comuns | Aprovado |
| Mensagens de erro e validação funcionando corretamente | Aprovado |

As 41 verificações HTTP administrativas e 59 verificações SQL/RLS são resultados
anteriores, sem nova execução durante esta preparação do commit. O relato não
inclui auditoria completa de acessibilidade, testes manuais de revogação ou
comportamento de datas ambíguas em mudanças de horário de verão.

## Roteiro para repetir a validação local

1. Provisione a conta fictícia conforme o roteiro e entre novamente. Abra Painel
   administrativo; confirme lista, contagens de conteúdo e ausência de métricas pessoais.
2. Crie um rascunho preenchendo os campos obrigatórios. Confira o sucesso, recarregue
   e entre novamente; o rascunho deve permanecer. Verifique que o leitor não o vê.
3. Edite título/conteúdo. Salve e recarregue. Tente campos vazios e datas inválidas;
   confira mensagens, ausência de falso sucesso e preservação dos valores digitados.
4. Agende para data futura no fuso informado. Em outra conta de leitor, confira que
   o texto está oculto. A data, por si só, não o publica automaticamente.
5. Abra o agendado e use Publicar agora. Confira no acervo do leitor e abra o texto;
   confirme que o histórico de aberturas e o perfil continuam funcionando.
6. Volte o texto a Rascunho e confirme a ocultação após atualizar o acervo do leitor.
7. Com leitor comum, abra #admin: deve mostrar acesso restrito. Tente também sem sessão.
8. Revogue a administração por UUID no terminal. Tente salvar no editor ainda aberto:
   deve falhar; após atualizar/entrar novamente, o painel deve ficar bloqueado.
9. Simule falha de conexão e teste nova tentativa. Verifique layout em tela móvel.

Não há operações remotas autorizadas por esses passos. Publicação de aplicação,
provisionamento de produção e mudanças de schema remoto exigem escopo separado.

## Revisão de segurança para commit

A revisão encontrou uma lacuna nos scripts: conferir URLs locais do Supabase
não impedia que docker herdasse um endpoint/contexto remoto. A correção nesta
preparação introduz local-docker.mjs, que resolve apenas metadados de contexto,
recusa transportes de rede antes de contatar o daemon e fixa o socket local em
todas as operações posteriores, inclusive status CLI. O fluxo editorial não mudou.
Docker via TCP, mesmo em loopback, é recusado por esta implementação conservadora.

Cinco testes automatizados com execução simulada cobrem DOCKER_HOST remoto,
contexto remoto, pipe local com contexto herdado, socket Unix local e erro de
resolução. Não fazem conexão nem alteram permissões ou dados. As 41 verificações
HTTP anteriores precedem essa correção do limite Docker; não se declara nova
validação de concessão/revogação real após ela nesta preparação.

Na preparação final, `npm.cmd run test:run` aprovou **70 testes em 12 arquivos**;
`npm.cmd run build` e `npm.cmd run lint` terminaram com código zero, lint sem avisos.
Os dez testes manuais são resultados informados pelo responsável. Não houve
nova execução HTTP/SQL, operação de dados ou commit automático nesta preparação.
