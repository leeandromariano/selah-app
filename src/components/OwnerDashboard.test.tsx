import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OwnerDashboard } from './OwnerDashboard'
import { parseDashboard } from '../owner/dashboard'
import { payload } from '../owner/dashboard.fixture'

vi.mock('./CommunityPanel', () => ({ CommunityPanel: () => <div>Comunidade fictícia</div> }))
vi.mock('./ModerationPanel', () => ({ ModerationPanel: () => <div>Moderação fictícia</div> }))
vi.mock('./OwnerContentPanel', () => ({ OwnerContentPanel: () => <div>Perguntas fictícias</div> }))
vi.mock('./BereiaRankingPanel', () => ({ BereiaRankingPanel: () => <div>Ranking fictício</div> }))
vi.mock('./PublisherManagement', () => ({ PublisherManagement: () => <div>Publicadores fictícios</div> }))

const repo = (overrides: Record<string, unknown> = {}) => ({ load: vi.fn(async (days: 7 | 30 | 90) => parseDashboard(payload(days), days)), ...overrides })

describe('Painel OWNER em dashboard', () => {
  it('mostra a visão geral com cartões, gráficos e os devocionais mais lidos', async () => {
    render(<OwnerDashboard page="owner" repo={repo() as never} />)
    expect(await screen.findByText('Leitores', { selector: '.dash-kpi-label' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Painel OWNER')
    expect(screen.getByText('Para moderar').closest('.dash-kpi')).toHaveTextContent('3')
    expect(screen.getByText('Para moderar').closest('.dash-kpi')).toHaveAttribute('data-alert', 'true')
    expect(screen.getByRole('img', { name: /Atividade por dia/ })).toBeVisible()
    expect(screen.getByRole('img', { name: /Respostas por jogo/ })).toHaveAccessibleName(/Quiz bíblico 10/)
    expect(screen.getByRole('table')).toHaveTextContent('Leitura fictícia')
    expect(screen.getByText(/Dados até 12\/11\/2026 · últimos 30 dias/)).toBeVisible()
  })
  it('a área escolhida muda os cartões e o detalhamento, e marca o link atual', async () => {
    render(<OwnerDashboard page="owner/bereia" repo={repo() as never} />)
    expect(await screen.findByText('Jogadores')).toBeVisible()
    expect(screen.getByText('Ranking fictício')).toBeVisible()
    expect(screen.queryByText('Leitores cadastrados')).not.toBeInTheDocument()
    expect(within(screen.getByRole('navigation', { name: 'Áreas do painel' })).getByRole('link', { name: /Bereia/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('Aproveitamento').closest('.dash-kpi')).toHaveTextContent('70%')
  })
  it.each([['owner/comunidade', 'Leitores cadastrados', 'Comunidade fictícia'], ['owner/moderacao', 'Reflexões aprovadas', 'Moderação fictícia'], ['owner/perguntas', 'Perguntas do quiz', 'Perguntas fictícias'], ['owner/publicadores', 'Perguntas do quiz', 'Publicadores fictícios']])('em %s mostra os indicadores e o detalhamento da área', async (page, kpi, detail) => {
    render(<OwnerDashboard page={page} repo={repo() as never} />)
    expect(await screen.findByText(kpi)).toBeVisible()
    expect(screen.getByText(detail)).toBeVisible()
  })
  it('trocar o período busca os números de novo e atualiza o texto de referência', async () => {
    const r = repo()
    render(<OwnerDashboard page="owner" repo={r as never} />)
    await screen.findByText('Leitores', { selector: '.dash-kpi-label' })
    await userEvent.setup().click(screen.getByRole('button', { name: '7 dias' }))
    expect(r.load).toHaveBeenLastCalledWith(7)
    expect(await screen.findByText(/últimos 7 dias/)).toBeVisible()
    expect(screen.getByRole('button', { name: '7 dias' })).toHaveAttribute('aria-pressed', 'true')
  })
  it('mostra erro de acesso e permite repetir a consulta', async () => {
    const load = vi.fn().mockRejectedValueOnce(Error('x')).mockImplementation(async (days: 7 | 30 | 90) => parseDashboard(payload(days), days))
    render(<OwnerDashboard page="owner" repo={{ load } as never} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo do proprietário')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByText('Leitores', { selector: '.dash-kpi-label' })).toBeVisible()
  })
  it('atualiza os dados pelo botão Atualizar', async () => {
    const r = repo()
    render(<OwnerDashboard page="owner" repo={r as never} />)
    await screen.findByText('Leitores', { selector: '.dash-kpi-label' })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(r.load).toHaveBeenCalledTimes(2)
  })
})
