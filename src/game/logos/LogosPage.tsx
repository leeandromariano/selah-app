import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { createLogosRepository, type Fragment, type LogosMode, type LogosState } from './repository'
import { Campaign } from './CampaignMap'
import { FragmentsGrid } from './Fragments'
import { acts, nextPhase, phaseById, phases, type PhaseDef } from './campaign'
import { LogosGame } from './LogosGame'
import { Art3D } from './Art3D'
import { levelFromXp, maxPieceLevel, pieceIds, pieces, rankName, statValue, upgradeCost, xpPerLevel, type Piece, type PieceId } from './rules'
import './logos.css'

const defaultRepository = createLogosRepository(supabase)
export type LogosRepository = typeof defaultRepository

type Screen = 'lobby' | 'armadura' | 'campanha' | 'fragmentos' | 'jogo'
const modes: { id: LogosMode; name: string; short: string; description: string; detail: string }[] = [
  { id: 'vigilia', name: 'Vigília na Arena', short: 'Ondas', description: 'Ondas progressivas de inimigos. A cada 3 ondas, escolha uma bênção para a partida.', detail: 'Sobreviva o máximo que puder.' },
  { id: 'farol', name: 'Protocolo Farol', short: '90 segundos', description: 'Avance na névoa, crave o Farol de Luz no altar e defenda por 35 segundos até a detonação purificadora.', detail: 'Partida de 90s para plantar.' },
]
const fmt = (piece: Piece, index: number, level: number) => { const s = piece.stats[index], v = statValue(piece, index, level); return s.unit === '%' ? `+${v}%` : s.unit === 's' ? `${v}s` : String(v) }
// O id interno da Couraça é 'coraca'; o arquivo de arte segue o nome com cedilha trocado por 'u' do pedido original.
const pieceArt = (id: PieceId) => (id === 'coraca' ? 'armadura-couraca' : `armadura-${id}`)
const coarse = () => typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches === true

// Silhueta do Portador da Luz (arte própria em SVG enquanto a arte final não chega).
function Bearer({ sword = true }: { sword?: boolean }) {
  return <svg className="lg-bearer" viewBox="0 0 240 360" role="img" aria-label="O Portador da Luz, de capuz e armadura, com a espada em brasa">
    <defs>
      <linearGradient id="lgCape" x1="0" x2="1"><stop offset="0" stopColor="#e9dcc0" /><stop offset="1" stopColor="#b9a47c" /></linearGradient>
      <linearGradient id="lgSteel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d7d2cb" /><stop offset="1" stopColor="#7c7570" /></linearGradient>
      <linearGradient id="lgBlade" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ff7a2e" /><stop offset="1" stopColor="#ffe4b0" /></linearGradient>
      <filter id="lgGlow"><feGaussianBlur stdDeviation="4" /></filter>
    </defs>
    <ellipse cx="120" cy="340" rx="86" ry="16" fill="#ff7a2e" opacity=".28" />
    <path d="M70 120 Q40 230 62 330 L178 330 Q204 230 170 120 Q120 90 70 120Z" fill="url(#lgCape)" />
    <path d="M92 130 L148 130 L158 250 L82 250Z" fill="url(#lgSteel)" />
    <path d="M120 150 L134 176 L120 202 L106 176Z" fill="#ff9a4a" opacity=".9" />
    <path d="M86 250 L154 250 L162 330 L78 330Z" fill="#3a2d24" />
    <rect x="84" y="244" width="72" height="12" rx="4" fill="#6b4a2c" />
    <path d="M120 40 Q78 52 80 104 Q92 132 120 134 Q148 132 160 104 Q162 52 120 40Z" fill="#d8cbb0" />
    <path d="M120 64 Q100 70 100 100 Q110 118 120 118 Q130 118 140 100 Q140 70 120 64Z" fill="#3a2a1c" />
    <circle cx="111" cy="94" r="2.4" fill="#ffb15a" /><circle cx="129" cy="94" r="2.4" fill="#ffb15a" />
    {sword && <g>
      <path d="M170 220 L232 40 L240 44 L182 226Z" fill="#ff7a2e" opacity=".6" filter="url(#lgGlow)" />
      <path d="M172 222 L231 46 L236 48 L180 226Z" fill="url(#lgBlade)" />
      <rect x="160" y="214" width="30" height="7" rx="3" transform="rotate(-18 175 217)" fill="#c89b5a" />
    </g>}
  </svg>
}

function useLogos(repo: LogosRepository) {
  const [state, setState] = useState<LogosState | null>(null)
  const [fragments, setFragments] = useState<Fragment[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    repo.lobby().then(s => { if (active) setState(s) }).catch((e: Error) => { if (active) setError(e.message) })
    Promise.resolve().then(() => repo.campaign()).then(list => { if (active) setFragments(list) }).catch(() => undefined)
    return () => { active = false }
  }, [repo])
  return { state, setState, fragments, setFragments, error }
}

function Arsenal({ state, repo, onChange }: { state: LogosState; repo: LogosRepository; onChange: (s: LogosState) => void }) {
  const [selected, setSelected] = useState<PieceId>('espada')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const piece = pieces[selected], level = state.armadura[selected], cost = upgradeCost(level)
  const enough = cost !== null && state.sparks >= cost
  const upgrade = async () => {
    setBusy(true); setMessage('')
    try { onChange(await repo.upgrade(selected)); setMessage(`${piece.name} agora está no nível ${level + 1}.`) } catch (e) { setMessage(e instanceof Error ? e.message : 'Não foi possível aprimorar agora.') } finally { setBusy(false) }
  }
  const slot = (id: PieceId) => <button type="button" key={id} className="lg-piece" data-selected={id === selected} aria-pressed={id === selected} onClick={() => { setSelected(id); setMessage('') }}>
    <Art3D name={pieceArt(id)} fallback={<span className="lg-piece-icon" data-piece={id} aria-hidden="true" />} /><strong>{pieces[id].name}</strong><small>Nível {state.armadura[id]}</small></button>
  return <section className="lg-arsenal" aria-label="Armadura e Arsenal">
    <div className="lg-arsenal-stage">
      <div className="lg-pieces lg-pieces-left">{pieceIds.slice(0, 3).map(slot)}</div>
      <div className="lg-arsenal-figure"><Art3D name="portador-luz" alt="O Portador da Luz, de capuz e armadura, com a espada em brasa" fallback={<Bearer />} /></div>
      <div className="lg-pieces lg-pieces-right">{(['capacete', 'escudo', 'espada'] as const).map(slot)}</div>
    </div>
    <aside className="lg-detail" aria-live="polite">
      <header><Art3D name={pieceArt(selected)} className="lg-detail-art" fallback={null} /><div><h2>{piece.name}</h2><span>{piece.role} · Nível {level}/{maxPieceLevel}</span></div></header>
      <p>{piece.description}</p>
      <p className="lg-ref">{piece.reference}</p>
      <ul className="lg-stats">{piece.stats.map((s, i) => <li key={s.label}><span>{s.label}</span><b>{fmt(piece, i, level)}{level < maxPieceLevel && <><i aria-hidden="true"> ▸ </i><em>{fmt(piece, i, level + 1)}</em></>}</b>
        <i className="lg-meter" style={{ ['--fill' as string]: level / maxPieceLevel }} aria-hidden="true" /></li>)}</ul>
      {cost === null ? <p className="lg-cost">Peça no nível máximo.</p> : <p className="lg-cost">Custo: <b>{cost}</b> / {state.sparks} centelhas</p>}
      <button type="button" className="lg-primary" disabled={busy || !enough} onClick={upgrade}>{cost === null ? 'Nível máximo' : enough ? `Aprimorar · ${cost} centelhas` : `Faltam ${cost - state.sparks} centelhas`}</button>
      {message && <p className="lg-note" role="status">{message}</p>}
    </aside>
  </section>
}

export default function LogosPage({ repo = defaultRepository }: { repo?: LogosRepository }) {
  const { state, setState, fragments, setFragments, error } = useLogos(repo)
  const [screen, setScreen] = useState<Screen>('lobby')
  const [story, setStory] = useState<PhaseDef | null>(null)
  const [mode, setMode] = useState<LogosMode>('vigilia')
  const [round, setRound] = useState(0)
  const [touch] = useState(coarse)

  if (error) return <div className="lg-page"><div className="info" role="alert">{error} <button className="button secondary" onClick={() => location.reload()}>Tentar novamente</button></div></div>
  if (!state) return <div className="lg-page"><p role="status">Abrindo o CORAM // LOGOS…</p></div>
  const level = levelFromXp(state.xp), xpInLevel = state.xp % xpPerLevel, current = modes.find(m => m.id === mode) ?? modes[0]

  const refreshFragments = () => { repo.campaign().then(setFragments).catch(() => undefined) }
  const play = (phase: PhaseDef | null) => { setStory(phase); setRound(r => r + 1); setScreen('jogo') }
  const cleared = fragments.map(f => f.phase), upNext = nextPhase(cleared)
  if (screen === 'jogo') return <LogosGame key={round} mode={story ? 'historia' : mode} story={story ?? undefined} nextPhase={story ? phaseById(story.id + 1) ?? null : null} armadura={state.armadura} repo={repo} touch={touch}
    onSaved={setState} onPhaseSaved={refreshFragments} onNext={() => { const next = story ? phaseById(story.id + 1) : null; if (next) play(next) }} onExit={() => setScreen(story ? 'campanha' : 'lobby')} onAgain={() => setRound(r => r + 1)} />

  return <div className="lg-page">
    <header className="lg-header">
      <div className="lg-title"><b>CORAM // LOGOS</b><small>{screen === 'armadura' ? 'Armadura & Arsenal // Equipamento' : screen === 'campanha' ? 'Modo História // Campanha' : screen === 'fragmentos' ? 'Fragmentos Bíblicos' : 'The Spiritual Warfare Tactical Arena'}</small></div>
      <nav className="lg-tabs" aria-label="Seções do LOGOS">
        <button type="button" aria-current={screen === 'lobby' ? 'page' : undefined} onClick={() => setScreen('lobby')}>Lobby</button>
        <button type="button" aria-current={screen === 'campanha' ? 'page' : undefined} onClick={() => setScreen('campanha')}>Campanha</button>
        <button type="button" aria-current={screen === 'armadura' ? 'page' : undefined} onClick={() => setScreen('armadura')}>Armadura</button>
      </nav>
      <div className="lg-wallet"><Art3D name="centelha" fallback={<span className="lg-spark" aria-hidden="true" />} /><b>{state.sparks.toLocaleString('pt-BR')}</b><small>Centelhas</small></div>
    </header>

    {screen === 'campanha' ? <>
      <p className="lg-back"><button type="button" onClick={() => setScreen('lobby')}>← Voltar ao lobby</button></p>
      <Campaign fragments={fragments} onPlay={play} />
    </> : screen === 'fragmentos' ? <>
      <p className="lg-back"><button type="button" onClick={() => setScreen('lobby')}>← Voltar ao lobby</button></p>
      <h2 className="lg-section-title">Fragmentos Bíblicos <small>{fragments.length} de {phases.length}</small></h2>
      <FragmentsGrid fragments={fragments} />
    </> : screen === 'armadura' ? <>
      <p className="lg-back"><button type="button" onClick={() => setScreen('lobby')}>← Voltar ao lobby</button></p>
      <Arsenal state={state} repo={repo} onChange={setState} />
    </> : <section className="lg-lobby" aria-label="Lobby">
      <nav className="lg-menu" aria-label="Menu do lobby">
        <button type="button" className="lg-menu-item" onClick={() => setScreen('campanha')}>Modo História</button>
        <button type="button" className="lg-menu-item" data-active="true">Arena Rápida</button>
        <button type="button" className="lg-menu-item" onClick={() => setScreen('armadura')}>Armadura &amp; Arsenal</button>
        <button type="button" className="lg-menu-item" onClick={() => setScreen('fragmentos')}>Fragmentos</button>
        <a className="lg-menu-back" href="#bereia">← Voltar ao Bereia</a>
      </nav>
      <div className="lg-hero"><Art3D name="portador-luz" alt="O Portador da Luz, de capuz e armadura, com a espada em brasa" fallback={<Bearer />} /><span className="lg-hero-tag">Portador da Luz · Pronto</span></div>
      <aside className="lg-side">
        <div className="lg-card lg-rank">
          <div><b>{rankName(level)}</b><small>Nível {level}</small></div>
          <i className="lg-meter" style={{ ['--fill' as string]: xpInLevel / xpPerLevel }} aria-label={`${xpInLevel} de ${xpPerLevel} de experiência`} />
          <p className="lg-balance"><b>{state.sparks.toLocaleString('pt-BR')}</b> Centelhas</p>
        </div>
        <div className="lg-card lg-story-card">
          <small>MODO HISTÓRIA</small>
          <b>{upNext ? `Ato ${['I', 'II', 'III', 'IV'][upNext.act - 1]}: ${acts[upNext.act - 1].name}` : 'Campanha concluída'}</b>
          <span>{upNext ? `Fase ${upNext.index}: ${upNext.name}` : 'Os 16 fragmentos são seus.'}</span>
          <i className="lg-meter" style={{ ['--fill' as string]: fragments.length / phases.length }} aria-label={`${fragments.length} de ${phases.length} fases concluídas`} />
          <button type="button" className="lg-secondary" onClick={() => setScreen('campanha')}>{fragments.length ? 'Continuar a campanha' : 'Começar a campanha'}</button>
        </div>
        <div className="lg-card lg-modes" role="radiogroup" aria-label="Modo de jogo">
          {modes.map(m => <button type="button" key={m.id} role="radio" aria-checked={m.id === mode} data-active={m.id === mode} onClick={() => setMode(m.id)}><strong>{m.name}</strong><small>{m.short}</small></button>)}
          <p>{current.description}</p>
          <p className="lg-record">{mode === 'vigilia' ? `Melhor onda: ${state.vigilia_best_wave} · Partidas: ${state.vigilia_runs}` : `Vitórias: ${state.farol_wins} de ${state.farol_runs}`}</p>
        </div>
        <button type="button" className="lg-play" aria-label={`Jogar ${current.name}`} onClick={() => play(null)}><strong>JOGAR</strong><small>{current.name}</small></button>
        <p className="lg-hint">{touch ? 'Analógico à esquerda, habilidades à direita. A mira é assistida.' : 'WASD move · mouse mira · clique atira · C, Q, E e X são as habilidades.'}</p>
      </aside>
    </section>}
  </div>
}
