import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { ClaimsGame } from './ClaimsGame'

vi.mock('./QuizVerse', () => ({ QuizVerse: ({ reference }: { reference: string }) => <blockquote>Texto real fictício de {reference}</blockquote> }))

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
const cards = [{ id: ids[0], statement: 'Frase popular fictícia.' }, { id: ids[1], statement: 'Frase bíblica fictícia.' }]
const verdicts: Record<string, { verdict: string; explanation: string; reference: string | null }> = {
  [ids[0]]: { verdict: 'invencao', explanation: 'Não é da Bíblia, é um dito popular fictício.', reference: 'Salmos 127:2' },
  [ids[1]]: { verdict: 'biblia', explanation: 'Está mesmo na Bíblia, segundo o teste.', reference: null },
}
function boundary(list = cards, counted = true) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string, args: Record<string, unknown>) => ({ abortSignal: async () => {
    if (name === 'claims_start') return { data: list, error: null }
    if (name === 'claims_answer') { const v = verdicts[args.p_card_id as string]; return { data: { ...v, correct: args.p_said_in_bible === (v.verdict === 'biblia'), counted }, error: null } }
    if (name === 'get_my_claims_stats') return { data: { answered: 2, correct: 1, total_cards: 24 }, error: null }
    return { data: null, error: { code: '42501' } }
  } })) as never)
}

describe('Tá na Bíblia ou Tá Amarrado?', () => {
  it('explica como jogar e começa a rodada com 5 cartas', async () => {
    boundary()
    const user = userEvent.setup()
    render(<ClaimsGame />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tá na Bíblia ou Tá Amarrado?')
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByText('“Frase popular fictícia.”')).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('claims_start', { p_count: 5 })
  })
  it('acerta ao dizer “Tá amarrado” numa invenção e mostra veredito, explicação e o texto real', async () => {
    boundary()
    const user = userEvent.setup()
    render(<ClaimsGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: /Tá amarrado/ }))
    const feedback = await screen.findByRole('status')
    expect(feedback).toHaveTextContent('Você acertou!')
    expect(feedback).toHaveTextContent('Tá amarrado')
    expect(feedback).toHaveTextContent('dito popular fictício')
    expect(feedback).toHaveTextContent('Texto real fictício de Salmos 127:2')
    expect(supabase.rpc).toHaveBeenCalledWith('claims_answer', { p_card_id: ids[0], p_said_in_bible: false })
  })
  it('erra ao dizer “Tá na Bíblia” numa invenção', async () => {
    boundary()
    const user = userEvent.setup()
    render(<ClaimsGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: /Tá na Bíblia/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi dessa vez.')
  })
  it('responde ao arrastar a carta além do limite e ignora arrastos curtos', async () => {
    boundary()
    render(<ClaimsGame />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Começar' }))
    const card = await screen.findByRole('group', { name: /Frase popular fictícia/ })
    fireEvent.pointerDown(card, { clientX: 100, pointerId: 1 }); fireEvent.pointerMove(card, { clientX: 140, pointerId: 1 }); fireEvent.pointerUp(card, { pointerId: 1 })
    expect(supabase.rpc).not.toHaveBeenCalledWith('claims_answer', expect.anything())
    fireEvent.pointerDown(card, { clientX: 300, pointerId: 1 }); fireEvent.pointerMove(card, { clientX: 100, pointerId: 1 }); fireEvent.pointerUp(card, { pointerId: 1 })
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('claims_answer', { p_card_id: ids[0], p_said_in_bible: false }))
  })
  it('permite responder pelo teclado com as setas', async () => {
    boundary()
    render(<ClaimsGame />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Começar' }))
    const card = await screen.findByRole('group', { name: /Frase popular fictícia/ })
    fireEvent.keyDown(card, { key: 'ArrowRight' })
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('claims_answer', { p_card_id: ids[0], p_said_in_bible: true }))
  })
  it('percorre as cartas até o resultado e permite jogar de novo', async () => {
    boundary()
    const user = userEvent.setup()
    render(<ClaimsGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: /Tá amarrado/ }))
    await user.click(await screen.findByRole('button', { name: 'Próxima carta →' }))
    await user.click(await screen.findByRole('button', { name: /Tá na Bíblia/ }))
    await user.click(await screen.findByRole('button', { name: 'Ver resultado' }))
    const result = await screen.findByRole('region', { name: 'Resultado do jogo' })
    expect(within(result).getByRole('heading')).toHaveTextContent('Você acertou 2 de 2')
    await waitFor(() => expect(result).toHaveTextContent('já acertou 1 de 2 cartas respondidas'))
    expect(within(result).getByRole('button', { name: 'Jogar de novo' })).toBeVisible()
  })
  it('permite sair com o X no meio da rodada', async () => {
    boundary()
    const user = userEvent.setup()
    render(<ClaimsGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await screen.findByText('“Frase popular fictícia.”')
    await user.click(screen.getByRole('button', { name: 'Sair do jogo' }))
    expect(screen.getByRole('button', { name: 'Começar' })).toBeVisible()
  })
  it('mostra erro de conexão e permite tentar de novo', async () => {
    vi.mocked(supabase.rpc).mockImplementation((() => ({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) })) as never)
    const user = userEvent.setup()
    render(<ClaimsGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as cartas')
    expect(screen.getByRole('button', { name: 'Começar' })).toBeVisible()
  })
})
