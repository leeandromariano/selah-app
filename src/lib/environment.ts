export type EnvironmentName = 'DEV' | 'STAGING' | 'PROD'
export type Variables = Record<string, string | undefined>
export type BuildEnvironment = { mode: string; variables: Variables }
const modes: Record<string, EnvironmentName> = { development: 'DEV', staging: 'STAGING', production: 'PROD' }
const localUrl = 'http://127.0.0.1:54321'
export type HostedEnvironment = { name: 'STAGING' | 'PROD'; url: string; key: string; projectRef: string; siteOrigin: string; login: 'email' }

// Validate a future contract without enabling a build or creating a client.
export function prepareHostedEnvironment(mode: 'staging' | 'production', variables: Variables): HostedEnvironment {
  resolveEnvironment(mode, variables) // retain all existing key, project and separation checks
  const name = mode === 'staging' ? 'STAGING' : 'PROD'
  const prefix = `VITE_${name}_SUPABASE_`
  const url = variables[`${prefix}URL`], key = variables[`${prefix}PUBLISHABLE_KEY`], projectRef = variables[`${prefix}PROJECT_REF`]
  const siteOrigin = variables[`VITE_${name}_SITE_ORIGIN`]
  if (!url || !key || !projectRef || !siteOrigin) throw new Error('Configuração hospedada incompleta.')
  let site: URL
  try { site = new URL(siteOrigin) } catch { throw new Error('Origem HTTPS inválida.') }
  if (site.protocol !== 'https:' || site.origin !== siteOrigin || site.username || site.password || site.port || !site.hostname.includes('.') || site.hostname === 'localhost' || site.hostname.endsWith('.localhost') || site.hostname.endsWith('.local') || /^\d+(?:\.\d+){3}$/.test(site.hostname) || site.hostname.includes(':')) throw new Error('Origem HTTPS hospedada inválida.')
  const other = name === 'STAGING' ? 'PROD' : 'STAGING'
  if (variables[`VITE_${other}_SITE_ORIGIN`] === siteOrigin) throw new Error('STAGING e PROD devem usar origens distintas.')
  return { name, url, key, projectRef, siteOrigin, login: 'email' }
}

export function validateHostedOrigin(config: HostedEnvironment, origin: string) {
  if (origin !== config.siteOrigin) throw new Error('Origem não corresponde ao ambiente hospedado.')
}

export function validatePublicKey(key: string) {
  if (!key || key !== key.trim() || /\s/.test(key)) throw new Error('Informe uma chave pública válida, sem espaços.')
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return
  try {
    const parts = key.split('.')
    if (parts.length !== 3 || parts.some(part => !/^[A-Za-z0-9_-]+$/.test(part))) throw new Error()
    const payload = JSON.parse(atob(parts[1].replaceAll('-', '+').replaceAll('_', '/')))
    if (payload.role === 'anon') return
  } catch { /* Public shape/role check only; the server verifies authenticity. */ }
  throw new Error('Use somente chave publishable ou JWT anon; chaves privilegiadas são proibidas.')
}

function sameOrAbsent(first: string | undefined, second: string | undefined) {
  if (first !== undefined && second !== undefined && first !== second) throw new Error('Configurações conflitantes para o ambiente selecionado.')
}

export function resolveEnvironment(mode: string, variables: Variables) {
  const name = Object.hasOwn(modes, mode) ? modes[mode] : undefined
  if (!name) throw new Error('Modo desconhecido. Use development, staging ou production.')
  if (variables.VITE_APP_ENV !== undefined && variables.VITE_APP_ENV !== name) throw new Error('VITE_APP_ENV não corresponde ao modo do Vite.')
  for (const [key, value] of Object.entries(variables)) {
    if (value && /(?:SERVICE_ROLE|SECRET|ADMIN_KEY|ACCESS_TOKEN|DB_PASSWORD)/i.test(key)) throw new Error('Variável privilegiada proibida na configuração pública.')
  }
  const prefix = `VITE_${name}_SUPABASE_`
  const selectedUrl = variables[`${prefix}URL`]
  const selectedKey = variables[`${prefix}PUBLISHABLE_KEY`]
  if (name === 'DEV') {
    // Compatibility only for the existing, guarded local configuration script.
    sameOrAbsent(selectedUrl, variables.VITE_SUPABASE_URL)
    sameOrAbsent(selectedKey, variables.VITE_SUPABASE_PUBLISHABLE_KEY)
    const url = selectedUrl ?? variables.VITE_SUPABASE_URL
    const key = selectedKey ?? variables.VITE_SUPABASE_PUBLISHABLE_KEY
    if (url !== localUrl) throw new Error('DEV exige exatamente http://127.0.0.1:54321, sem caminho ou destino alternativo.')
    if (!key) throw new Error('Configure a chave pública DEV em .env.development.local.')
    validatePublicKey(key)
    return { name, enabled: true as const, url: localUrl, key }
  }
  // Generic variables cannot silently supply a remote environment.
  if (variables.VITE_SUPABASE_URL || variables.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Variáveis genéricas de Supabase são exclusivas de DEV; não podem configurar STAGING/PROD.')
  const ref = variables[`${prefix}PROJECT_REF`]
  if (selectedUrl || selectedKey || ref) {
    if (!selectedUrl || !selectedKey || !ref) throw new Error('Configuração futura incompleta: informe URL, chave pública e referência do projeto exclusivo.')
    if (!/^[a-z0-9]{20}$/.test(ref) || selectedUrl !== `https://${ref}.supabase.co`) throw new Error('URL futura não corresponde ao projeto Supabase HTTPS declarado.')
    validatePublicKey(selectedKey)
    const other = name === 'STAGING' ? 'PROD' : 'STAGING'
    if (variables[`VITE_${other}_SUPABASE_URL`] === selectedUrl || variables[`VITE_${other}_SUPABASE_PROJECT_REF`] === ref || variables[`VITE_${other}_SUPABASE_PUBLISHABLE_KEY`] === selectedKey) throw new Error('STAGING e PROD devem usar projetos e chaves distintos.')
    if (!selectedKey.startsWith('sb_publishable_')) {
      const payload = JSON.parse(atob(selectedKey.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')))
      if (payload.ref !== ref) throw new Error('JWT anon não corresponde ao projeto futuro declarado.')
    }
  }
  // Baseline guard; STAGING's separately validated path is in the build/factory.
  // PROD has no enabled path.
  return { name, enabled: false as const, reason: `${name} está desabilitado nesta etapa. Nenhuma conexão remota é permitida.` }
}

export function requireEnabledEnvironment(mode: string, variables: Variables) {
  const config = resolveEnvironment(mode, variables)
  if (!config.enabled) throw new Error(config.reason)
  return config
}

export function createBuildEnvironment(mode: string, variables: Variables, stagingBuildAuthorized = false, previewBuildAuthorized = false): BuildEnvironment {
  if (mode === 'staging') {
    if (!stagingBuildAuthorized) throw new Error('Build STAGING exige autorização local explícita.')
    const preview = variables.VITE_STAGING_PREVIEW_ORIGIN
    if (previewBuildAuthorized !== Boolean(preview)) throw new Error('Preview requires explicit build authorization and origin.')
    if (previewBuildAuthorized) prepareHostedEnvironment('staging', variables)
    const selected = previewBuildAuthorized ? { ...variables, VITE_STAGING_SITE_ORIGIN: preview } : variables
    const config = prepareHostedEnvironment('staging', selected)
    const bibleEnabled = variables.VITE_STAGING_BIBLE_ENABLED
    if (bibleEnabled !== undefined && bibleEnabled !== 'true' && bibleEnabled !== 'false') throw new Error('Sinal da Bíblia hospedada inválido.')
    return { mode, variables: { VITE_APP_ENV: config.name, VITE_STAGING_SUPABASE_URL: config.url, VITE_STAGING_SUPABASE_PROJECT_REF: config.projectRef, VITE_STAGING_SUPABASE_PUBLISHABLE_KEY: config.key, VITE_STAGING_SITE_ORIGIN: config.siteOrigin, VITE_STAGING_BIBLE_ENABLED: bibleEnabled === 'true' ? 'true' : 'false' } }
  }
  const config = requireEnabledEnvironment(mode, variables)
  return { mode, variables: { VITE_APP_ENV: config.name, VITE_DEV_SUPABASE_URL: config.url, VITE_DEV_SUPABASE_PUBLISHABLE_KEY: config.key } }
}

export function prepareClientConfiguration(build: BuildEnvironment, origin: string) {
  let url: string, key: string, login: 'local' | 'email'
  if (build.mode === 'staging' || build.mode === 'production') {
    const config = prepareHostedEnvironment(build.mode, build.variables)
    validateHostedOrigin(config, origin)
    url = config.url; key = config.key; login = config.login
  } else {
    const config = requireEnabledEnvironment(build.mode, build.variables)
    let source: URL
    try { source = new URL(origin) } catch { throw new Error('Origem local inválida; cliente não inicializado.') }
    if (source.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(source.hostname) || !['5173', '4173'].includes(source.port) || source.origin !== origin) throw new Error('O artefato DEV só pode iniciar em uma origem local nas portas 5173/4173.')
    url = config.url; key = config.key; login = 'local'
  }
  return { url, key, login, redirectOrigin: origin, options: { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' as const } } }
}

export function createEnvironmentClient<T>(build: BuildEnvironment, factory: (url: string, key: string, options: { auth: { persistSession: boolean; autoRefreshToken: boolean; detectSessionInUrl: boolean; flowType: 'implicit' } }) => T, origin: string) {
  const config = prepareClientConfiguration(build, origin)
  // STAGING accepts only the reviewed HTTPS contract and its exact site origin.
  // PROD still fails closed before the SDK factory is invoked.
  if (build.mode !== 'staging') requireEnabledEnvironment(build.mode, build.variables)
  return factory(config.url, config.key, config.options)
}
