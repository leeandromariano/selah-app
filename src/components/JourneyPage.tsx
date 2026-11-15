import { useAuth } from '../auth/auth'
import { ConsistencySection } from './ConsistencySection'
import { JourneyRewards } from './JourneyRewards'
import { JourneyLastOpening } from './JourneyLastOpening'
import { PrayerMural } from './PrayerMural'
import { ReaderLibrary } from './ReaderLibrary'

export function JourneyPage() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info">Entre na sua conta para acompanhar sua jornada. <a href="#login">Entrar</a></div>
  return <div className="journey-v2">
    <div className="page-heading journey-heading"><div className="eyebrow">CADA PAUSA FAZ PARTE DO CAMINHO</div><h1>Minha <em>Jornada</em></h1><p>Acompanhe suas conclusões e revisite sua história, no seu tempo.</p></div>
    <ConsistencySection userId={session.user.id} showHistory />
    <JourneyLastOpening key={session.user.id} userId={session.user.id} />
    <JourneyRewards userId={session.user.id} />
    <PrayerMural />
    <ReaderLibrary page="minhas-leituras" embedded />
    <div className="actions journey-links"><a className="text-link" href="#historico">Escolher um devocional →</a></div>
  </div>
}
