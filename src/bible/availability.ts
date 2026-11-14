import type { BuildEnvironment } from '../lib/environment'

declare const __SELAH_ENVIRONMENT__: BuildEnvironment
export const bibleAvailable = import.meta.env?.DEV === true || (typeof __SELAH_ENVIRONMENT__ !== 'undefined' && __SELAH_ENVIRONMENT__.mode === 'staging' && __SELAH_ENVIRONMENT__.variables.VITE_STAGING_BIBLE_ENABLED === 'true')
