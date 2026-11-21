import type { Verse } from './provider'

export type ApiChapter = { verses: Verse[]; copyright: string; fumsToken: string }
type Node = { type?: unknown; name?: unknown; text?: unknown; attrs?: { number?: unknown }; items?: unknown }

// Fail closed on unexpected structures: never silently invent or discard a verse.
export function parseApiChapter(payload: unknown): ApiChapter {
  if (!payload || typeof payload !== 'object') throw Error('Resposta bíblica inválida')
  const { data, meta } = payload as { data?: { content?: unknown; copyright?: unknown }; meta?: { fumsToken?: unknown } }
  if (!Array.isArray(data?.content) || typeof data.copyright !== 'string' || !data.copyright.trim() || typeof meta?.fumsToken !== 'string' || !meta.fumsToken.trim()) throw Error('Resposta bíblica incompleta')
  const verses: Verse[] = []
  let current: Verse | undefined
  const walk = (nodes: unknown[]): void => {
    for (const item of nodes) {
      if (!item || typeof item !== 'object') throw Error('Conteúdo bíblico inválido')
      const node = item as Node
      if (node.type === 'text' && typeof node.text === 'string') {
        if (!current && node.text.trim()) throw Error('Texto sem versículo')
        if (current) current.text += node.text
      } else if (node.type === 'tag' && node.name === 'verse') {
        const number = String(node.attrs?.number ?? '')
        const range = /^([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?$/.exec(number)
        if (!range) throw Error('Numeração bíblica inválida')
        const start = Number(range[1]), end = range[2] ? Number(range[2]) : start
        if (end < start || (current && start <= (current.endNumber ?? current.number))) throw Error('Numeração bíblica inválida')
        if (node.items !== undefined && (!Array.isArray(node.items) || node.items.some((entry: Node) => !entry || entry.type !== 'text' || entry.text !== number))) throw Error('Marcador bíblico não suportado')
        current = { number: start, ...(end !== start ? { endNumber: end } : {}), text: '' }
        verses.push(current)
      } else if (node.type === 'tag' && Array.isArray(node.items)) {
        walk(node.items)
      } else {
        throw Error('Estrutura bíblica não suportada')
      }
    }
  }
  walk(data.content)
  if (!verses.length || verses.some(verse => !verse.text.trim())) throw Error('Capítulo incompleto')
  return { verses, copyright: data.copyright, fumsToken: meta.fumsToken }
}
