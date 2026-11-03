import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { positionKey, readPosition, savePosition } from './position'

beforeEach(() => { localStorage.clear(); vi.stubGlobal('crypto', webcrypto) })
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

describe('posição local de leitura', () => {
  it('separa conta, devocional e ambiente sem armazenar identificador da conta ou conteúdo', async () => {
    const a = await positionKey('user-a', 'devocional-a', 'DEV')
    const otherUser = await positionKey('user-b', 'devocional-a', 'DEV')
    const otherDevotional = await positionKey('user-a', 'devocional-b', 'DEV')
    const otherEnvironment = await positionKey('user-a', 'devocional-a', 'STAGING')
    expect(a).not.toContain('user-a')
    expect(new Set([a, otherUser, otherDevotional, otherEnvironment]).size).toBe(4)
    savePosition(a!, 1, 0.4)
    expect(JSON.parse(localStorage.getItem(a!)!)).toEqual({ revision: 1, ratio: 0.4 })
    expect(readPosition(otherUser!, 1).ratio).toBeNull()
    expect(readPosition(otherDevotional!, 1).ratio).toBeNull()
  })
  it('recusa revisão antiga, dados corrompidos e proporções inválidas', async () => {
    const key = (await positionKey('user', 'devotional', 'DEV'))!
    savePosition(key, 1, 0.5)
    expect(readPosition(key, 2)).toEqual({ ratio: null, stale: true })
    localStorage.setItem(key, '{invalid')
    expect(readPosition(key, 1)).toEqual({ ratio: null, stale: false })
    localStorage.setItem(key, JSON.stringify({ revision: 1, ratio: 2 }))
    expect(readPosition(key, 1).ratio).toBeNull()
  })
  it('não bloqueia quando a criptografia ou o armazenamento estão indisponíveis', async () => {
    vi.stubGlobal('crypto', {})
    expect(await positionKey('user', 'devotional', 'DEV')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    expect(readPosition('fiction', 1).ratio).toBeNull()
    expect(() => savePosition('fiction', 1, 0.5)).not.toThrow()
    vi.restoreAllMocks()
  })
})
