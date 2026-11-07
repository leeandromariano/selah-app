import { describe, expect, it } from 'vitest'
import { displayAttribution } from './attribution'

describe('aviso de direitos autorais', () => {
  it('retira a chamada promocional conhecida e mantém os direitos da ARA', () => {
    expect(displayAttribution('A Sociedade Bíblica do Brasil tem a missão de semear a Palavra que transforma vidas, tornando-a relevante para as pessoas. Junte-se a nós! ARA © 1993 Sociedade Bíblica do Brasil.')).toBe('ARA © 1993 Sociedade Bíblica do Brasil.')
  })
  it('preserva integralmente outras atribuições', () => {
    expect(displayAttribution('Tradução fictícia © editora fictícia')).toBe('Tradução fictícia © editora fictícia')
  })
})
