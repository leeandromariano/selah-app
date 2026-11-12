import { supabase } from './lib/supabase'
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
import { InstallApp } from './components/InstallApp'
import { QuizPage } from './components/QuizPage'
import { BereiaHub } from './components/BereiaHub'
import { ClaimsGame } from './components/ClaimsGame'

const bibleAnnotationStore = createBibleAnnotationStore(supabase)

function route() {
  const hash = location.hash.slice(1)
  if (hash.includes('access_token=') || new URLSearchParams(hash).has('error')) return 'login'
  // "Minhas aberturas" agora vive dentro de Minha Jornada; links antigos continuam funcionando.
  return hash === 'minhas-leituras' ? 'minha-jornada' : hash || 'inicio'
}

function AppContent() {
  const auth = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [requestedPage, setPage] = useState(route)
  const [menuOpen, setMenuOpen] = useState(false)
  const publicPages = ['login', 'cadastro', 'recuperar-senha', 'privacidade']
  const page = auth.recovery ? 'nova-senha' : !auth.session && !publicPages.includes(requestedPage) ? 'login' : requestedPage
  const showNavigation = !auth.loading && !!auth.session && !auth.recovery && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError
  useEffect(() => {
    const change = () => { setPage(route()); setMenuOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])
  return <div className="app"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a><div className="main-shell"><header><button type="button" className="menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="menu-panel" onClick={() => setMenuOpen(o => !o)}><span /><span /><span /></button><a className="header-brand" href="#inicio"><img src="/coram-icon-192.png" alt="" /><b>CORAM</b></a><span className="header-note">Um encontro diário com a Palavra.</span>{auth.session && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError && <><a href="#perfil">Meu perfil</a><a href="#configuracoes">Configurações</a></>}{auth.loading ? <span>Carregando sessão…</span> : auth.session ? <button className="text-link" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button> : <a href="#login">Entrar ↗</a>}</header>{menuOpen && <><div className="menu-backdrop" onClick={() => setMenuOpen(false)} /><div className="menu-drawer" id="menu-panel"><div className="menu-top"><button type="button" className="menu-back" aria-label="Voltar" onClick={() => setMenuOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button><a className="brand" href="#inicio" onClick={() => setMenuOpen(false)}><img src="/coram-icon-192.png" alt="" /><span>CORAM<small>MENOS ROTINA. MAIS PRESENÇA.</small></span></a></div><AppearanceControl />{showNavigation && <><div className="nav-label">SEU MOMENTO COM DEUS</div><nav id="main-menu" aria-label="Navegação principal">{[{ id: 'inicio', name: 'Início', icon: 'home' }, { id: 'historico', name: 'Devocionais', icon: 'book' }, { id: 'biblia', name: 'Bíblia', icon: 'book' }, { id: 'bereia', name: 'Bereia', icon: 'quiz' }, { id: 'minha-jornada', name: 'Minha Jornada', icon: 'chart' }, ...(auth.admin ? [{ id: 'admin', name: 'Painel administrativo', icon: 'grid' }] : [])].map(n => <a className={page === n.id || (page.startsWith('leitura') && n.id === 'historico') || (page.startsWith('biblia/') && n.id === 'biblia') || (page.startsWith('bereia/') && n.id === 'bereia') ? 'nav-item active' : 'nav-item'} href={`#${n.id}`} key={n.id} onClick={() => setMenuOpen(false)} aria-current={page === n.id || (page.startsWith('biblia/') && n.id === 'biblia') || (page.startsWith('bereia/') && n.id === 'bereia') ? 'page' : undefined}><Icon name={n.icon} />{n.name}</a>)}{auth.owner && <a className={page === 'owner' || page.startsWith('owner/') ? 'nav-item active' : 'nav-item'} href="#owner" onClick={() => setMenuOpen(false)} aria-current={page === 'owner' || page.startsWith('owner/') ? 'page' : undefined}><Icon name="crown" />Painel OWNER</a>}{auth.publisher && <a className={page === 'publicador' ? 'nav-item active' : 'nav-item'} href="#publicador" onClick={() => setMenuOpen(false)} aria-current={page === 'publicador' ? 'page' : undefined}><Icon name="book" />Espaço PUBLICADOR</a>}</nav></>}<div className="side-quote"><span>“</span><p>Aquietai-vos e sabei<br />que eu sou Deus.</p><small>SALMOS 46:10</small><i /></div><div className="side-bottom"><span /> Um pouco de fé, todos os dias.<small>Feito para cultivar o que importa.</small></div></div></>}<main id="main-content" tabIndex={-1}>{auth.error && <div role="alert" className="info">{auth.error}</div>}
    {auth.loading ? <p role="status">Carregando sessão…</p> : auth.googleOnboardingLoading ? <p role="status">Verificando cadastro Google…</p> : auth.googleOnboardingError ? <div className="info" role="alert">Não foi possível validar o cadastro Google. <button className="button secondary" onClick={auth.refreshGoogleOnboarding}>Tentar novamente</button></div> : auth.googleOnboardingPending ? (requestedPage === 'privacidade' ? <PrivacyPolicy /> : <GoogleOnboarding />) : <>{(['inicio', 'historico', 'leitura'].includes(page) || page.startsWith('leitura/')) && <ReaderLibrary page={page} />}
    {page === 'inicio' && <InstallApp />}
    {(page === 'cadastro' || page === 'login') && <AuthForm key={page} register={page === 'cadastro'} />}
    {page === 'perfil' && <ProfileForm />}
    {page === 'configuracoes' && <ReminderSettings />}
    {page === 'privacidade' && <PrivacyPolicy />}
    {page === 'minha-jornada' && <JourneyPage />}
    {page === 'bereia' && <BereiaHub />}
    {page === 'bereia/quiz' && <QuizPage />}
    {page === 'bereia/mito' && <ClaimsGame />}
    {(page === 'biblia' || page.startsWith('biblia/')) && <BibleReader page={page} userId={auth.session?.user.id} annotationStore={bibleAnnotationStore} />}
    {(page === 'admin' || page === 'admin/comunidade' || page === 'admin/moderacao') && ((auth.loading || auth.adminLoading) ? <p role="status">Verificando acesso administrativo…</p> : auth.session && auth.admin && !auth.recovery ? <AdminPanel community={page === 'admin/comunidade'} moderation={page === 'admin/moderacao'} /> : <div className="info" role="alert">Acesso restrito a administradores. <a href="#login">Entrar</a></div>)}
    {(page === 'owner' || page === 'owner/comunidade' || page === 'owner/moderacao' || page === 'owner/quiz' || page === 'owner/publicadores') && (auth.ownerLoading ? <p role="status">Verificando acesso OWNER…</p> : auth.owner ? <OwnerPanel page={page} /> : <div className="info" role="alert">Acesso restrito ao OWNER.</div>)}
    {page === 'publicador' && <PublisherPanel />}
    {(page === 'recuperar-senha' || page === 'nova-senha' || auth.recovery) && <PasswordForm update={page === 'nova-senha' || auth.recovery} />}
    {!['biblia', 'configuracoes', 'minha-jornada', 'bereia', 'bereia/quiz', 'bereia/mito', 'inicio', 'historico', 'leitura', 'login', 'cadastro', 'admin', 'admin/comunidade', 'admin/moderacao', 'owner', 'owner/comunidade', 'owner/moderacao', 'owner/quiz', 'owner/publicadores', 'publicador', 'recuperar-senha', 'nova-senha', 'perfil', 'privacidade'].includes(page) && !page.startsWith('leitura/') && !page.startsWith('biblia/') && <div className="info">Página não encontrada. <a href="#inicio">Voltar ao início →</a></div>}
  </>}</main><footer><span className="footer-logo">CORAM</span><span>Viver coram deo. Menos rotina. Mais presença.</span></footer></div></div>
}
function SessionContent() {
  const { session } = useAuth()
  return <AppContent key={session?.user.id ?? 'anonymous'} />
}
export default function App() { return <AuthProvider><SessionContent /></AuthProvider> }
