# Regras permanentes de engenharia — Selah

Aplicam-se a toda tarefa neste repositório, inclusive às instruções de agentes.

1. Separar desenvolvimento local, homologação e produção. Cada ambiente deve usar recursos e configuração próprios.
2. Nunca alterar banco de produção nem publicar versões sem autorização explícita do responsável nesta sessão. Autorização para implementar ou testar não autoriza publicação, migração ou operação em produção.
3. Preservar a interface e as funcionalidades atuais. Mudanças de comportamento ou design exigem escopo autorizado.
4. Trabalhar em branches Git para novas funcionalidades e melhorias (`feat/`, `fix/`, `chore/`). Preservar alterações locais preexistentes. Não trabalhar diretamente na branch principal.
5. Implementar testes automatizados progressivamente, cobrindo comportamentos reais, inclusive erros e limites; não criar testes que apenas confirmam constantes.
6. Todo bug corrigido deve ganhar teste de regressão que reproduza a falha anterior.
7. Antes de considerar uma tarefa concluída, executar `npm run test:run`, `npm run build` e `npm run lint`. Se houver falha ou impedimento, informar claramente e não declarar a validação concluída.
8. Não remover, pular ou enfraquecer testes apenas para fazê-los passar. Corrigir a causa; alterações legítimas de contrato devem ser justificadas.
9. Nunca afirmar que testes passaram sem executá-los. Relatar comandos realmente executados, resultados e limitações.
10. Usar somente dados fictícios em desenvolvimento, homologação, fixtures, screenshots e testes.
11. Não copiar dados reais de usuários, backups, exportações ou logs de produção para ambientes de teste.
12. Separar credenciais por ambiente. Nunca versionar segredos, imprimi-los em terminais/relatórios ou colocá-los em fixtures. Não ler arquivos de credenciais para inspeções gerais. Variáveis `VITE_*` são públicas no bundle: nunca usar chaves privilegiadas nelas.

Testes unitários e de integração devem funcionar sem serviços externos, bancos remotos ou credenciais. Simular integrações na fronteira. Não importar o cliente Supabase real nos testes de interface. Não executar SQL/migrações como parte desses comandos.

Antes de qualquer operação remota, identificar ambiente e impacto sem expor credenciais. Publicação e mudanças de produção exigem aprovação explícita do resultado concreto, com versão, validações e plano de reversão disponíveis. Se o ambiente de um recurso for incerto, não escrever nele.

Consultar [processo de desenvolvimento](docs/development-workflow.md) e [inventário de testes](docs/testing.md). Manter esses documentos atualizados quando comportamento, cobertura ou processo mudar. Documentar funcionalidades demonstrativas sem apresentá-las como integrações completas.
