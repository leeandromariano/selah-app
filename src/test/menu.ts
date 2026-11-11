import { expect } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'

// O app remonta ao confirmar a sessão (a chave do conteúdo muda), o que fecha a gaveta:
// por isso os helpers reabrem o menu enquanto ele não estiver aberto, em vez de clicar uma única vez.
const panelOpen = () => screen.queryByRole('button', { name: 'Voltar' }) !== null
const openOnce = () => { if (!panelOpen()) fireEvent.click(screen.getByRole('button', { name: 'Abrir menu' })) }

/** Abre a gaveta do menu, sem exigir sessão. */
export async function openMenuPanel() {
  await waitFor(() => { openOnce(); expect(panelOpen()).toBe(true) })
}

/** Abre a gaveta e espera a navegação principal, que só existe com sessão confirmada. */
export async function openMenu() {
  await waitFor(() => { openOnce(); expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument() })
  return screen.getByRole('navigation', { name: 'Navegação principal' })
}
