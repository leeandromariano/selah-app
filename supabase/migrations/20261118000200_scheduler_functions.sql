begin;

-- Funções finas para o agendador de lembretes que roda como Edge Function (send-reminders). A função usa a chave de serviço do
-- próprio runtime e chama SOMENTE estas funções; todas são executáveis apenas por service_role (negadas a anon e authenticated).
-- Elas só repassam para as funções privadas que já existem, sempre em modo webpush e com o limite de 100 por lote.
create function public.scheduler_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('mode', mode, 'vapid_public_key', vapid_public_key) from private.push_configuration limit 1
$$;
create function public.scheduler_claim_reminders(p_now timestamptz) returns setof uuid
language sql volatile security definer set search_path = '' as $$
  select * from private.claim_reminders(p_now, 100, 'webpush')
$$;
create function public.scheduler_prepare_reminder(p_id uuid, p_now timestamptz) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.prepare_reminder(p_id, p_now)
$$;
create function public.scheduler_finish_reminder(p_id uuid, p_result text) returns void
language sql volatile security definer set search_path = '' as $$
  select private.finish_reminder(p_id, p_result)
$$;
create function public.scheduler_claim_notices(p_now timestamptz) returns setof uuid
language sql volatile security definer set search_path = '' as $$
  select * from private.claim_publish_notices(p_now, 100, 'webpush')
$$;
create function public.scheduler_prepare_notice(p_id uuid, p_now timestamptz) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select private.prepare_publish_notice(p_id, p_now)
$$;
create function public.scheduler_finish_notice(p_id uuid, p_result text) returns void
language sql volatile security definer set search_path = '' as $$
  select private.finish_publish_notice(p_id, p_result)
$$;
create function public.scheduler_claim_proofs() returns setof jsonb
language sql volatile security definer set search_path = '' as $$
  select * from private.claim_push_proofs()
$$;
create function public.scheduler_cleanup() returns void
language sql volatile security definer set search_path = '' as $$
  select private.cleanup_reminders()
$$;

-- Quem chama a função é o próprio banco (pg_cron + pg_net), com um segredo guardado no Vault. A função confere o segredo aqui,
-- sem precisar de variável de ambiente: o valor nunca sai do Vault, a não ser dentro do cabeçalho enviado pelo banco.
create function public.scheduler_check_secret(p_secret text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_secret is null or length(p_secret) < 32 then return false; end if;
  return exists(select 1 from vault.decrypted_secrets where name = 'selah_scheduler_secret' and decrypted_secret = p_secret);
end $$;

do $$ declare r record; begin
  for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'scheduler\_%'
  loop
    execute format('alter function %s owner to postgres', r.signature);
    execute format('revoke all on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end $$;

commit;
