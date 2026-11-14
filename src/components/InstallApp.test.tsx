import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { InstallApp } from './InstallApp'
import { resetInstallState } from '../lib/installPrompt'

function installEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: ReturnType<typeof vi.fn>; userChoice: Promise<{ outcome: string }> }
  event.prompt = vi.fn().mockResolvedValue(undefined)
  event.userChoice = Promise.resolve({ outcome })
  return event
}

afterEach(() => { resetInstallState(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('instalar como aplicativo', () => {
  it('mostra o convite com o botão Instalar app', () => {
    render(<InstallApp />)
    expect(screen.getByRole('heading', { name: 'Instale o Coram no seu celular' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Instalar app' })).toBeVisible()
  })

  it('usa o convite nativo do navegador, impede o banner padrão e só o consome uma vez', async () => {
    const user = userEvent.setup()
    render(<InstallApp />)
    const event = installEvent()
    act(() => { window.dispatchEvent(event) })
    expect(event.defaultPrevented).toBe(true)
    await user.click(screen.getByRole('button', { name: 'Instalar app' }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
    // sem novo convite, o segundo toque passa a orientar a instalação manual
    await user.click(screen.getByRole('button', { name: 'Instalar app' }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status')).toHaveTextContent(/Instalar app|Adicionar à tela inicial/)
  })

  it('captura o convite disparado antes de a tela montar', async () => {
    const event = installEvent()
    act(() => { window.dispatchEvent(event) })
    render(<InstallApp />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Instalar app' }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('sem convite nativo, explica como instalar no Android/Chrome', async () => {
    render(<InstallApp />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Instalar app' }))
    expect(screen.getByRole('status')).toHaveTextContent('No menu do navegador')
  })

  it('no iPhone, explica o caminho pelo Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')
    render(<InstallApp />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Instalar app' }))
    expect(screen.getByRole('status')).toHaveTextContent('Adicionar à Tela de Início')
  })

  it('some depois de instalado', () => {
    render(<InstallApp />)
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument()
  })

  it('não aparece quando o app já roda instalado', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('standalone'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
    render(<InstallApp />)
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument()
  })
})
