import type { Devotional } from '../data/devotionals'

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = { home: 'M3 10 12 3 21 10V21H3ZM9 21V13H15V21', book: 'M12 5C8 2 4 3 2 4V20C6 18 9 19 12 21C15 19 18 18 22 20V4C18 2 15 3 12 5ZM12 5V21', grid: 'M3 3H10V10H3ZM14 3H21V10H14ZM3 14H10V21H3ZM14 14H21V21H14Z', clock: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3M12 7V12L16 14', chart: 'M3 3V21H22M7 17V12M12 17V7M17 17V10' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.book} /></svg>
}
export function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div> }
export function DevotionalCard({ item, onOpen }: { item: Devotional; onOpen: (id: number) => void }) {
  return <button className="card" onClick={() => onOpen(item.id)}><div className={`landscape ${item.color}`}><span className="landscape-sun" /><span className="hill" /><span className="hill second" /><span className="landscape-label">{item.theme}</span></div><div className="card-body"><small>{item.date} · {item.minutes} min de leitura</small><h3>{item.title}</h3><p>{item.summary}</p><div className="card-link">{item.reference}<span>↗</span></div></div></button>
}
