# Etapa 22.3.2 — Aparência: Claro, Escuro e Sistema

Prompt 47, base `195a9b5`, branch `feat/local-auth`; árvore limpa confirmada no
início. Somente ambiente local; sem staging, commit, migração ou publicação.

## Prompt 48 — validação manual informada: 11/11 aprovados

Branch `feat/local-auth`, HEAD `195a9b5`, Modo Noturno implementado e aguardando
commit. O responsável informou exatamente as onze aprovações abaixo:

1. Claro, Escuro e Sistema funcionam antes do login.
2. Todas as telas mudam corretamente entre Claro e Escuro.
3. Modo Sistema acompanha a aparência configurada no Windows.
4. Uma escolha explícita prevalece sobre o tema do Windows.
5. F5 mantém a preferência e não provoca flash perceptível.
6. Login, logout e Alt+Tab não alteram o tema selecionado.
7. Formulários, tabelas, mensagens de erro e carregamento estão legíveis.
8. Foco por teclado, botões e estados desabilitados permanecem visíveis.
9. Redução de movimento é respeitada quando ativada no dispositivo.
10. A interface funciona em uma janela pequena ou celular.
11. Minha Jornada preserva a navegação e o mês escolhido.

São aprovações humanas comunicadas pelo responsável, não testes manuais refeitos
pelo agente. Não implicam Firefox/Safari, aparelho físico específico, leitor de
tela ou auditoria integral de acessibilidade. O item 10 não identifica aparelho
utilizado; não inferimos teste físico a partir dele. Os demais itens amplos do
checklist anterior não foram automaticamente aprovados.

## Diagnóstico e arquitetura

Estilos ativos estavam em `index.css` (reset/campos/foco) e `App.css` (telas/media
queries), com muitas cores fixas, branco, gradientes e sombras. Componentes usam
classes; SVGs de interface herdam currentColor e ilustrações são CSS. Assets de
exemplo React/Vite não usados e favicon não são superfícies temáticas.

`main.tsx` monta React/StrictMode; troca de conta remonta AppContent. O estado de
aparência não pertence à sessão nem à página. O seletor nativo Aparência fica na
navegação compartilhada, antes da citação lateral; no celular ocupa linha própria
após os links. Disponível sem sessão, para leitor e administradores, sem botão
extra competindo com as três opções. Fontes, dimensões e espaçamentos mantidos.

`public/appearance.js` é script clássico externo síncrono no head, antes do React.
Resolve preferência e aplica data-theme light/dark e style.colorScheme na raiz.
O link para `src/appearance/tokens.css` também fica no head: paleta bloqueia a
primeira pintura até estar carregada. Vite agrega a folha no CSS gerado e copia
o bootstrap para dist/appearance.js, preservando sua posição no head. Sem script
inline ou alteração de CSP. O bootstrap é também o store window.selahAppearance;
AppearanceControl usa useSyncExternalStore, sem duplicar resolução em React.
Snapshot estável, notificações somente em mudança; script idempotente, cleanup
para testes isolados. Tema não altera keys de páginas, sessão ou formulários.

Persistência: apenas **selah.appearance.v1**, enum literal light/dark/system.
Sem JSON livre, HTML, usuário, credencial, analytics, SQL ou chamada de rede.
Preferência é do navegador/dispositivo; login/logout/troca de conta não a apagam
nem sincronizam com perfil. Remontagem da página mantém o store global.

- Valor ausente/inválido/erro ao ler: Sistema. Sem matchMedia: fallback Claro.
- Sistema acompanha prefers-color-scheme em tempo real, com listener moderno ou
  legado. A resolução não é salva como preferência explícita.
- Claro/Escuro explícitos vencem o sistema e persistem após refresh.
- Erro ao gravar mantém escolha na aba e informa que não foi possível salvá-la.
  Após reload vale o que puder ser lido ou Sistema. Inicialização não grava.
- Storage sincroniza outras abas; remoção/limpeza volta a Sistema. Outras chaves
  e sessionStorage são ignorados. Não há dado pessoal nessa preferência.

## Estratégia de tokens e cobertura

`src/appearance/tokens.css` centraliza todas as cores ativas de UI. :root define
Claro; :root[data-theme="dark"] define Escuro. CSS anterior consome variáveis,
sem inversão/filtro da tela ou segunda interface sobreposta.

| Grupo | Tokens | Uso |
| --- | --- | --- |
| Superfícies | page, surface, surface-soft, surface-hover | Página, painéis, cartões, hover |
| Texto/destaque | text, text-muted, accent, accent-bg, accent-border | Conteúdo, legendas, menu, calendário |
| Ações | action-bg, action-hover, on-action | Botões, marca e seleções preenchidas |
| Controles | border, control-border, focus, focus-halo, selection | Separadores, campos, foco e seleção |
| Mensagens | error, success, success-bg | Erros, negações e sucesso |
| Arte | hero-*, on-hero, art-*, shadow | Banner, gradientes, ilustrações e sombras |

O roxo antigo servia a texto e preenchimento; separar papéis evita branco sobre
lavanda clara no modo escuro. Textos secundários claros foram escurecidos em Claro
para legibilidade; Escuro usa lavandas claras. Bordas de controles são distintas
de separadores decorativos. As duas folhas ativas não contêm mais cores literais.

Cobertura: login/cadastro/recuperação, perfil/username/WhatsApp/privacidade,
Início/hero, biblioteca/cartões, devocional/citação/reflexão/progresso, Minhas
aberturas, Minha Jornada/calendário/histórico, editor e Comunidade/Ofensivas.
Componentes compartilhados cobrem tabelas, avisos, erros, loading e vazios.
Nenhuma regra de negócio, permissão, contrato ou dado dessas telas foi alterado.

## Acessibilidade e correção de regressão

Combobox nativo tem label e opção selecionada acessíveis. Foco visível de três
pixels; placeholder, campos e erros tematizados; color-scheme orienta controles
nativos. Calendário mantém texto/marcadores/aria-current além da cor. Hover,
active e disabled continuam distintos; desabilitados não sobem no hover.
prefers-reduced-motion remove transições/animações e movimento de hover de
botões/cartões. Não acrescentamos animação de tema.

Chromium detectou contraste transitório de 2,37:1 no botão do hero: fundo animava
por 150ms enquanto texto trocava imediatamente. Removemos transição de background,
mantendo transform no hover normal. Contraste imediatamente após troca e verificação
de hover sem transição de paleta passaram depois da correção.

Critérios testados: pares de texto >=4,5:1; borda funcional/foco >=3:1. O navegador
considera fundos compostos e texto grande >=3:1; exclui desabilitados/decorativos.
Referências: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) e
[contraste MDN](https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Understanding_WCAG/Perceivable/Color_contrast).
Não é certificação completa ou validação por leitor de tela.

## Testes, riscos e limites de suporte

Comandos/números finais em `testing.md`. React simula Supabase e executa bootstrap
real. Chromium --appearance usa backend fictício e bloqueia destinos fora do
frontend loopback; checa primeira paleta com módulo React retido, três modos,
sistema ao vivo, refresh, login/logout simulados, teclado, telas/contraste,
390px, erros, hover/disabled e storage negado. Disabled é atributo sintético,
não operação real pendente. Modo sem argumento mantém regressões 22.2/22.3.1.
Capturas inspecionadas são fictícias e ficam no cache ignorado.

SQL/RLS e HTTP backend **não repetidos**: sem alteração em Auth, leitura, RPC,
Supabase ou schema, não há razão técnica para usar serviços nesta mudança visual.
A suíte anterior é repetida integralmente; não validamos conclusão real de 60s,
sessão pessoal ou OWNER por HTTP. Não criamos usuários nem modificamos dados.

Navegadores modernos compatíveis com React/Vite/CSS custom properties; fallback
para listener legado ou ausência de mídia. Storage bloqueado, privado, limpo ou
particionado por origem pode impedir persistência; fallback é intencional.
Uso em file:// não suportado: testar no frontend loopback. Selects/progress nativos
variam por OS. Nenhum pacote, navegador ou serviço remoto foi instalado.

Bootstrap e CSS são recursos críticos e precisam carregar; bloqueio de rede/CSP
não é um modo offline completo. Sem JS, paleta base é clara e React não funciona.
Eventual publicação deve servir versões compatíveis de bootstrap/CSS e revisar
cache/CSP sem relaxá-la. Não há service worker nem cache autenticado.

Contraste automatizado não cobre todas as fontes, zoom, forced colors, extensões,
OS ou estados de dados. Ajustes de alto contraste do sistema não são desativados.
Firefox/Safari e dispositivos reais continuam pendentes de revisão humana.
Bundle segue acima de 500kB. STAGING/PROD continuam bloqueados. Push, comentários
e conquistas não foram iniciados. Retenção e privacidade anteriores permanecem.

## Checklist complementar — não aprovado integralmente

Registro original do Prompt 47. As onze aprovações específicas do Prompt 48 estão
acima; os itens combinados abaixo permanecem roteiro de cobertura adicional.

- [ ] Sem login, selecionar Claro/Escuro/Sistema por teclado; conferir label,
  opção selecionada e foco no desktop e celular.
- [ ] Revisar todas as telas acima, tabelas comunitárias preenchidas, editor,
  controles nativos, hover/active/disabled/loading e mensagens em ambos os temas.
- [ ] Sistema acompanha mudança do dispositivo; modo explícito não é sobrescrito.
- [ ] F5/acesso direto sem flash; login/logout/troca de conta preservam somente
  aparência do dispositivo, sem mostrar dados da conta anterior.
- [ ] Jornada: mês anterior + troca de tema + Alt+Tab preservam rota/mês; F5
  conserva rota e volta ao mês atual, conforme o contrato anterior.
- [ ] Edição/leitura: trocar tema não perde formulário, foco, tempo confirmado
  ou permissões. Usar somente dados fictícios; não editar dados preexistentes.
- [ ] Storage bloqueado/corrompido/limpo e outra aba funcionam com fallback/aviso.
- [ ] Redução de movimento, alto contraste, zoom, leitor de tela e navegação
  por teclado; repetir em Firefox/Safari e aparelhos reais.

Nenhum cenário manual de aparência foi declarado aprovado no Prompt 47.
Essa pendência histórica foi encerrada somente para os onze cenários informados
no Prompt 48, sem ampliar sua cobertura.

## Arquivos desta entrega

17 candidatos: nove modificados e oito novos. Modificados: `index.html`,
`src/App.tsx`, `src/App.css`, `src/index.css`, `src/test/setup.ts`,
`scripts/local-navigation-browser.mjs`, `docs/journey-roadmap.md`, `docs/testing.md`
e `docs/development-workflow.md`. Novos: este documento, `public/appearance.js`,
`src/appearance/store.ts`, `src/appearance/tokens.css`,
`src/appearance/bootstrap.test.ts`, `src/appearance/contrast.test.ts`,
`src/components/AppearanceControl.tsx` e `src/components/AppearanceControl.test.tsx`.

Auditoria final: 12 migrações da base preservadas (comparação ao Git normalizando
apenas CRLF/LF), nenhum diff em Auth/leitura/RPC/schema/configuração de ambientes,
nenhum token CSS referenciado sem definição, nenhum literal de cor nas duas folhas
antigas. Nenhum `.env`, chave, token completo, dado pessoal real, log ou cache
identificado entre candidatos; arquivos de credenciais não foram abertos.
Varredura por padrões não prova ausência universal de segredos. Sem git add/commit.

## Auditoria definitiva — Prompt 48

Mesmos 17 candidatos do Prompt 47, nove modificados e oito novos, sem arquivo
extra fora do escopo. Não há snapshot de hashes de toda a árvore do fim do
Prompt 47 para afirmar identidade byte a byte com aquela rodada; a lista e o diff
atual foram conferidos integralmente. Nenhuma correção de código foi necessária
nesta auditoria. Todas as alterações feitas agora são documentais.

Bootstrap e HTML: script externo local síncrono antes do React, CSS de tokens no
head, enum validado na leitura/escrita/evento storage; só light/dark/system são
aceitos. Valor arbitrário, inclusive string com markup, não vira HTML, script,
URL nem conteúdo executável. Produção não usa eval/Function/innerHTML/document.write
nesse bootstrap. Sem rede, credencial, sessão ou permissão nova. Store separado
de Auth mantém preferência sem usar remount de páginas para aplicar aparência.

Armazenamento: Sistema para ausência/inválido/falha de leitura; modo explícito
prevalece; falha de gravação mantém escolha na aba e aviso acessível. Mudança do
sistema afeta somente Sistema; persistência contém apenas enum, nunca resolução
temporária, usuário ou dados privados. Os testes reais do bootstrap foram repetidos
na suíte completa. Tokens, foco, contraste e redução de movimento foram revisados.

As 12 migrações da base seguem preservadas, comparadas com normalização apenas
CRLF/LF. Não há diff em Auth/leitura/RPC/métricas/schema/permissões/ambientes.
Nada altera conclusão válida de 60s ou autoriza acesso ao OWNER. Por isso SQL/RLS
e HTTP backend não foram repetidos; nenhum dado existente foi usado como fixture
nova, modificado ou removido. Não há dependência hospedada para aparência.

| Candidato | Estado | Revisão individual |
| --- | --- | --- |
| `docs/appearance-local.md` | Novo | Arquitetura, onze aprovações exatas, limites e staging explícito |
| `docs/development-workflow.md` | Modificado | Aparência aguardando commit e próxima subetapa, sem iniciar push |
| `docs/journey-roadmap.md` | Modificado | 22.3.1 versionada, 22.3.2 implementada, 22.3.3 próxima, demais planejadas |
| `docs/testing.md` | Modificado | Execuções atuais separadas das anteriores e validação humana restrita |
| `index.html` | Modificado | Ordem de bootstrap/CSS/módulo React, sem script inline |
| `public/appearance.js` | Novo | Enum, precedência, mídia ao vivo, storage protegido e snapshot estável |
| `scripts/local-navigation-browser.mjs` | Modificado | Perfil novo/fictício; loopback, sem banco; 88 aparência e 18 regressões |
| `src/App.css` | Modificado | Tokens em telas/estados, foco e reduced motion; sem regras de negócio |
| `src/App.tsx` | Modificado | Apenas import/inserção do seletor compartilhado; rotas/guardas preservadas |
| `src/appearance/bootstrap.test.ts` | Novo | Bootstrap real em VM; armazenamento, mídia, entradas inválidas e listeners |
| `src/appearance/contrast.test.ts` | Novo | Contraste da paleta real, sem alegar auditoria completa |
| `src/appearance/store.ts` | Novo | Tipos do contrato do bootstrap; sem cliente, credencial ou lógica de Auth |
| `src/appearance/tokens.css` | Novo | Paletas semânticas light/dark, color-scheme e superfícies |
| `src/components/AppearanceControl.test.tsx` | Novo | Controle acessível, preferência/sessão/mês e falha de persistência |
| `src/components/AppearanceControl.tsx` | Novo | Combobox rotulado, opção selecionada nativa, aviso acessível; sem backend |
| `src/index.css` | Modificado | Reset/campos/foco usam tokens, mantendo tipografia e geometria |
| `src/test/setup.ts` | Modificado | Bootstrap local confiável no jsdom; Supabase continua simulado |

Varredura integral dos candidatos não identificou .env, token completo, segredo,
cookie, credencial real, dado pessoal real, log, cache ou artefato temporário.
Arquivos de credenciais não foram lidos. `.env.*.local`, `node_modules/.cache` e
`dist` ignorados; nenhum deles consta dos comandos abaixo. Assinaturas não provam
ausência universal de segredos; revisão contextual complementa a varredura.
Nenhum token CSS referenciado ficou sem definição.

Repetidos no Prompt 48: 418 testes em 39 arquivos, build DEV, lint, 88 Chromium
de aparência e 18 regressões, diff check e recusa dos builds STAGING/PROD. Números
e limitações em `testing.md`, sem somar casos às execuções anteriores. Bundle JS
516,31 kB (gzip 146,81 kB), controles nativos variáveis e contraste automatizado
restrito seguem riscos conhecidos. Não houve teste pelo agente em Firefox/Safari
ou aparelho físico. As onze aprovações humanas acima não estendem essa cobertura.

Sem bloqueador técnico identificado para commit local. A aprovação não autoriza
publicação, desbloqueio de STAGING/PROD ou início de Notificações Push.

### Comandos exatos de staging — Windows CMD — Prompt 48

Executar apenas se o responsável decidir preparar o staging. Cada argumento é
um arquivo explícito. Não adicionar espaços após o caractere de continuação `^`.
Nenhum desses comandos foi executado pelo agente.

```cmd
git add -- ^
  "docs\appearance-local.md" ^
  "docs\development-workflow.md" ^
  "docs\journey-roadmap.md" ^
  "docs\testing.md"

git add -- ^
  "index.html" ^
  "public\appearance.js"

git add -- ^
  "src\index.css" ^
  "src\App.css" ^
  "src\appearance\tokens.css"

git add -- ^
  "src\App.tsx" ^
  "src\appearance\store.ts" ^
  "src\components\AppearanceControl.tsx"

git add -- ^
  "src\test\setup.ts" ^
  "src\appearance\bootstrap.test.ts" ^
  "src\appearance\contrast.test.ts" ^
  "src\components\AppearanceControl.test.tsx"

git add -- "scripts\local-navigation-browser.mjs"
```

Após staging decidido pelo responsável: `git diff --cached --stat` e
`git diff --cached --check`. Mensagem recomendada:
`feat(appearance): adiciona temas Claro, Escuro e Sistema`.
Nenhum git add, commit, push ou deploy executado nesta sessão de auditoria.
