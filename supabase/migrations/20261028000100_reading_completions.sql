begin;

-- This role cannot log in, bypass RLS, or be assumed by an API role.
create role selah_reading_owner nologin noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
-- Supabase's migration operator is not a superuser. Temporary ownership-transfer
-- privileges are revoked at the end; no API role ever receives membership.
grant selah_reading_owner to postgres;
grant create on schema public, private to selah_reading_owner;
grant usage on schema public, private, auth to selah_reading_owner;
grant execute on function auth.uid(), auth.jwt() to selah_reading_owner;

alter table public.devotionals add column reading_revision bigint not null default 1 check (reading_revision > 0);
create function private.advance_reading_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then new.reading_revision := 1;
  elsif row(new.title, new.bible_reference, new.bible_text, new.content, new.reflection_question, new.status, new.publish_at)
    is distinct from row(old.title, old.bible_reference, old.bible_text, old.content, old.reflection_question, old.status, old.publish_at) then
    new.reading_revision := old.reading_revision + 1;
  else new.reading_revision := old.reading_revision;
  end if;
  return new;
end;
$$;
revoke all on function private.advance_reading_revision() from public, anon, authenticated, service_role;
create trigger devotionals_reading_revision before insert or update on public.devotionals
for each row execute function private.advance_reading_revision();

-- Preserve existing openings, including after an administrator deletes content.
alter table public.devotional_views alter column devotional_id drop not null;
alter table public.devotional_views drop constraint devotional_views_devotional_id_fkey;
alter table public.devotional_views add constraint devotional_views_devotional_id_fkey
  foreign key (devotional_id) references public.devotionals(id) on delete set null;

create table public.reading_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  revision bigint not null check (revision > 0),
  credited_ms integer not null default 0 check (credited_ms between 0 and 60000),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, devotional_id)
);
create table private.reading_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  devotional_id uuid references public.devotionals(id) on delete cascade,
  session_id uuid,
  client_id uuid,
  token uuid,
  sequence bigint not null default 0 check (sequence >= 0),
  last_checkpoint_at timestamptz,
  expires_at timestamptz
);
create table public.devotional_completions (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_devotional_id uuid not null,
  devotional_id uuid references public.devotionals(id) on delete set null,
  revision bigint not null check (revision > 0),
  completed_at timestamptz not null,
  completed_day date not null,
  time_zone text not null default 'America/Sao_Paulo' check (time_zone = 'America/Sao_Paulo'),
  primary key (user_id, source_devotional_id),
  check (devotional_id is null or devotional_id = source_devotional_id)
);
create index devotional_completions_user_date_idx on public.devotional_completions (user_id, completed_at desc);
create index devotional_completions_content_idx on public.devotional_completions (devotional_id);
create index reading_progress_content_idx on public.reading_progress (devotional_id);
create index reading_leases_content_idx on private.reading_leases (devotional_id);

alter table public.reading_progress enable row level security;
alter table private.reading_leases enable row level security;
alter table public.devotional_completions enable row level security;
revoke all on public.reading_progress, private.reading_leases, public.devotional_completions
  from public, anon, authenticated, service_role;
grant select on public.reading_progress, public.devotional_completions to authenticated;
create policy reading_progress_own on public.reading_progress for select to authenticated using (user_id = (select auth.uid()));
create policy devotional_completions_own on public.devotional_completions for select to authenticated using (user_id = (select auth.uid()));
grant select, insert, update on public.reading_progress, private.reading_leases to selah_reading_owner;
grant select, insert on public.devotional_completions to selah_reading_owner;
create policy reading_progress_protocol on public.reading_progress to selah_reading_owner
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reading_leases_protocol on private.reading_leases to selah_reading_owner
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy reading_completions_protocol on public.devotional_completions to selah_reading_owner
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- A SHARE row lock serializes completion/checkpoints with edits and deletion.
grant select on public.devotionals to selah_reading_owner;
grant update (reading_revision) on public.devotionals to selah_reading_owner;
create policy devotionals_reading_protocol on public.devotionals for select to selah_reading_owner
  using (status = 'published' and publish_at <= clock_timestamp());
create policy devotionals_reading_lock on public.devotionals for update to selah_reading_owner
  using (status = 'published' and publish_at <= clock_timestamp()) with check (false);

-- Only wrappers below are API-callable. Lock order: content -> account lease -> progress.
-- No argument allows choosing a user, elapsed time, completion timestamp, or date.
create function private.reading_operation(p_devotional_id uuid, p_action text, p_client_id uuid default null,
  p_revision bigint default null, p_token uuid default null, p_sequence bigint default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_session uuid;
  v_revision bigint;
  v_progress public.reading_progress%rowtype;
  v_lease private.reading_leases%rowtype;
  v_completion public.devotional_completions%rowtype;
  v_now timestamptz;
  v_delta numeric;
  v_changed boolean := false;
  v_status text := 'paused';
  v_owned boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_completion from public.devotional_completions where user_id = v_user and source_devotional_id = p_devotional_id;
  if found then
    return jsonb_build_object('status','completed','devotional_id',p_devotional_id,'revision',v_completion.revision,
      'credited_ms',60000,'completed_at',v_completion.completed_at,'completed_day',v_completion.completed_day,'revision_changed',false);
  end if;
  select reading_revision into v_revision from public.devotionals where id = p_devotional_id
    and status = 'published' and publish_at <= clock_timestamp() for share;
  if not found then
    return jsonb_build_object('status','unavailable','devotional_id',p_devotional_id,'credited_ms',0,'revision_changed',false);
  end if;
  insert into private.reading_leases (user_id) values (v_user) on conflict (user_id) do nothing;
  select * into v_lease from private.reading_leases where user_id = v_user for update;
  insert into public.reading_progress (user_id,devotional_id,revision) values (v_user,p_devotional_id,v_revision)
    on conflict (user_id,devotional_id) do nothing;
  select * into v_progress from public.reading_progress where user_id = v_user and devotional_id = p_devotional_id for update;
  -- Re-check after serialization: another request may have completed this text.
  select * into v_completion from public.devotional_completions where user_id = v_user and source_devotional_id = p_devotional_id;
  if found then
    return jsonb_build_object('status','completed','devotional_id',p_devotional_id,'revision',v_completion.revision,
      'credited_ms',60000,'completed_at',v_completion.completed_at,'completed_day',v_completion.completed_day,'revision_changed',false);
  end if;
  v_now := clock_timestamp();
  if v_progress.revision <> v_revision then
    v_changed := true;
    update public.reading_progress set revision=v_revision, credited_ms=0, updated_at=v_now
      where user_id=v_user and devotional_id=p_devotional_id returning * into v_progress;
    if v_lease.devotional_id = p_devotional_id then v_lease.token := null; end if;
  end if;
  v_session := nullif(auth.jwt()->>'session_id','')::uuid;
  v_owned := v_lease.devotional_id = p_devotional_id and v_lease.session_id = v_session and v_lease.client_id = p_client_id;
  if v_lease.token is not null and v_lease.expires_at > v_now then v_status := 'elsewhere'; end if;
  if p_action in ('start','takeover') then
    if p_client_id is null or v_session is null then raise exception 'Session required' using errcode='42501'; end if;
    if p_revision is distinct from v_revision then
      v_status := 'revision_changed';
    elsif v_progress.credited_ms >= 60000 then v_status := 'ready';
    elsif v_status = 'elsewhere' and not coalesce(v_owned,false) and p_action <> 'takeover' then null;
    else
      if not coalesce(v_owned,false) or v_lease.token is null or v_lease.expires_at <= v_now or p_action='takeover' then
        v_lease.token := gen_random_uuid(); v_lease.sequence := 0;
        v_lease.last_checkpoint_at := v_now; v_lease.expires_at := v_now + interval '15 seconds';
      end if;
      v_lease.devotional_id := p_devotional_id; v_lease.client_id := p_client_id; v_lease.session_id := v_session;
      v_status := 'active';
    end if;
  elsif p_action in ('checkpoint','pause') then
    if not coalesce(v_owned,false) or p_token is null or v_lease.token is distinct from p_token then
      v_status := case when v_status='elsewhere' then 'elsewhere' else 'paused' end;
    elsif p_action = 'pause' then
      -- Never credit an unconfirmed tail after visibility was lost.
      v_lease.token := null; v_lease.expires_at := null; v_status := 'paused';
    elsif p_sequence = v_lease.sequence then v_status := 'active'; -- idempotent replay, zero credit
    elsif p_sequence is distinct from v_lease.sequence + 1 then v_status := 'out_of_order';
    else
      v_delta := floor(extract(epoch from (v_now - v_lease.last_checkpoint_at)) * 1000);
      -- Reject suspended/offline gaps; never cap a long gap into free credit.
      if v_delta between 0 and 10000 and v_lease.expires_at >= v_now then
        update public.reading_progress set credited_ms=least(60000,credited_ms+v_delta),updated_at=v_now
          where user_id=v_user and devotional_id=p_devotional_id returning * into v_progress;
        v_status := 'active';
      else v_status := 'gap'; end if;
      v_lease.sequence := p_sequence; v_lease.last_checkpoint_at := v_now; v_lease.expires_at := v_now + interval '15 seconds';
    end if;
  elsif p_action = 'complete' then
    if v_progress.credited_ms < 60000 then v_status := 'too_early';
    else
      insert into public.devotional_completions (user_id,source_devotional_id,devotional_id,revision,completed_at,completed_day)
        values (v_user,p_devotional_id,p_devotional_id,v_revision,v_now,(v_now at time zone 'America/Sao_Paulo')::date)
        on conflict (user_id,source_devotional_id) do nothing returning * into v_completion;
      v_status := 'completed';
      if v_lease.devotional_id = p_devotional_id then v_lease.token := null; end if;
    end if;
  elsif p_action <> 'state' then raise exception 'Invalid reading operation' using errcode='22023';
  end if;
  if v_progress.credited_ms >= 60000 and v_status not in ('completed','revision_changed') then
    v_status := 'ready';
    if v_lease.devotional_id = p_devotional_id then v_lease.token := null; end if;
  end if;
  update private.reading_leases set devotional_id=v_lease.devotional_id,session_id=v_lease.session_id,
    client_id=v_lease.client_id,token=v_lease.token,sequence=v_lease.sequence,
    last_checkpoint_at=v_lease.last_checkpoint_at,expires_at=v_lease.expires_at where user_id=v_user;
  return jsonb_build_object('status',v_status,'devotional_id',p_devotional_id,'revision',v_revision,
    'credited_ms',v_progress.credited_ms,'revision_changed',v_changed,
    'token',case when v_status in ('active','gap','out_of_order') and coalesce(v_owned,false) or v_status='active' then v_lease.token end,
    'sequence',case when v_status in ('active','gap','out_of_order') then v_lease.sequence end,
    'completed_at',v_completion.completed_at,'completed_day',v_completion.completed_day);
end;
$$;
alter function private.reading_operation(uuid,text,uuid,bigint,uuid,bigint) owner to selah_reading_owner;
revoke all on function private.reading_operation(uuid,text,uuid,bigint,uuid,bigint) from public,anon,authenticated,service_role;

create function public.get_my_reading_state(p_devotional_id uuid) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'state'); $$;
create function public.start_reading(p_devotional_id uuid,p_client_id uuid,p_revision bigint) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'start',p_client_id,p_revision); $$;
create function public.take_over_reading(p_devotional_id uuid,p_client_id uuid,p_revision bigint) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'takeover',p_client_id,p_revision); $$;
create function public.checkpoint_reading(p_devotional_id uuid,p_client_id uuid,p_token uuid,p_sequence bigint) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'checkpoint',p_client_id,null,p_token,p_sequence); $$;
create function public.pause_reading(p_devotional_id uuid,p_client_id uuid,p_token uuid) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'pause',p_client_id,null,p_token); $$;
create function public.complete_devotional(p_devotional_id uuid) returns jsonb
language sql security definer set search_path='' as $$ select private.reading_operation(p_devotional_id,'complete'); $$;

alter function public.get_my_reading_state(uuid) owner to selah_reading_owner;
alter function public.start_reading(uuid,uuid,bigint) owner to selah_reading_owner;
alter function public.take_over_reading(uuid,uuid,bigint) owner to selah_reading_owner;
alter function public.checkpoint_reading(uuid,uuid,uuid,bigint) owner to selah_reading_owner;
alter function public.pause_reading(uuid,uuid,uuid) owner to selah_reading_owner;
alter function public.complete_devotional(uuid) owner to selah_reading_owner;
revoke all on function public.get_my_reading_state(uuid),public.start_reading(uuid,uuid,bigint),public.take_over_reading(uuid,uuid,bigint),
  public.checkpoint_reading(uuid,uuid,uuid,bigint),public.pause_reading(uuid,uuid,uuid),public.complete_devotional(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.get_my_reading_state(uuid),public.start_reading(uuid,uuid,bigint),public.take_over_reading(uuid,uuid,bigint),
  public.checkpoint_reading(uuid,uuid,uuid,bigint),public.pause_reading(uuid,uuid,uuid),public.complete_devotional(uuid) to authenticated;

revoke create on schema public, private from selah_reading_owner;
revoke selah_reading_owner from postgres;

commit;
