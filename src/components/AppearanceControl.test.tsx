import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { AppearanceControl } from './AppearanceControl'
import { consistencyFixture } from '../test/consistencyBoundary'
import { openMenuPanel } from '../test/menu'

const pressed = (name: string) => screen.getByRole('button', { name, pressed: true })

describe('seletor de aparência acessível', () => {
  it('oferece Claro/Escuro/Sistema só com ícones e pode ser usado por teclado sem sessão', async () => {
    const user = userEvent.setup()
    render(<AppearanceControl />)
    const group = screen.getByRole('group', { name: 'Aparência' })
    expect(group).toBeVisible()
    expect(group).not.toHaveTextContent(/\S/)
    expect(screen.getAllByRole('button').map(button => button.getAttribute('aria-label'))).toEqual(['Claro', 'Escuro', 'Sistema'])
    expect(pressed('Escuro')).toBeVisible()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Claro' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(document.documentElement).toHaveAttribute('data-theme', 'light')
    expect(pressed('Claro')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Escuro' }))
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark')
    expect(pressed('Escuro')).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('troca aparência preserva mês, rota e preferência ao renovar sessão, sair e entrar', async () => {
    const session = { user: { id: 'appearance-fiction' } }
    vi.mocked(supabase.rpc).mockImplementation((name, args) => name === 'get_my_consistency' ? { abortSignal: async () => ({ data: consistencyFixture({ month: (args as { p_month: string | null }).p_month ?? '2026-10-01', first_month: '2026-09-01' }), error: null }) } as never : Promise.resolve({ data: null, error: { code: '42501' } }) as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as never)
    location.hash = 'minha-jornada'
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('table')
    await user.click(screen.getByRole('button', { name: 'Mês anterior' }))
    await screen.findByRole('table', { name: 'setembro de 2026' })
    await openMenuPanel()
    await user.click(screen.getByRole('button', { name: 'Escuro' }))
    const before = vi.mocked(supabase.rpc).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Claro' }))
    expect(supabase.rpc).toHaveBeenCalledTimes(before)
    expect(location.hash).toBe('#minha-jornada')
    expect(screen.getByRole('table', { name: 'setembro de 2026' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Escuro' }))
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('TOKEN_REFRESHED', session as never) })
    expect(pressed('Escuro')).toBeVisible()
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT', null) })
    await openMenuPanel()
    expect(pressed('Escuro')).toBeVisible()
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_IN', { user: { id: 'other-fiction' } } as never) })
    await openMenuPanel()
    expect(pressed('Escuro')).toBeVisible()
    expect(localStorage.getItem('selah.appearance.v1')).toBe('dark')
  })
  it('informa seleção somente nesta aba quando escrita falha', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('blocked') })
    try {
      render(<AppearanceControl />)
      await userEvent.setup().click(screen.getByRole('button', { name: 'Escuro' }))
      expect(screen.getByRole('status')).toHaveTextContent('Sua escolha vale nesta aba')
      expect(screen.getByRole('group', { name: 'Aparência' })).toHaveAccessibleDescription(/não permitiu salvá-la/)
      expect(document.documentElement.dataset.theme).toBe('dark')
    } finally { spy.mockRestore() }
  })
})
