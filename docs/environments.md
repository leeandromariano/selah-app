# Ambientes do Selah — Etapa 21.2

Referência: `59e2082`, branch `feat/local-auth`. Nenhum projeto remoto foi criado,
consultado ou vinculado. Esta arquitetura prepara contratos futuros; **STAGING e
PROD continuam desabilitados em código**, sem flag de ambiente capaz de habilitá-los.

| Ambiente | Vite mode | Configuração selecionada | Estado |
| --- | --- | --- | --- |
| DEV | `development` | `VITE_DEV_SUPABASE_URL` e `VITE_DEV_SUPABASE_PUBLISHABLE_KEY` | Somente `http://127.0.0.1:54321` |
| STAGING | `staging` | `VITE_STAGING_SUPABASE_URL`, `VITE_STAGING_SUPABASE_PROJECT_REF`, `VITE_STAGING_SUPABASE_PUBLISHABLE_KEY` | Contrato futuro; build e cliente recusados |
| PROD | `production` | `VITE_PROD_SUPABASE_URL`, `VITE_PROD_SUPABASE_PROJECT_REF`, `VITE_PROD_SUPABASE_PUBLISHABLE_KEY` | Contrato futuro; build e cliente recusados |

`VITE_APP_ENV`, quando definido, deve corresponder exatamente a DEV/STAGING/PROD
selecionado pelo mode. Modo desconhecido, divergência, URL/chave DEV ausente ou
insegura impedem inicialização; não há fallback entre ambientes. Para DEV a URL
deve ser exatamente a indicada, sem barra final, localhost, caminho, query ou credenciais.

## Arquivos e precedência

Usar `.env.development.local`, `.env.staging.local` e `.env.production.local`,
todos ignorados pelo Git. Copiar somente o bloco do ambiente pretendido de
`.env.example`; não copiar o arquivo inteiro para configurações futuras. Não há
necessidade de preencher STAGING/PROD nesta etapa. Nenhum arquivo local existente
foi lido para inspeção geral, alterado ou sobrescrito; o Vite os carrega normalmente
para compilar a aplicação, sem imprimir seus valores.

Vite carrega `.env`, `.env.local`, `.env.[mode]` e `.env.[mode].local`.
Os arquivos específicos do modo prevalecem sobre os genéricos, e variáveis já
definidas no processo prevalecem sobre os arquivos. Variáveis nos arquivos podem
ser expandidas pelo Vite. O nome do arquivo não prova a origem/destino de um recurso.
Não manter configurações compartilhadas ou privilegiadas em arquivos genéricos.
Nesta arquitetura o modo do comando, não NODE_ENV, escolhe o ambiente.

Compatibilidade DEV: o script protegido `configure-local-auth.mjs` continua
gravando `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` somente no arquivo
local ignorado, com chave pública. Esses dois nomes legados são aceitos apenas em
DEV. Se os nomes DEV e legados coexistirem, devem ter valores idênticos; conflito
é recusado. Em STAGING/PROD qualquer valor genérico é recusado antes do bloqueio
de habilitação. Assim `.env.local` legado não pode configurar silenciosamente outro modo.
Para adotar os nomes novos, o responsável pode editar privadamente seu arquivo DEV;
não é preciso fazê-lo para continuar usando o ambiente atual.

## Builds e execução

| Comando | Resultado esperado |
| --- | --- |
| `npm.cmd run dev` | Vite `development`, host 127.0.0.1, porta 5173 fixa |
| `npm.cmd run build` | Build otimizado para DEV, com `vite build --mode development` explícito |
| `npm.cmd run build:staging` | Recusa de configuração/conexão futura; código de saída não zero esperado |
| `npm.cmd run build:prod` | Recusa de configuração/conexão futura; código de saída não zero esperado |
| `npm.cmd run preview` | Serve o artefato já existente, host 127.0.0.1, porta 4173; não recompila nem seleciona outro ambiente |

`vite build` sem `--mode` usa `production` e é bloqueado. `--mode development`
não desativa a otimização de build: MODE e NODE_ENV têm papéis diferentes.
`import.meta.env.PROD/DEV` não são identificadores DEV/STAGING/PROD do Selah.
Não publicar o conteúdo de `dist`: ele continua sendo um artefato DEV. Um build
recusado não apaga um `dist` anterior; sua presença não significa build aprovado.
O preview serve o último artefato, não os novos valores do shell/arquivos.

Vite valida o contrato ao iniciar e injeta apenas os três valores públicos DEV
selecionados em `__SELAH_ENVIRONMENT__`. `envPrefix: []` desativa a exposição
automática das demais variáveis em `import.meta.env`. Não se injeta o objeto env
inteiro nem configurações de outro projeto no bundle. Não usar `process.env`/define
adicionais para contornar essa lista. `VITE_*` continua sendo público: nunca colocar
senhas, service_role, secret, access token de sessão ou credencial administrativa.
Nomes privilegiados conhecidos são recusados, mas isso não é um scanner universal
nem torna seguro um segredo arbitrário guardado sob outro nome.

O cliente revalida o contrato antes de `createClient`. Além do destino DEV fixo,
só inicia em origem HTTP 127.0.0.1/localhost nas portas 5173/4173. Artefato DEV
servido por origem remota é recusado. Não há mudança nas opções de sessão/flow
nem na chave de storage padrão do SDK; origem/porta diferentes continuam tendo
storages distintos. Não houve implementação de nova política de sessão nesta etapa.

## Contratos remotos futuros e limites

Quando preenchido, cada contrato remoto exige URL HTTPS raiz exatamente no
formato `https://<referência>.supabase.co`, referência de 20 letras minúsculas/dígitos
e chave pública publishable ou JWT anon. JWT anon deve declarar a mesma referência.
URL/ref/chave reutilizadas entre STAGING e PROD são recusadas quando ambas estão
presentes na configuração. Domínios personalizados não são suportados neste contrato.
Mesmo um contrato inteiramente válido é recusado por `requireEnabledEnvironment`;
não é criada conexão nem artefato remoto.

Formato/role de chave e comparação de referências não verificam assinatura,
autenticidade de publishable key, titularidade, permissões ou existência do projeto.
Também não provam separação quando só um contrato é fornecido. Antes de habilitar,
exigir projeto STAGING novo e exclusivo, independente do hospedado existente;
PROD distinto, aprovação explícita, revisão de código, inventário de recursos e
validação de associação das chaves pelo operador. Nenhuma URL real de projeto
remoto foi adicionada ao repositório; testes usam apenas valores fictícios, sem rede.

As verificações de frontend/configuração evitam erros acidentais, não constituem
fronteira de autorização contra alguém que altere o JavaScript. RLS, grants,
membership administrativa privada e funções do banco continuam sendo as barreiras
reais. Infraestrutura ainda deve garantir HTTPS, DNS/host confiáveis, CORS adequado,
CSP/headers, redirects exatos, SMTP, MFA, proteção de segredos, backups, observabilidade
e recursos separados. Um processo/OS hostil ou túnel local não é certificado por
essa proteção. Não há aprovação de implantação, nem produção pronta.

Os scripts em `scripts/` continuam com os guardas da Etapa 21.1, sem alteração e
sem modo remoto. Não exportar contratos de STAGING/PROD para reutilizar esses
scripts; não adaptar Docker, psql ou integrações locais para projetos hospedados.
`supabase/config.toml` permanece local, inclusive callbacks da porta 5173.

## Roteiro manual local

1. Confirmar branch e ausência de alterações inesperadas com `git status`.
2. Executar `node scripts/local-auth-smoke.mjs --check-local`. Esse modo só consulta
   metadados/portas; não cria conta, executa SQL ou comprova fluxos HTTP.
3. Com configuração DEV já existente, executar `npm.cmd run dev` e abrir
   `http://127.0.0.1:5173`. Se a porta estiver ocupada, o servidor deve falhar,
   sem mudar silenciosamente para outra porta.
4. No Network do navegador, confirmar chamadas Supabase somente a
   `http://127.0.0.1:54321`; não copiar tokens, headers de sessão ou senhas para relatórios.
5. Usar somente conta fictícia local existente: login, recarga, Meu perfil, acervo,
   histórico e logout. Conta comum não deve obter operações administrativas.
   Isso é roteiro para o responsável, não execução nova declarada pelo agente.
6. Parar o servidor, executar build e servir o artefato pelo mesmo origin de Auth:
   `npm.cmd run preview -- --port 5173`. Abrir 127.0.0.1:5173 e repetir os fluxos.
   Preview padrão 4173 permite iniciar o cliente, mas os callbacks atuais de
   confirmação/recuperação só autorizam 5173; não presumir fluxo de e-mail em 4173.
7. Executar `npm.cmd run build:staging` e `npm.cmd run build:prod`: ambos devem
   falhar sem conexão. Não preencher URLs reais para testar essas recusas.
8. Para simular configurações inválidas sem tocar em credenciais, usar a suíte
   `npm.cmd run test:run`; ela cobre conflitos, chaves e origens com fixtures fictícias.

Evidências executadas e bloqueadores atuais: seção 13 de `pre-deploy-audit.md` e
inventário `testing.md`. SQL e HTTP históricos permanecem identificados como tal.

## Conclusão da Etapa 21.2 — validação manual informada pelo responsável

Na preparação do commit estável, branch `feat/local-auth`, referência `59e2082`,
o responsável informou **sete testes manuais aprovados** no ambiente local:

1. O Selah abriu normalmente.
2. O login funcionou.
3. Meu perfil carregou e salvou dados.
4. O preflight `--check-local` foi aprovado.
5. O acervo e o histórico funcionaram.
6. O logout funcionou.
7. As requisições Supabase observadas no Network apontaram somente para `127.0.0.1:54321`.

Esses resultados foram executados e relatados pelo responsável, não são novas
execuções automatizadas do agente. O preflight verifica metadados/portas locais;
a observação do Network se limita às interações realizadas. Nenhum deles certifica
infraestrutura de homologação/produção, que não foi criada, acessada ou validada.
STAGING e PROD continuam bloqueados em código. Os testes automatizados e as
recusas de build repetidos na preparação estão registrados em `testing.md`.
As 59 verificações SQL/RLS e 19/29/35/41 HTTP são evidências anteriores da Etapa
21.1, sem nova execução nesta preparação.

Nesta preparação foram repetidos: `npm.cmd run test:run` (149 testes aprovados
em 15 arquivos), `npm.cmd run build` e `npm.cmd run lint` (código zero, lint sem
avisos). `npm.cmd run build:staging` e `npm.cmd run build:prod` recusaram execução
com código 1 por configuração genérica herdada de DEV. Essas recusas são esperadas
e não significam builds remotos aprovados. Nenhuma infraestrutura foi provisionada.
