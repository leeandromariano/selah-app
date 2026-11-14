import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { deviceKey, notificationPermission } from '../notifications/device'
import { createReminderRepository } from '../notifications/repository'
import { activateReminders, confirmPendingDevice, rearmReminders } from '../notifications/activate'

const defaultRepository = createReminderRepository(supabase)
const storageKey = (user: string) => 'coram.notify-invite-seen.' + user
function seenLocally(user: string) { try { return localStorage.getItem(storageKey(user)) === '1' } catch { return false } }
function markSeenLocally(user: string) { try { localStorage.setItem(storageKey(user), '1') } catch { /* a marca da conta, no banco, continua valendo */ } }

type Stage = 'hidden' | 'open' | 'working' | 'done' | 'denied' | 'unavailable' | 'error'
// Convite para ativar as notificações, mostrado na Home. A permissão do navegador só é pedida ao tocar em "Ativar".
export function NotificationInvite({ page, repository = defaultRepository, activate = activateReminders, confirm = confirmPendingDevice, rearm = rearmReminders }: {
  page: string; repository?: typeof defaultRepository; activate?: typeof activateReminders; confirm?: typeof confirmPendingDevice; rearm?: typeof rearmReminders
}) {
  const { session, recovery } = useAuth()
  const user = !recovery && session?.user.email_confirmed_at && !session.user.is_anonymous ? session.user.id : null
  const [stage, setStage] = useState<Stage>('hidden')
  const [time, setTime] = useState('08:00')
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const primary = useRef<HTMLButtonElement>(null)
  const stopPolling = useCallback(() => { if (timer.current) clearInterval(timer.current); timer.current = null }, [])
  const watchConfirmation = useCallback((id: string) => {
    stopPolling()
    let tries = 0
    timer.current = setInterval(() => {
      tries++
      confirm(id, repository).then(done => { if (done || tries >= 40) stopPolling() }).catch(() => { if (tries >= 40) stopPolling() })
    }, 15000)
  }, [confirm, repository, stopPolling])
  useEffect(() => {
    if (!user) return
    let live = true
    void (async () => {
      if (notificationPermission() === 'unavailable') return
      // Quem já ligou os lembretes e deu permissão não vê convite: o aparelho volta sozinho (ver rearmReminders).
      const rearmed = await rearm(user, repository)
      if (!live) return
      if (rearmed !== 'skipped') { watchConfirmation(user); return }
      const snapshot = await repository.get(deviceKey(user))
      if (!live || snapshot.mode !== 'webpush') return
      const state = snapshot.device?.mode === 'webpush' ? snapshot.device.state : null
      if (state === 'active') return
      if (state === 'pending') { watchConfirmation(user); return }
      // Uma vez por pessoa: a marca vem da conta (qualquer navegador) e, de reserva, deste navegador.
      if (notificationPermission() === 'denied' || snapshot.invite_seen === true || seenLocally(user)) return
      setStage('open')
    })().catch(() => { /* sem convite se a consulta falhar */ })
    return () => { live = false; stopPolling() }
  }, [user, repository, rearm, watchConfirmation, stopPolling])
  const visible = stage !== 'hidden' && page === 'inicio'
  const close = useCallback(() => setStage('hidden'), [])
  const marked = useRef(false)
  useEffect(() => {
    // Assim que o convite aparece, grava que a pessoa já o viu: não volta no próximo login, nem em outro aparelho.
    if (!user || !visible || stage !== 'open' || marked.current) return
    marked.current = true
    markSeenLocally(user)
    void repository.markInviteSeen().catch(() => { /* a marca local evita repetir neste navegador */ })
  }, [user, visible, stage, repository])
  useEffect(() => {
    if (!visible) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    primary.current?.focus()
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && stage !== 'working') close() }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus?.() }
  }, [visible, stage, close])
  if (!user || !visible) return null
  async function enable() {
    if (!user || !/^\d{2}:\d{2}$/.test(time)) return
    setStage('working')
    try {
      const result = await activate(user, repository, time)
      if (result === 'activated') { watchConfirmation(user); setStage('done') } else setStage(result)
    } catch { setStage('error') }
  }
  const text: Partial<Record<Stage, string>> = {
    done: 'Tudo certo! As notificações estão ativas neste aparelho. Você pode mudar o horário ou desativar quando quiser, em Configurações.',
    denied: 'O navegador não liberou as notificações. Se mudar de ideia, libere nas configurações do navegador e ative em Configurações.',
    unavailable: 'Este navegador não permite notificações. No iPhone, instale o Coram na Tela de Início e abra por lá.',
    error: 'Não foi possível ativar agora. Você pode tentar de novo em Configurações.',
  }
  return <div className="share-dialog-backdrop" onClick={event => { if (event.target === event.currentTarget && stage !== 'working') close() }}>
    <div className="share-dialog" role="dialog" aria-modal="true" aria-labelledby="notify-invite-title">
      <div className="eyebrow">NÃO PERCA O RITMO</div>
      <h2 id="notify-invite-title">{stage === 'open' || stage === 'working' ? 'Ative o lembrete e não perca sua constância!' : 'Notificações'}</h2>
      {(stage === 'open' || stage === 'working') ? <>
        <p className="muted">Um aviso no horário certo mantém a sua pausa diária com Deus em dia, chama você assim que sai uma devocional nova e lembra de rever os seus pedidos de oração. Os avisos têm texto fixo e nunca mostram o conteúdo dos seus pedidos.</p>
        <p><label>Horário do lembrete diário <input type="time" value={time} required disabled={stage === 'working'} onChange={e => setTime(e.target.value)} /></label></p>
        <div className="actions">
          <button type="button" className="button secondary" disabled={stage === 'working'} onClick={close}>Agora não</button>
          <button ref={primary} type="button" className="button" disabled={stage === 'working' || !/^\d{2}:\d{2}$/.test(time)} onClick={() => void enable()}>{stage === 'working' ? 'Ativando…' : 'Ativar lembrete'}</button>
        </div>
      </> : <>
        <p role="status">{text[stage]}</p>
        <div className="actions"><button ref={primary} type="button" className="button" onClick={close}>Fechar</button></div>
      </>}
    </div>
  </div>
}
