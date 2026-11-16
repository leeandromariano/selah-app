-- Raio-X do Texto: quais capítulos de um livro têm termos PUBLICADOS, para marcar no seletor de capítulos da Bíblia.
-- Só devolve números de capítulo (nada do conteúdo dos termos). Mesmo padrão: security definer, só usuário autenticado.

create function public.get_study_chapters(p_book text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_book is null or p_book !~ '^[a-z0-9-]{2,30}$' then raise exception 'Invalid book' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(c.chapter order by c.chapter)
    from (
      select distinct v.chapter
      from public.study_term_verses v
      join public.study_terms t on t.id = v.term_id
      where t.status = 'published' and v.book = p_book
    ) c
  ), '[]'::jsonb);
end $$;
alter function public.get_study_chapters(text) owner to postgres;
revoke all on function public.get_study_chapters(text) from public, anon, authenticated, service_role;
grant execute on function public.get_study_chapters(text) to authenticated;
