import type { EditorialReaderSource, VisibleEpisode } from './types'

/** Resolve against current visible pages; a stale hint never authorizes content. */
export async function findNextVisibleEpisode(source: EditorialReaderSource, slug: string, currentId: string, visibleIndex: number, signal: AbortSignal): Promise<VisibleEpisode | null> {
  const hintedPage = Number.isSafeInteger(visibleIndex) && visibleIndex >= 0 ? Math.floor(visibleIndex / 25) : 0
  async function scan(start: number): Promise<{ found: boolean; next: VisibleEpisode | null }> {
    for (let page = start; page <= 10000; page++) {
      const result = await source.episodes(slug, page, signal)
      const index = result.items.findIndex(item => item.id === currentId)
      if (index >= 0) {
        if (index + 1 < result.items.length) return { found: true, next: result.items[index + 1] }
        if (result.nextPage === null) return { found: true, next: null }
        const following = await source.episodes(slug, result.nextPage, signal)
        return { found: true, next: following.items[0] ?? null }
      }
      if (result.nextPage === null) break
    }
    return { found: false, next: null }
  }
  const hinted = await scan(hintedPage)
  if (hinted.found) return hinted.next
  if (hintedPage) {
    const fromStart = await scan(0)
    if (fromStart.found) return fromStart.next
  }
  throw new Error('Episodio indisponivel.')
}
