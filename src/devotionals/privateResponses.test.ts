import { describe, expect, it, vi } from 'vitest'
import { createPrivateResponseRepository, responseBody } from './privateResponses'

describe('resposta pessoal do leitor', () => {
  it('aceita uma frase e recusa conteúdo vazio, longo ou com controle', () => {
    expect(responseBody('  Uma resposta  ')).toBe('Uma resposta')
    for (const value of [' ', 'x'.repeat(501), 'texto\u0001ruim']) expect(() => responseBody(value)).toThrow()
  })
  it('consulta e grava apenas na linha do usuário e devocional selecionados', async () => {
    const row = { source_devotional_id: 'devotional', devotional_id: 'devotional', body: 'Minha resposta', updated_at: '2026-11-08T12:00:00Z' }
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), insert: vi.fn(), single: vi.fn().mockResolvedValue({ data: row, error: null }) }
    for (const method of ['select', 'eq', 'insert'] as const) query[method].mockReturnValue(query)
    const from = vi.fn().mockReturnValue(query)
    const repository = createPrivateResponseRepository({ from } as never)
    expect(await repository.save('reader', 'devotional', ' Minha resposta ')).toEqual(row)
    expect(from).toHaveBeenCalledWith('devotional_private_responses')
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader')
    expect(query.eq).toHaveBeenCalledWith('source_devotional_id', 'devotional')
    expect(query.insert).toHaveBeenCalledWith({ source_devotional_id: 'devotional', devotional_id: 'devotional', body: 'Minha resposta' })
  })
})
