import { readingMessage } from './repository'
import type { ReadingRepository, ReadingState } from './repository'

export type ReadingView = { state: ReadingState | null; loading: boolean; saving: boolean; active: boolean; error: string; notice: string }
// No duration or device timestamp is sent. Only server-confirmed values are shown.
// Each mounted reader owns a fresh client ID; transfer invalidates all old tokens.
export class ReadingController {
  private view: ReadingView = { state: null, loading: true, saving: false, active: false, error: '', notice: '' }
  private token: string | null = null
  private sequence = 0
  private active = false
  private disposed = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private queue: Promise<void> = Promise.resolve()
  private readonly clientId = crypto.randomUUID()
  private readonly repository: ReadingRepository
  private readonly id: string
  private readonly revision: number
  private readonly publish: (view: ReadingView) => void
  constructor(repository: ReadingRepository, id: string, revision: number, publish: (view: ReadingView) => void) {
    this.repository = repository; this.id = id; this.revision = revision; this.publish = publish
  }
  private emit(change: Partial<ReadingView>) { this.view = { ...this.view, ...change }; if (!this.disposed) this.publish(this.view) }
  private clearTimer() { clearTimeout(this.timer); this.timer = undefined }
  private enqueue(work: () => Promise<void>) {
    this.queue = this.queue.then(work).catch(error => { this.clearTimer(); this.emit({ loading: false, saving: false, active: false, error: readingMessage(error) }) })
    return this.queue
  }
  private accept(state: ReadingState) {
    this.token = state.token ?? null
    this.sequence = state.sequence ?? 0
    const notice = state.revision_changed || state.status === 'revision_changed'
      ? 'Este devocional foi atualizado. O tempo da revisão anterior foi reiniciado. Recarregue o conteúdo para continuar.'
      : state.status === 'gap' ? 'A leitura foi pausada por um intervalo sem confirmação. Esse intervalo não foi contado.' : this.view.notice
    this.emit({ state, loading: false, saving: false, error: '', notice, active: this.active && ['active', 'gap'].includes(state.status) })
  }
  private schedule() {
    this.clearTimer()
    if (this.disposed || !this.active || !this.token || !['active', 'gap'].includes(this.view.state?.status ?? '')) return
    this.timer = setTimeout(() => { void this.enqueue(async () => {
      if (this.disposed || !this.active || !this.token) return
      this.accept(await this.repository.checkpoint(this.id, this.clientId, this.token, this.sequence + 1))
      if (this.view.state?.status === 'out_of_order') { await this.release(); this.emit({ notice: 'A confirmação ficou fora de ordem. Retome a leitura para continuar.' }); return }
      this.schedule()
    }) }, 5000)
  }
  private async release() {
    const token = this.token
    this.clearTimer()
    // Keep the token if pause fails: reconnect must revoke the old interval
    // before starting again, including a short offline gap below ten seconds.
    if (token) {
      await this.repository.pause(this.id, this.clientId, token)
      if (this.token === token) this.token = null
    }
  }
  private async start(transfer = false) {
    if (this.disposed || !this.active) return
    const state = await this.repository.start(this.id, this.clientId, this.revision, transfer)
    this.accept(state)
    if (this.disposed || !this.active) { await this.release(); return }
    this.schedule()
  }
  initialize(active: boolean) {
    this.active = active
    return this.enqueue(async () => {
      this.accept(await this.repository.state(this.id))
      if (this.active && !['completed', 'unavailable'].includes(this.view.state!.status)) await this.start()
    })
  }
  setActive(active: boolean) {
    if (this.disposed || this.active === active) return this.queue
    this.active = active; this.clearTimer(); this.emit({ active: false })
    return this.enqueue(async () => {
      if (!active) { await this.release(); return }
      // Release first even after an ambiguous network failure; never credit the gap.
      await this.release(); await this.start()
    })
  }
  retry(transfer = false) {
    return this.enqueue(async () => {
      await this.release()
      if (this.active) await this.start(transfer)
      else this.accept(await this.repository.state(this.id))
    })
  }
  complete() {
    if (this.view.saving || this.view.state?.credited_ms !== 60000 || this.view.state.status === 'completed') return this.queue
    this.emit({ saving: true })
    return this.enqueue(async () => { this.accept(await this.repository.complete(this.id)) })
  }
  dispose() {
    this.disposed = true; this.active = false; this.clearTimer()
    // Best effort only. Abrupt closure is bounded by the server's lease/interval.
    return this.enqueue(async () => { await this.release() })
  }
}
