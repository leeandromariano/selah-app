import type { Devotional } from '../data/devotionals'

export function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = { flame: 'M12 3C13 7 18 8 18 14A6 6 0 0 1 6 14C6 11 8 9 9 8C9 11 11 12 12 12C14 9 10 7 12 3ZM12 15C10 17 10 19 12 20C14 19 14 17 12 15', home: 'M3 10 12 3 21 10V21H3ZM9 21V13H15V21', book: 'M12 5C8 2 4 3 2 4V20C6 18 9 19 12 21C15 19 18 18 22 20V4C18 2 15 3 12 5ZM12 5V21', grid: 'M3 3H10V10H3ZM14 3H21V10H14ZM3 14H10V21H3ZM14 14H21V21H14Z', crown: 'M2 7 7 11 12 4 17 11 22 7 20 19H4L2 7ZM4 19H20', clock: 'M12 3A9 9 0 1 0 12 21A9 9 0 1 0 12 3M12 7V12L16 14', chart: 'M3 3V21H22M7 17V12M12 17V7M17 17V10', bible: 'M6 3H19V21H6A2 2 0 0 1 4 19V5A2 2 0 0 1 6 3ZM4 19A2 2 0 0 1 6 17H19M11.5 6.5V13.5M8.8 9H14.2', gamepad: 'M7 7H17A5 5 0 0 1 22 12V15.5A2.75 2.75 0 0 1 17.2 17.4L15.5 15.5H8.5L6.8 17.4A2.75 2.75 0 0 1 2 15.5V12A5 5 0 0 1 7 7ZM8 9.6V13.4M6.1 11.5H9.9M15.5 10.4H15.51M17.7 12.6H17.71' }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.book} /></svg>
}
export function Heading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) { return <div className="page-heading"><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div> }
export function DevotionalCard<Id extends string | number>({ item, onOpen, completed = false, variant = 'default', featured = false, artIndex = 0 }: {
  item: Omit<Devotional, 'id'> & { id: Id; author?: string }; onOpen: (id: Id) => void; completed?: boolean
  // 'home': cartão da tela inicial, com arte em vidro; 'featured' é o devocional de hoje
  variant?: 'default' | 'home' | 'library'; featured?: boolean; artIndex?: number
}) {
  // 'library': cartão da lista de devocionais, com resumo e a referência bíblica no rodapé
  if (variant === 'library') return <button className="home-card library-card" onClick={() => onOpen(item.id)}>
    <span className="home-card-art" aria-hidden="true"><img src={`/home/art-${(artIndex % 3) + 1}.svg`} alt="" loading="lazy" decoding="async" /></span>
    <span className="home-card-badges"><span className="home-badge">Devocional</span></span>
    <span className="home-card-body">
      <small>{item.date} · {item.minutes} min de leitura</small>
      <h3>{item.title}</h3>
      <span className="library-byline">{item.author && <small>Por {item.author}</small>}{completed && <span className="home-badge done">Concluído</span>}</span>
      <span className="home-card-summary">{item.summary}</span>
      <span className="home-card-foot library-foot"><strong>{item.reference}</strong><span className="home-card-arrow" aria-hidden="true">↗</span></span>
    </span>
  </button>
  if (variant === 'home') return <button className={`home-card ${featured ? 'featured' : ''}`} onClick={() => onOpen(item.id)}>
    <span className="home-card-art" aria-hidden="true"><img src={`/home/art-${(artIndex % 3) + 1}.svg`} alt="" loading="lazy" decoding="async" /></span>
    <span className="home-card-badges"><span className="home-badge">Devocional</span>{featured && <span className="home-badge hot">Hoje</span>}</span>
    <span className="home-card-body">
      <small>{item.date} · {item.minutes} min de leitura</small>
      <h3>{item.title}</h3>
      {featured && <span className="home-card-summary">{item.summary}</span>}
      <span className="home-card-foot">
        <small>{item.author ? `Por ${item.author}` : item.reference}</small>
        {completed && <span className={`home-badge done`}>{featured ? 'Concluído por você' : 'Concluído'}</span>}
        {featured ? <span className="home-card-cta">Entrar na Presença <span aria-hidden="true">→</span></span> : <span className="home-card-arrow" aria-hidden="true">↗</span>}
      </span>
    </span>
  </button>
  return <button className="card" onClick={() => onOpen(item.id)}><div className={`landscape ${item.color}`}><span className="landscape-sun" /><span className="hill" /><span className="hill second" /><span className="landscape-label">{item.theme}</span></div><div className="card-body"><small>{item.date} · {item.minutes} min de leitura</small><h3>{item.title}</h3>{item.author && <small>Por {item.author}</small>}{completed && <span className="completion-badge">Concluído</span>}<p>{item.summary}</p><div className="card-link">{item.reference}<span>↗</span></div></div></button>
}
