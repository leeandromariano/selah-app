import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'

function openPendingGoogle() {
  location.hash = 'historico'
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: {
    user: { id: 'google-fiction', app_metadata: { provider: 'google' }, user_metadata: {} },
  } }, error: null } as never)
  let complete = false
  const fallback = vi.mocked(supabase.rpc).getMockImplementation()!
  vi.mocked(supabase.rpc).mockImplementation((name, args) => {
    if (name === 'get_my_google_onboarding_status') return Promise.resolve({ data: complete ? 'complete' : 'pending', error: null }) as never
    if (name === 'complete_google_onboarding') { complete = true; return Promise.resolve({ data: null, error: null }) as never }
    return fallback(name, args)
  })
  return render(<App />)
}

describe('cadastro obrigatório após autenticação Google', () => {
  it('nega telas e dados antes de completar username e WhatsApp', async () => {
    openPendingGoogle()
    expect(await screen.findByRole('heading', { name: 'Falta só concluir seu perfil.' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Devocionais' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Seus próximos momentos de fé' })).not.toBeInTheDocument()
    expect(supabase.from).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Concluir cadastro' })).toBeEnabled()
  })

  it('conclui com confirmação do servidor sem consentimento automático e libera a sessão', async () => {
    openPendingGoogle()
    const user = userEvent.setup()
    await screen.findByRole('heading', { name: 'Falta só concluir seu perfil.' })
    await user.type(screen.getByRole('textbox', { name: 'Username' }), 'leitor_teste')
    await user.type(screen.getByRole('textbox', { name: 'Número com DDD' }), '11 99999-0000')
    await user.click(screen.getByRole('button', { name: 'Concluir cadastro' }))
    expect(supabase.rpc).toHaveBeenCalledWith('complete_google_onboarding', {
      p_username: 'leitor_teste',
      p_whatsapp: '+5511999990000',
      p_name: null,
      p_feedback_contact_allowed: false,
    })
    expect(await screen.findByRole('link', { name: 'Devocionais' })).toBeVisible()
    expect(location.hash).toBe('#inicio')
  })
})
