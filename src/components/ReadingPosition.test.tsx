import { webcrypto } from 'node:crypto'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { positionKey, savePosition } from '../reading/position'
import { ReadingPosition } from './ReadingPosition'

const userId = 'fiction-user', devotionalId = 'fiction-devotional'
const body = <article><h1>Conteúdo fictício</h1></article>
beforeEach(() => {
  localStorage.clear()
  vi.stubGlobal('crypto', webcrypto)
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(2000)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ top: 100 - window.scrollY } as DOMRect))
  Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true })
})
afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('retomada local no leitor', () => {
  it('restaura somente quando a rota é de retomada', async () => {
    const key = (await positionKey(userId, devotionalId, 'DEV'))!
    savePosition(key, 1, 0.5)
    const view = render(<ReadingPosition userId={userId} devotionalId={devotionalId} revision={1} resume={false}>{body}</ReadingPosition>)
    await screen.findByRole('heading', { name: 'Conteúdo fictício' })
    await new Promise(resolve => setTimeout(resolve, 30))
    expect(window.scrollTo).not.toHaveBeenCalled()
    view.unmount()
    render(<ReadingPosition userId={userId} devotionalId={devotionalId} revision={1} resume>{body}</ReadingPosition>)
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 100 + 0.5 * (2000 - window.innerHeight)))
  })
  it('salva proporcionalmente com limite de gravações e descarrega ao sair', async () => {
    const key = (await positionKey(userId, devotionalId, 'DEV'))!
    const set = vi.spyOn(Storage.prototype, 'setItem')
    const view = render(<ReadingPosition userId={userId} devotionalId={devotionalId} revision={1} resume>{body}</ReadingPosition>)
    await screen.findByRole('heading', { name: 'Conteúdo fictício' })
    window.scrollY = 500
    fireEvent.scroll(window); fireEvent.scroll(window); fireEvent.scroll(window)
    expect(set).not.toHaveBeenCalled()
    view.unmount()
    expect(set).toHaveBeenCalledTimes(1)
    expect(readSaved(key).revision).toBe(1)
    expect(readSaved(key).ratio).toBeCloseTo(400 / (2000 - window.innerHeight))
  })
  it('descarta posição de outra revisão e explica que o texto foi atualizado', async () => {
    const key = (await positionKey(userId, devotionalId, 'DEV'))!
    savePosition(key, 1, 0.7)
    render(<ReadingPosition userId={userId} devotionalId={devotionalId} revision={2} resume>{body}</ReadingPosition>)
    expect(await screen.findByText(/devocional foi atualizado/)).toBeVisible()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
  it('exibe a leitura sem erro quando storage falha', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    render(<ReadingPosition userId={userId} devotionalId={devotionalId} revision={1} resume>{body}</ReadingPosition>)
    expect(await screen.findByRole('heading', { name: 'Conteúdo fictício' })).toBeVisible()
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})

function readSaved(key: string) { return JSON.parse(localStorage.getItem(key)!) as { revision: number; ratio: number } }
