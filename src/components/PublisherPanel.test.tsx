import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { openMenu } from '../test/menu'
vi.mock('./BiblePassagePicker', () => ({ BiblePassagePicker: ({ onSelect }: { onSelect: (value: unknown) => void }) => <button type="button" onClick={() => onSelect({ translation: 'nvt', book: 'genesis', chapter: 1, verse: 1, endVerse: 1, reference: 'Gênesis 1:1' })}>Usar passagem fictícia</button> }))
vi.mock('../bible/editorialFeature', () => ({ bibleEditorialEnabled: true }))

function prepare(allowed: boolean) {
  window.location.hash = 'publicador'
  const userId = 'fictional-writer'
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: userId, user_metadata: {} } } }, error: null,
  } as never)
  vi.mocked(supabase.rpc).mockImplementation((name) => (
    name === 'get_my_discussion_access'
      ? { abortSignal: async () => ({ data: false, error: null }) }
      : Promise.resolve(name === 'get_my_publisher_access'
        ? { data: allowed, error: null }
        : { data: null, error: { code: '42501' } })
  ) as never)
  const query = {
    select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn(), single: vi.fn().mockResolvedValue({
      data: {
        id: 'fiction-draft', author_id: userId, author_name: 'Autora Fictícia',
        title: 'Reflexão para teste', bible_reference: 'João 14:27',
        bible_text: 'Texto bíblico fictício', content: 'Reflexão fictícia',
        reflection_question: 'Pergunta fictícia?', status: 'draft', publish_at: null,
        review_requested_at: null,
      }, error: null,
    }),
  }
  for (const key of ['select', 'eq', 'order', 'insert'] as const) query[key].mockReturnValue(query)
  vi.mocked(supabase.from).mockReturnValue(query as never)
  return query
}

describe('espaço editorial PUBLICADOR', () => {
  it('nega leitor e não mostra a navegação administrativa', async () => {
    const table = prepare(false)
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso restrito a PUBLICADORES')
    await openMenu()
    expect(screen.queryByRole('link', { name: 'Espaço PUBLICADOR' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Painel administrativo' })).not.toBeInTheDocument()
    expect(table.insert).not.toHaveBeenCalled()
  })
  it('apresenta somente editor próprio e exige crédito explícito de autor', async () => {
    const table = prepare(true)
    const user = userEvent.setup()
    render(<App />)
    await user.click(await screen.findByRole('button', { name: '+ Novo devocional' }))
    await openMenu()
    expect(screen.getByRole('link', { name: 'Espaço PUBLICADOR' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Painel administrativo' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Informe o nome do autor')
    expect(table.insert).not.toHaveBeenCalled()
    for (const [label, value] of [
      ['Autor (crédito público)', 'Autora Fictícia'],
      ['Título', 'Reflexão para teste'],
      ['Frase central para compartilhar', 'Cada pausa pode trazer esperança.'],
      ['Reflexão', 'Reflexão fictícia'],
      ['Para refletir', 'Pergunta fictícia?'],
      ['Prática Coram Deo', 'Faça uma pausa.'],
      ['Oração e resposta', 'Ore por paz.'],
    ]) await user.type(screen.getByLabelText(label), value)
    await user.click(screen.getByRole('button', { name: 'Selecionar passagem' }))
    await user.click(screen.getByRole('button', { name: 'Usar passagem fictícia' }))
    await user.click(screen.getByRole('button', { name: 'Salvar rascunho' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Rascunho salvo')
    expect(table.insert).toHaveBeenCalledWith(expect.objectContaining({
      author_id: 'fictional-writer', author_name: 'Autora Fictícia', share_phrase: 'Cada pausa pode trazer esperança.', status: 'draft', publish_at: null, bible_text: null, bible_reference: 'Gênesis 1:1', bible_selection: { translation: 'nvt', book: 'genesis', chapter: 1, verse: 1, endVerse: 1 },
    }))
  })
})
