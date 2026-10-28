import { bibleHash, parseReference } from '../bible/catalog'
import { bibleProvider, licensedReferenceLink } from '../bible/provider'
import type { BibleProvider } from '../bible/provider'

export function BibleReference({ reference, source = bibleProvider }: { reference: string; source?: BibleProvider }) {
  const target = licensedReferenceLink(reference, source, parseReference)
  return target ? <a className="text-link" href={bibleHash(target)}>{reference}</a> : <>{reference}</>
}
