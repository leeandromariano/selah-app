begin;

-- Cápsula de Oração ("No secreto" com retorno): pedidos de oração PRIVADOS, com data de revisão.
-- Só o próprio leitor lê e altera os seus pedidos; nem o owner nem outros leitores têm acesso (sem leitura direta
-- das tabelas e sem nenhuma função de consulta para terceiros). Se a conta for excluída, os pedidos saem junto.
create table public.prayer_capsules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  devotional_id uuid,
  request text not null check (length(btrim(request)) between 3 and 500),
  created_on date not null,
  review_on date not null check (review_on >= created_on),
  status text not null default 'open' check (status in ('open', 'answered')),
  answered_on date,
  testimony text check (testimony is null or length(btrim(testimony)) between 1 and 500),
  created_at timestamptz not null default now(),
  check ((status = 'answered') = (answered_on is not null))
);
create index prayer_capsules_user_status_idx on public.prayer_capsules (user_id, status, review_on);
alter table public.prayer_capsules enable row level security;
revoke all on public.prayer_capsules from public, anon, authenticated;

create function private.prayer_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create function private.prayer_item(p_row public.prayer_capsules) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object('id', p_row.id, 'request', p_row.request, 'created_on', p_row.created_on, 'review_on', p_row.review_on,
    'status', p_row.status, 'answered_on', p_row.answered_on, 'testimony', p_row.testimony,
    'days_since', greatest(0, private.prayer_today() - p_row.created_on))
$$;

create function public.prayer_create(p_request text, p_days integer, p_devotional_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
  v_request text := btrim(coalesce(p_request, ''));
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(v_request) not between 3 and 500 then raise exception 'Escreva o pedido (até 500 caracteres).' using errcode = '22023'; end if;
  if p_days is null or p_days not in (7, 14, 30, 60, 90, 180) then raise exception 'Escolha quando rever o pedido.' using errcode = '22023'; end if;
  if (select count(*) from public.prayer_capsules where user_id = v_user and status = 'open') >= 50 then
    raise exception 'Você já tem 50 pedidos em oração. Marque alguns como respondidos ou exclua antes de guardar outro.' using errcode = '22023';
  end if;
  insert into public.prayer_capsules (user_id, devotional_id, request, created_on, review_on)
    values (v_user, p_devotional_id, v_request, private.prayer_today(), private.prayer_today() + p_days) returning * into v_row;
  return private.prayer_item(v_row);
end $$;

-- Pedidos cuja data de revisão chegou, para o card na Home.
create function public.prayer_due() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(private.prayer_item(c) order by c.review_on, c.created_at) from (
    select * from public.prayer_capsules where user_id = v_user and status = 'open' and review_on <= private.prayer_today()
    order by review_on, created_at limit 10) c), '[]'::jsonb);
end $$;

create function public.prayer_list(p_status text, p_page integer default 0, p_size integer default 20) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_status is null or p_status not in ('open', 'answered') or p_page is null or p_page < 0 or p_page > 100000 or p_size is null or p_size < 1 or p_size > 50 then
    raise exception 'Invalid status or pagination' using errcode = '22023';
  end if;
  return jsonb_build_object('status', p_status, 'page', p_page, 'size', p_size,
    'total', (select count(*) from public.prayer_capsules where user_id = v_user and status = p_status),
    'items', coalesce((select jsonb_agg(private.prayer_item(c)) from (
      select * from public.prayer_capsules where user_id = v_user and status = p_status
      order by case when p_status = 'answered' then answered_on end desc nulls last, review_on asc, created_at desc
      limit p_size offset (p_page::bigint * p_size)) c), '[]'::jsonb));
end $$;

create function public.prayer_answer(p_id uuid, p_testimony text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
  v_testimony text := nullif(btrim(coalesce(p_testimony, '')), '');
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if v_testimony is not null and length(v_testimony) > 500 then raise exception 'O testemunho pode ter até 500 caracteres.' using errcode = '22023'; end if;
  update public.prayer_capsules set status = 'answered', answered_on = private.prayer_today(), testimony = v_testimony
    where id = p_id and user_id = v_user and status = 'open' returning * into v_row;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  return private.prayer_item(v_row);
end $$;

-- "Ainda aguardando": adia a próxima revisão.
create function public.prayer_snooze(p_id uuid, p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_days is null or p_days not in (7, 14, 30, 60, 90, 180) then raise exception 'Escolha quando rever o pedido.' using errcode = '22023'; end if;
  update public.prayer_capsules set review_on = private.prayer_today() + p_days
    where id = p_id and user_id = v_user and status = 'open' returning * into v_row;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  return private.prayer_item(v_row);
end $$;

create function public.prayer_delete(p_id uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_rows integer;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  delete from public.prayer_capsules where id = p_id and user_id = v_user;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  return jsonb_build_object('deleted', true);
end $$;

alter function private.prayer_today() owner to postgres;
alter function private.prayer_item(public.prayer_capsules) owner to postgres;
alter function public.prayer_create(text, integer, uuid) owner to postgres;
alter function public.prayer_due() owner to postgres;
alter function public.prayer_list(text, integer, integer) owner to postgres;
alter function public.prayer_answer(uuid, text) owner to postgres;
alter function public.prayer_snooze(uuid, integer) owner to postgres;
alter function public.prayer_delete(uuid) owner to postgres;
revoke all on function private.prayer_today() from public, anon, authenticated, service_role;
revoke all on function private.prayer_item(public.prayer_capsules) from public, anon, authenticated, service_role;
revoke all on function public.prayer_create(text, integer, uuid) from public, anon, authenticated, service_role;
revoke all on function public.prayer_due() from public, anon, authenticated, service_role;
revoke all on function public.prayer_list(text, integer, integer) from public, anon, authenticated, service_role;
revoke all on function public.prayer_answer(uuid, text) from public, anon, authenticated, service_role;
revoke all on function public.prayer_snooze(uuid, integer) from public, anon, authenticated, service_role;
revoke all on function public.prayer_delete(uuid) from public, anon, authenticated, service_role;
grant execute on function public.prayer_create(text, integer, uuid) to authenticated;
grant execute on function public.prayer_due() to authenticated;
grant execute on function public.prayer_list(text, integer, integer) to authenticated;
grant execute on function public.prayer_answer(uuid, text) to authenticated;
grant execute on function public.prayer_snooze(uuid, integer) to authenticated;
grant execute on function public.prayer_delete(uuid) to authenticated;

commit;
