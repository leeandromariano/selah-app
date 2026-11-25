import type { SupabaseClient } from '@supabase/supabase-js'

export type InstantCompletion = { completed_at: string; completed_day: string }

// Conclusão do devocional em etapas, sem tempo mínimo: o servidor decide usuário, data e horário e registra uma conclusão por devocional.
export async function completeDevotionalNow(client: Pick<SupabaseClient, 'rpc'>, devotionalId: string): Promise<InstantCompletion> {
  const { data, error } = await client.rpc('complete_devotional_now', { p_devotional_id: devotionalId })
  if (error) throw Error('Não foi possível concluir agora.')
  const value = data as { status?: string; completed_at?: unknown; completed_day?: unknown } | null
  if (!value || value.status !== 'completed' || typeof value.completed_at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(String(value.completed_day))) throw Error('Não foi possível concluir agora.')
  return { completed_at: value.completed_at, completed_day: String(value.completed_day) }
}
