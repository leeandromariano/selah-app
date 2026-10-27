/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest'

const boundary = vi.hoisted(() => ({ exists: vi.fn(), write: vi.fn(), read: vi.fn(), list: vi.fn(), spawn: vi.fn(), prepare: vi.fn(), psql: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: boundary.exists, writeFileSync: boundary.write, readFileSync: boundary.read, readdirSync: boundary.list }))
vi.mock('node:child_process', () => ({ spawnSync: boundary.spawn }))
vi.mock('../../scripts/local-environment.mjs', () => ({ prepareLocalScript: boundary.prepare }))
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.resetModules() })

describe('operações de arquivos após preflight local', () => {
  const prior = '20261023000100\n20261026000100\n20261026000200\n20261026000300\n20261026000400\n20261026000500\n'
  it('migração de login já aplicada não dispara CLI nem grava dados', async () => {
    boundary.prepare.mockReturnValue({ psql: boundary.psql })
    boundary.psql.mockReturnValue(prior + '20261027000100\n')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await import('../../scripts/apply-local-login-migration.mjs')
    expect(boundary.spawn).not.toHaveBeenCalled()
    expect(boundary.psql).toHaveBeenCalledExactlyOnceWith('begin read only; select version from supabase_migrations.schema_migrations order by version; rollback;')
  })
  it('histórico inesperado impede aplicação de migração', async () => {
    boundary.prepare.mockReturnValue({ psql: boundary.psql })
    boundary.psql.mockReturnValue('20261023000100\n')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const status = process.exitCode
    try {
      await import('../../scripts/apply-local-login-migration.mjs')
      expect(boundary.spawn).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    } finally { process.exitCode = status }
  })
  it('migração futura pendente exige revisão sem chamar CLI', async () => {
    boundary.prepare.mockReturnValue({ psql: boundary.psql })
    boundary.psql.mockReturnValue(prior)
    boundary.list.mockReturnValue(['20261027000100_password_login_limits.sql', '20990101000000_unreviewed.sql'])
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const status = process.exitCode
    try {
      await import('../../scripts/apply-local-login-migration.mjs')
      expect(boundary.spawn).not.toHaveBeenCalled()
      expect(process.exitCode).toBe(1)
    } finally { process.exitCode = status }
  })
  it('aplica somente a migração revisada com CLI local e Docker fixado', async () => {
    const env = { DOCKER_HOST: 'npipe:////./pipe/dockerDesktopLinuxEngine' }
    boundary.prepare.mockReturnValue({ psql: boundary.psql, docker: { env } })
    boundary.psql.mockReturnValue(prior)
    boundary.list.mockReturnValue(['20261026000500_whatsapp_intake_metadata.sql', '20261027000100_password_login_limits.sql'])
    boundary.spawn.mockReturnValue({ status: 0 })
    vi.spyOn(console, 'log').mockImplementation(() => {})
    await import('../../scripts/apply-local-login-migration.mjs')
    expect(boundary.spawn).toHaveBeenCalledExactlyOnceWith(process.execPath, ['node_modules/supabase/dist/supabase.js', 'migration', 'up', '--local'], { env, encoding: 'utf8' })
  })
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
