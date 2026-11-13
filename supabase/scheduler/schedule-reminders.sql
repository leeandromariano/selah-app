-- Agendamento do envio de lembretes no projeto HOSPEDADO (não é migração: contém o endereço do projeto).
-- A cada minuto o próprio banco chama a Edge Function send-reminders, com um segredo guardado no Vault.
-- Rodar uma vez, com: npx supabase db query --linked -f supabase/scheduler/schedule-reminders.sql
-- Se alguma extensão não puder ser criada por SQL, ativar em Database > Extensions (pg_cron e pg_net) e rodar de novo.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Segredo aleatório de 64 caracteres, criado só se ainda não existir. Ele nunca precisa ser copiado: o cron lê do Vault
-- e a função confere no banco (public.scheduler_check_secret).
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'selah_scheduler_secret', 'Segredo do agendador de lembretes')
where not exists (select 1 from vault.secrets where name = 'selah_scheduler_secret');

-- Troca o agendamento se já existir (idempotente).
select cron.unschedule('selah-send-reminders') where exists (select 1 from cron.job where jobname = 'selah-send-reminders');
select cron.schedule('selah-send-reminders', '* * * * *', $job$
  select net.http_post(
    url := 'https://hepndavkzuktakezrmsj.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-scheduler-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'selah_scheduler_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000)
$job$);
