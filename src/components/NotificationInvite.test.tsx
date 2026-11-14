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
const repo = (data: unknown) => ({ get: vi.fn().mockResolvedValue(data), save: vi.fn(), confirm: vi.fn(), revoke: vi.fn(), markInviteSeen: vi.fn().mockResolvedValue(undefined) }) as never

beforeEach(() => { auth = { session: { user: confirmedUser }, recovery: false }; permission = 'default'; localStorage.clear() })
afterEach(() => { vi.useRealTimers() })

describe('convite para ativar notificações', () => {
  it('aparece na Home para leitor confirmado sem aparelho ativo', async () => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    expect(await screen.findByRole('dialog', { name: 'Ative o lembrete e não perca sua constância!' })).toBeVisible()
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
    fireEvent.click(screen.getByRole('button', { name: 'Ativar lembrete' }))
    expect(await screen.findByText(/Tudo certo!/)).toBeVisible()
    expect(activate).toHaveBeenCalledWith('fiction-user', repository, '07:30')
  })
  it.each([['denied', /não liberou/], ['unavailable', /Tela de Início/]])('resultado %s explica o que fazer', async (result, text) => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} activate={vi.fn().mockResolvedValue(result)} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar lembrete' }))
    expect(await screen.findByText(text)).toBeVisible()
  })
  it('falha inesperada mostra aviso sem quebrar', async () => {
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} activate={vi.fn().mockRejectedValue(Error('x'))} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Ativar lembrete' }))
    expect(await screen.findByText(/Não foi possível ativar agora/)).toBeVisible()
  })
  it('aparece uma única vez por pessoa: ao aparecer grava a marca na conta e não volta no próximo login', async () => {
    const first = repo(snapshot())
    const view = render(<NotificationInvite page="inicio" repository={first} />)
    expect(await screen.findByRole('dialog')).toBeVisible()
    await waitFor(() => expect((first as unknown as { markInviteSeen: ReturnType<typeof vi.fn> }).markInviteSeen).toHaveBeenCalledOnce())
    expect(localStorage.getItem('coram.notify-invite-seen.fiction-user')).toBe('1')
    view.unmount()
    // próximo login, mesmo sem ter tocado em nada e com o aparelho revogado: não aparece de novo
    const second = repo(snapshot())
    render(<NotificationInvite page="inicio" repository={second} />)
    await waitFor(() => expect((second as unknown as { get: ReturnType<typeof vi.fn> }).get).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('a marca vinda da conta esconde o convite em outro navegador, e não grava de novo', async () => {
    const repository = repo(snapshot({ invite_seen: true }))
    render(<NotificationInvite page="inicio" repository={repository} />)
    await waitFor(() => expect((repository as unknown as { get: ReturnType<typeof vi.fn> }).get).toHaveBeenCalled())
    await act(async () => { await Promise.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect((repository as unknown as { markInviteSeen: ReturnType<typeof vi.fn> }).markInviteSeen).not.toHaveBeenCalled()
  })
  it('se o banco falhar ao gravar a marca, a marca local evita repetir neste navegador', async () => {
    const repository = repo(snapshot())
    ;(repository as unknown as { markInviteSeen: ReturnType<typeof vi.fn> }).markInviteSeen.mockRejectedValue(Error('x'))
    const view = render(<NotificationInvite page="inicio" repository={repository} />)
    expect(await screen.findByRole('dialog')).toBeVisible()
    await act(async () => { await Promise.resolve() })
    view.unmount()
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    await act(async () => { await Promise.resolve(); await Promise.resolve() })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('"Agora não" e Escape só fecham', async () => {
    const view = render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    view.unmount()
    localStorage.clear()
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} />)
    await screen.findByRole('dialog')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('quem já ligou os lembretes é reativado sozinho e não vê o convite', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const rearm = vi.fn().mockResolvedValue('resubscribed'), confirm = vi.fn().mockResolvedValue(true)
    const repository = repo(snapshot())
    render(<NotificationInvite page="inicio" repository={repository} rearm={rearm} confirm={confirm} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(15500) })
    expect(rearm).toHaveBeenCalledWith('fiction-user', repository)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirm).toHaveBeenCalled()
    expect((repository as unknown as { markInviteSeen: ReturnType<typeof vi.fn> }).markInviteSeen).not.toHaveBeenCalled()
  })
  it('sem reativação possível o convite aparece normalmente', async () => {
    const rearm = vi.fn().mockResolvedValue('skipped')
    render(<NotificationInvite page="inicio" repository={repo(snapshot())} rearm={rearm} />)
    expect(await screen.findByRole('dialog')).toBeVisible()
    expect(rearm).toHaveBeenCalledOnce()
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
