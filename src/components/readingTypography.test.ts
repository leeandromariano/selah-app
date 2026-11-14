import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
const bibleCss = read('./bible.css'), coramCss = read('../coram.css'), indexHtml = read('../../index.html')

describe('tipografia de leitura', () => {
  it('o ajuste de tamanho da fonte vale só para a Bíblia: o texto do devocional não usa a variável', () => {
    const rule = bibleCss.split('\n').find(line => line.includes('--reading-font-size'))!
    expect(rule).toContain('.bible-chapter .bible-verse')
    expect(rule).not.toMatch(/\.reading|blockquote/)
    expect(coramCss).not.toMatch(/devotional-chapter-verses p \{[^}]*--reading-font-size/)
  })
  it('o texto corrido do devocional usa uma fonte de leitura em tamanho fixo e confortável, não a de interface nem a de display', () => {
    const block = coramCss.slice(coramCss.indexOf('Leitura do devocional'))
    expect(block).toContain("--font-reading: 'Literata'")
    expect(block).toMatch(/--reading-text: 18px/)
    expect(block).toMatch(/\.guided-panel > p[\s\S]*font-family: var\(--font-reading\); font-size: var\(--reading-text\); line-height: 1\.75/)
    expect(block).not.toContain('Instrument Serif')
  })
  it('a fonte de leitura é carregada pela página', () => {
    expect(indexHtml).toMatch(/family=Literata:ital,wght@/)
  })
})
