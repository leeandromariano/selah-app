import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createStudyRepository } from './repository'
import type { StudyPanorama } from './repository'

const repository = createStudyRepository(supabase)

// Panorama publicado do livro, só quando pedido (modo Estudo, capítulo 1). Sem panorama ou com falha: nulo, e nada aparece.
export function useBookPanorama(book: string | undefined, enabled: boolean): StudyPanorama | null {
  const [loaded, setLoaded] = useState<{ book: string; panorama: StudyPanorama | null } | null>(null)
  useEffect(() => {
    if (!book || !enabled) return
    let active = true
    repository.panorama(book).then(panorama => { if (active) setLoaded({ book, panorama }) }).catch(() => { if (active) setLoaded({ book, panorama: null }) })
    return () => { active = false }
  }, [book, enabled])
  return enabled && loaded && loaded.book === book ? loaded.panorama : null
}
