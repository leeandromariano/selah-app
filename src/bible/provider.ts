import type { Location } from './catalog'
export type Verse = { number: number; text: string }
export type Translation = { id: string; name: string; abbreviation: string; language: string; license: string; attribution: string; available: boolean; licensedText: boolean; books: readonly string[] }
export interface BibleProvider {
  translations: readonly Translation[]
  chapter(location: Location): Promise<Verse[]>
  supportsReference?(location: Location): boolean
}

// Fictional UI fixtures, not scripture or a translation of a biblical text.
const demo: Record<string, Verse[]> = {
  'genesis:1': [{ number: 1, text: 'Texto fictício para demonstrar o primeiro versículo.' }, { number: 2, text: 'Texto fictício para demonstrar a leitura em sequência.' }],
  'joao:3': [{ number: 16, text: 'Texto fictício para demonstrar a navegação por versículo.' }, { number: 17, text: 'Texto fictício para demonstrar uma passagem.' }],
}
export const demoProvider: BibleProvider = {
  translations: [{ id: 'demonstracao', name: 'Conteúdo demonstrativo', abbreviation: 'Demo', language: 'pt-BR', license: 'Dados fictícios locais', attribution: 'Conteúdo fictício — não é texto bíblico.', available: true, licensedText: false, books: ['genesis', 'joao'] }],
  async chapter(location) { if (location.translation !== 'demonstracao') throw Error('Tradução indisponível'); return demo[`${location.book}:${location.chapter}`] ?? [] },
}
// Placeholder only: no endpoint, credential, external calls, or assertion of licensing.
export const nviAdapter: BibleProvider = {
  translations: [{ id: 'nvi', name: 'Nova Versão Internacional', abbreviation: 'NVI', language: 'pt-BR', license: 'Autorização pendente', attribution: '', available: false, licensedText: false, books: [] }],
  async chapter() { throw Error('Tradução indisponível') },
}
export const bibleProvider: BibleProvider = { translations: [...demoProvider.translations, ...nviAdapter.translations], chapter: location => location.translation === 'demonstracao' ? demoProvider.chapter(location) : nviAdapter.chapter(location) }
export function licensedReferenceLink(reference: string, provider: BibleProvider, parse: (value: string) => Omit<Location, 'translation'> | null) {
  const location = parse(reference)
  const translation = provider.translations.find(item => item.available && item.licensedText && location && item.books.includes(location.book))
  if (!translation || !location) return null
  const target = { ...location, translation: translation.id }
  // An adapter must explicitly validate availability and verse bounds.
  return provider.supportsReference?.(target) === true ? target : null
}
