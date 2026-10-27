import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { ReadingController } from '../reading/controller'
import type { ReadingView } from '../reading/controller'
import { createReadingRepository } from '../reading/repository'
import { displayDate } from '../devotionals/repository'

const repository = createReadingRepository(supabase)
export function ReadingProgress({ devotionalId, revision, onCompleted }: { devotionalId: string; revision: number; onCompleted: () => void }) {
  const [view, setView] = useState<ReadingView>({ state: null, loading: true, saving: false, active: false, error: '', notice: '' })
  const controller = useRef<ReadingController | null>(null)
  const completedCallback = useRef(onCompleted)
  useEffect(() => { completedCallback.current = onCompleted }, [onCompleted])
  useEffect(() => {
    let alive = true, reported = false
    const reader = new ReadingController(repository, devotionalId, revision, next => {
      if (!alive) return
      setView(next)
      if (next.state?.status === 'completed' && !reported) { reported = true; completedCallback.current() }
    })
    controller.current = reader
    const isActive = () => document.visibilityState === 'visible' && document.hasFocus() && navigator.onLine
    const sync = () => { void reader.setActive(isActive()) }
    const pageHide = () => { void reader.setActive(false) }
    void reader.initialize(isActive())
    document.addEventListener('visibilitychange', sync)
    window.addEventListener('focus', sync); window.addEventListener('blur', sync)
    window.addEventListener('online', sync); window.addEventListener('offline', sync)
    window.addEventListener('pagehide', pageHide)
    return () => {
      alive = false; controller.current = null
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('focus', sync); window.removeEventListener('blur', sync)
      window.removeEventListener('online', sync); window.removeEventListener('offline', sync)
      window.removeEventListener('pagehide', pageHide)
      void reader.dispose()
    }
  }, [devotionalId, revision])
  const state = view.state
  const completed = state?.status === 'completed'
  const ready = state?.credited_ms === 60000 && !completed && state.status !== 'unavailable'
  const changed = state?.status === 'revision_changed' || state?.revision_changed
  const label = completed ? `Devocional concluído em ${displayDate(state.completed_at!)}, horário de Brasília.`
    : ready ? 'Tempo mínimo confirmado. Você pode concluir quando desejar.'
    : state?.status === 'elsewhere' ? 'Há uma leitura ativa em outra aba ou sessão. O tempo não está sendo contado aqui.'
    : state?.status === 'unavailable' ? 'Este devocional não está mais disponível para conclusão.'
    : view.loading ? 'Carregando progresso confirmado…'
    : view.active ? 'Leitura ativa. Confirmações de tempo são salvas durante a leitura.'
    : 'Leitura pausada. O tempo confirmado está preservado.'
  return <section className="reading-progress" aria-label="Progresso de leitura" aria-busy={view.saving || view.loading}>
    <h2>Sua leitura, no seu tempo</h2>
    <p role="status" aria-live="polite">{label}</p>
    {!completed && <><label htmlFor={`reading-time-${devotionalId}`}>Tempo confirmado: {Math.floor((state?.credited_ms ?? 0) / 1000)} de 60 segundos mínimos</label><progress id={`reading-time-${devotionalId}`} max={60000} value={state?.credited_ms ?? 0} /></>}
    {view.notice && <p className="info">{view.notice}</p>}
    {view.error && <p className="info" role="alert">{view.error}</p>}
    <div className="actions">
      {!completed && <button className="button primary" disabled={!ready || view.saving || Boolean(view.error) || Boolean(changed)} onClick={() => { void controller.current?.complete() }}>{view.saving ? 'Salvando conclusão…' : 'Concluir devocional'}</button>}
      {state?.status === 'elsewhere' && <button className="button secondary" onClick={() => { void controller.current?.retry(true) }}>Continuar leitura aqui</button>}
      {(view.error || state?.status === 'out_of_order') && <button className="button secondary" onClick={() => { void controller.current?.retry() }}>Retomar confirmação</button>}
      {changed && <button className="button secondary" onClick={() => location.reload()}>Recarregar conteúdo atualizado</button>}
    </div>
    <small>O tempo mínimo registra permanência confirmada nesta página; não comprova compreensão. A conclusão é uma escolha sua. Você pode continuar lendo pelo tempo que precisar.</small>
  </section>
}
