import { useState } from 'react'
import type { ReactNode } from 'react'
import { number, palette, percent, shortDay } from '../owner/format'

// Cartão numérico colorido (estilo dashboard).
export function KpiCard({ label, value, hint, tone = 0, alert = false }: { label: string; value: ReactNode; hint?: ReactNode; tone?: number; alert?: boolean }) {
  return <div className="dash-kpi" data-tone={tone % 6} data-alert={alert || undefined}>
    <span className="dash-kpi-label">{label}</span>
    <strong className="dash-kpi-value">{value}</strong>
    {hint && <small className="dash-kpi-hint">{hint}</small>}
  </div>
}

// Anel de percentual (parte do total).
export function Ring({ part, total, label, color = palette[0], size = 120 }: { part: number; total: number; label: string; color?: string; size?: number }) {
  const value = percent(part, total), radius = 44, circumference = 2 * Math.PI * radius
  return <figure className="dash-ring" role="img" aria-label={`${label}: ${value}% (${number(part)} de ${number(total)})`}>
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
      <circle cx="60" cy="60" r={radius} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(value / 100) * circumference} ${circumference}`} transform="rotate(-90 60 60)" />
      <text x="60" y="66" textAnchor="middle" className="dash-ring-text">{value}%</text>
    </svg>
    <figcaption>{label}</figcaption>
  </figure>
}

// Rosca com várias fatias e legenda.
export function Donut({ items, label }: { items: { label: string; value: number }[]; label: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0), radius = 44, circumference = 2 * Math.PI * radius
  let offset = 0
  return <figure className="dash-donut" role="img" aria-label={`${label}: ${items.map(item => `${item.label} ${number(item.value)}`).join(', ')}`}>
    <svg viewBox="0 0 120 120" width="140" height="140" aria-hidden="true">
      <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border)" strokeWidth="14" />
      {total > 0 && items.map((item, index) => {
        const length = (item.value / total) * circumference
        const circle = <circle key={item.label} cx="60" cy="60" r={radius} fill="none" stroke={palette[index % palette.length]} strokeWidth="14" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)"><title>{`${item.label}: ${number(item.value)}`}</title></circle>
        offset += length
        return circle
      })}
      <text x="60" y="66" textAnchor="middle" className="dash-ring-text">{number(total)}</text>
    </svg>
    <ul className="dash-legend">{items.map((item, index) => <li key={item.label}><i style={{ background: palette[index % palette.length] }} aria-hidden="true" />{item.label}<b>{number(item.value)}</b><small>{percent(item.value, total)}%</small></li>)}</ul>
  </figure>
}

// Mostra o valor ao passar o mouse, focar ou tocar; um toque fixa o valor até tocar de novo.
function useActive() {
  const [hover, setHover] = useState<number | null>(null)
  const [pinned, setPinned] = useState<number | null>(null)
  return { active: hover ?? pinned, setHover, toggle: (index: number) => setPinned(current => current === index ? null : index) }
}
const edge = (percentage: number) => `clamp(52px, ${percentage}%, calc(100% - 52px))`

// Barras verticais (uma série), cada coluna é um botão com o valor no balão.
export function Bars({ data, label, color = palette[1], format = shortDay }: { data: { label: string; value: number }[]; label: string; color?: string; format?: (value: string) => string }) {
  const { active, setHover, toggle } = useActive()
  const max = Math.max(1, ...data.map(item => item.value)), count = Math.max(1, data.length), step = Math.max(1, Math.ceil(count / 8))
  const height = (value: number) => value > 0 ? Math.max((value / max) * 100, 3) : 0
  return <figure className="dash-chart" role="group" aria-label={`${label}: total ${number(data.reduce((sum, item) => sum + item.value, 0))}. Toque ou passe o mouse numa coluna para ver o valor.`}>
    <div className="dash-bars" style={{ ['--bar' as string]: color }} onMouseLeave={() => setHover(null)}>
      {data.map((item, index) => <button key={index} type="button" className="dash-bar" data-active={active === index || undefined} aria-label={`${format(item.label)}: ${number(item.value)}`}
        onMouseEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} onClick={() => toggle(index)}>
        <span style={{ height: `${height(item.value)}%` }} />
      </button>)}
      {active !== null && data[active] && <div className="dash-tip" role="status" style={{ left: edge(((active + 0.5) / count) * 100), bottom: `calc(${height(data[active].value)}% + 10px)` }}><small>{format(data[active].label)}</small><b>{number(data[active].value)}</b></div>}
    </div>
    <div className="dash-axis" aria-hidden="true">{data.map((item, index) => index % step === 0 ? <span key={index} style={{ left: `${((index + 0.5) / count) * 100}%` }}>{format(item.label)}</span> : null)}</div>
  </figure>
}

// Colunas empilhadas por dia (várias séries); o balão mostra o valor de cada série e o total do dia.
export function StackedBars({ series, days, label }: { series: { name: string; color: string; values: number[] }[]; days: string[]; label: string }) {
  const { active, setHover, toggle } = useActive()
  const totals = days.map((_, index) => series.reduce((sum, item) => sum + item.values[index], 0))
  const max = Math.max(1, ...totals), count = Math.max(1, days.length), step = Math.max(1, Math.ceil(count / 8))
  const part = (value: number) => value > 0 ? Math.max((value / max) * 100, 1.5) : 0
  return <figure className="dash-chart" role="group" aria-label={`${label}: ${series.map(item => `${item.name} ${number(item.values.reduce((sum, value) => sum + value, 0))}`).join(', ')}. Toque ou passe o mouse numa coluna para ver cada dia.`}>
    <div className="dash-bars" onMouseLeave={() => setHover(null)}>
      {days.map((day, index) => <button key={day} type="button" className="dash-bar dash-stack" data-active={active === index || undefined}
        aria-label={`${shortDay(day)}: ${series.map(item => `${item.name} ${number(item.values[index])}`).join(', ')}`}
        onMouseEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(null)} onClick={() => toggle(index)}>
        {series.map(item => <span key={item.name} style={{ height: `${part(item.values[index])}%`, background: item.color }} />)}
      </button>)}
      {active !== null && days[active] && <div className="dash-tip" role="status" style={{ left: edge(((active + 0.5) / count) * 100), bottom: `calc(${Math.min(100, (totals[active] / max) * 100)}% + 10px)` }}>
        <small>{shortDay(days[active])}</small>
        {series.map(item => <span key={item.name}><i style={{ background: item.color }} aria-hidden="true" />{item.name}<b>{number(item.values[active])}</b></span>)}
        <span className="dash-tip-total">Total<b>{number(totals[active])}</b></span>
      </div>}
    </div>
    <div className="dash-axis" aria-hidden="true">{days.map((value, index) => index % step === 0 ? <span key={index} style={{ left: `${((index + 0.5) / count) * 100}%` }}>{shortDay(value)}</span> : null)}</div>
    <ul className="dash-legend dash-legend-inline">{series.map(item => <li key={item.name}><i style={{ background: item.color }} aria-hidden="true" />{item.name}</li>)}</ul>
  </figure>
}

// Barras horizontais com valor (comparação entre itens).
export function HBars({ items, label, color = palette[0] }: { items: { label: string; value: number; note?: string }[]; label: string; color?: string }) {
  const max = Math.max(1, ...items.map(item => item.value))
  return <ul className="dash-hbars" aria-label={label}>{items.map(item => <li key={item.label}>
    <span>{item.label}</span>
    <div className="dash-hbar"><div style={{ width: `${(item.value / max) * 100}%`, background: color }} /></div>
    <b>{number(item.value)}</b>{item.note && <small>{item.note}</small>}
  </li>)}</ul>
}

export function Card({ title, children, wide = false, note }: { title: string; children: ReactNode; wide?: boolean; note?: string }) {
  return <section className="dash-card" data-wide={wide || undefined} aria-label={title}><div className="dash-card-head"><h3>{title}</h3>{note && <small>{note}</small>}</div>{children}</section>
}
