import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { environmentName } from '../lib/supabase'
import { positionKey, readPosition, savePosition } from '../reading/position'

type Setup = { key: string | null; ratio: number | null; stale: boolean }

export function ReadingPosition({ userId, devotionalId, revision, resume, children }: { userId: string; devotionalId: string; revision: number; resume: boolean; children: ReactNode }) {
  const content = useRef<HTMLDivElement>(null)
  const [setup, setSetup] = useState<Setup | null>(resume ? null : { key: null, ratio: null, stale: false })
  useEffect(() => {
    let active = true
    void positionKey(userId, devotionalId, environmentName).then(key => {
      if (!active) return
      const stored = key && resume ? readPosition(key, revision) : { ratio: null, stale: false }
      setSetup({ key, ...stored })
    })
    return () => { active = false }
  }, [userId, devotionalId, revision, resume])
  useLayoutEffect(() => {
    if (!resume || !content.current || setup?.ratio == null) return
    const node = content.current
    const top = window.scrollY + node.getBoundingClientRect().top
    const available = Math.max(0, node.offsetHeight - window.innerHeight)
    window.scrollTo(0, Math.max(0, top + setup.ratio * available))
  }, [setup, resume])
  useEffect(() => {
    if (!setup?.key || !content.current) return
    const key = setup.key, node = content.current
    let timer: number | undefined, pending: number | undefined
    const flush = () => {
      if (timer !== undefined) window.clearTimeout(timer)
      timer = undefined
      if (pending !== undefined) { savePosition(key, revision, pending); pending = undefined }
    }
    const onScroll = () => {
      const top = window.scrollY + node.getBoundingClientRect().top
      const available = Math.max(0, node.offsetHeight - window.innerHeight)
      pending = available > 0 ? Math.max(0, Math.min(1, (window.scrollY - top) / available)) : 0
      if (timer === undefined) timer = window.setTimeout(flush, 500)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('pagehide', flush); flush() }
  }, [setup?.key, revision])
  if (!setup) return <p role="status">Preparando sua leitura…</p>
  return <div ref={content}>{setup.stale && <p className="info" role="status">O devocional foi atualizado desde sua última visita. A leitura começa do início.</p>}{children}</div>
}
