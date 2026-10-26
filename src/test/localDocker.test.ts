import { describe, expect, it, vi } from 'vitest'
import { localDocker } from '../../scripts/local-docker.mjs'

describe('limite local dos scripts administrativos', () => {
  it('nega DOCKER_HOST de rede antes de chamar qualquer comando', () => {
    for (const endpoint of ['tcp://127.0.0.1:2375', 'tcp://remote.example.invalid:2376', 'ssh://remote.example.invalid', 'npipe:////remote/pipe/docker_engine']) {
      const run = vi.fn()
      expect(() => localDocker(run, { DOCKER_HOST: endpoint })).toThrow('Only local Docker sockets')
      expect(run).not.toHaveBeenCalled()
    }
  })
  it('nega contexto de rede após ler somente metadados, sem consultar daemon', () => {
    const run = vi.fn().mockReturnValue({ status: 0, stdout: JSON.stringify('ssh://remote.example.invalid') })
    expect(() => localDocker(run, { DOCKER_CONTEXT: 'remote-fiction' })).toThrow('Only local Docker sockets')
    expect(run).toHaveBeenCalledExactlyOnceWith('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], expect.any(Object))
  })
  it('fixa pipe local e impede que um contexto herdado redirecione as operações', () => {
    const endpoint = 'npipe:////./pipe/dockerDesktopLinuxEngine'
    const run = vi.fn().mockReturnValue({ status: 0, stdout: '' })
    const docker = localDocker(run, { DOCKER_HOST: endpoint, DOCKER_CONTEXT: 'remote-fiction', DOCKER_TLS_VERIFY: '1', DOCKER_CERT_PATH: 'fiction' })
    docker.run(['port', 'local-fixture', '5432/tcp'], { encoding: 'utf8' })
    expect(run).toHaveBeenCalledWith('docker', ['--host', endpoint, 'port', 'local-fixture', '5432/tcp'], { encoding: 'utf8', env: { DOCKER_HOST: endpoint } })
    expect(docker.env).not.toHaveProperty('DOCKER_CONTEXT')
  })
  it('fixa socket Unix descoberto antes de qualquer comando posterior', () => {
    const run = vi.fn().mockReturnValue({ status: 0, stdout: JSON.stringify('unix:///var/run/docker.sock') })
    const docker = localDocker(run, {})
    docker.run(['exec', 'local-fixture', 'psql'], { input: 'synthetic fixture' })
    expect(run.mock.calls[1]).toEqual(['docker', ['--host', 'unix:///var/run/docker.sock', 'exec', 'local-fixture', 'psql'], { input: 'synthetic fixture', env: { DOCKER_HOST: 'unix:///var/run/docker.sock' } }])
  })
  it('recusa erro de contexto sem executar concessão', () => {
    const run = vi.fn().mockReturnValue({ status: 1, stdout: '' })
    expect(() => localDocker(run, {})).toThrow('Docker context unavailable')
  })
})
