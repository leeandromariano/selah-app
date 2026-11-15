import { useEffect, useState } from 'react'

// Páginas principais. O topo (computador) e a barra inferior (celular) usam a mesma lista.
export const mainPages = [
  { id: 'inicio', name: 'Início', icon: 'home' },
  { id: 'historico', name: 'Devocionais', icon: 'book' },
  { id: 'biblia', name: 'Bíblia', icon: 'book' },
  { id: 'bereia', name: 'Bereia', icon: 'quiz' },
  { id: 'minha-jornada', name: 'Minha Jornada', icon: 'chart' },
] as const

const mobileQuery = '(max-width: 900px)'
// Sem matchMedia (testes) nenhuma das barras é desenhada; no navegador só a do tamanho atual existe no DOM.
// matchMedia ausente ou incompleto (sem a propriedade media, como nos testes) conta como indisponível.
function supported() {
  if (typeof window.matchMedia !== 'function') return null
  const list = window.matchMedia(mobileQuery)
  return typeof list?.media === 'string' ? list : null
}
export function useViewport(): 'mobile' | 'desktop' | null {
  const read = (): 'mobile' | 'desktop' | null => { const list = supported(); return list ? (list.matches ? 'mobile' : 'desktop') : null }
  const [viewport, setViewport] = useState(read)
  useEffect(() => {
    const list = supported()
    if (!list) return
    const change = () => setViewport(list.matches ? 'mobile' : 'desktop')
    list.addEventListener?.('change', change)
    return () => list.removeEventListener?.('change', change)
  }, [])
  return viewport
}

export function isCurrent(page: string, id: string) {
  return page === id || (id === 'historico' && page.startsWith('leitura')) || (id === 'biblia' && page.startsWith('biblia/')) || (id === 'bereia' && page.startsWith('bereia/'))
}

