import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createStudyRepository } from './repository'
import type { StudyTerm } from './repository'

const repository = createStudyRepository(supabase)

// Termos publicados que valem neste capítulo. Qualquer falha deixa a lista vazia: o Raio-X é um extra, nunca o texto.
export function useChapterTerms(book: string | undefined, chapter: number | undefined): StudyTerm[] {
  const key = book && chapter ? `${book}:${chapter}` : ''
  const [loaded, setLoaded] = useState<{ key: string; terms: StudyTerm[] } | null>(null)
  useEffect(() => {
    if (!book || !chapter) return
    let active = true
    repository.chapter(book, chapter).then(terms => { if (active) setLoaded({ key, terms }) }).catch(() => { if (active) setLoaded({ key, terms: [] }) })
    return () => { active = false }
  }, [book, chapter, key])
  return loaded?.key === key ? loaded.terms : []
}
