-- Contas sintéticas e mudanças de papel existem só no banco descartável; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table pub_checks(label text);
grant insert on pub_checks to authenticated;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into pub_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated;
create temp table pub_fixture(role_name text, id uuid);
grant select, insert on pub_fixture to authenticated;
insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'pubaccess-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'pubaccess_' || r, 'whatsapp', '+5511999990000')
from unnest(array['owner', 'reader', 'granted']) r;
insert into pub_fixture select substr(split_part(email, '@', 1), 11), id from auth.users where email like 'pubaccess-%@example.invalid';
delete from private.app_owner; -- só pode haver um OWNER; a transação é desfeita no fim
insert into private.app_owner(user_id) select id from pub_fixture where role_name = 'owner';
insert into private.devotional_publishers(user_id) select id from pub_fixture where role_name = 'granted';

create function pg_temp.access_as(who text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from pub_fixture where role_name = who), 'role', 'authenticated')::text, true);
  set local role authenticated;
  v := public.get_my_publisher_access();
  reset role;
  return v;
end $$;
select pg_temp.ok(pg_temp.access_as('owner'), 'OWNER verificado tem acesso ao Espaço do Publicador');
select pg_temp.ok(pg_temp.access_as('granted'), 'publicador concedido continua com acesso');
select pg_temp.ok(not pg_temp.access_as('reader'), 'leitor comum continua sem acesso');
-- o OWNER não vira linha na tabela de publicadores: o acesso vem do papel de OWNER
select pg_temp.ok(not exists (select 1 from private.devotional_publishers p join pub_fixture f on f.id = p.user_id where f.role_name = 'owner'), 'acesso do OWNER não grava membro publicador');
-- OWNER com e-mail não confirmado ou banido perde o acesso
update auth.users set email_confirmed_at = null where id = (select id from pub_fixture where role_name = 'owner');
select pg_temp.ok(not pg_temp.access_as('owner'), 'OWNER sem e-mail confirmado não tem acesso');
update auth.users set email_confirmed_at = now(), banned_until = now() + interval '1 day' where id = (select id from pub_fixture where role_name = 'owner');
select pg_temp.ok(not pg_temp.access_as('owner'), 'OWNER banido não tem acesso');
select count(*) as verificacoes from pub_checks;
rollback;
