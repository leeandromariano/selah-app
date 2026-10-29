import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

describe('STAGING OWNER execution gate', () => {
  it.each(['hepndavkzuktakezrmsj', 'wrongproject00000000', 'production'])('refuses every target without exposing supplied values', (project) => {
    const result = spawnSync(process.execPath, ['scripts/staging-owner.mjs', 'grant', project, 'synthetic-sensitive-value'], { encoding: 'utf8' })
    expect(result.status).toBe(1)
    expect(result.stdout + result.stderr).toContain('bloqueada')
    expect(result.stdout + result.stderr).not.toContain(project)
    expect(result.stdout + result.stderr).not.toContain('synthetic-sensitive-value')
  })
})
