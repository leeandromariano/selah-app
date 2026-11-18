import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LogosPage, { type LogosRepository } from './LogosPage'
import { createLogosRepository, type LogosState } from './repository'
import { emptyArmadura } from './rules'

const state = (patch: Partial<LogosState> = {}): LogosState => ({ sparks: 1450, xp: 600, level: 3, vigilia_best_wave: 4, vigilia_runs: 5, farol_runs: 2, farol_wins: 1, kills_total: 90, armadura: emptyArmadura(), ...patch })

function fakeRepo(initial: LogosState = state()) {
  let current = initial
  const lobby = vi.fn(async () => current)
  const upgrade = vi.fn(async (piece: string) => { current = { ...current, sparks: current.sparks - 100 * (current.armadura as Record<string, number>)[piece], armadura: { ...current.armadura, [piece]: (current.armadura as Record<string, number>)[piece] + 1 } }; return current })
  const finishRun = vi.fn(async () => ({ ...current, reward: { sparks: 120, xp: 60 } }))
  return { repo: { lobby, upgrade, finishRun } as unknown as LogosRepository, lobby, upgrade, finishRun }
}

beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('CORAM // LOGOS: lobby', () => {
  it('mostra Centelhas, nível, os dois modos e as seções', async () => {
    const { repo } = fakeRepo()
    render(<LogosPage repo={repo} />)
    expect(await screen.findByRole('button', { name: 'Jogar Vigília na Arena' })).toBeVisible()
    expect(screen.getAllByText('1.450').length).toBeGreaterThan(0)
    expect(screen.getByText('Nível 3')).toBeVisible()
    expect(screen.getByRole('radio', { name: /Vigília na Arena/ })).toBeChecked()
    expect(screen.getByText('Melhor onda: 4 · Partidas: 5')).toBeVisible()
    await userEvent.setup().click(screen.getByRole('radio', { name: /Protocolo Farol/ }))
    expect(screen.getByText('Vitórias: 1 de 2')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Jogar Protocolo Farol' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Campanha' })).toBeDisabled()
    expect(screen.getByRole('link', { name: /Voltar ao Bereia/ })).toHaveAttribute('href', '#bereia')
  })
  it('falha ao abrir mostra a mensagem do servidor', async () => {
    const repo = { lobby: vi.fn(async () => { throw Error('Não foi possível abrir o LOGOS agora.') }) } as unknown as LogosRepository
    render(<LogosPage repo={repo} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir o LOGOS agora.')
  })
})

describe('CORAM // LOGOS: renders 3D com reserva', () => {
  it('usa o render do Portador e, se o arquivo faltar, volta ao desenho em SVG', async () => {
    const { repo } = fakeRepo()
    const { container } = render(<LogosPage repo={repo} />)
    await screen.findByRole('button', { name: 'Jogar Vigília na Arena' })
    const hero = container.querySelector('.lg-hero img.lg-art') as HTMLImageElement
    expect(hero.getAttribute('src')).toBe('/assets/3d/logos/portador-luz.webp')
    expect(hero).toHaveAccessibleName(/Portador da Luz/)
    fireEvent.error(hero)
    expect(container.querySelector('.lg-hero img.lg-art')).toBeNull()
    expect(container.querySelector('.lg-hero svg.lg-bearer')).not.toBeNull()
  })
  it('cada peça da armadura usa o seu render (a Couraça segue o nome do arquivo) e cai no glifo se faltar', async () => {
    const { repo } = fakeRepo()
    const user = userEvent.setup()
    const { container } = render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Armadura & Arsenal' }))
    const files = [...container.querySelectorAll('.lg-piece img')].map(img => (img.getAttribute('src') ?? '').split('/').pop())
    expect(files).toEqual(['armadura-cinturao.webp', 'armadura-couraca.webp', 'armadura-sandalias.webp', 'armadura-capacete.webp', 'armadura-escudo.webp', 'armadura-espada.webp'])
    fireEvent.error(container.querySelector('.lg-piece img') as HTMLImageElement)
    expect(container.querySelectorAll('.lg-piece img')).toHaveLength(5)
    expect(container.querySelector('.lg-piece-icon[data-piece="cinturao"]')).not.toBeNull()
  })
  it('o ícone das Centelhas cai no cristal desenhado quando não há arquivo', async () => {
    const { repo } = fakeRepo()
    const { container } = render(<LogosPage repo={repo} />)
    await screen.findByRole('button', { name: 'Jogar Vigília na Arena' })
    const spark = container.querySelector('.lg-wallet img.lg-art') as HTMLImageElement
    expect(spark.getAttribute('src')).toBe('/assets/3d/logos/centelha.webp')
    fireEvent.error(spark)
    expect(container.querySelector('.lg-wallet .lg-spark')).not.toBeNull()
  })
})

describe('CORAM // LOGOS: Armadura & Arsenal', () => {
  it('aprimora a peça escolhida gastando Centelhas', async () => {
    const { repo, upgrade } = fakeRepo()
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Armadura & Arsenal' }))
    expect(screen.getByRole('heading', { name: 'Espada do Espírito' })).toBeVisible()
    expect(screen.getByText('Custo:', { exact: false })).toHaveTextContent('100 / 1450')
    await user.click(screen.getByRole('button', { name: 'Aprimorar · 100 centelhas' }))
    expect(upgrade).toHaveBeenCalledWith('espada')
    expect(await screen.findByText('Espada do Espírito agora está no nível 2.')).toBeVisible()
    expect(screen.getByText('Custo:', { exact: false })).toHaveTextContent('200 / 1350')
    await user.click(screen.getByRole('button', { name: /Escudo da Fé/ }))
    expect(screen.getByRole('heading', { name: 'Escudo da Fé' })).toBeVisible()
    expect(screen.getByText('Efésios 6:16')).toBeVisible()
  })
  it('sem Centelhas suficientes o botão avisa quantas faltam e não chama o servidor', async () => {
    const { repo, upgrade } = fakeRepo(state({ sparks: 40 }))
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Armadura & Arsenal' }))
    const button = screen.getByRole('button', { name: 'Faltam 60 centelhas' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(upgrade).not.toHaveBeenCalled()
  })
  it('peça no nível máximo não aprimora mais', async () => {
    const { repo } = fakeRepo(state({ armadura: { ...emptyArmadura(), espada: 5 } }))
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Armadura & Arsenal' }))
    expect(screen.getByRole('button', { name: 'Nível máximo' })).toBeDisabled()
    expect(screen.getByText('Peça no nível máximo.')).toBeVisible()
  })
  it('erro do servidor aparece sem quebrar a tela', async () => {
    const { repo, upgrade } = fakeRepo()
    upgrade.mockRejectedValueOnce(Error('Centelhas insuficientes'))
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Armadura & Arsenal' }))
    await user.click(screen.getByRole('button', { name: 'Aprimorar · 100 centelhas' }))
    expect(await screen.findByText('Centelhas insuficientes')).toBeVisible()
  })
})

describe('CORAM // LOGOS: partida', () => {
  it('entra na arena com o HUD e as quatro habilidades; desistir salva o resultado e mostra a recompensa', async () => {
    const { repo, finishRun } = fakeRepo()
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Jogar Vigília na Arena' }))
    const skills = screen.getByRole('group', { name: 'Habilidades' })
    for (const name of ['Pulso de Revelação (C)', 'Escudo da Fé (Q)', 'Espada do Espírito (E)', 'Consumado (X)']) expect(within(skills).getByRole('button', { name })).toBeVisible()
    expect(screen.getByText('HP: 100')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Desistir' }))
    const dialog = await screen.findByRole('dialog', { name: 'Resultado da partida' })
    expect(within(dialog).getByText('A VIGÍLIA TERMINOU')).toBeVisible()
    await waitFor(() => expect(within(dialog).getByText('+120 Centelhas · +60 XP')).toBeVisible())
    expect(finishRun).toHaveBeenCalledTimes(1)
    expect(finishRun).toHaveBeenCalledWith(expect.objectContaining({ mode: 'vigilia', won: false, kills: 0 }))
    await user.click(within(dialog).getByRole('button', { name: 'Voltar ao lobby' }))
    expect(await screen.findByRole('button', { name: 'Jogar Vigília na Arena' })).toBeVisible()
  })
  it('o Farol abre com a névoa e o objetivo; "Jogar de novo" recomeça', async () => {
    const { repo, finishRun } = fakeRepo()
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('radio', { name: /Protocolo Farol/ }))
    await user.click(screen.getByRole('button', { name: 'Jogar Protocolo Farol' }))
    expect(screen.getByText('Protocolo Farol', { selector: 'small' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Desistir' }))
    await user.click(await screen.findByRole('button', { name: 'Jogar de novo' }))
    expect(screen.getByRole('button', { name: 'Desistir' })).toBeEnabled()
    expect(screen.queryByRole('dialog', { name: 'Resultado da partida' })).toBeNull()
    expect(finishRun).toHaveBeenCalledWith(expect.objectContaining({ mode: 'farol' }))
  })
  it('se não der para salvar, mostra o aviso e deixa voltar', async () => {
    const { repo, finishRun } = fakeRepo()
    finishRun.mockRejectedValueOnce(Error('Você jogou muitas partidas seguidas. Respire e volte daqui a pouco'))
    const user = userEvent.setup()
    render(<LogosPage repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Jogar Vigília na Arena' }))
    await user.click(screen.getByRole('button', { name: 'Desistir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Você jogou muitas partidas seguidas')
    expect(screen.getByText('Não foi possível salvar')).toBeVisible()
  })
  it('no celular aparece o analógico virtual e o rótulo muda', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('pointer: coarse'), media: query, addEventListener: () => undefined, removeEventListener: () => undefined }))
    const { repo } = fakeRepo()
    const user = userEvent.setup()
    const { container } = render(<LogosPage repo={repo} />)
    expect(await screen.findByText(/Analógico à esquerda/)).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Jogar Vigília na Arena' }))
    expect(container.querySelector('.lg-stick-zone')).not.toBeNull()
    expect(container.querySelector('.lg-game')).toHaveAttribute('data-touch', 'true')
  })
})

describe('CORAM // LOGOS: repositório', () => {
  const rpc = (data: unknown, error: { message: string } | null = null) => ({ rpc: vi.fn(() => ({ abortSignal: () => Promise.resolve({ data, error }) })) })
  const full = { sparks: 10, xp: 5, level: 1, vigilia_best_wave: 0, vigilia_runs: 0, farol_runs: 0, farol_wins: 0, kills_total: 0, armadura: emptyArmadura() }
  it('abre o lobby e valida a resposta', async () => {
    const client = rpc(full)
    expect(await createLogosRepository(client as never).lobby()).toMatchObject({ sparks: 10, armadura: emptyArmadura() })
    expect(client.rpc).toHaveBeenCalledWith('logos_lobby', {})
    await expect(createLogosRepository(rpc({ ...full, sparks: -1 }) as never).lobby()).rejects.toThrow('Resposta inválida do servidor.')
    await expect(createLogosRepository(rpc({ ...full, armadura: { ...emptyArmadura(), espada: 9 } }) as never).lobby()).rejects.toThrow('Resposta inválida')
    await expect(createLogosRepository(rpc(null) as never).lobby()).rejects.toThrow('Resposta inválida')
  })
  it('só repassa mensagens conhecidas; o resto vira texto genérico', async () => {
    await expect(createLogosRepository(rpc(null, { message: 'Centelhas insuficientes' }) as never).upgrade('espada')).rejects.toThrow('Centelhas insuficientes')
    await expect(createLogosRepository(rpc(null, { message: 'duplicate key value violates constraint x' }) as never).upgrade('espada')).rejects.toThrow('Não foi possível aprimorar a peça agora. Tente de novo.')
    await expect(createLogosRepository(rpc(full) as never).upgrade('outra' as never)).rejects.toThrow('Peça de armadura inválida.')
  })
  it('envia o resultado da partida dentro dos limites do servidor', async () => {
    const client = rpc({ ...full, reward: { sparks: 100, xp: 40 } })
    const out = await createLogosRepository(client as never).finishRun({ mode: 'vigilia', wave: 4.8, kills: 9999, seconds: 2.2, won: false })
    expect(client.rpc).toHaveBeenCalledWith('logos_run_finish', { p_mode: 'vigilia', p_wave: 4, p_kills: 25, p_seconds: 5, p_won: false })
    expect(out.reward).toEqual({ sparks: 100, xp: 40 })
    await expect(createLogosRepository(rpc(full) as never).finishRun({ mode: 'farol', wave: 0, kills: 1, seconds: 60, won: true })).rejects.toThrow('Resposta inválida')
  })
})
