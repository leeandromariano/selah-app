import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { JourneyRewards } from './JourneyRewards'
import { supabase } from '../lib/supabase'
import { createJourneyRepository, milestones, parseRewards } from '../journey/repository'
import type { Rewards } from '../journey/repository'

function fixture(changes: Partial<Rewards> = {}): Rewards {
  return { server_today: '2026-10-28', time_zone: 'America/Sao_Paulo', week_start: '2026-10-26',
    badges: milestones.map(days => ({ days, unlocked: days <= 7 })), challenges: [], ...changes }
}
function respond(value = fixture()) {
  vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data: value, error: null }) }) as never)
}
describe('Conquistas e desafios pessoais', () => {
  it('carrega distintivos do servidor, sem iniciar desafios automaticamente', async () => {
    respond(); render(<JourneyRewards userId="fiction-one" />)
    expect(await screen.findByRole('list', { name: 'Distintivos pessoais' })).toBeVisible()
    expect(screen.getAllByText('Alcançado')).toHaveLength(2)
    expect(screen.getAllByText('Próximo marco')).toHaveLength(4)
    expect(screen.getByText(/Nenhum desafio iniciado/)).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('get_my_journey_rewards', {})
  })
  it.each([3, 5, 7])('inicia meta voluntária de %i dias e mostra resultado autorizado', async target => {
    respond(); const user = userEvent.setup(); render(<JourneyRewards userId="fiction-one" />)
    await screen.findByRole('button', { name: 'Iniciar desafio' })
    respond(fixture({ challenges: [{ week_start: '2026-10-26', target, days: 1, status: 'active' }] }))
    await user.selectOptions(screen.getByLabelText('Sua meta nesta semana'), String(target))
    await user.click(screen.getByRole('button', { name: 'Iniciar desafio' }))
    expect(await screen.findByText(`Em andamento · 1 de ${target} dias distintos`)).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('start_my_personal_challenge', { p_target: target })
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '1')
    expect(screen.queryByRole('button', { name: 'Iniciar desafio' })).not.toBeInTheDocument()
  })
  it('encerra voluntariamente, não substitui por penalidade ou novo desafio', async () => {
    respond(fixture({ challenges: [{ week_start: '2026-10-26', target: 5, days: 2, status: 'active' }] }))
    render(<JourneyRewards userId="fiction-one" />)
    await screen.findByRole('button', { name: 'Encerrar desafio' })
    respond(fixture({ challenges: [{ week_start: '2026-10-26', target: 5, days: 2, status: 'cancelled' }] }))
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar desafio' }))
    expect(await screen.findByText('Encerrado por você · 2 de 5 dias distintos')).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('cancel_my_personal_challenge', {})
    expect(screen.queryByRole('button', { name: 'Encerrar desafio' })).not.toBeInTheDocument()
  })
  it('não oferece desistência de resultado concluído ou semana encerrada', async () => {
    respond(fixture({ challenges: [
      { week_start: '2026-10-26', target: 3, days: 4, status: 'completed' },
      { week_start: '2026-10-19', target: 7, days: 2, status: 'ended' },
    ] })); render(<JourneyRewards userId="fiction-one" />)
    expect(await screen.findByText('Concluído · 4 de 3 dias distintos')).toBeVisible()
    expect(screen.getByText('Semana encerrada · 2 de 7 dias distintos')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Encerrar desafio' })).not.toBeInTheDocument()
  })
  it('apresenta erro e permite retry sem resultado fabricado', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data: null, error: { code: '42501' } }) }) as never)
    render(<JourneyRewards userId="fiction-one" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.queryByText('Alcançado')).not.toBeInTheDocument()
    respond(); fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('list', { name: 'Distintivos pessoais' })).toBeVisible()
  })
  it('falha de escrita não inventa progresso e bloqueia cliques duplicados', async () => {
    respond(); render(<JourneyRewards userId="fiction-one" />)
    const button = await screen.findByRole('button', { name: 'Iniciar desafio' })
    let finish!: (v: unknown) => void
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: () => new Promise(resolve => { finish = resolve }) }) as never)
    fireEvent.click(button); fireEvent.click(button)
    expect(button).toBeDisabled()
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'start_my_personal_challenge')).toHaveLength(1)
    await act(async () => finish({ data: null, error: { code: '40001' } }))
    expect(await screen.findByRole('alert')).toHaveTextContent('sua escolha não será duplicada')
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('descarta resposta tardia da conta anterior e limpa na desmontagem/logout', async () => {
    let finish!: (v: unknown) => void
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: () => new Promise(resolve => { finish = resolve }) }) as never)
    const view = render(<JourneyRewards userId="fiction-one" />)
    respond(fixture({ badges: milestones.map(days => ({ days, unlocked: false })) }))
    view.rerender(<JourneyRewards userId="fiction-two" />)
    await screen.findByRole('list', { name: 'Distintivos pessoais' })
    await act(async () => finish({ data: fixture(), error: null }))
    expect(screen.queryByText('Alcançado')).not.toBeInTheDocument()
    view.unmount(); expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
  it('foco renova os dados do servidor sem mutação', async () => {
    respond(); render(<JourneyRewards userId="fiction-one" />)
    await screen.findByRole('list', { name: 'Distintivos pessoais' })
    respond(fixture({ challenges: [{ week_start: '2026-10-26', target: 3, days: 3, status: 'completed' }] }))
    fireEvent.focus(window)
    expect(await screen.findByText('Concluído · 3 de 3 dias distintos')).toBeVisible()
    expect(vi.mocked(supabase.rpc).mock.calls.every(([name]) => name === 'get_my_journey_rewards')).toBe(true)
  })
  it('valida resposta e rejeita meta manipulada antes de chamar RPC', async () => {
    expect(() => parseRewards(fixture({ challenges: [{ week_start: '2026-10-26', target: 100, days: 3, status: 'active' }] }))).toThrow()
    expect(() => parseRewards(fixture({ time_zone: 'UTC' }))).toThrow()
    const repository = createJourneyRepository(supabase)
    await expect(repository.start(100)).rejects.toThrow('Invalid target')
    expect(supabase.rpc).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.queryByText('Concluído')).not.toBeInTheDocument())
  })
})
