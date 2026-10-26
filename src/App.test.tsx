import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from './lib/supabase'
import App from './App'
import { libraryBoundary, olderPublications } from './test/libraryBoundary'

describe('fluxos locais do Selah', () => {
  it('busca publicação anterior por referência sem diferenciar maiúsculas e recupera resultado vazio', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    libraryBoundary(olderPublications)
    window.location.hash = 'historico'
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByRole('textbox', { name: 'Buscar devocionais' }), 'JOÃO')
    expect(screen.getByRole('status')).toHaveTextContent('1 devocionais encontrados')
    expect(screen.getByRole('heading', { name: 'Paz em meio ao caminho' })).toBeVisible()
    await user.type(screen.getByRole('textbox'), ' inexistente')
    expect(screen.getByRole('status')).toHaveTextContent('0 devocionais encontrados')
    expect(screen.getByText(/Nenhum devocional encontrado/)).toBeVisible()
    await user.clear(screen.getByRole('textbox'))
    expect(screen.getByRole('heading', { name: 'O extraordinário no simples' })).toBeVisible()
  })

  it('registra abertura e restaura histórico ao remontar, sem marcar conclusão', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    const { historyQuery } = libraryBoundary(olderPublications)
    window.location.hash = 'historico'
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/ }))
    expect(await screen.findByText(/sem comprovar conclusão/)).toBeVisible()
    expect(historyQuery.insert).toHaveBeenCalledWith({ devotional_id: olderPublications[0].id })
    expect(screen.queryByRole('button', { name: /Marcar como lido/ })).not.toBeInTheDocument()
    view.unmount()
    location.hash = 'minhas-leituras'
    render(<App />)
    expect(await screen.findByText(olderPublications[0].title)).toBeVisible()
    expect(screen.getByText(/Uma abertura não significa leitura concluída/)).toBeVisible()
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
