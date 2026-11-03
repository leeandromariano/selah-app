import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ThemeExplorer, SeriesExplorer, SeriesDetail, SeriesReadingNavigation } from './EditorialReader'
import type { AvailableSeries, AvailableTheme, VisibleEpisode } from './types'

const theme: AvailableTheme = { id: 't', name: 'Esperança fictícia', slug: 'esperanca', description: null }
const series: AvailableSeries = { id: 's', title: 'Série fictícia', slug: 'serie', description: 'Descrição fictícia' }
const episodes: VisibleEpisode[] = [{ id: 'one', title: 'Primeiro episódio', bibleReference: 'Ref 1' }, { id: 'two', title: 'Segundo episódio', bibleReference: 'Ref 2' }]
const ready = <T,>(items: T[]) => ({ status: 'ready' as const, data: { items, nextPage: null } })
describe('componentes editoriais com dados simulados', () => {
  it('seleciona tema e abre devocional por teclado sem consultar servidor', async () => {
    const user = userEvent.setup(), onSelect = vi.fn(), onRead = vi.fn()
    const view = render(<ThemeExplorer themes={ready([theme])} selected={null} devotionals={null} onSelect={onSelect} onBack={vi.fn()} onRead={onRead} />)
    await user.tab(); await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith(theme)
    view.rerender(<ThemeExplorer themes={ready([theme])} selected={theme} devotionals={{ slug: theme.slug, value: ready(episodes) }} onSelect={onSelect} onBack={vi.fn()} onRead={onRead} />)
    await user.click(screen.getByRole('button', { name: /Primeiro episódio/ }))
    expect(onRead).toHaveBeenCalledExactlyOnceWith('one')
  })
  it.each(['loading','empty','unavailable','error'] as const)('distingue estado de temas: %s', status => {
    render(<ThemeExplorer themes={{ status }} selected={null} devotionals={null} onSelect={vi.fn()} onBack={vi.fn()} onRead={vi.fn()} />)
    expect(screen.getByRole(status === 'error' ? 'alert' : 'status')).toBeVisible()
  })
  it('lista vazia de séries não fabrica cards', () => {
    render(<SeriesExplorer series={ready([])} onSelect={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Ainda não há conteúdo')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
  it('preserva ordem recebida e navega apenas pelos episódios visíveis', async () => {
    const user = userEvent.setup(), onRead = vi.fn()
    render(<SeriesDetail series={series} episodes={{ slug: 'serie', value: ready(episodes) }} onBack={vi.fn()} onRead={onRead} />)
    const list = screen.getByRole('list')
    expect(list.textContent!.indexOf('Primeiro episódio')).toBeLessThan(list.textContent!.indexOf('Segundo episódio'))
    expect(list.textContent).not.toContain('Rascunho oculto')
    await user.click(screen.getByRole('button', { name: /Segundo episódio/ }))
    expect(onRead).toHaveBeenCalledExactlyOnceWith('two')
  })
  it('não mostra resposta atrasada de outra série nem conteúdo indisponível', () => {
    const view = render(<SeriesDetail series={series} episodes={{ slug: 'outra', value: ready(episodes) }} onBack={vi.fn()} onRead={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(screen.queryByText('Primeiro episódio')).not.toBeInTheDocument()
    view.rerender(<SeriesDetail series={series} episodes={{ slug: 'serie', value: { status: 'unavailable' } }} onBack={vi.fn()} onRead={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('não está disponível')
    expect(screen.queryByText('Primeiro episódio')).not.toBeInTheDocument()
  })
  it('volta e avança sem registrar abertura ou conclusão', async () => {
    const user = userEvent.setup(), onBack = vi.fn(), onNext = vi.fn()
    const view = render(<SeriesReadingNavigation series={series} next={episodes[1]} onBack={onBack} onNext={onNext} />)
    await user.click(screen.getByRole('button', { name: /Próximo episódio/ }))
    await user.click(screen.getByRole('button', { name: /Voltar à série/ }))
    expect(onNext).toHaveBeenCalledExactlyOnceWith('two'); expect(onBack).toHaveBeenCalledOnce()
    view.rerender(<SeriesReadingNavigation series={series} next={null} onBack={onBack} onNext={onNext} />)
    expect(screen.queryByRole('button', { name: /Próximo episódio/ })).not.toBeInTheDocument()
  })
  it('seleciona uma série e solicita próxima página somente quando disponível', async () => {
    const user = userEvent.setup(), select = vi.fn(), more = vi.fn()
    render(<SeriesExplorer series={{ status: 'ready', data: { items: [series], nextPage: 2 } }} onSelect={select} onMore={more} />)
    await user.click(screen.getByRole('button', { name: /Série fictícia/ }))
    await user.click(screen.getByRole('button', { name: 'Carregar mais' }))
    expect(select).toHaveBeenCalledExactlyOnceWith(series)
    expect(more).toHaveBeenCalledExactlyOnceWith(2)
  })
  it('não mostra devocionais de outro tema nem episódios em erro', () => {
    const view = render(<ThemeExplorer themes={ready([theme])} selected={theme} devotionals={{ slug: 'outro', value: ready(episodes) }} onSelect={vi.fn()} onBack={vi.fn()} onRead={vi.fn()} />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(screen.queryByText('Primeiro episódio')).not.toBeInTheDocument()
    view.rerender(<SeriesDetail series={series} episodes={{ slug: 'serie', value: { status: 'error' } }} onBack={vi.fn()} onRead={vi.fn()} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível carregar')
    expect(screen.queryByText('Primeiro episódio')).not.toBeInTheDocument()
  })

})
