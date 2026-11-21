import { createClient } from '@supabase/supabase-js'
import { createEnvironmentClient } from './environment'
import type { BuildEnvironment } from './environment'

declare const __SELAH_ENVIRONMENT__: BuildEnvironment
export const supabase = createEnvironmentClient(__SELAH_ENVIRONMENT__, createClient, window.location.origin)
export const environmentName = __SELAH_ENVIRONMENT__.mode === 'development' ? 'DEV' : __SELAH_ENVIRONMENT__.mode === 'staging' ? 'STAGING' : 'PROD'
// local: tudo pela função local; hosted: e-mail direto e username pela função hospedada; email: somente e-mail.
export const loginMethod: 'local' | 'hosted' | 'email' = __SELAH_ENVIRONMENT__.mode === 'development' ? 'local' : 'hosted'
