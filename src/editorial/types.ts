// Contratos de apresentação; disponibilidade e autorização são responsabilidade do servidor.
export type AvailableTheme = { id: string; slug: string; name: string; description: string | null }
export type AvailableSeries = { id: string; slug: string; title: string; description: string | null }
export type VisibleEpisode = { id: string; title: string; bibleReference: string }
export type VisibleDevotional = { id: string; title: string; bibleReference: string }
export type Page<T> = { items: T[]; nextPage: number | null }
export type Resource<T> =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'error' }
  | { status: 'ready'; data: T }

// Contrato futuro, sem implementação remota ou credenciais nesta etapa.
export interface EditorialReaderSource {
  themes(page: number, signal: AbortSignal): Promise<Page<AvailableTheme>>
  themeDevotionals(slug: string, page: number, signal: AbortSignal): Promise<Page<VisibleDevotional>>
  series(page: number, signal: AbortSignal): Promise<Page<AvailableSeries>>
  seriesDetail(slug: string, signal: AbortSignal): Promise<AvailableSeries | null>
  episodes(slug: string, page: number, signal: AbortSignal): Promise<Page<VisibleEpisode>>
  seriesDevotionals(slug: string, page: number, signal: AbortSignal): Promise<Page<VisibleDevotional>>
}
