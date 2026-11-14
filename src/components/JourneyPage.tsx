import { useAuth } from '../auth/auth'
import { ConsistencySection } from './ConsistencySection'
import { Heading } from './UI'
import { JourneyRewards } from './JourneyRewards'
import { JourneyLastOpening } from './JourneyLastOpening'
import { PrayerMural } from './PrayerMural'
import { ReaderLibrary } from './ReaderLibrary'

export function JourneyPage() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info">Entre na sua conta para acompanhar sua jornada. <a href="#login">Entrar</a></div>
  return <>
    <Heading eyebrow="CADA PAUSA FAZ PARTE DO CAMINHO" title="Minha Jornada" description="Acompanhe suas conclusões e revisite sua história, no seu tempo." />
    <JourneyLastOpening key={session.user.id} userId={session.user.id} />
    <ConsistencySection userId={session.user.id} showHistory />
    <JourneyRewards userId={session.user.id} />
    <PrayerMural />
    <ReaderLibrary page="minhas-leituras" embedded />
    <div className="actions journey-links"><a className="text-link" href="#historico">Escolher um devocional →</a></div>
  </>
}
