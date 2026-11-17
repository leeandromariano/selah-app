import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { HomeReadingPlans, ReadingPlansPage } from './ReadingPlans'
import { createReadingPlansRepository } from '../reading/plansRepository'
import type { PlanEnrollment } from '../reading/plansRepository'

// Servidor de mentira: guarda as adesões na memória e responde como as funções reading_plan_*.
function fakeServer(initial: PlanEnrollment[] = [], fail?: string) {
  let rows = [...initial]
  const rpc = vi.fn(async (name: string, args?: Record<string, unknown>) => {
    if (fail === name) return { data: null, error: { message: 'falhou' } }
    if (name === 'reading_plans_mine') return { data: rows, error: null }
    const plan = args?.p_plan as PlanEnrollment['plan']
    if (name === 'reading_plan_join') { const row: PlanEnrollment = rows.find(item => item.plan === plan) ?? { plan, started_on: '2026-11-17', completed_days: [] }; rows = [...rows.filter(item => item.plan !== plan), row]; return { data: row, error: null } }
    if (name === 'reading_plan_set_day') {
      const row = rows.find(item => item.plan === plan)!
      const days = new Set(row.completed_days); if (args?.p_done) days.add(args.p_day as number); else days.delete(args?.p_day as number)
      const next = { ...row, completed_days: [...days].sort((a, b) => a - b) }; rows = rows.map(item => (item.plan === plan ? next : item)); return { data: next, error: null }
    }
    if (name === 'reading_plan_leave') { rows = rows.filter(item => item.plan !== plan); return { data: null, error: null } }
    return { data: null, error: { message: 'desconhecida' } }
  })
  return { rpc, repo: createReadingPlansRepository({ rpc } as never) }
}

describe('planos de leitura: Home', () => {
  it('mostra os dois planos com o de 1 ano em destaque e deixa entrar sem sair da Home', async () => {
    const { repo, rpc } = fakeServer()
    render(<HomeReadingPlans repo={repo} />)
    const year = await screen.findByRole('article', { name: 'A Bíblia toda em 1 ano' })
    const nt = screen.getByRole('article', { name: 'Novo Testamento em 3 meses' })
    expect(within(year).getByText(/Plano em destaque/)).toBeVisible()
    expect(within(nt).queryByText(/Plano em destaque/)).toBeNull()
    await userEvent.setup().click(within(year).getByRole('button', { name: 'Começar este plano' }))
    expect(rpc).toHaveBeenCalledWith('reading_plan_join', { p_plan: 'biblia-1-ano' })
    expect(await within(year).findByText('Gênesis 1–3')).toBeVisible()
    expect(within(year).getByText(/Dia 1 de 365 · 0% concluído/)).toBeVisible()
    expect(within(year).getByRole('link', { name: 'Ler agora' })).toHaveAttribute('href', expect.stringMatching(/^#biblia\/[a-z]+\/genesis\/1$/))
    expect(within(nt).getByRole('button', { name: 'Começar este plano' })).toBeVisible()
  })
  it('marcar como lido avança para a leitura do dia seguinte', async () => {
    const { repo, rpc } = fakeServer([{ plan: 'novo-testamento-90-dias', started_on: '2026-11-17', completed_days: [] }])
    render(<HomeReadingPlans repo={repo} />)
    const nt = await screen.findByRole('article', { name: 'Novo Testamento em 3 meses' })
    expect(within(nt).getByText('Mateus 1–2')).toBeVisible()
    await userEvent.setup().click(within(nt).getByRole('button', { name: 'Marcar como lido' }))
    expect(rpc).toHaveBeenCalledWith('reading_plan_set_day', { p_plan: 'novo-testamento-90-dias', p_day: 1, p_done: true })
    expect(await within(nt).findByText(/Dia 2 de 90 · 1% concluído/)).toBeVisible()
    expect(within(nt).queryByText('Mateus 1–2')).toBeNull()
  })
  it('plano terminado mostra a conclusão e nenhum botão de leitura', async () => {
    const { repo } = fakeServer([{ plan: 'novo-testamento-90-dias', started_on: '2026-01-01', completed_days: Array.from({ length: 90 }, (_, i) => i + 1) }])
    render(<HomeReadingPlans repo={repo} />)
    const nt = await screen.findByRole('article', { name: 'Novo Testamento em 3 meses' })
    expect(within(nt).getByText('✓ Plano concluído')).toBeVisible()
    expect(within(nt).queryByRole('button', { name: 'Marcar como lido' })).toBeNull()
  })
  it('se os planos não carregarem, a Home segue sem o bloco', async () => {
    const { repo, rpc } = fakeServer([], 'reading_plans_mine')
    const { container } = render(<HomeReadingPlans repo={repo} />)
    await waitFor(() => expect(rpc).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })
  it('falha ao entrar no plano avisa e não muda o cartão', async () => {
    const { repo } = fakeServer([], 'reading_plan_join')
    render(<HomeReadingPlans repo={repo} />)
    const year = await screen.findByRole('article', { name: 'A Bíblia toda em 1 ano' })
    await userEvent.setup().click(within(year).getByRole('button', { name: 'Começar este plano' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível entrar no plano agora.')
    expect(within(year).getByRole('button', { name: 'Começar este plano' })).toBeEnabled()
  })
})

describe('planos de leitura: página', () => {
  it('lista os próximos dias, desmarca um dia lido e sai do plano só depois de confirmar', async () => {
    const { repo, rpc } = fakeServer([{ plan: 'biblia-1-ano', started_on: '2026-11-17', completed_days: [1] }])
    const user = userEvent.setup()
    render(<ReadingPlansPage repo={repo} />)
    expect(await screen.findByRole('heading', { name: 'Bíblia em 1 ano: seus dias' })).toBeVisible()
    await user.click(screen.getByRole('checkbox', { name: /Dia 1 Gênesis 1–3/ }))
    expect(rpc).toHaveBeenCalledWith('reading_plan_set_day', { p_plan: 'biblia-1-ano', p_day: 1, p_done: false })
    await user.click(await screen.findByRole('button', { name: 'Sair de Bíblia em 1 ano' }))
    expect(rpc).not.toHaveBeenCalledWith('reading_plan_leave', expect.anything())
    await user.click(screen.getByRole('button', { name: 'Sim, sair do plano' }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('reading_plan_leave', { p_plan: 'biblia-1-ano' }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Bíblia em 1 ano: seus dias' })).toBeNull())
  })
  it('mostra o erro de carregamento', async () => {
    const { repo } = fakeServer([], 'reading_plans_mine')
    render(<ReadingPlansPage repo={repo} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar seus planos de leitura.')
  })
})
