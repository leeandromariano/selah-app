import { describe, expect, it, vi } from 'vitest'
import { ageRange, createProfileRepository, profileFields } from './profile'

describe('contrato de perfis', () => {
  it('nome de exibição é opcional e dados vazios viram null sem pseudônimo inventado', () => {
    expect(profileFields({ name: '  ', phone: null, age_range: null, instagram: null })).toEqual({ name: null, phone: null, age_range: null, instagram: null })
  })
  it('recusa resposta de leitura com identidade diferente antes de mostrar dados', async () => {
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'another-reader', name: 'private' }, error: null }) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query)
    await expect(createProfileRepository({ from: vi.fn().mockReturnValue(query) } as never).load('reader')).rejects.toMatchObject({ code: '42501' })
  })
  it('normaliza celular brasileiro, mantém E.164 e descarta campos protegidos', () => {
    const payload = { name: ' Pessoa Fictícia ', phone: '(11) 99999-0000', age_range: '25_34', instagram: ' @ficticio ', id: 'forged', role: 'admin', updated_at: 'forged' }
    expect(profileFields(payload)).toEqual({ name: 'Pessoa Fictícia', phone: '+5511999990000', age_range: '25_34', instagram: '@ficticio' })
    expect(profileFields({ ...payload, phone: '+351912345678' }).phone).toBe('+351912345678')
  })
  it('mapeia idade para faixa sem persistir idade exata e rejeita dados fora do contrato', () => {
    expect([17, 18, 24, 25, 34, 35, 44, 45, 59, 60, 120].map(ageRange)).toEqual(['under_18', '18_24', '18_24', '25_34', '25_34', '35_44', '35_44', '45_59', '45_59', '60_plus', '60_plus'])
    const valid = { name: 'Pessoa Fictícia', phone: null, age_range: null, instagram: null }
    for (const change of [{ name: 'x'.repeat(151) }, { phone: 'invalid' }, { age_range: 'invalid' }, { instagram: '@bad user' }]) expect(() => profileFields({ ...valid, ...change })).toThrow()
  })
  it('trata zero linhas em update como erro, sem sinalizar gravação bem-sucedida', async () => {
    const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) }
    query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
    const repository = createProfileRepository({ from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(query) }) } as never)
    await expect(repository.save('fictional-id', { name: 'Pessoa Fictícia', phone: null, age_range: null, instagram: null }, true)).rejects.toMatchObject({ code: 'PGRST116' })
  })
})
