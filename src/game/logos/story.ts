// CORAM // LOGOS, Modo História: gatilhos de arena (tempestades, faróis, torres, zonas e selos), objetivos da fase e as máquinas de estado dos chefes.
// Roda como gancho da simulação (g.hook); o desenho fica em render.ts.
import type { Armadura } from './rules'
import type { BossId, PhaseDef } from './campaign'
import { burst, createGame, damageEnemy, edgePoint, finish, float, hurtPlayer, pushOut, spawnEnemy, type Enemy, type Game, type Rng } from './sim'

export type Tower = { x: number; y: number; hp: number; maxHp: number; cd: number; down: boolean }
export type Seal = { x: number; y: number; hp: number; maxHp: number; broken: boolean }
export type StoryBeacon = { x: number; y: number; lit: boolean; progress: number; order: number }
export type Zone = { x: number; y: number; r: number; warm: number; ttl: number }
export type Telegraph = { x: number; y: number; r: number; t: number; max: number; dmg: number }
export type StoryHud = { label: string; objective: string; boss: { name: string; hp: number; max: number } | null; ultLocked: boolean }
export type StoryState = {
  phase: PhaseDef; done: boolean[]; beacons: StoryBeacon[]; towers: Tower[]; seals: Seal[]; zones: Zone[]; telegraphs: Telegraph[]
  storm: { on: boolean; t: number; dir: number } | null; boss: Enemy | null; spawnCd: number; msgCd: number; novaHandled: boolean; hud: StoryHud; sealsActive: boolean
}

export const bossInfo: Record<BossId, { name: string; hp: number; armor: number; r: number }> = {
  tentador: { name: 'O Tentador', hp: 380, armor: 0, r: 28 },
  sentinela: { name: 'Sentinela das Sombras', hp: 320, armor: 0, r: 30 },
  acusador: { name: 'O Acusador', hp: 450, armor: 160, r: 32 },
  dragao: { name: 'O Dragão', hp: 900, armor: 0, r: 46 },
}
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
const bossPos = { x: 1500, y: 600 }

export function createStoryGame(phase: PhaseDef, armadura: Armadura, rng: Rng = Math.random): Game {
  const g = createGame('historia', armadura, rng)
  const lay = phase.layout
  const hasBeaconGoal = phase.objectives.some(o => o.kind === 'beacons')
  const st: StoryState = {
    phase, done: phase.objectives.map(() => false),
    beacons: (lay.beacons ?? []).map(([x, y], order) => ({ x, y, lit: !hasBeaconGoal, progress: 0, order })),
    towers: (lay.towers ?? []).map(([x, y]) => ({ x, y, hp: 140, maxHp: 140, cd: 1.5, down: false })),
    seals: phase.boss === 'dragao' ? [] : (lay.seals ?? []).map(([x, y]) => ({ x, y, hp: 70, maxHp: 70, broken: false })),
    zones: (lay.zones ?? []).map(([x, y]) => ({ x, y, r: 125, warm: 0, ttl: Infinity })), telegraphs: [],
    storm: phase.hazards.storm ? { on: false, t: 5, dir: 0 } : null, boss: null, spawnCd: 2, msgCd: 0, novaHandled: false, sealsActive: false,
    hud: { label: `ATO ${['I', 'II', 'III', 'IV'][phase.act - 1]} · FASE ${phase.index}`, objective: '', boss: null, ultLocked: false },
  }
  g.story = st; g.hook = update
  if (phase.hazards.dark) { g.fogRadius = 235; g.fogTone = 'dark' }
  g.ultLocked = !!phase.hazards.lockUlt
  // nenhum pilar em cima dos elementos da fase
  const spots = [...st.beacons, ...st.towers, ...st.seals, ...(phase.boss === 'dragao' ? (lay.seals ?? []).map(([x, y]) => ({ x, y })) : []), ...st.zones, bossPos]
  g.obstacles = g.obstacles.filter(o => !spots.some(s => dist(s.x, s.y, o.x, o.y) < o.r + 120))
  if (phase.boss) spawnBoss(g, phase.boss)
  return g
}

function spawnBoss(g: Game, id: BossId) {
  const info = bossInfo[id]
  spawnEnemy(g, 'chefe', bossPos.x, bossPos.y)
  const e = g.enemies[g.enemies.length - 1]
  e.hp = e.maxHp = info.hp; e.armor = e.maxArmor = info.armor; e.r = info.r; e.cd = 99
  e.boss = { id, name: info.name, state: 'appear', t: 0, phase: 1, invuln: true, minHp: id === 'dragao' ? info.hp * 0.66 : 0, finisher: false, cycle: 0, dash: null, hidden: id === 'sentinela' }
  g.story!.boss = e
}

const shoot = (g: Game, x: number, y: number, angle: number, speed = 320, dmg = 11, life = 3) =>
  g.projectiles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, r: 6, dmg, from: 'enemy', life, crit: false, reflected: false })
const toward = (e: Enemy, g: Game) => Math.atan2(g.player.y - e.y, g.player.x - e.x)
const tele = (g: Game, x: number, y: number, r: number, t: number, dmg: number) => g.story!.telegraphs.push({ x, y, r, t, max: t, dmg })
function walk(g: Game, e: Enemy, angle: number, speed: number, dt: number) { e.x += Math.cos(angle) * speed * dt; e.y += Math.sin(angle) * speed * dt; pushOut(g, e, 0); e.x = Math.max(e.r, Math.min(g.w - e.r, e.x)); e.y = Math.max(e.r, Math.min(g.h - e.r, e.y)) }
const enter = (b: NonNullable<Enemy['boss']>, state: string) => { b.state = state; b.t = 0 }

// ---------- chefes: um estado por vez ----------
function tentador(g: Game, e: Enemy, dt: number) {
  const b = e.boss!, p = g.player, d = dist(e.x, e.y, p.x, p.y)
  const clones = g.enemies.filter(c => c.kind === 'clone' && c.hp > 0).length
  if (b.state === 'appear') { b.invuln = true; if (b.t > 1.2) { enter(b, 'clones'); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; spawnEnemy(g, 'clone', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90) } float(g, e.x, e.y - 40, 'MIRAGENS', '#d8b6ff') } }
  else if (b.state === 'clones') {
    b.invuln = true; walk(g, e, toward(e, g) + Math.PI * 0.7, 70, dt)
    if (clones === 0 || b.t > 10) { b.invuln = false; enter(b, 'volley'); float(g, e.x, e.y - 40, 'EXPOSTO', '#ffe08a') }
  } else if (b.state === 'volley') {
    b.invuln = false; const want = 320, a = toward(e, g)
    if (d > want + 40) walk(g, e, a, 90, dt); else if (d < want - 60) walk(g, e, a + Math.PI, 90, dt); else walk(g, e, a + Math.PI / 2, 60, dt)
    e.cd -= dt
    if (e.cd <= 0) { e.cd = 1.5; for (const k of [-0.25, 0, 0.25]) shoot(g, e.x, e.y, a + k, 330, 10) }
    if (b.t > 6) enter(b, 'aim')
  } else if (b.state === 'aim') {
    const a = toward(e, g); b.dash = { dx: Math.cos(a), dy: Math.sin(a), t: 0 }
    if (b.t > 0.8) enter(b, 'charge')
  } else if (b.state === 'charge') {
    const dash = b.dash!; walk(g, e, Math.atan2(dash.dy, dash.dx), 720, dt)
    if (d < e.r + p.r + 4) { hurtPlayer(g, 22); b.t = 0.4 }
    if (b.t > 0.4) { b.dash = null; b.cycle++; enter(b, 'rest') }
  } else if (b.state === 'rest') { if (b.t > 1.4) { if (b.cycle % 2 === 0) { enter(b, 'clones'); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; spawnEnemy(g, 'clone', e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90) } } else enter(b, 'volley') } }
}

function sentinela(g: Game, e: Enemy, dt: number) {
  const b = e.boss!, p = g.player, d = dist(e.x, e.y, p.x, p.y)
  if (b.state === 'appear') { b.invuln = true; if (b.t > 1) enter(b, 'lurk') }
  else if (b.state === 'lurk') {
    b.hidden = e.revealed <= 0; b.invuln = e.revealed <= 0
    const a = Math.atan2(e.y - p.y, e.x - p.x) + dt * 0.9
    const tx = p.x + Math.cos(a) * 250, ty = p.y + Math.sin(a) * 250
    e.x += (tx - e.x) * Math.min(1, dt * 2.5); e.y += (ty - e.y) * Math.min(1, dt * 2.5); e.x = Math.max(e.r, Math.min(g.w - e.r, e.x)); e.y = Math.max(e.r, Math.min(g.h - e.r, e.y))
    if (b.t > 5.5) enter(b, 'strike')
  } else if (b.state === 'strike') {
    b.hidden = false; b.invuln = true
    if (b.t < 0.8) { const a = toward(e, g); b.dash = { dx: Math.cos(a), dy: Math.sin(a), t: 0 } }
    else { walk(g, e, Math.atan2(b.dash!.dy, b.dash!.dx), 680, dt); if (d < e.r + p.r + 4) { hurtPlayer(g, 24); b.t = 1.2 } if (b.t > 1.2) { b.dash = null; e.revealed = 3.5; enter(b, 'exposed') } }
  } else if (b.state === 'exposed') { b.invuln = false; b.hidden = false; if (b.t > 3.5) enter(b, 'lurk') }
}

function acusador(g: Game, e: Enemy, dt: number) {
  const b = e.boss!, st = g.story!, p = g.player, d = dist(e.x, e.y, p.x, p.y)
  if (b.state === 'appear') { b.invuln = true; if (b.t > 1.2) enter(b, 'volley') }
  else if (e.armor <= 0 && b.state !== 'stunned') { b.invuln = false; float(g, e.x, e.y - 40, 'ARMADURA QUEBRADA', '#ffe08a'); enter(b, 'stunned') }
  else if (b.state === 'volley') {
    b.invuln = false; const a = toward(e, g), want = 380
    if (d > want + 40) walk(g, e, a, 80, dt); else if (d < want - 60) walk(g, e, a + Math.PI, 80, dt); else walk(g, e, a + Math.PI / 2, 55, dt)
    e.cd -= dt
    if (e.cd <= 0) { e.cd = 2.3; for (const k of [-0.5, -0.25, 0, 0.25, 0.5]) shoot(g, e.x, e.y, a + k, 300, 11) }
    if (b.t > 6) enter(b, 'accuse')
  } else if (b.state === 'accuse') {
    if (b.t < 0.05) { st.zones.push({ x: p.x, y: p.y, r: 115, warm: 1, ttl: 7 }); float(g, e.x, e.y - 40, 'ACUSAÇÃO', '#c9a8ff'); for (let i = 0; i < 2; i++) { const pt = edgePoint(g, 380); spawnEnemy(g, 'sombra', pt.x, pt.y) } }
    if (b.t > 1.2) enter(b, 'volley')
  } else if (b.state === 'stunned') {
    b.invuln = false; if (b.t > 6.5) { e.armor = e.maxArmor = 90; enter(b, 'volley'); float(g, e.x, e.y - 40, 'REARMADO', '#c9c0d8') }
  }
}

function dragao(g: Game, e: Enemy, dt: number) {
  const b = e.boss!, st = g.story!, p = g.player, max = e.maxHp
  walk(g, e, toward(e, g), 28, dt)
  e.cd -= dt
  const fast = b.phase >= 2
  if (b.state === 'appear') { b.invuln = true; if (b.t > 1.5) { enter(b, 'flame'); b.invuln = false } return }
  if (e.cd <= 0) {
    e.cd = fast ? 2.1 : 2.8
    const n = fast ? 12 : 9, off = g.rng() * 6
    for (let i = 0; i < n; i++) shoot(g, e.x, e.y, off + (i / n) * Math.PI * 2, 250, 9, 2.8)
    tele(g, p.x, p.y, 75, 1.1, 24)
  }
  if (b.phase === 1 && e.hp <= b.minHp + 0.5) {
    b.phase = 2; b.invuln = true; g.ultLocked = true; st.sealsActive = true
    st.seals = (st.phase.layout.seals ?? []).map(([x, y]) => ({ x, y, hp: 70, maxHp: 70, broken: false }))
    float(g, e.x, e.y - 50, 'OS SELOS SE FECHAM', '#ffb36b'); burst(g, e.x, e.y, 40, '#ff8a4a', 320, 0.8)
  } else if (b.phase === 2 && st.seals.length && st.seals.every(s => s.broken)) {
    b.phase = 3; b.invuln = false; b.finisher = true; b.minHp = 1; e.hp = Math.min(e.hp, max * 0.33); g.ultLocked = false; g.player.ult = 100; st.sealsActive = false
    float(g, p.x, p.y - 40, 'USE O CONSUMADO (X)', '#ffe08a')
  } else if (b.phase === 2 && g.time % 5 < dt && g.enemies.length < 9) { const pt = edgePoint(g, 380); spawnEnemy(g, 'sombra', pt.x, pt.y) }
}

function updateBoss(g: Game, e: Enemy, dt: number) {
  const b = e.boss!
  b.t += dt
  if (b.id === 'tentador') tentador(g, e, dt); else if (b.id === 'sentinela') sentinela(g, e, dt); else if (b.id === 'acusador') acusador(g, e, dt); else dragao(g, e, dt)
  if (b.state !== 'appear' && dist(e.x, e.y, g.player.x, g.player.y) < e.r + g.player.r && !b.dash) hurtPlayer(g, 18 * dt)
}

// ---------- fase ----------
function progressOf(g: Game, st: StoryState, kind: PhaseDef['objectives'][number]['kind']) {
  if (kind === 'kills') return g.kills
  if (kind === 'survive') return Math.floor(g.time)
  if (kind === 'beacons') return st.beacons.filter(b => b.lit).length
  if (kind === 'towers') return st.towers.filter(t => t.down).length
  if (kind === 'seals') return st.seals.filter(s => s.broken).length
  return st.boss && st.boss.hp <= 0 ? 1 : 0
}

function update(g: Game, dt: number) {
  const st = g.story!, p = g.player
  st.msgCd = Math.max(0, st.msgCd - dt)

  // tempestades de areia
  if (st.storm) {
    const s = st.storm; s.t -= dt
    if (s.t <= 0) { s.on = !s.on; s.t = s.on ? 10 : 9; if (s.on) { s.dir = g.rng() * Math.PI * 2; float(g, p.x, p.y - 36, 'TEMPESTADE DE AREIA', '#ffd7a0') } }
    g.wind = s.on ? { x: Math.cos(s.dir) * 55, y: Math.sin(s.dir) * 55 } : { x: 0, y: 0 }
    g.fogRadius = s.on ? 245 : 0; g.fogTone = 'sand'
  }

  // faróis: só acendem em ordem; ficam perto por 2 segundos
  const next = st.beacons.find(b => !b.lit)
  for (const b of st.beacons) {
    if (b.lit) continue
    if (dist(p.x, p.y, b.x, b.y) < 80) {
      if (b === next) { b.progress += dt; if (b.progress >= 2) { b.lit = true; burst(g, b.x, b.y, 30, '#ffd27a', 260, 0.8); float(g, b.x, b.y - 40, 'FAROL ACESO', '#ffe08a') } }
      else if (st.msgCd <= 0) { st.msgCd = 1.5; float(g, b.x, b.y - 40, 'ACENDA EM ORDEM', '#c9c0d8') }
    } else b.progress = Math.max(0, b.progress - dt * 1.5)
  }
  g.lights = st.beacons.filter(b => b.lit).map(b => ({ x: b.x, y: b.y, r: 320 }))

  // zonas de silêncio
  for (const z of st.zones) { if (z.warm > 0) z.warm -= dt; else if (Number.isFinite(z.ttl)) z.ttl -= dt }
  st.zones = st.zones.filter(z => z.ttl > 0)
  g.blocked = st.zones.some(z => z.warm <= 0 && dist(p.x, p.y, z.x, z.y) < z.r)

  // torres e selos recebem os feixes de luz (inclusive os dardos devolvidos pelo escudo)
  const hit = (list: { x: number; y: number; hp: number; down?: boolean; broken?: boolean }[], radius: number, onBreak: (t: { x: number; y: number }) => void) => {
    for (const t of list) {
      if (t.down || t.broken) continue
      for (const b of g.projectiles) {
        if (b.from !== 'player' || b.life <= 0 || dist(b.x, b.y, t.x, t.y) > radius + b.r) continue
        t.hp -= b.dmg; b.life = 0; burst(g, b.x, b.y, 4, '#ffd9a8', 140, 0.25)
        if (t.hp <= 0) { if ('down' in t) t.down = true; else t.broken = true; burst(g, t.x, t.y, 30, '#ffcf8a', 280, 0.7); onBreak(t) }
      }
    }
  }
  hit(st.towers, 30, t => float(g, t.x, t.y - 40, 'TORRE DESTRUÍDA', '#ffe08a'))
  hit(st.seals, 34, t => float(g, t.x, t.y - 40, 'SELO QUEBRADO', '#ffe08a'))
  if (g.nova && !st.novaHandled && g.nova.t < 0.1) {
    st.novaHandled = true
    for (const t of st.towers) if (!t.down && dist(t.x, t.y, g.nova.x, g.nova.y) < 480) { t.down = true; burst(g, t.x, t.y, 24, '#ffcf8a', 260, 0.6) }
  } else if (!g.nova) st.novaHandled = false
  for (const t of st.towers) {
    if (t.down) continue
    t.cd -= dt
    if (t.cd <= 0 && dist(t.x, t.y, p.x, p.y) < 780) { t.cd = 2.4; shoot(g, t.x, t.y, Math.atan2(p.y - t.y, p.x - t.x), 300, 12, 3.2) }
  }
  if (st.seals.length && !st.sealsActive && st.phase.hazards.lockUlt && st.seals.every(s => s.broken) && g.ultLocked) { g.ultLocked = false; float(g, p.x, p.y - 40, 'CONSUMADO LIBERADO', '#ffe08a') }

  // avisos de dano em área
  for (const t of st.telegraphs) { t.t -= dt; if (t.t <= 0) { if (dist(p.x, p.y, t.x, t.y) < t.r + p.r) hurtPlayer(g, t.dmg); burst(g, t.x, t.y, 14, '#ff8a4a', 220, 0.5) } }
  st.telegraphs = st.telegraphs.filter(t => t.t > 0)

  // inimigos comuns
  st.spawnCd -= dt
  const sp = st.phase.spawn
  if (st.spawnCd <= 0 && g.enemies.filter(e => !e.boss).length < sp.cap) {
    const total = sp.mix.reduce((a, [, w]) => a + w, 0)
    let r = g.rng() * total, kind = sp.mix[0][0]
    for (const [k, w] of sp.mix) { if (r < w) { kind = k; break } r -= w }
    const pt = edgePoint(g, 420); spawnEnemy(g, kind as never, pt.x, pt.y); st.spawnCd = sp.rate
  }

  if (st.boss && st.boss.hp > 0) updateBoss(g, st.boss, dt)

  // objetivos
  st.done = st.phase.objectives.map(o => progressOf(g, st, o.kind) >= o.target)
  const open = st.phase.objectives.findIndex((_, i) => !st.done[i])
  const o = st.phase.objectives[open]
  const left = o ? (o.kind === 'survive' ? `${o.label} (faltam ${Math.max(0, o.target - Math.floor(g.time))}s)` : o.kind === 'boss' ? o.label : `${o.label} (${Math.min(o.target, progressOf(g, st, o.kind))}/${o.target})`) : 'Fase concluída'
  const b = st.boss
  st.hud = { label: st.hud.label, objective: left, boss: b && b.boss ? { name: b.boss.name, hp: Math.max(0, b.hp), max: b.maxHp } : null, ultLocked: g.ultLocked }
  if (st.done.every(Boolean)) {
    for (const e of g.enemies) if (e.hp > 0 && !e.boss) { e.hp = 0 }
    burst(g, p.x, p.y, 60, '#ffd27a', 420, 0.9)
    finish(g, true)
  }
}

export { damageEnemy }
