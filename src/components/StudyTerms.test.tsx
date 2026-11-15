import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudyChips, StudySheet, TermText } from './StudyTerms'
import { StudyTermsManager } from './StudyTermsManager'
import { createStudyRepository } from '../study/repository'
import type { OwnerStudyTerm, StudyTerm } from '../study/repository'
import { supabase } from '../lib/supabase'

const grace: StudyTerm = { id: 'g', term: 'Graça', words: ['graça'], original: 'Do grego charis (fictício).', context: 'Contexto fictício da época.', parallel_reference: 'Romanos 11:6', verses: [{ start: 8, end: 8 }] }
afterEach(() => vi.restoreAllMocks())

describe('Raio-X do Texto: leitor', () => {
  it('o termo sublinhado abre a gaveta sem selecionar o versículo; fora dos versículos ligados não marca nada', () => {
    const onOpen = vi.fn(), outer = vi.fn()
    render(<button type="button" onClick={outer}><TermText text="Pela graça somos salvos" terms={[grace]} number={8} onOpen={onOpen} /></button>)
    fireEvent.click(screen.getByRole('button', { name: 'Raio-X: Graça' }))
    expect(onOpen).toHaveBeenCalledWith(grace)
    expect(outer).not.toHaveBeenCalled()
    render(<p>{<TermText text="Pela graça somos salvos" terms={[grace]} number={9} onOpen={onOpen} />}</p>)
    expect(screen.getAllByRole('button', { name: 'Raio-X: Graça' })).toHaveLength(1)
  })
  it('o termo também abre pelo teclado (Enter e Espaço) e pelos chips do capítulo', async () => {
    const onOpen = vi.fn()
    render(<><StudyChips terms={[grace]} onOpen={onOpen} /><TermText text="a graça" terms={[grace]} number={8} onOpen={onOpen} /></>)
    const inline = screen.getByRole('button', { name: 'Raio-X: Graça' })
    fireEvent.keyDown(inline, { key: 'Enter' }); fireEvent.keyDown(inline, { key: ' ' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Graça' }))
    expect(onOpen).toHaveBeenCalledTimes(3)
  })
  it('sem termos publicados no capítulo os chips não aparecem', () => {
    const { container } = render(<StudyChips terms={[]} onOpen={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('a gaveta mostra o original, o contexto e o versículo paralelo, e fecha com Esc, botão ou fundo', async () => {
    const onClose = vi.fn()
    render(<StudySheet term={grace} onClose={onClose} />)
    const dialog = screen.getByRole('dialog', { name: 'Graça' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(within(dialog).getByText('Do grego charis (fictício).')).toBeVisible()
    expect(within(dialog).getByText('Contexto fictício da época.')).toBeVisible()
    expect(within(dialog).getByText('Romanos 11:6')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Fechar Raio-X' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Fechar Raio-X' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})

describe('Raio-X do Texto: aba lateral no computador', () => {
  it('no computador vira aba à direita, sem fundo bloqueando a leitura, e libera o espaço ao fechar', () => {
    const original = window.matchMedia
    window.matchMedia = (() => ({ media: '(max-width: 900px)', matches: false, addEventListener: () => {}, removeEventListener: () => {} })) as never
    try {
      const { unmount } = render(<StudySheet term={grace} onClose={vi.fn()} />)
      const dialog = screen.getByRole('dialog', { name: 'Graça' })
      expect(dialog).toHaveAttribute('data-docked', 'true')
      expect(dialog).toHaveAttribute('aria-modal', 'false')
      expect(document.querySelector('.study-backdrop')).toBeNull()
      expect(document.body).toHaveClass('study-docked')
      unmount()
      expect(document.body).not.toHaveClass('study-docked')
    } finally { window.matchMedia = original }
  })
})

describe('Raio-X do Texto: repositório', () => {
  it('descarta termos fora do formato e devolve vazio em erro, sem quebrar a leitura', async () => {
    const repo = createStudyRepository(supabase)
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [grace, { id: 'x', term: '' }, null], error: null } as never)
    expect((await repo.chapter('efesios', 2)).map(term => term.term)).toEqual(['Graça'])
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { code: '42501' } } as never)
    expect(await repo.chapter('efesios', 2)).toEqual([])
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('get_study_terms', { p_book: 'efesios', p_chapter: 2 })
  })
})

describe('Raio-X do Texto: painel OWNER', () => {
  const draft: OwnerStudyTerm = { ...grace, status: 'draft', verses: [{ book: 'efesios', chapter: 2, start: 8, end: 8 }] }
  function respond(list: OwnerStudyTerm[]) {
    vi.mocked(supabase.rpc).mockImplementation(((name: string) => name === 'owner_list_study_terms' ? Promise.resolve({ data: list, error: null }) : Promise.resolve({ data: 'id', error: null })) as never)
  }
  it('lista os termos com a situação e publica um rascunho', async () => {
    respond([draft])
    render(<StudyTermsManager />)
    expect(await screen.findByText('Graça')).toBeVisible()
    expect(screen.getByText('Rascunho')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_term', expect.objectContaining({ p_id: 'g', p_status: 'published', p_verses: [{ book: 'efesios', chapter: 2, start: 8, end: 8 }] })))
    expect(await screen.findByText('Termo publicado.')).toBeVisible()
  })
  it('valida os versículos digitados antes de salvar e salva com o formato correto', async () => {
    respond([])
    const user = userEvent.setup()
    render(<StudyTermsManager />)
    await user.click(await screen.findByRole('button', { name: '+ Novo termo' }))
    await user.type(screen.getByLabelText(/Termo \(título/), 'Aliança')
    await user.type(screen.getByLabelText(/Palavras que ficam/), 'aliança, alianças')
    await user.type(screen.getByLabelText('No original'), 'Do hebraico berit (fictício).')
    await user.type(screen.getByLabelText(/Na época/), 'Contexto fictício.')
    await user.type(screen.getByLabelText('Versículo paralelo'), 'Hebreus 8:10')
    await user.type(screen.getByLabelText(/Versículos onde vale/), 'Livro Inexistente 1:1')
    await user.click(screen.getByRole('button', { name: 'Salvar termo' }))
    expect(await screen.findByText(/Versículo inválido: "Livro Inexistente 1:1"/)).toBeVisible()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('owner_save_study_term', expect.anything())
    await user.clear(screen.getByLabelText(/Versículos onde vale/))
    await user.type(screen.getByLabelText(/Versículos onde vale/), 'Gênesis 15:18{Enter}Êxodo 24:8-9')
    await user.click(screen.getByRole('button', { name: 'Salvar termo' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_term', expect.objectContaining({
      p_id: null, p_term: 'Aliança', p_words: ['aliança', 'alianças'], p_status: 'draft',
      p_verses: [{ book: 'genesis', chapter: 15, start: 18, end: 18 }, { book: 'exodo', chapter: 24, start: 8, end: 9 }],
    })))
  })
  it('importa em lote: confere antes, ignora os que já existem e envia só os válidos como rascunho', async () => {
    respond([draft])
    const user = userEvent.setup()
    render(<StudyTermsManager />)
    await screen.findByText('Graça')
    await user.click(screen.getByRole('button', { name: 'Importar em lote' }))
    const file = JSON.stringify([
      { term: 'Graça', words: ['graça'], original: 'o', context: 'c', parallel_reference: 'Romanos 11:6', verses: ['Efésios 2:8'] },
      { term: 'Aliança', words: ['aliança'], original: 'o', context: 'c', parallel_reference: 'Hebreus 8:10', verses: ['Gênesis 15:18'] },
      { term: 'Ruim', words: ['x'], original: 'o', context: 'c', parallel_reference: 'João 1:1', verses: ['Nada 1:1'] },
    ])
    fireEvent.change(screen.getByLabelText('Ou cole aqui'), { target: { value: file } })
    await user.click(screen.getByRole('button', { name: 'Conferir' }))
    await waitFor(() => expect(document.querySelector('.study-import [role=status]')?.textContent).toMatch(/2 termo.s. válido.s., 1 com problema, 1 já existe/))
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('owner_save_study_term', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Importar 1 termo(s) como rascunho' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_term', expect.objectContaining({ p_id: null, p_term: 'Aliança', p_status: 'draft' })))
    expect(vi.mocked(supabase.rpc).mock.calls.filter(call => call[0] === 'owner_save_study_term')).toHaveLength(1)
    expect(await screen.findByText('Importação concluída: 1 novo(s) como rascunho, 0 atualizado(s), 1 já existente(s) ignorado(s).')).toBeVisible()
  })
  it('publica e despublica vários termos de uma vez', async () => {
    const other: OwnerStudyTerm = { ...draft, id: 'h', term: 'Fé', words: ['fé'] }
    respond([draft, other])
    const user = userEvent.setup()
    render(<StudyTermsManager />)
    await screen.findByText('Fé')
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    await user.click(screen.getByRole('button', { name: 'Publicar selecionados (2)' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.filter(call => call[0] === 'owner_save_study_term')).toHaveLength(2))
    expect(vi.mocked(supabase.rpc).mock.calls.filter(call => call[0] === 'owner_save_study_term').every(call => (call[1] as { p_status: string }).p_status === 'published')).toBe(true)
    expect(await screen.findByText('2 termo(s) publicado(s).')).toBeVisible()
  })
})
