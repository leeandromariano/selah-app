-- Synthetic accounts only. Run locally after the migration; always rolls back.
begin;
create function pg_temp.assert_true(value boolean) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion failed'; end if; end; $$;
create function pg_temp.denied(stmt text) returns void language plpgsql as $$ begin begin execute stmt; exception when insufficient_privilege or check_violation then return; end; raise exception 'Expected denial'; end; $$;
insert into auth.users (id,email,email_confirmed_at,raw_user_meta_data) values
 ('dd000000-0000-4000-8000-000000000001','annotation-a@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20))),
 ('dd000000-0000-4000-8000-000000000002','annotation-b@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20)));
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('dd000000-0000-4000-8000-000000000003','annotation-google@example.invalid',now(),'{"provider":"google"}'::jsonb,'{}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.bible_personal_annotations (translation,book,chapter,verse_start,verse_end,color,note) values ('nvt','genesis',1,1,1,'yellow','Nota fictícia');
select pg_temp.assert_true((select count(*)=1 from public.bible_personal_annotations));
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from public.bible_personal_annotations));
select pg_temp.denied($q$insert into public.bible_personal_annotations(user_id,translation,book,chapter,verse_start,verse_end,color) values ('dd000000-0000-4000-8000-000000000001','nvt','genesis',1,2,2,'pink')$q$);
update public.bible_personal_annotations set note='Tentativa fictícia' where user_id='dd000000-0000-4000-8000-000000000001';
delete from public.bible_personal_annotations where user_id='dd000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=1 and bool_and(note='Nota fictícia') from public.bible_personal_annotations));
update public.bible_personal_annotations set color='blue' where user_id='dd000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select bool_and(color='blue') from public.bible_personal_annotations));
delete from public.bible_personal_annotations where user_id='dd000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.bible_personal_annotations));
reset role;
set local role anon;
select pg_temp.denied('select * from public.bible_personal_annotations');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"dd000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.assert_true(private.google_onboarding_pending());
select pg_temp.denied($q$insert into public.bible_personal_annotations(translation,book,chapter,verse_start,verse_end,color) values ('nvt','genesis',1,1,1,'yellow')$q$);
reset role;
rollback;
