# Proposta editorial — temas e séries

**Status:** proposta para revisão; não é migration, não concede acesso e não autoriza implantação. Base examinada: `e0a17d9`. Esta proposta não implementa a interface da Etapa 112.

## Base oficial observada

- `public.devotionals` tem `author_id` vinculado a `auth.users` com `ON DELETE RESTRICT`, estados `draft`, `scheduled` e `published`, e `publish_at`. A policy de leitura do leitor autenticado exige `status = 'published'` e `publish_at <= now()`; existe uma exceção legada administrativa. As permissões legadas não são modelo para PUBLICADOR.
- `reading_revision` é alterada pelo trigger existente quando campos editoriais, status ou data de publicação mudam. O repositório do leitor consulta publicações liberadas e o acervo filtra e ordena no cliente; `theme: 'Devocional'` é rótulo visual, não tema persistido.
- `private.owner_identity()` é a verificação OWNER oficial existente. Nesta base não há contrato oficial PUBLICADOR a ser presumido. Uma futura autorização PUBLICADOR deve ter fonte de servidor e ser revista separadamente; nenhuma decisão abaixo a ativa.

Referências: `supabase/migrations/20261023000100_initial_schema.sql`, `20261028000100_reading_completions.sql`, `20261028000900_owner_eligibility_staging_audit.sql`, `src/devotionals/repository.ts` e `src/components/ReaderLibrary.tsx`.

## Modelo da V1

A tabela abaixo registra as decisões da V1; os nomes técnicos, limites de campos e DDL ainda precisam de revisão antes de uma migration.

| Entidade | Campos principais | Integridade proposta |
| --- | --- | --- |
| Tema | UUID, nome, slug, descrição opcional | Nome normalizado único e slug único; vazios rejeitados. |
| Devocional–tema | devotional_id, theme_id | Relação muitos-para-muitos, com chave composta; sem duplicar associação. |
| Série | UUID, título, slug, descrição, responsável editorial opcional, estado de disponibilidade | Slug único; responsável vinculado a identidade existente quando houver, mas não é prova de permissão. |
| Episódio de série | series_id, devotional_id, posição inteira positiva | Um devocional em no máximo uma série; posição única por série e devocional único globalmente. |

Na V1, a normalização do nome de tema é aplicada no banco: aparar espaços externos, normalizar espaços internos e comparar sem distinção de caixa ou acentos. A escolha da implementação de collation/extensão e o tratamento de eventuais duplicatas exigem testes no PostgreSQL do projeto. Os slugs de temas e séries são únicos e imutáveis após a criação; renomear um tema ou título não altera o slug. O slug é fornecido ou gerado e validado no servidor; colisões retornam erro tratável, sem criação automática de outro tema.

A exclusão de um tema ou série associado deve ser recusada por padrão; o OWNER primeiro remove ou transfere associações explicitamente. Excluir um devocional remove apenas suas associações, sem apagar tema ou série. Para série, excluir um episódio deixa lacuna na posição: nunca renumerar automaticamente; a reordenação é uma operação transacional e validada, com unicidade e estratégia para troca de posições sem conflitos transitórios. Não reutilizar a data de publicação como posição. A exclusão física de uma conta autora continua sujeita à restrição de autoria existente.

## Disponibilidade e privacidade

- Uma série é disponibilizada ao leitor apenas quando explicitamente marcada como disponível **e** contém ao menos um episódio publicado e liberado no servidor. Séries vazias, rascunhos, títulos de episódios futuros, posições ocultas e contagens totais que os revelem não são retornados.
- Um tema só aparece para descoberta quando associado a pelo menos um devocional publicado e liberado. O leitor autenticado pode ler somente essas associações e os campos editoriais necessários.
- Um episódio removido, despublicado ou ainda não liberado desaparece das respostas do leitor, sem alterar as posições internas dos demais. Para não revelar episódios ocultos por lacunas, a resposta ao leitor fornece somente a ordem visível, sem expor posições internas.
- Responsável editorial e autoria são dados distintos. Não expor identidade de responsável ao leitor por padrão. A visibilidade do registro de série não amplia a visibilidade dos devocionais.
- A regra de servidor para todos os joins é a mesma da publicação oficial: `status = 'published'` e `publish_at <= now()`. Não confiar apenas na RLS de `devotionals` ao fazer join com executor privilegiado: a exceção ADMIN legada torna necessário um predicado explícito e projeção mínima.

## Autorização proposta

| Operação | LEITOR autenticado | PUBLICADOR | OWNER elegível |
| --- | --- | --- | --- |
| Ver temas/séries e episódios disponíveis | Sim, somente conteúdo liberado | Igual ao leitor | Consulta editorial autorizada separadamente |
| Criar, renomear ou excluir tema/série global | Não | Não | Sim, por operação no servidor |
| Associar ou ordenar episódios | Não | Não | Sim, por operação no servidor |
| Alterar devocional | Não | Apenas conteúdo próprio, quando houver autorização oficial implementada | Conforme contratos administrativos existentes, sem concessão automática de outra função |

O OWNER é identidade separada. Operações editoriais globais futuras devem verificar `private.owner_identity()` no banco, validar o alvo e usar transação; nenhuma flag, metadata, e-mail ou controle de interface concede permissão. Na V1, somente OWNER gerencia temas, séries e suas associações; PUBLICADOR não recebe novas permissões editoriais. Não conceder acesso direto a tabelas privadas. Em eventual RLS, revisar privilégios, papéis, ownership, `search_path`, `SECURITY DEFINER` e acesso direto a joins; endpoints de escrita devem falhar fechados e tratar concorrência com revogação. Operações privilegiadas de manutenção não são cobertas automaticamente.

## Contratos futuros para a Etapa 112

1. Listar temas disponíveis: id, nome e slug; busca e paginação limitadas, com ordenação estável.
2. Listar séries disponíveis: id, título, slug e descrição; paginação limitada.
3. Consultar série por slug: metadados permitidos e episódios publicados/liberados, em ordem editorial visível; conteúdo ausente e indisponível sem divulgar rascunho.
4. Consultar acervo por tema ou série: somente publicações visíveis, com ordenação estável e paginação limitada. Filtros combinados e limite máximo precisam de contrato definido antes da implementação; os slugs são imutáveis na V1.

Os contratos devem usar a identidade autenticada quando exigida, não retornar dados de contato, permissões ou métricas privadas e respeitar o mesmo acesso do acervo existente. Eles são propostas, não RPCs disponíveis.

## Evolução e validação

1. Revisar esta proposta e definir os detalhes técnicos da normalização e das operações de edição. Não conceder novas permissões ao PUBLICADOR nesta V1.
2. Preparar migration **incremental**, sem alterar as 16 históricas: estruturas opcionais e sem backfill inventado, constraints, índices e políticas/contratos testados. Publicações antigas continuam acessíveis sem tema ou série; a instalação deve suportar frontend antigo.
3. Em PostgreSQL descartável, testar RLS e acesso direto para LEITOR, PUBLICADOR e OWNER elegível ou inelegível: leitura apenas de publicados e liberados, negação de escritas fora de OWNER, joins sem rascunhos, agendados ou indisponíveis e sessões antigas. Testar também unicidade concorrente, imutabilidade de slugs, troca de posições, exclusões e rollback.
4. Testar a integração com Auth/Data API isolados e dados fictícios; revisar grants/RLS e evitar vazamento por joins, contagens ou endpoints indiretos. Só depois planejar homologação autorizada.
5. Planejar rollback antes da implantação: desligar o consumo no frontend primeiro; preservar os dados editoriais novos para recuperação e reverter schema somente após avaliar dependências, retenção e impacto. Não automatizar descarte de dados.

A interface da Etapa 112 depende de contratos implementados e testados, não desta proposta. Nenhuma migration, permissão ou dado hospedado foi alterado.
