import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
  it('mantém conteúdo, pergunta, progresso, compartilhamento e discussão na mesma coluna e ordem', async () => {
    libraryBoundary(olderPublications)
    open(`leitura/${olderPublications[0].id}`)
    const article=await screen.findByRole('article')
    const column=article.closest('.reading-column')
    expect(column).not.toBeNull()
    const question=article.querySelector<HTMLElement>('.reflection')!
    const progress=screen.getByRole('region',{name:'Progresso de leitura'})
    const share=screen.getByRole('region',{name:'Compartilhar devocional'})
    const discussion=screen.getByRole('region',{name:'Compartilhe sua reflexão'})
    for(const element of [article,question,progress,share,discussion])expect(column).toContainElement(element)
    expect(question.compareDocumentPosition(progress)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(article.compareDocumentPosition(share)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(share.compareDocumentPosition(discussion)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    for(const text of [
      'O tempo mínimo registra permanência confirmada nesta página; não comprova compreensão. A conclusão é uma escolha sua. Você pode continuar lendo pelo tempo que precisar.',
      'O histórico registra aberturas, sem comprovar conclusão da leitura.',
      'Convide um amigo, se desejar. Você pode compartilhar antes ou depois de concluir sua leitura.',
      'O link exige autenticação no Selah. Quem ainda não tem conta precisará se cadastrar. Seu histórico de leitura não é compartilhado.',
      'Este endereço local funciona apenas neste ambiente; não é um link público disponível para amigos pela internet.',
    ])expect(column?.textContent).not.toContain(text)
  })
  it('sem pergunta não cria cartão vazio nem remove progresso ou ações finais', async () => {
    const publication={...olderPublications[0],reflection_question:''}
    libraryBoundary([publication]);open(`leitura/${publication.id}`)
    const article=await screen.findByRole('article')
    expect(article.querySelector('.reflection')).toBeNull()
    expect(screen.getByRole('region',{name:'Progresso de leitura'})).toBeVisible()
    expect(screen.getByRole('region',{name:'Compartilhar devocional'})).toBeVisible()
    expect(screen.getByRole('region',{name:'Compartilhe sua reflexão'})).toBeVisible()
  })
  it.each(olderPublications)('compartilhar aparece ao final de $title antes da conclusão, sem creditar leitura', async publication => {
    libraryBoundary(olderPublications)
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    vi.mocked(supabase.rpc).mockImplementation((name, args) => name === 'get_my_reading_state'
      ? { abortSignal: async () => ({ data: { status: 'paused', devotional_id: publication.id, revision: 1, credited_ms: 0, revision_changed: false }, error: null }) } as never
      : fallback(name, args))
    const copy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: copy } })
    open(`leitura/${publication.id}`)
    const share = await screen.findByRole('region', { name: 'Compartilhar devocional' })
    expect(screen.getByRole('article').compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(share).getByRole('button', { name: 'Compartilhar' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeDisabled()
    fireEvent.click(within(share).getByRole('button', { name: 'Compartilhar' }))
    await screen.findByText('Link copiado.')
    expect(copy).toHaveBeenCalledWith(location.origin + '/#leitura/' + publication.id)
    expect(supabase.rpc).not.toHaveBeenCalledWith('complete_devotional', expect.anything())
    const whatsapp = new URL(within(share).getByRole('link', { name: 'Abrir WhatsApp para compartilhar' }).getAttribute('href')!)
    expect(whatsapp.origin).toBe('https://wa.me')
    expect(whatsapp.searchParams.get('text')).toContain(location.origin + '/#leitura/' + publication.id)
    expect(within(share).queryByText(/exige autenticação/)).not.toBeInTheDocument()
    expect(within(share).queryByText(/não é um link público/)).not.toBeInTheDocument()
  })
  it('compartilhar permanece disponível antes e depois da conclusão voluntária de 60000 ms', async () => {
    const publication = olderPublications[0]
    libraryBoundary([publication])
    const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
    let completed = false
    vi.mocked(supabase.rpc).mockImplementation((name, args) => {
      if (name === 'complete_devotional') completed = true
      if (['get_my_reading_state', 'start_reading', 'complete_devotional'].includes(name)) return { abortSignal: async () => ({ data: {
        status: completed ? 'completed' : 'ready', devotional_id: publication.id, revision: 1, credited_ms: 60000,
        revision_changed: false, ...(completed ? { completed_at: '2026-10-28T15:00:00Z', completed_day: '2026-10-28' } : {}),
      }, error: null }) } as never
      return fallback(name, args)
    })
    open(`leitura/${publication.id}`)
    expect(await screen.findByRole('button', { name: 'Compartilhar' })).toBeVisible()
    const conclude = await screen.findByRole('button', { name: 'Concluir devocional' })
    await waitFor(() => expect(conclude).toBeEnabled())
    fireEvent.click(conclude)
    await screen.findByText(/Devocional concluído em/)
    expect(completed).toBe(true)
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeVisible()
    expect(screen.getAllByRole('region', { name: 'Compartilhar devocional' })).toHaveLength(1)
  })
  it('destino da notificação e link copiado abrem a mesma publicação sem duplicar compartilhamento', async () => {
    libraryBoundary(olderPublications)
    const id = olderPublications[0].id
    open(`leitura/${id}/compartilhar`)
    expect(await screen.findByRole('button', { name: 'Compartilhar' })).toBeVisible()
    expect(screen.getAllByRole('region', { name: 'Compartilhar devocional' })).toHaveLength(1)
    await act(async () => { location.hash = `leitura/${id}`; window.dispatchEvent(new HashChangeEvent('hashchange')) })
    expect(screen.getByRole('heading', { name: olderPublications[0].title })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Compartilhar' })).toBeVisible()
  })
  it('não oferece compartilhamento para conteúdo ausente, não publicado ou sem autenticação', async () => {
    libraryBoundary([])
    const view = open(`leitura/${olderPublications[0].id}/compartilhar`)
    await screen.findByText(/Devocional não encontrado ou indisponível/)
    expect(screen.queryByRole('button', { name: 'Compartilhar' })).not.toBeInTheDocument()
    view.unmount()
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null } as never)
    render(<App />)
    await screen.findByRole('heading', { name: 'Que bom te ver de novo' })
    expect(screen.queryByRole('region', { name: 'Compartilhar devocional' })).not.toBeInTheDocument()
  })
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
  it('inclui o devocional publicado hoje na lista completa e ordena por mais recente', async () => {
    const today = { ...olderPublications[0], id: 'today-in-library', title: 'Devocional de Hoje no Acervo', publish_at: new Date(Date.now() - 60_000).toISOString() }
    const boundary = libraryBoundary([today, ...olderPublications])
    open('historico')
    expect(await screen.findByRole('heading', { name: today.title })).toBeVisible()
    expect(screen.getByText('3 devocionais encontrados')).toBeVisible()
    const headings = screen.getAllByRole('heading').map(heading => heading.textContent)
    expect(headings.indexOf(today.title)).toBeLessThan(headings.indexOf(olderPublications[0].title))
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
  })
  it('não duplica a publicação de hoje entre o destaque e os cartões antigos da página Início', async () => {
    const today = { ...olderPublications[0], id: 'today-not-duplicated', title: 'Destaque de Hoje', publish_at: new Date(Date.now() - 60_000).toISOString() }
    libraryBoundary([today, ...olderPublications])
    open()
    expect(await screen.findByRole('heading', { name: today.title })).toBeVisible()
    expect(screen.getAllByRole('heading', { name: today.title })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: olderPublications[0].title })).toBeVisible()
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
    expect(await screen.findByText('Ainda não há devocionais publicados.')).toBeVisible()
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
    expect(within(article).queryByText(/sem comprovar conclusão/)).not.toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
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
  it('busca por titulo ou referencia sem diferenciar acentos e ordena os resultados', async () => {
    libraryBoundary(olderPublications)
    const user = userEvent.setup()
    open('historico')
    await screen.findByRole('heading', { name: olderPublications[0].title })
    const search = screen.getByRole('searchbox', { name: /Buscar por/ })
    await user.type(search, '  JOAO  ')
    expect(screen.getByRole('heading', { name: olderPublications[0].title })).toBeVisible()
    expect(screen.queryByRole('heading', { name: olderPublications[1].title })).not.toBeInTheDocument()
    await user.clear(search)
    const order = screen.getByRole('combobox', { name: 'Ordenar por' })
    await user.selectOptions(order, 'oldest')
    const headings = screen.getAllByRole('heading').map(h => h.textContent)
    expect(headings.indexOf(olderPublications[1].title)).toBeLessThan(headings.indexOf(olderPublications[0].title))
    await user.selectOptions(order, 'recent')
    const recent = screen.getAllByRole('heading').map(h => h.textContent)
    expect(recent.indexOf(olderPublications[0].title)).toBeLessThan(recent.indexOf(olderPublications[1].title))
    await user.type(search, 'nao existe')
    expect(screen.getByText(/Nenhum devocional encontrado/)).toBeVisible()
  })

})
