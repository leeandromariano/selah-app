import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/** Abre o menu hambúrguer (se ainda fechado) e devolve a navegação principal. */
export async function openMenu() {
  const toggle = await screen.findByRole('button', { name: /^(Abrir|Fechar) menu$/ })
  if (toggle.getAttribute('aria-expanded') !== 'true') await userEvent.setup().click(toggle)
  return screen.getByRole('navigation', { name: 'Navegação principal' })
}
