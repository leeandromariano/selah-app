begin;

-- Planos de leitura bíblica. Os planos (quais capítulos em cada dia) vivem no app; aqui fica só a adesão de cada leitor
-- e os dias que ele marcou como lidos. Dados PRIVADOS: só o próprio leitor lê e altera; a conta excluída leva tudo junto.
create table public.reading_plan_enrollments (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null check (plan_id in ('biblia-1-ano', 'novo-testamento-90-dias')),
  started_on date not null,
  completed_days smallint[] not null default '{}' check (cardinality(completed_days) <= 365),
  updated_at timestamptz not null default now(),
  primary key (user_id, plan_id)
);
alter table public.reading_plan_enrollments enable row level security;
revoke all on public.reading_plan_enrollments from public, anon, authenticated;

create function private.reading_plan_days(p_plan text) returns integer
language sql immutable set search_path = '' as $$
  select case p_plan when 'biblia-1-ano' then 365 when 'novo-testamento-90-dias' then 90 end
$$;

create function private.reading_plan_item(p_row public.reading_plan_enrollments) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('plan', p_row.plan_id, 'started_on', p_row.started_on, 'completed_days', to_jsonb(p_row.completed_days))
$$;

create function public.reading_plans_mine() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(private.reading_plan_item(e) order by e.started_on, e.plan_id)
    from public.reading_plan_enrollments e where e.user_id = v_user), '[]'::jsonb);
end $$;

create function public.reading_plan_join(p_plan text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_row public.reading_plan_enrollments;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_plan is null or private.reading_plan_days(p_plan) is null then raise exception 'Plano desconhecido.' using errcode = '22023'; end if;
  insert into public.reading_plan_enrollments (user_id, plan_id, started_on)
    values (v_user, p_plan, (now() at time zone 'America/Sao_Paulo')::date)
    on conflict (user_id, plan_id) do update set updated_at = now()
    returning * into v_row;
  return private.reading_plan_item(v_row);
end $$;

create function public.reading_plan_set_day(p_plan text, p_day integer, p_done boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_row public.reading_plan_enrollments; v_days integer := private.reading_plan_days(p_plan);
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_days is null or p_day is null or p_day < 1 or p_day > v_days or p_done is null then raise exception 'Dia inválido.' using errcode = '22023'; end if;
  update public.reading_plan_enrollments set updated_at = now(),
    completed_days = case when p_done
      then (select coalesce(array_agg(d order by d), '{}') from (select distinct unnest(completed_days || p_day::smallint) as d) s)
      else array_remove(completed_days, p_day::smallint) end
    where user_id = v_user and plan_id = p_plan returning * into v_row;
  if not found then raise exception 'Entre no plano antes de marcar os dias.' using errcode = '22023'; end if;
  return private.reading_plan_item(v_row);
end $$;

create function public.reading_plan_leave(p_plan text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from public.reading_plan_enrollments where user_id = v_user and plan_id = p_plan;
end $$;

revoke all on function public.reading_plans_mine(), public.reading_plan_join(text), public.reading_plan_set_day(text, integer, boolean), public.reading_plan_leave(text) from public, anon;
grant execute on function public.reading_plans_mine(), public.reading_plan_join(text), public.reading_plan_set_day(text, integer, boolean), public.reading_plan_leave(text) to authenticated;

commit;
