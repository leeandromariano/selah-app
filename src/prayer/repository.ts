import type { SupabaseClient } from '@supabase/supabase-js'

export type PrayerStatus = 'open' | 'answered'
export type PrayerItem = { id: string; request: string; created_on: string; review_on: string; status: PrayerStatus; answered_on: string | null; testimony: string | null; days_since: number }
export type PrayerList = { status: PrayerStatus; total: number; page: number; size: number; items: PrayerItem[] }

export const prayerReviewOptions: { days: number; label: string }[] = [
  { days: 7, label: 'Daqui a 7 dias' }, { days: 14, label: 'Daqui a 14 dias' }, { days: 30, label: 'Daqui a 30 dias' },
  { days: 60, label: 'Daqui a 2 meses' }, { days: 90, label: 'Daqui a 3 meses' }, { days: 180, label: 'Daqui a 6 meses' },
]
export const defaultReviewDays = 30

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const day = /^\d{4}-\d{2}-\d{2}$/
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

// "2026-12-12" -> "12/12/2026", sem passar por fuso horário.
export function formatDay(value: string) { const [y, m, d] = value.split('-'); return `${d}/${m}/${y}` }
export function daysAgo(days: number) { return `${days} ${days === 1 ? 'dia' : 'dias'}` }

function parseItem(value: unknown): PrayerItem {
  const v = value as PrayerItem
  if (!v || typeof v.id !== 'string' || !uuid.test(v.id) || typeof v.request !== 'string' || !v.request.trim()
    || !day.test(String(v.created_on)) || !day.test(String(v.review_on)) || !['open', 'answered'].includes(v.status)
    || (v.answered_on !== null && !day.test(String(v.answered_on))) || (v.testimony !== null && typeof v.testimony !== 'string') || !count(v.days_since)) throw Error('Invalid prayer item')
  return { id: v.id, request: v.request, created_on: v.created_on, review_on: v.review_on, status: v.status, answered_on: v.answered_on, testimony: v.testimony, days_since: v.days_since }
}

export function createPrayerRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data as unknown
  }
  const validDays = (days: number) => prayerReviewOptions.some(option => option.days === days)
  return {
    async create(request: string, days: number, devotionalId: string | null = null): Promise<PrayerItem> {
      const text = request.trim()
      if (text.length < 3 || text.length > 500 || !validDays(days) || (devotionalId !== null && !uuid.test(devotionalId))) throw Error('Pedido inválido.')
      return parseItem(await call('prayer_create', { p_request: text, p_days: days, p_devotional_id: devotionalId }))
    },
    async due(): Promise<PrayerItem[]> {
      const data = await call('prayer_due', {})
      if (!Array.isArray(data) || data.length > 10) throw Error('Invalid prayer list')
      return data.map(parseItem)
    },
    async list(status: PrayerStatus, page = 0, size = 20): Promise<PrayerList> {
      if (!['open', 'answered'].includes(status) || !Number.isInteger(page) || page < 0 || !Number.isInteger(size) || size < 1 || size > 50) throw Error('Consulta inválida.')
      const v = await call('prayer_list', { p_status: status, p_page: page, p_size: size }) as PrayerList
      if (!v || v.status !== status || !count(v.total) || v.page !== page || v.size !== size || !Array.isArray(v.items) || v.items.length > size) throw Error('Invalid prayer list')
      return { status, total: v.total, page, size, items: v.items.map(parseItem) }
    },
    async answer(id: string, testimony = ''): Promise<PrayerItem> {
      const text = testimony.trim()
      if (!uuid.test(id) || text.length > 500) throw Error('Resposta inválida.')
      return parseItem(await call('prayer_answer', { p_id: id, p_testimony: text || null }))
    },
    async snooze(id: string, days = defaultReviewDays): Promise<PrayerItem> {
      if (!uuid.test(id) || !validDays(days)) throw Error('Resposta inválida.')
      return parseItem(await call('prayer_snooze', { p_id: id, p_days: days }))
    },
    async remove(id: string): Promise<void> {
      if (!uuid.test(id)) throw Error('Resposta inválida.')
      const v = await call('prayer_delete', { p_id: id }) as { deleted?: boolean }
      if (v?.deleted !== true) throw Error('Invalid prayer delete')
    },
  }
}
