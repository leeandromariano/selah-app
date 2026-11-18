import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { renderWrappedCard } from '../wrapped/image'
import { artFor, buildCards, cardText, cardTitle, homePrompts, lastClosedMonth, milestones, parsePeriod, periodHash, periodId, periodLabel, started, suggestedPeriods, todayInBrazil } from '../wrapped/model'
import type { Period, WrappedCard } from '../wrapped/model'
import { createWrappedRepository } from '../wrapped/repository'
import type { WrappedData } from '../wrapped/repository'
import { useViewport } from './navigation'
import '../wrapped.css'

// Recap Coram: o mês ou o ano de cada leitor em 4 cards. (Internamente ainda se chama "wrapped".)
const defaultRepository = createWrappedRepository(supabase)
export type WrappedRepo = typeof defaultRepository
const slideSeconds = 7
const reducedMotion = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false } }
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1)

// Número que sobe de 0 até o valor (sem animação para quem prefere menos movimento).
function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [shown, setShown] = useState(() => (reducedMotion() ? value : 0))
  useEffect(() => {
    if (reducedMotion() || value === 0) return
    let frame = 0
    const begin = performance.now()
    const tick = (now: number) => {
      const progress = Math.min(1, (now - begin) / 900)
      setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])
  return <>{shown}{suffix}</>
}

function CardBody({ card }: { card: WrappedCard }) {
  const text = cardText(card)
  if (card.empty) return <><p className="wrapped-headline muted-headline">{text.headline}</p><p className="wrapped-detail">{text.detail}</p></>
  if (card.kind === 'presence') return <><p className="wrapped-headline"><CountUp value={card.days} /> <small>{card.days === 1 ? 'dia' : 'dias'}</small></p><p className="wrapped-detail">{text.detail}</p>{card.milestone && <span className="wrapped-chip">{card.milestone.name}</span>}</>
  if (card.kind === 'bereia' && card.percent !== null) return <><p className="wrapped-headline"><CountUp value={card.percent} suffix="%" /></p><p className="wrapped-detail">{text.detail}</p></>
  if (card.kind === 'books') {
    const max = card.items[0].count
    return <ol className="wrapped-books">{card.items.map((item, index) => <li key={item.name} style={{ animationDelay: `${index * 160}ms` }}>
      <span className="wrapped-book-name">{index + 1}. {item.name}</span>
      <span className="wrapped-bar" aria-hidden="true"><i style={{ width: `${Math.max(12, (100 * item.count) / max)}%`, animationDelay: `${300 + index * 160}ms` }} /></span>
      <small>{item.count} {item.count === 1 ? 'leitura' : 'leituras'}</small>
    </li>)}</ol>
  }
  return <><p className="wrapped-headline wrapped-reference">{text.headline}</p><p className="wrapped-detail">{text.detail}</p></>
}

function CardView({ card, label, position, total, selected, onSelect, delay = 0 }: { card: WrappedCard; label: string; position: number; total: number; selected?: boolean; onSelect?: () => void; delay?: number }) {
  return <article className="wrapped-card" data-kind={card.kind} data-selected={selected} aria-live={onSelect ? undefined : 'polite'} aria-label={`Card ${position + 1} de ${total}: ${cardTitle[card.kind]}`}
    style={{ animationDelay: `${delay}ms` }} onClick={onSelect} tabIndex={onSelect ? 0 : undefined} onKeyDown={onSelect ? event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } } : undefined} aria-current={onSelect && selected ? 'true' : undefined}>
    <div className="eyebrow">RECAP CORAM · {label.toUpperCase()}</div>
    <img className="wrapped-art" src={`/home/${artFor(card)}.webp`} alt="" width="200" height="200" />
    <h2>{cardTitle[card.kind]}</h2>
    <CardBody card={card} />
  </article>
}

// Marcos de constância: a maior sequência de dias seguidos no período.
function Milestones({ streak }: { streak: number }) {
  return <section className="wrapped-milestones" aria-label="Marcos de constância">
    <h3>MARCOS DE CONSTÂNCIA</h3>
    <ul>{milestones.map(item => {
      const reached = streak >= item.days
      return <li key={item.days} data-reached={reached}>
        <img src={`/home/${item.art}.webp`} alt="" width="72" height="72" loading="lazy" />
        <strong>{item.days}+ dias</strong><span>{item.name}</span>
        <small>{reached ? 'Alcançado' : `Faltam ${item.days - streak} ${item.days - streak === 1 ? 'dia' : 'dias'}`}</small>
      </li>
    })}</ul>
  </section>
}

// No computador, os 4 cards ficam lado a lado; no celular, um por vez no estilo de Stories (avançam sozinhos).
function WrappedStory({ data }: { data: WrappedData }) {
  const cards = buildCards(data)
  const label = capitalize(periodLabel({ kind: data.kind, year: data.year, month: data.month }))
  const gallery = useViewport() === 'desktop'
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const still = reducedMotion()
  const last = index === cards.length - 1

  useEffect(() => {
    if (gallery || paused || still || last) return
    const timer = setTimeout(() => setIndex(value => Math.min(cards.length - 1, value + 1)), slideSeconds * 1000)
    return () => clearTimeout(timer)
  }, [index, gallery, paused, still, last, cards.length])

  const go = (next: number) => setIndex(Math.max(0, Math.min(cards.length - 1, next)))
  const card = cards[index]

  async function share(list: WrappedCard[]) {
    setBusy(true); setNote('')
    try {
      const files = await Promise.all(list.map(async item => new File([await renderWrappedCard(item, label, location.host)], `recap-coram-${item.kind}.png`, { type: 'image/png' })))
      const text = `Meu Recap Coram de ${label} ✨ ${location.origin}`
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files })) { await navigator.share({ files, text }); return }
      for (const file of files) {
        const link = document.createElement('a'); link.href = URL.createObjectURL(file); link.download = file.name; link.click()
        setTimeout(() => URL.revokeObjectURL(link.href), 4000)
      }
      setNote(files.length === 1 ? 'Card salvo. É só postar nos Stories!' : 'Cards salvos. É só postar nos Stories!')
    } catch (failure) { if (!(failure instanceof DOMException && failure.name === 'AbortError')) setNote('Não foi possível gerar a imagem agora.') }
    finally { setBusy(false) }
  }

  return <section className="wrapped-story" data-gallery={gallery || undefined} tabIndex={0} aria-label={`Recap Coram de ${label}`} onKeyDown={event => { if (event.key === 'ArrowRight') go(index + 1); if (event.key === 'ArrowLeft') go(index - 1) }}>
    {!gallery && <ol className="wrapped-progress" aria-hidden="true">{cards.map((item, position) => <li key={item.kind} data-state={position < index ? 'done' : position === index ? 'active' : 'next'} data-paused={paused || still || undefined}><i style={{ animationDuration: `${slideSeconds}s` }} /></li>)}</ol>}
    {gallery
      ? <div className="wrapped-gallery">{cards.map((item, position) => <CardView key={item.kind} card={item} label={label} position={position} total={cards.length} selected={position === index} onSelect={() => setIndex(position)} delay={position * 120} />)}</div>
      : <CardView key={card.kind} card={card} label={label} position={index} total={cards.length} />}
    <div className="wrapped-controls">
      <button type="button" className="button secondary" onClick={() => go(index - 1)} disabled={index === 0}>← Anterior</button>
      {!gallery && !still && !last && <button type="button" className="button secondary" onClick={() => setPaused(value => !value)} aria-pressed={paused}>{paused ? 'Continuar' : 'Pausar'}</button>}
      <button type="button" className="button secondary" onClick={() => go(index + 1)} disabled={last}>Próximo →</button>
      <button type="button" className="button primary" disabled={busy} onClick={() => void share([card])}>{busy ? 'Gerando…' : 'Compartilhar este card'}</button>
      <button type="button" className="button secondary" disabled={busy} onClick={() => void share(cards)}>Compartilhar os 4 cards</button>
    </div>
    {note && <p role="status" className="muted">{note}</p>}
    <Milestones streak={data.presence.longest_streak} />
  </section>
}

export function CoramWrapped({ page, repo = defaultRepository, today = todayInBrazil() }: { page: string; repo?: WrappedRepo; today?: string }) {
  const requested = parsePeriod(page)
  const period: Period | null = requested === undefined ? lastClosedMonth(today) : requested
  return <div className="wrapped-page">
    <a className="text-link" href="#minha-jornada">← Minha Jornada</a>
    <div className="page-heading wrapped-heading"><div className="eyebrow">RETROSPECTIVA DE FÉ</div><h1>Recap <em>Coram</em></h1><p>Revise sua história e compartilhe seus marcos de constância. Só você vê estes números.</p></div>
    <nav className="wrapped-periods" aria-label="Escolher o período">{suggestedPeriods(today).map(item => <a key={periodId(item)} href={periodHash(item)} aria-current={period && periodId(period) === periodId(item) && period.kind === item.kind ? 'page' : undefined}>{item.kind === 'year' ? `Ano ${item.year}` : capitalize(periodLabel(item))}</a>)}</nav>
    {period && started(period, today) ? <WrappedLoader key={periodId(period) + period.kind} period={period} repo={repo} /> : <div className="info" role="alert">{period ? 'Este período ainda não começou.' : 'Período não encontrado.'} <a href="#recap">Ver o mês passado</a></div>}
  </div>
}

function WrappedLoader({ period, repo }: { period: Period; repo: WrappedRepo }) {
  const [data, setData] = useState<WrappedData | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    repo.get(period.kind, period.year, period.month).then(value => { if (active) setData(value) }).catch((failure: Error) => { if (active) setError(failure.message) })
    return () => { active = false }
  }, [repo, period, attempt])
  if (error) return <div className="info" role="alert">{error} <button type="button" className="text-link" onClick={() => { setError(''); setData(null); setAttempt(value => value + 1) }}>Tentar de novo</button></div>
  if (!data) return <p role="status">Montando o seu Recap Coram…</p>
  return <>
    {data.partial && <p className="info" role="status">Este período ainda não terminou: os números mudam até o fim dele.</p>}
    <WrappedStory data={data} />
  </>
}

// Aviso na Home quando um mês ou um ano acabou de fechar.
export function HomeWrapped({ today = todayInBrazil() }: { today?: string }) {
  const prompts = homePrompts(today)
  if (!prompts.length) return null
  return <section className="home-wrapped" aria-label="Recap Coram">
    <img className="home-wrapped-art" src="/home/recap-cards.webp" alt="" width="96" height="96" loading="lazy" />
    <div><div className="eyebrow">RECAP CORAM</div><h2>{prompts.length > 1 || prompts[0].kind === 'year' ? 'Seu retrato está pronto' : `Seu ${periodLabel(prompts[0])} em 4 cards`}</h2><p>Dias na Presença, livros mais lidos, taxa de acerto na Bereia e o versículo que mais voltou. Pronto para compartilhar.</p></div>
    <div className="home-wrapped-links">{prompts.map(item => <a key={periodId(item) + item.kind} className="button primary" href={periodHash(item)}>{item.kind === 'year' ? `Ver o ano de ${item.year}` : `Ver ${periodLabel(item)}`}</a>)}</div>
  </section>
}
