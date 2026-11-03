type Variables = Record<string, string | undefined>

/** Build-time UX gate only. Database authorization remains authoritative. */
export function editorialBuildEnabled(mode: string, command: string, variables: Variables, environment: Variables): boolean {
  const requested = environment.SELAH_EDITORIAL_PREVIEW_BUILD
  const validatedRef = environment.SELAH_EDITORIAL_BACKEND_VALIDATED_REF
  if (requested || validatedRef) {
    const ref = variables.VITE_STAGING_SUPABASE_PROJECT_REF
    const main = variables.VITE_STAGING_SITE_ORIGIN
    const preview = variables.VITE_STAGING_PREVIEW_ORIGIN
    if (requested !== 'REVIEWED_EDITORIAL_PREVIEW' || !ref || validatedRef !== ref ||
      mode !== 'staging' || command !== 'build' ||
      environment.SELAH_STAGING_BUILD !== 'LOCAL_STAGING_BUILD' ||
      environment.SELAH_STAGING_PREVIEW_BUILD !== 'LOCAL_STAGING_PREVIEW_BUILD' ||
      !main || !preview || main === preview) {
      throw new Error('Preview editorial exige build Preview e backend STAGING previamente validado.')
    }
    return true
  }
  return mode === 'development' && command === 'serve' && environment.SELAH_EDITORIAL_LOCAL === '1'
}
