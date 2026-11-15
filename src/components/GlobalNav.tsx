import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createConsistencyRepository } from '../consistency/repository'
import { Icon } from './UI'
import { isCurrent, mainPages } from './navigation'

const consistency = createConsistencyRepository(supabase)

type Extra = { id: string; name: string }
export function TopNav({ page, extras }: { page: string; extras: Extra[] }) {
  return <nav className="top-nav" data-extras={extras.length} aria-label="Navegação do topo">{[...mainPages.map(page => ({ ...page, extra: false })), ...extras.map(extra => ({ ...extra, icon: 'grid', extra: true }))].map(item => <a key={item.id} className={item.extra ? 'top-nav-extra' : undefined} href={`#${item.id}`} aria-current={isCurrent(page, item.id) || (item.id !== 'inicio' && page.startsWith(`${item.id}/`)) ? 'page' : undefined}>{item.name}</a>)}</nav>
}

export function BottomNav({ page }: { page: string }) {
  return <nav className="bottom-nav" aria-label="Atalhos">{mainPages.map(item => <a key={item.id} href={`#${item.id}`} aria-current={isCurrent(page, item.id) ? 'page' : undefined}><Icon name={item.icon} /><span>{item.name === 'Minha Jornada' ? 'Jornada' : item.name}</span></a>)}</nav>
}

// Ofensiva atual ao lado da marca. Busca uma vez por troca de página; qualquer falha apenas esconde o selo.
export function StreakBadge({ page }: { page: string }) {
  const [streak, setStreak] = useState<number | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const value = await consistency.snapshot(null)
        if (alive) setStreak(value.current_streak)
      } catch { if (alive) setStreak(null) }
    })()
    return () => { alive = false }
  }, [page])
  if (streak === null) return null
  return <a className="streak-badge" href="#minha-jornada" aria-label={`Ofensiva atual: ${streak} ${streak === 1 ? 'dia' : 'dias'}`} data-empty={streak === 0 ? 'true' : undefined}><img src="/home/flame.webp" alt="" width="26" height="26" /><b>{streak}</b></a>
}
