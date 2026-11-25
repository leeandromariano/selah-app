begin;

-- Login por username no projeto hospedado. A Edge Function usa a chave de serviço do próprio runtime e chama SOMENTE estas
-- duas funções. Nenhuma é executável por anon ou authenticated: não existe consulta pública de username -> e-mail.
-- (O desenho local continuava usando uma conexão PostgreSQL privilegiada; no hospedado a função não recebe senha de banco.)
create function public.login_resolve_username(p_username text) returns text
language sql stable security definer set search_path = '' as $$
  select u.email::text
  from public.account_usernames n join auth.users u on u.id = n.user_id
  where n.username = p_username
  limit 1
$$;

-- Mesmo orçamento de tentativas do desenho local (10 por identificador em 10 min, 60 globais por minuto).
create function public.login_consume_attempt(p_bucket text) returns boolean
language sql volatile security definer set search_path = '' as $$
  select private.consume_password_login_attempt(p_bucket)
$$;

alter function public.login_resolve_username(text) owner to postgres;
alter function public.login_consume_attempt(text) owner to postgres;
revoke all on function public.login_resolve_username(text) from public, anon, authenticated;
revoke all on function public.login_consume_attempt(text) from public, anon, authenticated;
grant execute on function public.login_resolve_username(text) to service_role;
grant execute on function public.login_consume_attempt(text) to service_role;

commit;
