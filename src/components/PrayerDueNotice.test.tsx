import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrayerDueNotice } from './PrayerDueNotice'

const item = (id: string) => ({ id, request: 'Pedido fictício', created_on: '2026-10-14', review_on: '2026-11-13', status: 'open', answered_on: null, testimony: null, days_since: 30 })

describe('Lembrete de cápsula de oração no topo', () => {
  it('avisa em outras páginas quando há pedido para rever e leva à Home', async () => {
    render(<PrayerDueNotice page="bereia" repo={{ due: vi.fn().mockResolvedValue([item('a'), item('b')]) } as never} />)
    const link = await screen.findByRole('link', { name: '2 pedidos de oração para rever' })
    expect(link).toHaveAttribute('href', '#inicio')
    expect(link).toHaveTextContent('2 pedidos para rever')
  })
  it('usa o singular para um pedido', async () => {
    render(<PrayerDueNotice page="historico" repo={{ due: vi.fn().mockResolvedValue([item('a')]) } as never} />)
    expect(await screen.findByRole('link', { name: '1 pedido de oração para rever' })).toHaveTextContent('1 pedido para rever')
  })
  it('não aparece na Home, nem sem pedidos, nem se a consulta falhar', async () => {
    const due = vi.fn().mockResolvedValue([item('a')])
    const home = render(<PrayerDueNotice page="inicio" repo={{ due } as never} />)
    await vi.waitFor(() => expect(due).toHaveBeenCalled())
    expect(home.container).toBeEmptyDOMElement()
    home.unmount()
    const empty = vi.fn().mockResolvedValue([])
    const none = render(<PrayerDueNotice page="bereia" repo={{ due: empty } as never} />)
    await vi.waitFor(() => expect(empty).toHaveBeenCalled())
    expect(none.container).toBeEmptyDOMElement()
    none.unmount()
    const failing = vi.fn().mockRejectedValue(Error('x'))
    const failed = render(<PrayerDueNotice page="bereia" repo={{ due: failing } as never} />)
    await vi.waitFor(() => expect(failing).toHaveBeenCalled())
    expect(failed.container).toBeEmptyDOMElement()
  })
})
