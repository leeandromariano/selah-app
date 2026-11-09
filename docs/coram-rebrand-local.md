# Coram — rebranding local

Esta etapa aplica a identidade Coram à interface existente. O nome, o ícone, o título do navegador, as mensagens visíveis, a paleta e a tipografia foram atualizados. Novos leitores entram em modo escuro; preferências `Claro` e `Sistema` já salvas continuam válidas. As chaves locais com prefixo `selah` e os nomes internos de ambiente permanecem para preservar preferências, posição de leitura, lembretes e contratos instalados.

A home usa o devocional publicado e a RPC pessoal `get_my_consistency`. A sequência exibida não é calculada pelo navegador. A faixa semanal usa as datas civis do servidor em `America/Sao_Paulo`, de segunda a domingo. Se a semana começa no mês anterior, consulta o mesmo RPC para esse mês; dias que não puderem ser consultados ficam como dados indisponíveis, sem receber uma conclusão fictícia. Meses anteriores ao primeiro mês com conclusões informado pelo servidor exibem zero. A chama só acende após uma conclusão registrada para o dia atual.

A pergunta opcional “Como seu coração chega hoje?” oferece quatro respostas e mantém a escolha apenas no estado da sessão React da conta. Ela não abre o devocional, não envia a resposta ao servidor, não alimenta métricas e não bloqueia a leitura. A seleção desaparece ao atualizar a página.

Os destaques pessoais da Bíblia continuam amarelo, azul claro e rosa. Essa escolha anterior do produto não foi substituída pelas cores de exemplo dos materiais de marca. O laranja da identidade identifica ações e constância. O modo escuro usa texto secundário mais claro que o valor sugerido no material para manter o contraste legível.

A Bíblia ganhou uma grade de livros por grupo e um campo para ir diretamente a referências completas, inclusive no formato “João 3 16”. O campo não faz pesquisa semântica por temas; entradas como “ansiedade” recebem orientação de formato em vez de uma página sem resultado.

O fluxo de quatro cards, o desafio e a oração privados, a busca bíblica por assunto e a exportação de cards sociais ainda exigem desenho de comportamento, persistência e verificação de licença antes de serem considerados concluídos. Os exemplos com contadores, devocionais e dias fixos fornecidos no material não foram copiados para o produto.

Nenhuma migração, chave, publicação ou banco remoto faz parte desta etapa. A versão no site principal continua independente da branch local até uma aprovação específica de deploy.
