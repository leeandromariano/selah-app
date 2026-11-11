import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { consistencyFixture } from '../test/consistencyBoundary'
import { libraryBoundary, olderPublications } from '../test/libraryBoundary'
import { openMenu } from '../test/menu'

const session = { user: { id: 'journey-fiction' } }
const history = consistencyFixture({ first_month: '2026-01-01', total_days: 2, total_devotionals: 3, current_streak: 2, best_streak: 2, status: 'completed_today', today_completed: true, last_completed_day: '2026-10-28' })
function respond() {
  vi.mocked(supabase.rpc).mockImplementation((name, args) => {
    if (name !== 'get_my_consistency') return Promise.resolve({ data: null, error: { code: '42501' } }) as never
    const month = (args as { p_month: string | null }).p_month ?? '2026-10-01'
    const value = consistencyFixture({ ...history, month, days: undefined })
    value.days = value.days.map(day => ({ ...day, completions: day.date === '2026-10-28' ? 2 : day.date === '2026-10-27' ? 1 : 0 }))
    return { abortSignal: async () => ({ data: value, error: null }) } as never
  })
}
function openJourney() {
  location.hash = 'minha-jornada'
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never)
  return render(<App />)
}
function renew(event: 'SIGNED_IN' | 'TOKEN_REFRESHED' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY', next: unknown = session) {
  act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0](event, next as never) })
}
describe('Minha Jornada pessoal', () => {
  it('nega acesso anônimo antes de consultar métricas ou histórico', async () => {
    location.hash = 'minha-jornada'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  it('aguarda sessão sem mostrar dados ou vazio antecipadamente', async () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(() => {}) as never)
    location.hash = 'minha-jornada'; render(<App />)
    expect(screen.getAllByText('Carregando sessão…').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Ainda não há conclusões/)).not.toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('leitor acessa resumo, aberturas e conclusões na mesma página, mesmo com o histórico vazio', async () => {
    libraryBoundary([]); respond(); openJourney()
    expect(await screen.findByRole('heading', { name: 'Minha Jornada' })).toBeVisible()
    expect(await screen.findByRole('list', { name: 'Dias com conclusões neste mês' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Minhas aberturas' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Ver minhas aberturas e conclusões' })).not.toBeInTheDocument()
    expect(screen.queryByText('Acesso restrito a administradores.')).not.toBeInTheDocument()
    expect((await screen.findAllByText(/Você ainda não abriu nenhum devocional/)).length).toBeGreaterThan(0)
    expect(supabase.from).toHaveBeenCalledWith('devotional_views')
    // o histórico de aberturas precisa dos títulos dos devocionais
    expect(supabase.from).toHaveBeenCalledWith('devotionals')
  })
  it('distingue dias e textos e ordena histórico sem criar novas métricas de servidor', async () => {
    libraryBoundary([]); respond(); openJourney()
    const list = await screen.findByRole('list', { name: 'Dias com conclusões neste mês' })
    const entries = within(list).getAllByRole('listitem')
    expect(entries).toHaveLength(2)
    expect(entries[0]).toHaveTextContent('28 de outubro de 2026')
    expect(entries[0]).toHaveTextContent('2 devocionais concluídos')
    expect(entries[1]).toHaveTextContent('27 de outubro de 2026')
    expect(screen.getByText('Dias com conclusões no mês').nextElementSibling).toHaveTextContent('2')
    expect(screen.getByText('Devocionais concluídos no mês').nextElementSibling).toHaveTextContent('3')
    await openMenu()
    expect(screen.getByRole('link', { name: 'Minha Jornada' })).toHaveAttribute('aria-current', 'page')
    expect(supabase.from).toHaveBeenCalledWith('devotional_views')
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'get_my_consistency')).toHaveLength(1)
    expect(vi.mocked(supabase.rpc).mock.calls.some(([name]) => name === 'get_owner_community')).toBe(false)
  })
  it('permite retomar a última abertura pelo link da jornada sem criar outra abertura', async () => {
    respond()
    const item = olderPublications[0]
    const boundary = libraryBoundary([item], [{ id: 'fiction-opening', devotional_id: item.id, opened_at: '2026-10-28T14:00:00Z' }])
    const user = userEvent.setup()
    openJourney()
    await user.click(await screen.findByRole('link', { name: 'Continuar leitura' }))
    expect(await screen.findByRole('heading', { name: item.title, level: 1 })).toBeVisible()
    expect(location.hash).toBe(`#leitura/${item.id}/retomar`)
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
  })
  it('mostra vazio acolhedor somente após resposta e limita navegação sem histórico', async () => {
    openJourney()
    expect(await screen.findByText(/Ainda não há conclusões neste mês/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Mês anterior' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Próximo mês' })).toBeDisabled()
    expect(screen.queryByRole('list', { name: 'Dias com conclusões neste mês' })).not.toBeInTheDocument()
  })
  it('navega por mouse e teclado e mantém mês vazio, totais históricos e foco na renovação', async () => {
    respond(); const user = userEvent.setup(); openJourney()
    await screen.findByRole('table')
    const previous = screen.getByRole('button', { name: 'Mês anterior' })
    await user.click(previous)
    await screen.findByRole('table', { name: 'setembro de 2026' })
    expect(screen.getByText(/Ainda não há conclusões neste mês/)).toBeVisible()
    expect(screen.getByText('Recorde pessoal').nextElementSibling).toHaveTextContent('2 dias')
    previous.focus(); await user.keyboard('{Enter}')
    await screen.findByRole('table', { name: 'agosto de 2026' })
    fireEvent(window, new Event('blur')); fireEvent(document, new Event('visibilitychange'))
    renew('TOKEN_REFRESHED'); fireEvent(window, new Event('focus'))
    await waitFor(() => expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'get_my_consistency').at(-1)).toEqual(['get_my_consistency', { p_month: '2026-08-01' }]))
    expect(screen.getByRole('table', { name: 'agosto de 2026' })).toBeVisible()
    expect(previous).toHaveFocus()
    expect(location.hash).toBe('#minha-jornada')
  })
  it('remontagem equivalente a reload mantém rota e reinicia mês atual do servidor', async () => {
    respond(); const user = userEvent.setup(); const view = openJourney()
    await user.click(await screen.findByRole('button', { name: 'Mês anterior' }))
    await screen.findByRole('table', { name: 'setembro de 2026' })
    view.unmount(); render(<App />)
    expect(await screen.findByRole('table', { name: 'outubro de 2026' })).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Minha Jornada' })).toBeVisible()
  })
  it('erro não se torna histórico vazio, diagnóstico privado não aparece e retry funciona', async () => {
    vi.mocked(supabase.rpc).mockImplementation(name => name === 'get_my_consistency' ? { abortSignal: async () => ({ data: null, error: { code: '42501', message: 'private@example.invalid' } }) } as never : Promise.resolve({ data: null, error: { code: '42501' } }) as never)
    const user = userEvent.setup(); openJourney()
    const alert = (await screen.findByText(/Sua sessão não autoriza/)).closest('[role="alert"]')!
    expect(alert).toHaveTextContent('Sua sessão não autoriza')
    expect(alert).not.toHaveTextContent('private@')
    expect(screen.queryByText(/Ainda não há conclusões/)).not.toBeInTheDocument()
    respond(); await user.click(screen.getByRole('button', { name: 'Tentar carregar consistência' }))
    expect(await screen.findByRole('list', { name: 'Dias com conclusões neste mês' })).toBeVisible()
  })
  it('logout descarta resposta pessoal atrasada sem expor histórico', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(supabase.rpc).mockImplementation(name => name === 'get_my_consistency' ? { abortSignal: () => new Promise(resolve => { finish = resolve }) } as never : Promise.resolve({ data: null, error: { code: '42501' } }) as never)
    openJourney(); await screen.findByText('Carregando sua consistência…')
    renew('SIGNED_OUT', null)
    await act(async () => { finish({ data: history, error: null }) })
    expect(screen.queryByText('Recorde pessoal')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
  })
  it('troca de conta remove histórico anterior e não usa IDs na consulta', async () => {
    respond(); openJourney(); await screen.findByRole('list', { name: 'Dias com conclusões neste mês' })
    vi.mocked(supabase.rpc).mockImplementation(name => name === 'get_my_consistency' ? { abortSignal: async () => ({ data: consistencyFixture(), error: null }) } as never : Promise.resolve({ data: null, error: { code: '42501' } }) as never)
    renew('SIGNED_IN', { user: { id: 'another-fiction' } })
    expect(await screen.findByText(/Ainda não há conclusões neste mês/)).toBeVisible()
    expect(screen.queryByRole('list', { name: 'Dias com conclusões neste mês' })).not.toBeInTheDocument()
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'get_my_consistency').every(([, args]) => Object.keys(args ?? {}).join() === 'p_month')).toBe(true)
  })
  it('recuperação de senha fecha dados pessoais', async () => {
    respond(); openJourney(); await screen.findByRole('list', { name: 'Dias com conclusões neste mês' })
    renew('PASSWORD_RECOVERY')
    expect(screen.queryByText('Recorde pessoal')).not.toBeInTheDocument()
  })
})
