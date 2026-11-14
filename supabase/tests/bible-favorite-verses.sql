-- Synthetic accounts only. Run locally after migration; all changes roll back.
begin;
create function pg_temp.assert_true(value boolean) returns void language plpgsql as $$ begin if value is distinct from true then raise exception 'Assertion failed'; end if; end; $$;
create function pg_temp.denied(stmt text) returns void language plpgsql as $$ begin begin execute stmt; exception when insufficient_privilege or check_violation then return; end; raise exception 'Expected denial'; end; $$;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('ee000000-0000-4000-8000-000000000001','favorite-a@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20))),
 ('ee000000-0000-4000-8000-000000000002','favorite-b@example.invalid',now(),jsonb_build_object('whatsapp','+5511999990000','username','sql_' || left(replace(gen_random_uuid()::text,'-',''),20)));
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)
values ('ee000000-0000-4000-8000-000000000003','favorite-google@example.invalid',now(),'{"provider":"google"}'::jsonb,'{}'::jsonb);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ee000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.bible_favorite_verses(translation,book,chapter,verse_start,verse_end) values ('nvt','genesis',1,1,1);
select pg_temp.assert_true((select count(*)=1 from public.bible_favorite_verses));
select set_config('request.jwt.claims','{"sub":"ee000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=0 from public.bible_favorite_verses));
select pg_temp.denied($q$insert into public.bible_favorite_verses(user_id,translation,book,chapter,verse_start,verse_end) values ('ee000000-0000-4000-8000-000000000001','nvt','genesis',1,2,2)$q$);
delete from public.bible_favorite_verses where user_id='ee000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"ee000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
select pg_temp.assert_true((select count(*)=1 from public.bible_favorite_verses));
delete from public.bible_favorite_verses where user_id='ee000000-0000-4000-8000-000000000001';
select pg_temp.assert_true((select count(*)=0 from public.bible_favorite_verses));
select set_config('request.jwt.claims','{"sub":"ee000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select pg_temp.assert_true(private.google_onboarding_pending());
select pg_temp.denied($q$insert into public.bible_favorite_verses(translation,book,chapter,verse_start,verse_end) values ('nvt','genesis',1,1,1)$q$);
reset role; set local role anon;
select pg_temp.denied('select * from public.bible_favorite_verses');
reset role; rollback;
