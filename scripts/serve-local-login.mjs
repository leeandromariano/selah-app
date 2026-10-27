import { spawn } from 'node:child_process'
import { prepareLocalScript } from './local-environment.mjs'
const local = prepareLocalScript()
// CLI runs only after the shared local preflight, with Docker pinned to its
// verified local socket. No arbitrary CLI arguments or remote commands accepted.
const child = spawn(process.execPath, ['node_modules/supabase/dist/supabase.js', 'functions', 'serve', 'password-login'], { env: local.docker.env, stdio: 'inherit' })
child.on('error', () => { console.error('Local function runtime failed to start.'); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
