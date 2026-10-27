begin read only;
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where (table_schema = 'public' and table_name in ('profiles','devotionals','devotional_views','privacy_notice_versions','privacy_acknowledgements','account_deletion_requests','account_usernames','feedback_contact_preferences'))
or (table_schema = 'auth' and table_name in ('users','sessions','refresh_tokens','audit_log_entries','identities'))
order by table_schema, table_name, ordinal_position;
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies where schemaname in ('public','private');
select event_object_table, trigger_name, action_statement from information_schema.triggers
where event_object_schema = 'public' or (event_object_schema='auth' and event_object_table='users');
select conrelid::regclass as object, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in ('public.profiles'::regclass,'public.devotionals'::regclass,'public.devotional_views'::regclass,'public.account_usernames'::regclass,'public.feedback_contact_preferences'::regclass);
select n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='private' and p.proname in ('reserve_signup_username','normalize_account_username','normalize_profile_whatsapp','signup_whatsapp_profile','revoke_feedback_on_phone_change','strip_whatsapp_intake'))
or (n.nspname='public' and p.proname='set_feedback_contact');
select version from supabase_migrations.schema_migrations order by version;
rollback;
