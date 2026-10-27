begin;
-- Operator-only journal. No client/API access; no automatic owner assignment.
-- UUIDs deliberately have no FK: retain the audit after account deletion.
create table private.owner_provision_audit (
  event_id uuid primary key default gen_random_uuid(),
  recorded_at timestamptz not null default clock_timestamp(),
  action text not null check (action in ('grant','revoke','transfer')),
  previous_user_id uuid,
  next_user_id uuid,
  audit_ref text not null unique check (audit_ref ~ '^LOCAL-[A-Za-z0-9_-]{8,80}$'),
  database_actor name not null default session_user,
  constraint owner_audit_transition check (
    (action='grant' and previous_user_id is null and next_user_id is not null) or
    (action='revoke' and previous_user_id is not null and next_user_id is null) or
    (action='transfer' and previous_user_id is not null and next_user_id is not null and previous_user_id<>next_user_id)
  )
);
alter table private.owner_provision_audit enable row level security;
revoke all on private.owner_provision_audit from public,anon,authenticated,service_role;
commit;
