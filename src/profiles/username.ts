import type { SupabaseClient } from '@supabase/supabase-js'
export const reservedUsernames = ['admin','administrador','administrator','root','support','suporte','selah','system','sistema','auth','api','www','anonymous','account','perfil','login','cadastro','privacidade','null','true','false']
export function normalizeUsername(input: string) {
  const username = input.trim().toLowerCase()
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username) || reservedUsernames.includes(username)) throw new Error('Use de 3 a 24 letras, números ou _, começando por letra. Esse nome não pode ser reservado.')
  return username
}
export function usernameMessage(error: unknown) {
  return (error as { code?: string })?.code === '23505'
    ? 'Não foi possível reservar esse username. Ele pode estar em uso ou sua conta já possui um. Recarregue e tente outro.'
    : 'Não foi possível consultar ou reservar seu username. Confira as regras, a sessão e a conexão.'
}
export function createUsernameRepository(client: Pick<SupabaseClient, 'from'>) {
  function own(data: { user_id: string; username: string } | null, id: string) {
    if (data && data.user_id !== id) throw { code: '42501' }
    return data
  }
  return {
    async load(id: string) {
      const { data, error } = await client.from('account_usernames').select('user_id,username').eq('user_id', id).maybeSingle()
      if (error) throw error
      return own(data, id)
    },
    async claim(id: string, input: string) {
      const { data, error } = await client.from('account_usernames').insert({ user_id: id, username: normalizeUsername(input) }).select('user_id,username').single()
      if (error) throw error
      const result = own(data, id)
      if (!result) throw { code: '42501' }
      return result
    },
  }
}
