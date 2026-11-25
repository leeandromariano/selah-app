import { supabase } from './lib/supabase'
import { createBibleAnnotationStore } from './bible/annotations'
import { lazy, Suspense, useEffect, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { AdminPanel } from './components/AdminPanel'
import { Icon } from './components/UI'
import './App.css'
import './coram.css'
import './home.css'
import './journey-v2.css'
import './games-v2.css'
import './library-v2.css'
import './reading-v2.css'
import './shell-v2.css'
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
import { WhoSaidPage } from './components/WhoSaidPage'
import { VerseGame } from './components/VerseGame'
import { TimelineGame } from './components/TimelineGame'
import { PrayerDueNotice } from './components/PrayerDueNotice'
import { NotificationInvite } from './components/NotificationInvite'
import { BrandLogo } from './components/BrandLogo'
import { ReadingPlansPage } from './components/ReadingPlans'
import { DuelHub, DuelRoom } from './components/BereiaDuel'
import { CoramWrapped } from './components/CoramWrapped'
import { BottomNav, StreakBadge, TopNav } from './components/GlobalNav'
import { useViewport } from './components/navigation'

// CORAM // LOGOS carrega só quando a pessoa abre o jogo: o motor e o canvas não entram no pacote principal.
import { LogosSoon } from './game/logos/LogosSoon'
const LogosPage = lazy(() => import('./game/logos/LogosPage'))
const bibleAnnotationStore = createBibleAnnotationStore(supabase)

// arte 3D de cada jogo da Bereia; o CSS .game-v2 usa este valor para desenhar a placa no cabeçalho
const gameArts: Record<string, string> = { 'bereia/quiz': 'trophy', 'bereia/mito': 'cards', 'bereia/quem-disse': 'bust', 'bereia/versiculo': 'blocks', 'bereia/linha-do-tempo': 'hourglass', 'bereia/duelo': 'duelo' }
// Link de convite do Duelo Relâmpago: #bereia/duelo/<código>. Devolve o código ou undefined.
const duelRoom = { exec: (value: string) => { const code = value.startsWith('bereia/duelo/') ? value.slice(13) : ''; return /^[a-z0-9]+$/.test(code) ? [value, code] : null }, test: (value: string) => duelRoom.exec(value) !== null }
const pendingDuelKey = 'coram.pending-duel'

function route() {
  const hash = location.hash.slice(1)
  if (hash.includes('access_token=') || new URLSearchParams(hash).has('error')) return 'login'
  // "Minhas aberturas" agora vive dentro de Minha Jornada; links antigos continuam funcionando.
  return hash === 'minhas-leituras' ? 'minha-jornada' : hash || 'inicio'
}

function AppContent() {
  const auth = useAuth()
  // quem já foi confirmado OWNER não perde o jogo no meio da partida se a verificação de acesso for refeita (ex.: renovação da sessão)
  const [ownerSeen, setOwnerSeen] = useState(false)
  if (auth.owner && !ownerSeen) setOwnerSeen(true)
  else if (!auth.session && ownerSeen) setOwnerSeen(false)
  const logosOpen = auth.owner || (auth.ownerLoading && ownerSeen)
  const [loggingOut, setLoggingOut] = useState(false)
  const [requestedPage, setPage] = useState(route)
  const [menuOpen, setMenuOpen] = useState(false)
  const viewport = useViewport()
  const publicPages = ['login', 'cadastro', 'recuperar-senha', 'privacidade']
  const page = auth.recovery ? 'nova-senha' : !auth.session && !publicPages.includes(requestedPage) ? 'login' : requestedPage
  const duelCode = duelRoom.exec(page)?.[1]
  const showNavigation = !auth.loading && !!auth.session && !auth.recovery && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError
  useEffect(() => {
    const change = () => { setPage(route()); setMenuOpen(false); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  useEffect(() => {
    if (auth.loading) return
    try {
      if (!auth.session && duelRoom.test(requestedPage)) sessionStorage.setItem(pendingDuelKey, requestedPage)
      else if (auth.session && requestedPage === 'inicio') {
        const pending = sessionStorage.getItem(pendingDuelKey)
        if (pending && duelRoom.test(pending)) { sessionStorage.removeItem(pendingDuelKey); location.hash = pending }
      }
    } catch { /* sem armazenamento, o link continua valendo: basta abrir de novo */ }
  }, [auth.loading, auth.session, requestedPage])
  useEffect(() => {
    if (!menuOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])
  const immersive = page === 'bereia/logos' && logosOpen
  return <div className="app" data-immersive={immersive || undefined}><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a><div className="main-shell"><header><button type="button" className="menu-toggle" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="menu-panel" onClick={() => setMenuOpen(o => !o)}><span /><span /><span /></button><a className="header-brand" href="#inicio"><BrandLogo /><b>CORAM</b></a>{showNavigation && viewport && <StreakBadge page={page} />}{showNavigation && viewport === 'desktop' && <TopNav page={page} extras={[...(auth.admin ? [{ id: 'admin', name: 'Painel administrativo' }] : []), ...(auth.owner ? [{ id: 'owner', name: 'Painel OWNER' }] : []), ...(auth.publisher ? [{ id: 'publicador', name: 'Espaço PUBLICADOR' }] : [])]} />}<span className="header-note">Um encontro diário com a Palavra.</span>{auth.session && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError && <><PrayerDueNotice page={page} />{viewport !== 'mobile' && <><a href="#perfil">Meu perfil</a><a href="#configuracoes">Configurações</a></>}</>}{auth.loading ? <span>Carregando sessão…</span> : auth.session ? (viewport !== 'mobile' && <button className="text-link" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button>) : <a href="#login">Entrar ↗</a>}</header>{auth.session && !auth.googleOnboardingLoading && !auth.googleOnboardingPending && !auth.googleOnboardingError && <NotificationInvite page={page} />}{menuOpen && <><div className="menu-backdrop" onClick={() => setMenuOpen(false)} /><div className="menu-drawer" id="menu-panel"><div className="menu-top"><button type="button" className="menu-back" aria-label="Voltar" onClick={() => setMenuOpen(false)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg></button><a className="brand" href="#inicio" onClick={() => setMenuOpen(false)}><BrandLogo /><span>CORAM<small>MENOS ROTINA. MAIS PRESENÇA.</small></span></a></div><AppearanceControl />{showNavigation && <><div className="nav-label">SEU MOMENTO COM DEUS</div><nav id="main-menu" aria-label="Navegação principal">{[{ id: 'inicio', name: 'Início', icon: 'home' }, { id: 'historico', name: 'Devocionais', icon: 'book' }, { id: 'biblia', name: 'Bíblia', icon: 'book' }, { id: 'bereia', name: 'Bereia', icon: 'quiz' }, { id: 'minha-jornada', name: 'Minha Jornada', icon: 'chart' }, ...(auth.admin ? [{ id: 'admin', name: 'Painel administrativo', icon: 'grid' }] : [])].map(n => <a className={page === n.id || (page.startsWith('leitura') && n.id === 'historico') || (page.startsWith('biblia/') && n.id === 'biblia') || (page.startsWith('bereia/') && n.id === 'bereia') ? 'nav-item active' : 'nav-item'} href={`#${n.id}`} key={n.id} onClick={() => setMenuOpen(false)} aria-current={page === n.id || (page.startsWith('biblia/') && n.id === 'biblia') || (page.startsWith('bereia/') && n.id === 'bereia') ? 'page' : undefined}><Icon name={n.icon} />{n.name}</a>)}{auth.owner && <a className={page === 'owner' || page.startsWith('owner/') ? 'nav-item active' : 'nav-item'} href="#owner" onClick={() => setMenuOpen(false)} aria-current={page === 'owner' || page.startsWith('owner/') ? 'page' : undefined}><Icon name="crown" />Painel OWNER</a>}{auth.publisher && <a className={page === 'publicador' ? 'nav-item active' : 'nav-item'} href="#publicador" onClick={() => setMenuOpen(false)} aria-current={page === 'publicador' ? 'page' : undefined}><Icon name="book" />Espaço PUBLICADOR</a>}</nav>{viewport === 'mobile' && <div className="menu-account"><a className="nav-item" href="#perfil" onClick={() => setMenuOpen(false)}>Meu perfil</a><a className="nav-item" href="#configuracoes" onClick={() => setMenuOpen(false)}>Configurações</a><button type="button" className="nav-item" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button></div>}</>}<div className="side-quote"><span>“</span><p>Aquietai-vos e sabei<br />que eu sou Deus.</p><small>SALMOS 46:10</small><i /></div><div className="side-bottom"><span /> Um pouco de fé, todos os dias.<small>Feito para cultivar o que importa.</small></div></div></>}<main id="main-content" tabIndex={-1}>{auth.error && <div role="alert" className="info">{auth.error}</div>}
    {auth.loading ? <p role="status">Carregando sessão…</p> : auth.googleOnboardingLoading ? <p role="status">Verificando cadastro Google…</p> : auth.googleOnboardingError ? <div className="info" role="alert">Não foi possível validar o cadastro Google. <button className="button secondary" onClick={auth.refreshGoogleOnboarding}>Tentar novamente</button></div> : auth.googleOnboardingPending ? (requestedPage === 'privacidade' ? <PrivacyPolicy /> : <GoogleOnboarding />) : <>{(['inicio', 'historico', 'leitura'].includes(page) || page.startsWith('leitura/')) && <ReaderLibrary page={page} />}
    {page === 'inicio' && <InstallApp />}
    {(page === 'cadastro' || page === 'login') && <AuthForm key={page} register={page === 'cadastro'} />}
    {page === 'perfil' && <ProfileForm />}
    {page === 'configuracoes' && <ReminderSettings />}
    {page === 'privacidade' && <PrivacyPolicy />}
    {page === 'minha-jornada' && <JourneyPage />}
    {page === 'bereia' && <BereiaHub logosOpen={logosOpen} />}
    {page === 'plano-de-leitura' && <ReadingPlansPage />}
    {(page === 'recap' || page.startsWith('recap/')) && <CoramWrapped page={page} />}
    {page === 'bereia/logos' && (logosOpen ? <Suspense fallback={<p role="status">Abrindo o CORAM // LOGOS…</p>}><LogosPage /></Suspense> : auth.ownerLoading ? <p role="status">Verificando acesso…</p> : <LogosSoon />)}
    {(gameArts[page] || duelCode) && <div className="game-v2" data-art={gameArts[page] ?? 'duelo'}>
      {page === 'bereia/duelo' && <DuelHub />}
      {duelCode && <DuelRoom key={duelCode} code={duelCode} />}
      {page === 'bereia/quiz' && <QuizPage />}
      {page === 'bereia/mito' && <ClaimsGame />}
      {page === 'bereia/quem-disse' && <WhoSaidPage />}
      {page === 'bereia/versiculo' && <VerseGame />}
      {page === 'bereia/linha-do-tempo' && <TimelineGame />}
    </div>}
    {(page === 'biblia' || page.startsWith('biblia/')) && <BibleReader page={page} userId={auth.session?.user.id} annotationStore={bibleAnnotationStore} />}
    {(page === 'admin' || page === 'admin/comunidade' || page === 'admin/moderacao') && ((auth.loading || auth.adminLoading) ? <p role="status">Verificando acesso administrativo…</p> : auth.session && auth.admin && !auth.recovery ? <AdminPanel community={page === 'admin/comunidade'} moderation={page === 'admin/moderacao'} /> : <div className="info" role="alert">Acesso restrito a administradores. <a href="#login">Entrar</a></div>)}
    {(page === 'owner' || page === 'owner/comunidade' || page === 'owner/moderacao' || page === 'owner/bereia' || page === 'owner/perguntas' || page === 'owner/publicadores' || page === 'owner/raio-x' || page === 'owner/panorama') && (auth.ownerLoading ? <p role="status">Verificando acesso OWNER…</p> : auth.owner ? <OwnerPanel page={page} /> : <div className="info" role="alert">Acesso restrito ao OWNER.</div>)}
    {page === 'publicador' && <PublisherPanel />}
    {(page === 'recuperar-senha' || page === 'nova-senha' || auth.recovery) && <PasswordForm update={page === 'nova-senha' || auth.recovery} />}
    {!['biblia', 'configuracoes', 'minha-jornada', 'plano-de-leitura', 'recap', 'bereia', 'bereia/quiz', 'bereia/mito', 'bereia/quem-disse', 'bereia/versiculo', 'bereia/linha-do-tempo', 'bereia/duelo', 'bereia/logos', 'inicio', 'historico', 'leitura', 'login', 'cadastro', 'admin', 'admin/comunidade', 'admin/moderacao', 'owner', 'owner/comunidade', 'owner/moderacao', 'owner/bereia', 'owner/perguntas', 'owner/publicadores', 'owner/raio-x', 'owner/panorama', 'publicador', 'recuperar-senha', 'nova-senha', 'perfil', 'privacidade'].includes(page) && !page.startsWith('leitura/') && !page.startsWith('biblia/') && !page.startsWith('recap/') && !duelCode && <div className="info">Página não encontrada. <a href="#inicio">Voltar ao início →</a></div>}
  </>}</main><footer><span className="footer-logo">CORAM</span><span>Viver coram deo. Menos rotina. Mais presença.</span></footer></div>{showNavigation && viewport === 'mobile' && !immersive && <BottomNav page={page} />}</div>
}
function SessionContent() {
  const { session } = useAuth()
  return <AppContent key={session?.user.id ?? 'anonymous'} />
}
export default function App() { return <AuthProvider><SessionContent /></AuthProvider> }
