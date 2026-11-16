import { parseReference } from '../bible/catalog'
import type { StudyTermInput } from './repository'

// Converte linhas "Efésios 2:8" ou "Efésios 2:8-9" em versículos; devolve a primeira linha inválida, se houver.
export function parseVerses(lines: string[]): { verses: StudyTermInput['verses']; invalid?: string } {
  const verses: StudyTermInput['verses'] = []
  for (const line of lines.map(item => item.trim()).filter(Boolean)) {
    const parsed = parseReference(line)
    if (!parsed || !parsed.verse) return { verses, invalid: line }
    verses.push({ book: parsed.book, chapter: parsed.chapter, start: parsed.verse, end: parsed.endVerse ?? parsed.verse })
  }
  return { verses }
}

// Um termo no arquivo de importação (JSON). A situação não vem do arquivo: tudo entra como rascunho e é publicado depois, em lote.
export type ImportEntry = { term?: unknown; words?: unknown; original?: unknown; context?: unknown; parallel_reference?: unknown; verses?: unknown; dictionary?: unknown }
export type ImportRow = { label: string; input: StudyTermInput | null; problems: string[] }

export const DICTIONARY_MAX = 1500
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const list = (value: unknown, separator: RegExp) => Array.isArray(value) ? value.map(clean).filter(Boolean) : clean(value).split(separator).map(item => item.trim()).filter(Boolean)

function check(entry: ImportEntry, index: number): ImportRow {
  const term = clean(entry.term), original = clean(entry.original), context = clean(entry.context), parallel = clean(entry.parallel_reference)
  const words = [...new Set(list(entry.words, /,/))]
  const verseLines = list(entry.verses, /[;\n]/)
  const problems: string[] = []
  if (term.length < 2 || term.length > 60) problems.push('termo com 2 a 60 caracteres')
  if (!words.length || words.length > 10 || words.some(word => word.length > 40)) problems.push('de 1 a 10 palavras, até 40 caracteres cada')
  if (!original || original.length > 300) problems.push('"original" com até 300 caracteres')
  if (!context || context.length > 500) problems.push('"contexto" com até 500 caracteres')
  if (parallel.length < 3 || parallel.length > 80) problems.push('versículo paralelo com 3 a 80 caracteres')
  const { verses, invalid } = parseVerses(verseLines)
  if (invalid) problems.push(`versículo inválido: "${invalid}"`)
  else if (!verses.length) problems.push('ao menos um versículo')
  else if (verses.length > 60) problems.push('no máximo 60 versículos')
  const dictionary = clean(entry.dictionary)
  if (dictionary.length > DICTIONARY_MAX) problems.push(`dicionário com até ${DICTIONARY_MAX} caracteres`)
  const label = term || `Item ${index + 1}`
  return { label, problems, input: problems.length ? null : { id: null, term, words, original, context, parallel_reference: parallel, status: 'draft', verses, ...(dictionary ? { dictionary } : {}) } }
}

// Lê o texto colado ou o arquivo enviado e valida termo a termo, sem enviar nada ao servidor.
export function parseImport(raw: string): { rows: ImportRow[]; error?: string } {
  let data: unknown
  try { data = JSON.parse(raw) } catch { return { rows: [], error: 'O arquivo não é um JSON válido.' } }
  const entries = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as { terms?: unknown }).terms) ? (data as { terms: unknown[] }).terms : null)
  if (!entries) return { rows: [], error: 'Esperava uma lista de termos.' }
  if (!entries.length) return { rows: [], error: 'A lista está vazia.' }
  if (entries.length > 300) return { rows: [], error: 'No máximo 300 termos por importação.' }
  const rows = entries.map((entry, index) => entry && typeof entry === 'object' ? check(entry as ImportEntry, index) : { label: `Item ${index + 1}`, input: null, problems: ['não é um termo'] })
  // dois termos com o mesmo nome no próprio arquivo: o segundo é recusado
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row.input) continue
    const key = row.input.term.toLocaleLowerCase('pt-BR')
    if (seen.has(key)) { row.problems.push('nome repetido no arquivo'); row.input = null } else seen.add(key)
  }
  return { rows }
}

// Importação só do Dicionário de teologia: [{ term, dictionary }], ligada ao termo já cadastrado pelo nome.
export type DictionaryRow = { label: string; entry: { term: string; dictionary: string } | null; problems: string[] }
export function parseDictionaryImport(raw: string): { rows: DictionaryRow[]; error?: string } {
  let data: unknown
  try { data = JSON.parse(raw) } catch { return { rows: [], error: 'O arquivo não é um JSON válido.' } }
  const entries = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as { entries?: unknown }).entries) ? (data as { entries: unknown[] }).entries : null)
  if (!entries) return { rows: [], error: 'Esperava uma lista de verbetes.' }
  if (!entries.length) return { rows: [], error: 'A lista está vazia.' }
  if (entries.length > 300) return { rows: [], error: 'No máximo 300 verbetes por importação.' }
  const seen = new Set<string>()
  const rows = entries.map((item, index): DictionaryRow => {
    const value = item && typeof item === 'object' ? item as { term?: unknown; dictionary?: unknown } : {}
    const term = clean(value.term), dictionary = clean(value.dictionary)
    const problems: string[] = []
    if (!item || typeof item !== 'object') problems.push('não é um verbete')
    else {
      if (!term) problems.push('sem o nome do termo')
      if (!dictionary) problems.push('verbete vazio')
      else if (dictionary.length > DICTIONARY_MAX) problems.push(`verbete com até ${DICTIONARY_MAX} caracteres`)
      const key = term.toLocaleLowerCase('pt-BR')
      if (term && seen.has(key)) problems.push('nome repetido no arquivo'); else if (term) seen.add(key)
    }
    return { label: term || `Item ${index + 1}`, problems, entry: problems.length ? null : { term, dictionary } }
  })
  return { rows }
}
