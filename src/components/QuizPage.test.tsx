import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { QuizPage } from './QuizPage'

vi.mock('./QuizVerse', () => ({ QuizVerse: ({ reference }: { reference: string }) => <blockquote>Texto completo fictício de {reference}</blockquote> }))

const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
const questions = [
  { id: ids[0], testament: 'novo', level: 1, prompt: 'Quem foi a mãe de Jesus?', options: ['Maria', 'Marta', 'Isabel', 'Ana'] },
  { id: ids[1], testament: 'novo', level: 1, prompt: 'Em qual cidade Jesus nasceu?', options: ['Nazaré', 'Belém', 'Jerusalém', 'Cafarnaum'] },
]
const answers: Record<string, { correct_index: number; reference: string }> = {
  [ids[0]]: { correct_index: 0, reference: 'Lucas 1:31' },
  [ids[1]]: { correct_index: 1, reference: 'Mateus 2:1' },
}
function boundary(list = questions, counted = true) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string, args: Record<string, unknown>) => ({ abortSignal: async () => {
    if (name === 'quiz_start') return { data: list, error: null }
    if (name === 'quiz_answer') { const a = answers[args.p_question_id as string]; return { data: { correct: args.p_selected === a.correct_index, correct_index: a.correct_index, reference: a.reference, counted }, error: null } }
    if (name === 'get_my_quiz_stats') return { data: { answered: 2, correct: 1, total_questions: 48 }, error: null }
    return { data: null, error: { code: '42501' } }
  } })) as never)
}

describe('Quiz bíblico', () => {
  it('oferece as três modalidades e inicia a escolhida', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    for (const name of ['Antigo Testamento', 'Novo Testamento', 'Bíblia toda']) expect(screen.getByRole('button', { name: new RegExp(name) })).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Novo Testamento/ }))
    expect(await screen.findByRole('heading', { name: 'Quem foi a mãe de Jesus?' })).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('quiz_start', { p_mode: 'novo', p_level: 1, p_count: 10 })
  })
  it('oferece os quatro níveis, do mais fácil ao mais difícil, e usa o escolhido', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    const names = screen.getAllByRole('radio').map(radio => radio.closest('label')!.querySelector('strong')!.textContent)
    expect(names).toEqual(['Iniciante', 'Intermediário', 'Avançado', 'Bigode grosso'])
    expect(screen.getByRole('radio', { name: /Iniciante/ })).toBeChecked()
    await user.click(screen.getByRole('radio', { name: /Bigode grosso/ }))
    await user.click(screen.getByRole('button', { name: /Antigo Testamento/ }))
    expect(supabase.rpc).toHaveBeenCalledWith('quiz_start', { p_mode: 'antigo', p_level: 4, p_count: 10 })
  })
  it('mostra na hora se acertou, a alternativa certa e a referência bíblica', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Bíblia toda/ }))
    await user.click(await screen.findByRole('button', { name: /Maria/ }))
    const feedback = await screen.findByRole('status')
    expect(feedback).toHaveTextContent('Você acertou!')
    expect(feedback).toHaveTextContent('Lucas 1:31')
    expect(feedback).toHaveTextContent('Texto completo fictício de Lucas 1:31')
    expect(screen.getByRole('button', { name: /Maria/ })).toHaveAttribute('data-state', 'correct')
    // depois de responder, as alternativas ficam travadas
    expect(screen.getByRole('button', { name: /Marta/ })).toBeDisabled()
  })
  it('em caso de erro, marca a escolhida e destaca a certa', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Antigo Testamento/ }))
    await user.click(await screen.findByRole('button', { name: /Marta/ }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi dessa vez.')
    expect(screen.getByRole('button', { name: /Marta/ })).toHaveAttribute('data-state', 'wrong')
    expect(screen.getByRole('button', { name: /Maria/ })).toHaveAttribute('data-state', 'correct')
  })
  it('percorre a rodada até o resultado e permite jogar de novo ou trocar de modalidade', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Novo Testamento/ }))
    await user.click(await screen.findByRole('button', { name: /Maria/ }))
    await user.click(await screen.findByRole('button', { name: 'Próxima pergunta →' }))
    await user.click(await screen.findByRole('button', { name: /Nazaré/ }))
    await user.click(await screen.findByRole('button', { name: 'Ver resultado' }))
    const result = await screen.findByRole('region', { name: 'Resultado do quiz' })
    expect(within(result).getByRole('heading')).toHaveTextContent('Você acertou 1 de 2')
    await waitFor(() => expect(result).toHaveTextContent('já acertou 1 de 2 perguntas respondidas'))
    await user.click(within(result).getByRole('button', { name: 'Trocar modalidade ou nível' }))
    expect(screen.getByRole('button', { name: /Bíblia toda/ })).toBeVisible()
  })
  it('avisa quando a pergunta já tinha sido respondida e não soma pontos de novo', async () => {
    boundary(questions, false)
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Novo Testamento/ }))
    await user.click(await screen.findByRole('button', { name: /Maria/ }))
    expect(await screen.findByText(/não soma pontos de novo/)).toBeVisible()
  })
  it('mostra erro de conexão ao carregar e permite tentar de novo, sem expor a resposta', async () => {
    vi.mocked(supabase.rpc).mockImplementation((() => ({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) })) as never)
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Bíblia toda/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o quiz')
    expect(screen.getByRole('button', { name: /Bíblia toda/ })).toBeVisible()
  })
  it('permite sair no meio da rodada com o X e voltar à escolha', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Novo Testamento/ }))
    await screen.findByRole('heading', { name: 'Quem foi a mãe de Jesus?' })
    await user.click(screen.getByRole('button', { name: 'Sair do quiz' }))
    expect(screen.queryByRole('heading', { name: 'Quem foi a mãe de Jesus?' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Bíblia toda/ })).toBeVisible()
  })
  it('informa quando a modalidade ainda não tem perguntas', async () => {
    boundary([])
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Antigo Testamento/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Ainda não há perguntas')
  })
  it('permite repetir a resposta se o registro falhar', async () => {
    boundary()
    const user = userEvent.setup()
    render(<QuizPage />)
    await user.click(screen.getByRole('button', { name: /Novo Testamento/ }))
    const start = vi.mocked(supabase.rpc).getMockImplementation()!
    await screen.findByRole('button', { name: /Maria/ })
    vi.mocked(supabase.rpc).mockImplementation(((name: string, args: unknown) => name === 'quiz_answer' ? ({ abortSignal: async () => ({ data: null, error: { message: 'offline' } }) }) : start(name, args as never, undefined as never)) as never)
    await user.click(screen.getByRole('button', { name: /Maria/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível registrar sua resposta')
    expect(screen.getByRole('button', { name: /Maria/ })).toBeEnabled()
  })
})
