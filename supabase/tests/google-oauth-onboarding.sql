-- LOCAL PostgreSQL only: all synthetic accounts and rows rolled back.
-- NEVER execute on Supabase STAGING or any remotely linked database.
\set ON_ERROR_STOP on
begin;

create function pg_temp.ok(value boolean, label text) returns void
language plpgsql as $$
begin
  if value is distinct from true then raise exception 'FAIL: %', label; end if;
end $$;

create function pg_temp.denied(statement text, label text) returns void
language plpgsql as $$
begin
  begin execute statement;
  exception when sqlstate '42501' then return;
  end;
  raise exception 'FAIL: expected denial: %', label;
end $$;

create temp table oauth_fixture(id uuid primary key, username text);
insert into oauth_fixture(id,username) values(gen_random_uuid(), 'google_fixture_01');

-- Every normal email account still requires username and WhatsApp immediately.
create function pg_temp.invalid_email_signup() returns void language plpgsql as $$
begin
  begin
    insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
    values (gen_random_uuid(),'bad-email-oauth@example.invalid',clock_timestamp(),
      '{"provider":"email","providers":["email"]}'::jsonb,'{}'::jsonb);
  exception when sqlstate '23514' then return;
  end;
  raise exception 'FAIL: email signup without username was accepted';
end $$;
select pg_temp.invalid_email_signup();

-- Google OAuth starts pending, with NO automatically guessed username/contact.
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
select id,'google-fixture-'||id||'@example.invalid',clock_timestamp(),
  '{"provider":"google","providers":["google"]}'::jsonb,
  '{"full_name":"Fictitious Google User","username":"must_not_autoclaim","whatsapp":"+5511999990000","feedback_contact_allowed":true}'::jsonb
from oauth_fixture;

select pg_temp.ok((select count(*)=0 from public.account_usernames
  where user_id in (select id from oauth_fixture)), 'Google provider metadata must not autoclaim username');
select pg_temp.ok((select count(*)=0 from public.profiles
  where id in (select id from oauth_fixture)), 'Google does not fabricate contact');
select pg_temp.ok((select count(*)=0 from public.feedback_contact_preferences
  where user_id in (select id from oauth_fixture)), 'Google does not grant contact consent');
select pg_temp.ok((select count(*)=1 from auth.users
  where id in (select id from oauth_fixture)
    and not (raw_user_meta_data ? 'whatsapp')
    and not (raw_user_meta_data ? 'feedback_contact_allowed')),
  'unexpected contact data is removed from Auth metadata');
select pg_temp.ok(not has_function_privilege('anon',
 'public.complete_google_onboarding(text,text,text,boolean)', 'EXECUTE'),
 'anonymous cannot complete signup');

-- A published devotional exists so the pending-reader RLS check is meaningful.
insert into public.devotionals(title,bible_reference,bible_text,content,reflection_question,
 status,publish_at,author_id,author_name)
values('OAuth Published Fixture','Salmos 46:10','Texto fictício','Reflexão fictícia',
 'Pergunta fictícia?','published',clock_timestamp()-interval '1 hour',
 (select user_id from private.app_owner limit 1),'Autoria Fictícia');

select set_config('request.jwt.claims',jsonb_build_object(
  'sub',(select id from oauth_fixture limit 1),'role','authenticated')::text,true);
set local role authenticated;
select pg_temp.ok(public.get_my_google_onboarding_status()='pending',
 'new Google account is pending');
select pg_temp.ok((select count(*)=0 from public.devotionals
  where title='OAuth Published Fixture'), 'pending Google reader sees no publications');
-- Invalid fields are checked separately as 23514, not as an auth denial.
reset role;

create function pg_temp.invalid_google_input() returns void language plpgsql as $$
begin
  begin
    perform public.complete_google_onboarding('bad username','+5511999990000',null,false);
  exception when sqlstate '23514' then return;
  end;
  raise exception 'FAIL: invalid username accepted';
end $$;
set local role authenticated;
select pg_temp.invalid_google_input();
select public.complete_google_onboarding('google_fixture_01','+5511999990000',null,false);
select pg_temp.ok(public.get_my_google_onboarding_status()='complete',
 'onboarding completed atomically');
select pg_temp.ok((select count(*)=1 from public.devotionals
  where title='OAuth Published Fixture'), 'reader content enabled after completing signup');
select pg_temp.denied($q$select public.complete_google_onboarding(
 'google_fixture_02','+5511999990000',null,true)$q$,
 'cannot overwrite a completed signup');
reset role;

select pg_temp.ok((select count(*)=1 from public.account_usernames
  where username='google_fixture_01' and user_id in(select id from oauth_fixture)),
  'registered username persists');
select pg_temp.ok((select count(*)=1 from public.profiles
  where phone='+5511999990000' and whatsapp_required
    and id in(select id from oauth_fixture)), 'normalized required WhatsApp persists');
select pg_temp.ok((select count(*)=1 from public.feedback_contact_preferences
  where user_id in(select id from oauth_fixture) and allowed=false),
  'feedback opt-in not invented by Google metadata');
select pg_temp.ok((select count(*)=0 from private.admin_users
  where user_id in(select id from oauth_fixture)),
  'Google onboarding never grants ADMIN privileges');
select pg_temp.ok((select count(*)=0 from private.app_owner
  where user_id in(select id from oauth_fixture)),
  'Google onboarding never grants OWNER privileges');

rollback;
select 'Google OAuth onboarding checks passed; all fixtures rolled back.' as result;
