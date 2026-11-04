begin;

-- Public attribution is intentionally separate from author_id (the authenticated
-- account responsible for the record). Existing rows keep NULL rather than
-- falsely crediting the account that originally saved them.
alter table public.devotionals
  add column author_name text,
  add column review_requested_at timestamptz;

alter table public.devotionals
  add constraint devotionals_author_name_format
  check (author_name is null or char_length(btrim(author_name)) between 2 and 120);

-- Existing column-level grants remain explicit; the browser cannot write the
-- review timestamp, which is set and cleared only by server-authorized RPCs.
grant insert (author_name) on public.devotionals to authenticated;
grant update (author_name) on public.devotionals to authenticated;

create table private.devotional_publishers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default clock_timestamp()
);
alter table private.devotional_publishers enable row level security;
revoke all on private.devotional_publishers from public, anon, authenticated, service_role;

-- Like OWNER, a publisher must be a verified active account and must not have
-- requested deletion. Membership is never inferred from client metadata.
create function private.is_publisher() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.devotional_publishers p
    join auth.users u on u.id = p.user_id
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and u.deleted_at is null
      and not coalesce(u.is_anonymous, false)
      and (u.banned_until is null or u.banned_until <= clock_timestamp())
      and not exists (
        select 1 from public.account_deletion_requests d where d.user_id = u.id
      )
  );
$$;
alter function private.is_publisher() owner to postgres;
revoke all on function private.is_publisher() from public, anon, authenticated, service_role;
grant execute on function private.is_publisher() to authenticated;

create function public.get_my_publisher_access() returns boolean
language sql stable security definer set search_path = ''
as $$ select private.is_publisher(); $$;
alter function public.get_my_publisher_access() owner to postgres;
revoke all on function public.get_my_publisher_access() from public, anon, authenticated, service_role;
grant execute on function public.get_my_publisher_access() to authenticated;

-- Publishers see their own drafts and submissions (never another writer's
-- drafts). Existing reader policy still shows released content to readers.
create policy devotionals_publisher_read on public.devotionals
  for select to authenticated
  using (private.is_publisher() and author_id = (select auth.uid()));

-- Insert is restricted to the current publisher's own unpublished draft.
create policy devotionals_publisher_insert on public.devotionals
  for insert to authenticated
  with check (
    private.is_publisher()
    and author_id = (select auth.uid())
    and status = 'draft'
    and publish_at is null
    and review_requested_at is null
  );

-- Submitted drafts cannot be edited or withdrawn by their publisher.
-- Neither editing nor publishing another user's work is permitted.
create policy devotionals_publisher_update on public.devotionals
  for update to authenticated
  using (
    private.is_publisher()
    and author_id = (select auth.uid())
    and status = 'draft'
    and review_requested_at is null
  )
  with check (
    private.is_publisher()
    and author_id = (select auth.uid())
    and status = 'draft'
    and publish_at is null
    and review_requested_at is null
  );

-- The user can ask for a review only after completing the attribution and
-- editorial content. The timestamp is server-controlled and cannot be forged.
create function public.submit_devotional_for_review(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_publisher() then
    raise exception 'Publisher required' using errcode = '42501';
  end if;
  update public.devotionals
    set review_requested_at = clock_timestamp()
    where id = p_id and author_id = (select auth.uid())
      and status = 'draft' and publish_at is null
      and review_requested_at is null
      and author_name is not null
      and char_length(btrim(author_name)) between 2 and 120
      and char_length(btrim(title)) > 0
      and char_length(btrim(bible_reference)) > 0
      and char_length(btrim(bible_text)) > 0
      and char_length(btrim(content)) > 0
      and char_length(btrim(reflection_question)) > 0;
  if not found then
    raise exception 'Draft unavailable for submission' using errcode = '42501';
  end if;
end;
$$;
alter function public.submit_devotional_for_review(uuid) owner to postgres;
revoke all on function public.submit_devotional_for_review(uuid) from public, anon, authenticated, service_role;
grant execute on function public.submit_devotional_for_review(uuid) to authenticated;

-- Staff can return a submitted draft to its author without overwriting text,
-- allowing the publisher to revise and submit again.
create function public.return_devotional_to_author(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator required' using errcode = '42501';
  end if;
  update public.devotionals
    set review_requested_at = null
    where id = p_id and status = 'draft' and review_requested_at is not null;
  if not found then
    raise exception 'Submission unavailable' using errcode = '42501';
  end if;
end;
$$;
alter function public.return_devotional_to_author(uuid) owner to postgres;
revoke all on function public.return_devotional_to_author(uuid) from public, anon, authenticated, service_role;
grant execute on function public.return_devotional_to_author(uuid) to authenticated;

-- Owner-only role management by exact username. No directory of all readers,
-- no role assignment by client metadata, and no grant to ADMIN or OWNER.
create function public.owner_manage_publisher(p_username text, p_enabled boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_username text := lower(btrim(p_username));
  v_target uuid;
begin
  perform private.owner_identity();
  if v_username is null or v_username !~ '^[a-z][a-z0-9_]{2,23}$'
    or p_enabled is null then
    raise exception 'Invalid username or action' using errcode = '22023';
  end if;
  select n.user_id into v_target
  from public.account_usernames n
  join auth.users u on u.id = n.user_id
  where n.username = v_username
    and u.deleted_at is null
    and not coalesce(u.is_anonymous, false)
  for update of u;
  if v_target is null or v_target = (select auth.uid())
    or exists (select 1 from private.app_owner o where o.user_id = v_target)
    or exists (select 1 from private.admin_users a where a.user_id = v_target) then
    raise exception 'Account unavailable for publisher role' using errcode = '42501';
  end if;
  if p_enabled then
    if not exists (
      select 1 from auth.users u where u.id = v_target
        and u.email_confirmed_at is not null
        and (u.banned_until is null or u.banned_until <= clock_timestamp())
        and not exists (
          select 1 from public.account_deletion_requests d where d.user_id = v_target
        )
    ) then
      raise exception 'Account not eligible' using errcode = '42501';
    end if;
    insert into private.devotional_publishers(user_id) values (v_target)
      on conflict (user_id) do nothing;
  else
    delete from private.devotional_publishers where user_id = v_target;
  end if;
  return jsonb_build_object('username', v_username, 'enabled', p_enabled);
end;
$$;
alter function public.owner_manage_publisher(text, boolean) owner to postgres;
revoke all on function public.owner_manage_publisher(text, boolean) from public, anon, authenticated, service_role;
grant execute on function public.owner_manage_publisher(text, boolean) to authenticated;

-- Lists only accounts already granted PUBLICADOR; does not expose the reader
-- directory, email, WhatsApp, user_id or other personal attributes.
create function public.owner_list_publishers() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform private.owner_identity();
  select coalesce(jsonb_agg(jsonb_build_object(
    'username', n.username
  ) order by n.username), '[]'::jsonb)
  into v_result
  from private.devotional_publishers p
  join public.account_usernames n on n.user_id = p.user_id;
  return v_result;
end;
$$;
alter function public.owner_list_publishers() owner to postgres;
revoke all on function public.owner_list_publishers() from public, anon, authenticated, service_role;
grant execute on function public.owner_list_publishers() to authenticated;

commit;
