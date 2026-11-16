# Raio-X do Texto: importação em lote

Tudo entra como **rascunho**. Depois você revisa e publica no painel OWNER, em Conteúdo, Raio-X do Texto, usando "Selecionar todos" ou "Só rascunhos" e "Publicar selecionados".

## Como montar o PDF (modelo)

Um bloco por termo, separado por uma linha em branco ou por `---`. Os rótulos podem ter acento ou não.

```
TERMO: Graça
PALAVRAS: graça, graças
ORIGINAL: Do grego charis: favor dado de graça, sem ser merecido nem comprado.
EPOCA: No mundo greco-romano, um favor criava dívida...
PARALELO: Romanos 11:6
VERSICULOS: Efésios 2:8; Romanos 3:24; Tito 2:11
```

Regras (as mesmas que o painel confere):

- **TERMO**: de 2 a 60 caracteres. É o título da gaveta.
- **PALAVRAS**: o que fica sublinhado no texto, separado por vírgula (de 1 a 10 palavras). Coloque as variações (singular, plural, verbos). Em traduções diferentes a palavra pode mudar.
- **ORIGINAL**: até 300 caracteres. O sentido da palavra no original (grego ou hebraico).
- **EPOCA**: até 500 caracteres. O contexto cultural.
- **PARALELO**: um versículo no formato `Livro cap:verso` (de 3 a 80 caracteres).
- **VERSICULOS**: onde o termo vale, separados por `;`. Formato `Livro cap:verso` ou `Livro cap:verso-verso`. O nome do livro precisa ser o do app (Gênesis, Êxodo, 1 Coríntios, Salmos...). Pode ter até 60.

## Arquivo de importação (JSON)

Eu converto o PDF para este formato. Um exemplo está em `docs/raio-x-exemplo.json`. Aceita uma lista, ou um objeto com a chave `terms`. `words` e `verses` podem ser lista ou texto corrido.

Termo que já existe (mesmo nome) é ignorado, a menos que você marque "Atualizar os termos que já existem", que mantém a situação atual (rascunho ou publicado).

## Dicionário de teologia

Cada termo pode ter um verbete mais longo (até 1500 caracteres), mostrado na gaveta/aba como "Dicionário de teologia". Planilha-modelo: `raio-x-dicionario-modelo.xlsx` (colunas `TERMO` e `DICIONARIO`).

No painel OWNER, em Raio-X do Texto, use "Importar dicionário". Cada verbete é ligado ao termo que já existe, pelo nome (sem diferenciar maiúsculas); termo inexistente é apontado e ignorado. Formato do arquivo (JSON), uma lista:

```json
[{ "term": "Graça", "dictionary": "Definição fictícia.\n\nSegundo parágrafo." }]
```

Também dá para incluir `"dictionary"` direto no arquivo de termos da importação em lote.
