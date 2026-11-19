import { useEffect, useRef, useState } from 'react'
import type { Armadura } from './rules'
import type { LogosMode, LogosState, PhaseReport, PhaseResult, RunReward } from './repository'
import type { PhaseDef } from './campaign'
import { createStoryGame } from './story'
import { StoryResult } from './StoryResult'
import { applyBlessing, blessings, createGame, forfeit, hudSnapshot, queueAbility, update, type BlessingId, type Hud, type Phase } from './sim'
import { makeView, render, renderMinimap, type View } from './render'
import { Art3D } from './Art3D'
import { bindDesktop, bindJoystick, type Joystick } from './input'

type Saver = {
  finishRun: (report: { mode: LogosMode; wave: number; kills: number; seconds: number; won: boolean }) => Promise<LogosState & { reward: RunReward }>
  finishPhase?: (report: PhaseReport) => Promise<PhaseResult>
}
export type LogosGameProps = {
  mode: LogosMode | 'historia'; armadura: Armadura; repo: Saver; touch: boolean; onExit: () => void; onSaved?: (state: LogosState) => void; onAgain?: () => void
  story?: PhaseDef; nextPhase?: PhaseDef | null; onNext?: () => void; onPhaseSaved?: (result: PhaseResult) => void
}

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const skills = [
  { key: 'c', label: 'C', name: 'Pulso de Revelação' },
  { key: 'q', label: 'Q', name: 'Escudo da Fé' },
  { key: 'e', label: 'E', name: 'Espada do Espírito' },
  { key: 'x', label: 'X', name: 'Consumado' },
] as const

// Atualiza o HUD direto no DOM, sem passar pelo estado do React (o loop roda a 60 fps).
function paintHud(els: Map<string, HTMLElement>, h: Hud) {
  const set = (k: string, text: string) => { const el = els.get(k); if (el && el.textContent !== text) el.textContent = text }
  const bar = (k: string, ratio: number) => { const el = els.get(k); if (el) el.style.setProperty('--fill', String(Math.max(0, Math.min(1, ratio)))) }
  set('hp', `HP: ${h.hp}`); bar('hp-bar', h.hp / h.maxHp)
  set('ap', `AP: ${h.ap}`); bar('ap-bar', h.ap / h.maxAp)
  for (const k of ['c', 'q', 'e'] as const) {
    const left = h.cd[k], el = els.get(`skill-${k}`)
    if (el) { el.style.setProperty('--cd', String(Math.min(1, left / h.cdMax[k]))); el.dataset.ready = left <= 0 ? 'true' : 'false'; if (k === 'q') el.dataset.active = h.shield > 0 ? 'true' : 'false' }
    set(`cd-${k}`, left > 0 ? String(Math.ceil(left)) : k === 'e' ? 'PRONTO' : '')
  }
  const x = els.get('skill-x'); if (x) { x.style.setProperty('--cd', String(1 - h.ult / 100)); x.dataset.ready = h.ult >= 100 ? 'true' : 'false' }
  set('cd-x', `${h.ult}%`)
  set('timer', h.mode === 'farol' ? clock(h.stage === 'defend' ? h.defendLeft : h.timeLeft) : clock(h.time))
  if (h.story) {
    set('left', h.story.label); set('right', `${h.kills} ABATES`); set('objective', h.story.objective)
    const boss = els.get('boss'); if (boss) boss.hidden = !h.story.boss
    if (h.story.boss) { set('boss-name', h.story.boss.name); bar('boss-bar', h.story.boss.hp / h.story.boss.max) }
    if (x) x.dataset.locked = h.story.ultLocked ? 'true' : 'false'
  } else if (h.mode === 'vigilia') { set('left', `ONDA ${Math.max(1, h.wave)}`); set('right', `${h.kills} ABATES`); set('objective', h.enemies > 0 ? `${h.enemies} sombras restantes` : 'Respire. A próxima onda vem aí.') }
  else {
    set('left', h.stage === 'defend' ? 'FAROL' : 'AVANCE'); set('right', `${h.kills} ABATES`)
    set('objective', h.stage === 'advance' ? 'Atravesse a névoa até o altar' : h.stage === 'plant' ? `Cravando o Farol… ${Math.min(100, Math.round((h.plant / 3) * 100))}%` : `Defenda o Farol · integridade ${h.beaconHp}%`)
    bar('beacon-bar', h.beaconHp / 100)
  }
  const root = els.get('root'); if (root) { root.dataset.hurt = h.hurt ? 'true' : 'false'; root.dataset.stage = h.stage ?? '' }
}

export function LogosGame({ mode, armadura, repo, touch, onExit, onSaved, onAgain, story, nextPhase = null, onNext, onPhaseSaved }: LogosGameProps) {
  const [game] = useState(() => (story ? createStoryGame(story, armadura) : createGame(mode, armadura)))
  const [savedPhase, setSavedPhase] = useState<PhaseResult | null>(null)
  const [phase, setPhase] = useState<Phase>('playing')
  const [saved, setSaved] = useState<RunReward | null>(null)
  const [saveError, setSaveError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const miniRef = useRef<HTMLCanvasElement>(null)
  const zoneRef = useRef<HTMLDivElement>(null)
  const knobRef = useRef<HTMLDivElement>(null)
  const baseRef = useRef<HTMLDivElement>(null)
  // os avisos de "salvo" mudam de identidade a cada render da página; guardados aqui para não refazer o envio do resultado
  const callbacks = useRef({ onSaved, onPhaseSaved })
  useEffect(() => { callbacks.current = { onSaved, onPhaseSaved } })
  const viewRef = useRef<View>({ w: 1, h: 1, scale: 1, camX: 0, camY: 0 })

  // loop principal: simulação + desenho + HUD, tudo fora do React
  useEffect(() => {
    const root = rootRef.current, canvas = canvasRef.current, mini = miniRef.current
    if (!root || !canvas) return
    const els = new Map<string, HTMLElement>([['root', root]])
    root.querySelectorAll<HTMLElement>('[data-k]').forEach(el => els.set(el.dataset.k as string, el))
    const ctx = canvas.getContext('2d', { alpha: false }), mctx = mini?.getContext('2d') ?? null
    const fogLayer = document.createElement('canvas')
    const resize = () => {
      const box = canvas.parentElement?.getBoundingClientRect(), dpr = Math.min(touch ? 1.5 : 2, window.devicePixelRatio || 1)
      const w = Math.max(1, Math.round((box?.width ?? 800) * dpr)), h = Math.max(1, Math.round((box?.height ?? 450) * dpr))
      canvas.width = fogLayer.width = w; canvas.height = fogLayer.height = h
    }
    resize()
    const observer = typeof ResizeObserver === 'function' && canvas.parentElement ? new ResizeObserver(resize) : null
    if (observer && canvas.parentElement) observer.observe(canvas.parentElement)
    window.addEventListener('resize', resize)
    const unbindDesktop = touch ? () => undefined : bindDesktop(canvas, () => game, () => viewRef.current)
    const unbindStick = touch && zoneRef.current ? bindJoystick(zoneRef.current, () => game, (s: Joystick) => {
      const knob = knobRef.current, base = baseRef.current
      if (!knob || !base) return
      base.style.display = s.active ? 'block' : 'none'; knob.style.display = s.active ? 'block' : 'none'
      base.style.transform = `translate(${s.ox}px, ${s.oy}px)`; knob.style.transform = `translate(${s.ox + s.x}px, ${s.oy + s.y}px)`
    }) : () => undefined
    let raf = 0, last = performance.now(), hudAt = 0, lastPhase: Phase = game.phase
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now
      update(game, dt)
      viewRef.current = makeView(game, canvas.width, canvas.height)
      if (ctx) render(ctx, game, viewRef.current, fogLayer)
      if (now - hudAt > 90) { hudAt = now; paintHud(els, hudSnapshot(game)); if (mctx && mini) renderMinimap(mctx, game, mini.width, mini.height) }
      if (game.phase !== lastPhase) { lastPhase = game.phase; setPhase(game.phase) }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); observer?.disconnect(); window.removeEventListener('resize', resize); unbindDesktop(); unbindStick() }
  }, [game, touch])

  // fim de partida: salva o resultado uma única vez
  useEffect(() => {
    if ((phase !== 'won' && phase !== 'lost') || !game.result) return
    let active = true
    const r = game.result
    if (story && repo.finishPhase) {
      repo.finishPhase({ phase: story.id, won: r.won, kills: r.kills, seconds: r.seconds }).then(res => { if (active) { setSavedPhase(res); setSaved(res.reward); callbacks.current.onSaved?.(res); callbacks.current.onPhaseSaved?.(res) } })
        .catch((error: Error) => { if (active) setSaveError(error.message) })
    } else if (r.mode !== 'historia') {
      repo.finishRun({ ...r, mode: r.mode }).then(state => { if (active) { setSaved(state.reward); callbacks.current.onSaved?.(state) } })
        .catch((error: Error) => { if (active) setSaveError(error.message) })
    }
    return () => { active = false }
  }, [phase, game, repo, story])

  // bênçãos também pelas teclas 1, 2 e 3
  useEffect(() => {
    if (phase !== 'blessing') return
    const key = (e: KeyboardEvent) => { const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code); if (i >= 0 && game.offer[i]) { applyBlessing(game, game.offer[i]); setPhase(game.phase) } }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [phase, game])

  const choose = (id: BlessingId) => { applyBlessing(game, id); setPhase(game.phase) }
  const press = (k: 'c' | 'q' | 'e' | 'x') => queueAbility(game, k)
  const result = game.result
  const title = phase === 'won' ? 'VITÓRIA // ESTÁ CONSUMADO' : mode === 'vigilia' ? 'A VIGÍLIA TERMINOU' : 'O FAROL NÃO RESISTIU'

  return <div className="lg-game" ref={rootRef} data-touch={touch ? 'true' : 'false'} data-mode={mode} data-hurt="false">
    <canvas ref={canvasRef} className="lg-canvas" aria-label="Arena do CORAM // LOGOS" role="img" />
    <div className="lg-brand"><b>CORAM // LOGOS</b><small>{story ? story.name : mode === 'vigilia' ? 'Vigília na Arena' : 'Protocolo Farol'}</small></div>
    <button type="button" className="lg-quit" onClick={() => { forfeit(game); setPhase(game.phase) }} disabled={phase !== 'playing'}>Desistir</button>
    <div className="lg-top" aria-live="off">
      <span className="lg-top-side" data-k="left" />
      <div className="lg-top-center"><strong data-k="timer">00:00</strong><span data-k="objective" /></div>
      <span className="lg-top-side" data-k="right" />
      {mode === 'farol' && <i className="lg-bar lg-beacon" data-k="beacon-bar" aria-hidden="true" />}
    </div>
    {story?.boss && <div className="lg-boss" data-k="boss" hidden><b data-k="boss-name" /><i className="lg-bar lg-boss-bar" data-k="boss-bar" /></div>}
    <div className="lg-vitals">
      <span className="lg-portrait" aria-hidden="true" />
      <div><b>Portador da Luz</b>
        <div className="lg-row"><i className="lg-bar lg-hp" data-k="hp-bar" /><span data-k="hp">HP: 100</span></div>
        <div className="lg-row"><i className="lg-bar lg-ap" data-k="ap-bar" /><span data-k="ap">AP: 20</span></div></div>
    </div>
    <div className="lg-skills" role="group" aria-label="Habilidades">
      {skills.map(s => <button type="button" key={s.key} className="lg-skill" data-skill={s.key} data-k={`skill-${s.key}`} data-ready="true" aria-label={`${s.name} (${s.label})`} onPointerDown={e => { e.preventDefault(); press(s.key) }} onClick={e => { if (e.detail === 0) press(s.key) }}>
        <kbd>{s.label}</kbd>{s.key === 'q' || s.key === 'e' ? <Art3D name={s.key === 'q' ? 'armadura-escudo' : 'armadura-espada'} fallback={<span className="lg-skill-icon" aria-hidden="true" />} /> : <span className="lg-skill-icon" aria-hidden="true" />}<em data-k={`cd-${s.key}`} /><small>{s.name}</small></button>)}
    </div>
    <div className="lg-minimap"><canvas ref={miniRef} width={150} height={110} aria-hidden="true" /><small>{story ? 'MAPA DA FASE' : mode === 'vigilia' ? 'ARENA' : 'PROTOCOLO LUZ'}</small></div>
    {touch && <div className="lg-stick-zone" ref={zoneRef}><div className="lg-stick-base" ref={baseRef} /><div className="lg-stick-knob" ref={knobRef} /></div>}

    {phase === 'blessing' && <div className="lg-overlay" role="dialog" aria-modal="true" aria-label="Escolha uma bênção">
      <h2>Escolha uma bênção</h2><p>Dura até o fim desta partida.</p>
      <div className="lg-blessings">{game.offer.map((id, i) => { const b = blessings.find(item => item.id === id)!; return <button type="button" key={id} onClick={() => choose(id)}><kbd>{i + 1}</kbd><strong>{b.name}</strong><span>{b.description}</span></button> })}</div>
    </div>}

    {(phase === 'won' || phase === 'lost') && result && story && <StoryResult phase={story} won={phase === 'won'} kills={result.kills} seconds={result.seconds} saved={savedPhase} error={saveError} nextPhase={nextPhase} onNext={() => onNext?.()} onAgain={() => onAgain?.()} onExit={onExit} />}
    {(phase === 'won' || phase === 'lost') && result && !story && <div className="lg-overlay lg-result" role="dialog" aria-modal="true" aria-label="Resultado da partida" data-won={phase === 'won' ? 'true' : 'false'}>
      <h2>{title}</h2>
      <dl>
        <div><dt>Tempo</dt><dd>{clock(result.seconds)}</dd></div>
        <div><dt>Inimigos purificados</dt><dd>{result.kills}</dd></div>
        {mode === 'vigilia' && <div><dt>Ondas completas</dt><dd>{result.wave}</dd></div>}
        <div className="lg-reward"><dt>Recompensa</dt><dd>{saved ? `+${saved.sparks} Centelhas · +${saved.xp} XP` : saveError ? 'Não foi possível salvar' : 'Salvando…'}</dd></div>
      </dl>
      {saveError && <p className="lg-error" role="alert">{saveError}</p>}
      <div className="lg-actions">{onAgain && <button type="button" className="lg-primary" onClick={onAgain}>Jogar de novo</button>}<button type="button" className="lg-secondary" onClick={onExit}>Voltar ao lobby</button></div>
    </div>}
  </div>
}
