# Etapa 22.1 — permanência confirmada e conclusão pessoal

Branch `feat/local-auth`, base `c2fb5b3`. Somente desenvolvimento local.
Não implementa ofensivas, calendário, conquistas, desafios ou compartilhamento.
Não autoriza publicação e não habilita STAGING/PROD.

## Encerramento — Prompt 37: validação manual do responsável

O responsável informou **12/12 cenários manuais aprovados**. Estes resultados são
distintos de testes unitários, HTTP, SQL/RLS e Chromium automatizado:

1. Devocional abre e exibe indicador de leitura.
2. Botão Concluir permanece bloqueado antes de 60 segundos.
3. Tempo avança durante leitura e pausa ao mudar de aba.
4. Contagem retoma corretamente após voltar.
5. Recarga preserva progresso confirmado.
6. Após 60 segundos, botão habilita sem concluir automaticamente.
7. Concluir registra persistência.
8. Reabertura mostra conclusão existente.
9. Logout/login preserva conclusão.
10. Interface funciona em tela pequena ou celular.
11. Conclusão acessível por teclado.
12. Outro usuário não consegue visualizar o progresso.

Não se presume validação manual de dois dispositivos, suspensão real do sistema,
latências específicas, zoom de 200% ou leitor de tela físico. “Tela pequena ou
celular” é o cenário informado, sem inferir modelo de aparelho ou tecnologia
assistiva. O protocolo registra somente intervalos aceitos, não atenção/compreensão.

## Auditoria final — Prompt 37

Nenhum bloqueador funcional ou de autorização foi identificado na revisão final.
Não houve alteração de React ou das nove migrações nesta auditoria. Foram
revisados os 30 candidatos iniciais; a contagem passou a **31 (12 modificados e
19 novos)** pela inclusão de `scripts/verify-local-reading-install.mjs`, com
cobertura de recusa de destinos remotos no teste existente de entrypoints.

Resultados reexecutados agora, distintos do Prompt 36 abaixo:

| Categoria | Resultado do Prompt 37 |
| --- | --- |
| Suíte frontend | **292 testes em 28 arquivos**, todos aprovados |
| Build DEV / lint | Aprovados, lint sem avisos/erros |
| HTTP local | **251**: 46 leitura + 19 sessões + 41 login + 40 WhatsApp/feedback + 29 perfis + 35 acervo + 41 administração |
| SQL/RLS na stack atual | **196**, todas as suítes com rollback |
| PostgreSQL novo isolado | **Nove migrações em ordem + 196 SQL/RLS**, com rollback dos testes; fixtures legadas preservadas |
| Chromium automatizado | **19**, com tempo real, aba oculta, recarga, teclado, viewport móvel e logout/login |
| STAGING / PROD | Builds recusados com código 1 esperado; bloqueios em código preservados |
| `git diff --check` | Aprovado; somente avisos LF/CRLF do Git no Windows |

Os totais anteriores não foram somados a estes. Não foram repetidas as suítes HTTP
completas de recuperação, privacidade e cadastro de username; sua cobertura
SQL/unitária foi executada. A validação manual acima veio do responsável, sem
atribuir cenários extras ou testes de leitor de tela físico.

A verificação nova pode ser repetida, após as nove migrações locais aplicadas:

```bat
node scripts/verify-local-reading-install.mjs --check-local
node scripts/verify-local-reading-install.mjs
```

Ela confirma, em READ ONLY, histórico e corpos das funções de leitura instaladas;
usa a imagem já local por ID (`--pull=never`), contêiner com rede `none`, sem
portas, bind mounts ou volumes. O PGDATA novo e `/tmp` ficam em tmpfs. Não copia
dados: somente o DDL Auth, retirando os triggers privados que as nove migrações
recriam em ordem. O operador é modelado sem superuser e sem grant option em Auth;
seu bypass de RLS é restrito ao operador SQL confiável, nunca ao papel de leitura.
Fixtures fictícias criadas após o schema inicial preservam nome, telefone,
identidade do conteúdo e abertura após todas as migrações; não há backfill de
username ou conclusões fabricadas. As seis suítes SQL passam com rollback.

Não é uma segunda stack GoTrue/Kong nem um teste de infraestrutura hospedada.
Os HTTP usam somente a stack Supabase local atual. Preparações interrompidas por
permissões no bootstrap não foram contadas como aprovação; os contêineres dessas
tentativas também foram descartados. Nenhum volume atual foi alterado.

RLS/grants foram revisados para leitor e administrador: sem escrita direta de
tempo/recibos e sem leitura de terceiros, inclusive na API. Dispatcher/helper não
são públicos. Os seis RPCs e o helper de identidade usam SECURITY DEFINER; o
dispatcher é invoker e executa no papel restrito dos RPCs. Search_path vazio,
papel NOLOGIN sem bypass e revogação de membership/CREATE temporários foram
verificados. Replay e concorrência
creditam uma vez; transferência gira token; intervalos longos/negativos não contam;
edição invalida somente progresso incompleto. As PKs e locks mantêm conclusão
voluntária única, horário/dia do servidor e histórico com FK SET NULL.

Permanecem os limites documentados de sinais de foco/visibilidade, pedidos em voo,
cauda não confirmada, automação com tempo real, relógio do servidor e JWT até
expiração. Retenção/limpeza, carga sustentada e infraestrutura externa continuam
pendentes. Não se implementou qualquer parte da Etapa 22.2, nem se liberou produção.

## Experiência e regras

- Abertura, tempo confirmado e conclusão são registros distintos. Nenhuma abertura
  antiga vira conclusão. “Minhas aberturas” preserva a lista e acrescenta uma seção
  separada “Minhas conclusões”; acervo e destaque mostram conclusões próprias.
- O leitor vê o texto normalmente, mesmo se a confirmação estiver indisponível.
  No fim há progresso discreto e um botão nativo, desabilitado antes de **60.000 ms**
  confirmados. Não há contagem regressiva, conclusão automática ou prazo máximo.
- A página precisa estar visível, com foco, na rota do texto e com sessão. Perda
  de foco, aba oculta, navegação, `pagehide`, offline e desmontagem pausam os pulsos.
  Não se exige mouse, rolagem, câmera ou rastreamento de compreensão.
- A conclusão depende de ação explícita. Releitura mantém o recibo original; há
  uma única conclusão por conta/devocional por toda a vida desse registro.
- O progresso recuperado vem do banco, não de localStorage. Depois de uma recarga
  abrupta pode aparecer “Continuar leitura aqui” enquanto a autorização antiga
  ainda não expirou. O leitor decide a transferência; não há roubo automático.
- Conclusões exigem conteúdo `published`, com data já atingida no servidor,
  inclusive para administradores. Rascunhos/agendados não são elegíveis.
- Datas vêm do servidor: `timestamptz` representa o instante, e `completed_day` é
  congelado em `America/Sao_Paulo`. O dia é o da confirmação aceita, não o do início
  nem o escolhido no navegador. Repetição após meia-noite retorna o recibo original.

## Protocolo e concorrência

O cliente público Supabase usa exclusivamente JWT da sessão nos RPCs
`get_my_reading_state`, `start_reading`, `take_over_reading`, `checkpoint_reading`,
`pause_reading` e `complete_devotional`. Não usa o gateway privilegiado de login
para leitura nem envia duração, usuário ou data de conclusão.

1. O servidor verifica publicação e revisão. Serializa operações com locks na ordem
   conteúdo (`FOR SHARE`), autorização da conta (`FOR UPDATE`), progresso.
2. Existe uma única autorização por conta, vinculada ao `session_id` do JWT,
   devocional, UUID da visualização e token aleatório do servidor. UUID da
   visualização não é credencial de usuário. Nova visualização não assume a antiga.
3. O cliente envia um checkpoint cerca de **5 s depois da resposta anterior**,
   sem sobreposição. O servidor usa `clock_timestamp()` depois dos locks, calcula
   milissegundos inteiros e aceita somente intervalos de **0 a 10 s**. A autorização
   expira em **15 s**. Intervalo longo/negativo é descartado inteiro e a âncora
   reinicia; não se transforma uma hora offline em dez segundos de crédito.
4. Sequência seguinte válida credita uma vez. Replay da última sequência retorna
   o estado sem crédito; sequências antigas/futuras não avançam o relógio. Locks
   também impedem multiplicar tempo por chamadas paralelas ou por vários textos.
5. Pausar não credita a cauda entre checkpoints. Transferência explícita troca o
   token e zera a sequência/âncora, preservando o saldo daquele texto. A sessão
   anterior perde a autorização. Pausa que falhou offline é repetida antes de
   retomar, inclusive quando a reconexão ocorre em menos de dez segundos.
6. Crédito é limitado a 60.000; ao atingir esse valor, os pulsos param. Só a RPC
   de conclusão, acionada pelo botão, grava o recibo. PK e lock tornam repetições
   e ações concorrentes idempotentes. Timeout de RPC no cliente: 12 segundos;
   uma resposta perdida pode exigir consultar novamente o estado persistido.

Fechar a aba/processo pode impedir o último pedido de pausa. A recarga recupera
somente crédito confirmado. A cauda não confirmada pode ser perdida, sem inventar
tempo offline. Suspensão do dispositivo gera lacuna descartada. Alterar o relógio
do dispositivo não muda o crédito, calculado pelo PostgreSQL.

## Banco, RLS e instalação incremental

Migrações novas, nesta ordem:

1. `20261028000100_reading_completions.sql`: revisão editorial, três tabelas,
   RPCs, RLS/grants e preservação das aberturas quando conteúdo é excluído.
2. `20261028000200_reading_claims_access.sql`: adaptação ao schema Auth gerenciado.
   O operador `postgres` local não consegue delegar USAGE em `auth`; o primeiro
   teste revelou essa restrição. A segunda migração usa um helper `SECURITY DEFINER`
   que retorna **somente sub e session_id da requisição**, sem consultar contas.
   A primeira migração já aplicada não foi reescrita. Ambas são necessárias.

| Objeto | Finalidade e acesso |
| --- | --- |
| `devotionals.reading_revision` | Inteiro controlado pelo trigger; edição de título, referência, texto, reflexão, status ou data editorial incrementa a revisão. Sem grant de escrita para frontend. |
| `public.reading_progress` | PK usuário/devocional, revisão, saldo 0..60000, atualização do servidor. SELECT próprio; sem INSERT/UPDATE/DELETE para API. |
| `private.reading_leases` | PK usuário; estado atual do protocolo, sessão/visualização/token/sequência/instantes. RLS, nenhum acesso API direto. Não é uma lista de eventos de atividade. |
| `public.devotional_completions` | PK usuário/UUID original do devocional; FK atual anulável, revisão, instante/dia/fuso. SELECT próprio; escrita somente pelo protocolo. Não copia título ou texto. |

As tabelas permanecem de propriedade de `postgres`. Os RPCs pertencem a
`selah_reading_owner`: NOLOGIN, sem superuser/bypass de RLS, sem membership para
roles API, sem acesso a perfis/telefones/Auth users e sem CREATE nos schemas.
Políticas específicas desse papel continuam limitando registros à identidade da
requisição. Os seis RPCs têm `SECURITY DEFINER`, `search_path` vazio e EXECUTE
somente para `authenticated`. Dispatcher e helper não têm EXECUTE para clientes,
`anon` ou `service_role`; grants padrão indesejados das novas tabelas são revogados.
O helper de identidade pertence a `postgres` e é acessível somente ao protocolo.

Administradores do aplicativo não ganham leitura de tempo/conclusões de terceiros.
A API direta foi testada com leitor e administrador; não se depende do filtro da
interface. Donos do banco/operadores privilegiados continuam fora dessa barreira.

Não há alteração nos arquivos de migrações anteriores a esta etapa. As duas novas
foram aplicadas na stack local verificada (API 127.0.0.1:54321, PostgreSQL 54322).
Não se inspecionou nem acessou banco hospedado. Não houve reset ou migração remota.
O Prompt 36 não instalou a sequência completa em outro banco; a auditoria do
Prompt 37 acrescenta essa verificação em PostgreSQL novo isolado, conforme a
auditoria final registrada neste documento.

## Edição, despublicação e exclusão

- Revisão relevante invalida **somente progresso incompleto**, na próxima operação.
  O servidor devolve a mudança; a interface explica o reinício e solicita recarregar
  o conteúdo. Uma revisão antiga exibida não pode continuar recebendo crédito.
- Conclusão anterior mantém seu instante/revisão mesmo se o conteúdo for editado
  ou despublicado. A API não libera o texto indisponível por causa desse recibo.
- Exclusão mantém o UUID original no recibo e anula somente sua FK atual. Não há
  snapshot do texto removido. Repetição da conclusão retorna o recibo existente.
- `devotional_views.devotional_id` agora é anulável com **ON DELETE SET NULL**.
  Nenhuma abertura existente foi removida. O tipo `Opening`, lista do leitor e
  testes tratam `null` como “Devocional indisponível”. A RPC administrativa existente
  agrega a partir dos devocionais atuais: aberturas órfãs não entram nessa contagem.
  Autoria e demais FKs permanecem como antes. Testes SQL/HTTP validam essa mudança.
- A preparação HTTP exclui somente um devocional fictício criado naquela execução
  para testar a preservação. Não exclui conteúdo ou contas preexistentes. Fixtures
  e demais contas fictícias ficam locais; concessão temporária de admin é revogada.

## Privacidade e limites

Não se armazenam pulsos individuais, IP, movimentos, fingerprint, texto lido ou
novos dados de contato. Saldo, recibos e os instantes operacionais podem permitir
inferências sobre hábitos religiosos; são dados pessoais protegidos, não públicos.
Não há novas métricas administrativas pessoais, ranking ou exposição de hábitos.

Não existe limpeza automática nesta etapa. Autorizações expiram logicamente sem
excluir linhas. Proposta futura: limpar autorizações ociosas e progresso incompleto
após período aprovado (por exemplo 30 dias), por tarefa restrita, sem apagar
conclusões/aberturas. Retenção de recibos e tratamento de pedidos de exclusão
continuam dependentes de decisão própria; nenhum dado existente foi limpo.

O backend valida intervalos, exclusividade, revisão e identidade, **não atenção
humana**. Um cliente modificado pode simular checkpoints ao longo de sessenta
segundos reais. Visibilidade/foco são sinais do navegador, não atestação segura.
Há uma pequena janela de pedido em voo na perda de foco; não há precisão sobre
o instante físico de suspensão. O relógio confiável do servidor depende da
infraestrutura; saltos negativos/grandes são rejeitados, pequenos ajustes não são
uma prova antifraude. Não se declara leitura, compreensão ou segurança integral.

Logout remove a sessão do SDK e revoga refresh conforme Auth; um JWT de acesso
previamente emitido pode continuar válido até expirar. Limitação já existente,
não uma autorização para acessar registros alheios. Rate limiting externo de RPCs,
monitoramento sem segredos, CSP, disponibilidade e infraestrutura de homologação
continuam pendências. STAGING/PROD permanecem bloqueados em código.

Referências primárias: [relógios e fuso PostgreSQL 17](https://www.postgresql.org/docs/17/functions-datetime.html),
[funções e privilégios Supabase](https://supabase.com/docs/guides/database/functions),
[Page Visibility](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API).

## Iniciar e validar localmente no CMD

```bat
npx.cmd supabase start
node scripts/local-reading-smoke.mjs --check-local
node scripts/apply-local-reading-migration.mjs
node scripts/serve-local-login.mjs
```

Em outro CMD: `npm.cmd run dev`. O script de migração só admite os sete IDs da
base, opcionalmente com a primeira migração nova já aplicada, e os dois arquivos
novos esperados. Outra sequência exige revisão; não remover essa proteção nem
usar `link`, `db push` ou reset. Para DEV ainda não configurado, consultar
`auth-local.md`/`environments.md`; não sobrescrever `.env` existente nem imprimir
chaves. Somente a chave pública local chega ao cliente.

Comandos opt-in de integração, separados da suíte frontend:

```bat
node scripts/run-local-reading-sql.mjs --regression
node scripts/local-reading-smoke.mjs
node scripts/local-reading-sessions.mjs
node scripts/local-reading-browser.mjs
```

Todos fazem preflight compartilhado: Docker com socket local fixado, loopback e
portas esperadas, sem proxy/contexto remoto. O navegador usa Chromium instalado,
perfil NOVO em cache ignorado e somente frontend/API locais. Não instala browser
nem consulta cookies/storage/perfis pessoais. Precisa de Vite e Edge Function
locais ativos; porta de depuração ocupada é recusada.

## Implementação — Prompt 36: resultados anteriores

- HTTP de leitura: **46/46**; sessões/legado: **19/19**, com tempo real, API pública,
  identidade Auth oficial e cinco checkpoints/conclusões paralelos.
- Regressão HTTP: login **41**, WhatsApp/feedback **40**, perfis **29**, acervo
  **35**, administração **41**. Total: **251 HTTP** nesta rodada, sem somar testes
  unitários, SQL ou navegador. As suítes completas de recuperação/privacidade e
  cadastro de username não foram repetidas por HTTP nesta rodada; cobertura SQL
  e unitária correspondente foi executada.
- SQL/RLS: **196** com rollback: 59 leitura + 59 autorização + 16 privacidade +
  18 username + 25 WhatsApp + 19 login. O teste 59.999/60.000 usa preparação
  controlada dentro do rollback; o fluxo HTTP/navegador usa relógio real.
- Chromium isolado: **19/19**, incluindo aba realmente oculta por 12 s,
  retomada, recarga parcial, sessenta segundos confirmados, ação por teclado,
  viewport móvel de 390 px, conclusão após recarga/logout/login e histórico.
  Houve uma tentativa parcial de 1 e outra de 14 verificações por problemas no
  harness (seletor e evento de teclado); as rodadas completas posteriores passaram.
  Não são aceites manuais do responsável nem testes de todos os leitores de tela.
- Resultado final da suíte frontend/build/lint e bloqueios: `testing.md`.
- Não se repetiu a instalação completa em banco novo nesta etapa. Não se testaram
  carga sustentada, todos os dispositivos móveis, queda física do servidor,
  suspensão real do sistema ou mudança real de data/DST do servidor. Casos de
  relógio/rede são cobertos por testes controlados e limites do protocolo.

## Checklist ampliado para futuras verificações

Usar contas/devocionais fictícios locais. Os 12 cenários aprovados pelo responsável
estão registrados acima; essa aprovação não se estende individualmente aos itens
adicionais deste checklist, como dois dispositivos, falhas controladas e zoom.

1. Entrar por username e por e-mail; abrir publicação liberada e conferir visual.
2. Antes de 60 s confirmados, tentar concluir: botão desabilitado. Conferir a
   explicação de permanência, sem promessa de compreensão ou valor espiritual.
3. Trocar de aba por mais de 10 s: progresso para. Voltar e aguardar novos pulsos.
4. Navegar ao acervo/voltar e recarregar: saldo confirmado reaparece. Se necessário,
   escolher “Continuar leitura aqui”; não confundir cauda não confirmada com perda
   de dados já confirmados.
5. Abrir duas abas e dois dispositivos da mesma conta. Somente uma leitura ativa;
   transferência explícita pausa a anterior. Textos diferentes têm saldos próprios.
6. Simular offline no DevTools: erro/pausa sem crédito inventado; reconectar e
   retomar. Testar interrupção logo antes de um checkpoint e resposta perdida.
7. Chegar a 60 s e continuar lendo: nada conclui sozinho. Usar Tab/Enter para
   concluir; conferir recibo e releitura sem duplicação.
8. Recarregar, sair e entrar novamente: saldo incompleto e recibo persistem.
   Conferir destaque/acervo e “Minhas conclusões” separados de aberturas.
9. Trocar de conta: não aparecem tempo ou conclusões de outra pessoa.
10. Com admin fictício, editar durante leitura incompleta: mensagem de revisão e
    reinício, sem alterar conclusão antiga. Despublicar e conferir bloqueio.
11. Exclusão somente em fixtures descartáveis próprias: recibo e abertura ficam
    como indisponíveis, sem texto copiado. Nunca testar isso em conteúdo existente.
12. Validar teclado, zoom de 200%, leitor de tela, rotação e aparelho móvel real;
    verificar foco visível, mensagens sem anúncios a cada segundo e ausência de
    sobreposição do botão. Conferir Network somente 127.0.0.1:54321.

A Etapa 22.2 precisa de autorização separada. Esta entrega não calcula ofensivas.

## Arquivos desta entrega

Revisão final: **31 arquivos**, 12 modificados e 19 novos. Nenhum arquivo de
ambiente, credencial, screenshot, log ou cache é candidato. `.env.local`,
`.env.development.local` e cache do navegador continuam ignorados. A URL remota
fictícia já existente em testes de ambiente é entrada de **negação**, não destino
configurado ou acessado. Não houve staging nem commit automático.

Modificados (12):

```text
docs/database.md
docs/development-workflow.md
docs/devotionals-local.md
docs/privacy-essential.md
docs/testing.md
src/App.css
src/components/ReaderLibrary.test.tsx
src/components/ReaderLibrary.tsx
src/components/UI.tsx
src/devotionals/repository.ts
src/test/libraryBoundary.ts
src/test/localEnvironment.test.ts
```

Novos (19):

```text
docs/reading-local.md
scripts/apply-local-reading-migration.d.mts
scripts/apply-local-reading-migration.mjs
scripts/local-reading-browser.mjs
scripts/local-reading-sessions.mjs
scripts/local-reading-smoke.mjs
scripts/reading-local-fixtures.mjs
scripts/run-local-reading-sql.mjs
scripts/verify-local-reading-install.mjs
src/components/ReadingProgress.test.tsx
src/components/ReadingProgress.tsx
src/reading/controller.test.ts
src/reading/controller.ts
src/reading/repository.test.ts
src/reading/repository.ts
src/test/localReadingEntrypoints.test.ts
supabase/migrations/20261028000100_reading_completions.sql
supabase/migrations/20261028000200_reading_claims_access.sql
supabase/tests/reading-completions.sql
```
