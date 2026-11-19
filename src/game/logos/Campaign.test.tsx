import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogosPage, { type LogosRepository } from './LogosPage'
import { JourneyLogos } from './Fragments'
import { StoryResult } from './StoryResult'
import { createLogosRepository, type Fragment, type LogosState } from './repository'
import { drawFragmentCard, wrapLines, type FragmentContext } from './fragmentCard'
import { emptyArmadura } from './rules'
import { phases } from './campaign'

const state = (): LogosState => ({ sparks: 500, xp: 600, level: 3, vigilia_best_wave: 2, vigilia_runs: 1, farol_runs: 0, farol_wins: 0, kills_total: 5, armadura: emptyArmadura() })
const frag = (phase: number): Fragment => ({ phase, reference: phases[phase - 1].reference, obtained_at: '2026-11-20T10:00:00Z', clears: 2, best_seconds: 75 })
function fakeRepo(fragments: Fragment[] = []) {
  const campaign = vi.fn(async () => fragments)
  const finishPhase = vi.fn(async (r: { phase: number; won: boolean }) => ({ ...state(), reward: { sparks: 100, xp: 70 }, fragment: r.won ? { phase: r.phase, reference: phases[r.phase - 1].reference, is_new: true } : null }))
  return { repo: { lobby: vi.fn(async () => state()), upgrade: vi.fn(), finishRun: vi.fn(), campaign, finishPhase } as unknown as LogosRepository, campaign, finishPhase }
}
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('LOGOS: Campanha', () => {
  it('o lobby mostra o próximo passo da história e o mapa tem 16 fases com os estados certos', async () => {
    const { repo } = fakeRepo([frag(1), frag(2), frag(3)])
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    expect(await screen.findByText('Ato I: O Deserto')).toBeVisible()
    expect(screen.getByText('Fase 4: O Tentador')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Continuar a campanha' }))
    const map = screen.getByRole('group', { name: 'Mapa da campanha' })
    expect(within(map).getAllByRole('button')).toHaveLength(16)
    expect(within(map).getByRole('button', { name: /fase 1: A Primeira Tentação \(concluída\)/ })).toBeVisible()
    expect(within(map).getByRole('button', { name: 'Ato I, fase 4: O Tentador' })).toBeVisible()
    expect(within(map).getByRole('button', { name: /fase 1: A Primeira Tentação/ })).toHaveAttribute('data-state', 'done')
    expect(within(map).getByRole('button', { name: /fase 4: O Tentador$/ })).toHaveAttribute('data-state', 'open')
    expect(within(map).getByRole('button', { name: /Ato II, fase 1.*\(bloqueada\)/ })).toHaveAttribute('data-state', 'locked')
    expect(screen.getByRole('heading', { name: /ATO I • FASE 4: O TENTADOR/ })).toBeVisible()
  })
  it('fase bloqueada não entra na arena; a aberta mostra objetivos, escritura e recompensa', async () => {
    const { repo } = fakeRepo([frag(1)])
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Campanha' }))
    expect(screen.getByRole('heading', { name: /FASE 2: VENTO DE AREIA/ })).toBeVisible()
    expect(screen.getByText('Sobreviver 60 segundos')).toBeVisible()
    expect(screen.getByText('Isaías 43:2')).toBeVisible()
    expect(screen.getByText('+110')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Ato II, fase 3/ }))
    expect(screen.getByRole('button', { name: 'Conclua a fase anterior' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Ato I, fase 1.*concluída/ }))
    expect(screen.getByText('(repetição rende 30%)')).toBeVisible()
    expect(screen.getByText('+30')).toBeVisible()
  })
  it('entra na fase, mostra o HUD da história e, ao desistir, salva a derrota e deixa tentar de novo', async () => {
    const { repo, finishPhase } = fakeRepo()
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Campanha' }))
    await user.click(screen.getByRole('button', { name: 'Entrar na arena →' }))
    expect(screen.getByText('A Primeira Tentação', { selector: 'small' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Desistir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Resultado da fase' })
    expect(within(dialog).getByText('AS TREVAS RESISTIRAM')).toBeVisible()
    expect(within(dialog).queryByLabelText('Fragmento desbloqueado')).toBeNull()
    await waitFor(() => expect(finishPhase).toHaveBeenCalledWith(expect.objectContaining({ phase: 1, won: false })))
    await waitFor(() => expect(within(dialog).queryByText('Salvando…')).toBeNull())
    expect(finishPhase).toHaveBeenCalledTimes(1)
    await user.click(within(dialog).getByRole('button', { name: 'Voltar à campanha' }))
    expect(await screen.findByRole('group', { name: 'Mapa da campanha' })).toBeVisible()
  })
  it('a tela de Fragmentos mostra os coletados e tranca os demais', async () => {
    const { repo } = fakeRepo([frag(1), frag(7)])
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Fragmentos' }))
    expect(screen.getByRole('heading', { name: /Fragmentos Bíblicos/ })).toHaveTextContent('2 de 16')
    expect(screen.getByText('Mateus 4:4')).toBeVisible(); expect(screen.getByText('Salmos 23:4')).toBeVisible()
    expect(screen.getAllByLabelText('Fragmento ainda não coletado')).toHaveLength(14)
    expect(screen.getByRole('region', { name: 'Ato II: O Vale das Sombras' })).toBeVisible()
  })
})

describe('LOGOS: tela de Vitória', () => {
  const phase = phases[6]
  const base = { phase, won: true, kills: 14, seconds: 161, error: '', nextPhase: phases[7], onNext: vi.fn(), onAgain: vi.fn(), onExit: vi.fn() }
  const saved = { ...state(), xp: 650, reward: { sparks: 260, xp: 130 }, fragment: { phase: 7, reference: 'Salmos 23:4', is_new: true } }
  it('mostra o fragmento, as recompensas, o nível novo e as ações', async () => {
    const user = userEvent.setup()
    const onNext = vi.fn()
    render(<StoryResult {...base} saved={saved} onNext={onNext} />)
    expect(screen.getByText('ATO II · FASE 3 CONCLUÍDA')).toBeVisible()
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('VITÓRIA // ESTÁ CONSUMADO')
    const card = screen.getByRole('article', { name: 'Fragmento desbloqueado' })
    expect(within(card).getByText('FRAGMENTO DESBLOQUEADO')).toBeVisible(); expect(within(card).getAllByText('Salmos 23:4').length).toBeGreaterThan(0); expect(within(card).getByText(phase.theme)).toBeVisible()
    expect(screen.getByText('+260 Centelhas')).toBeVisible(); expect(screen.getByText(/^\+130 XP/)).toBeVisible()
    expect(screen.getByText('02:41')).toBeVisible(); expect(screen.getByText('Fragmento salvo ✓')).toBeVisible(); expect(screen.getByText('14')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Próxima fase →' }))
    expect(onNext).toHaveBeenCalled()
  })
  it('repetir a fase avisa que o fragmento já era seu; sem próxima fase some o botão', () => {
    render(<StoryResult {...base} phase={phases[15]} nextPhase={null} saved={{ ...saved, fragment: { phase: 16, reference: 'João 19:30', is_new: false } }} />)
    expect(screen.getByText('FRAGMENTO JÁ COLETADO')).toBeVisible(); expect(screen.getByText('Já estava salvo ✓')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Próxima fase →' })).toBeNull()
  })
  it('sem rede mostra o erro e não finge que salvou', () => {
    render(<StoryResult {...base} saved={null} error="Não foi possível salvar a fase agora." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar a fase agora.')
    expect(screen.getByText('Não salvo')).toBeVisible()
  })
  it('compartilhar gera a imagem e baixa quando o aparelho não tem compartilhamento de arquivos', async () => {
    const user = userEvent.setup()
    const blob = new Blob(['x'], { type: 'image/png' })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(cb => cb(blob))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true }) as never)
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), configurable: true })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    render(<StoryResult {...base} saved={saved} />)
    await user.click(screen.getByRole('button', { name: 'Compartilhar nos Stories' }))
    await waitFor(() => expect(click).toHaveBeenCalled())
    expect(await screen.findByText('Imagem salva. Compartilhe nos Stories.')).toBeVisible()
  })
})

describe('LOGOS: card do fragmento e Minha Jornada', () => {
  it('o card traz a referência e o tema, sem citar versículo', () => {
    const texts: string[] = []
    const ctx = new Proxy({ measureText: (t: string) => ({ width: t.length * 20 }), fillText: (t: string) => { texts.push(t) }, createLinearGradient: () => ({ addColorStop: () => undefined }), createRadialGradient: () => ({ addColorStop: () => undefined }) }, { get: (t, k) => (k in t ? (t as never)[k] : () => undefined), set: () => true }) as unknown as FragmentContext
    drawFragmentCard(ctx, { reference: 'Salmos 23:4', theme: 'Sem medo, mesmo no vale.', phaseName: 'A Travessia · Ato II', label: 'Ato II · Fase 3 concluída', host: 'coram.app' })
    expect(texts).toEqual(expect.arrayContaining(['CORAM // LOGOS', 'FRAGMENTO DESBLOQUEADO', 'Salmos 23:4', 'A Travessia · Ato II', 'coram.app']))
    expect(wrapLines({ measureText: t => ({ width: t.length * 10 }) }, 'uma frase longa para quebrar em linhas curtas', 120).length).toBeGreaterThan(2)
  })
  it('Minha Jornada lista os fragmentos; sem nenhum, convida a jogar; se falhar, some', async () => {
    const some = createLogosRepository({ rpc: () => ({ abortSignal: async () => ({ data: { fragments: [frag(1), frag(2)] }, error: null }) }) } as never)
    const { unmount } = render(<JourneyLogos repo={some} />)
    expect(await screen.findByRole('heading', { name: 'Fragmentos Bíblicos' })).toBeVisible()
    expect(screen.getByText('2 de 16 · CORAM // LOGOS')).toBeVisible(); expect(screen.getByText('Mateus 4:4')).toBeVisible()
    unmount()
    const none = createLogosRepository({ rpc: () => ({ abortSignal: async () => ({ data: { fragments: [] }, error: null }) }) } as never)
    const second = render(<JourneyLogos repo={none} />)
    expect(await screen.findByRole('link', { name: 'Jogar agora →' })).toHaveAttribute('href', '#bereia/logos')
    second.unmount()
    const broken = createLogosRepository({ rpc: () => ({ abortSignal: async () => ({ data: null, error: { message: 'x' } }) }) } as never)
    const { container } = render(<JourneyLogos repo={broken} />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })
})

describe('LOGOS: repositório da campanha', () => {
  const rpc = (data: unknown, error: { message: string } | null = null) => ({ rpc: vi.fn(() => ({ abortSignal: () => Promise.resolve({ data, error }) })) })
  const full = { sparks: 10, xp: 5, level: 1, vigilia_best_wave: 0, vigilia_runs: 0, farol_runs: 0, farol_wins: 0, kills_total: 0, armadura: emptyArmadura() }
  it('lê os fragmentos e descarta lixo', async () => {
    const client = rpc({ fragments: [frag(1), { phase: 99, reference: 'x' }, null, { ...frag(3), clears: -1 }] })
    expect(await createLogosRepository(client as never).campaign()).toEqual([frag(1)])
    expect(client.rpc).toHaveBeenCalledWith('logos_campaign', {})
    await expect(createLogosRepository(rpc(null) as never).campaign()).rejects.toThrow('Resposta inválida')
  })
  it('envia o resultado da fase e exige o fragmento quando vence', async () => {
    const client = rpc({ ...full, reward: { sparks: 100, xp: 70 }, fragment: { phase: 1, reference: 'Mateus 4:4', is_new: true } })
    const out = await createLogosRepository(client as never).finishPhase({ phase: 1, won: true, kills: 9999, seconds: 2 })
    expect(client.rpc).toHaveBeenCalledWith('logos_phase_finish', { p_phase: 1, p_won: true, p_kills: 25, p_seconds: 5 })
    expect(out.fragment).toEqual({ phase: 1, reference: 'Mateus 4:4', is_new: true })
    await expect(createLogosRepository(rpc({ ...full, reward: { sparks: 1, xp: 1 }, fragment: null }) as never).finishPhase({ phase: 1, won: true, kills: 1, seconds: 60 })).rejects.toThrow('Resposta inválida')
    expect((await createLogosRepository(rpc({ ...full, reward: { sparks: 3, xp: 10 }, fragment: null }) as never).finishPhase({ phase: 1, won: false, kills: 3, seconds: 60 })).fragment).toBeNull()
    await expect(createLogosRepository(rpc(full) as never).finishPhase({ phase: 17, won: true, kills: 1, seconds: 60 })).rejects.toThrow('Fase inválida.')
    await expect(createLogosRepository(rpc(null, { message: 'Esta fase ainda está bloqueada' }) as never).finishPhase({ phase: 2, won: true, kills: 1, seconds: 60 })).rejects.toThrow('Esta fase ainda está bloqueada')
  })
})
