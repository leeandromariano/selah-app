import { createClient } from '@supabase/supabase-js'
import { createEnvironmentClient } from './environment'
import type { BuildEnvironment } from './environment'

declare const __SELAH_ENVIRONMENT__: BuildEnvironment
export const supabase = createEnvironmentClient(__SELAH_ENVIRONMENT__, createClient, window.location.origin)
// Remote modes remain blocked in createEnvironmentClient; this selects the
// reviewed email-only path when a future change explicitly enables them.
export const loginMethod = __SELAH_ENVIRONMENT__.mode === 'development' ? 'local' : 'email'
