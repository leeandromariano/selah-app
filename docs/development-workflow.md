# Processo de desenvolvimento do Selah

## Situação atual

Aplicativo React + TypeScript + Vite, navegação por hash e estado em memória. Formulários não criam contas nem autenticam; o painel é público e demonstrativo. A edição do acervo e a conclusão de leituras desaparecem ao recarregar. A edição do dia e os indicadores são fictícios e fixos.

Existe um módulo de cliente Supabase em `src/lib/supabase.ts`, além de SQL em `supabase/`, mas os componentes atuais não importam esse cliente. A presença desses arquivos não confirma infraestrutura provisionada nem banco seguro para uso. Não executar SQL ou migrações durante validações do frontend.

## Três ambientes

| Ambiente | Finalidade | Dados e serviços | Configuração |
| --- | --- | --- | --- |
| Desenvolvimento local | Implementar e testar na máquina | Acervo fictício; testes sem rede. Futuro backend local isolado, se necessário | `.env.development.local`, apenas credenciais de desenvolvimento |
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
