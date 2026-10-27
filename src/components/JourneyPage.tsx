import { useAuth } from '../auth/auth'
import { ConsistencySection } from './ConsistencySection'
import { Heading } from './UI'

export function JourneyPage() {
  const { session, loading, recovery } = useAuth()
  if (loading) return <p role="status">Carregando sessão…</p>
  if (!session || recovery) return <div className="info">Entre na sua conta para acompanhar sua jornada. <a href="#login">Entrar</a></div>
  return <>
    <Heading eyebrow="CADA PAUSA FAZ PARTE DO CAMINHO" title="Minha Jornada" description="Acompanhe suas conclusões e revisite sua história, no seu tempo." />
    <p className="info">Este é seu painel pessoal. Outros leitores não têm acesso ao seu histórico. O proprietário pode consultar as métricas resumidas descritas na <a href="#privacidade">Política de privacidade</a>.</p>
    <ConsistencySection userId={session.user.id} showHistory />
    <div className="actions journey-links"><a className="button secondary" href="#minhas-leituras">Ver minhas aberturas e conclusões</a><a className="text-link" href="#historico">Escolher um devocional →</a></div>
  </>
}
