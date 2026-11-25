# Candidato de Bíblia para o site hospedado

Este é um candidato local, não uma implantação concluída. O destino informado é
o projeto Cloudflare Pages `selah-staging` e o projeto Supabase de mesmo nome;
por decisão do responsável, tratar o endereço publicado como ambiente com dados.
O frontend só ativa a Bíblia no build STAGING com `VITE_STAGING_BIBLE_ENABLED=true`.
Sem esse sinal, o conteúdo anterior permanece. O modo PROD segue bloqueado.

## Componentes preparados

- `functions/api/bible.ts`: rota Pages candidata, ativada apenas com variáveis e
  banco D1 vinculados; falha fechada quando esses recursos não estão presentes.
- `src/bible/hostedGateway.ts`: valida a sessão em Supabase Auth, aceita apenas
  mesma origem, limita 20 requisições por usuário/minuto e 100 por dia UTC, e
  chama a API.Bible sem expor a chave ou transmitir o token do usuário a ela.
- `docs/bible-quota-candidate.sql`: estrutura criada no banco D1 separado
  `selah-bible-quota`, vinculado como `BIBLE_QUOTA` ao próximo deploy de
  produção do Pages. Contadores incluem hash do identificador da conta; definir
  retenção e processo de limpeza antes do uso.
- Segredo `BIBLE_API_KEY` e variáveis de servidor `BIBLE_SUPABASE_URL`,
  `BIBLE_SUPABASE_PUBLIC_KEY` e `BIBLE_SITE_ORIGIN` foram configurados no
  ambiente de produção do Pages; o responsável inseriu a chave como segredo
  criptografado. Chave da API não pertence a variável `VITE_*`.
- As três migrações Supabase de seleção editorial, anotações e favoritos ainda
  não foram aplicadas ao destino; revisar dados existentes, permissões, backup,
  reversão e obter a aprovação específica exigida para alteração do banco.

O limite de 100/dia é conservador para uma franquia informada de 5.000/mês,
mas não garante o consumo permitido se outros clientes compartilharem a chave.
O banco D1 tem limites próprios e a função recusará acesso se eles forem atingidos.
O painel indicou conta na faixa gratuita ao criar o D1; conferir limites e
eventual cobrança antes de aumentar o uso ou alterar o plano.
Revisar também política de privacidade/FUMS, licença das três traduções,
conteúdo de atribuição, controles de abuso, testes de concorrência e integração
real em ambiente separado antes de ativar para leitores.

Os testes unitários usam respostas fictícias e não comprovam o comportamento
real do D1, do Cloudflare, das migrações hospedadas ou da API.Bible. Não usar
o build de fixture como artefato publicado. Depois de preparar o candidato,
registrar commit, versão anterior, validações, impacto e plano de retorno.
