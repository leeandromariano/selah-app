import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createPrayerRepository } from '../prayer/repository'

const defaultRepository = createPrayerRepository(supabase)

// Lembrete no topo do app: aparece em qualquer página (menos na Home, que já mostra os cards) quando
// chegou a data de rever algum pedido de oração. Falhas ficam em silêncio.
export function PrayerDueNotice({ page, repo = defaultRepository }: { page: string; repo?: Pick<typeof defaultRepository, 'due'> }) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    repo.due().then(list => { if (active) setCount(list.length) }).catch(() => { if (active) setCount(0) })
    return () => { active = false }
  }, [repo, page])
  if (!count || page === 'inicio') return null
  return <a className="prayer-notice" href="#inicio" aria-label={`${count} ${count === 1 ? 'pedido de oração para rever' : 'pedidos de oração para rever'}`}>
    <span aria-hidden="true">🙏</span> {count === 1 ? '1 pedido para rever' : `${count} pedidos para rever`}
  </a>
}
