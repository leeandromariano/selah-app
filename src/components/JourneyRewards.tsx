import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { badgeNames, createJourneyRepository } from '../journey/repository'
import type { Rewards } from '../journey/repository'
import { dayLabel } from '../consistency/calendar'
import '../journey/journey.css'

const repository = createJourneyRepository(supabase)
const states = { active: 'Em andamento', completed: 'Concluído', ended: 'Semana encerrada', cancelled: 'Encerrado por você' }
export function JourneyRewards({ userId }: { userId: string }) {
  return <RewardsView key={userId} />
}
function RewardsView() {
  const [data, setData] = useState<Rewards | null>(null)
  const [busy, setBusy] = useState(true), [error, setError] = useState('')
  const [target, setTarget] = useState(3), [attempt, setAttempt] = useState(0)
  const control = useRef({ generation: 0, mounted: true, writing: false })
  const title = useId(), select = useId()
  useEffect(() => {
    const state = control.current
    state.mounted = true
    return () => { state.mounted = false; state.generation++ }
  }, [control])
  useEffect(() => {
    const state = control.current
    const request = ++state.generation
    repository.snapshot().then(value => {
      if (state.mounted && request === state.generation) { setData(value); setError('') }
    }).catch(() => {
      if (state.mounted && request === state.generation) setError('Não foi possível carregar suas conquistas e desafios.')
    }).finally(() => { if (state.mounted && request === state.generation) setBusy(false) })
    return () => { state.generation++ }
  }, [attempt, control])
  useEffect(() => {
    const state = control.current
    const refresh = () => { if (document.visibilityState === 'visible' && !state.writing) setAttempt(n => n + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  async function change(action: () => Promise<Rewards>) {
    const state = control.current
    if (state.writing) return
    state.writing = true; setBusy(true); setError('')
    const request = ++state.generation
    try {
      const value = await action()
      if (state.mounted && request === state.generation) setData(value)
    } catch {
      if (state.mounted && request === state.generation) setError('Não foi possível atualizar seu desafio. Tente novamente; sua escolha não será duplicada.')
    } finally {
      state.writing = false
      if (state.mounted && request === state.generation) setBusy(false)
    }
  }
  const current = data?.challenges.find(c => c.week_start === data.week_start)
  return <section className="journey-rewards" aria-labelledby={title} aria-busy={busy}>
    <h2 id={title}>Minhas Conquistas</h2>
    {busy && !data && <p role="status">Carregando suas conquistas e desafios…</p>}
    {error && <div role="alert" className="info">{error} <button className="button secondary" disabled={busy} onClick={() => { setBusy(true); setAttempt(n => n + 1) }}>Tentar novamente</button></div>}
    {data && <>
      <p>Seu caminho fica na sua história. Uma pausa não apaga os distintivos alcançados.</p>
      <ul className="journey-badges" aria-label="Distintivos pessoais">{data.badges.map((badge, i) => <li key={badge.days} className={badge.unlocked ? 'badge-earned' : ''}>
        <span aria-hidden="true">{badge.unlocked ? '✦' : '◇'}</span><h3>{badgeNames[i]}</h3>
        <p>{badge.days} dias consecutivos</p><strong>{badge.unlocked ? 'Alcançado' : 'Próximo marco'}</strong>
      </li>)}</ul>
      <h2>Desafios Pessoais</h2>
      <p>Uma escolha opcional e privada. Semana de segunda a domingo, no horário de Brasília. Ao iniciar, os dias já concluídos nesta semana também contam. Uma meta por semana; você pode encerrar sem penalização.</p>
      {!current && <div className="actions"><label htmlFor={select}>Sua meta nesta semana</label><select id={select} value={target} onChange={e => setTarget(Number(e.target.value))} disabled={busy}>{[3, 5, 7].map(n => <option key={n} value={n}>{n} dias distintos</option>)}</select><button className="button" disabled={busy} onClick={() => change(() => repository.start(target))}>Iniciar desafio</button></div>}
      {!data.challenges.length && <p>Nenhum desafio iniciado. Você pode seguir no seu ritmo.</p>}
      <ul className="journey-challenges" aria-label="Seus desafios">{data.challenges.map(c => <li key={c.week_start}>
        <h3>Semana de {dayLabel(c.week_start)}</h3><p>{states[c.status]} · {c.days} de {c.target} dias distintos</p>
        <progress aria-label={`Progresso da semana de ${dayLabel(c.week_start)}`} value={Math.min(c.days, c.target)} max={c.target} />
        {c.status === 'active' && <button className="button secondary" disabled={busy} onClick={() => change(repository.cancel)}>Encerrar desafio</button>}
      </li>)}</ul>
    </>}
  </section>
}
