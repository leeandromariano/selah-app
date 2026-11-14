begin;

-- Conclusão sem tempo mínimo, usada pelo devocional em etapas: o leitor conclui ao tocar em "Continuar e concluir" na última etapa.
-- A regra dos 60 segundos (private.reading_operation) continua valendo para o devocional direto e não foi alterada.
-- Só o próprio leitor, só devocional publicado, uma conclusão por devocional, e data e hora decididas pelo servidor
-- (nenhum argumento escolhe usuário, data ou horário).
create function private.complete_devotional_now(p_devotional_id uuid) returns jsonb
language plpgsql set search_path = '' as $$
declare
  v_user uuid := (private.reading_identity()->>'sub')::uuid;
  v_revision bigint;
  v_completion public.devotional_completions%rowtype;
  v_now timestamptz;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into v_completion from public.devotional_completions where user_id = v_user and source_devotional_id = p_devotional_id;
  if not found then
    select reading_revision into v_revision from public.devotionals where id = p_devotional_id
      and status = 'published' and publish_at <= clock_timestamp() for share;
    if not found then
      return jsonb_build_object('status', 'unavailable', 'devotional_id', p_devotional_id);
    end if;
    v_now := clock_timestamp();
    insert into public.devotional_completions (user_id, source_devotional_id, devotional_id, revision, completed_at, completed_day)
      values (v_user, p_devotional_id, p_devotional_id, v_revision, v_now, (v_now at time zone 'America/Sao_Paulo')::date)
      on conflict (user_id, source_devotional_id) do nothing returning * into v_completion;
    if not found then
      select * into v_completion from public.devotional_completions where user_id = v_user and source_devotional_id = p_devotional_id;
    end if;
  end if;
  return jsonb_build_object('status', 'completed', 'devotional_id', p_devotional_id, 'revision', v_completion.revision,
    'completed_at', v_completion.completed_at, 'completed_day', v_completion.completed_day);
end;
$$;

create function public.complete_devotional_now(p_devotional_id uuid) returns jsonb
language sql security definer set search_path = '' as $$ select private.complete_devotional_now(p_devotional_id); $$;

-- Preferência: as duas funções pertencem ao papel restrito do fluxo de leitura (selah_reading_owner), como as demais.
-- No Postgres 17 o postgres administra esse papel mas sem a opção SET, necessária para trocar o dono; ela e o CREATE nos schemas
-- são concedidos só durante a troca e retirados logo depois. Se o ambiente recusar a troca, as funções ficam com o dono atual
-- (postgres, dono das tabelas) e continuam funcionando: o papel restrito é uma camada extra de defesa, não uma condição.
do $$ begin
  begin
    grant selah_reading_owner to postgres with set true;
    grant create on schema public, private to selah_reading_owner;
    alter function private.complete_devotional_now(uuid) owner to selah_reading_owner;
    alter function public.complete_devotional_now(uuid) owner to selah_reading_owner;
  exception when others then
    raise notice 'Troca de dono não permitida neste ambiente; as funções ficam com o dono atual: %', sqlerrm;
  end;
end $$;

revoke all on function private.complete_devotional_now(uuid) from public, anon, authenticated, service_role;
revoke all on function public.complete_devotional_now(uuid) from public, anon, authenticated, service_role;
grant execute on function public.complete_devotional_now(uuid) to authenticated;

do $$ begin
  begin
    revoke create on schema public, private from selah_reading_owner;
    revoke set option for selah_reading_owner from postgres;
  exception when others then
    raise notice 'Limpeza dos privilégios temporários não necessária: %', sqlerrm;
  end;
end $$;

commit;
