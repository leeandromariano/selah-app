import { createClient } from '@supabase/supabase-js'
import { createEnvironmentClient } from './environment'
import type { BuildEnvironment } from './environment'

declare const __SELAH_ENVIRONMENT__: BuildEnvironment
export const supabase = createEnvironmentClient(__SELAH_ENVIRONMENT__, createClient, window.location.origin)
export const environmentName = __SELAH_ENVIRONMENT__.mode === 'development' ? 'DEV' : __SELAH_ENVIRONMENT__.mode === 'staging' ? 'STAGING' : 'PROD'
export const loginMethod = __SELAH_ENVIRONMENT__.mode === 'development' ? 'local' : 'email'
