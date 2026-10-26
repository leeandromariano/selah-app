import { describe, expect, it, vi } from 'vitest'
import { ageRange, createProfileRepository, profileFields } from './profile'

describe('contrato de perfis', () => {
  it('normaliza celular brasileiro, mantém E.164 e descarta campos protegidos', () => {
    const payload = { name: ' Pessoa Fictícia ', phone: '(11) 99999-0000', age_range: '25_34', instagram: ' @ficticio ', id: 'forged', role: 'admin', updated_at: 'forged' }
    expect(profileFields(payload)).toEqual({ name: 'Pessoa Fictícia', phone: '+5511999990000', age_range: '25_34', instagram: '@ficticio' })
    expect(profileFields({ ...payload, phone: '+351912345678' }).phone).toBe('+351912345678')
  })
  it('mapeia idade para faixa sem persistir idade exata e rejeita dados fora do contrato', () => {
    expect([17, 18, 24, 25, 34, 35, 44, 45, 59, 60, 120].map(ageRange)).toEqual(['under_18', '18_24', '18_24', '25_34', '25_34', '35_44', '35_44', '45_59', '45_59', '60_plus', '60_plus'])
    const valid = { name: 'Pessoa Fictícia', phone: null, age_range: null, instagram: null }
    for (const change of [{ name: '' }, { name: 'x'.repeat(151) }, { phone: 'invalid' }, { age_range: 'invalid' }, { instagram: '@bad user' }]) expect(() => profileFields({ ...valid, ...change })).toThrow()
  })
  it('trata zero linhas em update como erro, sem sinalizar gravação bem-sucedida', async () => {
    const query = { eq: vi.fn(), select: vi.fn(), single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }) }
    query.eq.mockReturnValue(query); query.select.mockReturnValue(query)
    const repository = createProfileRepository({ from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue(query) }) } as never)
    await expect(repository.save('fictional-id', { name: 'Pessoa Fictícia', phone: null, age_range: null, instagram: null }, true)).rejects.toMatchObject({ code: 'PGRST116' })
  })
})
