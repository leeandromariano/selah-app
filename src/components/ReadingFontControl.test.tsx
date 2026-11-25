import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { ReadingFontControl } from './ReadingFontControl'

describe('tamanho da leitura', () => {
  beforeEach(() => { localStorage.clear() })
  it('ajusta a fonte e preserva a preferência entre leituras', () => {
    const view = render(<ReadingFontControl />)
    const control = screen.getByRole('slider', { name: 'Tamanho da fonte' })
    fireEvent.change(control, { target: { value: '24' } })
    expect(document.documentElement.style.getPropertyValue('--reading-font-size')).toBe('24px')
    view.unmount()
    render(<ReadingFontControl />)
    expect(screen.getByRole('slider', { name: 'Tamanho da fonte' })).toHaveValue('24')
  })
})
