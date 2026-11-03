# Prompt 115 - coordenacao editorial e integracao local

Nota historica: as afirmacoes sobre interface desconectada descrevem o Prompt 115; a integracao posterior esta em editorial-reader-p116.md e o estado do release em editorial-release-staging.md.

**Situacao: BLOQUEADO para preparar implantacao em STAGING.** A candidata continua fora de supabase/migrations e nao foi aplicada a ambiente hospedado. Esta revisao nao autoriza migracao, merge, preview ou deploy.

## Coordenacao proposta

A RPC editorial verifica owner_identity, bloqueia a linha de auth.users da propria identidade FOR UPDATE, bloqueia a membership private.app_owner FOR SHARE e verifica owner_identity novamente antes da escrita. Uma trigger BEFORE INSERT no pedido oficial bloqueia a mesma linha de auth.users antes de inserir, e rejeita uma identidade diferente da sessao para os papeis de API antes de obter o lock. O lock SHARE na tabela inteira foi retirado. O user_id de pedido existente e imutavel (23514): UPDATE e DELETE da linha do pedido nao adquirem o lock de auth.users em ordem inversa. Trata-se de uma alteracao candidata, inclusive para manutencao privilegiada, que precisa de revisao.

O primeiro prototipo tambem bloqueava auth.users em BEFORE DELETE. Um ensaio real reproduziu 40P01 entre cancelamento privilegiado do pedido e exclusao fisica em cascata de auth.users. A versao atual elimina esse lock em DELETE; o teste de regressao confirmou sobreposicao das transacoes, conclusao e rollback. Isso nao prova ausencia universal de deadlocks, nem impede operadores com privilegios de banco de desabilitar triggers.

## Evidencias

- PostgreSQL descartavel, auth sintetico: 16 migrations oficiais mais candidata explicita, 38 verificacoes SQL. OWNER primeiro e pedido de outra conta primeiro concluiram com a outra transacao aberta. Mesmo OWNER: editorial primeiro fez pedido esperar; pedido confirmado primeiro fez a escrita aguardar e negar 42501. Rollback, suspensao e revogacao nas duas ordens, tentativa de pedido forjado (42501), integridade final, cascata e restricao autoral (23503) foram exercitados.
- Supabase CLI 2.122.0 local, projeto e portas exclusivos, PostgreSQL, Auth e PostgREST reais: 16 migrations e candidata em copia temporaria; signup/login OWNER e LEITOR ficticios com HTTP 200. OWNER criou e associou tema/serie; LEITOR nao pode executar mudancas (403/42501). Catalogo retornou temas, series, detalhes, episodios e devocionais publicados disponiveis, sem titulos ocultos ou posicoes; paginacao invalida 400/22023. Schema privado 406 e privilegios SQL verificados. Sessao OWNER antiga foi negada apos falta de confirmacao, revogacao, suspensao e pedido pendente. Pedido forjado 403/42501; pedido proprio 201.
- O adaptador catalogRepository da worktree frontend consultou seis metodos usando a sessao Auth e PostgREST reais locais. O controlador React foi testado com transporte simulado; NAO foi testado no navegador com API real.
- Cada ensaio usou somente contas ficticias, projeto Docker distinto e copia de migrations; recursos identificados do projeto temporario foram removidos e contagem final zero.

## Limites e proximo passo

A interface permanece sem rota ativa e ainda nao esta ligada ao ReaderLibrary real. Falta exercitar em navegador com Auth/Data API locais a abertura, retomada, conclusao dos 60 segundos, proximo episodio e ausencia de abertura duplicada, incluindo paginacao e revogacao durante a sessao. O controlador entrega ao chamador apenas a lista de episodios visiveis ja carregados; nao garante proximo episodio em pagina ainda nao carregada. Falta revisar a coordenacao de manutencao privilegiada e comportamento em Auth/PostgREST gerenciados, assim como verificar o rollout da trigger no fluxo de exclusao real. O ensaio local nao demonstra paridade com a nuvem.

Antes de qualquer STAGING: revisar SQL e plano de reversao; completar os testes de navegador e seguranca; preparar versao revisavel; obter autorizacao explicita para a migracao; depois validar dados ficticios e API em Preview autorizado, antes de promover o frontend. Nunca habilitar antecipadamente a rota hospedada. Nenhuma operacao hospedada foi executada.

Abertura: em ReaderLibrary.tsx, a funcao interna open registra o evento antes de navegar; alterar somente o hash para leitura/<id> nao registra abertura e nao satisfaz o contrato. A integracao deve compartilhar esse fluxo, preservar a protecao contra cliques duplicados e manter contexto de serie sem confiar em dados privados nem ativar a rota hospedada.

Rollout documental: revisar migration em arquivo oficial separado somente apos autorizacao; validar grants e dados sinteticos, manter frontend fechado ate migracao e checagens passarem, habilitar primeiro Preview autorizado e homologar antes de qualquer promocao. Reversao proposta: fechar a interface e retornar ao build anterior; manter dados editoriais e preparar migracao compensatoria revisada, restaurando antes a coordenacao segura do fluxo de exclusao e sem apagar conteudo. Nao executar estes passos sem aprovacao.
