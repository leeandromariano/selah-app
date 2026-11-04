# Google OAuth — Selah STAGING (plano de implementação)

Status: planejamento; **não habilitar o provider nem publicar o botão antes da migração e da homologação**.

## Contrato atual

- Projeto Supabase hospedado STAGING: `hepndavkzuktakezrmsj`; origem canônica: `https://selah-staging.pages.dev`.
- O cliente web Vite/React usa fluxo OAuth implícito do Supabase, com reconhecimento automático de tokens no URL.
- Login por e-mail/senha continua disponível.
- As triggers `private.reserve_signup_username` e `private.signup_whatsapp_profile` **exigem** username e WhatsApp no INSERT de `auth.users`. Um Google OAuth novo normalmente não fornece esses campos. Sem alteração controlada, falhará ao criar a conta.
- O cadastro existente requer username único e WhatsApp válido; o consentimento para contato é separado, **desmarcado por padrão**, nunca inferido da conta Google.
- OWNER, ADMIN e PUBLICADOR são identificados por membership no banco, jamais por metadados do Google.

## Plano de segurança

1. Separar Google OAuth do cadastro por senha usando um marcador de provedor **confiável do Auth** (não `raw_user_meta_data` livremente editável), e permitir uma conta Google recém-criada em estado **pendente de conclusão**, sem inventar username ou WhatsApp.
2. Disponibilizar formulário de conclusão da conta (username único, WhatsApp E.164, nome opcional, consentimento de feedback separado e opcional); salvar campos atomicamente no banco por RPC de identidade própria, sem expor serviços privilegiados ao navegador.
3. Bloquear o uso normal do app para contas Google incompletas, mantendo a sessão somente para concluir o cadastro, e reforçar em SQL o isolamento de dados dos usuários que ainda não concluíram.
4. Preservar vínculos existentes quando o Google autenticar um e-mail já cadastrado; testar com contas separadas para nunca arriscar OWNER.
5. Usar `supabase.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + '/' } })`, restrito à origem autorizada e configurada para STAGING. Tratar retorno/cancelamento e erros de provider sem revelar credenciais.
6. Testar SQL/RLS em Docker **local**, testes automatizados UI/TS/lint, e o callback real somente no STAGING. Não rodar fixtures em bancos remotos.
7. Criar OAuth Client Web exclusivo do STAGING no Google Cloud. Authorized JS origin `https://selah-staging.pages.dev`, authorized redirect URI `https://hepndavkzuktakezrmsj.supabase.co/auth/v1/callback`. Credenciais ficam no painel seguro do Supabase, **nunca no GitHub, navegador ou chat**.
8. Configurar Supabase Auth -> URL Configuration com retorno permitido `https://selah-staging.pages.dev/` e provider Google apenas **quando** fluxo de conclusão estiver pronto e revisado.
9. Não fazer merge nem aplicar SQL remoto sem autorização explícita; produção definitiva segue desligada.

## Casos de homologação indispensáveis

- Conta existente e verificada por e-mail que usa Google: mantém `auth.uid()`, username, perfil, histórico, privacidade e roles.
- Primeira entrada por Google: tela de conclusão sem acesso ao painel ou ao conteúdo antes do preenchimento, usernames duplicados negados e WhatsApp validado no servidor.
- Abandono e retorno ao cadastro incompleto com a mesma conta Google.
- Consentimento WhatsApp opcional não preselecionado; sem reaproveitar escopos Google para contatos.
- Login/senha e recuperação de senha existentes seguem funcionando.
- Tentativa de login com outro provedor ou URL de redirecionamento não permitida é negada sem vazamento.
- Revogação de PUBLICADOR e elegibilidade OWNER continuam determinadas pelas mesmas regras do banco.

Referências oficiais:
- https://supabase.com/docs/guides/auth/social-sign-in/auth-google
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/managing-user-data
