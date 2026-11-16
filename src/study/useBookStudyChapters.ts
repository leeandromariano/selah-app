import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createStudyRepository } from './repository'

const repository = createStudyRepository(supabase)

// Capítulos do livro que têm Raio-X publicado. Qualquer falha deixa a lista vazia: o seletor continua igual, sem marcas.
export function useBookStudyChapters(book: string | undefined): Set<number> {
  const [loaded, setLoaded] = useState<{ book: string; chapters: Set<number> } | null>(null)
  useEffect(() => {
    if (!book) return
    let active = true
    repository.bookChapters(book).then(list => { if (active) setLoaded({ book, chapters: new Set(list) }) }).catch(() => { if (active) setLoaded({ book, chapters: new Set() }) })
    return () => { active = false }
  }, [book])
  return loaded && loaded.book === book ? loaded.chapters : new Set<number>()
}
