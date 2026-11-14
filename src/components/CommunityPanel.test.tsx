import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { CommunityPanel } from './CommunityPanel'
import { createCommunityRepository } from '../consistency/community'
const reader = { username: 'leitor_ficticio', current_streak: 2, best_streak: 5, total_days: 7, status: 'pending_today' }
const snapshot = { server_today: '2026-10-28', time_zone: 'America/Sao_Paulo', total_readers: 30, completed_today: 3, matched_readers: 30, page: 0, size: 25, readers: [reader, { username: null, current_streak: 0, best_streak: 0, total_days: 0, status: 'empty' }] }
function respond() {
  vi.mocked(supabase.rpc).mockImplementation((_name, args) => ({ abortSignal: async () => ({ data: { ...snapshot, page: (args as { p_page: number }).p_page }, error: null }) }) as never)
}
describe('comunidade exclusiva do OWNER', () => {
  it('consulta RPC mínima, apresenta leitores zero, recorde e resumo', async () => {
    respond(); render(<CommunityPanel />)
    expect(await screen.findByRole('table')).toBeVisible()
    expect(screen.getByText('@leitor_ficticio')).toBeVisible()
    expect(screen.getByText('Sem conclusões · ofensiva zero')).toBeVisible()
    expect(screen.getByText('Pendente hoje')).toBeVisible()
    expect(supabase.rpc).toHaveBeenCalledWith('get_owner_community', { p_search: '', p_page: 0, p_size: 25 })
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument()
  })
  it('paginação e busca por teclado normalizam username e reiniciam página', async () => {
    respond(); const user = userEvent.setup(); render(<CommunityPanel />)
    await user.click(await screen.findByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText('Página 2 de 2 · 30 leitores encontrados')).toBeVisible()
    await user.type(screen.getByLabelText('Buscar por username'), '@LEITOR{Enter}')
    await waitFor(() => expect(supabase.rpc).toHaveBeenLastCalledWith('get_owner_community', { p_search: 'leitor', p_page: 0, p_size: 25 }))
    expect(await screen.findByRole('button', { name: 'Página anterior' })).toBeDisabled()
  })
  it('negações backend limpam ranking anterior e permitem nova tentativa sem diagnóstico privado', async () => {
    respond(); const user = userEvent.setup(); render(<CommunityPanel />)
    await screen.findByRole('table')
    vi.mocked(supabase.rpc).mockReturnValueOnce({ abortSignal: async () => ({ data: null, error: { code: '42501', message: 'private@example.invalid' } }) } as never)
    await user.click(screen.getByRole('button', { name: 'Atualizar ranking' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo')
    expect(screen.getByRole('alert')).not.toHaveTextContent('private@')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByRole('table')).toBeVisible()
  })
  it('distingue vazio de carregamento e falha', async () => {
    let finish!: (value: unknown) => void
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: () => new Promise(resolve => { finish = resolve }) } as never)
    render(<CommunityPanel />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(screen.queryByText('Nenhum leitor encontrado.')).not.toBeInTheDocument()
    await act(async () => { finish({ data: { ...snapshot, readers: [], matched_readers: 0 }, error: null }) })
    expect(screen.getByRole('status')).toHaveTextContent('Nenhum leitor encontrado')
  })
  it('descarta resposta antiga após nova busca e após desmontagem', async () => {
    let finish!: (value: unknown) => void
    respond()
    vi.mocked(supabase.rpc).mockReturnValueOnce({ abortSignal: () => new Promise(resolve => { finish = resolve }) } as never)
    const user = userEvent.setup(); const view = render(<CommunityPanel />)
    await user.type(screen.getByLabelText('Buscar por username'), 'novo{Enter}')
    await screen.findByRole('table')
    await act(async () => { finish({ data: { ...snapshot, readers: [{ ...reader, username: 'antigo' }] }, error: null }) })
    expect(screen.queryByText('@antigo')).not.toBeInTheDocument()
    view.unmount()
  })
  it('recusa parâmetros inválidos sem chamada e remove campos inesperados da resposta', async () => {
    respond(); const repo = createCommunityRepository(supabase)
    await expect(repo.list('%')).rejects.toThrow()
    await expect(repo.list('', -1)).rejects.toThrow()
    expect(supabase.rpc).not.toHaveBeenCalled()
    vi.mocked(supabase.rpc).mockReturnValueOnce({ abortSignal: async () => ({ data: { ...snapshot, email: 'private@example.invalid', readers: [{ ...reader, phone: 'private' }] }, error: null }) } as never)
    const result = await repo.list()
    expect(result).not.toHaveProperty('email')
    expect(result.readers[0]).not.toHaveProperty('phone')
    vi.mocked(supabase.rpc).mockReturnValueOnce({ abortSignal: async () => ({ data: { ...snapshot, readers: [{ ...reader, current_streak: 99 }] }, error: null }) } as never)
    await expect(repo.list()).rejects.toThrow('Invalid community response')
  })
})
