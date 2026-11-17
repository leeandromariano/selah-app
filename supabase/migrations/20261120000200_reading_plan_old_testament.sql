begin;

-- Novo plano: Antigo Testamento em 5 meses (150 dias).
alter table public.reading_plan_enrollments drop constraint reading_plan_enrollments_plan_id_check;
alter table public.reading_plan_enrollments add constraint reading_plan_enrollments_plan_id_check
  check (plan_id in ('biblia-1-ano', 'novo-testamento-90-dias', 'antigo-testamento-150-dias'));

create or replace function private.reading_plan_days(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'biblia-1-ano' then 365 when 'novo-testamento-90-dias' then 90 when 'antigo-testamento-150-dias' then 150 end
$$;

commit;
