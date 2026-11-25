import { useState } from 'react'
import { calendarDay, chapterHref, currentDay, dayChapters, formatChapters, planOrder, plans, progressPercent } from '../reading/plans'
import type { PlanId } from '../reading/plans'
import type { PlanEnrollment } from '../reading/plansRepository'
import { todayInBrazil, useReadingPlans } from '../reading/useReadingPlans'
import type { PlansRepository } from '../reading/useReadingPlans'

type Plans = ReturnType<typeof useReadingPlans>

function statusLine(enrollment: PlanEnrollment, today: string) {
  const day = currentDay(enrollment.plan, enrollment.completed_days)
  if (day === null) return 'Plano concluído. Glória a Deus!'
  const behind = calendarDay(enrollment.started_on, today) - 1 - enrollment.completed_days.length
  if (behind <= 0) return 'Você está em dia com o plano.'
  return `Você tem ${behind} ${behind === 1 ? 'dia' : 'dias'} de leitura para pôr em dia. Sem pressa: continue de onde parou.`
}

// Um plano: antes de entrar mostra o convite; depois, a leitura de hoje, o progresso e os botões.
export function PlanCard({ plan, enrollment, state, featured = false }: { plan: PlanId; enrollment?: PlanEnrollment; state: Plans; featured?: boolean }) {
  const info = plans[plan], busy = state.busy === plan
  const day = enrollment ? currentDay(plan, enrollment.completed_days) : null
  const refs = day ? dayChapters(plan, day) : []
  const percent = enrollment ? progressPercent(plan, enrollment.completed_days) : 0
  const titleId = `plan-${plan}-title`
  const finished = !!enrollment && day === null
  const art = finished ? 'plano-concluido' : plan === 'biblia-1-ano' ? 'plano-biblia' : plan === 'antigo-testamento-150-dias' ? 'plano-ritmo' : 'plano-90'
  return <article className={`reading-plan${featured ? ' featured' : ''}${enrollment ? ' joined' : ''}`} aria-labelledby={titleId}>
    {featured ? <span className="reading-plan-badge">Plano em destaque · {info.days} dias</span> : <div className="eyebrow">{info.days} DIAS</div>}
    <span className={`reading-plan-art ${art}`} aria-hidden="true"><img src={`/home/${art}.webp`} alt="" width="220" height="220" loading="lazy" decoding="async" />{art === 'plano-biblia' && <span className="reading-plan-pct">{percent}%</span>}</span>
    <h3 id={titleId}>{info.title}</h3>
    {!enrollment && <>
      <p className="reading-plan-blurb">{info.blurb}</p>
      <div className="reading-plan-actions"><button type="button" className="home-cta" disabled={busy} onClick={() => void state.join(plan)}>Começar este plano</button></div>
    </>}
    {enrollment && <>
      <div className="reading-plan-progress" role="progressbar" aria-label={`Progresso: ${info.title}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><span style={{ width: `${percent}%` }} /></div>
      <p className="reading-plan-meta">{day ? `Dia ${day} de ${info.days}` : `${info.days} de ${info.days} dias`} · {percent}% concluído</p>
      {day ? <>
        <p className="reading-plan-today"><small>Leitura de hoje</small><strong>{formatChapters(refs)}</strong></p>
        <div className="reading-plan-actions">
          <a className="home-cta" href={chapterHref(refs[0])}>Ler agora</a>
          <button type="button" className="button secondary" disabled={busy} onClick={() => void state.setDay(plan, day, true)}>Marcar como lido</button>
        </div>
      </> : <p className="home-done">✓ Plano concluído</p>}
      <p className="reading-plan-status">{statusLine(enrollment, todayInBrazil())}</p>
    </>}
  </article>
}

// Bloco da Home: o plano de 1 ano em destaque e o do Novo Testamento ao lado. Se não carregar, some sem atrapalhar a Home.
export function HomeReadingPlans({ repo }: { repo?: PlansRepository }) {
  const state = useReadingPlans(repo)
  if (state.loadError || !state.enrollments) return null
  const find = (plan: PlanId) => state.enrollments?.find(item => item.plan === plan)
  return <section className="home-plans" aria-labelledby="home-plans-title">
    <div className="section-heading"><div><div className="eyebrow">PLANOS DE LEITURA</div><h2 id="home-plans-title">Leia a Bíblia em <em>ordem</em></h2></div><a className="text-link" href="#plano-de-leitura">Ver planos →</a></div>
    <div className="home-plans-grid">{planOrder.map((plan, index) => <PlanCard key={plan} plan={plan} enrollment={find(plan)} state={state} featured={index === 0} />)}</div>
    {state.actionError && <p role="alert" className="info">{state.actionError}</p>}
  </section>
}

function UpcomingDays({ enrollment, state }: { enrollment: PlanEnrollment; state: Plans }) {
  const { plan } = enrollment, info = plans[plan], done = new Set(enrollment.completed_days)
  const day = currentDay(plan, enrollment.completed_days)
  const [showAll, setShowAll] = useState(false)
  const start = Math.max(1, (day ?? info.days) - 2), shown = showAll ? Array.from({ length: info.days }, (_, i) => i + 1) : Array.from({ length: Math.min(8, info.days - start + 1) }, (_, i) => start + i)
  return <div className="reading-plan-days">
    <h3><img src="/home/plano-ritmo.webp" alt="" width="44" height="44" loading="lazy" decoding="async" />{info.short}: seus dias</h3>
    <ul>{shown.map(number => <li key={number} className={done.has(number) ? 'done' : number === day ? 'current' : undefined}>
      <label><input type="checkbox" checked={done.has(number)} disabled={state.busy === plan} onChange={event => void state.setDay(plan, number, event.target.checked)} />
        <span><b>Dia {number}</b> {formatChapters(dayChapters(plan, number))}</span></label>
      <a className="text-link" href={chapterHref(dayChapters(plan, number)[0])}>Ler <span aria-hidden="true">→</span></a>
    </li>)}</ul>
    <button type="button" className="text-link" onClick={() => setShowAll(value => !value)}>{showAll ? 'Mostrar só os próximos dias' : `Ver todos os ${info.days} dias`}</button>
  </div>
}

export function ReadingPlansPage({ repo }: { repo?: PlansRepository }) {
  const state = useReadingPlans(repo)
  const [confirming, setConfirming] = useState<PlanId | null>(null)
  if (state.loadError) return <div role="alert" className="info">{state.loadError}</div>
  if (!state.enrollments) return <p role="status">Carregando seus planos…</p>
  const joined = state.enrollments
  return <section className="reading-plans-page">
    <div className="section-heading"><div><div className="eyebrow">PLANOS DE LEITURA</div><h1>Leia a Bíblia em <em>ordem</em></h1><p className="muted">Escolha um ritmo. Você marca cada dia como lido e continua de onde parou.</p></div></div>
    <div className="home-plans-grid">{planOrder.map((plan, index) => <PlanCard key={plan} plan={plan} enrollment={joined.find(item => item.plan === plan)} state={state} featured={index === 0} />)}</div>
    {state.actionError && <p role="alert" className="info">{state.actionError}</p>}
    {planOrder.map(plan => { const enrollment = joined.find(item => item.plan === plan); return enrollment ? <div key={plan}>
      <UpcomingDays enrollment={enrollment} state={state} />
      {confirming === plan
        ? <p className="reading-plan-leave">Sair deste plano apaga o seu progresso. <button type="button" className="button secondary" disabled={state.busy === plan} onClick={() => { void state.leave(plan).then(() => setConfirming(null)) }}>Sim, sair do plano</button> <button type="button" className="text-link" onClick={() => setConfirming(null)}>Cancelar</button></p>
        : <button type="button" className="text-link" onClick={() => setConfirming(plan)}>Sair de {plans[plan].short}</button>}
    </div> : null })}
  </section>
}
