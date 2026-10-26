# Etapa 18.1 — perfis persistentes locais

Branch `feat/local-auth`, referência `171bf26`. Sem commit automático,
publicação, operação remota, reset ou mudança de migração/política.

## Schema e autorização conferidos no banco em execução

O contêiner PostgreSQL local está saudável e mapeado na porta 54322 do host;
a API pública local usa 127.0.0.1:54321. A inspeção SQL leu somente metadados
de colunas, constraints, privilégios, trigger e políticas, sem ler dados pessoais.

`public.profiles` possui `id` (UUID, PK/FK para auth.users.id), `name` (obrigatório,
1–150 caracteres após trim), `phone` (E.164 opcional), `age_range` (faixa opcional),
`instagram` (opcional), `created_at` e `updated_at` (datas do servidor).
As faixas são under_18, 18_24, 25_34, 35_44, 45_59 e 60_plus; idade exata não
é persistida. Os testes usam exclusivamente adultos fictícios.

RLS está habilitado. Policies profiles_read_own, profiles_insert_own e
profiles_update_own vinculam id a auth.uid(). authenticated insere id e campos
pessoais; atualiza somente name, phone, age_range e instagram. IDs/timestamps
não podem ser atualizados pela API, e não há coluna de papel administrativo.
O trigger profiles_updated_at chama private.set_updated_at e define updated_at
com now(). Nenhuma alteração de banco foi necessária.

## Fluxo

1. O cadastro preserva os campos e visual existentes. signUp envia um rascunho
   apenas de name, phone, age_range e instagram em user_metadata.profile; converte
   celular brasileiro para E.164 e idade para faixa. Não cria perfil sem sessão.
2. Depois de confirmar o e-mail e entrar, “Meu perfil” abre #perfil. SELECT filtra
   pelo UUID da sessão. Sem sessão, ou durante recuperação de senha, não há acesso.
3. Um registro existente é a fonte dos valores. Só quando não há registro, a tela
   preenche o rascunho permitido e informa que o perfil ainda precisa ser criado.
   Contas antigas sem rascunho podem preencher o formulário normalmente.
4. “Salvar perfil” cria a linha com id da sessão ou atualiza a linha existente.
   Não há upsert que sobrescreva dados após login. Campos opcionais vazios viram
   null; a faixa pode ser omitida. Metadados nunca concedem privilégios.
5. Toda leitura/escrita passa pelo cliente público e JWT do leitor. Payloads
   escritos são reconstruídos com lista explícita de campos permitidos. A RLS
   continua sendo a barreira no servidor, inclusive para requisições forjadas.

Erro de consulta não é confundido com perfil ausente. Carregamento, nova tentativa,
falhas de conexão, negação e conflito de criação em outra aba têm mensagens em
português. Escrita exige retorno de uma linha: zero linhas não anuncia sucesso.
A tela é desmontada ao trocar identidade e ignora respostas de leitura atrasadas.

## Evidências executadas nesta etapa

- `npm.cmd run test:run`: 34 testes aprovados em sete arquivos, incluindo os 22
  cenários anteriores e 12 novos testes de perfil/contrato.
- `npm.cmd run build` e `npm.cmd run lint`: código zero, sem avisos.
- `node scripts/local-profile-smoke.mjs`: **29 verificações HTTP aprovadas**,
  nenhuma falhou ou foi omitida. Duas contas fictícias foram criadas e confirmadas
  pelo Mailpit local; elas permanecem locais, sem exclusão ou senha fixa.

O script usa o mesmo repositório de perfis que a interface. Comprovou criação,
edição, normalização e limpeza de opcionais, trigger de updated_at, preservação
de created_at, leitura por um cliente novo com sessão e persistência após logout
e novo login. Comprovou também invisibilidade do perfil alheio, UPDATE com zero
linhas para outro usuário e preservação dos dados desse usuário; INSERT com
autoria forjada e alteração de IDs/timestamps foram negados. Acesso anônimo foi
negado, faixa inválida rejeitada e metadado admin forjado não concedeu acesso
às métricas. Não imprime chaves, senhas ou tokens; não roda junto de Vitest/build/lint.
Requer Node com suporte nativo a TypeScript (usado Node 24), dependências instaladas
e instância local já ativa. Nunca apontar o script para homologação/produção.

As 59 verificações SQL/RLS e 19 HTTP de Auth são resultados históricos das etapas
anteriores, não reexecutados aqui. Os sete testes manuais de Auth relatados pelo
responsável também continuam históricos; não comprovam a nova tela de perfil.

## Validação manual aprovada pelo responsável

Na conclusão da Etapa 18.1, o responsável informou nesta sessão a aprovação dos
oito testes abaixo no navegador local. São resultados manuais relatados pelo
responsável, distintos dos testes automatizados executados pelo agente.

| Teste manual | Resultado informado |
| --- | --- |
| Acesso à página Meu perfil | Aprovado |
| Carregamento correto dos dados do cadastro | Aprovado |
| Salvamento com confirmação | Aprovado |
| Edição de informações pessoais | Aprovado |
| Persistência após recarregar a página | Aprovado |
| Persistência após logout e novo login | Aprovado |
| Isolamento visual entre contas | Aprovado |
| Salvamento com campos opcionais vazios | Aprovado |

As 29 verificações HTTP de perfis e as 59 verificações SQL/RLS são resultados
anteriores, sem nova execução durante esta preparação do commit em relação a
`171bf26`. O relato manual não inclui teste de conexão offline ou uma auditoria
visual/de acessibilidade completa, nem constitui execução E2E automatizada.

Nesta preparação foram executados novamente `npm.cmd run test:run` (34 testes
aprovados em sete arquivos), `npm.cmd run build` e `npm.cmd run lint` (código zero,
sem avisos). Somente a documentação foi ajustada para concluir o registro.

## Roteiro para repetir a validação local

1. Inicie Vite em 127.0.0.1:5173 usando o ambiente local ignorado pelo Git.
2. Cadastre um adulto fictício, confirme no Mailpit local (porta 54324) e faça login.
3. Abra “Meu perfil”. Confira o rascunho e a indicação de perfil ainda não criado.
   Clique “Salvar perfil” e confira a confirmação de sucesso.
4. Edite nome, celular, faixa e Instagram. Salve e recarregue a página; confira os
   valores. Faça logout, login novamente e confira os mesmos dados.
5. Limpe os campos opcionais, salve e recarregue. Eles devem continuar vazios.
6. Com outra conta fictícia, abra “Meu perfil”: somente seus próprios dados devem
   aparecer. Sem sessão, abrir #perfil deve solicitar login, sem mostrar dados.
7. Simule conexão offline e tente carregar/salvar. Confira a mensagem de erro,
   ausência de falso sucesso e recuperação após restabelecer a conexão.

Persistência e isolamento no PostgreSQL foram comprovados na execução HTTP anterior;
recarga de página e persistência após novo login também foram aprovadas manualmente
pelo responsável conforme o registro acima. Recuperação de perfil removido por operador confiável exige
reabrir a tela; edições simultâneas seguem a última escrita, sem versionamento.
O rascunho do cadastro permanece nos metadados Auth; alterações futuras no perfil
usam a tabela, sem sincronizar o rascunho. Acervo e painel continuam demonstrativos.
