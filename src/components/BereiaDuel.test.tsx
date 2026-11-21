import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DuelHub, DuelRoom } from './BereiaDuel'
import { createDuelRepository } from '../duel/repository'
import type { DuelAnswer } from '../duel/repository'

vi.mock('../duel/card', () => ({ renderDuelCard: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })) }))
import { renderDuelCard } from '../duel/card'

const code = 'a1b2c3d4e5'
const qid = (n: number) => `1111111${n}-1111-4111-8111-111111111111`
const questions = [1, 2, 3, 4, 5].map(n => ({ id: qid(n), prompt: `Pergunta ${n}?`, options: ['Alfa', 'Beta', 'Gama', 'Delta'] }))
// o servidor de mentira sempre tem a opção B (índice 1) como a certa
function server(opts: { finished?: boolean; answers?: DuelAnswer[]; creator?: boolean; players?: unknown[]; failOpen?: string; failAnswer?: boolean } = {}) {
  const done = new Set((opts.answers ?? []).map(a => a.question_id))
  const rpc = vi.fn((name: string, args?: Record<string, unknown>) => ({
    abortSignal: async () => {
      if (name === 'duel_open') return opts.failOpen ? { data: null, error: { message: opts.failOpen } } : { data: { code, mode: 'novo', level: 2, size: 5, creator: 'ana', is_creator: opts.creator ?? false, finished: opts.finished ?? false, questions, answers: opts.answers ?? [] }, error: null }
      if (name === 'duel_answer') {
        if (opts.failAnswer) return { data: null, error: { message: 'boom' } }
        done.add(args?.p_question_id as string)
        return { data: { correct: args?.p_selected === 1, correct_index: 1, reference: 'João 3:16', counted: true, finished: done.size >= 5 }, error: null }
      }
      if (name === 'duel_result') return { data: { code, mode: 'novo', level: 2, size: 5, waiting: 1, players: opts.players ?? [
        { username: 'ana', correct: 2, total_ms: 21000, is_me: false, is_creator: true }, { username: 'beto', correct: 3, total_ms: 30000, is_me: true, is_creator: false }] }, error: null }
      if (name === 'duel_create') return { data: { code }, error: null }
      if (name === 'duel_mine') return { data: [{ code, mode: 'novo', level: 2, size: 5, created_at: '2026-11-18T10:00:00Z', creator: 'ana', is_creator: false, finished: true, correct: 3 }], error: null }
      return { data: null, error: { message: 'desconhecida' } }
    },
  }))
  return { rpc, repo: createDuelRepository({ rpc } as never) }
}
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('Duelo: escolher o desafio', () => {
  it('cria o duelo com a escolha e abre a sala; lista meus duelos', async () => {
    const { repo, rpc } = server()
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<DuelHub repo={repo} onCreated={onCreated} />)
    expect(await screen.findByText('Desafio de @ana · 3 de 5')).toBeVisible()
    await user.click(screen.getByLabelText('Novo Testamento'))
    await user.click(screen.getByLabelText('Avançado'))
    await user.click(screen.getByLabelText('10 perguntas'))
    await user.click(screen.getByRole('button', { name: 'Criar desafio' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(code))
    expect(rpc).toHaveBeenCalledWith('duel_create', { p_mode: 'novo', p_level: 3, p_size: 10 })
  })
  it('mostra o erro do servidor e deixa tentar de novo', async () => {
    const rpc = vi.fn((name: string) => ({ abortSignal: async () => (name === 'duel_create' ? { data: null, error: { message: 'Ainda não há perguntas suficientes nesta combinação.' } } : { data: [], error: null }) }))
    render(<DuelHub repo={createDuelRepository({ rpc } as never)} onCreated={vi.fn()} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Criar desafio' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda não há perguntas suficientes')
    expect(screen.getByRole('button', { name: 'Criar desafio' })).toBeEnabled()
  })
})

describe('Duelo: sala', () => {
  it('convite, jogo e placar: responde as perguntas e compara com o criador', async () => {
    const { repo, rpc } = server()
    const user = userEvent.setup()
    render(<DuelRoom code={code} repo={repo} />)
    expect(await screen.findByRole('heading', { name: '@ana te desafiou!' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Começar' }))
    for (let n = 1; n <= 5; n++) {
      expect(await screen.findByRole('heading', { name: `Pergunta ${n}?` })).toBeVisible()
      await user.click(screen.getByRole('button', { name: /Beta/ }))
      expect(await screen.findByText('Você acertou! 🎉')).toBeVisible()
      await user.click(screen.getByRole('button', { name: n < 5 ? 'Próxima pergunta →' : 'Ver placar' }))
    }
    expect(rpc.mock.calls.filter(call => call[0] === 'duel_answer')).toHaveLength(5)
    expect(await screen.findByRole('heading', { name: 'Ganhei o duelo! 🏆' })).toBeVisible()
    const versus = screen.getByLabelText('Comparação')
    expect(within(versus).getByText('@ana')).toBeVisible()
    expect(screen.getByText(/1 amigo ainda está jogando/)).toBeVisible()
    expect(screen.getByRole('link', { name: 'Desafiar pelo WhatsApp' })).toHaveAttribute('href', expect.stringContaining('https://wa.me/?text='))
    expect(decodeURIComponent(screen.getByRole('link', { name: 'Desafiar pelo WhatsApp' }).getAttribute('href') ?? '')).toContain(`#bereia/duelo/${code}`)
  })
  it('quando o tempo acaba, a pergunta é enviada como esgotada e a certa aparece', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { repo, rpc } = server()
    render(<DuelRoom code={code} repo={repo} />)
    await act(async () => { await vi.advanceTimersByTimeAsync(10) })
    fireEventStart()
    await act(async () => { await vi.advanceTimersByTimeAsync(15500) })
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('duel_answer', { p_code: code, p_question_id: qid(1), p_selected: -1, p_elapsed_ms: expect.any(Number) }))
    expect(await screen.findByText('O tempo acabou.')).toBeVisible()
  })
  it('quem volta no meio do duelo continua da primeira pergunta sem resposta', async () => {
    const answered: DuelAnswer[] = [{ question_id: qid(1), selected: 1, correct: true, correct_index: 1, reference: 'João 3:16' }]
    const { repo } = server({ answers: answered })
    render(<DuelRoom code={code} repo={repo} />)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Continuar' }))
    expect(await screen.findByRole('heading', { name: 'Pergunta 2?' })).toBeVisible()
  })
  it('quem já terminou vai direto ao placar e pode copiar o link e gerar o card', async () => {
    const { repo } = server({ finished: true })
    const user = userEvent.setup() // antes de trocar a área de transferência: o user-event instala a dele no setup
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:x'), configurable: true })
    Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
    render(<DuelRoom code={code} repo={repo} />)
    expect(await screen.findByRole('heading', { name: 'Ganhei o duelo! 🏆' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Copiar link' }))
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`#bereia/duelo/${code}`))
    expect(await screen.findByText('Link copiado!')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Card para os Stories' }))
    await waitFor(() => expect(renderDuelCard).toHaveBeenCalledWith(expect.objectContaining({ size: 5, rival: expect.objectContaining({ username: 'ana' }) })))
    expect(await screen.findByText('Card salvo. É só postar nos Stories!')).toBeVisible()
  })
  it('o criador sem convidados vê o convite e nenhuma comparação', async () => {
    const { repo } = server({ finished: true, creator: true, players: [{ username: 'ana', correct: 2, total_ms: 21000, is_me: true, is_creator: true }] })
    render(<DuelRoom code={code} repo={repo} />)
    expect(await screen.findByText(/Ninguém mais terminou ainda/)).toBeVisible()
    expect(screen.queryByLabelText('Comparação')).toBeNull()
  })
  it('duelo inexistente ou expirado mostra o aviso e o caminho para criar outro', async () => {
    const { repo } = server({ failOpen: 'Duelo não encontrado ou expirado.' })
    render(<DuelRoom code={code} repo={repo} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Duelo não encontrado ou expirado.')
    expect(screen.getByRole('link', { name: 'Criar um duelo' })).toHaveAttribute('href', '#bereia/duelo')
  })
  it('falha ao registrar a resposta avisa e deixa tentar de novo', async () => {
    const { repo } = server({ failAnswer: true })
    const user = userEvent.setup()
    render(<DuelRoom code={code} repo={repo} />)
    await user.click(await screen.findByRole('button', { name: 'Começar' }))
    await user.click(await screen.findByRole('button', { name: /Beta/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar sua resposta')
    expect(screen.getByRole('button', { name: /Beta/ })).toBeEnabled()
  })
})

function fireEventStart() {
  screen.getByRole('button', { name: 'Começar' }).click()
}
