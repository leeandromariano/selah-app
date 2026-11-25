import type { BuildEnvironment } from '../lib/environment'

declare const __SELAH_ENVIRONMENT__: BuildEnvironment

// Local stack after the incremental migration. Hosted builds opt in only after
// their own migration and review, independently of the Bible gateway flag.
export const guidedDevotionalsEnabled = import.meta.env?.DEV === true ||
  (typeof __SELAH_ENVIRONMENT__ !== 'undefined' && __SELAH_ENVIRONMENT__.mode === 'staging'
    && __SELAH_ENVIRONMENT__.variables.VITE_STAGING_GUIDED_DEVOTIONAL_ENABLED === 'true')
