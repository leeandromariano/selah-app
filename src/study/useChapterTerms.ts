import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createStudyRepository } from './repository'
import type { StudyTerm } from './repository'

const repository = createStudyRepository(supabase)

// Termos publicados que valem neste capítulo. Qualquer falha deixa a lista vazia: o Raio-X é um extra, nunca o texto.
// enabled=false (modo "Apenas leitura") não consulta nada e devolve lista vazia.
export function useChapterTerms(book: string | undefined, chapter: number | undefined, enabled = true): StudyTerm[] {
  const key = enabled && book && chapter ? `${book}:${chapter}` : ''
  const [loaded, setLoaded] = useState<{ key: string; terms: StudyTerm[] } | null>(null)
  useEffect(() => {
    if (!key || !book || !chapter) return
    let active = true
    repository.chapter(book, chapter).then(terms => { if (active) setLoaded({ key, terms }) }).catch(() => { if (active) setLoaded({ key, terms: [] }) })
    return () => { active = false }
  }, [book, chapter, key])
  return key && loaded?.key === key ? loaded.terms : []
}
