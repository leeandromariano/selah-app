import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LegacyDevotionalPassage } from './LegacyDevotionalPassage'

vi.mock('../bible/editorialFeature', () => ({ bibleEditorialEnabled: true }))

describe('passagem legada', () => {
  it('abre referência reconhecida na NVT, indicando a tradução escolhida', () => {
    render(<LegacyDevotionalPassage reference="João 3:16" text="Texto fictício" />)
    const link = screen.getByRole('link', { name: 'Abrir na Bíblia (NVT)' })
    expect(link).toHaveAttribute('href', '#biblia/nvt/joao/3/16')
    fireEvent.doubleClick(screen.getByText('Texto fictício'))
    expect(location.hash).toBe('#biblia/nvt/joao/3/16')
  })
  it('preserva texto e não inventa referência quando não é reconhecida', () => {
    render(<LegacyDevotionalPassage reference="Referência desconhecida" text="Texto fictício" />)
    expect(screen.getByText('Texto fictício')).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
