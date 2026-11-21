import { describe, expect, it, vi } from 'vitest'
import { createPrayerRepository, daysAgo, formatDay } from './repository'

const id = '11111111-1111-4111-8111-111111111111'
const item = { id, request: 'Pedido fictício de teste', created_on: '2026-11-13', review_on: '2026-12-13', status: 'open', answered_on: null, testimony: null, days_since: 30 }
function client(data: unknown, error: unknown = null) {
  const rpc = vi.fn(() => ({ abortSignal: async () => ({ data, error }) }))
  return { rpc, repository: createPrayerRepository({ rpc } as never) }
}

describe('repositório das cápsulas de oração', () => {
  it('formata datas sem fuso e a quantidade de dias', () => {
    expect(formatDay('2026-12-05')).toBe('05/12/2026')
    expect(daysAgo(1)).toBe('1 dia')
    expect(daysAgo(30)).toBe('30 dias')
  })
  it('cria o pedido com a data de revisão escolhida e valida antes de enviar', async () => {
    const { rpc, repository } = client(item)
    expect(await repository.create('  Pedido fictício de teste ', 30, id)).toEqual(item)
    expect(rpc).toHaveBeenCalledWith('prayer_create', { p_request: 'Pedido fictício de teste', p_days: 30, p_devotional_id: id })
    await expect(repository.create('ab', 30)).rejects.toThrow('Pedido inválido')
    await expect(repository.create('Pedido ok', 5)).rejects.toThrow('Pedido inválido')
    await expect(repository.create('x'.repeat(501), 30)).rejects.toThrow('Pedido inválido')
  })
  it('lista os pedidos que chegaram na data e recusa respostas malformadas', async () => {
    expect(await client([item]).repository.due()).toEqual([item])
    await expect(client([{ ...item, review_on: '13/12/2026' }]).repository.due()).rejects.toThrow('Invalid prayer item')
    await expect(client(Array(11).fill(item)).repository.due()).rejects.toThrow('Invalid prayer list')
    await expect(client(null, { code: '42501' }).repository.due()).rejects.toEqual({ code: '42501' })
  })
  it('lista por status com paginação e descarta campos inesperados', async () => {
    const { rpc, repository } = client({ status: 'answered', total: 1, page: 0, size: 20, items: [{ ...item, status: 'answered', answered_on: '2026-12-13', testimony: 'Deus agiu', owner_note: 'x' }] })
    const list = await repository.list('answered')
    expect(rpc).toHaveBeenCalledWith('prayer_list', { p_status: 'answered', p_page: 0, p_size: 20 })
    expect(list.items[0]).not.toHaveProperty('owner_note')
    await expect(repository.list('todos' as never)).rejects.toThrow('Consulta inválida')
  })
  it('marca como respondido, adia e exclui', async () => {
    const answered = { ...item, status: 'answered', answered_on: '2026-12-13', testimony: 'Deus agiu' }
    const a = client(answered)
    expect((await a.repository.answer(id, ' Deus agiu ')).status).toBe('answered')
    expect(a.rpc).toHaveBeenCalledWith('prayer_answer', { p_id: id, p_testimony: 'Deus agiu' })
    await a.repository.answer(id, '   ')
    expect(a.rpc).toHaveBeenLastCalledWith('prayer_answer', { p_id: id, p_testimony: null })
    const s = client(item)
    await s.repository.snooze(id)
    expect(s.rpc).toHaveBeenCalledWith('prayer_snooze', { p_id: id, p_days: 30 })
    await expect(s.repository.snooze(id, 4)).rejects.toThrow('Resposta inválida')
    await s.repository.snooze(id, 3)
    await client({ deleted: true }).repository.remove(id)
    await expect(client({ deleted: false }).repository.remove(id)).rejects.toThrow('Invalid prayer delete')
  })
})
