import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EditorialCatalogController } from './EditorialCatalogController'
import type { CatalogTransport } from './catalogRepository'
const id = '20000000-0000-4000-8000-000000000001'
const episode = { id, title: 'First episode', bible_reference: 'Sample reference' }
function transport() {
  const rpc = vi.fn((_name, args: { p_kind: string }) => ({ abortSignal: async () => ({
    data: args.p_kind === 'themes' ? [{ id, name: 'Hope', slug: 'hope', description: null }] : args.p_kind === 'series' ? [{ id, title: 'Journey', slug: 'journey', description: null }] : [episode], error: null,
  }) }))
  return { value: { rpc } as CatalogTransport, rpc }
}
describe('isolated editorial controller', () => {
  it('loads themes and passes a selected devotional to the reader', async () => {
    const user = userEvent.setup(), source = transport(), onRead = vi.fn()
    render(<EditorialCatalogController transport={source.value} onRead={onRead} />)
    await user.click(await screen.findByRole('button', { name: /hope/i }))
    await user.click(await screen.findByRole('button', { name: /first episode/i }))
    expect(onRead).toHaveBeenCalledWith(id, null)
    expect(source.rpc).toHaveBeenCalledWith('reader_editorial_catalog', expect.objectContaining({ p_kind: 'devotionals', p_slug: 'hope' }))
  })
  it('loads episodes and supplies visible context', async () => {
    const user = userEvent.setup(), source = transport(), onRead = vi.fn()
    render(<EditorialCatalogController transport={source.value} onRead={onRead} />)
    await user.click(screen.getByRole('button', { name: /s.ries/i }))
    await user.click(await screen.findByRole('button', { name: /journey/i }))
    await user.click(await screen.findByRole('button', { name: /first episode/i }))
    expect(onRead).toHaveBeenCalledWith(id, expect.objectContaining({ visibleEpisodes: [{ id, title: 'First episode', bibleReference: 'Sample reference' }] }))
  })
  it('fails closed without transport', async () => {
    render(<EditorialCatalogController transport={null} onRead={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/dispon.vel/i))
    expect(screen.queryByText('Hope')).not.toBeInTheDocument()
  })
  it('distinguishes a network failure from missing transport', async () => {
    const rpc = vi.fn(() => ({ abortSignal: async () => ({ data: null, error: { message: 'network' } }) }))
    render(<EditorialCatalogController transport={{ rpc } as CatalogTransport} onRead={vi.fn()} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('appends the next page of themes without discarding the first', async () => {
    const user = userEvent.setup()
    const item = (index: number) => ({ id: '20000000-0000-4000-8000-' + String(index + 1).padStart(12, '0'), name: 'Theme ' + index, slug: 'theme-' + index, description: null })
    const rpc = vi.fn((_name, args: { p_page: number }) => ({ abortSignal: async () => ({ data: args.p_page ? [item(25)] : Array.from({ length: 25 }, (_, i) => item(i)), error: null }) }))
    render(<EditorialCatalogController transport={{ rpc } as CatalogTransport} onRead={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: /carregar mais/i }))
    expect(await screen.findByText('Theme 25')).toBeInTheDocument()
    expect(screen.getByText('Theme 0')).toBeInTheDocument()
  })

})
