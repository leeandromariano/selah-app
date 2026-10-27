import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createReadingRepository, readingMessage } from './repository'
function setup(data: unknown = { status: 'paused', devotional_id: 'fiction', revision: 1, credited_ms: 0, revision_changed: false }, error: unknown = null) {
  const abortSignal = vi.fn().mockResolvedValue({ data, error })
  const rpc = vi.fn().mockReturnValue({ abortSignal })
  return { rpc, abortSignal, repository: createReadingRepository({ rpc } as unknown as SupabaseClient) }
}
describe('fronteira autenticada de leitura', () => {
  it('usa somente RPCs autenticadas com argumentos mínimos', async () => {
    const { repository, rpc, abortSignal } = setup()
    await repository.state('fiction'); await repository.start('fiction', 'tab', 3)
    await repository.start('fiction', 'tab', 3, true)
    await repository.checkpoint('fiction', 'tab', 'nonce', 1)
    await repository.pause('fiction', 'tab', 'nonce'); await repository.complete('fiction')
    expect(rpc.mock.calls).toEqual([
      ['get_my_reading_state', { p_devotional_id: 'fiction' }],
      ['start_reading', { p_devotional_id: 'fiction', p_client_id: 'tab', p_revision: 3 }],
      ['take_over_reading', { p_devotional_id: 'fiction', p_client_id: 'tab', p_revision: 3 }],
      ['checkpoint_reading', { p_devotional_id: 'fiction', p_client_id: 'tab', p_token: 'nonce', p_sequence: 1 }],
      ['pause_reading', { p_devotional_id: 'fiction', p_client_id: 'tab', p_token: 'nonce' }],
      ['complete_devotional', { p_devotional_id: 'fiction' }],
    ])
    expect(abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal))
  })
  it.each([null, {}, { status: 'ready', devotional_id: 'fiction', revision: 1, credited_ms: 59999 }, { status: 'completed', devotional_id: 'fiction', revision: 1, credited_ms: 60000 }, { status: 'active', devotional_id: 'fiction', revision: 1, credited_ms: 0 }])('recusa resposta inesperada sem fabricar progresso (%j)', async data => {
    await expect(setup(data).repository.state('fiction')).rejects.toThrow('Invalid reading response')
  })
  it('recusa resposta de outro devocional', async () => {
    await expect(setup({ status: 'paused', devotional_id: 'other', revision: 1, credited_ms: 0 }).repository.state('fiction')).rejects.toThrow('Unexpected reading identity')
  })
  it('nega autorização sem propagar mensagem interna', async () => {
    const { repository } = setup(null, { code: '42501', message: 'sensitive account details' })
    const error = await repository.complete('fiction').catch(e => e)
    expect(readingMessage(error)).toContain('Sua sessão')
    expect(readingMessage(error)).not.toContain('sensitive')
  })
  it('retorna falha genérica de rede sem detalhes pessoais', () => {
    expect(readingMessage(Error('private data'))).toContain('Sem conexão')
    expect(readingMessage(Error('private data'))).not.toContain('private data')
  })
})
