-- O OWNER também pode usar o Espaço do Publicador (escrever os próprios rascunhos e enviá-los para revisão).
-- Não é um novo papel gravado: o OWNER verificado e ativo passa a valer como publicador dentro da mesma função
-- que todas as políticas e RPCs de publicador já usam. Quem não é OWNER segue dependendo de ter sido concedido
-- por owner_manage_publisher; as regras de rascunho próprio (autor = quem está logado, status draft, sem
-- publicar direto) continuam as mesmas para todos.
create or replace function private.is_publisher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and (
        exists (select 1 from private.devotional_publishers p where p.user_id = u.id)
        or exists (select 1 from private.app_owner o where o.user_id = u.id)
      )
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and not coalesce(u.is_anonymous, false)
      and (u.banned_until is null or u.banned_until <= clock_timestamp())
      and not exists (
        select 1 from public.account_deletion_requests d where d.user_id = u.id
      )
  );
$$;
