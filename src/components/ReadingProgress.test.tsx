import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { ReadingProgress } from './ReadingProgress'
import type { ReadingState } from '../reading/repository'
const initial: ReadingState = { status: 'paused', devotional_id: 'fiction', revision: 1, credited_ms: 0, revision_changed: false }
let saved: ReadingState
function open(state = initial) {
  saved = { ...state }
  vi.mocked(supabase.rpc).mockImplementation((name: string) => ({ abortSignal: async () => {
    if (name === 'start_reading' && saved.credited_ms < 60000) return { data: { ...saved, status: 'active', token: 'nonce', sequence: 0 }, error: null }
    if (name === 'checkpoint_reading') return { data: saved, error: null }
    if (name === 'complete_devotional') saved = { ...saved, status: 'completed', completed_at: '2026-10-28T15:00:00Z', completed_day: '2026-10-28' }
    return { data: saved, error: null }
  } }) as never)
  const onCompleted = vi.fn()
  const component = render(<ReadingProgress devotionalId="fiction" revision={1} onCompleted={onCompleted} />)
  return { ...component, onCompleted }
}
async function flush() { await act(async () => { await Promise.resolve() }) }
beforeEach(() => {
  vi.useFakeTimers(); vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })
describe('experiência de conclusão voluntária', () => {
  it('mantém ação desabilitada em 59999 ms com indicação acessível', async () => {
    open({ ...initial, credited_ms: 59999 }); await flush()
    expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeDisabled()
    expect(screen.getByRole('progressbar', { name: 'Progresso de leitura' })).toHaveAttribute('value', '59999')
    expect(screen.getByRole('progressbar')).toHaveAttribute('max', '60000')
    expect(screen.queryByText(/Tempo confirmado:/)).not.toBeInTheDocument()
    expect(screen.queryByText(/não comprova compreensão/)).not.toBeInTheDocument()
  })
  it('60000 habilita a ação, aguarda escolha e mostra confirmação persistida', async () => {
    const { onCompleted } = open({ ...initial, credited_ms: 60000, status: 'ready' }); await flush()
    const button = screen.getByRole('button', { name: 'Concluir devocional' })
    expect(button).toBeEnabled()
    expect(screen.getByRole('progressbar',{name:'Progresso de leitura'})).toHaveAttribute('value','60000')
    expect(screen.queryByText('Tempo confirmado: 60 de 60 segundos mínimos')).not.toBeInTheDocument()
    expect(vi.mocked(supabase.rpc).mock.calls.some(([name]) => name === 'complete_devotional')).toBe(false)
    button.focus(); expect(button).toHaveFocus()
    fireEvent.click(button); await flush()
    expect(screen.getByRole('status')).toHaveTextContent('Devocional concluído')
    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Concluir devocional' })).not.toBeInTheDocument()
  })
  it('ocultar a aba pausa e voltar retoma sem contar tempo oculto', async () => {
    open(); await flush()
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    fireEvent(document, new Event('visibilitychange')); await flush()
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'checkpoint_reading')).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('Leitura pausada')
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    fireEvent(document, new Event('visibilitychange')); await flush()
    expect(vi.mocked(supabase.rpc).mock.calls.filter(([name]) => name === 'start_reading')).toHaveLength(2)
  })
  it('perda de foco e offline pausam sem bloquear o texto', async () => {
    open(); await flush()
    vi.spyOn(document, 'hasFocus').mockReturnValue(false)
    fireEvent(window, new Event('blur')); await flush()
    expect(screen.getByRole('status')).toHaveTextContent('Leitura pausada')
    expect(vi.mocked(supabase.rpc).mock.calls.some(([name]) => name === 'pause_reading')).toBe(true)
  })
  it('outra sessão requer decisão explícita para transferir leitura', async () => {
    open(); await flush()
    vi.mocked(supabase.rpc).mockImplementation((name: string) => ({ abortSignal: async () => ({ data: { ...initial, status: name === 'take_over_reading' ? 'active' : 'elsewhere', token: name === 'take_over_reading' ? 'new-token' : null, sequence: 0 }, error: null }) }) as never)
    fireEvent(window, new Event('blur')); await flush()
    vi.spyOn(document, 'hasFocus').mockReturnValue(false); fireEvent(window, new Event('blur')); await flush()
    vi.spyOn(document, 'hasFocus').mockReturnValue(true); fireEvent(window, new Event('focus')); await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Continuar leitura aqui' })); await flush()
    expect(vi.mocked(supabase.rpc).mock.calls.some(([name]) => name === 'take_over_reading')).toBe(true)
  })
  it('erro de autorização não mostra dados internos nem libera conclusão', async () => {
    open(); await flush()
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data: null, error: { code: '42501', message: 'other account secret' } }) } as never)
    await act(async () => { await vi.advanceTimersByTimeAsync(5000) })
    expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão não autoriza')
    expect(screen.getByRole('alert')).not.toHaveTextContent('other account')
    expect(screen.getByRole('button', { name: 'Concluir devocional' })).toBeDisabled()
  })
  it('releitura conserva conclusão existente sem novo cronômetro', async () => {
    open({ ...initial, status: 'completed', credited_ms: 60000, completed_at: '2026-10-28T15:00:00Z', completed_day: '2026-10-28' }); await flush()
    expect(screen.getByRole('status')).toHaveTextContent('Devocional concluído')
    await act(async () => { await vi.advanceTimersByTimeAsync(20000) })
    expect(vi.mocked(supabase.rpc).mock.calls.map(([name]) => name)).toEqual(['get_my_reading_state'])
  })
})
