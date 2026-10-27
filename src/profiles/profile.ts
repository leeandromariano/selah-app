import type { SupabaseClient } from '@supabase/supabase-js'

export const ageRanges = ['under_18', '18_24', '25_34', '35_44', '45_59', '60_plus'] as const
export type ProfileFields = { name: string | null; phone: string | null; age_range: string | null; instagram: string | null }
export type Profile = ProfileFields & { id: string; created_at: string; updated_at: string; whatsapp_required?: boolean }
export const profileColumns = 'id,name,phone,age_range,instagram,created_at,updated_at,whatsapp_required'

export function ageRange(age: number) {
  return age < 18 ? 'under_18' : age < 25 ? '18_24' : age < 35 ? '25_34' : age < 45 ? '35_44' : age < 60 ? '45_59' : '60_plus'
}

export function profileFields(input: ProfileFields): ProfileFields {
  const name = input.name?.trim() || null
  const phoneInput = input.phone?.trim() || null
  // Preserve international E.164 numbers; normalize a Brazilian mobile with DDD.
  const phone = phoneInput && !phoneInput.startsWith('+') && /^[1-9]{2}9\d{8}$/.test(phoneInput.replace(/\D/g, ''))
    ? '+55' + phoneInput.replace(/\D/g, '') : phoneInput?.replace(/[ ().-]/g,'') || null
  const age_range = input.age_range || null
  const instagram = input.instagram?.trim() || null
  if (name && [...name].length > 150) throw new Error('Informe um nome de até 150 caracteres.')
  if (phone && !/^\+[1-9][0-9]{7,14}$/.test(phone)) throw new Error('Informe celular com DDD ou telefone internacional iniciado por +.')
  if (age_range && !ageRanges.includes(age_range as typeof ageRanges[number])) throw new Error('Selecione uma faixa etária válida.')
  if (instagram && !/^@?[A-Za-z0-9._]{1,30}$/.test(instagram)) throw new Error('Informe um Instagram válido.')
  return { name, phone, age_range, instagram }
}

export function profileMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === '42501' || code === 'PGRST301' || code === 'PGRST303' || code === 'PGRST116') return 'Você não tem autorização para acessar ou alterar este perfil. Entre novamente.'
  if (code === '23505') return 'Seu perfil já foi criado em outra aba. Recarregue o perfil antes de editar.'
  if (code === '23514' || code === '23502') return 'Confira os campos do perfil e tente novamente.'
  return 'Não foi possível acessar o perfil. Verifique sua conexão e tente novamente.'
}

export function createProfileRepository(client: Pick<SupabaseClient, 'from'>) {
  return {
    async load(userId: string): Promise<Profile | null> {
      const { data, error } = await client.from('profiles').select(profileColumns).eq('id', userId).maybeSingle()
      if (error) throw error
      if (data && data.id !== userId) throw { code: '42501' }
      return data as Profile | null
    },
    async save(userId: string, fields: ProfileFields, exists: boolean): Promise<Profile> {
      const allowed = profileFields(fields)
      const query = exists
        ? client.from('profiles').update(allowed).eq('id', userId)
        : client.from('profiles').insert({ id: userId, ...allowed })
      const { data, error } = await query.select(profileColumns).single()
      if (error) throw error
      if (!data || data.id !== userId) throw { code: '42501' }
      return data as Profile
    },
  }
}
