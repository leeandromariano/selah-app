import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { createPrayerRepository, defaultReviewDays, formatDay, prayerReviewOptions } from '../prayer/repository'

const defaultRepository = createPrayerRepository(supabase)
type Props = { devotionalId?: string | null; repo?: typeof defaultRepository }

export function PrayerCapsuleForm({ devotionalId = null, repo = defaultRepository }: Props) {
  const [request, setRequest] = useState('')
  const [days, setDays] = useState(defaultReviewDays)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [savedOn, setSavedOn] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy) return
    if (request.trim().length < 3) { setError('Escreva o seu pedido de oração.'); return }
    setBusy(true); setError('')
    try {
      const item = await repo.create(request, days, devotionalId)
      setSavedOn(item.review_on); setRequest('')
    } catch (failure) {
      const message = (failure as Error)?.message
      setError((failure as { code?: string })?.code === '22023' && message ? message : 'Não foi possível guardar agora. Verifique sua conexão e tente novamente.')
    } finally { setBusy(false) }
  }

  return <section className="prayer-capsule" aria-labelledby="prayer-capsule-title">
    <div className="eyebrow">NO SECRETO</div>
    <h3 id="prayer-capsule-title">Cápsula de oração</h3>
    <p className="muted">Guarde um pedido e marque quando quer rever. Quando a data chegar, ele volta na sua Home para você contar como Deus agiu.</p>
    {savedOn ? <div role="status" className="success">
      <p>Guardado no secreto. Vou te lembrar na Home em <b>{formatDay(savedOn)}</b>.</p>
      <div className="actions"><button type="button" className="button secondary" onClick={() => setSavedOn(null)}>Guardar outro pedido</button><a className="text-link" href="#minha-jornada">Ver meus pedidos →</a></div>
    </div> : <form onSubmit={event => void submit(event)}>
      <label>Meu pedido de oração<textarea rows={3} maxLength={500} value={request} onChange={event => setRequest(event.target.value)} placeholder="Pelo que você quer orar?" /></label>
      <label>Rever este pedido<select value={days} onChange={event => setDays(Number(event.target.value))}>{prayerReviewOptions.map(option => <option key={option.days} value={option.days}>{option.label}</option>)}</select></label>
      {error && <p role="alert" className="info">{error}</p>}
      <button type="submit" className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar no secreto'}</button>
    </form>}
  </section>
}
