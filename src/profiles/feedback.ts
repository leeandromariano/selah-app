import type { SupabaseClient } from '@supabase/supabase-js'
export type FeedbackChoice = { user_id: string; allowed: boolean; decided_at: string; purpose_version: string }
export function feedbackMessage() { return 'Não foi possível consultar ou salvar sua autorização. Confira a sessão, recarregue o perfil e tente novamente.' }
export function createFeedbackRepository(client: Pick<SupabaseClient,'from'|'rpc'>) {
  function own(data: FeedbackChoice | null,id: string) { if(data && data.user_id!==id) throw {code:'42501'}; return data }
  return {
    async load(id: string) {
      const {data,error}=await client.from('feedback_contact_preferences').select('user_id,allowed,decided_at,purpose_version').eq('user_id',id).maybeSingle()
      if(error)throw error
      return own(data,id)
    },
    async save(id: string,phone: string|null,allowed: boolean) {
      const {data,error}=await client.rpc('set_feedback_contact',{p_user_id:id,p_expected_phone:phone,p_allowed:allowed})
      if(error)throw error
      const result=own((Array.isArray(data)?(data.length===1?data[0]:null):data) as FeedbackChoice|null,id)
      if(!result)throw {code:'42501'}
      return result
    },
  }
}
