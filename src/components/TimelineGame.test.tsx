import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { TimelineGame } from './TimelineGame'

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
const titles = ['Acontecimento fictício um', 'Acontecimento fictício dois', 'Acontecimento fictício três', 'Acontecimento fictício quatro']
const ev = (i: number) => ({ id: ids[i], title: titles[i] })
// Posição cronológica fictícia = índice no vetor.
const pairs = [{ left: ev(1), right: ev(0) }, { left: ev(2), right: ev(3) }]
function boundary(list = pairs, counted = true) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string, args: Record<string, string>) => ({ abortSignal: async () => {
    if (name === 'timeline_start') return { data: list, error: null }
    if (name === 'timeline_answer') {
      const [first, second] = [args.p_left, args.p_right].sort((x, y) => ids.indexOf(x) - ids.indexOf(y))
      const reveal = (id: string) => ({ id, title: titles[ids.indexOf(id)], era: 'Era fictícia', reference: 'Gênesis 1:1' })
      return { data: { correct: args.p_chosen === first, counted, first: reveal(first), second: reveal(second) }, error: null }
    }
    if (name === 'get_my_timeline_stats') return { data: { answered: 2, correct: 1, total_events: 61 }, error: null }
    return { data: null, error: { code: '42501' } }
  } })) as never)
}

describe('Linha do Tempo', () => {
  it('explica como jogar e começa a rodada com 10 pares', async () => {
    boundary()
    const user = userEvent.setup()
    render(<TimelineGame />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Linha do Tempo')
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByRole('button', { name: titles[1] })).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('timeline_start', { p_count: 10 })
  })
  it('acerta ao tocar no que veio primeiro e mostra a ordem certa com era e referência', async () => {
    boundary()
    const user = userEvent.setup()
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: titles[0] }))
    const feedback = await screen.findByRole('status')
    expect(feedback).toHaveTextContent('Você acertou!')
    const order = within(feedback).getByRole('list', { name: 'Ordem correta' })
    expect(within(order).getAllByRole('listitem').map(li => li.textContent)).toEqual([expect.stringContaining(titles[0]), expect.stringContaining(titles[1])])
    expect(order).toHaveTextContent('Era fictícia')
    expect(screen.getByRole('button', { name: titles[0] })).toHaveAttribute('data-state', 'correct')
    expect(screen.getByRole('button', { name: titles[1] })).toBeDisabled()
    expect(supabase.rpc).toHaveBeenCalledWith('timeline_answer', { p_left: ids[1], p_right: ids[0], p_chosen: ids[0] })
  })
  it('ao errar, marca a escolhida e destaca a que veio primeiro', async () => {
    boundary()
    const user = userEvent.setup()
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: titles[1] }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi dessa vez.')
    expect(screen.getByRole('button', { name: titles[1] })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: titles[0] })).toHaveAttribute('data-state', 'correct')
  })
  it('percorre a rodada até o resultado e permite jogar de novo', async () => {
    boundary()
    const user = userEvent.setup()
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: titles[0] }))
    await user.click(await screen.findByRole('button', { name: 'Próximo par →' }))
    await user.click(await screen.findByRole('button', { name: titles[3] }))
    await user.click(await screen.findByRole('button', { name: 'Ver resultado' }))
    const result = await screen.findByRole('region', { name: 'Resultado do jogo' })
    expect(within(result).getByRole('heading')).toHaveTextContent('Você acertou 1 de 2')
    await waitFor(() => expect(result).toHaveTextContent('já acertou 1 de 2 pares respondidos'))
    expect(within(result).getByRole('button', { name: 'Jogar de novo' })).toBeVisible()
  })
  it('permite sair com o X no meio da rodada', async () => {
    boundary()
    const user = userEvent.setup()
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await screen.findByRole('button', { name: titles[0] })
    await user.click(screen.getByRole('button', { name: 'Sair do jogo' }))
    expect(screen.getByRole('button', { name: 'Começar' })).toBeVisible()
  })
  it('avisa quando o par já tinha sido respondido', async () => {
    boundary(pairs, false)
    const user = userEvent.setup()
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: titles[0] }))
    expect(await screen.findByText(/não soma pontos de novo/)).toBeVisible()
  })
  it('mostra erro de conexão e informa quando não há pares', async () => {
    vi.mocked(supabase.rpc).mockImplementation((() => ({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) })) as never)
    const user = userEvent.setup()
    const { unmount } = render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o jogo')
    unmount()
    boundary([])
    render(<TimelineGame />)
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda não há acontecimentos')
  })
})
