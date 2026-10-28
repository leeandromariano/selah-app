import { prepareLocalScript } from './local-environment.mjs'
const local=prepareLocalScript()
if(process.argv.length!==3||process.argv[2]!=='--cleanup')throw Error('Explicit --cleanup required; only discussion retention is affected')
local.psql('select private.cleanup_discussion();')
console.log('Local discussion retention completed. No reading, user or membership operations.')
