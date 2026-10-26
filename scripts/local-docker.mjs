import { spawnSync } from 'node:child_process'

// Resolve Docker metadata without connecting to the daemon; pin every later call.
export function localDocker(run = spawnSync, environment = process.env) {
  let endpoint = environment.DOCKER_HOST
  if (!endpoint) {
    const context = run('docker', ['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}'], { encoding: 'utf8', env: environment })
    if (context.status !== 0) throw new Error('Docker context unavailable')
    endpoint = JSON.parse(context.stdout)
  }
  if (typeof endpoint !== 'string' || !(/^(unix:\/\/\/[^\r\n\0]+)$/.test(endpoint) || /^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(endpoint))) {
    throw new Error('Only local Docker sockets are allowed')
  }
  const env = { ...environment, DOCKER_HOST: endpoint }
  delete env.DOCKER_CONTEXT
  delete env.DOCKER_TLS_VERIFY
  delete env.DOCKER_CERT_PATH
  return {
    env,
    run(args, options = {}) { return run('docker', ['--host', endpoint, ...args], { ...options, env }) },
  }
}
