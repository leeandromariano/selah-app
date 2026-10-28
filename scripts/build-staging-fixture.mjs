// Local build only: fixed fictional values, no network and no hosted resource.
import { spawnSync } from 'node:child_process'

const env = { ...process.env }
for (const key of Object.keys(env)) if (key.startsWith('VITE_') || key === 'SELAH_STAGING_BUILD') delete env[key]
Object.assign(env, {
  SELAH_STAGING_BUILD: 'LOCAL_STAGING_BUILD', VITE_APP_ENV: 'STAGING',
  VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '',
  VITE_STAGING_SUPABASE_PROJECT_REF: 'ssssssssssssssssssss',
  VITE_STAGING_SUPABASE_URL: 'https://ssssssssssssssssssss.supabase.co',
  VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictiononly',
  VITE_STAGING_SITE_ORIGIN: 'https://staging.example.invalid',
})
const command = process.platform === 'win32' ? 'cmd.exe' : 'npm'
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build:staging'] : ['run', 'build:staging']
const result = spawnSync(command, args, { env, stdio: 'inherit' })
if (result.error) console.error('Não foi possível iniciar o build de fixture.')
process.exitCode = result.status ?? 1
