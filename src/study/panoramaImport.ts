import { books } from '../bible/catalog'
import type { OwnerStudyPanorama } from './repository'

// Limites iguais aos do banco.
export const PANORAMA_LIMITS = { author: 200, audience: 200, context: 300, theme: 200 } as const
export type PanoramaEntry = { book?: unknown; author?: unknown; audience?: unknown; context?: unknown; theme?: unknown }
export type PanoramaRow = { label: string; input: OwnerStudyPanorama | null; problems: string[] }

const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const plain = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').trim()
// Aceita o nome do livro como aparece no app (com ou sem acento, em qualquer caixa) ou o identificador (joao, 1-corintios).
export function resolveBook(value: string): string | null {
  const key = plain(value)
  return books.find(book => book.id === key || plain(book.name) === key)?.id ?? null
}

const fieldNames: Record<keyof typeof PANORAMA_LIMITS, string> = { author: 'autor', audience: 'para quem foi escrito', context: 'contexto', theme: 'tema central' }

function check(entry: PanoramaEntry, index: number): PanoramaRow {
  const name = clean(entry.book), id = resolveBook(name)
  const problems: string[] = []
  if (!id) problems.push(name ? `livro desconhecido: "${name}"` : 'sem o nome do livro')
  const values = { author: clean(entry.author), audience: clean(entry.audience), context: clean(entry.context), theme: clean(entry.theme) }
  for (const field of Object.keys(PANORAMA_LIMITS) as (keyof typeof PANORAMA_LIMITS)[]) {
    if (!values[field]) problems.push(`${fieldNames[field]} vazio`)
    else if (values[field].length > PANORAMA_LIMITS[field]) problems.push(`${fieldNames[field]} com até ${PANORAMA_LIMITS[field]} caracteres`)
  }
  const label = (id && books.find(book => book.id === id)?.name) || name || `Item ${index + 1}`
  return { label, problems, input: problems.length || !id ? null : { book: id, ...values, status: 'draft' } }
}

// Lê o texto colado ou o arquivo enviado e valida livro a livro, sem enviar nada. Tudo entra como rascunho.
export function parsePanoramaImport(raw: string): { rows: PanoramaRow[]; error?: string } {
  let data: unknown
  try { data = JSON.parse(raw) } catch { return { rows: [], error: 'O arquivo não é um JSON válido.' } }
  const entries = Array.isArray(data) ? data : (data && typeof data === 'object' && Array.isArray((data as { panoramas?: unknown }).panoramas) ? (data as { panoramas: unknown[] }).panoramas : null)
  if (!entries) return { rows: [], error: 'Esperava uma lista de panoramas.' }
  if (!entries.length) return { rows: [], error: 'A lista está vazia.' }
  if (entries.length > 66) return { rows: [], error: 'No máximo 66 panoramas (um por livro).' }
  const rows = entries.map((entry, index) => entry && typeof entry === 'object' ? check(entry as PanoramaEntry, index) : { label: `Item ${index + 1}`, input: null, problems: ['não é um panorama'] })
  const seen = new Set<string>()
  for (const row of rows) {
    if (!row.input) continue
    if (seen.has(row.input.book)) { row.problems.push('livro repetido no arquivo'); row.input = null } else seen.add(row.input.book)
  }
  return { rows }
}
