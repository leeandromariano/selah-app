-- Candidate for disposable database testing ONLY. This is not a migration or
-- an operational entry point. External identity and email verification cannot
-- be established by this function; true is only a synthetic test attestation.
create function pg_temp.staging_owner_candidate(action text, target uuid, confirmed uuid, ref text, external_verified boolean)
returns void language plpgsql set search_path='' as $$
begin
  if action is null or action not in ('grant','revoke') or target is null or target is distinct from confirmed
    or ref is null or ref !~ '^STAGING-[A-Za-z0-9_-]{8,80}$'
    or external_verified is distinct from true then
    raise exception 'Invalid operator confirmation' using errcode='42501';
  end if;
  set local lock_timeout='5s';
  lock table private.app_owner in exclusive mode;
  lock table private.admin_users in share mode;
  lock table public.account_deletion_requests in share mode;
  if action='grant' then
    if exists(select 1 from private.app_owner) then
      raise exception 'Unexpected owner state' using errcode='42501';
    end if;
    perform 1 from auth.users u join private.admin_users a on a.user_id=u.id
      where u.id=target and u.email_confirmed_at is not null and u.deleted_at is null
        and not coalesce(u.is_anonymous,false)
        and (u.banned_until is null or u.banned_until<=clock_timestamp())
        and not exists(select 1 from public.account_deletion_requests d where d.user_id=u.id)
      for share of u;
    if not found then raise exception 'Ineligible account' using errcode='42501'; end if;
    insert into private.app_owner(user_id) values(target);
    insert into private.owner_provision_audit(action,next_user_id,audit_ref) values('grant',target,ref);
  else
    if (select count(*) from private.app_owner)<>1 or not exists(select 1 from private.app_owner where user_id=target) then
      raise exception 'Unexpected owner state' using errcode='42501';
    end if;
    delete from private.app_owner where user_id=target;
    insert into private.owner_provision_audit(action,previous_user_id,audit_ref) values('revoke',target,ref);
  end if;
end $$;
