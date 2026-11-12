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
        const circle = <circle key={item.label} cx="60" cy="60" r={radius} fill="none" stroke={palette[index % palette.length]} strokeWidth="14" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)" />
        offset += length
        return circle
      })}
      <text x="60" y="66" textAnchor="middle" className="dash-ring-text">{number(total)}</text>
    </svg>
    <ul className="dash-legend">{items.map((item, index) => <li key={item.label}><i style={{ background: palette[index % palette.length] }} aria-hidden="true" />{item.label}<b>{number(item.value)}</b><small>{percent(item.value, total)}%</small></li>)}</ul>
  </figure>
}

// Barras verticais (uma série).
export function Bars({ data, label, color = palette[1], format = shortDay }: { data: { label: string; value: number }[]; label: string; color?: string; format?: (value: string) => string }) {
  const max = Math.max(1, ...data.map(item => item.value)), width = 100 / Math.max(1, data.length)
  const step = Math.max(1, Math.ceil(data.length / 8))
  return <figure className="dash-chart" role="img" aria-label={`${label}: total ${number(data.reduce((sum, item) => sum + item.value, 0))}`}>
    <svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true">
      {data.map((item, index) => { const h = (item.value / max) * 40; return <rect key={index} x={index * width + width * 0.18} y={44 - h} width={width * 0.64} height={Math.max(h, item.value ? 0.8 : 0.3)} rx="0.8" fill={color}><title>{`${format(item.label)}: ${number(item.value)}`}</title></rect> })}
    </svg>
    <div className="dash-axis" aria-hidden="true">{data.map((item, index) => index % step === 0 ? <span key={index} style={{ left: `${index * width + width / 2}%` }}>{format(item.label)}</span> : null)}</div>
  </figure>
}

// Linhas/áreas (várias séries com o mesmo eixo de dias).
export function Lines({ series, days, label }: { series: { name: string; color: string; values: number[] }[]; days: string[]; label: string }) {
  const max = Math.max(1, ...series.flatMap(item => item.values)), last = Math.max(1, days.length - 1), step = Math.max(1, Math.ceil(days.length / 8))
  const x = (index: number) => (index / last) * 100, y = (value: number) => 44 - (value / max) * 40
  return <figure className="dash-chart" role="img" aria-label={`${label}: ${series.map(item => `${item.name} ${number(item.values.reduce((sum, value) => sum + value, 0))}`).join(', ')}`}>
    <svg viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3].map(line => <line key={line} x1="0" x2="100" y1={4 + line * 13.3} y2={4 + line * 13.3} stroke="var(--border)" strokeWidth="0.25" />)}
      {series.map(item => <g key={item.name}>
        <polygon points={`0,44 ${item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} 100,44`} fill={item.color} opacity="0.14" />
        <polyline points={item.values.map((value, index) => `${x(index)},${y(value)}`).join(' ')} fill="none" stroke={item.color} strokeWidth="0.9" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </g>)}
    </svg>
    <div className="dash-axis" aria-hidden="true">{days.map((value, index) => index % step === 0 ? <span key={index} style={{ left: `${x(index)}%` }}>{shortDay(value)}</span> : null)}</div>
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
