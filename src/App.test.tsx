import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from './lib/supabase'
import App from './App'

describe('fluxos locais do Selah', () => {
  it('combina busca sem diferenciar maiúsculas com filtro de tema', async () => {
    window.location.hash = 'historico'
    const user = userEvent.setup()
    render(<App />)
    await user.type(screen.getByRole('textbox', { name: 'Buscar devocionais' }), 'JOÃO')
    expect(screen.getByRole('status')).toHaveTextContent('1 devocionais encontrados')
    expect(screen.getByRole('heading', { name: 'Paz em meio ao caminho' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Gratidão' }))
    expect(screen.getByRole('status')).toHaveTextContent('0 devocionais encontrados')
    expect(screen.getByText(/Nenhum devocional encontrado/)).toBeVisible()
    await user.clear(screen.getByRole('textbox'))
    expect(screen.getByRole('heading', { name: 'O extraordinário no simples' })).toBeVisible()
  })

  it('marca leitura uma vez e descarta a marca ao iniciar nova sessão', async () => {
    window.location.hash = 'leitura'
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(screen.getByRole('button', { name: /Marcar como lido/ }))
    expect(screen.getByRole('button', { name: /Leitura concluída nesta sessão/ })).toBeDisabled()
    view.unmount()
    render(<App />)
    expect(screen.getByRole('button', { name: /Marcar como lido/ })).toBeEnabled()
  })

  it('remove conteúdo em memória, mas preserva o último devocional', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-admin' } } }, error: null } as never)
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never)
    window.location.hash = 'admin'
    const user = userEvent.setup()
    const view = render(<App />)
    await screen.findAllByRole('button', { name: 'Remover' })
    const main = screen.getByRole('main')
    for (let i = 0; i < 3; i++) await user.click(within(main).getAllByRole('button', { name: 'Remover' })[0])
    expect(within(main).getAllByRole('button', { name: 'Remover' })).toHaveLength(1)
    await user.click(within(main).getByRole('button', { name: 'Remover' }))
    expect(screen.getByRole('status')).toHaveTextContent('Mantenha ao menos um devocional')
    expect(within(main).getAllByRole('button', { name: 'Remover' })).toHaveLength(1)
    view.unmount()
    render(<App />)
    expect(await screen.findAllByRole('button', { name: 'Remover' })).toHaveLength(4)
  })
})
