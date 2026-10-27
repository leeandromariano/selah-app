import { useEffect, useId, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createConsistencyRepository, consistencyMessage } from '../consistency/repository'
import type { Consistency } from '../consistency/repository'
import { calendarWeeks, dayLabel, monthLabel, shiftMonth } from '../consistency/calendar'
import { Icon } from './UI'

const repository = createConsistencyRepository(supabase)
const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const messages = {
  empty: 'Seu primeiro dia começa com uma conclusão voluntária. Leia no seu tempo.',
  pending_today: 'Você concluiu ontem. Ainda pode manter sua sequência com uma conclusão hoje.',
  completed_today: 'Conclusão de hoje registrada. Continue no seu ritmo.',
  interrupted: 'Você pode recomeçar hoje. Seus dias anteriores continuam na sua história.',
}
export function ConsistencySection({ userId, refreshKey = 0 }: { userId: string; refreshKey?: number }) {
  // A new account always receives a fresh component and no prior reader state.
  return <ConsistencyView key={userId} refreshKey={refreshKey} />
}
function ConsistencyView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<Consistency | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [settledRequest, setSettledRequest] = useState<string | null>(null)
  const [error, setError] = useState('')
  const titleId = useId(), calendarId = useId()
  const request = `${selectedMonth ?? 'current'}:${attempt}:${refreshKey}`
  const pending = settledRequest !== request
  useEffect(() => {
    let alive = true
    repository.snapshot(selectedMonth).then(value => {
      if (alive) { setData(value); setError(''); setSettledRequest(request) }
    }).catch(error => { if (alive) { setError(consistencyMessage(error)); setSettledRequest(request) } })
    return () => { alive = false }
  }, [selectedMonth, request])
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === 'visible') setAttempt(value => value + 1) }
    const timer = window.setInterval(refresh, 60000)
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  function selectMonth(value: string | null) { setSelectedMonth(value); setAttempt(n => n + 1) }
  function moveMonth(offset: -1 | 1) {
    if (!data) return
    setSelectedMonth(value => {
      const month = shiftMonth(value ?? data.current_month, offset)
      return month && month >= data.first_month && month <= data.current_month ? month : value
    })
    setAttempt(n => n + 1)
  }
  // Navigation follows the user's selection even while an older month is loading.
  const navigationMonth = selectedMonth ?? data?.current_month
  const previous = navigationMonth && shiftMonth(navigationMonth, -1), next = navigationMonth && shiftMonth(navigationMonth, 1)
  return <section className="consistency" aria-labelledby={titleId} aria-busy={pending}>
    <div className="section-heading"><div><div className="eyebrow">UM DIA DE CADA VEZ</div><h2 id={titleId}>Sua constância</h2></div><span className="muted">Horário de Brasília</span></div>
    {!data && pending && <p role="status">Carregando sua consistência…</p>}
    {error && <div className="info" role="alert">{error} {data && 'Os dados exibidos são da última consulta ao servidor.'} <button className="button secondary" disabled={pending} onClick={() => setAttempt(value => value + 1)}>Tentar carregar consistência</button></div>}
    {data && <>
      <div className="consistency-layout">
        <div className="consistency-summary">
          <div className="consistency-current"><Icon name="flame" /><div><span>Ofensiva atual</span><p><strong>{data.current_streak}</strong> {data.current_streak === 1 ? 'dia consecutivo' : 'dias consecutivos'}</p></div></div>
          <p className="consistency-message" role="status">{messages[data.status]}</p>
          <span className="consistency-today">Hoje: {data.today_completed ? 'concluído ✓' : 'pendente'}</span>
          <dl className="consistency-totals">
            <div><dt>Recorde pessoal</dt><dd>{data.best_streak} {data.best_streak === 1 ? 'dia' : 'dias'}</dd></div>
            <div><dt>Dias com conclusões</dt><dd>{data.total_days}</dd></div>
            <div><dt>Devocionais concluídos</dt><dd>{data.total_devotionals}</dd></div>
          </dl>
          <p className="consistency-reference">Referência do servidor: {dayLabel(data.server_today)}.</p>
        </div>
        <div className="consistency-calendar">
          <div className="calendar-navigation">
            <button type="button" className="button secondary" aria-label="Mês anterior" disabled={!previous || navigationMonth! <= data.first_month} onClick={() => moveMonth(-1)}>←</button>
            <h3 id={calendarId}>{monthLabel(data.month)}</h3>
            <button type="button" className="button secondary" aria-label="Próximo mês" disabled={!next || navigationMonth! >= data.current_month} onClick={() => moveMonth(1)}>→</button>
          </div>
          <button className="text-link" disabled={navigationMonth === data.current_month} onClick={() => selectMonth(null)}>Mês atual</button>
          <table aria-labelledby={calendarId}>
            <caption className="sr-only">Calendário pessoal de conclusões. Horário de Brasília.</caption>
            <thead><tr>{weekdays.map(day => <th scope="col" key={day}>{day}</th>)}</tr></thead>
            <tbody>{calendarWeeks(data.days).map((week, index) => <tr key={index}>{week.map((day, column) => {
              if (!day) return <td key={`empty-${column}`} />
              const today = day.date === data.server_today, future = day.date > data.server_today
              const text = `${dayLabel(day.date)}${today ? ', hoje' : ''}: ${day.completions ? `${day.completions} ${day.completions === 1 ? 'devocional concluído' : 'devocionais concluídos'}` : future ? 'data futura' : 'sem conclusão'}`
              return <td key={day.date} className={`${day.completions ? 'calendar-completed' : ''} ${today ? 'calendar-today' : ''} ${future ? 'calendar-future' : ''}`}><time dateTime={day.date} aria-current={today ? 'date' : undefined} aria-label={text}>{Number(day.date.slice(8))}</time><span className="calendar-marker" aria-hidden="true">{day.completions ? '✓' : future ? '\u00a0' : '—'}</span>{today && <small>hoje</small>}</td>
            })}</tr>)}</tbody>
          </table>
          <p className="calendar-legend"><span>✓ Com conclusão</span><span>— Sem conclusão</span><span>Contorno: hoje</span></p>
        </div>
      </div>
      <p className="consistency-note">A ofensiva registra dias com conclusões; não mede sua fé nem seu valor pessoal. Aberturas e releituras de textos já concluídos não acrescentam dias.</p>
    </>}
  </section>
}
