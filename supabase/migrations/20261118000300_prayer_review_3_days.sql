begin;

-- Acrescenta "3 dias" às opções de revisão do pedido de oração (antes: 7, 14, 30, 60, 90, 180).
-- create or replace preserva as permissões que as funções já têm.
create or replace function public.prayer_create(p_request text, p_days integer, p_devotional_id uuid default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
  v_request text := btrim(coalesce(p_request, ''));
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if length(v_request) not between 3 and 500 then raise exception 'Escreva o pedido (até 500 caracteres).' using errcode = '22023'; end if;
  if p_days is null or p_days not in (3, 7, 14, 30, 60, 90, 180) then raise exception 'Escolha quando rever o pedido.' using errcode = '22023'; end if;
  if (select count(*) from public.prayer_capsules where user_id = v_user and status = 'open') >= 50 then
    raise exception 'Você já tem 50 pedidos em oração. Marque alguns como respondidos ou exclua antes de guardar outro.' using errcode = '22023';
  end if;
  insert into public.prayer_capsules (user_id, devotional_id, request, created_on, review_on)
    values (v_user, p_devotional_id, v_request, private.prayer_today(), private.prayer_today() + p_days) returning * into v_row;
  return private.prayer_item(v_row);
end $$;

-- "Ainda aguardando": adia a próxima revisão. notified_on volta a nulo para o novo prazo poder gerar um aviso por push.
create or replace function public.prayer_snooze(p_id uuid, p_days integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.prayer_capsules;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_days is null or p_days not in (3, 7, 14, 30, 60, 90, 180) then raise exception 'Escolha quando rever o pedido.' using errcode = '22023'; end if;
  update public.prayer_capsules set review_on = private.prayer_today() + p_days, notified_on = null
    where id = p_id and user_id = v_user and status = 'open' returning * into v_row;
  if not found then raise exception 'Pedido não encontrado.' using errcode = 'P0002'; end if;
  return private.prayer_item(v_row);
end $$;

commit;
