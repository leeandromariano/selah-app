export function validateLocalAuthConfig(url: string, key: string) {
  const target = new URL(url)
  if (target.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(target.hostname) || target.port !== '54321' || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('Esta etapa permite somente o Supabase local na porta 54321.')
  }
  if (key.startsWith('sb_publishable_')) return
  try {
    const payload = JSON.parse(atob(key.split('.')[1].replaceAll('-', '+').replaceAll('_', '/')))
    if (payload.role === 'anon') return
  } catch { /* Fail closed for malformed and privileged keys. */ }
  throw new Error('Use somente a chave pública local (publishable ou anon).')
}
