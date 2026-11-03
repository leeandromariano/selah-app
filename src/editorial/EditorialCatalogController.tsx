import { useEffect, useMemo, useState } from 'react'
import { createEditorialReaderSource, type CatalogTransport } from './catalogRepository'
import { ThemeExplorer, SeriesExplorer, SeriesDetail } from './EditorialReader'
import type { AvailableSeries, AvailableTheme, Page, Resource, VisibleDevotional, VisibleEpisode } from './types'

export type EditorialReadingContext = { series: AvailableSeries; visibleEpisodes: VisibleEpisode[] }
type View = 'themes' | 'series' | 'detail'
function joinPage<T>(previous: Resource<Page<T>>, next: Page<T>, page: number): Resource<Page<T>> {
  return { status: 'ready', data: page && previous.status === 'ready' ? { items: [...previous.data.items, ...next.items], nextPage: next.nextPage } : next }
}
/** Isolated from the active app; the caller supplies transport and reading. */
export function EditorialCatalogController({ transport, onRead, initialSeries = null }: { transport: CatalogTransport | null; onRead: (id: string, context: EditorialReadingContext | null) => void; initialSeries?: AvailableSeries | null }) {
  const source = useMemo(() => createEditorialReaderSource(transport), [transport])
  const [view, setView] = useState<View>(initialSeries ? 'detail' : 'themes')
  const [theme, setTheme] = useState<AvailableTheme | null>(null)
  const [series, setSeries] = useState<AvailableSeries | null>(initialSeries)
  const [themes, setThemes] = useState<Resource<Page<AvailableTheme>>>({ status: 'loading' })
  const [devotionals, setDevotionals] = useState<Resource<Page<VisibleDevotional>>>({ status: 'loading' })
  const [seriesList, setSeriesList] = useState<Resource<Page<AvailableSeries>>>({ status: 'loading' })
  const [episodes, setEpisodes] = useState<Resource<Page<VisibleEpisode>>>({ status: 'loading' })
  const [themesPage, setThemesPage] = useState(0)
  const [devotionalsPage, setDevotionalsPage] = useState(0)
  const [seriesPage, setSeriesPage] = useState(0)
  const [episodesPage, setEpisodesPage] = useState(0)
  useEffect(() => {
    if (view !== 'themes' || theme) return
    const c = new AbortController()
    void source.themes(themesPage, c.signal).then(value => { if (!c.signal.aborted) setThemes(current => joinPage(current, value, themesPage)) }).catch(() => { if (!c.signal.aborted) setThemes({ status: transport ? 'error' : 'unavailable' }) })
    return () => c.abort()
  }, [source, transport, view, theme, themesPage])
  useEffect(() => {
    if (view !== 'themes' || !theme) return
    const c = new AbortController()
    void source.themeDevotionals(theme.slug, devotionalsPage, c.signal).then(value => { if (!c.signal.aborted) setDevotionals(current => joinPage(current, value, devotionalsPage)) }).catch(() => { if (!c.signal.aborted) setDevotionals({ status: transport ? 'error' : 'unavailable' }) })
    return () => c.abort()
  }, [source, transport, view, theme, devotionalsPage])
  useEffect(() => {
    if (view !== 'series') return
    const c = new AbortController()
    void source.series(seriesPage, c.signal).then(value => { if (!c.signal.aborted) setSeriesList(current => joinPage(current, value, seriesPage)) }).catch(() => { if (!c.signal.aborted) setSeriesList({ status: transport ? 'error' : 'unavailable' }) })
    return () => c.abort()
  }, [source, transport, view, seriesPage])
  useEffect(() => {
    if (view !== 'detail' || !series) return
    const c = new AbortController()
    void source.episodes(series.slug, episodesPage, c.signal).then(value => { if (!c.signal.aborted) setEpisodes(current => joinPage(current, value, episodesPage)) }).catch(() => { if (!c.signal.aborted) setEpisodes({ status: transport ? 'error' : 'unavailable' }) })
    return () => c.abort()
  }, [source, transport, view, series, episodesPage])
  function openThemes() {
    if (view === 'themes' && !theme) return
    setTheme(null); setThemesPage(0); setThemes({ status: 'loading' }); setView('themes')
  }
  function openSeries() {
    if (view === 'series') return
    setSeriesPage(0); setSeriesList({ status: 'loading' }); setView('series')
  }
  return <div>
    <nav className="editorial-reading-nav" aria-label="Catalogo editorial">
      <button type="button" className="button secondary" onClick={openThemes}>Temas</button>
      <button type="button" className="button secondary" onClick={openSeries}>Séries</button>
    </nav>
    {view === 'themes' && <ThemeExplorer themes={themes} selected={theme}
      devotionals={theme ? { slug: theme.slug, value: devotionals } : null}
      onSelect={value => { setDevotionals({ status: 'loading' }); setDevotionalsPage(0); setTheme(value) }}
      onBack={openThemes} onRead={id => onRead(id, null)} onMoreThemes={setThemesPage} onMoreDevotionals={setDevotionalsPage} />}
    {view === 'series' && <SeriesExplorer series={seriesList}
      onSelect={value => { setEpisodes({ status: 'loading' }); setEpisodesPage(0); setSeries(value); setView('detail') }} onMore={setSeriesPage} />}
    {view === 'detail' && series && <SeriesDetail series={series} episodes={{ slug: series.slug, value: episodes }}
      onBack={openSeries} onRead={id => onRead(id, { series, visibleEpisodes: episodes.status === 'ready' ? episodes.data.items : [] })} onMore={setEpisodesPage} />}
  </div>
}
