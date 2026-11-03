import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { JourneyLastOpening } from './JourneyLastOpening'
import { libraryBoundary, olderPublications } from '../test/libraryBoundary'

const userId = 'fictional-reader'
const item = olderPublications[0]
const opening = { id: 'opening-fiction', devotional_id: item.id, opened_at: '2026-10-28T14:00:00Z' }

describe('última abertura na jornada', () => {
  it('oferece retomada por teclado usando somente a última abertura e conteúdo publicado', async () => {
    const boundary = libraryBoundary([item], [opening])
    const user = userEvent.setup()
    render(<JourneyLastOpening userId={userId} />)
    expect(await screen.findByText(item.title)).toBeVisible()
    expect(screen.getByText(/Aberto em/)).toHaveTextContent('28 de out. de 2026')
    const link = screen.getByRole('link', { name: 'Continuar leitura' })
    expect(link).toHaveAttribute('href', `#leitura/${item.id}/retomar`)
    await user.tab(); expect(link).toHaveFocus()
    expect(boundary.historyQuery.eq).toHaveBeenCalledWith('user_id', userId)
    expect(boundary.historyQuery.range).toHaveBeenCalledWith(0, 0)
    expect(boundary.publicationsQuery.eq).toHaveBeenCalledWith('id', item.id)
    expect(boundary.publicationsQuery.eq).toHaveBeenCalledWith('status', 'published')
    expect(boundary.publicationsQuery.lte).toHaveBeenCalledWith('publish_at', expect.any(String))
    expect(boundary.historyQuery.insert).not.toHaveBeenCalled()
    expect(screen.getByText(/não representa uma conclusão/)).toBeVisible()
  })
  it('mostra vazio sem consultar conteúdo quando não há aberturas', async () => {
    const boundary = libraryBoundary([], [])
    render(<JourneyLastOpening userId={userId} />)
    expect(await screen.findByText(/Você ainda não abriu nenhum devocional/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Conhecer o acervo' })).toHaveAttribute('href', '#historico')
    expect(boundary.publicationsQuery.select).not.toHaveBeenCalled()
  })
  it.each([null, item.id])('não oferece retomada para abertura órfã ou publicação indisponível: %s', async devotionalId => {
    libraryBoundary([], [{ ...opening, devotional_id: devotionalId }])
    render(<JourneyLastOpening userId={userId} />)
    expect(await screen.findByText('Devocional indisponível')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Continuar leitura' })).not.toBeInTheDocument()
  })
  it('distingue erro de vazio e permite recuperar a última abertura', async () => {
    const boundary = libraryBoundary([item], [opening])
    boundary.historyQuery.range.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'private@example.invalid' } })
    const user = userEvent.setup()
    render(<JourneyLastOpening userId={userId} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Você não tem autorização')
    expect(screen.getByRole('alert')).not.toHaveTextContent('private@')
    expect(screen.queryByText(/Você ainda não abriu/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar carregar última abertura' }))
    expect(await screen.findByText(item.title)).toBeVisible()
  })
  it('trata falha ao consultar a publicação como erro, não como conteúdo removido', async () => {
    const boundary = libraryBoundary([item], [opening])
    boundary.publicationsQuery.range.mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } })
    render(<JourneyLastOpening userId={userId} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
    expect(screen.queryByText('Devocional indisponível')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Continuar leitura' })).not.toBeInTheDocument()
  })
  it('não mostra resposta atrasada depois de trocar de conta', async () => {
    const boundary = libraryBoundary([], [])
    let finish!: (value: unknown) => void
    boundary.historyQuery.range.mockReturnValueOnce(new Promise(resolve => { finish = resolve }) as never)
    const view = render(<JourneyLastOpening key="first" userId="first" />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sua última abertura')
    view.rerender(<JourneyLastOpening key="second" userId="second" />)
    expect(await screen.findByText(/Você ainda não abriu nenhum devocional/)).toBeVisible()
    await act(async () => { finish({ data: [opening], error: null }) })
    await waitFor(() => expect(screen.queryByText(item.title)).not.toBeInTheDocument())
    expect(boundary.publicationsQuery.select).not.toHaveBeenCalled()
  })
})
