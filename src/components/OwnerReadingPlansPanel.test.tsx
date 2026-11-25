import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { OwnerReadingPlansPanel } from './OwnerReadingPlansPanel'
import { createOwnerReadingPlansRepository, planStatus } from '../owner/readingPlans'

const item = { username: 'leitor_ficticio', plan: 'novo-testamento-90-dias', started_on: '2026-11-15', done_days: 45, total_days: 90, percent: 50, updated_on: '2026-11-25' } as const
const snapshot = { server_today: '2026-11-25', readers: 1, enrollments: 1, finished: 0, plans: [{ plan: 'novo-testamento-90-dias', enrolled: 1, average_percent: 50 }], matched: 1, page: 0, size: 25, items: [item] }
const respond = (data: unknown = snapshot) => vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data, error: null }) }) as never)

describe('planos de leitura no painel OWNER', () => {
  it('mostra leitor, porcentagem, dias lidos e situação, e filtra por plano', async () => {
    respond(); render(<OwnerReadingPlansPanel />)
    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.getByText('@leitor_ficticio')).toBeVisible()
    expect(screen.getByText('50%')).toBeVisible()
    expect(screen.getByText('45 de 90')).toBeVisible()
    expect(screen.getByText('34 dias à frente')).toBeVisible()
    await userEvent.setup().selectOptions(screen.getByLabelText('Plano'), 'biblia-1-ano')
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_owner_reading_plans', { p_search: '', p_plan: 'biblia-1-ano', p_page: 0, p_size: 25 })
  })
  it('calcula a situação sem contar o dia de hoje como atraso', () => {
    const base = { ...item, started_on: '2026-11-21' } // hoje é o 5º dia
    expect(planStatus({ ...base, done_days: 4 }, '2026-11-25')).toBe('Em dia')
    expect(planStatus({ ...base, done_days: 5 }, '2026-11-25')).toBe('Em dia')
    expect(planStatus({ ...base, done_days: 3 }, '2026-11-25')).toBe('1 dia a recuperar')
    expect(planStatus({ ...base, done_days: 7 }, '2026-11-25')).toBe('2 dias à frente')
    expect(planStatus({ ...base, done_days: 90 }, '2026-11-25')).toBe('Concluído')
  })
  it('recusa resposta incoerente e descarta campos privados inesperados', async () => {
    respond({ ...snapshot, items: [{ ...item, email: 'x@example.invalid', completed_days: [1] }] })
    const clean = await createOwnerReadingPlansRepository(supabase).list()
    expect(JSON.stringify(clean)).not.toMatch(/example|completed_days/)
    respond({ ...snapshot, items: [{ ...item, done_days: 120 }] })
    await expect(createOwnerReadingPlansRepository(supabase).list()).rejects.toThrow('Invalid reading plans response')
  })
  it('falha mostra aviso com repetir', async () => {
    vi.mocked(supabase.rpc).mockImplementation(() => ({ abortSignal: async () => ({ data: null, error: { message: 'x' } }) }) as never)
    render(<OwnerReadingPlansPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('planos de leitura')
  })
})
