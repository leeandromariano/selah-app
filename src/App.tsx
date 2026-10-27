import { useEffect, useState } from 'react'
import { AuthForm } from './components/AuthForm'
import { AdminPanel } from './components/AdminPanel'
import { Icon } from './components/UI'
import './App.css'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/auth'
import { PasswordForm } from './components/PasswordForm'
import { ProfileForm } from './components/ProfileForm'
import { ReaderLibrary } from './components/ReaderLibrary'
import { PrivacyPolicy } from './components/PrivacyPolicy'
import { JourneyPage } from './components/JourneyPage'
import { AppearanceControl } from './components/AppearanceControl'

function route() {
  const hash = location.hash.slice(1)
  return hash.includes('access_token=') || new URLSearchParams(hash).has('error') ? 'login' : hash || 'inicio'
}

function AppContent() {
  const auth = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [page, setPage] = useState(route)
  useEffect(() => {
    const change = () => { setPage(route()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  return <div className="app"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a><aside className="sidebar"><a className="brand" href="#inicio"><Icon name="book" /><span>selah<span className="purple-text">.</span><small>PAUSE. RESPIRE. CREIA.</small></span></a><div className="nav-label">SEU MOMENTO COM DEUS</div><nav aria-label="Navegação principal">{[{ id: 'inicio', name: 'Início', icon: 'home' }, { id: 'historico', name: 'Devocionais', icon: 'book' }, { id: 'minha-jornada', name: 'Minha Jornada', icon: 'chart' }, { id: 'minhas-leituras', name: 'Minhas aberturas', icon: 'clock' }, { id: 'admin', name: 'Painel administrativo', icon: 'grid' }].map(n => <a className={page === n.id || (page.startsWith('leitura') && n.id === 'historico') ? 'nav-item active' : 'nav-item'} href={`#${n.id}`} key={n.id} aria-current={page === n.id ? 'page' : undefined}><Icon name={n.icon} />{n.name}</a>)}</nav><AppearanceControl /><div className="side-quote"><span>“</span><p>Aquietai-vos e sabei<br />que eu sou Deus.</p><small>SALMOS 46:10</small><i /></div><div className="side-bottom"><span /> Um pouco de fé, todos os dias.<small>Feito para cultivar o que importa.</small></div></aside><div className="main-shell"><header><span className="header-note">Um encontro diário com a Palavra.</span>{auth.session && <a href="#perfil">Meu perfil</a>}<span className="demo-badge">● Ambiente local</span>{auth.loading ? <span>Carregando sessão…</span> : auth.session ? <button className="text-link" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button> : <a href="#login">Entrar ↗</a>}</header><main id="main-content" tabIndex={-1}>{auth.error && <div role="alert" className="info">{auth.error}</div>}
    {(['inicio', 'historico', 'minhas-leituras', 'leitura'].includes(page) || page.startsWith('leitura/')) && <ReaderLibrary page={page} />}
    {(page === 'cadastro' || page === 'login') && <AuthForm key={page} register={page === 'cadastro'} />}
    {page === 'perfil' && <ProfileForm />}
    {page === 'privacidade' && <PrivacyPolicy />}
    {page === 'minha-jornada' && <JourneyPage />}
    {(page === 'admin' || page === 'admin/comunidade') && ((auth.loading || auth.adminLoading) ? <p role="status">Verificando acesso administrativo…</p> : auth.session && auth.admin && !auth.recovery ? <AdminPanel community={page === 'admin/comunidade'} /> : <div className="info" role="alert">Acesso restrito a administradores. <a href="#login">Entrar</a></div>)}
    {(page === 'recuperar-senha' || page === 'nova-senha' || auth.recovery) && <PasswordForm update={page === 'nova-senha' || auth.recovery} />}
    {!['minha-jornada', 'inicio', 'historico', 'leitura', 'login', 'cadastro', 'admin', 'admin/comunidade', 'recuperar-senha', 'nova-senha', 'perfil', 'minhas-leituras', 'privacidade'].includes(page) && !page.startsWith('leitura/') && <div className="info">Página não encontrada. <a href="#inicio">Voltar ao início →</a></div>}
  </main><footer><span className="footer-logo">selah.</span><span>Um momento de pausa. Uma vida com propósito.</span><small>Conteúdo e administração no ambiente local</small></footer></div></div>
}
function SessionContent() {
  const { session } = useAuth()
  return <AppContent key={session?.user.id ?? 'anonymous'} />
}
export default function App() { return <AuthProvider><SessionContent /></AuthProvider> }
