import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createPrayerRepository, daysAgo, defaultReviewDays } from '../prayer/repository'
import type { PrayerItem } from '../prayer/repository'

const defaultRepository = createPrayerRepository(supabase)
type Repo = typeof defaultRepository

function DueCard({ item, repo, onDone }: { item: PrayerItem; repo: Repo; onDone: (id: string, note: string) => void }) {
  const [answering, setAnswering] = useState(false)
  const [testimony, setTestimony] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function run(action: () => Promise<unknown>, note: string) {
    setBusy(true); setError('')
    try { await action(); onDone(item.id, note) }
    catch { setError('Não foi possível salvar agora. Tente novamente.'); setBusy(false) }
  }
  return <article className="prayer-card" aria-label="Pedido de oração para rever">
    <div className="eyebrow">CÁPSULA DE ORAÇÃO</div>
    <h3>Você orou por isso há {daysAgo(item.days_since)}. Como Deus agiu?</h3>
    <blockquote>{item.request}</blockquote>
    {answering ? <form onSubmit={event => { event.preventDefault(); void run(() => repo.answer(item.id, testimony), 'Que bom! Seu testemunho foi guardado no mural em Minha Jornada.') }}>
      <label>Conte como Deus agiu (opcional)<textarea rows={3} maxLength={500} value={testimony} onChange={event => setTestimony(event.target.value)} /></label>
      <div className="actions"><button type="submit" className="button primary" disabled={busy}>Guardar no mural</button><button type="button" className="button secondary" disabled={busy} onClick={() => setAnswering(false)}>Voltar</button></div>
    </form> : <div className="actions">
      <button type="button" className="button primary" disabled={busy} onClick={() => setAnswering(true)}>Deus respondeu 🙌</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void run(() => repo.snooze(item.id, defaultReviewDays), `Tudo bem. Vou te lembrar de novo em ${defaultReviewDays} dias.`)}>Ainda aguardando</button>
    </div>}
    {error && <p role="alert" className="info">{error}</p>}
  </article>
}

// Cards na Home: pedidos cuja data de revisão chegou. Falhas ficam em silêncio para não atrapalhar a Home.
export function PrayerDueCards({ repo = defaultRepository }: { repo?: Repo }) {
  const [items, setItems] = useState<PrayerItem[]>([])
  const [notes, setNotes] = useState<string[]>([])
  useEffect(() => {
    let active = true
    repo.due().then(list => { if (active) setItems(list) }).catch(() => { if (active) setItems([]) })
    return () => { active = false }
  }, [repo])
  if (!items.length && !notes.length) return null
  return <section className="prayer-due" aria-label="Cápsulas de oração">
    {items.map(item => <DueCard key={item.id} item={item} repo={repo} onDone={(id, note) => { setItems(list => list.filter(entry => entry.id !== id)); setNotes(list => [...list, note]) }} />)}
    {notes.map((note, i) => <p key={i} role="status" className="success">{note}</p>)}
  </section>
}
