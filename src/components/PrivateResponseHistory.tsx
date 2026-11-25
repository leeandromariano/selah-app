import { useEffect, useState } from 'react'
import type { Publication } from '../devotionals/repository'
import { displayDate } from '../devotionals/repository'
import { createPrivateResponseRepository } from '../devotionals/privateResponses'
import type { PrivateResponse } from '../devotionals/privateResponses'
import { supabase } from '../lib/supabase'

const repository = createPrivateResponseRepository(supabase)
export function PrivateResponseHistory({ userId, items }: { userId: string; items: Publication[] }) {
  const [responses, setResponses] = useState<PrivateResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let active = true
    repository.list(userId).then(rows => { if (active) { setResponses(rows); setError(false); setLoading(false) } }).catch(() => { if (active) { setError(true); setLoading(false) } })
    return () => { active = false }
  }, [userId])
  return <section className="private-response-history"><h2>Minhas respostas pessoais</h2><p className="muted">Visíveis apenas na sua conta.</p>{loading ? <p role="status">Carregando respostas…</p> : error ? <p role="alert" className="info">Não foi possível carregar suas respostas.</p> : responses.length ? <div className="admin-list">{responses.map(response => { const item = items.find(value => value.id === response.devotional_id); return <div className="admin-row" key={response.source_devotional_id}><div><strong>{item?.title ?? 'Devocional indisponível'}</strong><p>{response.body}</p><small>Atualizada em {displayDate(response.updated_at)}</small></div>{item && <a className="text-link" href={`#leitura/${item.id}`}>Reler</a>}</div> })}</div> : <p className="info">Você ainda não salvou uma resposta pessoal.</p>}</section>
}
