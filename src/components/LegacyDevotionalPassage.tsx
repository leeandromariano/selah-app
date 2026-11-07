import { bibleHash, parseReference } from '../bible/catalog'
import { bibleEditorialEnabled } from '../bible/editorialFeature'

export function LegacyDevotionalPassage({ reference, text }: { reference: string; text: string | null }) {
  const parsed = bibleEditorialEnabled ? parseReference(reference) : null
  const href = parsed ? bibleHash({ ...parsed, translation: 'nvt' }) : null
  return <blockquote onDoubleClick={href ? () => { location.hash = href } : undefined}>
    <span>“</span>{text}<cite>{reference}</cite>
    {href && <a className="text-link" href={href}>Abrir na Bíblia (NVT)</a>}
  </blockquote>
}
