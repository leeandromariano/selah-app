-- NEW disposable DB only. Committed synthetic rows permit independent connections.
\set ON_ERROR_STOP on
begin;
create temp table discussion_concurrent as select gen_random_uuid() who,gen_random_uuid() content,gen_random_uuid() owner_id,gen_random_uuid() reporter_id;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 select who,'dc-concurrent-'||who||'@example.invalid',now(),jsonb_build_object('username','dconc_'||left(replace(who::text,'-',''),16),'whatsapp','+5511999990000') from discussion_concurrent
 union all select owner_id,'dc-owner-'||owner_id||'@example.invalid',now(),jsonb_build_object('username','dco_'||left(replace(owner_id::text,'-',''),16),'whatsapp','+5511999990000') from discussion_concurrent
 union all select reporter_id,'dc-report-'||reporter_id||'@example.invalid',now(),jsonb_build_object('username','dcr_'||left(replace(reporter_id::text,'-',''),16),'whatsapp','+5511999990000') from discussion_concurrent;
insert into private.app_owner(user_id) select owner_id from discussion_concurrent;
-- Test-only helper in this disposable DB; captures the remote SQLSTATE while
-- keeping its transaction usable. Not a migration or an API capability.
create function private.discussion_test_approval(p_id uuid,p_version integer) returns text language plpgsql set search_path='' as $$
begin perform public.moderate_devotional_comment(p_id,p_version,'approve','reviewed');return 'accepted';
exception when others then return sqlstate;end $$;
revoke all on function private.discussion_test_approval(uuid,integer) from public,anon,authenticated,service_role;
insert into public.devotionals(id,title,bible_reference,bible_text,content,reflection_question,publish_at,status,author_id)
 select content,'Concurrency fictional','Ref','Text','Body','Question?',now()-interval '1 hour','published',who from discussion_concurrent;
commit;
select extensions.dblink_connect_u('dc_a','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_connect_u('dc_b','host=/tmp dbname=postgres user=postgres');
select extensions.dblink_exec('dc_a','begin');
select extensions.dblink_exec('dc_b','begin');
select extensions.dblink_exec('dc_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from discussion_concurrent;
select extensions.dblink_exec('dc_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from discussion_concurrent;
select * from discussion_concurrent x cross join lateral extensions.dblink('dc_a',format('select public.set_my_devotional_reaction(%L,%L)::text',x.content,'like')) t(value text);
-- Start second write while A holds the user transaction lock.
select extensions.dblink_send_query('dc_b',format('select public.set_my_devotional_reaction(%L,%L)::text',content,'dislike')) from discussion_concurrent;
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('dc_b')<>1 then raise exception 'FAIL: reaction was not serialized';end if;end$$;
select extensions.dblink_exec('dc_a','commit');
select * from extensions.dblink_get_result('dc_b') t(value text);
select * from extensions.dblink_get_result('dc_b') t(value text);
select extensions.dblink_exec('dc_b','commit');
do $$begin if (select count(*) from private.discussion_reactions where devotional_id=(select content from discussion_concurrent))<>1 then raise exception 'FAIL: duplicate reactions';end if;end$$;
select extensions.dblink_exec('dc_a','begin');
select extensions.dblink_exec('dc_b','begin');
select extensions.dblink_exec('dc_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from discussion_concurrent;
select extensions.dblink_exec('dc_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from discussion_concurrent;
select * from discussion_concurrent x cross join lateral extensions.dblink('dc_a',format('select public.save_my_devotional_comment(%L,%L,0)::text',x.content,'Fictional same desired text')) t(value text);
select extensions.dblink_send_query('dc_b',format('select public.save_my_devotional_comment(%L,%L,0)::text',content,'Fictional same desired text')) from discussion_concurrent;
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('dc_b')<>1 then raise exception 'FAIL: comment was not serialized';end if;end$$;
select extensions.dblink_exec('dc_a','commit');
select * from extensions.dblink_get_result('dc_b') t(value text);
select * from extensions.dblink_get_result('dc_b') t(value text);
select extensions.dblink_exec('dc_b','commit');
do $$begin if (select count(*) from private.discussion_comments where devotional_id=(select content from discussion_concurrent))<>1 then raise exception 'FAIL: duplicate principal comment';end if;end$$;

-- An author edits while the Owner tries to approve the stale version.
select extensions.dblink_exec('dc_a','begin');
select extensions.dblink_exec('dc_b','begin');
select extensions.dblink_exec('dc_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',who,'role','authenticated')::text)) from discussion_concurrent;
select extensions.dblink_exec('dc_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',owner_id,'role','authenticated')::text)) from discussion_concurrent;
select * from discussion_concurrent x cross join lateral extensions.dblink('dc_a',format('select public.save_my_devotional_comment(%L,%L,1)::text',x.content,'Concurrent revised fictional text')) t(value text);
select extensions.dblink_send_query('dc_b',format('select private.discussion_test_approval(%L,1)',(select id from private.discussion_comments where devotional_id=x.content))) from discussion_concurrent x;
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('dc_b')<>1 then raise exception 'FAIL: approval did not wait for author edit';end if;end$$;
select extensions.dblink_exec('dc_a','commit');
create temp table discussion_stale_result as select code from extensions.dblink_get_result('dc_b') t(code text);
select * from extensions.dblink_get_result('dc_b') t(code text);
select extensions.dblink_exec('dc_b','commit');
do $$begin if (select count(*)=1 and bool_and(code='40001') from discussion_stale_result) is distinct from true then raise exception 'FAIL: stale approval was accepted';end if;end$$;
do $$begin if not exists(select 1 from private.discussion_comments where devotional_id=(select content from discussion_concurrent) and version=2 and state='pending' and body='Concurrent revised fictional text') then raise exception 'FAIL: edited text was published';end if;end$$;

-- Approve the actual version, then two tabs report it as the same reader.
select set_config('request.jwt.claims',json_build_object('sub',owner_id,'role','authenticated')::text,false) from discussion_concurrent;
select public.moderate_devotional_comment(id,version,'approve','reviewed') from private.discussion_comments where devotional_id=(select content from discussion_concurrent);
select extensions.dblink_exec('dc_a','begin');
select extensions.dblink_exec('dc_b','begin');
select extensions.dblink_exec('dc_a',format('set local "request.jwt.claims"=%L',json_build_object('sub',reporter_id,'role','authenticated')::text)) from discussion_concurrent;
select extensions.dblink_exec('dc_b',format('set local "request.jwt.claims"=%L',json_build_object('sub',reporter_id,'role','authenticated')::text)) from discussion_concurrent;
select * from discussion_concurrent x cross join lateral extensions.dblink('dc_a',format('select public.report_devotional_comment(%L,%L)::text',(select id from private.discussion_comments where devotional_id=x.content),'contact')) t(value text);
select extensions.dblink_send_query('dc_b',format('select public.report_devotional_comment(%L,%L)::text',(select id from private.discussion_comments where devotional_id=x.content),'contact')) from discussion_concurrent x;
select pg_sleep(0.1);
do $$begin if extensions.dblink_is_busy('dc_b')<>1 then raise exception 'FAIL: duplicate report was not serialized';end if;end$$;
select extensions.dblink_exec('dc_a','commit');
select * from extensions.dblink_get_result('dc_b') t(value text);
select * from extensions.dblink_get_result('dc_b') t(value text);
select extensions.dblink_exec('dc_b','commit');
do $$begin if (select count(*) from private.discussion_reports where reporter_id=(select reporter_id from discussion_concurrent))<>1 then raise exception 'FAIL: duplicate reports persisted';end if;end$$;
do $$begin if (select coalesce(sum(uses),0) from private.discussion_limits where user_id=(select reporter_id from discussion_concurrent) and kind='report')<>1 then raise exception 'FAIL: report retry consumed quota twice';end if;end$$;
select extensions.dblink_disconnect('dc_a');select extensions.dblink_disconnect('dc_b');
select '10 discussion concurrency checks passed';
