// Reads CLI local status in memory and writes only the public frontend settings.
import { prepareLocalScript } from './local-environment.mjs'
import { writeFileSync, existsSync } from 'node:fs'
const local = prepareLocalScript()
const file = '.env.development.local'
if (existsSync(file)) { console.log('Local environment already exists; preserved without reading or overwriting.'); process.exit(0) }
writeFileSync(file, `VITE_SUPABASE_URL=${local.api}\nVITE_SUPABASE_PUBLISHABLE_KEY=${local.publicKey}\n`, { flag: 'wx' })
console.log('Created ignored development environment with local URL and public key only. Values not printed.')
