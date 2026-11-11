import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ShareCompletionDialog } from './ShareCompletionDialog'

const props = { id: '11111111-1111-4111-8111-111111111111', title: 'Título fictício', phrase: 'Frase fictícia', reference: 'João 3:16' }

describe('pop-up de compartilhar ao concluir', () => {
  it('é um diálogo modal com opções de compartilhar e foco no botão de fechar', () => {
    render(<ShareCompletionDialog {...props} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: 'Que a Palavra continue com você' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Compartilhar link pelo WhatsApp' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Agora não' })).toHaveFocus()
  })
  it('fecha com "Agora não", Esc e clique fora, mas não ao clicar dentro', () => {
    const onClose = vi.fn()
    const { container } = render(<ShareCompletionDialog {...props} onClose={onClose} />)
    fireEvent.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Agora não' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(container.querySelector('.share-dialog-backdrop')!)
    expect(onClose).toHaveBeenCalledTimes(3)
  })
})
