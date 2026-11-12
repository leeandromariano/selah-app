import { useEffect, useState } from 'react'
import { useAuth } from '../auth/auth'
import { supabase } from '../lib/supabase'
import { createReminderRepository } from '../notifications/repository'
import type { ReminderSnapshot } from '../notifications/repository'
import { deviceKey, notificationPermission, reminderWorker, workerMessage } from '../notifications/device'
import { Heading } from './UI'
import { bindReminderDevice } from '../notifications/session'

const repository = createReminderRepository(supabase)
export function ReminderSettings() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info">Entre para configurar seus lembretes. <a href="#login">Entrar</a></div>
  return <Settings key={session.user.id} user={session.user.id} />
}
function Settings({ user }: { user: string }) {
  const [snapshot, setSnapshot] = useState<ReminderSnapshot | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [time, setTime] = useState('08:00')
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [permission, setPermission] = useState(notificationPermission)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    repository.get(deviceKey(user)).then(data => {
      if (!active) return
      setSnapshot(data); setEnabled(data.enabled)
      if (data.device) { setTime(data.device.time); setTimezone(data.device.timezone) }
    }).catch(() => { if (active) setError('Não foi possível carregar os lembretes. Recarregue para tentar novamente.') })
    const refresh = () => setPermission(notificationPermission())
    window.addEventListener('focus', refresh)
    return () => { active = false; window.removeEventListener('focus', refresh) }
  }, [user])
  async function action(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('')
    try { await work() } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível atualizar seus lembretes.') }
    finally { setBusy(false) }
  }
  async function save(subscription?: object, simulated = snapshot?.device?.mode !== 'webpush') {
    const key = deviceKey(user, true)!
    const data = await repository.save(key, { enabled, time, timezone,
      permission: simulated && subscription ? 'granted' : simulated ? snapshot?.device?.permission ?? permission : permission,
      simulated, subscription })
    setSnapshot(data)
    if (data.device?.mode === 'webpush' && enabled && ['active', 'pending'].includes(data.device.state)) await bindReminderDevice(user, data.device.binding)
    else await workerMessage('clear')
    setMessage('Preferências salvas. A permissão e a assinatura do dispositivo são independentes da opção de lembretes.')
  }
  return <>
    <Heading eyebrow="NO SEU TEMPO" title="Configurações" description="Escolha como deseja receber um convite para sua pausa diária." />
    <section className="info reminder-settings" aria-labelledby="reminder-heading"><h2 id="reminder-heading">Lembretes</h2>
      <p>Antes da leitura, um convite para a Palavra. Se você já concluiu validamente no dia de Brasília, um convite para compartilhar, sempre por sua escolha.</p>
      {error && <p role="alert">{error}</p>}
      {!snapshot && !error && <p role="status">Carregando lembretes…</p>}
      {snapshot && <>
        <label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} disabled={busy} /> Ativar lembretes da minha conta</label>
        <p className="muted">Inclui o aviso de que chegou a hora de rever um pedido da sua cápsula de oração.</p>
        <p><label>Horário neste dispositivo <input type="time" value={time} required onChange={e => setTime(e.target.value)} disabled={busy} /></label></p>
        <p>Fuso configurado: <strong>{timezone}</strong>. Fuso detectado: {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
        <button className="text-link" disabled={busy} onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')}>Usar fuso atual do dispositivo</button>
        <p>Permissão do navegador: <strong>{({ granted: 'concedida', denied: 'bloqueada', default: 'não solicitada', unavailable: 'indisponível' })[permission]}</strong>.</p>
        <p>Assinatura: {snapshot.device?.state ?? 'não cadastrada'}{snapshot.device?.mode === 'simulation' ? ' (dispositivo fictício de teste)' : ''}.</p>
        {permission === 'denied' && <p>A permissão foi bloqueada. Você pode alterá-la nas configurações do navegador; não solicitaremos novamente.</p>}
        {permission === 'unavailable' && <p>Este navegador não oferece todos os recursos necessários. Web Push depende de navegador compatível e contexto seguro. No iOS, pode exigir instalação na Tela de Início.</p>}
        <div className="actions">
          <button className="button" disabled={busy || !/^\d{2}:\d{2}$/.test(time)} onClick={() => void action(() => save())}>Salvar preferências</button>
          {permission === 'default' && <button className="button secondary" disabled={busy} onClick={() => void action(async () => { setPermission(await Notification.requestPermission()) })}>Permitir notificações neste navegador</button>}
          {snapshot.mode === 'simulation' ? <button className="button secondary" disabled={busy || !enabled || permission === 'denied'} onClick={() => void action(() => save({ endpoint: 'https://push.test.invalid/' + crypto.randomUUID(), keys: { p256dh: 'A'.repeat(87), auth: 'A'.repeat(22) } }, true))}>Cadastrar dispositivo fictício (sem envio)</button>
            : <button className="button secondary" disabled={busy || !enabled || permission !== 'granted'} onClick={() => void action(async () => {
              if (!snapshot.vapid_public_key) throw Error('O envio ainda não está configurado.')
              const registration = await reminderWorker(true)
              if (!registration) throw Error('Service worker indisponível.')
              const bytes = Uint8Array.from(atob(snapshot.vapid_public_key.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))
              const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes })
              await save(subscription.toJSON(), false)
            })}>Assinar neste dispositivo</button>}
          {snapshot.device && <button className="button secondary" disabled={busy} onClick={() => void action(async () => {
            await repository.revoke(deviceKey(user)!)
            await Promise.allSettled([workerMessage('clear'), (async () => {
              const registration = await reminderWorker()
              await (await registration?.pushManager.getSubscription())?.unsubscribe()
            })()])
            setSnapshot(await repository.get(deviceKey(user))); setMessage('Assinatura deste dispositivo cancelada.')
          })}>Cancelar assinatura deste dispositivo</button>}
          {snapshot.device?.state === 'pending' && <button className="button secondary" disabled={busy} onClick={() => void action(async () => {
            const result = await workerMessage('proof')
            if (!result?.proof) throw Error('A confirmação criptografada ainda não chegou. A entrega externa precisa estar autorizada.')
            await repository.confirm(deviceKey(user)!, result.proof)
            setSnapshot(await repository.get(deviceKey(user))); setMessage('Dispositivo confirmado.')
          })}>Confirmar dispositivo</button>}
        </div>
        {snapshot.mode === 'simulation' && <p>Modo local: somente intenções de envio. O dispositivo fictício não representa a permissão do navegador e não recebe notificações reais.</p>}
        <p>Salvar não solicita permissão nem cria automaticamente uma assinatura. Sair da conta cancela a assinatura deste dispositivo; outros dispositivos mantêm suas próprias configurações.</p>
        {snapshot.last && <p>Última intenção: {snapshot.last.kind === 'share' ? 'compartilhamento' : snapshot.last.kind === 'reading' ? 'leitura' : snapshot.last.kind === 'prayer' ? 'pedido de oração' : 'sem conteúdo enviado'} — {snapshot.last.status}; dia de Brasília {snapshot.last.brt_day}, dia local {snapshot.last.local_day}.</p>}
        <p>As notificações podem aparecer na tela bloqueada. Não incluem seu nome, histórico ou contatos. A entrega depende do navegador e não é garantida.</p>
      </>}
      {message && <p role="status">{message}</p>}
    </section>
  </>
}
