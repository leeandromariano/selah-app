// Reads CLI local status in memory and writes only the public frontend settings.
import { spawnSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
const file = '.env.development.local'
if (existsSync(file)) { console.log('Local environment already exists; preserved without reading or overwriting.'); process.exit(0) }
const status = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'status', '-o', 'json'], { encoding: 'utf8' })
if (status.status !== 0) { console.error('Local Supabase status unavailable; no environment written.'); process.exit(1) }
const config = JSON.parse(status.stdout)
if (config.API_URL !== 'http://127.0.0.1:54321') throw new Error('Unexpected API target; no environment written')
const key = config.PUBLISHABLE_KEY || config.ANON_KEY
if (!key || /[\r\n]/.test(key) || key.startsWith('sb_secret_')) throw new Error('Local public key unavailable')
writeFileSync(file, `VITE_SUPABASE_URL=http://127.0.0.1:54321\nVITE_SUPABASE_PUBLISHABLE_KEY=${key}\n`, { flag: 'wx' })
console.log('Created ignored development environment with local URL and public key only. Values not printed.')
