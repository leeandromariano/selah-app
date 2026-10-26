import { spawnSync } from 'node:child_process'

// Resolve Docker metadata without connecting to the daemon; pin every later call.
export function localDocker(run = spawnSync, environment = process.env) {
  const isLocal = endpoint => typeof endpoint === 'string' && (/^unix:\/\/\/[^\r\n\0]+$/.test(endpoint) || /^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(endpoint))
  const host = environment.DOCKER_HOST
  const name = environment.DOCKER_CONTEXT
  if (host && !isLocal(host)) throw new Error('Only local Docker sockets are allowed')
  if (name && !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/.test(name)) throw new Error('Invalid Docker context name')
  const clean = { ...environment }
  for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete clean[key]
  let endpoint = host
  if (!host || name) {
    const args = ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}', ...(name ? ['--', name] : [])]
    const context = run('docker', args, { encoding: 'utf8', env: clean })
    if (context.status !== 0) throw new Error('Docker context unavailable')
    let selected
    try { selected = JSON.parse(context.stdout) } catch { throw new Error('Invalid Docker context metadata') }
    if (!isLocal(selected)) throw new Error('Only local Docker sockets are allowed')
    if (host && host !== selected) throw new Error('Conflicting Docker host and context')
    endpoint = selected
  }
  const env = { ...clean, DOCKER_HOST: endpoint }
  return {
    env,
    run(args, options = {}) { return run('docker', ['--host', endpoint, ...args], { ...options, env }) },
  }
}
