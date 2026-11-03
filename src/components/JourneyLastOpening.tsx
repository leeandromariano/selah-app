import { useEffect, useState } from 'react'
import { createDevotionalRepository, devotionalMessage, displayDate } from '../devotionals/repository'
import type { Opening } from '../devotionals/repository'
import { supabase } from '../lib/supabase'

const repository = createDevotionalRepository(supabase)
type LastOpening = { opening: Opening; title: string | null }

export function JourneyLastOpening({ userId }: { userId: string }) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<LastOpening | null | undefined>(undefined)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const opening = await repository.lastOpening(userId)
        if (!active) return
        const item = opening?.devotional_id ? await repository.availableTitle(opening.devotional_id, new Date()) : null
        if (active) { setResult(opening ? { opening, title: item?.title ?? null } : null); setError('') }
      } catch (failure) { if (active) { setResult(undefined); setError(devotionalMessage(failure)) } }
    }
    void load()
    return () => { active = false }
  }, [userId, attempt])
  function retry() { setError(''); setResult(undefined); setAttempt(value => value + 1) }
  return <section className="journey-last" aria-labelledby="journey-last-title">
    <div><div className="eyebrow">RETOME SUA LEITURA</div><h2 id="journey-last-title">Último devocional acessado</h2></div>
    {error ? <div role="alert" className="info">{error} <button type="button" className="button secondary" onClick={retry}>Tentar carregar última abertura</button></div>
      : result === undefined ? <p role="status">Carregando sua última abertura…</p>
      : result === null ? <p>Você ainda não abriu nenhum devocional. <a href="#historico">Conhecer o acervo</a></p>
      : <div className="journey-last-content"><div><strong>{result.title ?? 'Devocional indisponível'}</strong><p>Aberto em {displayDate(result.opening.opened_at)} · Horário de Brasília</p>{!result.title && <p>Esta publicação não está disponível para leitura agora.</p>}</div>
        {result.title && result.opening.devotional_id && <a className="button primary" href={`#leitura/${encodeURIComponent(result.opening.devotional_id)}/retomar`}>Continuar leitura</a>}</div>}
    <p className="journey-last-note">A abertura indica que você acessou o devocional; ela não representa uma conclusão.</p>
    <p className="journey-last-note">A posição é salva somente neste navegador e dispositivo; ela não é sincronizada.</p>
  </section>
}
