import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { WhoSaidPage } from './WhoSaidPage'

vi.mock('./QuizVerse', () => ({ QuizVerse: ({ reference }: { reference: string }) => <blockquote>Texto real fictício de {reference}</blockquote> }))

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
const cards = [
  { id: ids[0], mode: 'base', quote: 'Frase fictícia um.', options: ['Alfa', 'Beta', 'Gama', 'Delta'] },
  { id: ids[1], mode: 'base', quote: 'Frase fictícia dois.', options: ['Épsilon', 'Zeta', 'Eta', 'Teta'] },
]
const answers: Record<string, { correct_index: number; reference: string; context: string }> = {
  [ids[0]]: { correct_index: 1, reference: 'Gênesis 4:9', context: 'Contexto fictício um.' },
  [ids[1]]: { correct_index: 0, reference: 'Isaías 6:8', context: 'Contexto fictício dois.' },
}
function boundary(list = cards, counted = true) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string, args: Record<string, unknown>) => ({ abortSignal: async () => {
    if (name === 'who_start') return { data: list.map(card => ({ ...card, mode: args.p_mode })), error: null }
    if (name === 'who_answer') { const a = answers[args.p_card_id as string]; return { data: { ...a, correct: args.p_selected === a.correct_index, counted }, error: null } }
    if (name === 'get_my_who_stats') return { data: { answered: 2, correct: 1, total_cards: 30 }, error: null }
    return { data: null, error: { code: '42501' } }
  } })) as never)
}

describe('Quem disse isso?', () => {
  it('oferece Modo Base e Modo Profundo e inicia o escolhido', async () => {
    boundary()
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    expect(screen.getByRole('button', { name: /Modo Base/ })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Modo Profundo/ }))
    expect(await screen.findByRole('heading', { name: '“Frase fictícia um.”' })).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('who_start', { p_mode: 'profundo', p_count: 10 })
  })
  it('mostra na hora quem disse, o contexto e o texto bíblico ao acertar', async () => {
    boundary()
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    await user.click(await screen.findByRole('button', { name: /Beta/ }))
    const feedback = await screen.findByRole('status')
    expect(feedback).toHaveTextContent('Você acertou!')
    expect(feedback).toHaveTextContent('Quem disse: Beta')
    expect(feedback).toHaveTextContent('Contexto fictício um.')
    expect(feedback).toHaveTextContent('Texto real fictício de Gênesis 4:9')
    expect(screen.getByRole('button', { name: /Beta/ })).toHaveAttribute('data-state', 'correct')
    expect(screen.getByRole('button', { name: /Alfa/ })).toBeDisabled()
  })
  it('ao errar, marca a escolhida e destaca a certa', async () => {
    boundary()
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    await user.click(await screen.findByRole('button', { name: /Alfa/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi dessa vez.')
    expect(screen.getByRole('button', { name: /Alfa/ })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: /Beta/ })).toHaveAttribute('data-state', 'correct')
  })
  it('percorre a rodada até o resultado e permite jogar de novo ou trocar de modo', async () => {
    boundary()
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    await user.click(await screen.findByRole('button', { name: /Beta/ }))
    await user.click(await screen.findByRole('button', { name: 'Próxima frase →' }))
    await user.click(await screen.findByRole('button', { name: /Zeta/ }))
    await user.click(await screen.findByRole('button', { name: 'Ver resultado' }))
    const result = await screen.findByRole('region', { name: 'Resultado do jogo' })
    expect(within(result).getByRole('heading')).toHaveTextContent('Você acertou 1 de 2')
    await waitFor(() => expect(result).toHaveTextContent('já acertou 1 de 2 frases respondidas'))
    await user.click(within(result).getByRole('button', { name: 'Trocar modo' }))
    expect(screen.getByRole('button', { name: /Modo Profundo/ })).toBeVisible()
  })
  it('permite sair com o X no meio da rodada', async () => {
    boundary()
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    await screen.findByRole('heading', { name: '“Frase fictícia um.”' })
    await user.click(screen.getByRole('button', { name: 'Sair do jogo' }))
    expect(screen.getByRole('button', { name: /Modo Profundo/ })).toBeVisible()
  })
  it('avisa quando a frase já tinha sido respondida', async () => {
    boundary(cards, false)
    const user = userEvent.setup()
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    await user.click(await screen.findByRole('button', { name: /Beta/ }))
    expect(await screen.findByText(/não soma pontos de novo/)).toBeVisible()
  })
  it('mostra erro de conexão ao carregar e informa quando não há frases', async () => {
    vi.mocked(supabase.rpc).mockImplementation((() => ({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) })) as never)
    const user = userEvent.setup()
    const { unmount } = render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Base/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o jogo')
    unmount()
    boundary([])
    render(<WhoSaidPage />)
    await user.click(screen.getByRole('button', { name: /Modo Profundo/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda não há frases')
  })
})
