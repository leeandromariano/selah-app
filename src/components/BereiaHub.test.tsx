import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BereiaHub } from './BereiaHub'

describe('Bereia', () => {
  it('apresenta a aba, cita Atos 17:11 e leva aos dois jogos', () => {
    render(<BereiaHub />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bereia')
    expect(screen.getByText(/Inspirado em/)).toHaveTextContent('Atos 17:11')
    expect(screen.getByRole('link', { name: /Quiz bíblico/ })).toHaveAttribute('href', '#bereia/quiz')
    expect(screen.getByRole('link', { name: /Tá na Bíblia ou Tá Amarrado\?/ })).toHaveAttribute('href', '#bereia/mito')
    expect(screen.getByRole('link', { name: /Quem disse isso\?/ })).toHaveAttribute('href', '#bereia/quem-disse')
    expect(screen.getByRole('link', { name: /Versículo Oculto/ })).toHaveAttribute('href', '#bereia/versiculo')
  })
})
