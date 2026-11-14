export type VerseBlank = { index: number; length: number; prev: string }

// Mesma normalização do servidor: sem acentos, sem pontuação, minúsculas.
export function normalizeWord(value: string) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}
export function tokenize(text: string) { return text.trim().split(/\s+/).filter(Boolean) }
export function splitToken(token: string) {
  const match = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/su.exec(token)
  return { before: match?.[1] ?? '', core: match?.[2] ?? token, after: match?.[3] ?? '' }
}

// Localiza cada palavra escondida no texto da Bíblia: pela posição indicada, conferindo o tamanho da palavra e a anterior.
// Se o texto estiver ligeiramente diferente, procura a posição mais próxima que bata. Sem correspondência, devolve null.
export function locateBlanks(tokens: string[], blanks: VerseBlank[]): number[] | null {
  const fits = (position: number, blank: VerseBlank) => position >= 0 && position < tokens.length
    && normalizeWord(tokens[position]).length === blank.length
    && (blank.prev === '' ? position === 0 : position > 0 && normalizeWord(tokens[position - 1]) === blank.prev)
  const found: number[] = []
  for (const blank of blanks) {
    let best = -1
    if (fits(blank.index - 1, blank)) best = blank.index - 1
    else for (let position = 0; position < tokens.length; position++) {
      if (fits(position, blank) && (best < 0 || Math.abs(position - (blank.index - 1)) < Math.abs(best - (blank.index - 1)))) best = position
    }
    if (best < 0 || found.includes(best)) return null
    found.push(best)
  }
  return found
}

// Grade sem spoiler: só quadrados (laranja = palavra certa, preto = errada).
export function shareText(number: number, rows: boolean[][], solved: boolean, maxAttempts: number, url: string) {
  const grid = rows.map(row => row.map(ok => ok ? '🟧' : '⬛').join('')).join('\n')
  return `Versículo Oculto #${number} ${solved ? rows.length : 'X'}/${maxAttempts}\n\n${grid}\n\n${url}`
}
