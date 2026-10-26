/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({ exists: vi.fn(), write: vi.fn(), read: vi.fn(), prepare: vi.fn(), psql: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: boundary.exists, writeFileSync: boundary.write, readFileSync: boundary.read }))
vi.mock('../../scripts/local-environment.mjs', () => ({ prepareLocalScript: boundary.prepare }))
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.resetModules() })

describe('operações de arquivos após preflight local', () => {
  it('configuração nova grava somente URL/chave pública com criação exclusiva', async () => {
    boundary.prepare.mockReturnValue({ api: 'http://127.0.0.1:54321', publicKey: 'sb_publishable_fiction' })
    boundary.exists.mockReturnValue(false)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await import('../../scripts/configure-local-auth.mjs')
    expect(boundary.write).toHaveBeenCalledExactlyOnceWith('.env.development.local', 'VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fiction\n', { flag: 'wx' })
    expect(boundary.read).not.toHaveBeenCalled()
  })
  it('preserva ambiente existente sem ler credenciais ou sobrescrever', async () => {
    boundary.prepare.mockReturnValue({})
    boundary.exists.mockReturnValue(true)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const exit = vi.spyOn(process, 'exit').mockImplementation(() => { throw new Error('stopped') })
    await expect(import('../../scripts/configure-local-auth.mjs')).rejects.toThrow('stopped')
    expect(exit).toHaveBeenCalledWith(0)
    expect(boundary.write).not.toHaveBeenCalled()
    expect(boundary.read).not.toHaveBeenCalled()
  })
  it('não verifica nem escreve arquivo se preflight falhar', async () => {
    boundary.prepare.mockImplementation(() => { throw new Error('unsafe destination') })
    await expect(import('../../scripts/configure-local-auth.mjs')).rejects.toThrow('unsafe destination')
    expect(boundary.exists).not.toHaveBeenCalled()
    expect(boundary.write).not.toHaveBeenCalled()
  })
  it('wrapper SQL envia a suíte integral ao psql protegido', async () => {
    boundary.prepare.mockReturnValue({ psql: boundary.psql })
    boundary.read.mockReturnValue('begin; select 1; rollback;')
    boundary.psql.mockReturnValue('ROLLBACK\n')
    vi.spyOn(process.stdout, 'write').mockReturnValue(true)
    await import('../../scripts/run-local-authorization.mjs')
    expect(boundary.read).toHaveBeenCalledExactlyOnceWith('supabase/tests/authorization.sql', 'utf8')
    expect(boundary.psql).toHaveBeenCalledExactlyOnceWith('begin; select 1; rollback;')
  })
})
