import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { QuizRankingPanel } from './QuizRankingPanel'

const players = [
  { username: 'ana_fiel', answered: 20, correct: 18, accuracy: 90, antigo_correct: 9, novo_correct: 9, last_answered_at: '2026-11-11T10:00:00Z' },
  { username: null, answered: 5, correct: 2, accuracy: 40, antigo_correct: 1, novo_correct: 1, last_answered_at: '2026-11-10T10:00:00Z' },
]
function boundary(result: { data: unknown; error: unknown }) {
  vi.mocked(supabase.rpc).mockImplementation(((name: string) => ({ abortSignal: async () => name === 'get_owner_quiz_ranking' ? result : { data: null, error: { code: '42501' } } })) as never)
}
const ok = (matched = 2) => ({ data: { total_players: 2, matched_players: matched, total_questions: 48, page: 0, size: 25, players }, error: null })

describe('Ranking do quiz (owner)', () => {
  it('lista participantes por acertos, com posição e aproveitamento', async () => {
    boundary(ok())
    render(<QuizRankingPanel />)
    const table = await screen.findByRole('table')
    expect(table).toHaveTextContent('1º')
    expect(table).toHaveTextContent('@ana_fiel')
    expect(table).toHaveTextContent('90%')
    expect(table).toHaveTextContent('Conta legada sem username')
    expect(screen.getByText('Participantes').closest('.stat')).toHaveTextContent('2')
  })
  it('busca por username normalizado', async () => {
    boundary(ok(1))
    const user = userEvent.setup()
    render(<QuizRankingPanel />)
    await screen.findByRole('table')
    await user.type(screen.getByLabelText('Buscar por username'), '@Ana')
    await user.click(screen.getByRole('button', { name: 'Buscar participantes' }))
    await screen.findByText(/1 participantes encontrados/)
    expect(supabase.rpc).toHaveBeenCalledWith('get_owner_quiz_ranking', { p_search: 'ana', p_page: 0, p_size: 25 })
  })
  it('mostra estado vazio', async () => {
    boundary({ data: { total_players: 0, matched_players: 0, total_questions: 48, page: 0, size: 25, players: [] }, error: null })
    render(<QuizRankingPanel />)
    expect(await screen.findByText('Nenhum participante encontrado.')).toBeVisible()
  })
  it('mostra erro de acesso e permite repetir a consulta', async () => {
    boundary({ data: null, error: { code: '42501' } })
    const user = userEvent.setup()
    render(<QuizRankingPanel />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo do proprietário')
    boundary(ok())
    await user.click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByRole('table')).toBeVisible()
  })
})
