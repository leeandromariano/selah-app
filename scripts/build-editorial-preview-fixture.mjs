// Local build fixture only: fictional project, public key and origins.
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
const env = { ...process.env }
for (const key of Object.keys(env)) if (key.startsWith('VITE_') || key.startsWith('SELAH_')) delete env[key]
const ref = 'ssssssssssssssssssss'
Object.assign(env, {
  SELAH_STAGING_BUILD: 'LOCAL_STAGING_BUILD',
  SELAH_STAGING_PREVIEW_BUILD: 'LOCAL_STAGING_PREVIEW_BUILD',
  SELAH_EDITORIAL_PREVIEW_BUILD: 'REVIEWED_EDITORIAL_PREVIEW',
  SELAH_EDITORIAL_BACKEND_VALIDATED_REF: ref,
  VITE_APP_ENV: 'STAGING',
  VITE_STAGING_SUPABASE_PROJECT_REF: ref,
  VITE_STAGING_SUPABASE_URL: 'https://' + ref + '.supabase.co',
  VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fictiononly',
  VITE_STAGING_SITE_ORIGIN: 'https://staging.example.invalid',
  VITE_STAGING_PREVIEW_ORIGIN: 'https://preview.staging.example.invalid',
})
const args = process.platform === 'win32' ? ['/d', '/s', '/c', 'npm.cmd run build:staging'] : ['run', 'build:staging']
const result = spawnSync(process.platform === 'win32' ? process.env.ComSpec : 'npm', args, { env, stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status ?? 1)
const js = readdirSync('dist/assets').filter(name => name.endsWith('.js')).map(name => readFileSync('dist/assets/' + name, 'utf8')).join('\n')
if (!js.includes('Temas e séries')) throw new Error('Editorial Preview was not enabled in fixture')
console.log('PASS: fictional Preview build enables editorial navigation; no deployment.')
