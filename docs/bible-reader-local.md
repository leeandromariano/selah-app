# Leitor bíblico local — Etapa 23.3

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
