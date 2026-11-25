import type { SupabaseClient } from '@supabase/supabase-js'
export type DeviceKey = { id: string; secret: string }
export type ReminderSnapshot = {
  enabled: boolean; invite_seen?: boolean; mode: 'simulation' | 'webpush'; vapid_public_key: string | null;
  device: null | { id: string; binding: string; mode: 'simulation' | 'webpush'; state: string; permission: string; time: string; timezone: string; expires_at: string | null };
  last: null | { kind: string | null; status: string; brt_day: string; local_day: string; at: string };
}
export type ReminderSettings = { enabled: boolean; time: string; timezone: string; permission: string; simulated: boolean; subscription?: object }
export function createReminderRepository(client: Pick<SupabaseClient, 'rpc'>) {
  async function invoke(name: string, args: Record<string, unknown>) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw new Error('Não foi possível atualizar seus lembretes. Verifique sua sessão e tente novamente.')
    return data
  }
  function parse(data: unknown): ReminderSnapshot {
    const value = data as ReminderSnapshot
    if (!value || typeof value.enabled !== 'boolean' || !['simulation', 'webpush'].includes(value.mode)
      || (value.device && (!/^\d{2}:\d{2}$/.test(value.device.time) || typeof value.device.binding !== 'string')))
      throw Error('Resposta de lembretes indisponível.')
    return value
  }
  const identity = (key: DeviceKey | null) => ({ p_device: key?.id ?? null, p_secret: key?.secret ?? null })
  return {
    async get(key: DeviceKey | null) { return parse(await invoke('get_my_reminders', identity(key))) },
    async save(key: DeviceKey, settings: ReminderSettings) {
      return parse(await invoke('save_my_reminders', { ...identity(key), p_enabled: settings.enabled,
        p_time: settings.time, p_timezone: settings.timezone, p_permission: settings.permission,
        p_subscription: settings.subscription ?? null, p_simulated: settings.simulated }))
    },
    // Marca na conta que o convite de notificações já foi mostrado (uma vez por pessoa).
    async markInviteSeen() { await invoke('mark_reminder_invite_seen', {}) },
    async revoke(key: DeviceKey) { await invoke('revoke_my_push_device', identity(key)) },
    async confirm(key: DeviceKey, proof: string) { await invoke('confirm_my_push_device', { ...identity(key), p_proof: proof }) },
  }
}
