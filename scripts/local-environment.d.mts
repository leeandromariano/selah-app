import type { localDocker } from './local-docker.mjs'
import type { SupabaseClient } from '@supabase/supabase-js'
type Environment = Record<string, string | undefined>
type Run = Parameters<typeof localDocker>[0]
export function localUrl(value: string | URL, role: string, options?: { root?: boolean }): URL
export function validateLocalEnvironment(environment: Environment): void
export function localFetch(transport?: typeof fetch, environment?: Environment): typeof fetch
export function openLocalEnvironment(options?: { run?: Run; environment?: Environment; transport?: typeof fetch }): {
  api: string; mail: string; frontend: string; publicKey: string
  docker: ReturnType<typeof localDocker>; fetch: typeof fetch
  client(): SupabaseClient; psql(sql: string): string
}
export function prepareLocalScript(): ReturnType<typeof openLocalEnvironment>
