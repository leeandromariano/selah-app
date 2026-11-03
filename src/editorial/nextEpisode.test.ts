import { describe, expect, it, vi } from 'vitest'
import { findNextVisibleEpisode } from './nextEpisode'
import type { EditorialReaderSource, VisibleEpisode } from './types'
const item = (n: number): VisibleEpisode => ({ id: String(n), title: 'Episode ' + n, bibleReference: 'Ref' })
function source(pages: VisibleEpisode[][]) {
  const episodes = vi.fn(async (_slug: string, page: number) => ({ items: pages[page] ?? [], nextPage: page < pages.length - 1 ? page + 1 : null }))
  return { value: { episodes } as unknown as EditorialReaderSource, episodes }
}
const signal = () => new AbortController().signal
describe('next visible episode', () => {
  it('finds the next entry in the same page', async () => {
    const s = source([[item(1), item(2)]])
    expect(await findNextVisibleEpisode(s.value, 'serie', '1', 0, signal())).toEqual(item(2))
  })
  it('fetches the next page at a boundary and identifies the last entry', async () => {
    const s = source([Array.from({ length: 25 }, (_, i) => item(i)), [item(25)]])
    expect(await findNextVisibleEpisode(s.value, 'serie', '24', 24, signal())).toEqual(item(25))
    expect(s.episodes.mock.calls.map(call => call[1])).toEqual([0, 1])
    expect(await findNextVisibleEpisode(s.value, 'serie', '25', 25, signal())).toBeNull()
  })
  it('rescans after a stale page hint and fails closed on missing content or network error', async () => {
    const s = source([[item(1), item(2)]])
    expect(await findNextVisibleEpisode(s.value, 'serie', '1', 30, signal())).toEqual(item(2))
    await expect(findNextVisibleEpisode(s.value, 'serie', 'missing', 0, signal())).rejects.toThrow()
    s.episodes.mockRejectedValueOnce(new Error('offline'))
    await expect(findNextVisibleEpisode(s.value, 'serie', '1', 0, signal())).rejects.toThrow('offline')
  })
})
