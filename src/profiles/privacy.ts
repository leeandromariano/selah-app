import type { SupabaseClient } from '@supabase/supabase-js'
export type DeletionRequest = { user_id: string; requested_at: string }
export function privacyMessage() {
  return 'Não foi possível consultar ou registrar seu pedido. Verifique sua sessão e conexão e tente novamente.'
}
export function createPrivacyRepository(client: Pick<SupabaseClient, 'from'>) {
  function own(data: DeletionRequest | null, userId: string) {
    if (data && data.user_id !== userId) throw { code: '42501' }
    return data
  }
  return {
    async load(userId: string) {
      const { data, error } = await client.from('account_deletion_requests').select('user_id,requested_at').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return own(data, userId)
    },
    async request(userId: string, confirmed: boolean) {
      if (!confirmed) throw new Error('Confirme explicitamente a solicitação.')
      const { data, error } = await client.from('account_deletion_requests').insert({ user_id: userId }).select('user_id,requested_at').single()
      if (error?.code === '23505') {
        const existing = await this.load(userId)
        if (!existing) throw { code: '42501' }
        return existing
      }
      if (error) throw error
      const result = own(data, userId)
      if (!result) throw { code: '42501' }
      return result
    },
  }
}
