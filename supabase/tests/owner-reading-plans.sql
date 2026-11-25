-- Painel OWNER: planos de leitura. Contas sintéticas só no banco local; tudo é desfeito no fim.
\set ON_ERROR_STOP on
begin;
create temp table plan_checks(label text);
grant insert on plan_checks to authenticated, anon;
create temp table plan_fixture(role_name text primary key, id uuid);
grant select on plan_fixture to authenticated, anon;
create function pg_temp.ok(value boolean, label text) returns void language plpgsql as $$begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
  insert into plan_checks values (label);
end $$;
grant execute on function pg_temp.ok(boolean, text) to authenticated, anon;
create function pg_temp.denied(statement text, label text) returns void language plpgsql as $$begin
  begin execute statement; exception when others then insert into plan_checks values (label); return; end;
  raise exception 'FAIL: %', label;
end $$;
grant execute on function pg_temp.denied(text, text) to authenticated, anon;

insert into auth.users(id, email, email_confirmed_at, raw_user_meta_data)
select gen_random_uuid(), 'plans-' || r || '@example.invalid', clock_timestamp(), jsonb_build_object('username', 'plans_' || r, 'whatsapp', '+5511999990000')
from unnest(array['owner', 'ana', 'bia']) r;
insert into plan_fixture select substr(split_part(email, '@', 1), 7), id from auth.users where email like 'plans-%@example.invalid';
delete from private.app_owner; -- só pode haver um OWNER; a transação é desfeita no fim
insert into private.app_owner(user_id) select id from plan_fixture where role_name = 'owner';
delete from public.reading_plan_enrollments; -- contagens exatas; desfeito no fim

insert into public.reading_plan_enrollments(user_id, plan_id, started_on, completed_days)
select id, 'novo-testamento-90-dias', current_date - 10, array(select generate_series(1, 45))::smallint[] from plan_fixture where role_name = 'ana';
insert into public.reading_plan_enrollments(user_id, plan_id, started_on, completed_days)
select id, 'biblia-1-ano', current_date, '{}' from plan_fixture where role_name = 'bia';

create function pg_temp.as_user(who text) returns void language plpgsql as $$begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from plan_fixture where role_name = who), 'role', 'authenticated')::text, true);
end $$;
grant execute on function pg_temp.as_user(text) to authenticated;

set local role authenticated;
select pg_temp.as_user('owner');
select pg_temp.ok((public.get_owner_reading_plans()->>'readers')::int = 2, 'owner vê dois leitores em planos');
select pg_temp.ok((public.get_owner_reading_plans()->>'enrollments')::int = 2, 'duas adesões');
select pg_temp.ok(public.get_owner_reading_plans()->'items'->0->>'username' = 'plans_ana', 'quem avançou mais vem primeiro');
select pg_temp.ok((public.get_owner_reading_plans()->'items'->0->>'percent')::int = 50, '45 de 90 dias é 50%');
select pg_temp.ok((public.get_owner_reading_plans()->'items'->1->>'percent')::int = 0, 'plano recém-iniciado é 0%');
select pg_temp.ok((select array_agg(k order by k) from jsonb_object_keys(public.get_owner_reading_plans()->'items'->0) k)
  = array['done_days','percent','plan','started_on','total_days','updated_on','username'], 'projeção mínima: sem dias marcados, e-mail ou telefone');
select pg_temp.ok((public.get_owner_reading_plans('bia')->>'matched')::int = 1, 'busca por username');
select pg_temp.ok((public.get_owner_reading_plans('', 'biblia-1-ano')->>'matched')::int = 1, 'filtro por plano');
select pg_temp.denied($q$select public.get_owner_reading_plans('', 'outro')$q$, 'plano desconhecido é recusado');
select pg_temp.denied($q$select public.get_owner_reading_plans('', '', 0, 500)$q$, 'página grande demais é recusada');
select pg_temp.denied($q$select * from public.reading_plan_enrollments$q$, 'tabela continua sem acesso direto, até para o owner');
select pg_temp.as_user('ana');
select pg_temp.denied($q$select public.get_owner_reading_plans()$q$, 'leitor comum não consulta');
reset role;
set local role anon;
select pg_temp.denied($q$select public.get_owner_reading_plans()$q$, 'anônimo não consulta');
reset role;

select count(*) || ' verificações passaram' from plan_checks;
rollback;
