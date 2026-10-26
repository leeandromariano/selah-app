import { useEffect, useState } from 'react'
import { devotionals } from './data/devotionals'
import { AuthForm } from './components/AuthForm'
import { AdminPanel } from './components/AdminPanel'
import { DevotionalCard, Heading, Icon } from './components/UI'
import './App.css'
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/auth'
import { PasswordForm } from './components/PasswordForm'

function route() {
  const hash = location.hash.slice(1)
  return hash.includes('access_token=') || new URLSearchParams(hash).has('error') ? 'login' : hash || 'inicio'
}

function AppContent() {
  const auth = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [page, setPage] = useState(route)
  const [items, setItems] = useState(devotionals)
  const [selected, setSelected] = useState(1)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState('Todos')
  const [read, setRead] = useState<number[]>([])
  useEffect(() => {
    const change = () => { setPage(route()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', change)
    return () => window.removeEventListener('hashchange', change)
  }, [])
  const open = (id: number) => { setSelected(id); location.hash = 'leitura' }
  const current = items.find(d => d.id === selected) ?? items[0]
  const filtered = items.filter(d => (theme === 'Todos' || d.theme === theme) && `${d.title} ${d.reference} ${d.theme}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')))
  return <div className="app"><a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content')?.focus() }}>Ir para o conteúdo</a><aside className="sidebar"><a className="brand" href="#inicio"><Icon name="book" /><span>selah<span className="purple-text">.</span><small>PAUSE. RESPIRE. CREIA.</small></span></a><div className="nav-label">SEU MOMENTO COM DEUS</div><nav aria-label="Navegação principal">{[{ id: 'inicio', name: 'Início', icon: 'home' }, { id: 'historico', name: 'Devocionais', icon: 'book' }, { id: 'admin', name: 'Painel administrativo', icon: 'grid' }].map(n => <a className={page === n.id || (page === 'leitura' && n.id === 'historico') ? 'nav-item active' : 'nav-item'} href={`#${n.id}`} key={n.id} aria-current={page === n.id ? 'page' : undefined}><Icon name={n.icon} />{n.name}{n.id === 'admin' && <b>DEMO</b>}</a>)}</nav><div className="side-quote"><span>“</span><p>Aquietai-vos e sabei<br />que eu sou Deus.</p><small>SALMOS 46:10</small><i /></div><div className="side-bottom"><span /> Um pouco de fé, todos os dias.<small>Feito para cultivar o que importa.</small></div></aside><div className="main-shell"><header><span className="header-note">Um encontro diário com a Palavra.</span><span className="demo-badge">● Ambiente demonstrativo</span>{auth.loading ? <span>Carregando sessão…</span> : auth.session ? <button className="text-link" disabled={loggingOut} onClick={async () => { setLoggingOut(true); await auth.logout(); setLoggingOut(false) }}>Sair</button> : <a href="#login">Entrar ↗</a>}</header><main id="main-content" tabIndex={-1}>{auth.error && <div role="alert" className="info">{auth.error}</div>}
    {page === 'inicio' && <><div className="greeting"><div><div className="eyebrow">☼ UM NOVO DIA, UMA NOVA GRAÇA</div><h1>Que bom ter você aqui<span className="purple-text">.</span></h1><p>Desacelere o mundo lá fora. Fortaleça a fé aí dentro.</p></div><div className="date">23 de outubro<small>sexta-feira · edição demo</small></div></div><section className="hero"><div className="hero-copy"><div className="eyebrow">● DEVOCIONAL DO DIA <span>23 OUT, 2026</span></div><span className="hero-tag">{items[0].theme}</span><h2>{items[0].title}</h2><p>{items[0].summary}</p><div className="hero-meta"><span><Icon name="book" />{items[0].reference}</span><span><Icon name="clock" />{items[0].minutes} min de leitura</span></div><button className="button white" onClick={() => open(items[0].id)}>Começar a leitura <span>→</span></button></div><div className="hero-illustration" aria-hidden="true"><div className="arch"><div className="sun" /><div className="mountain" /><div className="mountain front" /><div className="trail" /></div><span>HÁ PAZ NO CAMINHO.</span><b>✧</b></div></section><section className="encouragement"><span className="heart" aria-hidden="true">♡</span><div><h3>Pequenas pausas. Grandes recomeços.</h3><p>Reserve alguns minutos para cuidar da sua vida com Deus. O seu coração agradece.</p></div><span className="spark" aria-hidden="true">✧</span></section><section><div className="section-heading"><div><div className="eyebrow">CONTINUE SE APROXIMANDO</div><h2>Mais palavras para o seu dia</h2></div><a className="text-link" href="#historico">Ver todos →</a></div><div className="card-grid">{items.slice(1, 4).map(d => <DevotionalCard key={d.id} item={d} onOpen={open} />)}</div>{items.length < 2 && <p className="muted">Novas mensagens aparecerão aqui quando forem adicionadas ao acervo.</p>}</section><section className="join-banner"><div><div className="eyebrow">UMA JORNADA, UM DIA DE CADA VEZ</div><h2>Crie espaço para o que faz bem à alma.</h2><p>Conheça a experiência de cadastro da nossa comunidade.</p></div><a className="button primary" href="#cadastro">Conhecer o cadastro →</a></section></>}
    {page === 'historico' && <><Heading eyebrow="PALAVRAS QUE PERMANECEM" title="Seus próximos momentos de fé" description="Revisite uma mensagem ou encontre a palavra que seu coração precisa hoje." /><label className="search"><span className="sr-only">Buscar devocionais</span><input placeholder="Buscar por título, tema ou referência…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="chips">{['Todos', 'Confiança', 'Paz', 'Esperança', 'Gratidão'].map(t => <button className={theme === t ? 'chip selected' : 'chip'} aria-pressed={theme === t} key={t} onClick={() => setTheme(t)}>{t}</button>)}</div><p className="muted result-note" role="status">{filtered.length} devocionais encontrados · acervo demonstrativo</p><div className="card-grid">{filtered.map(d => <DevotionalCard key={d.id} item={d} onOpen={open} />)}</div>{!filtered.length && <div className="info">Nenhum devocional encontrado. Experimente outro termo ou tema.</div>}</>}
    {page === 'leitura' && <><a className="text-link" href="#historico">← Todos os devocionais</a><article className="reading"><div className="eyebrow">{current.theme} · {current.date}</div><h1>{current.title}</h1><div className="reading-meta">{current.reference} <span>·</span> {current.minutes} min de leitura</div><blockquote><span>“</span>{current.verse}<cite>{current.reference} · Almeida, edição de 1911</cite></blockquote><h2>Uma pausa para a alma</h2>{current.reflection.split('\n\n').map(p => <p key={p}>{p}</p>)}<div className="reflection"><div className="eyebrow">☼ PARA REFLETIR</div><h3>{current.question}</h3><p>Leve essa pergunta com você ao longo do dia.</p></div><button className="button primary" disabled={read.includes(current.id)} onClick={() => setRead([...read, current.id])}>{read.includes(current.id) ? '✓ Leitura concluída nesta sessão' : '✓ Marcar como lido'}</button><small className="session-note">Marcação demonstrativa: apagada ao recarregar a página.</small></article></>}
    {(page === 'cadastro' || page === 'login') && <AuthForm key={page} register={page === 'cadastro'} />}
    {page === 'admin' && (auth.loading ? <p role="status">Carregando sessão…</p> : auth.session && auth.admin && !auth.recovery ? <AdminPanel items={items} onChange={setItems} /> : <div className="info" role="alert">Acesso restrito a administradores. <a href="#login">Entrar</a></div>)}
    {(page === 'recuperar-senha' || page === 'nova-senha' || auth.recovery) && <PasswordForm update={page === 'nova-senha' || auth.recovery} />}
    {!['inicio', 'historico', 'leitura', 'login', 'cadastro', 'admin', 'recuperar-senha', 'nova-senha'].includes(page) && <div className="info">Página não encontrada. <a href="#inicio">Voltar ao início →</a></div>}
  </main><footer><span className="footer-logo">selah.</span><span>Um momento de pausa. Uma vida com propósito.</span><small>Protótipo · Conteúdos e indicadores demonstrativos</small></footer></div></div>
}
function SessionContent() {
  const { session } = useAuth()
  return <AppContent key={session?.user.id ?? 'anonymous'} />
}
export default function App() { return <AuthProvider><SessionContent /></AuthProvider> }
