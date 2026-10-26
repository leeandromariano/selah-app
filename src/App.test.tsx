import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from './lib/supabase'
import App from './App'
import { libraryBoundary, olderPublications } from './test/libraryBoundary'
import { adminBoundary, editorialFixture } from './test/adminBoundary'

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

  it('edita conteúdo administrativo e restaura a resposta persistida ao remontar', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-admin' } } }, error: null } as never)
    const table = adminBoundary()
    window.location.hash = 'admin'
    const user = userEvent.setup()
    const view = render(<App />)
    await screen.findAllByRole('button', { name: 'Editar' })
    const main = screen.getByRole('main')
    await user.click(within(main).getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Título')).toHaveValue(editorialFixture.title)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Mensagem Revisada')
    await user.click(screen.getByRole('button', { name: 'Salvar devocional' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Rascunho salvo')
    expect(table.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mensagem Revisada' }))
    view.unmount()
    render(<App />)
    expect(await screen.findByText('Mensagem Revisada')).toBeVisible()
  })
})
