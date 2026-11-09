import { environmentName, supabase } from './lib/supabase'
import { createBibleAnnotationStore } from './bible/annotations'
import { useEffect, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { AdminPanel } from './components/AdminPanel'
import { Icon } from './components/UI'
import './App.css'
import './coram.css'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/auth'
import { PasswordForm } from './components/PasswordForm'
import { ProfileForm } from './components/ProfileForm'
import { ReaderLibrary } from './components/ReaderLibrary'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { JourneyPage } from './components/JourneyPage'
import { AppearanceControl } from './components/AppearanceControl'
import { ReminderSettings } from './components/ReminderSettings'
import { BibleReader } from './components/BibleReader'
import { OwnerPanel } from './components/OwnerPanel'
import { PublisherPanel } from './components/PublisherPanel'
import { GoogleOnboarding } from './components/GoogleOnboarding'

const bibleAnnotationStore = createBibleAnnotationStore(supabase)

function route() {
  const hash = location.hash.slice(1)
  return hash.includes('access_token=') || new URLSearchParams(hash).has('error') ? 'login' : hash || 'inicio'
}

function AppContent() {
  const auth = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [requestedPage, setPage] = useState(route)
  const publicPages = ['login', 'cadastro', 'recuperar-senha', 'privacidade']
  const page = auth.recovery ? 'nova-senha' : !auth.session && !publicPages.includes(requestedPage) ? 'login' : requestedPage
  const showNavigation = !auth.loading && !!auth.session && !auth.recovery && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError
  useEffect(() => {
    const change = () => { setPage(route()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  return <div className="app"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a><aside className="sidebar"><a className="brand" href="#inicio"><img src="/coram-icon-192.png" alt="" /><span>CORAM<small>MENOS ROTINA. MAIS PRESENÇA.</small></span></a>{showNavigation && <><div className="nav-label">SEU MOMENTO COM DEUS</div><nav aria-label="Navegação principal">{[{ id: 'inicio', name: 'Início', icon: 'home' }, { id: 'historico', name: 'Devocionais', icon: 'book' }, { id: 'biblia', name: 'Bíblia', icon: 'book' }, { id: 'minha-jornada', name: 'Minha Jornada', icon: 'chart' }, { id: 'minhas-leituras', name: 'Minhas aberturas', icon: 'clock' }, ...(auth.admin ? [{ id: 'admin', name: 'Painel administrativo', icon: 'grid' }] : [])].map(n => <a className={page === n.id || (page.startsWith('leitura') && n.id === 'historico') || (page.startsWith('biblia/') && n.id === 'biblia') ? 'nav-item active' : 'nav-item'} href={`#${n.id}`} key={n.id} aria-current={page === n.id || (page.startsWith('biblia/') && n.id === 'biblia') ? 'page' : undefined}><Icon name={n.icon} />{n.name}</a>)}{auth.owner && <a className={page === 'owner' || page.startsWith('owner/') ? 'nav-item active' : 'nav-item'} href="#owner" aria-current={page === 'owner' || page.startsWith('owner/') ? 'page' : undefined}><Icon name="grid" />Painel OWNER</a>}{auth.publisher && <a className={page === 'publicador' ? 'nav-item active' : 'nav-item'} href="#publicador" aria-current={page === 'publicador' ? 'page' : undefined}><Icon name="book" />Espaço PUBLICADOR</a>}</nav></>}<AppearanceControl /><div className="side-quote"><span>“</span><p>Aquietai-vos e sabei<br />que eu sou Deus.</p><small>SALMOS 46:10</small><i /></div><div className="side-bottom"><span /> Um pouco de fé, todos os dias.<small>Feito para cultivar o que importa.</small></div></aside><div className="main-shell"><header><span className="header-note">Um encontro diário com a Palavra.</span>{auth.session && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError && <><a href="#perfil">Meu perfil</a><a href="#configuracoes">Configurações</a></>}<span className="demo-badge">● {environmentName === 'DEV' ? 'Ambiente local' : 'Ambiente de homologação (STAGING)'}</span>{auth.loading ? <span>Carregando sessão…</span> : auth.session ? <button className="text-link" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button> : <a href="#login">Entrar ↗</a>}</header><main id="main-content" tabIndex={-1}>{auth.error && <div role="alert" className="info">{auth.error}</div>}
    {auth.loading ? <p role="status">Carregando sessão…</p> : auth.googleOnboardingLoading ? <p role="status">Verificando cadastro Google…</p> : auth.googleOnboardingError ? <div className="info" role="alert">Não foi possível validar o cadastro Google. <button className="button secondary" onClick={auth.refreshGoogleOnboarding}>Tentar novamente</button></div> : auth.googleOnboardingPending ? (requestedPage === 'privacidade' ? <PrivacyPolicy /> : <GoogleOnboarding />) : <>{(['inicio', 'historico', 'minhas-leituras', 'leitura'].includes(page) || page.startsWith('leitura/')) && <ReaderLibrary page={page} />}
    {(page === 'cadastro' || page === 'login') && <AuthForm key={page} register={page === 'cadastro'} />}
    {page === 'perfil' && <ProfileForm />}
    {page === 'configuracoes' && <ReminderSettings />}
    {page === 'privacidade' && <PrivacyPolicy />}
    {page === 'minha-jornada' && <JourneyPage />}
    {(page === 'biblia' || page.startsWith('biblia/')) && <BibleReader page={page} userId={auth.session?.user.id} annotationStore={bibleAnnotationStore} />}
    {(page === 'admin' || page === 'admin/comunidade' || page === 'admin/moderacao') && ((auth.loading || auth.adminLoading) ? <p role="status">Verificando acesso administrativo…</p> : auth.session && auth.admin && !auth.recovery ? <AdminPanel community={page === 'admin/comunidade'} moderation={page === 'admin/moderacao'} /> : <div className="info" role="alert">Acesso restrito a administradores. <a href="#login">Entrar</a></div>)}
    {(page === 'owner' || page === 'owner/comunidade' || page === 'owner/moderacao' || page === 'owner/publicadores') && (auth.ownerLoading ? <p role="status">Verificando acesso OWNER…</p> : auth.owner ? <OwnerPanel page={page} /> : <div className="info" role="alert">Acesso restrito ao OWNER.</div>)}
    {page === 'publicador' && <PublisherPanel />}
    {(page === 'recuperar-senha' || page === 'nova-senha' || auth.recovery) && <PasswordForm update={page === 'nova-senha' || auth.recovery} />}
    {!['biblia', 'configuracoes', 'minha-jornada', 'inicio', 'historico', 'leitura', 'login', 'cadastro', 'admin', 'admin/comunidade', 'admin/moderacao', 'owner', 'owner/comunidade', 'owner/moderacao', 'owner/publicadores', 'publicador', 'recuperar-senha', 'nova-senha', 'perfil', 'minhas-leituras', 'privacidade'].includes(page) && !page.startsWith('leitura/') && !page.startsWith('biblia/') && <div className="info">Página não encontrada. <a href="#inicio">Voltar ao início →</a></div>}
  </>}</main><footer><span className="footer-logo">CORAM</span><span>Viver coram deo. Menos rotina. Mais presença.</span><small>Conteúdo e administração no ambiente {environmentName === 'DEV' ? 'local' : 'de homologação'}</small></footer></div></div>
}
function SessionContent() {
  const { session } = useAuth()
  return <AppContent key={session?.user.id ?? 'anonymous'} />
}
export default function App() { return <AuthProvider><SessionContent /></AuthProvider> }
