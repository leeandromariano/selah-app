import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NotificationInvite } from './NotificationInvite'

let auth: { session: unknown; recovery: boolean } = { session: null, recovery: false }
let permission = 'default'
vi.mock('../auth/auth', () => ({ useAuth: () => auth }))
vi.mock('../notifications/device', () => ({ deviceKey: () => null, notificationPermission: () => permission }))

const confirmedUser = { id: 'fiction-user', email_confirmed_at: '2026-11-01T00:00:00Z', is_anonymous: false }
const snapshot = (over: object = {}) => ({ enabled: false, mode: 'webpush', vapid_public_key: 'k', device: null, last: null, ...over })
const device = (state: string) => ({ id: 'd', binding: 'b', mode: 'webpush', state, permission: 'granted', time: '08:00', timezone: 'America/Sao_Paulo', expires_at: null })
const repo = (data: unknown) => ({ get: vi.fn().mockResolvedValue(data), save: vi.fn(), confirm: vi.fn(), revoke: vi.fn() }) as never

beforeEach(() => { auth = { session: { user: confirmedUser }, recovery: false }; permission = 'default'; localStorage.clear() })
afterEach(() => { vi.useRealTimers() })

describe('convite para ativar notificações', () => {
  it('aparece na Home para leitor confirmado sem aparelho ativo', async () => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    expect(await screen.findByRole('dialog', { name: 'Quer receber avisos do Coram?' })).toBeVisible()
    expect(screen.getByLabelText('Horário do lembrete diário')).toHaveValue('08:00')
  })
  it('não aparece em outras páginas, sem sessão confirmada, bloqueado, indisponível, ativo ou em modo de simulação', async () => {
    const cases: Array<[string, () => void, unknown]> = [
      ['outra página', () => {}, snapshot()],
      ['aparelho ativo', () => {}, snapshot({ device: device('active') })],
      ['simulação', () => {}, snapshot({ mode: 'simulation' })],
      ['bloqueado', () => { permission = 'denied' }, snapshot()],
      ['indisponível', () => { permission = 'unavailable' }, snapshot()],
      ['e-mail não confirmado', () => { auth = { session: { user: { ...confirmedUser, email_confirmed_at: null } }, recovery: false } }, snapshot()],
      ['sem sessão', () => { auth = { session: null, recovery: false } }, snapshot()],
    ]
    for (const [name, setup, data] of cases) {
      beforeEachReset(); setup()
      const repository = repo(data)
      const view = render(<NotificationInvite page={name === 'outra página' ? 'bereia' : 'inicio'} repository={repository} />)
      await act(async () => { await Promise.resolve(); await Promise.resolve() })
      expect(screen.queryByRole('dialog'), name).not.toBeInTheDocument()
      view.unmount()
    }
  })
  it('ativa em um toque com o horário escolhido e confirma o resultado', async () => {
    const activate = vi.fn().mockResolvedValue('activated'), repository = repo(snapshot())
    render(<NotificationInvite page="inicio" repository={repository} activate={activate} confirm={vi.fn().mockResolvedValue(false)} />)
    fireEvent.change(await screen.findByLabelText('Horário do lembrete diário'), { target: { value: '07:30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByText(/Tudo certo!/)).toBeVisible()
    expect(activate).toHaveBeenCalledWith('fiction-user', repository, '07:30')
  })
  it.each([['denied', /não liberou/], ['unavailable', /Tela de Início/]])('resultado %s explica o que fazer', async (result, text) => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} activate={vi.fn().mockResolvedValue(result)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByText(text)).toBeVisible()
  })
  it('falha inesperada mostra aviso sem quebrar', async () => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} activate={vi.fn().mockRejectedValue(Error('x'))} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar notificações' }))
    expect(await screen.findByText(/Não foi possível ativar agora/)).toBeVisible()
  })
  it('"Agora não" e Escape adiam o convite e ele não volta na próxima visita', async () => {
    const first = render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    first.unmount()
    const repository = repo(snapshot())
    render(<NotificationInvite page="inicio" repository={repository} />)
    await waitFor(() => expect((repository as unknown as { get: ReturnType<typeof vi.fn> }).get).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const stored = JSON.parse(localStorage.getItem('coram.notify-invite.fiction-user')!)
    expect(stored.count).toBe(1); expect(stored.until).toBeGreaterThan(Date.now() + 6 * 86_400_000)
  })
  it('aparelho pendente é confirmado sozinho, sem mostrar o convite', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const confirm = vi.fn().mockResolvedValue(true)
    render(<NotificationInvite page="inicio" repository={repo(snapshot({ device: device('pending') }))} confirm={confirm} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(15500) })
    expect(confirm).toHaveBeenCalledWith('fiction-user', expect.anything())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
function beforeEachReset() { auth = { session: { user: confirmedUser }, recovery: false }; permission = 'default'; localStorage.clear() }
