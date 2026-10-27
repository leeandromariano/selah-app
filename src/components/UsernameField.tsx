import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createUsernameRepository, normalizeUsername, usernameMessage } from '../profiles/username'
const repository = createUsernameRepository(supabase)
export function UsernameField({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false)
  return <section><h3>Nome de usuário</h3><p>Seu username é único e não muda nesta versão. Entre com username (com ou sem @) ou e-mail e senha. Nome pessoal e Instagram são opcionais; novas contas exigem WhatsApp.</p><button className="button secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>Consultar meu username</button>{expanded && <Username key={userId} userId={userId} />}</section>
}
function Username({ userId }: { userId: string }) {
  const [username, setUsername] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [ready, setReady] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    repository.load(userId).then(data => { if (active) { setUsername(data?.username ?? null); setReady(true); setError('') } }, error => { if (active) setError(usernameMessage(error)) })
    return () => { active = false }
  }, [userId, attempt])
  if (!ready) return <div>{error ? <><p role="alert">{error}</p><button onClick={() => { setError(''); setAttempt(value => value + 1) }}>Tentar novamente</button></> : <p role="status">Consultando username…</p>}</div>
  if (username) return <p role="status">Seu username: <strong>{username}</strong>. Use este nome ou seu e-mail para entrar.</p>
  return <form onSubmit={async event => {
    event.preventDefault()
    if (pending) return
    let value: string
    try { value = normalizeUsername(input) } catch (error) { setError((error as Error).message); return }
    setPending(true); setError('')
    try { setUsername((await repository.claim(userId, value)).username) } catch (error) { setError(usernameMessage(error)) }
    finally { setPending(false) }
  }}><p>Conta legada sem username: escolha um para sua conta. A reserva é definitiva nesta versão; a disponibilidade é verificada no banco ao salvar.</p>{error && <p role="alert">{error}</p>}<label>Username<input autoComplete="username" maxLength={24} value={input} onChange={e => setInput(e.target.value)} /></label><button className="button secondary" disabled={pending}>{pending ? 'Reservando…' : 'Reservar username'}</button></form>
}
