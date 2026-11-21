import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CoramWrapped, HomeWrapped } from './CoramWrapped'
import { createWrappedRepository } from '../wrapped/repository'
import type { WrappedData } from '../wrapped/repository'

vi.mock('../wrapped/image', () => ({ renderWrappedCard: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })) }))
import { renderWrappedCard } from '../wrapped/image'

const data: WrappedData = {
  kind: 'month', year: 2026, month: 10, start: '2026-10-01', end: '2026-10-31', partial: false,
  presence: { days: 12, completed: 13, longest_streak: 5 },
  books: [{ key: 'joao', count: 3 }, { key: 'salmos', count: 2 }],
  games: [{ game: 'quiz', answered: 10, correct: 8 }, { game: 'mito', answered: 0, correct: 0 }, { game: 'quem-disse', answered: 0, correct: 0 }, { game: 'linha-do-tempo', answered: 0, correct: 0 }, { game: 'versiculo', answered: 0, correct: 0 }],
  verse: { reference: 'João 3:16-18', title: 'Amor que alcança', opens: 4 },
}
const wire = (value: WrappedData) => ({ kind: value.kind, year: value.year, month: value.month, start: value.start, end: value.end, partial: value.partial, presence: value.presence, books: value.books, bereia: { games: value.games }, verse: value.verse })
function server(value: WrappedData = data, failures = 0) {
  let left = failures
  const rpc = vi.fn(() => ({ abortSignal: async () => (left-- > 0 ? { data: null, error: { message: 'boom' } } : { data: wire(value), error: null }) }))
  return { rpc, repo: createWrappedRepository({ rpc } as never) }
}
const today = '2026-11-17'
const still = (matches: boolean) => vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
beforeEach(() => { still(true) }) // menos movimento: sem avanço automático nem contagem animada
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); vi.clearAllMocks() })

describe('CORAM Wrapped: página', () => {
  it('abre o mês passado, mostra os 4 cards em ordem e deixa voltar e avançar', async () => {
    const { repo, rpc } = server()
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    expect(await screen.findByRole('heading', { name: 'Seus dias na Presença' })).toBeVisible()
    expect(rpc).toHaveBeenCalledWith('get_my_wrapped', { p_kind: 'month', p_year: 2026, p_month: 10 })
    expect(screen.getByText('12')).toBeVisible()
    expect(screen.getByText(/13 devocionais concluídos · maior sequência: 5 dias seguidos/)).toBeVisible()
    expect(screen.getByRole('button', { name: '← Anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByRole('heading', { name: 'Livros mais lidos' })).toBeVisible()
    expect(screen.getByText('1. João')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByRole('heading', { name: 'Sua taxa de acerto na Bereia' })).toBeVisible()
    expect(screen.getByText('80%')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByRole('heading', { name: 'Versículo mais revisitado' })).toBeVisible()
    expect(screen.getByText('João 3:16-18')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Próximo →' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: '← Anterior' }))
    expect(screen.getByRole('heading', { name: 'Sua taxa de acerto na Bereia' })).toBeVisible()
    await user.keyboard('{ArrowLeft}')
  })
  it('as setas do teclado também navegam', async () => {
    const { repo } = server()
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Seus dias na Presença' })
    screen.getByRole('region', { name: /Recap Coram de Outubro de 2026/ }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('heading', { name: 'Livros mais lidos' })).toBeVisible()
  })
  it('escolhe o período pela rota e marca o escolhido; ano usa o tipo year', async () => {
    const { repo, rpc } = server({ ...data, kind: 'year', month: null, start: '2026-01-01', end: '2026-12-31', partial: true })
    render(<CoramWrapped page="recap/2026" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Seus dias na Presença' })
    expect(rpc).toHaveBeenCalledWith('get_my_wrapped', { p_kind: 'year', p_year: 2026, p_month: null })
    expect(screen.getByRole('link', { name: 'Ano 2026' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Outubro de 2026' })).not.toHaveAttribute('aria-current')
    expect(screen.getByText(/Este período ainda não terminou/)).toBeVisible()
  })
  it('sem dados, cada card traz uma mensagem amigável', async () => {
    const { repo } = server({ ...data, presence: { days: 0, completed: 0, longest_streak: 0 }, books: [], games: [], verse: null })
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    expect(await screen.findByText('Nenhum dia ainda')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByText('Sem leituras')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByText('Sem respostas')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próximo →' }))
    expect(screen.getByText('Nada revisitado')).toBeVisible()
  })
  it('falha ao carregar avisa e permite tentar de novo', async () => {
    const { repo, rpc } = server(data, 1)
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível montar o seu Wrapped agora')
    await user.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('heading', { name: 'Seus dias na Presença' })).toBeVisible()
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('período inexistente ou futuro não chama o servidor', async () => {
    const { repo, rpc } = server()
    const view = render(<CoramWrapped page="recap/2026-13" repo={repo} today={today} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Período não encontrado.')
    view.rerender(<CoramWrapped page="recap/2026-12" repo={repo} today={today} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Este período ainda não começou.')
    expect(rpc).not.toHaveBeenCalled()
  })
})

describe('Recap Coram: no computador', () => {
  const desktop = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduced-motion'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
  it('mostra os 4 cards lado a lado, o título novo e os marcos de constância', async () => {
    desktop()
    const { repo } = server({ ...data, presence: { days: 40, completed: 40, longest_streak: 31 } })
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    expect(await screen.findByRole('heading', { name: 'Recap Coram' })).toBeVisible()
    expect(screen.getAllByRole('article')).toHaveLength(4)
    expect(screen.getByRole('article', { name: /Card 1 de 4/ })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByText('Círculo de Prata', { selector: '.wrapped-chip' })).toBeVisible()
    const marcos = screen.getByRole('region', { name: 'Marcos de constância' })
    expect(within(marcos).getByText('Faltam 69 dias')).toBeVisible()
    expect(within(marcos).getAllByText('Alcançado')).toHaveLength(2)
  })
  it('clicar num card o seleciona e o botão compartilha justamente esse card', async () => {
    desktop()
    const { repo } = server()
    const user = userEvent.setup()
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Recap Coram' })
    await user.click(screen.getByRole('article', { name: /Card 3 de 4/ }))
    expect(screen.getByRole('article', { name: /Card 3 de 4/ })).toHaveAttribute('aria-current', 'true')
    await user.click(screen.getByRole('button', { name: 'Compartilhar este card' }))
    await waitFor(() => expect(renderWrappedCard).toHaveBeenCalledTimes(1))
    expect(vi.mocked(renderWrappedCard).mock.calls[0][0]).toMatchObject({ kind: 'bereia' })
    screen.getByRole('article', { name: /Card 4 de 4/ }).focus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('article', { name: /Card 4 de 4/ })).toHaveAttribute('aria-current', 'true')
  })
})

describe('CORAM Wrapped: compartilhar', () => {
  it('gera e salva a imagem do card atual e, depois, dos 4 cards', async () => {
    const { repo } = server()
    const user = userEvent.setup()
    const createObjectURL = vi.fn(() => 'blob:x')
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Seus dias na Presença' })
    await user.click(screen.getByRole('button', { name: 'Compartilhar este card' }))
    await waitFor(() => expect(renderWrappedCard).toHaveBeenCalledTimes(1))
    expect(vi.mocked(renderWrappedCard).mock.calls[0][0]).toMatchObject({ kind: 'presence', days: 12 })
    expect(vi.mocked(renderWrappedCard).mock.calls[0][1]).toBe('Outubro de 2026')
    expect(await screen.findByText('Card salvo. É só postar nos Stories!')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Compartilhar os 4 cards' }))
    await waitFor(() => expect(renderWrappedCard).toHaveBeenCalledTimes(5))
    expect(await screen.findByText('Cards salvos. É só postar nos Stories!')).toBeVisible()
    expect(createObjectURL).toHaveBeenCalledTimes(5)
  })
  it('usa o compartilhar do aparelho quando ele aceita arquivos', async () => {
    const { repo } = server()
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Seus dias na Presença' })
    await user.click(screen.getByRole('button', { name: 'Compartilhar os 4 cards' }))
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
    expect(share.mock.calls[0][0].files).toHaveLength(4)
    expect(share.mock.calls[0][0].text).toContain('Meu Recap Coram de Outubro de 2026')
    Reflect.deleteProperty(navigator, 'canShare'); Reflect.deleteProperty(navigator, 'share')
  })
  it('quem cancela o compartilhar não vê erro', async () => {
    const { repo } = server()
    Object.defineProperty(navigator, 'canShare', { value: () => true, configurable: true })
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('cancelado', 'AbortError')), configurable: true })
    const user = userEvent.setup()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await screen.findByRole('heading', { name: 'Seus dias na Presença' })
    await user.click(screen.getByRole('button', { name: 'Compartilhar este card' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Compartilhar este card' })).toBeEnabled())
    expect(screen.queryByText(/Não foi possível gerar/)).toBeNull()
    Reflect.deleteProperty(navigator, 'canShare'); Reflect.deleteProperty(navigator, 'share')
  })
})

describe('CORAM Wrapped: avanço automático', () => {
  it('avança sozinho a cada 7 segundos, para na pausa e para no último card', async () => {
    // celular (um card por vez) e movimento normal: só a consulta de "menos movimento" é falsa
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('reduced-motion'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { repo } = server()
    render(<CoramWrapped page="recap" repo={repo} today={today} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(50) })
    expect(screen.getByRole('heading', { name: 'Seus dias na Presença' })).toBeVisible()
    await act(async () => { await vi.advanceTimersByTimeAsync(7100) })
    expect(screen.getByRole('heading', { name: 'Livros mais lidos' })).toBeVisible()
    screen.getByRole('button', { name: 'Pausar' }).click()
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(screen.getByRole('heading', { name: 'Livros mais lidos' })).toBeVisible()
    screen.getByRole('button', { name: 'Continuar' }).click()
    await act(async () => { await vi.advanceTimersByTimeAsync(7100) })
    expect(screen.getByRole('heading', { name: 'Sua taxa de acerto na Bereia' })).toBeVisible()
    await act(async () => { await vi.advanceTimersByTimeAsync(7100) })
    expect(screen.getByRole('heading', { name: 'Versículo mais revisitado' })).toBeVisible()
    await act(async () => { await vi.advanceTimersByTimeAsync(30000) })
    expect(screen.getByRole('heading', { name: 'Versículo mais revisitado' })).toBeVisible()
  })
})

describe('CORAM Wrapped: aviso na Home', () => {
  it('aparece nos primeiros dias do mês com o link do mês passado', () => {
    render(<HomeWrapped today="2026-11-04" />)
    expect(screen.getByRole('link', { name: 'Ver outubro de 2026' })).toHaveAttribute('href', '#recap/2026-10')
  })
  it('some no meio do mês e mostra o ano em dezembro', () => {
    const view = render(<HomeWrapped today="2026-11-17" />)
    expect(view.container).toBeEmptyDOMElement()
    view.rerender(<HomeWrapped today="2026-12-22" />)
    expect(screen.getByRole('link', { name: 'Ver o ano de 2026' })).toHaveAttribute('href', '#recap/2026')
  })
})
