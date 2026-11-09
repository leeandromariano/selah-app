# Leitor bíblico local — Etapa 23.3

## Integração API.Bible em desenvolvimento — 07/11/2026

Preparação de hospedagem: existe um candidato de função Cloudflare Pages que
valida a sessão no Supabase Auth, guarda a chave apenas no servidor e limita
as requisições usando um banco D1 dedicado. A configuração não foi criada nem
implantada; o cliente preparado para STAGING envia o token da sessão à rota da
mesma origem, mas os controles da Bíblia continuam desativados nesse ambiente.
O limite diário é uma proteção preliminar,
não garante conformidade com a janela de faturamento nem cobre outros serviços
que compartilhem a chave. Revisar cota, privacidade, retenção dos contadores,
limpeza, custos, CSP/FUMS e plano de reversão antes de disponibilizar.

O responsável selecionou NVT (`41a6caa722a21d88-01`), ARA
(`afc24de218ef6e38-01`, identificador a confirmar na conta) e NTLH
(`acef2bc597c450a1-01`) no plano Starter não comercial. O gateway local
`src/bible/apiGateway.ts` valida edição, livro e capítulo e mantém a chave no
servidor. Ele está ligado somente ao servidor e à interface de desenvolvimento local.
O cliente e o parser locais recusam respostas sem atribuição, token FUMS ou
numeração inequívoca; os exemplos dos testes são exclusivamente fictícios.
No servidor Vite local, as três traduções podem ser testadas via variável de
processo `BIBLE_API_KEY` (não `VITE_*`); o endpoint local limita chamadas e recusa
requisições entre sites. A chave não é persistida no código. O leitor exige uma
atribuição e registra FUMS sem enviar ID do usuário antes de exibir o capítulo.
O inicializador `scripts/start-bible-local.ps1` recebe a chave sem eco e inicia
o Node com `NODE_USE_SYSTEM_CA=1`. Assim, a conexão usa os certificados
confiáveis do Windows sem desabilitar a validação TLS. Nesta máquina, isso
resolveu a falha `UNABLE_TO_VERIFY_LEAF_SIGNATURE` na conexão com a API.Bible.
O tratamento de respostas não reconhecidas falha fechado. A rota local não é
uma rota para STAGING/PROD.

Validação posterior: em 07/11/2026, Esdras 1 foi exibido no navegador local
para NVT, ARA e NTLH. A NTLH agrupa os versículos 9–10; o leitor foi ajustado
para apresentar intervalos e reconhecer uma referência a qualquer versículo
do grupo. Isso não valida todos os capítulos, o contrato hospedado ou a licença
para uso comercial. O conteúdo devolvido pela API não foi gravado em fixtures.
No desenvolvimento local o seletor apresenta apenas NVT, ARA e NTLH; a NVI
indisponível e os dados demonstrativos foram ocultados, e a NVT é a abertura
padrão. O comportamento anterior do build hospedado permanece sem ativação.

### Passagens nos devocionais — em desenvolvimento

Uma migração incremental local e um seletor foram preparados para guardar a
tradução, livro, capítulo e intervalo em `bible_selection`, sem persistir o
texto da API. Leituras buscarão o texto atual e mostrarão a atribuição, com
abertura da passagem por duplo clique e link acessível. Os registros antigos
preservam `bible_text`; referências reconhecíveis abrem na NVT, indicada no
link, sem atribuir essa versão ao texto original. A migração foi exercitada
em transações revertidas com identidades fictícias para ADMIN e PUBLICADOR,
inclusive envio para revisão e negação a leitor, e foi aplicada ao banco local
em 07/11/2026. O fluxo está habilitado somente no desenvolvimento local, em
`editorialFeature.ts`. Não foi aplicado a STAGING ou produção. A API.Bible exige que conteúdo armazenado não
esteja desatualizado; a leitura dinâmica evita armazenamento permanente do
texto da API. Ver https://care.api.bible/article/401-caching-content.

Antes de ativar em STAGING: confirmar os identificadores e licença exata via resposta da
conta, integrar apresentação fiel dos capítulos e copyright por edição,
validar FUMS no navegador, implementar autenticação e controle de abuso e
consumo de cota na rota hospedada, e testar a integração real com chave guardada
no servidor. A documentação da API para metadados FUMS difere entre exemplos
das versões; confirmar o contrato efetivo. Não inserir chave em `VITE_*` ou no
Git. Sem essas etapas, a Bíblia permanece demonstrativa e não está pronta para
STAGING. Nenhuma licença para monetização é presumida.

### Destaques e anotações pessoais — preparação local

O leitor permite marcar o versículo inteiro em amarelo, azul-claro ou rosa,
copiar com referência e atribuição, e manter uma anotação opcional. Versículos
agrupados pela tradução são tratados como um único trecho. A migração
`bible_personal_annotations` armazena somente conta, referência, cor e anotação;
nenhum texto da API é guardado. As políticas RLS restringem leitura e escrita à
conta autenticada e bloqueiam contas Google com cadastro pendente. Em testes
reversíveis com identidades fictícias, uma conta não leu, alterou ou apagou
registros de outra; o acesso anônimo e o cadastro pendente foram negados.
A migração foi aplicada ao Supabase local em 07/11/2026 e os controles estão
habilitados no ambiente local. Não há migração ou habilitação em STAGING/PROD
nesta etapa.

O menu de ações abre ao selecionar o próprio versículo. Copiar, anotar, usar
cores e marcar favorito são ações independentes; favoritos usam tabela própria
com RLS por conta, sem gravar texto bíblico e sem alterar notas anteriores. A
migração de favoritos foi verificada em transação revertida com contas
fictícias e aplicada ao banco local em 07/11/2026; STAGING/PROD não foram alterados.

## Validação manual informada pelo responsável — 9/9 aprovados

1. A seção Bíblia aparece no menu e abre corretamente.
2. Consigo selecionar livros do Antigo e do Novo Testamento.
3. A navegação entre capítulos funciona, incluindo o primeiro e o último.
4. O seletor de traduções identifica corretamente versões indisponíveis.
5. Links internos e destaques de versículos funcionam nos dados demonstrativos.
6. As referências devocionais não abrem conteúdo fictício como se fosse uma tradução real.
7. A seleção permanece ao atualizar a página na mesma aba.
8. Nenhuma alteração prejudicou leitura, comentários ou Minha Jornada.
9. Teclado, celular e os três temas funcionam corretamente.

Registro literal informado pelo responsável, não execução manual do agente;
não comprova fonte licenciada, NVI, acesso hospedado ou outros cenários.
As verificações automatizadas repetidas no Prompt 65 estão em [testing.md](testing.md).

O menu Bíblia abre `#biblia`. O catálogo em `src/bible/catalog.ts` contém os
66 livros protestantes e quantidades de capítulos, agrupados por testamento.
`BibleReader` oferece seleção, navegação entre capítulos e livros, versículos
numerados e destaque temporário do trecho solicitado. A última localização é
mantida em `sessionStorage` durante a sessão da aba, quando disponível. Links
seguem `#biblia/<tradução>/<livro>/<capítulo>[/<versículo>[-<fim>]]`; rotas e
parâmetros inválidos são recusados. Versículos ausentes são indicados na tela.

`BibleProvider` descreve metadados de tradução, disponibilidade, livros,
atribuição e carregamento assíncrono por capítulo. A única opção ativa é
**Conteúdo demonstrativo**: textos fictícios parciais em Gênesis 1 e João 3;
não são versículos bíblicos nem uma Bíblia completa. Demais capítulos mostram
estado vazio. O adaptador NVI é inativo, sem endpoint ou credenciais, e retorna
indisponibilidade. Não existe conteúdo NVI nem provedor externo habilitado.

O parser aceita nomes completos e inequívocos, como `João 3:16`, `Romanos
12:1-2` e `Salmos 23`; não interpreta abreviações. `BibleReference` mantém o
texto editorial intacto e só cria link se uma tradução disponível e licenciada
declarar o livro e validar explicitamente toda a referência. O provedor atual
não faz isso: **nenhuma referência de devocional vira link nesta etapa**. Um
adaptador futuro deve validar limites reais dos versículos e disponibilidade,
sem direcionar silenciosamente para outro texto ou versão.

## Licença e integração futura

NVI em português depende de autorização específica para o projeto, fonte e
credenciais válidas. A existência de API ou endpoint não autoriza distribuição.
Antes de integrar YouVersion Platform, API.Bible ou outra fonte, conferir licença
de cada versão, uso, atribuição, cache, redistribuição, limites e restrições de
processamento por IA. Não usar scraping. Segredos permanecem no servidor em
integração futura apropriada; não colocar chaves privilegiadas em `VITE_*`,
frontend ou logs. Não registrar textos protegidos integralmente. Nenhuma tabela
ou migração foi criada para conteúdo bíblico. A viabilidade de um provedor
específico ainda não foi comprovada.

## Validação manual sugerida

- Abrir Bíblia no menu; verificar aviso de conteúdo fictício e NVI indisponível.
- Selecionar livros dos dois testamentos e seus capítulos; conferir primeiro e
  último capítulo, mudança entre livros e estado vazio.
- Abrir `#biblia/demonstracao/joao/3/16-17`, observar destaque temporário e
  mensagem para versículo inexistente; conferir rota malformada e indisponível.
- Sair da seção e voltar durante a sessão; testar teclado, celular e temas Claro,
  Escuro e Sistema. Confirmar que referências das devocionais permanecem texto
  enquanto não houver tradução autorizada e validada.
- Verificar login, conclusão voluntária após 60 segundos, Jornada, desafios,
  comentários e moderação sem dados reais. Conteúdo licenciado e serviços reais
  não fazem parte desta validação local.

Sem tradução bíblica real, leitor completo, funcionamento offline ou validação
de licença, a funcionalidade ainda é demonstrativa e não resolve a necessidade
de texto bíblico para o MVP. O cadastro aberto, confirmação de e-mail, bloqueios
STAGING/PROD e proibição de entrega Web Push externa permanecem inalterados.
# Lista de favoritos

Na Bíblia local, Favoritados lista as passagens da conta em páginas de cinco,
com texto obtido da API, atribuição e link para abrir o versículo no capítulo.
O texto não é guardado na tabela de favoritos. O aviso de direitos aparece junto
à leitura, sem caixa promocional. A lista requer a migração local de favoritos.
