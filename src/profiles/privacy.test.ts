import { describe, expect, it, vi } from 'vitest'
import { createPrivacyRepository, privacyMessage } from './privacy'
function fixture() {
  const data = { user_id: 'reader', requested_at: '2026-10-26T12:00:00Z' }
  const query = { select: vi.fn(), eq: vi.fn(), insert: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data, error: null }), single: vi.fn().mockResolvedValue({ data, error: null }) }
  for (const method of ['select', 'eq', 'insert'] as const) query[method].mockReturnValue(query)
  const from = vi.fn().mockReturnValue(query)
  return { query, from, repository: createPrivacyRepository({ from } as never), data }
}
describe('pedido de exclusão não destrutivo', () => {
  it('exige confirmação antes de consultar ou escrever', async () => {
    const { repository, from } = fixture()
    await expect(repository.request('reader', false)).rejects.toThrow('Confirme explicitamente')
    expect(from).not.toHaveBeenCalled()
  })
  it('consulta apenas identidade da sessão e insere somente user_id', async () => {
    const { repository, query, data, from } = fixture()
    expect(await repository.load('reader')).toEqual(data)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader')
    expect(await repository.request('reader', true)).toEqual(data)
    expect(query.insert).toHaveBeenCalledExactlyOnceWith({ user_id: 'reader' })
    expect(from).toHaveBeenCalledWith('account_deletion_requests')
  })
  it('recusa resposta de outro usuário em leitura e gravação', async () => {
    const { repository } = fixture()
    await expect(repository.load('other')).rejects.toMatchObject({ code: '42501' })
    await expect(repository.request('other', true)).rejects.toMatchObject({ code: '42501' })
  })
  it('duplicidade recupera pedido próprio sem alterar timestamp', async () => {
    const { repository, query, data } = fixture()
    query.single.mockResolvedValueOnce({ data: null, error: { code: '23505' } })
    expect(await repository.request('reader', true)).toEqual(data)
    expect(query.insert).toHaveBeenCalledTimes(1)
    expect(query.eq).toHaveBeenCalledWith('user_id', 'reader')
  })
  it('propaga negação, falha de rede e resposta ausente sem mostrar detalhes privados', async () => {
    const { repository, query } = fixture()
    query.single.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private diagnostic' } })
    await expect(repository.request('reader', true)).rejects.toMatchObject({ code: '42501' })
    query.maybeSingle.mockRejectedValueOnce(new Error('private diagnostic'))
    await expect(repository.load('reader')).rejects.toThrow('private diagnostic')
    query.single.mockResolvedValueOnce({ data: null, error: null })
    await expect(repository.request('reader', true)).rejects.toMatchObject({ code: '42501' })
    expect(privacyMessage()).not.toContain('private diagnostic')
  })
})
