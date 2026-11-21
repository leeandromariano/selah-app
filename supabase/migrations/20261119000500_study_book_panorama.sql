-- Raio-X do Texto: "Panorama" de cada livro da Bíblia. Uma ficha curta (autor, para quem foi escrito, contexto em uma frase e
-- tema central) mostrada antes do capítulo 1, só no modo Estudo. O leitor só recebe o que está publicado; o OWNER edita e publica.
-- Mesmo padrão do projeto: RLS ligado, nenhum acesso direto, tudo por funções security definer.

create table public.study_book_panoramas (
  book text primary key check (book ~ '^[a-z0-9-]{2,30}$'),
  author text not null check (char_length(btrim(author)) between 1 and 200),
  audience text not null check (char_length(btrim(audience)) between 1 and 200),
  context text not null check (char_length(btrim(context)) between 1 and 300),
  theme text not null check (char_length(btrim(theme)) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.study_book_panoramas enable row level security;
revoke all on public.study_book_panoramas from public, anon, authenticated, service_role;

-- Leitor: o panorama PUBLICADO do livro, ou nulo.
create function public.get_study_panorama(p_book text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_book is null or p_book !~ '^[a-z0-9-]{2,30}$' then raise exception 'Invalid book' using errcode = '22023'; end if;
  return (select jsonb_build_object('book', p.book, 'author', p.author, 'audience', p.audience, 'context', p.context, 'theme', p.theme)
          from public.study_book_panoramas p where p.book = p_book and p.status = 'published');
end $$;
alter function public.get_study_panorama(text) owner to postgres;
revoke all on function public.get_study_panorama(text) from public, anon, authenticated, service_role;
grant execute on function public.get_study_panorama(text) to authenticated;

-- OWNER: lista todos (rascunhos e publicados).
create function public.owner_list_study_panoramas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  return coalesce((
    select jsonb_agg(jsonb_build_object('book', p.book, 'author', p.author, 'audience', p.audience, 'context', p.context,
                                        'theme', p.theme, 'status', p.status) order by p.book)
    from public.study_book_panoramas p
  ), '[]'::jsonb);
end $$;
alter function public.owner_list_study_panoramas() owner to postgres;
revoke all on function public.owner_list_study_panoramas() from public, anon, authenticated, service_role;
grant execute on function public.owner_list_study_panoramas() to authenticated;

-- OWNER: cria ou atualiza o panorama de um livro (um por livro).
create function public.owner_save_study_panorama(
  p_book text, p_author text, p_audience text, p_context text, p_theme text, p_status text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  if p_status is null or p_status not in ('draft', 'published') then raise exception 'Invalid status' using errcode = '22023'; end if;
  if p_book is null or p_book !~ '^[a-z0-9-]{2,30}$' then raise exception 'Invalid book' using errcode = '22023'; end if;
  insert into public.study_book_panoramas(book, author, audience, context, theme, status)
  values (p_book, btrim(p_author), btrim(p_audience), btrim(p_context), btrim(p_theme), p_status)
  on conflict (book) do update set author = excluded.author, audience = excluded.audience, context = excluded.context,
    theme = excluded.theme, status = excluded.status, updated_at = clock_timestamp();
end $$;
alter function public.owner_save_study_panorama(text, text, text, text, text, text) owner to postgres;
revoke all on function public.owner_save_study_panorama(text, text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.owner_save_study_panorama(text, text, text, text, text, text) to authenticated;

create function public.owner_delete_study_panorama(p_book text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.owner_identity();
  delete from public.study_book_panoramas where book = p_book;
end $$;
alter function public.owner_delete_study_panorama(text) owner to postgres;
revoke all on function public.owner_delete_study_panorama(text) from public, anon, authenticated, service_role;
grant execute on function public.owner_delete_study_panorama(text) to authenticated;
