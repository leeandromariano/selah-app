import type { AvailableSeries, AvailableTheme, Page, Resource, VisibleDevotional, VisibleEpisode } from './types'
import './editorial-reader.css'

function StateMessage({ status }: { status: Exclude<Resource<never>['status'], 'ready'> }) {
  if (status === 'loading') return <p role="status" className="editorial-message">Carregando…</p>
  if (status === 'error') return <p role="alert" className="editorial-message">Não foi possível carregar. Verifique sua conexão.</p>
  if (status === 'unavailable') return <p role="status" className="editorial-message">Este conteúdo não está disponível.</p>
  return <p role="status" className="editorial-message">Ainda não há conteúdo disponível aqui.</p>
}
function More({ nextPage, onMore }: { nextPage: number | null; onMore?: (page: number) => void }) {
  return nextPage !== null && onMore ? <button className="button secondary" onClick={() => onMore(nextPage)}>Carregar mais</button> : null
}
function EmptyList() { return <p role="status" className="editorial-message">Ainda não há conteúdo disponível aqui.</p> }

export function ThemeExplorer({ themes, selected, devotionals, onSelect, onBack, onRead, onMoreThemes, onMoreDevotionals }: {
  themes: Resource<Page<AvailableTheme>>
  selected: AvailableTheme | null
  devotionals: { slug: string; value: Resource<Page<VisibleDevotional>> } | null
  onSelect: (theme: AvailableTheme) => void
  onBack: () => void
  onRead: (id: string) => void
  onMoreThemes?: (page: number) => void
  onMoreDevotionals?: (page: number) => void
}) {
  if (selected) {
    const result = devotionals?.slug === selected.slug ? devotionals.value : { status: 'loading' as const }
    return <section className="editorial" aria-labelledby="theme-title">
      <button className="editorial-back" onClick={onBack}>← Todos os temas</button>
      <p className="editorial-eyebrow">EXPLORAR TEMA</p><h2 id="theme-title">{selected.name}</h2>
      {selected.description && <p className="editorial-intro">{selected.description}</p>}
      {result.status !== 'ready' ? <StateMessage status={result.status} /> : !result.data.items.length ? <EmptyList /> : <>
        <ul className="editorial-list">{result.data.items.map(item => <li key={item.id}><button className="editorial-item" onClick={() => onRead(item.id)}><strong>{item.title}</strong><span>{item.bibleReference}</span><span aria-hidden="true">→</span></button></li>)}</ul>
        <More nextPage={result.data.nextPage} onMore={onMoreDevotionals} />
      </>}
    </section>
  }
  return <section className="editorial" aria-labelledby="themes-title">
    <p className="editorial-eyebrow">ENCONTRE SUA PRÓXIMA PAUSA</p><h2 id="themes-title">Explorar temas</h2>
    <p className="editorial-intro">Encontre palavras para o momento que você está vivendo.</p>
    {themes.status !== 'ready' ? <StateMessage status={themes.status} /> : !themes.data.items.length ? <EmptyList /> : <>
      <div className="editorial-grid">{themes.data.items.map(theme => <button className="editorial-card" key={theme.id} onClick={() => onSelect(theme)}><span className="editorial-symbol" aria-hidden="true">✦</span><strong>{theme.name}</strong>{theme.description && <span>{theme.description}</span>}<span className="editorial-action">Explorar tema →</span></button>)}</div>
      <More nextPage={themes.data.nextPage} onMore={onMoreThemes} />
    </>}
  </section>
}

export function SeriesExplorer({ series, onSelect, onMore }: { series: Resource<Page<AvailableSeries>>; onSelect: (series: AvailableSeries) => void; onMore?: (page: number) => void }) {
  return <section className="editorial" aria-labelledby="series-title">
    <p className="editorial-eyebrow">UM CAMINHO DE CADA VEZ</p><h2 id="series-title">Explorar séries</h2>
    <p className="editorial-intro">Acompanhe uma sequência de devocionais no seu ritmo.</p>
    {series.status !== 'ready' ? <StateMessage status={series.status} /> : !series.data.items.length ? <EmptyList /> : <>
      <div className="editorial-grid">{series.data.items.map(item => <button className="editorial-card" key={item.id} onClick={() => onSelect(item)}><span className="editorial-symbol" aria-hidden="true">▤</span><strong>{item.title}</strong>{item.description && <span>{item.description}</span>}<span className="editorial-action">Ver série →</span></button>)}</div>
      <More nextPage={series.data.nextPage} onMore={onMore} />
    </>}
  </section>
}

export function SeriesDetail({ series, episodes, onBack, onRead, onMore }: {
  series: AvailableSeries
  episodes: { slug: string; value: Resource<Page<VisibleEpisode>> } | null
  onBack: () => void
  onRead: (id: string) => void
  onMore?: (page: number) => void
}) {
  const result = episodes?.slug === series.slug ? episodes.value : { status: 'loading' as const }
  return <section className="editorial" aria-labelledby="series-detail-title">
    <button className="editorial-back" onClick={onBack}>← Todas as séries</button>
    <p className="editorial-eyebrow">SÉRIE</p><h2 id="series-detail-title">{series.title}</h2>
    {series.description && <p className="editorial-intro">{series.description}</p>}
    <h3 className="editorial-subtitle">Episódios disponíveis</h3>
    {result.status !== 'ready' ? <StateMessage status={result.status} /> : !result.data.items.length ? <EmptyList /> : <>
      <ol className="editorial-list">{result.data.items.map((item, index) => <li key={item.id}><button className="editorial-item" onClick={() => onRead(item.id)}><span className="editorial-sequence" aria-hidden="true">{index + 1}</span><span><strong>{item.title}</strong><span>{item.bibleReference}</span></span><span aria-hidden="true">→</span></button></li>)}</ol>
      <More nextPage={result.data.nextPage} onMore={onMore} />
    </>}
  </section>
}

// Navegação pura: o componente não registra abertura nem conclusão.
export function SeriesReadingNavigation({ series, next, onBack, onNext }: { series: AvailableSeries; next: VisibleEpisode | null; onBack: () => void; onNext: (id: string) => void }) {
  return <nav className="editorial-reading-nav" aria-label="Navegação da série"><button className="button secondary" onClick={onBack}>← Voltar à série {series.title}</button>{next && <button className="button primary" onClick={() => onNext(next.id)}>Próximo episódio: {next.title} →</button>}</nav>
}
