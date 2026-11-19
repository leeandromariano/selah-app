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
    expect(screen.getByRole('link', { name: /Linha do Tempo/ })).toHaveAttribute('href', '#bereia/linha-do-tempo')
  })
  it('destaca o CORAM // LOGOS no topo, antes dos outros jogos (aberto para o OWNER)', () => {
    render(<BereiaHub logosOpen />)
    const hero = screen.getByRole('link', { name: /CORAM \/\/ LOGOS/ })
    expect(hero).toHaveAttribute('href', '#bereia/logos')
    expect(hero.compareDocumentPosition(screen.getByRole('link', { name: /Quiz bíblico/ })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('para quem não é OWNER o CORAM // LOGOS aparece como em breve, sem link para o jogo', () => {
    render(<BereiaHub />)
    expect(screen.queryByRole('link', { name: /LOGOS/ })).toBeNull()
    expect(screen.getByRole('group', { name: /LOGOS, em breve/ })).toHaveTextContent('Em breve')
    expect(document.querySelector('a[href="#bereia/logos"]')).toBeNull()
  })
})
