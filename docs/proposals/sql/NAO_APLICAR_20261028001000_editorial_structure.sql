begin;
-- Estruturas privadas: somente RPCs revisadas sao expostas pela Data API.
create extension if not exists unaccent with schema extensions;
do $$ begin
  if to_regprocedure('extensions.unaccent(text)') is null then
    raise exception 'unaccent must be installed in extensions';
  end if;
end $$;
create table private.editorial_themes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  normalized_name text not null unique,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
  description text check (description is null or length(description)<=1000)
);
create table private.editorial_series (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug)<=120),
  description text check (description is null or length(description)<=2000),
  available boolean not null default false,
  responsible_user_id uuid references auth.users(id) on delete set null
);
create table private.editorial_devotional_themes (
  devotional_id uuid not null references public.devotionals(id) on delete cascade,
  theme_id uuid not null references private.editorial_themes(id) on delete restrict,
  primary key (devotional_id,theme_id)
);
create index editorial_devotional_themes_theme_idx on private.editorial_devotional_themes(theme_id,devotional_id);
create table private.editorial_episodes (
  series_id uuid not null references private.editorial_series(id) on delete restrict,
  devotional_id uuid not null unique references public.devotionals(id) on delete cascade,
  position integer not null check(position>0),
  primary key(series_id,devotional_id),
  constraint editorial_episode_position_unique unique(series_id,position) deferrable initially immediate
);
alter table private.editorial_themes enable row level security;
alter table private.editorial_series enable row level security;
alter table private.editorial_devotional_themes enable row level security;
alter table private.editorial_episodes enable row level security;
revoke all on private.editorial_themes,private.editorial_series,private.editorial_devotional_themes,private.editorial_episodes from public,anon,authenticated,service_role;

-- Normalizacao gravada por trigger; unaccent nao e declarado immutable.
create function private.editorial_theme_normalize() returns trigger language plpgsql set search_path='' as $$
begin
  new.name:=pg_catalog.regexp_replace(pg_catalog.btrim(new.name),'[[:space:]]+',' ','g');
  new.normalized_name:=extensions.unaccent(pg_catalog.lower(new.name));
  if new.normalized_name='' then raise exception 'Invalid theme name' using errcode='22023'; end if;
  return new;
end $$;
create trigger editorial_theme_normalize before insert or update of name,normalized_name on private.editorial_themes
for each row execute function private.editorial_theme_normalize();
create function private.editorial_slug_fixed() returns trigger language plpgsql set search_path='' as $$
begin if new.slug is distinct from old.slug then raise exception 'Slug is immutable' using errcode='23514'; end if; return new; end $$;
create trigger editorial_theme_slug before update of slug on private.editorial_themes for each row execute function private.editorial_slug_fixed();
create trigger editorial_series_slug before update of slug on private.editorial_series for each row execute function private.editorial_slug_fixed();
revoke all on function private.editorial_theme_normalize(),private.editorial_slug_fixed() from public,anon,authenticated,service_role;

-- Coordinacao candidata; implantacao depende de revisao e testes integrados.
-- Coordenacao por identidade para o caminho oficial de pedido de exclusao.
-- A checagem antecede o lock porque triggers BEFORE precedem a policy RLS.
create function private.editorial_deletion_identity_lock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Um pedido pertence a uma unica identidade durante toda a sua existencia.
  -- UPDATE/DELETE ja bloqueiam a linha do pedido antes da trigger: nao adquirir
  -- auth.users nessa ordem evita ciclo com a exclusao em cascata de auth.users.
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'Deletion request identity is immutable' using errcode = '23514';
    end if;
    return new;
  end if;
  if current_setting('role', true) in ('anon', 'authenticated')
     and (auth.uid() is null or auth.uid() is distinct from new.user_id) then
    raise exception 'Identity mismatch' using errcode = '42501';
  end if;
  perform 1 from auth.users where id = new.user_id for update;
  return new;
end $$;
alter function private.editorial_deletion_identity_lock() owner to postgres;
revoke all on function private.editorial_deletion_identity_lock() from public, anon, authenticated, service_role;
create trigger editorial_deletion_identity_lock before insert or update of user_id
  on public.account_deletion_requests for each row execute function private.editorial_deletion_identity_lock();

create function private.editorial_owner_lock() returns void language plpgsql security definer set search_path='' as $$
declare who uuid:=auth.uid();
begin
  if who is null then raise exception 'Owner required' using errcode='42501'; end if;
  perform private.owner_identity();
  perform 1 from auth.users where id=who for update;
  perform 1 from private.app_owner where user_id=who for share;
  perform private.owner_identity();
end $$;
alter function private.editorial_owner_lock() owner to postgres;
revoke all on function private.editorial_owner_lock() from public,anon,authenticated,service_role;

-- Explicit actions only. No SQL, identifiers, actors or authorization supplied by client.
create function public.owner_editorial_change(p_action text,p_data jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_series uuid; result uuid; n integer; ordered uuid[];
begin
  perform private.editorial_owner_lock();
  if p_data is null or jsonb_typeof(p_data)<>'object' or length(p_data::text)>16000 then raise exception 'Invalid input' using errcode='22023'; end if;
  case p_action
    when 'create_theme' then
      if p_data - array['name','slug','description'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      insert into private.editorial_themes(name,normalized_name,slug,description) values(p_data->>'name','',p_data->>'slug',p_data->>'description') returning editorial_themes.id into result;
    when 'update_theme' then
      if p_data - array['id','name','description'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      update private.editorial_themes t set name=p_data->>'name',description=p_data->>'description' where t.id=(p_data->>'id')::uuid returning t.id into result;
    when 'delete_theme' then
      if p_data - array['id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      delete from private.editorial_themes t where t.id=(p_data->>'id')::uuid returning t.id into result;
    when 'create_series' then
      if p_data - array['title','slug','description','available','responsible_user_id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      insert into private.editorial_series(title,slug,description,available,responsible_user_id) values(p_data->>'title',p_data->>'slug',p_data->>'description',coalesce((p_data->>'available')::boolean,false),(p_data->>'responsible_user_id')::uuid) returning editorial_series.id into result;
    when 'update_series' then
      if p_data - array['id','title','description','available','responsible_user_id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      update private.editorial_series s set title=p_data->>'title',description=p_data->>'description',available=(p_data->>'available')::boolean,responsible_user_id=(p_data->>'responsible_user_id')::uuid where s.id=(p_data->>'id')::uuid returning s.id into result;
    when 'delete_series' then
      if p_data - array['id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      delete from private.editorial_series s where s.id=(p_data->>'id')::uuid returning s.id into result;
    when 'attach_theme' then
      if p_data - array['devotional_id','theme_id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      insert into private.editorial_devotional_themes(devotional_id,theme_id) values((p_data->>'devotional_id')::uuid,(p_data->>'theme_id')::uuid) returning devotional_id into result;
    when 'detach_theme' then
      if p_data - array['devotional_id','theme_id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      delete from private.editorial_devotional_themes t where t.devotional_id=(p_data->>'devotional_id')::uuid and t.theme_id=(p_data->>'theme_id')::uuid returning t.devotional_id into result;
    when 'attach_episode' then
      if p_data - array['devotional_id','series_id','position'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      v_series:=(p_data->>'series_id')::uuid;
      perform 1 from private.editorial_series s where s.id=v_series for update;
      insert into private.editorial_episodes(series_id,devotional_id,position) values(v_series,(p_data->>'devotional_id')::uuid,(p_data->>'position')::integer) returning devotional_id into result;
    when 'detach_episode' then
      if p_data - array['devotional_id','series_id'] <> '{}'::jsonb then raise exception 'Invalid fields' using errcode='22023'; end if;
      v_series:=(p_data->>'series_id')::uuid;
      perform 1 from private.editorial_series s where s.id=v_series for update;
      delete from private.editorial_episodes e where e.series_id=v_series and e.devotional_id=(p_data->>'devotional_id')::uuid returning e.devotional_id into result;
    when 'reorder_series' then
      if p_data - array['series_id','devotional_ids'] <> '{}'::jsonb or jsonb_typeof(p_data->'devotional_ids')<>'array' or jsonb_array_length(p_data->'devotional_ids')>500 then raise exception 'Invalid fields' using errcode='22023'; end if;
      v_series:=(p_data->>'series_id')::uuid;
      perform 1 from private.editorial_series s where s.id=v_series for update;
      if not found then raise exception 'Series unavailable' using errcode='22023'; end if;
      select array_agg(value::uuid order by ordinality) into ordered from jsonb_array_elements_text(p_data->'devotional_ids') with ordinality;
      select count(*) into n from private.editorial_episodes e where e.series_id=v_series;
      if n<>coalesce(cardinality(ordered),0) or n<>(select count(distinct x) from unnest(ordered) x) or n<>(select count(*) from private.editorial_episodes e where e.series_id=v_series and e.devotional_id=any(ordered)) then raise exception 'Invalid ordering' using errcode='22023'; end if;
      set constraints private.editorial_episode_position_unique deferred;
      update private.editorial_episodes e set position=x.ordinality::integer from unnest(ordered) with ordinality x(devotional_id,ordinality) where e.series_id=v_series and e.devotional_id=x.devotional_id;
      set constraints private.editorial_episode_position_unique immediate;
      result:=v_series;
    else raise exception 'Invalid action' using errcode='22023';
  end case;
  if result is null then raise exception 'Target unavailable' using errcode='22023'; end if;
  return jsonb_build_object('id',result);
end $$;
alter function public.owner_editorial_change(text,jsonb) owner to postgres;
revoke all on function public.owner_editorial_change(text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.owner_editorial_change(text,jsonb) to authenticated;

-- Paginated reader results: each branch explicitly checks published and released.
create function public.reader_editorial_catalog(p_kind text,p_slug text default null,p_page integer default 0,p_size integer default 25)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_page is null or p_page<0 or p_page>10000 or p_size is null or p_size<1 or p_size>100 or (p_slug is not null and (length(p_slug)>120 or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$')) then raise exception 'Invalid pagination or slug' using errcode='22023'; end if;
  case p_kind
  when 'themes' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.name,q.id),'[]'::jsonb) into result from (
      select t.id,t.name,t.slug,t.description from private.editorial_themes t
      where exists(select 1 from private.editorial_devotional_themes dt join public.devotionals d on d.id=dt.devotional_id where dt.theme_id=t.id and d.status='published' and d.publish_at<=now())
      order by t.name,t.id limit p_size offset (p_page::bigint*p_size)) q;
  when 'series' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.title,q.id),'[]'::jsonb) into result from (
      select s.id,s.title,s.slug,s.description from private.editorial_series s
      where s.available and exists(select 1 from private.editorial_episodes e join public.devotionals d on d.id=e.devotional_id where e.series_id=s.id and d.status='published' and d.publish_at<=now())
      order by s.title,s.id limit p_size offset (p_page::bigint*p_size)) q;
  when 'series_detail' then
    if p_slug is null then raise exception 'Slug required' using errcode='22023'; end if;
    select coalesce((select to_jsonb(q) from (
      select s.id,s.title,s.slug,s.description from private.editorial_series s
      where s.slug=p_slug and s.available and exists(
        select 1 from private.editorial_episodes e join public.devotionals d on d.id=e.devotional_id
        where e.series_id=s.id and d.status='published' and d.publish_at<=now())) q),'null'::jsonb) into result;
  when 'episodes' then
    if p_slug is null then raise exception 'Slug required' using errcode='22023'; end if;
    select coalesce(jsonb_agg(to_jsonb(q) - 'sort_position' order by q.sort_position,q.id),'[]'::jsonb) into result from (
      select d.id,d.title,d.bible_reference,d.publish_at,e.position as sort_position
      from private.editorial_series s join private.editorial_episodes e on e.series_id=s.id join public.devotionals d on d.id=e.devotional_id
      where s.slug=p_slug and s.available and d.status='published' and d.publish_at<=now()
      order by e.position,d.id limit p_size offset (p_page::bigint*p_size)) q;
  when 'devotionals' then
    select coalesce(jsonb_agg(to_jsonb(q) order by q.publish_at desc,q.id desc),'[]'::jsonb) into result from (
      select d.id,d.title,d.bible_reference,d.bible_text,d.content,d.reflection_question,d.publish_at,d.reading_revision
      from public.devotionals d where d.status='published' and d.publish_at<=now() and
      (p_slug is null or exists(select 1 from private.editorial_devotional_themes dt join private.editorial_themes t on t.id=dt.theme_id where dt.devotional_id=d.id and t.slug=p_slug))
      order by d.publish_at desc,d.id desc limit p_size offset (p_page::bigint*p_size)) q;
  when 'series_devotionals' then
    if p_slug is null then raise exception 'Slug required' using errcode='22023'; end if;
    select coalesce(jsonb_agg(to_jsonb(q) order by q.publish_at desc,q.id desc),'[]'::jsonb) into result from (
      select d.id,d.title,d.bible_reference,d.bible_text,d.content,d.reflection_question,d.publish_at,d.reading_revision
      from public.devotionals d join private.editorial_episodes e on e.devotional_id=d.id join private.editorial_series s on s.id=e.series_id
      where s.slug=p_slug and s.available and d.status='published' and d.publish_at<=now()
      order by d.publish_at desc,d.id desc limit p_size offset (p_page::bigint*p_size)) q;
  else raise exception 'Invalid catalog' using errcode='22023';
  end case;
  return result;
end $$;
alter function public.reader_editorial_catalog(text,text,integer,integer) owner to postgres;
revoke all on function public.reader_editorial_catalog(text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.reader_editorial_catalog(text,text,integer,integer) to authenticated;
commit;
