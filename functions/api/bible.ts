import { hostedBibleGateway } from '../../src/bible/hostedGateway'

type Database = { prepare(sql: string): { bind(...values: unknown[]): { first<T>(): Promise<T | null> } } }
type Env = { BIBLE_API_KEY?: string; BIBLE_SUPABASE_URL?: string; BIBLE_SUPABASE_PUBLIC_KEY?: string; BIBLE_SITE_ORIGIN?: string; BIBLE_QUOTA?: Database }

// Fail closed if the dedicated D1 quota database or any secret is missing.
export function onRequest({ request, env }: { request: Request; env: Env }) {
  const database = env.BIBLE_QUOTA
  return hostedBibleGateway(request, {
    apiKey: env.BIBLE_API_KEY, supabaseUrl: env.BIBLE_SUPABASE_URL,
    supabasePublicKey: env.BIBLE_SUPABASE_PUBLIC_KEY, siteOrigin: env.BIBLE_SITE_ORIGIN,
    quota: database && { async consume(bucket, maximum) {
      const result = await database.prepare('insert into bible_quota(bucket, count) values (?, 1) on conflict(bucket) do update set count = count + 1 where count < ? returning count').bind(bucket, maximum).first<{ count: number }>()
      return result !== null
    } },
  })
}
