import { useState } from 'react'

// A pintura é carregada uma vez e lembrada fora do componente: ao voltar da partida (ou trocar de fase) o mapa já nasce pintado, sem piscar.
const MAP_SRC = '/assets/3d/logos/mapa-campanha.webp'
let mapArt: boolean | undefined
if (typeof Image !== 'undefined') { const probe = new Image(); probe.onload = () => { mapArt = true }; probe.onerror = () => { mapArt = false }; probe.src = MAP_SRC }
import { BibleReference } from '../../components/BibleReference'
import { acts, isBossPhase, isUnlocked, nextPhase, phases, rewardFor, type PhaseDef } from './campaign'
import type { Fragment } from './repository'

// Posição de cada fase no mapa (viewBox 1000 × 620), em ordem: do Deserto ao Gólgota.
const spots: [number, number][] = [[90, 500], [190, 440], [130, 350], [240, 300], [330, 430], [430, 505], [545, 450], [610, 360], [470, 300], [400, 200], [500, 130], [610, 195], [720, 265], [790, 355], [850, 250], [885, 140]]
// Posições sobre a pintura (mapa-campanha.webp, 2000 × 1125): Deserto à esquerda, Vale das Sombras embaixo no centro, Fortaleza no alto à esquerda, Gólgota no alto à direita.
const artSpots: [number, number][] = [[160, 650], [290, 607], [410, 698], [500, 545], [580, 888], [440, 985], [770, 840], [930, 790], [760, 640], [700, 560], [600, 500], [660, 395], [980, 470], [1100, 560], [1230, 470], [1180, 330]]
const layouts = { svg: { w: 1000, h: 620, pts: spots, line: 1 }, art: { w: 2000, h: 1125, pts: artSpots, line: 1.8 } }
const romans = ['I', 'II', 'III', 'IV']

function RegionMap({ art }: { art: boolean }) {
  const lay = art ? layouts.art : layouts.svg
  const path = lay.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ')
  return <svg className="lg-map-svg" viewBox={`0 0 ${lay.w} ${lay.h}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mapSand"><stop offset="0" stopColor="#c98f4e" stopOpacity=".55" /><stop offset="1" stopColor="#c98f4e" stopOpacity="0" /></radialGradient>
      <radialGradient id="mapVale"><stop offset="0" stopColor="#5b6070" stopOpacity=".5" /><stop offset="1" stopColor="#5b6070" stopOpacity="0" /></radialGradient>
      <radialGradient id="mapFort"><stop offset="0" stopColor="#8a4fc8" stopOpacity=".5" /><stop offset="1" stopColor="#8a4fc8" stopOpacity="0" /></radialGradient>
      <radialGradient id="mapGolgota"><stop offset="0" stopColor="#ff6a2a" stopOpacity=".6" /><stop offset="1" stopColor="#ff6a2a" stopOpacity="0" /></radialGradient>
    </defs>
    <g className="lg-map-terrain">
      <ellipse cx="170" cy="410" rx="230" ry="190" fill="url(#mapSand)" />
      <ellipse cx="470" cy="450" rx="250" ry="170" fill="url(#mapVale)" />
      <ellipse cx="500" cy="190" rx="220" ry="150" fill="url(#mapFort)" />
      <ellipse cx="800" cy="250" rx="210" ry="190" fill="url(#mapGolgota)" />
    </g>
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={path} stroke="rgba(0,0,0,.55)" strokeWidth={9 * lay.line} />
      <path d={path} stroke="rgba(255,150,70,.65)" strokeWidth={3 * lay.line} strokeDasharray={`${2 * lay.line} ${9 * lay.line}`} />
    </g>
    {!art && <path d="M885 70 v54 M862 92 h46" stroke="#ffb36b" strokeWidth="5" strokeLinecap="round" opacity=".9" />}
  </svg>
}

// Pintura atmosférica do mapa (public/assets/3d/logos/mapa-campanha.webp). Só aparece quando o arquivo existe e carrega; sem ele, vale o desenho em SVG.
function MapBackdrop({ onReady }: { onReady: (ready: boolean) => void }) {
  return <img className="lg-map-bg" src={MAP_SRC} alt="" aria-hidden="true" draggable={false} decoding="async" onLoad={() => { mapArt = true; onReady(true) }} onError={() => { mapArt = false; onReady(false) }} />
}

export function Campaign({ fragments, onPlay }: { fragments: Fragment[]; onPlay: (phase: PhaseDef) => void }) {
  const cleared = fragments.map(f => f.phase)
  const suggested = nextPhase(cleared) ?? phases[phases.length - 1]
  const [selectedId, setSelected] = useState(suggested.id)
  const [art, setArt] = useState(mapArt === true)
  const lay = art ? layouts.art : layouts.svg, pts = lay.pts
  const phase = phases.find(p => p.id === selectedId) ?? suggested
  const act = acts[phase.act - 1]
  const done = cleared.includes(phase.id), unlocked = isUnlocked(phase, cleared)
  const reward = rewardFor(phase, done)
  const fragment = fragments.find(f => f.phase === phase.id)
  return <section className="lg-campaign" aria-label="Campanha">
    <div className="lg-map" role="group" aria-label="Mapa da campanha" data-art={art ? 'true' : 'false'}>
      <MapBackdrop onReady={setArt} />
      <RegionMap art={art} />
      {acts.map(a => <span key={a.id} className="lg-act-label" data-act={a.id}><small>ATO {romans[a.id - 1]}</small>{a.name}{phases.filter(p => p.act === a.id).every(p => cleared.includes(p.id)) && <em> · concluído</em>}</span>)}
      {phases.map((p, i) => {
        const isDone = cleared.includes(p.id), open = isUnlocked(p, cleared)
        return <button type="button" key={p.id} className="lg-node" data-state={isDone ? 'done' : open ? 'open' : 'locked'} data-boss={isBossPhase(p)} data-selected={p.id === phase.id}
          style={{ left: `${(pts[i][0] / lay.w) * 100}%`, top: `${(pts[i][1] / lay.h) * 100}%` }} aria-pressed={p.id === phase.id}
          aria-label={`Ato ${romans[p.act - 1]}, fase ${p.index}: ${p.name}${isDone ? ' (concluída)' : open ? '' : ' (bloqueada)'}`} onClick={() => setSelected(p.id)}>{isDone ? '✓' : open ? p.id : '·'}</button>
      })}
    </div>
    <aside className="lg-phase-card" aria-live="polite">
      <header><h2>ATO {romans[phase.act - 1]} • FASE {phase.index}: {phase.name.toUpperCase()}</h2><span className="lg-chip">DIFICULDADE: {phase.difficulty.toUpperCase()}</span></header>
      <p className="lg-phase-brief">{phase.brief}</p>
      <p className="lg-phase-mechanic"><b>{act.name}.</b> {act.mechanic}</p>
      <h3>Objetivos da missão</h3>
      <ul className="lg-objectives">{phase.objectives.map(o => <li key={o.label} data-done={done}><span aria-hidden="true">{done ? '☑' : '☐'}</span>{o.label}</li>)}</ul>
      <h3>Escritura drop card</h3>
      <blockquote className="lg-drop"><strong><BibleReference reference={phase.reference} /></strong><span>{phase.theme}</span>{fragment && <small>Coletado · {fragment.clears} {fragment.clears === 1 ? 'vitória' : 'vitórias'} · melhor tempo {Math.floor(fragment.best_seconds / 60)}:{String(fragment.best_seconds % 60).padStart(2, '0')}</small>}</blockquote>
      <h3>Recompensas</h3>
      <p className="lg-rewards"><b>+{reward.sparks}</b> Centelhas <b>+{reward.xp}</b> XP{done && <small> (repetição rende 30%)</small>}</p>
      <button type="button" className="lg-primary lg-enter" disabled={!unlocked} onClick={() => onPlay(phase)}>{unlocked ? (done ? 'Jogar de novo →' : 'Entrar na arena →') : 'Conclua a fase anterior'}</button>
    </aside>
  </section>
}
