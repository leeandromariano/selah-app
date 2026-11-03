import type { AvailableSeries, AvailableTheme, EditorialReaderSource, Page, VisibleDevotional, VisibleEpisode } from './types'

type Kind = 'themes' | 'series' | 'series_detail' | 'episodes' | 'devotionals' | 'series_devotionals'
type Args = { p_kind: Kind; p_slug: string | null; p_page: number; p_size: number }
type Response = { data: unknown; error: unknown }
export type CatalogTransport = { rpc: (name: 'reader_editorial_catalog', args: Args) => { abortSignal: (signal: AbortSignal) => PromiseLike<Response> } }
export class EditorialUnavailableError extends Error {
  constructor() { super('Catálogo editorial indisponível.'); this.name = 'EditorialUnavailableError' }
}
const size = 25
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EditorialUnavailableError()
  return value as Record<string, unknown>
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new EditorialUnavailableError()
  return value
}
function identity(value: unknown): string {
  const result = text(value, 36)
  if (!uuid.test(result)) throw new EditorialUnavailableError()
  return result
}
function slug(value: unknown): string {
  const result = text(value, 120)
  if (!slugPattern.test(result)) throw new EditorialUnavailableError()
  return result
}
function description(value: unknown): string | null {
  if (value === null) return null
  if (typeof value !== 'string' || value.length > 2000) throw new EditorialUnavailableError()
  return value
}
function theme(value: unknown): AvailableTheme {
  const row = record(value)
  return { id: identity(row.id), name: text(row.name, 100), slug: slug(row.slug), description: description(row.description) }
}
function series(value: unknown): AvailableSeries {
  const row = record(value)
  return { id: identity(row.id), title: text(row.title, 200), slug: slug(row.slug), description: description(row.description) }
}
function devotional(value: unknown): VisibleDevotional {
  const row = record(value)
  return { id: identity(row.id), title: text(row.title, 200), bibleReference: text(row.bible_reference, 200) }
}
function paged<T>(value: unknown, page: number, parse: (value: unknown) => T): Page<T> {
  if (!Array.isArray(value) || value.length > size) throw new EditorialUnavailableError()
  const items = value.map(parse)
  return { items, nextPage: items.length === size && page < 10000 ? page + 1 : null }
}

/** Sem transporte, todas as operações falham fechadas. Não há importação na aplicação ativa. */
export function createEditorialReaderSource(transport: CatalogTransport | null): EditorialReaderSource {
  async function call(kind: Kind, selected: string | null, page: number, signal: AbortSignal): Promise<unknown> {
    if (!Number.isSafeInteger(page) || page < 0 || page > 10000 || (selected !== null && slug(selected) !== selected) || !transport) throw new EditorialUnavailableError()
    if (signal.aborted) throw new EditorialUnavailableError()
    try {
      const result = await transport.rpc('reader_editorial_catalog', { p_kind: kind, p_slug: selected, p_page: page, p_size: size }).abortSignal(signal)
      if (result.error || signal.aborted) throw new EditorialUnavailableError()
      return result.data
    } catch { throw new EditorialUnavailableError() }
  }
  return {
    async themes(page, signal) { return paged(await call('themes', null, page, signal), page, theme) },
    async themeDevotionals(selected, page, signal) { return paged(await call('devotionals', slug(selected), page, signal), page, devotional) },
    async series(page, signal) { return paged(await call('series', null, page, signal), page, series) },
    async seriesDetail(selected, signal) {
      const wanted = slug(selected), value = await call('series_detail', wanted, 0, signal)
      if (value === null) return null
      const item = series(value)
      if (item.slug !== wanted) throw new EditorialUnavailableError()
      return item
    },
    async episodes(selected, page, signal): Promise<Page<VisibleEpisode>> { return paged(await call('episodes', slug(selected), page, signal), page, devotional) },
    async seriesDevotionals(selected, page, signal) { return paged(await call('series_devotionals', slug(selected), page, signal), page, devotional) },
  }
}
