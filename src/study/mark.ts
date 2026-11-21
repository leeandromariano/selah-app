import type { StudyTerm } from './repository'

// Termos que valem neste versículo (ou faixa de versículos).
export function termsForVerse(terms: StudyTerm[], number: number, endNumber?: number) {
  const end = endNumber ?? number
  return terms.filter(term => term.verses.some(range => range.start <= end && range.end >= number))
}

export type Piece = { text: string; term?: StudyTerm }
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Divide o texto do versículo marcando a primeira ocorrência de cada termo. Palavra inteira, sem diferenciar maiúsculas.
export function splitByTerms(textValue: string, terms: StudyTerm[]): Piece[] {
  if (!terms.length) return [{ text: textValue }]
  const owner = new Map<string, StudyTerm>()
  for (const term of terms) for (const word of term.words) owner.set(word.toLocaleLowerCase('pt-BR'), term)
  const words = [...owner.keys()].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${words.map(escape).join('|')})(?![\\p{L}\\p{N}])`, 'giu')
  const pieces: Piece[] = []
  const used = new Set<string>()
  let last = 0
  for (const match of textValue.matchAll(pattern)) {
    const term = owner.get(match[0].toLocaleLowerCase('pt-BR'))
    if (!term || used.has(term.id)) continue
    used.add(term.id)
    if (match.index! > last) pieces.push({ text: textValue.slice(last, match.index) })
    pieces.push({ text: match[0], term })
    last = match.index! + match[0].length
  }
  if (last < textValue.length) pieces.push({ text: textValue.slice(last) })
  return pieces.length ? pieces : [{ text: textValue }]
}
