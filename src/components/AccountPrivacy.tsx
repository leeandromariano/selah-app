import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { createPrivacyRepository, privacyMessage } from '../profiles/privacy'
import type { DeletionRequest } from '../profiles/privacy'
const repository = createPrivacyRepository(supabase)

export function AccountPrivacy({ userId }: { userId: string }) {
  const [expanded, setExpanded] = useState(false)
  return <section><h3>Privacidade e conta</h3><p>Seu perfil e seu histórico pessoal são acessíveis pela sua sessão. Os campos do perfil são opcionais; você pode corrigi-los ou limpá-los. Dados antigos do cadastro podem continuar nos metadados de autenticação. Conclusões geram métricas individuais de consistência. O proprietário do Selah pode consultar username, ofensiva atual, recorde, dias com conclusão e situação de hoje para gestão e incentivo ao uso. O ranking é administrativo, não público: outros leitores e futuros publicadores não têm acesso. O WhatsApp tem finalidade e regras separadas; a autorização opcional de feedback não é reutilizada para acessar métricas. <a href={'#privacidade'}>Política de privacidade</a></p><button className="button secondary" aria-expanded={expanded} onClick={() => setExpanded(value => !value)}>Solicitar exclusão da conta</button>{expanded && <Request key={userId} userId={userId} />}</section>
}
function Request({ userId }: { userId: string }) {
  const [request, setRequest] = useState<DeletionRequest | null>(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    repository.load(userId).then(data => { if (active) { setRequest(data); setReady(true); setLoading(false); setError('') } }, () => { if (active) { setLoading(false); setError(privacyMessage()) } })
    return () => { active = false }
  }, [userId, attempt])
  if (loading) return <p role="status">Consultando seu pedido…</p>
  return <div className="info"><p>Este pedido não apaga sua conta nem suspende o acesso. Será necessária análise manual do responsável, inclusive do conteúdo publicado por você. Ainda não há prazo ou atendimento automático definidos.</p>{error && <p role="alert">{error}</p>}{request ? <p role="status">Seu pedido de exclusão está registrado. Nenhum dado foi apagado.</p> : ready ? <form onSubmit={async event => {
    event.preventDefault()
    if (!confirmed || pending) return
    setPending(true); setError('')
    try { setRequest(await repository.request(userId, confirmed)) } catch { setError(privacyMessage()) }
    finally { setPending(false) }
  }}><label><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />Confirmo que quero registrar um pedido de exclusão da minha conta para análise manual.</label><button className="button secondary" disabled={!confirmed || pending}>{pending ? 'Registrando…' : 'Confirmar solicitação'}</button></form> : <button className="button secondary" onClick={() => { setLoading(true); setAttempt(value => value + 1) }}>Tentar novamente</button>}</div>
}
