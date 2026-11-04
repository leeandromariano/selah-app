import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type ListedPublisher = { username: string }
function normalize(value: string) {
  const username = value.trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z][a-z0-9_]{2,23}$/.test(username)) throw new Error('Informe um username válido, sem espaços.')
  return username
}

export function PublisherManagement() {
  const [username, setUsername] = useState('')
  const [items, setItems] = useState<ListedPublisher[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    Promise.resolve(supabase.rpc('owner_list_publishers')).then(({ data, error }) => {
      if (!active) return
      if (error || !Array.isArray(data) || !data.every(item => typeof item?.username === 'string')) {
        setError('Não foi possível consultar a lista de PUBLICADORES. Confira sua permissão OWNER.')
      } else {
        setItems(data as ListedPublisher[])
        setError('')
      }
      setLoading(false)
    }).catch(() => {
      if (active) { setError('Não foi possível consultar a lista de PUBLICADORES.'); setLoading(false) }
    })
    return () => { active = false }
  }, [attempt])
  async function manage(target: string, enabled: boolean) {
    if (busy) return
    setBusy(true); setNotice(''); setError('')
    try {
      const normalized = normalize(target)
      const { error } = await supabase.rpc('owner_manage_publisher', { p_username: normalized, p_enabled: enabled })
      if (error) throw error
      setUsername('')
      setNotice(enabled ? '@' + normalized + ' recebeu permissão de PUBLICADOR.' : 'Permissão de @' + normalized + ' revogada.')
      setLoading(true)
      setAttempt(value => value + 1)
    } catch {
      setError('Não foi possível alterar a permissão. Confirme que a conta existe, está ativa e não possui papel ADMIN ou OWNER.')
    } finally { setBusy(false) }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void manage(username, true)
  }
  return <section aria-label="Gerenciar PUBLICADORES" className="discussion">
    <h2>Gerenciar PUBLICADORES</h2>
    <p>Apenas o OWNER pode conceder ou revogar este papel. PUBLICADORES escrevem seus próprios rascunhos e os enviam para aprovação, sem acesso ao painel administrativo.</p>
    <form onSubmit={submit} className="actions">
      <label>Username da conta cadastrada
        <input value={username} onChange={event => setUsername(event.target.value)} placeholder="@username" autoComplete="off" required maxLength={25} />
      </label>
      <button className="button primary" disabled={busy} type="submit">Autorizar PUBLICADOR</button>
    </form>
    {notice && <p role="status" className="success">{notice}</p>}
    {error && <p role="alert" className="info">{error}</p>}
    {loading ? <p role="status">Carregando PUBLICADORES…</p> : <>
      <h3>PUBLICADORES autorizados ({items.length})</h3>
      {!items.length && <p className="info">Ainda não há PUBLICADORES autorizados.</p>}
      <div className="admin-list">{items.map(item => <div className="admin-row" key={item.username}>
        <strong>@{item.username}</strong>
        <button className="button secondary" disabled={busy} onClick={() => void manage(item.username, false)}>Revogar</button>
      </div>)}</div>
    </>}
  </section>
}
