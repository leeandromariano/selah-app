# Etapa 16 — autenticação exclusivamente local

Branch: `feat/local-auth`, baseada no estado de referência `2e26222`.
Não houve commit automático, publicação, migração, reset ou acesso remoto.

## Preparação

Com o Supabase local já ativo e a migração aplicada:

```sh
node scripts/configure-local-auth.mjs
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

O primeiro script consulta apenas o status local, mantém as credenciais retornadas
em memória e grava somente URL e chave pública em `.env.development.local`, ignorado
pelo Git. Preserva arquivos existentes sem lê-los ou sobrescrevê-los. Não usar
chave secret/service_role no frontend. `.env.example` possui somente placeholders.
Configuração faltante ou destino diferente de `http://127.0.0.1:54321` ou
`http://localhost:54321` é recusado. A chave pública também deve pertencer à instância
local. Homologação/produção não estão habilitadas nesta etapa. O build padrão verifica
compilação; para servir um artefato local, gerar com `npm.cmd run build -- --mode development`.

## Comportamentos

- Cadastro chama `signUp` e orienta a confirmar e-mail; não autentica antecipadamente.
- Login chama `signInWithPassword`. Senhas são enviadas sem trim. Os erros aparecem
  em português; requisições exibem carregamento e bloqueiam submissões repetidas.
- `getSession` restaura a sessão mantida pelo SDK; `onAuthStateChange` acompanha
  entradas, saídas, renovação e recuperação, com unsubscribe no unmount. Eventos
  mais recentes têm prioridade sobre uma resposta inicial atrasada.
- Logout usa `signOut`; falha mantém a sessão e informa erro. Trocar a identidade
  remonta o conteúdo e descarta o estado demonstrativo do usuário anterior.
- “Esqueci minha senha” usa `resetPasswordForEmail`. O link deve ser aberto no mesmo
  origin usado pelo app. O SDK consome o fragmento do link (fluxo implicit), e
  `PASSWORD_RECOVERY` abre `#nova-senha`; `updateUser` atualiza a senha. Uma sessão
  comum ou navegação direta não libera o formulário de recuperação.
- Não há concessão de administração pelo frontend. A RPC já existente
  `devotional_open_counts` confirma a autorização no servidor, negando leitores.
  Falha de rede/negação bloqueia o painel; metadados do usuário são ignorados.

## Validação HTTP e Mailpit

```sh
node scripts/local-auth-smoke.mjs
```

Executado nesta etapa: **19 verificações HTTP aprovadas**, nenhuma omitida.
Foi usado apenas o Auth de `127.0.0.1:54321` e o Mailpit de `127.0.0.1:54324`.
O script leu somente e-mails destinados à identidade fictícia criada naquela
execução e consumiu os links de confirmação e recuperação, sem imprimir seus tokens.
Foram verificados login bloqueado antes da confirmação, confirmação, senha inválida,
login válido, logout, sessão restaurada em outra instância do SDK, negação HTTP de
métricas administrativas, recuperação, atualização, recusa da senha antiga e login
com a nova senha. Cada execução cria uma conta fictícia, sem senha fixa, retida
somente localmente para inspeção. Não usa banco remoto nem realiza exclusões.

## Validação manual da interface

Em 26/10/2026, o responsável informou nesta sessão a aprovação dos sete testes
abaixo, realizados manualmente na interface com Supabase e Mailpit locais.
São resultados relatados pelo responsável, distintos dos testes automatizados
e das verificações HTTP executadas pelo agente.

| Teste manual | Resultado informado |
| --- | --- |
| Abertura do Selah | Aprovado |
| Cadastro | Aprovado |
| Confirmação de e-mail pelo Mailpit | Aprovado |
| Retorno do link para a aplicação | Aprovado |
| Login | Aprovado |
| Persistência da sessão após recarga | Aprovado |
| Logout | Aprovado |

Recuperação e atualização de senha não integram esses sete testes manuais;
permanecem cobertas pelos testes automatizados e pela execução HTTP já registrada.

## Limitações

Validação final: 22 testes automatizados aprovados em cinco arquivos,
`npm.cmd run build` e `npm.cmd run lint` com código zero, sem avisos.

- O agente não teve navegador disponível no conector durante a implementação.
  A validação posterior da interface foi feita pelo responsável e está registrada
  acima; não houve execução E2E automatizada em navegador pelo agente.
- Na Etapa 16 o cadastro enviava somente e-mail/senha. A Etapa 18.1 acrescenta
  campos pessoais como rascunho em metadados de Auth, sem idade exata nem papéis.
  Após confirmar e entrar, o leitor revisa e salva explicitamente seu perfil
  em PostgreSQL. Ver `profiles-local.md`; isso não altera os resultados históricos acima.
- Na Etapa 18.2 o conteúdo dos leitores e o histórico de aberturas passam a usar
  o PostgreSQL local; não existe conclusão de leitura no schema. O painel e suas
  métricas continuam demonstrativos. O controle visual não substitui RLS.
  Revogação administrativa é imposta no banco a cada RPC; a interface reavalia
  a autorização quando a sessão muda, não por polling da lista privada.
- A recuperação em andamento depende do evento recebido ao abrir o link. Recarregar
  a página de nova senha após consumir o link pode exigir solicitar outro link.
- E-mails são interceptados pelo Mailpit local; SMTP externo não foi testado.
  Confirmação em outro navegador, links expirados/reutilizados, acessibilidade visual
  e recuperação/atualização de senha pela interface ainda precisam de validação manual local.
- As 59 verificações SQL/RLS aprovadas na etapa anterior permanecem inalteradas;
  não foram reexecutadas nesta etapa. Nenhum usuário real foi criado.

Referências: [Auth por senha](https://supabase.com/docs/guides/auth/passwords) e
[eventos de sessão](https://supabase.com/docs/reference/javascript/auth-onauthstatechange).
