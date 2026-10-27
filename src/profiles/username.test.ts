import { describe, expect, it, vi } from 'vitest'
import { createUsernameRepository, normalizeUsername, usernameMessage } from './username'
describe('username obrigatório e privado', () => {
  it('normaliza caixa/espaços e valida limites/caracteres/reservados', () => {
    expect(normalizeUsername(' Pessoa_01 ')).toBe('pessoa_01')
    for (const value of ['', 'ab', 'a'.repeat(25), '1abc', 'pessoa.nome', 'joão', 'a b', 'admin', 'SUPORTE', 'true', '../api']) expect(() => normalizeUsername(value)).toThrow()
    expect(normalizeUsername('a'.repeat(24))).toHaveLength(24)
  })
  it('vincula leitura e reserva à própria identidade sem enviar email ou campos protegidos', async () => {
    const data = { user_id: 'reader', username: 'pessoa_01' }
    const q = { select: vi.fn(), eq: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }), single: vi.fn().mockResolvedValue({ data, error: null }) }
    for(const m of ['select','eq','insert'] as const) q[m].mockReturnValue(q)
    const from = vi.fn().mockReturnValue(q), repository = createUsernameRepository({ from } as never)
    expect(await repository.load('reader')).toEqual(data)
    expect(q.eq).toHaveBeenCalledWith('user_id','reader')
    expect(await repository.claim('reader',' Pessoa_01 ')).toEqual(data)
    expect(q.insert).toHaveBeenCalledExactlyOnceWith({ user_id: 'reader', username: 'pessoa_01' })
    await expect(repository.load('other')).rejects.toMatchObject({ code: '42501' })
    await expect(repository.claim('other','pessoa_01')).rejects.toMatchObject({ code: '42501' })
    q.single.mockResolvedValueOnce({ data: null, error: { code: '23505', message: 'private database detail' } })
    await expect(repository.claim('reader','pessoa_01')).rejects.toMatchObject({ code: '23505' })
    expect(usernameMessage({code:'23505'})).toContain('em uso')
    expect(usernameMessage({message:'private database detail'})).not.toContain('private')
  })
})
