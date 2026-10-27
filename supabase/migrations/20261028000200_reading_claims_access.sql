begin;

-- Supabase postgres cannot delegate USAGE on the managed auth schema.
-- Expose only request identity to the NOLOGIN protocol role, never Auth tables.
create function private.reading_identity() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('sub',auth.uid(),'session_id',auth.jwt()->>'session_id');
$$;
alter function private.reading_identity() owner to postgres;
revoke all on function private.reading_identity() from public,anon,authenticated,service_role;
grant execute on function private.reading_identity() to selah_reading_owner;

grant selah_reading_owner to postgres;
grant create on schema private to selah_reading_owner;
create or replace function private.reading_operation(p_devotional_id uuid, p_action text, p_client_id uuid default null,
  p_revision bigint default null, p_token uuid default null, p_sequence bigint default null)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_user uuid := (private.reading_identity()->>'sub')::uuid;
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
  v_session := nullif(private.reading_identity()->>'session_id','')::uuid;
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

alter policy reading_progress_protocol on public.reading_progress using (user_id=(private.reading_identity()->>'sub')::uuid) with check (user_id=(private.reading_identity()->>'sub')::uuid);
alter policy reading_leases_protocol on private.reading_leases using (user_id=(private.reading_identity()->>'sub')::uuid) with check (user_id=(private.reading_identity()->>'sub')::uuid);
alter policy reading_completions_protocol on public.devotional_completions using (user_id=(private.reading_identity()->>'sub')::uuid) with check (user_id=(private.reading_identity()->>'sub')::uuid);
revoke create on schema private from selah_reading_owner;
revoke selah_reading_owner from postgres;
commit;
