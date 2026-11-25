# Login por username no projeto hospedado (13/11/2026)

O desenho local (`username-login-local.md`) continua valendo: um campo "Usuário ou e-mail", resposta genérica para erro, limite de tentativas, sem consulta pública de e-mail.

## O que muda no hospedado
- **Função `password-login`** (mesmo código): tenta o runtime local; se não for, aceita só um projeto `https://<ref>.supabase.co`. Qualquer outro destino devolve 503.
- **Sem senha de banco na função.** Ela usa a chave de serviço injetada pelo runtime e chama só `public.login_resolve_username` e `public.login_consume_attempt` (migração `20261117000100`). Ambas são executáveis apenas por `service_role` (negadas a `anon` e `authenticated`, verificado com `has_function_privilege`). O `fetch` da função só alcança essas duas rotas e `/auth/v1/token?grant_type=password`.
- **Origens:** por padrão `https://appcoram.com.br` e `https://www.appcoram.com.br`; o segredo `SELAH_ALLOWED_ORIGINS` (https, separadas por vírgula) substitui.
- **App:** e-mail entra direto pelo Auth (não depende da função); só o username passa pela função (`identifierLogin`). Se a função cair, o login por e-mail continua.

## Implantação (operador, nunca pelo assistente)
1. Migração: `npx supabase db query --linked -f supabase/migrations/20261117000100_hosted_username_login.sql` e `npx supabase migration repair --status applied 20261117000100 --linked`.
2. Função: `npx supabase functions deploy password-login --project-ref <ref>` (usa `verify_jwt = false` do `config.toml`; sem Docker, acrescentar `--use-api`).
3. Teste direto, antes de publicar o app: `curl.exe -s -i -X POST https://<ref>.supabase.co/functions/v1/password-login -H "Content-Type: application/json" -d "{\"identifier\":\"nao_existe_xyz\",\"password\":\"x\"}"`. Esperado: **401** com a mensagem genérica, em cerca de 0,8 s. 503 indica configuração (chaves do runtime) e 404 indica função não implantada.
4. Só então publicar o app.

## Limites
Os de `username-login-local.md` continuam: orçamento global de 60 tentativas por minuto pode ser consumido por um agressor, o e-mail do titular aparece na sessão depois de autenticado, e não há prova de tempo constante. A limpeza dos contadores não é periódica. Login por e-mail no hospedado usa o limite nativo do Supabase Auth.
