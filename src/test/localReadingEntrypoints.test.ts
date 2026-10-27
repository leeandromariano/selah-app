/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'
const boundary = vi.hoisted(() => ({ prepare: vi.fn(), psql: vi.fn(), spawn: vi.fn(), list: vi.fn(), read: vi.fn() }))
vi.mock('../../scripts/local-environment.mjs', () => ({ prepareLocalScript: boundary.prepare }))
vi.mock('node:child_process', () => ({ spawnSync: boundary.spawn }))
vi.mock('node:fs', () => ({ readdirSync: boundary.list, readFileSync: boundary.read }))
const previous = ['20261023000100','20261026000100','20261026000200','20261026000300','20261026000400','20261026000500','20261027000100']
const files = ['20261028000100_reading_completions.sql','20261028000200_reading_claims_access.sql']
function setup(versions: string[]) {
  boundary.prepare.mockReturnValue({ psql: boundary.psql, docker: { env: { DOCKER_HOST: 'npipe:////./pipe/dockerDesktopLinuxEngine' } } })
  boundary.psql.mockReturnValue(versions.join('\n'))
  boundary.list.mockReturnValue(files)
  boundary.read.mockReturnValue('begin;\n-- reviewed migration\ncommit;')
  boundary.spawn.mockReturnValue({ status: 0 })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
}
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.resetModules() })
describe('aplicação incremental protegida da leitura', () => {
  it('recusa antes de ler arquivos ou executar CLI se o preflight falhar', async () => {
    boundary.prepare.mockImplementation(() => { throw Error('remote context') })
    await expect(import('../../scripts/apply-local-reading-migration.mjs')).rejects.toThrow('remote context')
    expect(boundary.read).not.toHaveBeenCalled(); expect(boundary.spawn).not.toHaveBeenCalled()
  })
  it.each([previous, [...previous,'20261028000100']].map(versions => [versions]))('aplica somente a sequência conhecida com --local e Docker fixado (%j)', async versions => {
    setup(versions)
    await import('../../scripts/apply-local-reading-migration.mjs')
    expect(boundary.spawn).toHaveBeenCalledExactlyOnceWith(process.execPath, ['node_modules/supabase/dist/supabase.js','migration','up','--local'], { env: { DOCKER_HOST: 'npipe:////./pipe/dockerDesktopLinuxEngine' }, encoding: 'utf8' })
  })
  it('não reexecuta sequência já aplicada', async () => {
    setup([...previous,'20261028000100','20261028000200'])
    await import('../../scripts/apply-local-reading-migration.mjs')
    expect(boundary.spawn).not.toHaveBeenCalled()
  })
  it.each(['history', 'future-file', 'invalid-file'])('recusa histórico ou arquivos inesperados: %s', async kind => {
    setup(kind==='history' ? ['20261023000100'] : previous)
    if(kind==='future-file')boundary.list.mockReturnValue([...files,'20990101000000_unknown.sql'])
    if(kind==='invalid-file')boundary.read.mockReturnValue('not a reviewed transaction')
    const exit=process.exitCode
    try {
      await import('../../scripts/apply-local-reading-migration.mjs')
      expect(boundary.spawn).not.toHaveBeenCalled();expect(process.exitCode).toBe(1)
    } finally { process.exitCode=exit }
  })
})
