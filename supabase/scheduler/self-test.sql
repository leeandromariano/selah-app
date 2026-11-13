-- Autoteste da Edge Function send-reminders (sem rede de push e sem tocar em nenhum aparelho).
-- Prova que a criptografia e a assinatura VAPID funcionam no runtime real. O segredo vem do Vault; nada é digitado.
-- Rodar: npx supabase db query --linked -f supabase/scheduler/self-test.sql
-- Depois de uns 10 segundos, conferir a resposta (o pg_net responde de forma assíncrona):
--   select status_code, content from net._http_response order by created desc limit 1;
-- Esperado: 200 e {"selfTest":"ok"}. 403 = segredo; 503 = chaves/segredos da função; 404 = função não implantada.
select net.http_post(
  url := 'https://hepndavkzuktakezrmsj.supabase.co/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'x-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'selah_scheduler_secret')),
  body := '{"selfTest": true}'::jsonb,
  timeout_milliseconds := 20000) as request_id;
