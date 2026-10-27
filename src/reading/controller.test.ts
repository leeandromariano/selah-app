import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ReadingController } from './controller'
import type { ReadingView } from './controller'
import type { ReadingRepository, ReadingState } from './repository'
const base: ReadingState = { devotional_id: 'fiction', revision: 1, credited_ms: 0, revision_changed: false, status: 'paused' }
function setup() {
  const active = { ...base, status: 'active', token: 'nonce', sequence: 0 } as ReadingState
  const repository = {
    state: vi.fn().mockResolvedValue(base), start: vi.fn().mockResolvedValue(active),
    checkpoint: vi.fn().mockResolvedValue({ ...active, credited_ms: 5000, sequence: 1 }),
    pause: vi.fn().mockResolvedValue(base), complete: vi.fn().mockResolvedValue({ ...base, status: 'completed', credited_ms: 60000, completed_at: '2026-10-28T13:00:00Z', completed_day: '2026-10-28' }),
    completions: vi.fn(),
  }
  let view: ReadingView
  const controller = new ReadingController(repository as ReadingRepository, 'fiction', 1, next => { view = next })
  return { repository, controller, view: () => view! }
}
beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())
describe('protocolo de permanência confirmada', () => {
  it('nunca envia duração, usuário ou data e só mostra crédito do servidor', async () => {
    const { controller, repository, view } = setup()
    await controller.initialize(true)
    await vi.advanceTimersByTimeAsync(4999)
    expect(repository.checkpoint).not.toHaveBeenCalled()
    expect(view().state?.credited_ms).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(repository.checkpoint).toHaveBeenCalledExactlyOnceWith('fiction', expect.any(String), 'nonce', 1)
    expect(view().state?.credited_ms).toBe(5000)
    await controller.dispose()
  })
  it('59999 não habilita conclusão e 60000 não conclui automaticamente', async () => {
    const { controller, repository } = setup()
    repository.state.mockResolvedValueOnce({ ...base, credited_ms: 59999 })
    await controller.initialize(false); await controller.complete()
    expect(repository.complete).not.toHaveBeenCalled()
    repository.state.mockResolvedValueOnce({ ...base, credited_ms: 60000, status: 'ready' })
    await controller.retry()
    expect(repository.complete).not.toHaveBeenCalled()
    await controller.complete(); await controller.complete()
    expect(repository.complete).toHaveBeenCalledTimes(1)
  })
  it('pausa imediatamente, libera autorização e não envia checkpoints oculta', async () => {
    const { controller, repository, view } = setup()
    await controller.initialize(true); await vi.advanceTimersByTimeAsync(5000)
    await controller.setActive(false); await vi.advanceTimersByTimeAsync(30000)
    expect(repository.pause).toHaveBeenCalledExactlyOnceWith('fiction', expect.any(String), 'nonce')
    expect(repository.checkpoint).toHaveBeenCalledTimes(1)
    expect(view().active).toBe(false); expect(view().state?.credited_ms).toBe(5000)
    await controller.setActive(true)
    expect(repository.start).toHaveBeenCalledTimes(2)
    await controller.dispose()
  })
  it('recarga/novo login recupera progresso e cria outro identificador de visualização', async () => {
    const first = setup(), second = setup()
    first.repository.state.mockResolvedValueOnce({ ...base, credited_ms: 25000 })
    second.repository.state.mockResolvedValueOnce({ ...base, credited_ms: 25000 })
    first.repository.start.mockResolvedValueOnce({ ...base, status: 'active', token: 'first', sequence: 0, credited_ms: 25000 })
    second.repository.start.mockResolvedValueOnce({ ...base, status: 'active', token: 'second', sequence: 0, credited_ms: 25000 })
    await first.controller.initialize(true); await first.controller.dispose()
    await second.controller.initialize(true)
    expect(second.repository.start.mock.calls[0][1]).not.toBe(first.repository.start.mock.calls[0][1])
    expect(second.repository.state).toHaveBeenCalledWith('fiction')
    expect(second.view().state?.credited_ms).toBe(25000)
    await second.controller.dispose()
  })
  it('não assume leitura de outra aba sem transferência explícita', async () => {
    const { controller, repository, view } = setup()
    repository.start.mockResolvedValueOnce({ ...base, status: 'elsewhere' })
    await controller.initialize(true); await vi.advanceTimersByTimeAsync(20000)
    expect(repository.checkpoint).not.toHaveBeenCalled()
    expect(view().state?.status).toBe('elsewhere')
    await controller.retry(true)
    expect(repository.start.mock.calls.at(-1)?.at(-1)).toBe(true)
    await controller.dispose()
  })
  it('falha de conexão interrompe checkpoints e retoma sem contabilizar o intervalo', async () => {
    const { controller, repository, view } = setup()
    repository.checkpoint.mockRejectedValueOnce(Error('network with private details'))
    await controller.initialize(true); await vi.advanceTimersByTimeAsync(30000)
    expect(repository.checkpoint).toHaveBeenCalledTimes(1)
    expect(view().error).toContain('Sem conexão')
    expect(view().error).not.toContain('private details')
    await controller.retry()
    expect(repository.pause).toHaveBeenCalledTimes(1)
    expect(repository.start).toHaveBeenCalledTimes(2)
    await controller.dispose()
  })
  it('checkpoints nunca se sobrepõem mesmo com resposta lenta', async () => {
    const { controller, repository } = setup()
    let finish!: (value: ReadingState) => void
    repository.checkpoint.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    await controller.initialize(true); await vi.advanceTimersByTimeAsync(20000)
    expect(repository.checkpoint).toHaveBeenCalledTimes(1)
    finish({ ...base, status: 'gap', token: 'nonce', sequence: 1 }); await vi.advanceTimersByTimeAsync(5000)
    expect(repository.checkpoint).toHaveBeenCalledTimes(2)
    await controller.dispose()
  })
  it('pausa que falhou offline é repetida antes de retomar, mesmo em intervalo curto', async () => {
    const { controller, repository } = setup()
    await controller.initialize(true)
    repository.pause.mockRejectedValueOnce(Error('offline'))
    await controller.setActive(false)
    await vi.advanceTimersByTimeAsync(1000)
    await controller.setActive(true)
    expect(repository.pause).toHaveBeenCalledTimes(2)
    expect(repository.pause.mock.calls[0]).toEqual(repository.pause.mock.calls[1])
    expect(repository.pause.mock.invocationCallOrder.at(-1)).toBeLessThan(repository.start.mock.invocationCallOrder.at(-1)!)
    await controller.dispose()
  })
  it('perda de foco durante início tardio libera token recebido', async () => {
    const { controller, repository } = setup()
    let finish!: (value: ReadingState) => void
    repository.start.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const initializing = controller.initialize(true)
    await vi.advanceTimersByTimeAsync(0)
    const pausing = controller.setActive(false)
    finish({ ...base, status: 'active', token: 'late-token', sequence: 0 })
    await initializing; await pausing; await vi.advanceTimersByTimeAsync(10000)
    expect(repository.pause).toHaveBeenCalledWith('fiction', expect.any(String), 'late-token')
    expect(repository.checkpoint).not.toHaveBeenCalled()
  })
  it('revisão editorial reinicia confirmação e informa recarga', async () => {
    const { controller, repository, view } = setup()
    repository.checkpoint.mockResolvedValueOnce({ ...base, revision: 2, revision_changed: true })
    await controller.initialize(true); await vi.advanceTimersByTimeAsync(15000)
    expect(view().notice).toContain('revisão anterior foi reiniciado')
    expect(repository.checkpoint).toHaveBeenCalledTimes(1)
    expect(repository.complete).not.toHaveBeenCalled()
  })
  it('alterar relógio do dispositivo não gera crédito ou liberação local', async () => {
    const { controller, view } = setup()
    await controller.initialize(true)
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'))
    expect(view().state?.credited_ms).toBe(0)
    await vi.advanceTimersByTimeAsync(5000)
    expect(view().state?.credited_ms).toBe(5000)
    await controller.dispose()
  })
  it('desmontagem remove timer e ignora respostas após troca de conta', async () => {
    const { controller, repository, view } = setup()
    await controller.initialize(true); const before = view()
    await controller.dispose(); await vi.advanceTimersByTimeAsync(20000)
    expect(repository.checkpoint).not.toHaveBeenCalled()
    expect(view()).toBe(before)
  })
})
