# Processo de desenvolvimento do Selah

## Situação atual

Aplicativo React + TypeScript + Vite, navegação por hash. Cadastro, confirmação de e-mail, login, logout e recuperação de senha usam Supabase Auth exclusivamente local. Perfis, publicações dos leitores e histórico de aberturas persistem no PostgreSQL local. O painel exige sessão e autorização administrativa confirmada no banco, mas suas operações e indicadores continuam demonstrativos em memória e não alteram o acervo persistente. Não há conclusão de leitura: o schema registra somente aberturas. O devocional do dia usa a data em America/Sao_Paulo. Ver `devotionals-local.md` para a Etapa 18.2.

O cliente em `src/lib/supabase.ts` é usado pela autenticação e recusa destinos fora de localhost/127.0.0.1:54321. A suíte React simula esse módulo na fronteira, sem importar o cliente real. A suíte SQL local teve 59 verificações aprovadas; a Etapa 16 não altera migrações nem políticas. Não executar SQL ou migrações durante validações do frontend. Ver `auth-local.md` para os fluxos HTTP locais e suas limitações.

## Três ambientes

A Etapa 18.1 acrescenta `#perfil`: leitura, criação explícita e atualização do
próprio perfil pelo cliente público com sessão, persistindo no PostgreSQL local.
O cadastro envia um rascunho de campos pessoais nos metadados de Auth; depois da
confirmação/login, o leitor revisa e salva em “Meu perfil”. Metadados não concedem
administração nem substituem um perfil já existente. Não houve alteração de
migrações, triggers ou RLS. Ver `profiles-local.md` para validação e limitações.

| Ambiente | Finalidade | Dados e serviços | Configuração |
| --- | --- | --- | --- |
| Desenvolvimento local | Implementar e testar na máquina | Acervo fictício; testes sem rede. Supabase local isolado; Auth real apenas com identidades fictícias | `.env.development.local`, apenas credenciais de desenvolvimento |
| Homologação | Revisar uma versão candidata antes da produção | Somente dados sintéticos; projeto/backend exclusivo de homologação | `.env.staging.local` ou variáveis exclusivas no provedor |
| Produção | Atender usuários reais | Recursos e contas exclusivos; acesso restrito | Segredos exclusivos do ambiente de produção no provedor |

Homologação e produção são uma separação exigida pelo processo, não ambientes criados nesta etapa. Antes de conectar qualquer backend, verificar manualmente o destino e suas permissões. Nunca reutilizar credenciais entre ambientes ou copiar dados de produção para testes. Não usar serviços de produção ao desenvolver localmente.

Vite carrega `.env` e `.env.local` também em outros modos. Evitar credenciais nesses arquivos genéricos; verificar a configuração existente privadamente antes de usar qualquer integração. Usar arquivos específicos por modo. `vite build --mode staging` poderá gerar o candidato de homologação quando houver infraestrutura; `npm run build` usa o modo de produção por padrão. **Build local não publica nada**, mas seu bundle incorpora variáveis `VITE_*`: elas não podem conter segredos. Nunca usar `service_role`, senha do banco ou tokens administrativos no frontend. `.env.example` deve conter somente placeholders.

## Ciclo de uma mudança

1. Inspecionar `git status`, ler `AGENTS.md` e preservar trabalho existente.
2. Criar branch `feat/nome`, `fix/nome` ou `chore/nome`. Nesta implantação: `chore/engineering-workflow`.
3. Definir comportamento esperado, telas afetadas e riscos de regressão. Preservar interface e funcionalidades fora do escopo.
4. Implementar em passos pequenos. Para bugs, reproduzir a falha com teste que falhe antes da correção. Acrescentar testes de comportamento para novas regras.
5. Usar `npm test` durante o desenvolvimento (modo observação). Antes de concluir, executar `npm run test:run`, `npm run build` e `npm run lint`. Investigar falhas sem enfraquecer testes.
6. Revisar diff, validar visualmente telas afetadas quando aplicável e atualizar o inventário de testes. Informar verificações executadas, falhas e lacunas. Não confundir testes em jsdom com validação em navegador real.
7. Abrir revisão da branch com escopo, evidências e limitações. Não fazer merge automático nem publicar por consequência de implementar uma tarefa.

## Publicação

Preparar primeiro um candidato revisável: commit identificado, build, testes, lint e notas do que mudou. Antes de publicar **qualquer versão**, apresentar destino, versão, resultado das verificações e reversão e obter autorização explícita do responsável. Não configurar deploy automático que contorne essa aprovação.

Após autorização específica para homologação, publicar no ambiente isolado e validar os fluxos com dados fictícios. Registrar problemas e repetir verificações após correções. Aprovar homologação não autoriza publicar produção.

Para produção, apresentar o candidato homologado, impacto e plano de retorno à versão anterior; obter autorização explícita específica. Uma autorização de deploy não inclui mudança no banco: alterações de produção e migrações exigem escopo e aprovação próprios. Não executar migrações automaticamente no build ou nos testes.

Registrar versão publicada e verificar fluxos essenciais depois de um deploy autorizado. Reversão de aplicação deve usar artefato anterior conhecido; reversão de dados exige planejamento próprio, pois rollback do frontend não desfaz migrações.

## Playwright e evolução

Não instalar Playwright nem navegadores nesta etapa. Quando a suíte local estiver estável, começar com um único projeto Chromium, servidor Vite local e acervo fictício, sem backend remoto. Cobrir navegação, busca/filtro, leitura, validação dos formulários e administração demonstrativa. Usar seletores por papel/nome acessível. Adicionar outros navegadores e CI apenas quando houver necessidade concreta.

Autenticação, autorização e persistência reais precisarão de cenários novos quando forem implementadas. Nesse momento, usar backend local ou homologação isolada e fixtures sintéticas; nunca validar permissões contra produção.
