// CORAM // LOGOS: a simulação da arena. TypeScript puro, sem React e sem canvas: roda a 60 fps e é testável passo a passo.
import { perksFor, type Armadura, type Perks } from './rules'

export type Mode = 'vigilia' | 'farol'
export type Phase = 'playing' | 'blessing' | 'won' | 'lost'
export type EnemyKind = 'sombra' | 'dardo' | 'fantasma' | 'brutamontes'
export type Rng = () => number

export type Enemy = { id: number; kind: EnemyKind; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; r: number; speed: number; cd: number; armor: number; maxArmor: number; revealed: number; hit: number; wob: number }
export type Projectile = { x: number; y: number; vx: number; vy: number; r: number; dmg: number; from: 'player' | 'enemy'; life: number; crit: boolean; reflected: boolean }
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
export type FloatText = { x: number; y: number; text: string; life: number; color: string }
export type Obstacle = { x: number; y: number; r: number }

export type Input = { moveX: number; moveY: number; aimX: number; aimY: number; fire: boolean; assist: boolean }
export type Want = { c: boolean; q: boolean; e: boolean; x: boolean }
export type BlessingId = 'folego' | 'luz' | 'passos' | 'fe' | 'eco' | 'brasa' | 'lamina'
export const blessings: { id: BlessingId; name: string; description: string }[] = [
  { id: 'folego', name: 'Fôlego', description: '+25 de vida máxima e recupera 30 de vida.' },
  { id: 'luz', name: 'Luz Ardente', description: '+20% de dano nos feixes de luz.' },
  { id: 'passos', name: 'Passos Leves', description: '+12% de velocidade de movimento.' },
  { id: 'fe', name: 'Fé Firme', description: 'O Escudo de Vidro recarrega 30% mais rápido.' },
  { id: 'eco', name: 'Eco do Pulso', description: 'O Pulso de Revelação recarrega 30% mais rápido e empurra mais forte.' },
  { id: 'brasa', name: 'Brasa Viva', description: '+25% de carga do CONSUMADO.' },
  { id: 'lamina', name: 'Lâmina Afiada', description: 'O Dash recarrega 30% mais rápido.' },
]

export const tuning = {
  playerRadius: 14, baseSpeed: 230, baseDamage: 14, fireRate: 4.6, beamSpeed: 760, beamRange: 640, critChance: 0.12, critMult: 2.5,
  cdPulse: 14, cdShield: 16, cdDash: 7, ultMax: 100, ultPassive: 1.2,
  pulseRadius: 250, pulseTime: 0.45, shieldRadius: 64, shieldArc: 1.05, dashDistance: 290, dashTime: 0.18, dashDamage: 46,
  novaRadius: 480, novaTime: 0.9, novaDamage: 140,
  vigilia: { w: 1600, h: 1000, breather: 3, blessingEvery: 3 },
  farol: { w: 2600, h: 1100, limit: 90, plant: 3, defend: 35, beaconHp: 100, vision: 270, wideVision: 720 },
}

export const enemyKinds: Record<EnemyKind, { hp: number; r: number; speed: number; armor: number }> = {
  sombra: { hp: 30, r: 14, speed: 95, armor: 0 },
  dardo: { hp: 22, r: 13, speed: 80, armor: 0 },
  fantasma: { hp: 26, r: 13, speed: 150, armor: 0 },
  brutamontes: { hp: 220, r: 26, speed: 66, armor: 120 },
}

export type Game = {
  mode: Mode; phase: Phase; rng: Rng; perks: Perks
  w: number; h: number; obstacles: Obstacle[]
  time: number; kills: number; score: number
  player: {
    x: number; y: number; r: number; hp: number; maxHp: number; ap: number; maxAp: number; aim: number; lastMove: number; fireCd: number; invuln: number; flash: number
    speed: number; damage: number; dashT: number; dashDx: number; dashDy: number; dashHit: Set<number>
    cd: { c: number; q: number; e: number }; cdMax: { c: number; q: number; e: number }; cdScale: { c: number; q: number; e: number }; ult: number; ultScale: number; shield: number; shieldMax: number
  }
  input: Input; want: Want
  enemies: Enemy[]; projectiles: Projectile[]; particles: Particle[]; floats: FloatText[]
  pulse: { t: number; x: number; y: number } | null; nova: { t: number; x: number; y: number } | null; fogClear: number
  nextId: number
  wave: number; queue: EnemyKind[]; spawnCd: number; breather: number; offer: BlessingId[]
  farol: { stage: 'advance' | 'plant' | 'defend'; timeLeft: number; altar: { x: number; y: number }; plant: number; hp: number; defendLeft: number; detonation: number }
  result: { mode: Mode; wave: number; kills: number; seconds: number; won: boolean } | null
  lastCrit: number; blessingEco: boolean
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function makeObstacles(mode: Mode, w: number, h: number, rng: Rng, keepClear: { x: number; y: number }[]): Obstacle[] {
  const list: Obstacle[] = []
  const wanted = mode === 'vigilia' ? 9 : 22
  for (let tries = 0; tries < 400 && list.length < wanted; tries++) {
    const o = { x: 90 + rng() * (w - 180), y: 90 + rng() * (h - 180), r: 26 + rng() * 22 }
    if (keepClear.some(p => dist(p.x, p.y, o.x, o.y) < 210) || list.some(p => dist(p.x, p.y, o.x, o.y) < p.r + o.r + 70)) continue
    list.push(o)
  }
  return list
}

export function createGame(mode: Mode, armadura: Armadura, rng: Rng = Math.random): Game {
  const perks = perksFor(armadura)
  const cfg = mode === 'vigilia' ? tuning.vigilia : tuning.farol
  const start = mode === 'vigilia' ? { x: cfg.w / 2, y: cfg.h / 2 } : { x: 190, y: cfg.h / 2 }
  const altar = { x: cfg.w - 240, y: cfg.h / 2 }
  const g: Game = {
    mode, phase: 'playing', rng, perks, w: cfg.w, h: cfg.h,
    obstacles: makeObstacles(mode, cfg.w, cfg.h, rng, mode === 'vigilia' ? [start] : [start, altar]),
    time: 0, kills: 0, score: 0,
    player: {
      x: start.x, y: start.y, r: tuning.playerRadius, hp: perks.maxHp, maxHp: perks.maxHp, ap: perks.maxAp, maxAp: perks.maxAp, aim: 0, lastMove: 0, fireCd: 0, invuln: 0, flash: 0,
      speed: tuning.baseSpeed * perks.speed, damage: tuning.baseDamage * perks.damage, dashT: 0, dashDx: 0, dashDy: 0, dashHit: new Set(),
      cd: { c: 0, q: 0, e: 0 }, cdMax: { c: tuning.cdPulse, q: tuning.cdShield * perks.shieldCooldown, e: tuning.cdDash }, cdScale: { c: 1, q: 1, e: 1 }, ult: 0, ultScale: perks.ultCharge, shield: 0, shieldMax: perks.shieldSeconds,
    },
    input: { moveX: 0, moveY: 0, aimX: 1, aimY: 0, fire: false, assist: false }, want: { c: false, q: false, e: false, x: false },
    enemies: [], projectiles: [], particles: [], floats: [], pulse: null, nova: null, fogClear: 0, nextId: 1,
    wave: 0, queue: [], spawnCd: 0, breather: 1.2, offer: [],
    farol: { stage: 'advance', timeLeft: tuning.farol.limit, altar, plant: 0, hp: tuning.farol.beaconHp, defendLeft: tuning.farol.defend, detonation: 0 },
    result: null, lastCrit: 0, blessingEco: false,
  }
  return g
}

// ---------- utilitários ----------
function burst(g: Game, x: number, y: number, n: number, color: string, speed = 160, life = 0.5, size = 2.4) {
  for (let i = 0; i < n && g.particles.length < 420; i++) {
    const a = g.rng() * Math.PI * 2, s = speed * (0.3 + g.rng() * 0.9)
    g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + g.rng() * 0.6), max: life, size: size * (0.6 + g.rng()), color })
  }
}
const float = (g: Game, x: number, y: number, text: string, color = '#ffd9a8') => { if (g.floats.length < 40) g.floats.push({ x, y: y - 18, text, life: 0.9, color }) }

function pushOut(g: Game, e: { x: number; y: number }, r: number) {
  for (const o of g.obstacles) {
    const d = dist(e.x, e.y, o.x, o.y), min = o.r + r
    if (d < min && d > 0.001) { e.x = o.x + ((e.x - o.x) / d) * min; e.y = o.y + ((e.y - o.y) / d) * min }
  }
  e.x = clamp(e.x, r, g.w - r); e.y = clamp(e.y, r, g.h - r)
}

export const isVisible = (g: Game, e: Enemy) => e.kind !== 'fantasma' || e.revealed > 0 || dist(e.x, e.y, g.player.x, g.player.y) < 120

function spawnEnemy(g: Game, kind: EnemyKind, x: number, y: number) {
  const k = enemyKinds[kind]
  const scale = g.mode === 'vigilia' ? 1 + Math.min(g.wave, 30) * 0.04 : 1
  g.enemies.push({ id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp: k.hp * scale, maxHp: k.hp * scale, r: k.r, speed: k.speed * (0.9 + g.rng() * 0.2), cd: 0.6 + g.rng() * 1.2, armor: k.armor, maxArmor: k.armor, revealed: 0, hit: 0, wob: g.rng() * 6 })
}

function edgePoint(g: Game, minFromPlayer: number, area?: { x0: number; x1: number }) {
  for (let i = 0; i < 12; i++) {
    const side = Math.floor(g.rng() * 4)
    let x = side === 0 ? 30 : side === 1 ? g.w - 30 : 30 + g.rng() * (g.w - 60)
    const y = side === 2 ? 30 : side === 3 ? g.h - 30 : 30 + g.rng() * (g.h - 60)
    if (area) x = clamp(x, area.x0, area.x1)
    if (dist(x, y, g.player.x, g.player.y) >= minFromPlayer) return { x, y }
  }
  return { x: g.player.x > g.w / 2 ? 40 : g.w - 40, y: g.rng() * g.h }
}

// ---------- dano ----------
export function hurtPlayer(g: Game, amount: number) {
  const p = g.player
  if (p.invuln > 0 || g.phase !== 'playing' || amount <= 0) return
  const toAp = Math.min(p.ap, amount); p.ap -= toAp
  p.hp = Math.max(0, p.hp - (amount - toAp)); p.flash = 0.18
}

function chargeUlt(g: Game, amount: number) { g.player.ult = Math.min(tuning.ultMax, g.player.ult + amount * g.player.ultScale) }

export function damageEnemy(g: Game, e: Enemy, amount: number, crit = false): boolean {
  if (e.hp <= 0) return false
  let dmg = amount
  if (e.armor > 0) { e.armor = Math.max(0, e.armor - amount); dmg = amount * 0.25 }
  e.hp -= dmg; e.hit = 0.12
  chargeUlt(g, dmg * 0.025)
  if (crit) { g.lastCrit = g.time; float(g, e.x, e.y, '+' + Math.round(dmg) + ' CRÍTICO', '#ffb347') }
  if (e.hp > 0) return false
  g.kills++; g.score += e.kind === 'brutamontes' ? 150 : 25
  chargeUlt(g, e.kind === 'brutamontes' ? 25 : 6)
  burst(g, e.x, e.y, e.kind === 'brutamontes' ? 34 : 14, '#ffcf8a', 220, 0.6)
  if (g.mode === 'vigilia') float(g, e.x, e.y, '+25 PURIFICAÇÃO', '#ffe9c4')
  return true
}

// ---------- habilidades ----------
function aimVector(g: Game) { return { x: Math.cos(g.player.aim), y: Math.sin(g.player.aim) } }

function castPulse(g: Game) {
  const p = g.player
  g.pulse = { t: 0, x: p.x, y: p.y }; g.fogClear = 3.2
  const push = g.blessingEco ? 220 : 150
  for (const e of g.enemies) {
    const d = dist(e.x, e.y, p.x, p.y)
    if (d > tuning.pulseRadius + e.r) continue
    e.revealed = 5
    const n = Math.max(d, 1)
    e.vx += ((e.x - p.x) / n) * push * 4; e.vy += ((e.y - p.y) / n) * push * 4
    damageEnemy(g, e, 8)
  }
  burst(g, p.x, p.y, 24, '#ffd9a8', 260, 0.5)
}

function castShield(g: Game) { g.player.shield = g.player.shieldMax }

function castDash(g: Game) {
  const p = g.player
  const mv = Math.hypot(g.input.moveX, g.input.moveY)
  const dir = g.input.assist && mv > 0.2 ? Math.atan2(g.input.moveY, g.input.moveX) : p.aim
  const speed = (tuning.dashDistance * g.perks.dashSpeed) / tuning.dashTime
  p.dashT = tuning.dashTime; p.dashDx = Math.cos(dir) * speed; p.dashDy = Math.sin(dir) * speed; p.dashHit.clear(); p.invuln = Math.max(p.invuln, tuning.dashTime + 0.05)
  burst(g, p.x, p.y, 10, '#ffbf7a', 200, 0.3)
}

function castNova(g: Game) {
  const p = g.player
  p.ult = 0; p.invuln = Math.max(p.invuln, 1)
  g.nova = { t: 0, x: p.x, y: p.y }; g.projectiles = g.projectiles.filter(b => b.from === 'player')
  for (const e of g.enemies) {
    if (dist(e.x, e.y, p.x, p.y) > tuning.novaRadius + e.r) continue
    e.armor = 0; e.revealed = 3
    damageEnemy(g, e, tuning.novaDamage * g.perks.damage, false)
  }
  burst(g, p.x, p.y, 70, '#ffd27a', 420, 0.9, 3)
  float(g, p.x, p.y - 20, 'CONSUMADO', '#ffe08a')
}

function tryAbilities(g: Game) {
  const p = g.player, w = g.want
  if (w.c && p.cd.c <= 0) { p.cd.c = p.cdMax.c * p.cdScale.c; castPulse(g) }
  if (w.q && p.cd.q <= 0) { p.cd.q = p.cdMax.q * p.cdScale.q; castShield(g) }
  if (w.e && p.cd.e <= 0 && p.dashT <= 0) { p.cd.e = p.cdMax.e * p.cdScale.e; castDash(g) }
  if (w.x && p.ult >= tuning.ultMax) castNova(g)
  w.c = w.q = w.e = w.x = false
}

function nearestVisible(g: Game, range: number) {
  const p = g.player; let best: Enemy | null = null, bd = range
  for (const e of g.enemies) { if (e.hp <= 0 || !isVisible(g, e)) continue; const d = dist(e.x, e.y, p.x, p.y); if (d < bd) { bd = d; best = e } }
  return best
}

// ---------- ondas e Farol ----------
function planWave(g: Game) {
  const n = g.wave
  const list: EnemyKind[] = []
  const total = 3 + n * 2
  for (let i = 0; i < total; i++) {
    const r = g.rng()
    list.push(n >= 3 && r < 0.2 ? 'fantasma' : n >= 2 && r < 0.45 ? 'dardo' : 'sombra')
  }
  if (n % 5 === 0) for (let i = 0; i < 1 + Math.floor(n / 10); i++) list.push('brutamontes')
  g.queue = list
}

function updateWaves(g: Game, dt: number) {
  if (g.queue.length === 0 && g.enemies.length === 0) {
    if (g.wave > 0 && g.breather === 0) {
      g.breather = tuning.vigilia.breather
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + g.player.maxHp * 0.2)
      if (g.wave % tuning.vigilia.blessingEvery === 0) { offerBlessings(g); return }
    }
    g.breather -= dt
    if (g.breather <= 0) { g.breather = 0; g.wave++; planWave(g); g.spawnCd = 0 }
    return
  }
  g.spawnCd -= dt
  if (g.queue.length && g.spawnCd <= 0 && g.enemies.length < 26) {
    const kind = g.queue.shift() as EnemyKind, pt = edgePoint(g, 420)
    spawnEnemy(g, kind, pt.x, pt.y); g.spawnCd = 0.5
  }
}

function offerBlessings(g: Game) {
  const pool = [...blessings.map(b => b.id)]
  g.offer = []
  while (g.offer.length < 3 && pool.length) g.offer.push(pool.splice(Math.floor(g.rng() * pool.length), 1)[0])
  g.phase = 'blessing'
}

export function applyBlessing(g: Game, id: BlessingId) {
  if (g.phase !== 'blessing' || !g.offer.includes(id)) return
  const p = g.player
  if (id === 'folego') { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 55) }
  else if (id === 'luz') p.damage *= 1.2
  else if (id === 'passos') p.speed *= 1.12
  else if (id === 'fe') p.cdScale.q *= 0.7
  else if (id === 'eco') { p.cdScale.c *= 0.7; g.blessingEco = true }
  else if (id === 'brasa') p.ultScale *= 1.25
  else if (id === 'lamina') p.cdScale.e *= 0.7
  g.offer = []; g.phase = 'playing'
}

function updateFarol(g: Game, dt: number) {
  const f = g.farol, p = g.player
  const aliveCap = f.stage === 'defend' ? 24 : 13
  const rate = f.stage === 'defend' ? 0.7 : 1.7
  g.spawnCd -= dt
  if (g.spawnCd <= 0 && g.enemies.length < aliveCap) {
    const area = f.stage === 'defend' ? { x0: f.altar.x - 760, x1: g.w - 30 } : { x0: Math.max(30, p.x + 340), x1: Math.min(g.w - 30, p.x + 900) }
    const pt = edgePoint(g, 380, area)
    const r = g.rng()
    spawnEnemy(g, r < 0.22 ? 'dardo' : r < 0.36 ? 'fantasma' : 'sombra', pt.x, pt.y)
    if (f.stage === 'defend' && g.rng() < 0.06) spawnEnemy(g, 'brutamontes', pt.x, pt.y)
    g.spawnCd = rate
  }
  if (f.stage === 'advance' || f.stage === 'plant') {
    f.timeLeft -= dt
    if (dist(p.x, p.y, f.altar.x, f.altar.y) < 95) { f.stage = 'plant'; f.plant += dt; if (f.plant >= tuning.farol.plant) { f.stage = 'defend'; burst(g, f.altar.x, f.altar.y, 40, '#ffd27a', 300, 0.8); float(g, f.altar.x, f.altar.y - 40, 'FAROL CRAVADO', '#ffe08a') } }
    else { f.stage = 'advance'; f.plant = Math.max(0, f.plant - dt * 1.5) }
    if (f.timeLeft <= 0) finish(g, false)
  } else {
    f.defendLeft -= dt
    if (f.hp <= 0) finish(g, false)
    else if (f.defendLeft <= 0) { f.detonation = 0.001; g.nova = { t: 0, x: f.altar.x, y: f.altar.y }; for (const e of g.enemies) { e.hp = 0; g.kills++ } burst(g, f.altar.x, f.altar.y, 80, '#ffd27a', 480, 1, 3.2); finish(g, true) }
  }
}

function finish(g: Game, won: boolean) {
  if (g.phase === 'won' || g.phase === 'lost') return
  g.phase = won ? 'won' : 'lost'
  g.result = { mode: g.mode, wave: g.mode === 'vigilia' ? Math.max(0, g.wave - (won ? 0 : 1)) : 0, kills: g.kills, seconds: g.time, won }
}

// Pede uma habilidade para o próximo passo da simulação (teclado ou botão na tela).
export function queueAbility(g: Game, k: keyof Want) { g.want[k] = true }

// Desistir: encerra a partida como derrota (o resultado ainda conta para o prêmio).
export function forfeit(g: Game) { finish(g, false) }

// ---------- passo da simulação ----------
export function update(g: Game, dtIn: number) {
  if (g.phase !== 'playing') return
  let left = Math.min(dtIn, 0.1)
  while (left > 0 && g.phase === 'playing') { const dt = Math.min(left, 1 / 60); step(g, dt); left -= dt }
}

function step(g: Game, dt: number) {
  const p = g.player
  g.time += dt
  // tempo de recarga e efeitos
  for (const k of ['c', 'q', 'e'] as const) p.cd[k] = Math.max(0, p.cd[k] - dt)
  p.invuln = Math.max(0, p.invuln - dt); p.flash = Math.max(0, p.flash - dt); p.shield = Math.max(0, p.shield - dt); g.fogClear = Math.max(0, g.fogClear - dt)
  chargeUlt(g, tuning.ultPassive * dt)
  if (g.pulse) { g.pulse.t += dt; if (g.pulse.t >= tuning.pulseTime) g.pulse = null }
  if (g.nova) { g.nova.t += dt; if (g.nova.t >= tuning.novaTime) g.nova = null }

  // mira e disparo (assistida no celular)
  const target = g.input.assist ? nearestVisible(g, 520) : null
  const mv = Math.hypot(g.input.moveX, g.input.moveY)
  if (mv > 0.15) p.lastMove = Math.atan2(g.input.moveY, g.input.moveX)
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x)
  else if (g.input.assist) p.aim = p.lastMove
  else if (Math.hypot(g.input.aimX, g.input.aimY) > 0.001) p.aim = Math.atan2(g.input.aimY, g.input.aimX)

  tryAbilities(g)

  // movimento
  if (p.dashT > 0) {
    p.dashT -= dt; p.x += p.dashDx * dt; p.y += p.dashDy * dt
    for (const e of g.enemies) {
      if (e.hp <= 0 || p.dashHit.has(e.id) || dist(e.x, e.y, p.x, p.y) > e.r + p.r + 16) continue
      p.dashHit.add(e.id)
      if (damageEnemy(g, e, tuning.dashDamage * g.perks.damage * 2, true)) { p.cd.e = 0; float(g, p.x, p.y - 30, 'RESET', '#fff0c8') }
    }
  } else if (mv > 0.01) {
    const s = p.speed * Math.min(1, mv) / mv
    p.x += g.input.moveX * s * dt; p.y += g.input.moveY * s * dt
  }
  pushOut(g, p, p.r)

  // disparo
  p.fireCd -= dt
  const wantsFire = g.input.assist ? !!target : g.input.fire
  if (wantsFire && p.fireCd <= 0 && p.dashT <= 0) {
    p.fireCd = 1 / tuning.fireRate
    const crit = g.rng() < tuning.critChance, v = aimVector(g)
    g.projectiles.push({ x: p.x + v.x * 18, y: p.y + v.y * 18, vx: v.x * tuning.beamSpeed, vy: v.y * tuning.beamSpeed, r: 5, dmg: p.damage * (crit ? tuning.critMult : 1), from: 'player', life: tuning.beamRange / tuning.beamSpeed, crit, reflected: false })
  }

  if (g.mode === 'vigilia') updateWaves(g, dt); else updateFarol(g, dt)
  if (g.phase !== 'playing') return

  updateEnemies(g, dt)
  updateProjectiles(g, dt)
  g.enemies = g.enemies.filter(e => e.hp > 0)
  for (const q of g.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt }
  g.particles = g.particles.filter(q => q.life > 0)
  for (const f of g.floats) { f.y -= 26 * dt; f.life -= dt }
  g.floats = g.floats.filter(f => f.life > 0)
  if (p.hp <= 0) finish(g, false)
}

function updateEnemies(g: Game, dt: number) {
  const p = g.player, f = g.farol
  const beacon = g.mode === 'farol' && f.stage === 'defend' && f.hp > 0 ? f.altar : null
  for (const e of g.enemies) {
    e.hit = Math.max(0, e.hit - dt); e.revealed = Math.max(0, e.revealed - dt); e.cd -= dt; e.wob += dt * 4
    // alvo: o Farol, se estiver perto, senão o jogador
    const toBeacon = beacon ? dist(e.x, e.y, beacon.x, beacon.y) : Infinity
    const toPlayer = dist(e.x, e.y, p.x, p.y)
    const tgt = beacon && toBeacon < Math.max(520, toPlayer * 1.1) ? beacon : p
    const dx = tgt.x - e.x, dy = tgt.y - e.y, d = Math.max(Math.hypot(dx, dy), 0.001)
    let mx = 0, my = 0
    if (e.kind === 'dardo') {
      const want = 330
      if (d > want + 40) { mx = dx / d; my = dy / d } else if (d < want - 60) { mx = -dx / d; my = -dy / d } else { mx = (-dy / d) * Math.sin(e.wob * 0.5); my = (dx / d) * Math.sin(e.wob * 0.5) }
      if (e.cd <= 0 && d < 560) { e.cd = 1.8; g.projectiles.push({ x: e.x, y: e.y, vx: (dx / d) * 330, vy: (dy / d) * 330, r: 6, dmg: 10, from: 'enemy', life: 2.4, crit: false, reflected: false }) }
    } else {
      mx = dx / d; my = dy / d
      if (e.kind === 'brutamontes' && e.cd <= 0) {
        e.cd = 3.2
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.wob; g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 6, dmg: 8, from: 'enemy', life: 2.2, crit: false, reflected: false }) }
      }
    }
    e.x += (mx * e.speed + e.vx) * dt; e.y += (my * e.speed + e.vy) * dt
    e.vx *= 0.9; e.vy *= 0.9
    pushOut(g, e, e.r)
    // contato
    const reach = e.r + (tgt === p ? p.r : 34)
    if (e.kind !== 'dardo' && dist(e.x, e.y, tgt.x, tgt.y) < reach + 2) {
      const dps = e.kind === 'brutamontes' ? 24 : e.kind === 'fantasma' ? 12 : 9
      if (tgt === p) {
        if (p.shield > 0 && inShieldArc(g, e.x, e.y, tuning.shieldRadius + e.r)) { e.vx -= (dx / d) * 260; e.vy -= (dy / d) * 260 } else hurtPlayer(g, dps * dt)
      } else f.hp = Math.max(0, f.hp - dps * 0.5 * dt)
    }
  }
}

function inShieldArc(g: Game, x: number, y: number, radius: number) {
  const p = g.player
  if (dist(x, y, p.x, p.y) > radius) return false
  let da = Math.atan2(y - p.y, x - p.x) - p.aim
  while (da > Math.PI) da -= Math.PI * 2
  while (da < -Math.PI) da += Math.PI * 2
  return Math.abs(da) <= tuning.shieldArc
}

function updateProjectiles(g: Game, dt: number) {
  const p = g.player, f = g.farol
  const beacon = g.mode === 'farol' && f.stage === 'defend' && f.hp > 0
  for (const b of g.projectiles) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt
    if (b.x < 0 || b.y < 0 || b.x > g.w || b.y > g.h || g.obstacles.some(o => dist(o.x, o.y, b.x, b.y) < o.r)) { b.life = 0; continue }
    if (b.from === 'enemy') {
      if (p.shield > 0 && inShieldArc(g, b.x, b.y, tuning.shieldRadius + 6) && dist(b.x, b.y, p.x, p.y) > tuning.shieldRadius - 14) {
        b.from = 'player'; b.reflected = true; b.vx *= -1.25; b.vy *= -1.25; b.dmg *= 2.2; b.life = 1.6
        burst(g, b.x, b.y, 6, '#ffd9a8', 140, 0.3); chargeUlt(g, 3); continue
      }
      if (dist(b.x, b.y, p.x, p.y) < b.r + p.r) { hurtPlayer(g, b.dmg); b.life = 0; burst(g, b.x, b.y, 5, '#ff8a5c', 120, 0.3) }
      else if (beacon && dist(b.x, b.y, f.altar.x, f.altar.y) < b.r + 34) { f.hp = Math.max(0, f.hp - b.dmg * 0.6); b.life = 0 }
    } else {
      for (const e of g.enemies) {
        if (e.hp <= 0 || dist(e.x, e.y, b.x, b.y) > e.r + b.r) continue
        damageEnemy(g, e, b.dmg, b.crit || b.reflected); b.life = 0; burst(g, b.x, b.y, 4, '#ffd9a8', 140, 0.25); break
      }
    }
  }
  g.projectiles = g.projectiles.filter(b => b.life > 0)
}

// ---------- leitura para o HUD ----------
export type Hud = {
  hp: number; maxHp: number; ap: number; maxAp: number; time: number; kills: number; score: number; wave: number
  cd: { c: number; q: number; e: number }; cdMax: { c: number; q: number; e: number }; ult: number; shield: number
  mode: Mode; stage: 'advance' | 'plant' | 'defend' | null; timeLeft: number; plant: number; beaconHp: number; defendLeft: number; enemies: number; hurt: boolean
}
export function hudSnapshot(g: Game): Hud {
  const p = g.player, f = g.farol
  return {
    hp: Math.ceil(p.hp), maxHp: p.maxHp, ap: Math.ceil(p.ap), maxAp: p.maxAp, time: g.time, kills: g.kills, score: g.score, wave: g.wave,
    cd: { ...p.cd }, cdMax: { c: p.cdMax.c * p.cdScale.c, q: p.cdMax.q * p.cdScale.q, e: p.cdMax.e * p.cdScale.e }, ult: Math.floor(p.ult), shield: p.shield,
    mode: g.mode, stage: g.mode === 'farol' ? f.stage : null, timeLeft: Math.max(0, f.timeLeft), plant: f.plant, beaconHp: Math.ceil(f.hp), defendLeft: Math.max(0, f.defendLeft), enemies: g.enemies.length + g.queue.length, hurt: p.flash > 0,
  }
}
