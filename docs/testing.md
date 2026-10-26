# Inventário e execução de testes

## Comandos

Após `npm ci`:

```sh
npm test
npm run test:run
npm run build
npm run lint
```

`npm test` abre Vitest em observação; `npm run test:run` executa uma vez e termina com código de falha se um teste falhar. Em PowerShell com restrições a scripts, usar `npm.cmd`. Build e lint não substituem testes.

`vitest.config.ts` usa jsdom e React Testing Library, sem carregar `.env` (`envDir: false`). `src/test/setup.ts` limpa a árvore React e a URL entre testes, simula rolagem e substitui `fetch` por uma função que lança erro. Isso detecta chamadas fetch inesperadas; não é um firewall para outros transportes. Testes não devem importar clientes reais ou usar credenciais. Integrações futuras devem ser simuladas na fronteira.

## Cobertura inicial

| Arquivo | Comportamentos exercitados |
| --- | --- |
| `src/components/UI.test.tsx` | Teste unitário do card isolado: ativação por teclado chama o callback com o devocional correspondente, somente após interação |
| `src/components/AuthForm.test.tsx` | Entrada inválida, mensagens e foco no primeiro erro; cadastro fictício válido sem Instagram, limpeza de campos, ausência de fetch e remoção da mensagem ao editar; cadastro incompleto e senhas divergentes |
| `src/App.test.tsx` | Busca por referência sem diferenciar maiúsculas combinada com tema, resultado vazio e recuperação; marcação de leitura com botão desabilitado e descarte em nova montagem; remoção de itens, preservação do último devocional e restauração do acervo em nova montagem |

São sete testes de comportamento local, incluindo um teste unitário de componente e integração entre App, componentes e estado React. Não há extração artificial de regras para duplicar a implementação em testes. Novos casos unitários podem ser adicionados quando surgirem módulos de domínio independentes.

O arquivo preexistente `supabase/tests/authorization.sql` é uma suíte SQL separada. Não faz parte do Vitest e não deve ser executado contra banco remoto nesta etapa. Sua existência não comprova que permissões ou migrações foram validadas.

## Testes ainda necessários

A revisão prévia de 26/10/2026 ampliou a suíte SQL com criação indevida de objetos
no schema público, autoria forjada, alterações de autoria/timestamps, leitura direta
da lista administrativa e revogação de administrador sem troca de claims. O arquivo
ativa `ON_ERROR_STOP` e deve ser executado integralmente com psql em banco local
descartável; não usa pgTAP e não é executado por `supabase test db`. Esses novos
casos passaram na execução integral local de 26/10/2026 (59 verificações, zero falhas). Ver `database.md` para configuração e limitações.

- Limites de idade (1/120 e fora do intervalo), celular inválido, Instagram inválido e senha com menos de oito caracteres no cadastro.
- Inclusão, edição e cancelamento no painel; campos obrigatórios no navegador real.
- Navegação por links, voltar/avançar, rota desconhecida e seleção do devocional correto.
- Independência da marcação entre devocionais e comportamento após editar/remover o item selecionado.
- Acessibilidade por teclado, foco, responsividade e inspeção visual em navegador real.
- E2E com Playwright conforme `development-workflow.md`; começar pequeno, sem instalação nesta etapa.
- Quando houver backend real: erros de rede, sessão, autorização administrativa, persistência, isolamento entre usuários e RLS em banco local descartável com dados sintéticos.
- Para cada bug futuro: teste específico que reproduza o problema antes da correção.

Não há cobertura percentual mínima estabelecida. Priorizar riscos e comportamentos em vez de perseguir números ou testar constantes. Formulários continuam demonstrativos: passar nos testes não significa autenticação implementada. O painel público não representa controle de acesso. Remontar App verifica o descarte de estado React, mas não substitui recarregar uma página em E2E.

Resultados de execução devem acompanhar o relatório da tarefa; não presumir aprovação porque existe um teste no repositório.

## Execução SQL local em 26/10/2026

Suíte authorization.sql revisada e executada integralmente com psql do contêiner
supabase_db_devocionais-app, PostgreSQL 17.11, correspondente à porta local
127.0.0.1:54322. Migração 20261023000100 confirmada no histórico.
Resultado: 59 assertions aprovadas, zero falhas, nenhuma omitida; término com
ROLLBACK e mensagem de sucesso. Foram usados papéis anon/authenticated e fixtures
sintéticas. Nenhum comando remoto, reset ou alteração na migração foi necessário.
A conexão psql foi feita pelo socket interno do contêiner identificado pelo
mapeamento de porta, sem credenciais na linha de comando. Valida RLS e privilégios
no banco para os cenários cobertos; não valida JWT real, Auth HTTP ou PostgREST.

Verificações complementares da mesma sessão: npm.cmd run test:run (7 testes
aprovados), npm.cmd run build e npm.cmd run lint concluídos com código zero.
Consulta após o rollback confirmou ausência das fixtures de Auth e dos
devocionais fictícios criados pela suíte.
