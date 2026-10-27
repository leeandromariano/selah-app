import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { libraryBoundary, olderPublications } from '../test/libraryBoundary'

function open(page = 'inicio') {
  location.hash = page
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
  return render(<App />)
}
describe('acervo persistente do leitor', () => {
  it('mostra conclusão do dia confirmada pelo banco sem converter aberturas', async () => {
    const today = { ...olderPublications[0], publish_at: new Date().toISOString() }
    const boundary = libraryBoundary([today])
    boundary.completionsQuery.range.mockResolvedValue({ data: [{ source_devotional_id: today.id, devotional_id: today.id, completed_at: today.publish_at, completed_day: '2026-10-28' }], error: null })
    open()
    expect(await screen.findByText('Concluído por você')).toBeVisible()
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
    expect(boundary.completionsQuery.eq).toHaveBeenCalledWith('user_id', 'fictional-reader')
  })
  it('preserva abertura nula e conclusão histórica de conteúdo excluído sem expor texto', async () => {
    const boundary = libraryBoundary([], [{ id: 'removed-opening', devotional_id: null, opened_at: '2026-10-28T14:00:00Z' }])
    boundary.completionsQuery.range.mockResolvedValue({ data: [{ source_devotional_id: 'removed-fiction', devotional_id: null, completed_at: '2026-10-28T14:00:00Z', completed_day: '2026-10-28' }], error: null })
    open('minhas-leituras')
    expect(await screen.findByRole('heading', { name: 'Minhas conclusões' })).toBeVisible()
    await screen.findByText(/Concluído em/)
    expect(screen.getAllByText('Devocional indisponível')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Reler devocional' })).not.toBeInTheDocument()
  })
  it('falha de consulta às conclusões não é apresentada como lista vazia', async () => {
    const boundary = libraryBoundary([])
    boundary.completionsQuery.range.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    open('minhas-leituras')
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem autorização')
    expect(screen.queryByText('Você ainda não concluiu nenhum devocional.')).not.toBeInTheDocument()
  })
  it('destaca publicação de hoje e mantém anteriores no acervo sem registrar abertura da lista', async () => {
    const today = { ...olderPublications[0], id: 'today-fiction', title: 'Mensagem Fictícia de Hoje', publish_at: new Date().toISOString() }
    const boundary = libraryBoundary([today, ...olderPublications])
    open()
    expect(await screen.findByRole('heading', { name: today.title })).toBeVisible()
    expect(screen.getByRole('button', { name: /Começar a leitura/ })).toBeVisible()
    expect(screen.getByRole('heading', { name: olderPublications[0].title })).toBeVisible()
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
  })
  it('não apresenta uma publicação antiga como devocional de hoje', async () => {
    libraryBoundary(olderPublications)
    open()
    expect(await screen.findByText('Nenhum devocional publicado para hoje.')).toBeVisible()
    expect(screen.queryByRole('button', { name: /Começar a leitura/ })).not.toBeInTheDocument()
  })
  it('trata acervo vazio e histórico vazio sem usar os dados demonstrativos', async () => {
    libraryBoundary([])
    const user = userEvent.setup()
    open('historico')
    expect(await screen.findByText('Ainda não há publicações anteriores.')).toBeVisible()
    expect(screen.queryByText('Confie no tempo de Deus')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Minhas aberturas' }))
    expect(await screen.findByText('Você ainda não abriu nenhum devocional.')).toBeVisible()
  })
  it('informa acesso negado ao acervo e recupera consulta por nova tentativa', async () => {
    const boundary = libraryBoundary(olderPublications)
    boundary.publicationsQuery.range.mockResolvedValueOnce({ data: null, error: { code: '42501' } } as never)
    const user = userEvent.setup()
    open('historico')
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem autorização')
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByRole('heading', { name: olderPublications[0].title })).toBeVisible()
  })
  it('informa falha de histórico separadamente e não anuncia histórico vazio', async () => {
    const boundary = libraryBoundary(olderPublications)
    boundary.historyQuery.range.mockRejectedValueOnce(new Error('offline'))
    open('minhas-leituras')
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
    expect(screen.queryByText('Você ainda não abriu nenhum devocional.')).not.toBeInTheDocument()
  })
  it('negação de registro não navega nem anuncia abertura concluída', async () => {
    const boundary = libraryBoundary(olderPublications)
    boundary.historyQuery.insert.mockImplementationOnce(() => ({ select: () => ({ single: async () => ({ data: null, error: { code: '42501' } }) }) }))
    const user = userEvent.setup()
    open('historico')
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem autorização')
    expect(location.hash).toBe('#historico')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
  it('restaura URL de leitura por UUID sem fabricar conclusão ou duplicar evento na recarga', async () => {
    const boundary = libraryBoundary(olderPublications)
    open(`leitura/${olderPublications[0].id}`)
    const article = await screen.findByRole('article')
    expect(within(article).getByRole('heading', { name: olderPublications[0].title })).toBeVisible()
    expect(within(article).getByText(/sem comprovar conclusão/)).toBeVisible()
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
  })
  it('não expõe publicação ausente por URL direta', async () => {
    libraryBoundary(olderPublications)
    open('leitura/unknown-id')
    expect(await screen.findByText(/Devocional não encontrado ou indisponível/)).toBeVisible()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
  it('apresenta evento cujo conteúdo ficou indisponível sem revelar conteúdo oculto', async () => {
    libraryBoundary([], [{ id: 'fictional-event', devotional_id: 'hidden-id', opened_at: '2026-10-26T12:00:00Z' }])
    open('minhas-leituras')
    expect(await screen.findByText('Devocional indisponível')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Abrir novamente' })).not.toBeInTheDocument()
  })
  it('descarta resposta atrasada após logout e não mostra dados da sessão anterior', async () => {
    const boundary = libraryBoundary(olderPublications)
    let finish!: (value: unknown) => void
    boundary.publicationsQuery.range.mockReturnValueOnce(new Promise(resolve => { finish = resolve }) as never)
    open()
    await screen.findByText('Carregando devocionais…')
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT', null) })
    await act(async () => { finish({ data: olderPublications, error: null }) })
    expect(screen.queryByText(olderPublications[0].title)).not.toBeInTheDocument()
    expect(screen.getByText(/Entre na sua conta para acessar os devocionais/)).toBeVisible()
  })
  it('não navega após logout quando um registro de abertura atrasado termina', async () => {
    const boundary = libraryBoundary(olderPublications)
    let finish!: (value: unknown) => void
    boundary.historyQuery.insert.mockImplementationOnce(() => ({ select: () => ({ single: () => new Promise(resolve => { finish = resolve }) }) }))
    const user = userEvent.setup()
    open('historico')
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/ }))
    expect(screen.getByText('Registrando abertura…')).toBeVisible()
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT', null) })
    await act(async () => { finish({ data: { id: 'event', devotional_id: olderPublications[0].id, opened_at: new Date().toISOString() }, error: null }) })
    expect(location.hash).toBe('#historico')
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })
})
