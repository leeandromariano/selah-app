> Prompt 57 / Etapa 22.3.5: distintivos derivados do recorde servidor e desafios
> semanais privados implementados localmente. Regras, instalação incremental,
> retenção e checklist em [achievements-local.md](achievements-local.md).
> Etapas 22.3.1–22.3.4 versionadas; nenhuma publicação ou entrega push externa.

> Registro histórico — Prompt 52 / Etapa 22.3.4: reflexões, reações privadas e moderação OWNER
> implementadas localmente. Migração incremental, RLS/projeções, política e
> retenção em [discussion-local.md](discussion-local.md). Web Push externo
> permanece desativado; 22.3.5 não foi iniciada.

> Etapa 22.3.3: lembretes inteligentes locais, novas RPCs próprias e agendador
> Node independente da aba. Simulação por padrão; nenhuma entrega externa validada.
> Operação, migração incremental, privacidade e limites em
> [smart-reminders-local.md](smart-reminders-local.md). Etapa 22.3.4 era futura naquele registro; implementação atual descrita acima.

> Etapa 22.3.2 / Prompt 48: Claro/Escuro/Sistema implementados, com preferência
> local independente da sessão, bootstrap pré-React e tokens CSS semânticos.
> Estratégia, suporte e checklist: [appearance-local.md](appearance-local.md).
> SQL/RLS não repetidos nesta mudança visual; nenhuma alteração de negócio ou banco.

> Etapa 22.3.1 / Prompt 44: Minha Jornada (`#minha-jornada`) reutiliza a RPC
> pessoal e o calendário da 22.2, com histórico mensal somente leitura. Diagnóstico,
> roadmap oficial das cinco subetapas e checklist: [journey-roadmap.md](journey-roadmap.md).
> Prompt 48: 22.3.1 versionada; 22.3.2 implementado, 11/11 manuais informados,
> aguardando commit; 22.3.3 Push era a próxima naquele momento; implementação local descrita acima. 22.3.4 Comentários/Reações
> e 22.3.5 Conquistas/Desafios permanecem planejados. Nenhuma publicação autorizada.

> Prompt 41: auditoria agregada somente de leitura, origem das fixtures e limites
> do painel em [owner-community-review.md](owner-community-review.md). Sem limpeza.

> Prompt 40: provisionamento OWNER local por UUID exato e confirmação humana,
> com auditoria transacional privada. Ver [procedimento](owner-local-provisioning.md).

> Etapa 22.2: consistência pessoal e ranking administrativo exclusivo do OWNER.
> Modelo, transparência, limites e roteiro: [consistency-local.md](consistency-local.md).
> Editorial não herda OWNER; promoção da conta efetiva exige auditoria no servidor.

# Processo de desenvolvimento do Selah

O painel `#owner` oferece comunidade e ofensivas e moderação em rotas próprias.
O item de navegação depende da confirmação da RPC `get_my_discussion_access`
para a sessão atual; falhas negam acesso. OWNER e ADMIN editorial legado são
independentes. A mudança de frontend não instala migrações nem publica versões.

> Etapa 23.5.1: STAGING pode gerar build local mediante sinal explícito e
> contrato HTTPS completo; PROD continua bloqueado. Não executar deploy por
> consequência do build. Ver [staging-deployment.md](staging-deployment.md);
> trechos históricos abaixo que descrevem STAGING bloqueado foram superados.

> Etapa 23.4: validação tipada do contrato hospedado e caminho de login por
> e-mail preparados e testáveis localmente; cliente/build STAGING e PROD seguem
> bloqueados. Limites e etapas pendentes em [hosted-environments.md](hosted-environments.md).

> Etapa 23.3: o leitor bíblico local usa conteúdo fictício parcial e catálogo
> de 66 livros. NVI e integrações externas permanecem inativas, sujeitas a
> autorização e licença; ver [bible-reader-local.md](bible-reader-local.md).
> O MVP mantém cadastro aberto com confirmação de e-mail.

> Etapa 21.5: login aceita username (com ou sem @) ou e-mail pela Edge Function
> exclusivamente local. Servir com `node scripts/serve-local-login.mjs`;
> sessão permanece no SDK oficial. Ver [operação e limites](username-login-local.md).
> Menções a login por username futuro abaixo descrevem o estado das etapas antigas.

## Situação atual

Aplicativo React + TypeScript + Vite, navegação por hash. Cadastro, confirmação de e-mail, login, logout e recuperação de senha usam Supabase Auth exclusivamente local. Perfis, publicações e histórico de aberturas persistem no PostgreSQL local. Na Etapa 19, o painel administrativo cria, edita, agenda e publica no acervo local usando a sessão do administrador; privilégios vêm de membership privada provisionada por operador local confiável, nunca do frontend. Cards mostram somente contagens de conteúdo por status, sem métricas de leitores. Na Etapa 22.1 há conclusão voluntária após 60 segundos confirmados pelo servidor, em registros separados das aberturas. Ver reading-local.md para RPCs, migrações locais, testes e limites. Ofensivas pessoais e comunidade do OWNER estão implementadas localmente na Etapa 22.2. O devocional do dia usa America/Sao_Paulo. Ver `admin-local.md` e `devotionals-local.md`.

O cliente em `src/lib/supabase.ts` é usado pela autenticação e exige DEV em 127.0.0.1:54321. STAGING/PROD têm contratos separados, ainda desabilitados em código. Ver `environments.md`. A suíte React simula esse módulo na fronteira, sem importar o cliente real. A suíte SQL local teve 59 verificações aprovadas; não executar SQL ou migrações durante validações do frontend. Ver `auth-local.md` para os fluxos HTTP locais e suas limitações.

## Três ambientes

Etapa 21.4: cadastro novo exige também WhatsApp em E.164, validado no servidor.
Nome/Instagram opcionais; contas legadas podem completar o número depois, sem
bloqueio de sessão/recuperação. Autorização opcional de feedback é separada e
revogável, sem diretório administrativo ou envio de mensagens. Migrações locais
`20261026000400` e `20261026000500`; não reescrever as anteriores. Regras, riscos,
testes e roteiro em `whatsapp-local.md`. Login segue e-mail/senha.

Na Etapa 21.3 ajustada, cadastro solicita username obrigatório/e-mail/senha/confirmação.
Nome pessoal, WhatsApp e Instagram são opcionais em Meu perfil; faixa etária legada
fica disponível para correção/limpeza, sem apagar
metadados Auth existentes. Meu perfil permite registrar pedido confirmado de
exclusão, sem excluir/suspender conta automaticamente. Requer migração incremental
local `20261026000100`; nenhuma migração remota autorizada. Inventário, decisões
pendentes, aplicação local protegida e roteiro em `privacy-essential.md`.
O ajuste de username requer também `20261026000200`, com trigger transacional do
Auth e índice único, sem backfill destrutivo, e `20261026000300` para vínculo
explícito da sessão na reserva. Ver `usernames-local.md`; login por
username não é implementado nesta entrega.

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

Vite carrega `.env` e `.env.local` também em outros modos; variáveis do processo prevalecem. Evitar configurações compartilhadas nesses arquivos; usar namespaces e arquivos específicos por modo. Na Etapa 21.2, `npm run build` escolhe explicitamente `development`, mantendo otimização de build; `build:staging` e `build:prod` são recusados até futura revisão autorizada de código. Só a configuração DEV selecionada é injetada no bundle; não há exposição automática das demais variáveis. **Build local não publica nada** e seu artefato continua DEV. Nunca usar `service_role`, senha do banco ou tokens administrativos no frontend. `.env.example` deve conter somente placeholders. Detalhes, limites e roteiro manual em `environments.md`.

## Ciclo de uma mudança

Na Etapa 21.1, scripts de integração/configuração/provisionamento compartilham
guardas de Docker e URLs locais. Antes de qualquer integração opt-in, executar
`node scripts/local-auth-smoke.mjs --check-local` (ou o mesmo modo no executável
pretendido). Uma recusa exige corrigir o ambiente/contexto, sem retirar a proteção.
Para a suíte SQL local usar `node scripts/run-local-authorization.mjs`, que fixa o
contêiner/socket e preserva o BEGIN/ROLLBACK do arquivo. Não passar conexões
arbitrárias ao psql. Esses comandos não integram os testes automáticos de frontend
e nunca devem ser apontados a homologação/produção. Ver `testing.md` e a seção 12
de `pre-deploy-audit.md` para evidências e limites.

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

Com os testes protegidos de provisionamento OWNER (Prompt 40), Vitest limita a
dois workers. Os subprocessos que exercitam recusas de ambiente não acessam
serviços, mas disputam CPU/memória com testes de formulário. O limite mantém os
timeouts existentes e não remove cobertura. Não aumentar timeouts para mascarar
falhas; investigar e repetir a suíte completa após corrigir a causa.

Não instalar Playwright nem navegadores nesta etapa. Quando a suíte local estiver estável, começar com um único projeto Chromium, servidor Vite local e acervo fictício, sem backend remoto. Cobrir navegação, busca/filtro, leitura, validação dos formulários e administração demonstrativa. Usar seletores por papel/nome acessível. Adicionar outros navegadores e CI apenas quando houver necessidade concreta.

Autenticação, autorização e persistência reais precisarão de cenários novos quando forem implementadas. Nesse momento, usar backend local ou homologação isolada e fixtures sintéticas; nunca validar permissões contra produção.

A Jornada retoma a ultima abertura e a posicao aproximada neste navegador.

Build Preview STAGING exige SELAH_STAGING_PREVIEW_BUILD=LOCAL_STAGING_PREVIEW_BUILD e VITE_STAGING_PREVIEW_ORIGIN com origem HTTPS exata; configurar somente no contexto Preview. O build principal permanece restrito a VITE_STAGING_SITE_ORIGIN. A URL muda por deployment e exige nova autorizacao.

O acervo permite escolher a ordem das publicacoes anteriores e buscar por titulo ou referencia, sem novos dados de servidor.
