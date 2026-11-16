import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BookPanorama } from './BookPanorama'
import { BibleReader } from './BibleReader'
import { StudyPanoramaManager } from './StudyPanoramaManager'
import { demoProvider } from '../bible/provider'
import { supabase } from '../lib/supabase'
import type { OwnerStudyPanorama, StudyPanorama } from '../study/repository'

vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))
const romanos: StudyPanorama = { book: 'romanos', author: 'Paulo', audience: 'Cristãos em Roma', context: 'Carta escrita por volta de 57 d.C.', theme: 'A justiça de Deus pela fé' }
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem('selah.bible.mode') })

describe('Panorama do livro: cartão', () => {
  it('vem recolhido e mostra as quatro partes da ficha quando aberto', async () => {
    const { container } = render(<BookPanorama bookName="Romanos" panorama={romanos} />)
    const details = container.querySelector('details')!
    expect(details.open).toBe(false)
    expect(screen.getByText('Romanos')).toBeInTheDocument()
    await userEvent.setup().click(screen.getByText('PANORAMA DO LIVRO'))
    expect(details.open).toBe(true)
    for (const [label, value] of [['Autor', 'Paulo'], ['Para quem foi escrito', 'Cristãos em Roma'], ['Contexto', 'Carta escrita por volta de 57 d.C.'], ['Tema central', 'A justiça de Deus pela fé']]) {
      expect(within(details).getByText(label)).toBeInTheDocument()
      expect(within(details).getByText(value)).toBeInTheDocument()
    }
  })
})

describe('Panorama do livro: leitor da Bíblia', () => {
  const answer = () => vi.mocked(supabase.rpc).mockImplementation(((name: string) => Promise.resolve({ data: name === 'get_study_panorama' ? { ...romanos, book: 'genesis' } : [], error: null })) as never)
  it('aparece só no modo Estudo e só no capítulo 1', async () => {
    answer()
    localStorage.setItem('selah.bible.mode', 'estudo')
    const view = render(<BibleReader page="biblia/demonstracao/genesis/1" source={demoProvider} />)
    expect(await screen.findByText('PANORAMA DO LIVRO')).toBeInTheDocument()
    expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('get_study_panorama', { p_book: 'genesis' })
    view.rerender(<BibleReader page="biblia/demonstracao/genesis/2" source={demoProvider} />)
    await screen.findByText(/Gênesis 2/)
    expect(screen.queryByText('PANORAMA DO LIVRO')).toBeNull()
  })
  it('no modo Apenas leitura não aparece nem é consultado', async () => {
    answer()
    render(<BibleReader page="biblia/demonstracao/genesis/1" source={demoProvider} />)
    await screen.findByText(/Texto fictício para demonstrar o primeiro/)
    expect(screen.queryByText('PANORAMA DO LIVRO')).toBeNull()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('get_study_panorama', expect.anything())
  })
  it('sem panorama publicado ou com falha, nada aparece e a leitura segue normal', async () => {
    localStorage.setItem('selah.bible.mode', 'estudo')
    render(<BibleReader page="biblia/demonstracao/genesis/1" source={demoProvider} />)
    expect(await screen.findByText(/Texto fictício para demonstrar o primeiro/)).toBeVisible()
    expect(screen.queryByText('PANORAMA DO LIVRO')).toBeNull()
  })
})

describe('Panorama dos livros: painel OWNER', () => {
  const draft: OwnerStudyPanorama = { ...romanos, status: 'draft' }
  function respond(list: OwnerStudyPanorama[]) {
    vi.mocked(supabase.rpc).mockImplementation(((name: string) => name === 'owner_list_study_panoramas' ? Promise.resolve({ data: list, error: null }) : Promise.resolve({ data: null, error: null })) as never)
  }
  it('lista os 66 livros com a situação e publica um rascunho', async () => {
    respond([draft])
    render(<StudyPanoramaManager />)
    expect(await screen.findByText('Rascunho')).toBeVisible()
    expect(screen.getAllByText('Sem panorama')).toHaveLength(65)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Publicar' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_panorama', { p_book: 'romanos', p_author: 'Paulo', p_audience: 'Cristãos em Roma', p_context: 'Carta escrita por volta de 57 d.C.', p_theme: 'A justiça de Deus pela fé', p_status: 'published' }))
    expect(await screen.findByText('Panorama publicado.')).toBeVisible()
  })
  it('cria o panorama de um livro pelo formulário e exige os quatro campos', async () => {
    respond([])
    const user = userEvent.setup()
    render(<StudyPanoramaManager />)
    await screen.findAllByText('Sem panorama')
    await user.click(screen.getAllByRole('button', { name: 'Criar' })[2]) // Levítico é o terceiro livro
    await user.click(screen.getByRole('button', { name: 'Salvar panorama' }))
    expect(await screen.findByText('Preencha os quatro campos da ficha.')).toBeVisible()
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('owner_save_study_panorama', expect.anything())
    await user.type(screen.getByLabelText('Autor'), 'Moisés')
    await user.type(screen.getByLabelText('Para quem foi escrito'), 'Israel no deserto')
    await user.type(screen.getByLabelText('Contexto em uma frase'), 'Escrito durante a peregrinação.')
    await user.type(screen.getByLabelText('Tema central'), 'A santidade de Deus')
    await user.click(screen.getByRole('button', { name: 'Salvar panorama' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_panorama', expect.objectContaining({ p_book: 'levitico', p_author: 'Moisés', p_status: 'draft' })))
  })
  it('importa em lote: confere antes, ignora os que já existem e envia só os válidos como rascunho', async () => {
    respond([draft])
    const user = userEvent.setup()
    render(<StudyPanoramaManager />)
    await screen.findByText('Rascunho')
    await user.click(screen.getByRole('button', { name: 'Importar panoramas' }))
    const file = JSON.stringify([
      { ...romanos, book: 'Romanos' },
      { book: 'Levítico', author: 'Moisés', audience: 'Israel', context: 'Contexto.', theme: 'Santidade' },
      { book: 'Livro Ruim', author: 'a', audience: 'b', context: 'c', theme: 'd' },
    ])
    fireEvent.change(screen.getByLabelText('Ou cole aqui'), { target: { value: file } })
    await user.click(screen.getByRole('button', { name: 'Conferir panoramas' }))
    await waitFor(() => expect(document.querySelector('.study-import [role=status]')?.textContent).toMatch(/2 panorama.s. válido.s., 1 com problema, 1 já existe/))
    expect(vi.mocked(supabase.rpc)).not.toHaveBeenCalledWith('owner_save_study_panorama', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Importar 1 panorama(s) como rascunho' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc)).toHaveBeenCalledWith('owner_save_study_panorama', expect.objectContaining({ p_book: 'levitico', p_status: 'draft' })))
    expect(vi.mocked(supabase.rpc).mock.calls.filter(call => call[0] === 'owner_save_study_panorama')).toHaveLength(1)
    expect(await screen.findByText('Importação concluída: 1 novo(s) como rascunho, 0 atualizado(s), 1 já existente(s) ignorado(s).')).toBeVisible()
  })
  it('publica vários panoramas de uma vez', async () => {
    const other: OwnerStudyPanorama = { ...draft, book: 'levitico', author: 'Moisés' }
    respond([draft, other])
    const user = userEvent.setup()
    render(<StudyPanoramaManager />)
    await screen.findByText('Moisés')
    await user.click(screen.getByRole('checkbox', { name: 'Selecionar todos' }))
    await user.click(screen.getByRole('button', { name: 'Publicar selecionados (2)' }))
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.filter(call => call[0] === 'owner_save_study_panorama')).toHaveLength(2))
    expect(await screen.findByText('2 panorama(s) publicado(s).')).toBeVisible()
  })
})
