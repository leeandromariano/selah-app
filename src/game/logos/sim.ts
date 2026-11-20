// CORAM // LOGOS: a simulação da arena. TypeScript puro, sem React e sem canvas: roda a 60 fps e é testável passo a passo.
import { perksFor, type Armadura, type Perks } from './rules'
import type { StoryState } from './story'

export type Mode = 'vigilia' | 'farol' | 'historia'
export type Phase = 'playing' | 'blessing' | 'won' | 'lost'
export type EnemyKind = 'sombra' | 'dardo' | 'fantasma' | 'brutamontes' | 'clone' | 'chefe'
export type Rng = () => number

// Máquina de estados de um chefe (a lógica de cada Ato fica em story.ts).
export type BossState = { id: 'tentador' | 'sentinela' | 'acusador' | 'dragao'; name: string; state: string; t: number; phase: number; invuln: boolean; minHp: number; finisher: boolean; cycle: number; dash: { dx: number; dy: number; t: number } | null; hidden: boolean }
export type Enemy = { boss?: BossState; id: number; kind: EnemyKind; x: number; y: number; vx: number; vy: number; hp: number; maxHp: number; r: number; speed: number; cd: number; armor: number; maxArmor: number; revealed: number; hit: number; wob: number; lunge?: number; walking?: boolean }
export type Projectile = { x: number; y: number; vx: number; vy: number; r: number; dmg: number; from: 'player' | 'enemy'; life: number; crit: boolean; reflected: boolean }
export type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
export type FloatText = { x: number; y: number; text: string; life: number; color: string }
export type Obstacle = { x: number; y: number; r: number }
// Só desenho e sensação de jogo (tremor, arcos de corte, clarões de rebote); nunca entra nas contas de física, colisão ou dano.
export type Slash = { x: number; y: number; a: number; t: number; max: number; heavy: boolean; side?: number; big?: boolean }
export type Flash = { x: number; y: number; a: number; t: number; max: number; purple?: boolean }
// Coluna de luz do CONSUMADO (t começa negativo: atraso até cair) e corpo em brasa que fica no chão depois de um abate.
export type Pillar = { x: number; y: number; t: number; max: number }
export type Corpse = { x: number; y: number; r: number; kind: EnemyKind; a: number; flip: boolean; t: number; max: number }
export type Fx = { shake: number; slashes: Slash[]; flashes: Flash[]; pillars: Pillar[]; corpses: Corpse[] }
export type Swing = { x: number; y: number; a: number; reach: number; arc: number; dmg: number }

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
  swingReach: 120, swingArc: 1.1, swingRate: 2.9, swingMul: 2.2, swingKnock: 260, spearReach: 100, spearWindup: 0.45,
  cdPulse: 14, cdShield: 16, cdDash: 7, ultMax: 100, ultPassive: 1.2,
  pulseRadius: 250, pulseTime: 0.45, shieldRadius: 64, shieldArc: 1.05, dashDistance: 290, dashTime: 0.18, dashDamage: 46,
  novaRadius: 480, novaTime: 0.9, novaDamage: 140,
  vigilia: { w: 1600, h: 1000, breather: 3, blessingEvery: 3 },
  historia: { w: 2000, h: 1200 },
  farol: { w: 2600, h: 1100, limit: 90, plant: 3, defend: 35, beaconHp: 100, vision: 270, wideVision: 720 },
}

export const enemyKinds: Record<EnemyKind, { hp: number; r: number; speed: number; armor: number }> = {
  sombra: { hp: 30, r: 14, speed: 95, armor: 0 },
  dardo: { hp: 22, r: 13, speed: 80, armor: 0 },
  fantasma: { hp: 26, r: 13, speed: 150, armor: 0 },
  brutamontes: { hp: 220, r: 26, speed: 66, armor: 120 },
  clone: { hp: 10, r: 14, speed: 78, armor: 0 },
  chefe: { hp: 300, r: 28, speed: 0, armor: 0 },
}

export type Game = {
  mode: Mode; phase: Phase; rng: Rng; perks: Perks
  w: number; h: number; obstacles: Obstacle[]
  time: number; kills: number; score: number
  player: {
    x: number; y: number; r: number; hp: number; maxHp: number; ap: number; maxAp: number; aim: number; lastMove: number; fireCd: number; invuln: number; flash: number
    speed: number; damage: number; dashT: number; dashDx: number; dashDy: number; dashHit: Set<number>; walk: number; stride: number; facing: number; atk: number; cast: number
    cd: { c: number; q: number; e: number }; cdMax: { c: number; q: number; e: number }; cdScale: { c: number; q: number; e: number }; ult: number; ultScale: number; shield: number; shieldMax: number
  }
  input: Input; want: Want
  enemies: Enemy[]; projectiles: Projectile[]; particles: Particle[]; floats: FloatText[]
  pulse: { t: number; x: number; y: number } | null; nova: { t: number; x: number; y: number } | null; fogClear: number
  nextId: number
  wave: number; queue: EnemyKind[]; spawnCd: number; breather: number; offer: BlessingId[]
  farol: { stage: 'advance' | 'plant' | 'defend'; timeLeft: number; altar: { x: number; y: number }; plant: number; hp: number; defendLeft: number; detonation: number }
  result: { mode: Mode; wave: number; kills: number; seconds: number; won: boolean; phase?: number } | null
  hook: ((g: Game, dt: number) => void) | null; story: StoryState | null
  fogRadius: number; fogTone: 'dark' | 'sand'; lights: { x: number; y: number; r: number }[]; ultLocked: boolean; blocked: boolean; wind: { x: number; y: number }
  lastCrit: number; blessingEco: boolean; fx: Fx; swingNow: Swing | null; swingSide: number
}

const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(ax - bx, ay - by)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function makeObstacles(mode: Mode, w: number, h: number, rng: Rng, keepClear: { x: number; y: number }[]): Obstacle[] {
  const list: Obstacle[] = []
  const wanted = mode === 'vigilia' ? 9 : mode === 'farol' ? 22 : 14
  for (let tries = 0; tries < 400 && list.length < wanted; tries++) {
    const o = { x: 90 + rng() * (w - 180), y: 90 + rng() * (h - 180), r: 26 + rng() * 22 }
    if (keepClear.some(p => dist(p.x, p.y, o.x, o.y) < 210) || list.some(p => dist(p.x, p.y, o.x, o.y) < p.r + o.r + 70)) continue
    list.push(o)
  }
  return list
}

export function createGame(mode: Mode, armadura: Armadura, rng: Rng = Math.random): Game {
  const perks = perksFor(armadura)
  const cfg = mode === 'vigilia' ? tuning.vigilia : mode === 'farol' ? tuning.farol : tuning.historia
  const start = mode === 'vigilia' ? { x: cfg.w / 2, y: cfg.h / 2 } : { x: 190, y: cfg.h / 2 }
  const altar = { x: cfg.w - 240, y: cfg.h / 2 }
  const g: Game = {
    mode, phase: 'playing', rng, perks, w: cfg.w, h: cfg.h,
    obstacles: makeObstacles(mode, cfg.w, cfg.h, rng, mode === 'farol' ? [start, altar] : [start]),
    time: 0, kills: 0, score: 0,
    player: {
      x: start.x, y: start.y, r: tuning.playerRadius, hp: perks.maxHp, maxHp: perks.maxHp, ap: perks.maxAp, maxAp: perks.maxAp, aim: 0, lastMove: 0, fireCd: 0, invuln: 0, flash: 0,
      speed: tuning.baseSpeed * perks.speed, damage: tuning.baseDamage * perks.damage, dashT: 0, dashDx: 0, dashDy: 0, dashHit: new Set(), walk: 0, stride: 0, facing: -1, atk: 9, cast: 0,
      cd: { c: 0, q: 0, e: 0 }, cdMax: { c: tuning.cdPulse, q: tuning.cdShield * perks.shieldCooldown, e: tuning.cdDash }, cdScale: { c: 1, q: 1, e: 1 }, ult: 0, ultScale: perks.ultCharge, shield: 0, shieldMax: perks.shieldSeconds,
    },
    input: { moveX: 0, moveY: 0, aimX: 1, aimY: 0, fire: false, assist: false }, want: { c: false, q: false, e: false, x: false },
    enemies: [], projectiles: [], particles: [], floats: [], pulse: null, nova: null, fogClear: 0, nextId: 1,
    wave: 0, queue: [], spawnCd: 0, breather: 1.2, offer: [],
    farol: { stage: 'advance', timeLeft: tuning.farol.limit, altar, plant: 0, hp: tuning.farol.beaconHp, defendLeft: tuning.farol.defend, detonation: 0 },
    result: null, lastCrit: 0, blessingEco: false, fx: { shake: 0, slashes: [], flashes: [], pillars: [], corpses: [] }, swingNow: null, swingSide: 1,
    hook: null, story: null, fogRadius: mode === 'farol' ? tuning.farol.vision : 0, fogTone: 'dark', lights: [], ultLocked: false, blocked: false, wind: { x: 0, y: 0 },
  }
  return g
}

// ---------- utilitários ----------
export function burst(g: Game, x: number, y: number, n: number, color: string, speed = 160, life = 0.5, size = 2.4) {
  for (let i = 0; i < n && g.particles.length < 250; i++) {
    const a = g.rng() * Math.PI * 2, s = speed * (0.3 + g.rng() * 0.9)
    g.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + g.rng() * 0.6), max: life, size: size * (0.6 + g.rng()), color })
  }
}
export const float = (g: Game, x: number, y: number, text: string, color = '#ffd9a8') => { if (g.floats.length < 40) g.floats.push({ x, y: y - 18, text, life: 0.9, color }) }

export function pushOut(g: Game, e: { x: number; y: number }, r: number) {
  for (const o of g.obstacles) {
    const d = dist(e.x, e.y, o.x, o.y), min = o.r + r
    if (d < min && d > 0.001) { e.x = o.x + ((e.x - o.x) / d) * min; e.y = o.y + ((e.y - o.y) / d) * min }
  }
  e.x = clamp(e.x, r, g.w - r); e.y = clamp(e.y, r, g.h - r)
}

export const isVisible = (g: Game, e: Enemy) => (e.boss ? e.boss.hidden : e.kind === 'fantasma') ? e.revealed > 0 || dist(e.x, e.y, g.player.x, g.player.y) < 120 : true

export function spawnEnemy(g: Game, kind: EnemyKind, x: number, y: number) {
  const k = enemyKinds[kind]
  const scale = g.mode === 'vigilia' ? 1 + Math.min(g.wave, 30) * 0.04 : 1
  g.enemies.push({ id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp: k.hp * scale, maxHp: k.hp * scale, r: k.r, speed: k.speed * (0.9 + g.rng() * 0.2), cd: 0.6 + g.rng() * 1.2, armor: k.armor, maxArmor: k.armor, revealed: 0, hit: 0, wob: g.rng() * 6 })
}

export function edgePoint(g: Game, minFromPlayer: number, area?: { x0: number; x1: number }) {
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
  p.hp = Math.max(0, p.hp - (amount - toAp)); p.flash = 0.18; g.fx.shake = Math.max(g.fx.shake, 3)
}

function chargeUlt(g: Game, amount: number) { g.player.ult = Math.min(tuning.ultMax, g.player.ult + amount * g.player.ultScale) }

export function damageEnemy(g: Game, e: Enemy, amount: number, crit = false): boolean {
  if (e.hp <= 0) return false
  if (e.boss?.invuln) { if (e.hit <= 0) { e.hit = 0.25; float(g, e.x, e.y, 'IMUNE', '#c9c0d8') } return false }
  let dmg = amount
  if (e.armor > 0) { e.armor = Math.max(0, e.armor - amount); dmg = amount * 0.25 }
  e.hp -= dmg; e.hit = 0.12
  if (e.boss && e.hp < e.boss.minHp) e.hp = e.boss.minHp
  chargeUlt(g, dmg * 0.025)
  if (crit) { g.lastCrit = g.time; float(g, e.x, e.y, '-' + Math.round(dmg) + ' CRÍTICO', '#ff6a1f'); g.fx.shake = Math.max(g.fx.shake, 1.5) }
  else if (g.floats.length < 24) float(g, e.x, e.y, '-' + Math.round(dmg), '#ff8a3d')
  if (e.hp > 0) return false
  if (e.kind === 'clone') { burst(g, e.x, e.y, 10, '#d8b6ff', 200, 0.4); return true }
  g.kills++; g.score += e.kind === 'brutamontes' ? 150 : 25
  if (!e.boss && g.fx.corpses.length < 8) { const k = Math.sin(e.id * 12.9898) * 43758.5453; g.fx.corpses.push({ x: e.x, y: e.y, r: e.r, kind: e.kind, a: (k - Math.floor(k) - 0.5) * 0.9, flip: Math.floor(k * 7) % 2 === 0, t: 0, max: 6 }) }
  g.fx.shake = Math.max(g.fx.shake, e.boss ? 4 : e.kind === 'brutamontes' ? 3 : 2)
  chargeUlt(g, e.kind === 'brutamontes' ? 25 : 6)
  burst(g, e.x, e.y, e.kind === 'brutamontes' ? 26 : 10, '#ffcf8a', 220, 0.6)
  burst(g, e.x, e.y, e.kind === 'brutamontes' ? 14 : 6, '#ff6a1f', 150, 0.8, 3)
  // o inimigo se desfaz em cinzas e fogo que sobem (sem sorteio da simulação, para não mexer nas sementes)
  for (let i = 0; i < 9 && g.particles.length < 250; i++) { const k = Math.sin((e.id + 1) * 12.9898 + i * 78.233) * 43758.5453, j = k - Math.floor(k); g.particles.push({ x: e.x + (j - 0.5) * e.r * 1.6, y: e.y, vx: (j - 0.5) * 40, vy: -300 - j * 220, life: 1.5, max: 1.5, size: 2 + j * 2.4, color: i % 2 ? '#ff8a3d' : '#a69a92' }) }
  float(g, e.x, e.y + 14, '+100 PURIFICAÇÃO', '#ffe9c4')
  return true
}

// ---------- habilidades ----------
// ---------- golpes corpo a corpo ----------
// O arco do golpe atual (g.swingNow) vale só no passo em que foi dado; inimigos, torres e selos testam contra ele.
export function inSwing(g: Game, x: number, y: number, radius: number) {
  const s = g.swingNow
  if (!s) return false
  const d = dist(x, y, s.x, s.y)
  if (d > s.reach + radius) return false
  if (d <= radius) return true
  let da = Math.atan2(y - s.y, x - s.x) - s.a
  while (da > Math.PI) da -= Math.PI * 2
  while (da < -Math.PI) da += Math.PI * 2
  return Math.abs(da) <= s.arc + Math.asin(Math.min(1, radius / d))
}

function swing(g: Game) {
  const p = g.player, crit = g.rng() < tuning.critChance
  p.fireCd = 1 / tuning.swingRate; g.swingSide *= -1; p.atk = 0
  const base = p.damage * tuning.swingMul
  g.swingNow = { x: p.x, y: p.y, a: p.aim, reach: tuning.swingReach, arc: tuning.swingArc, dmg: base }
  if (g.fx.slashes.length < 5) g.fx.slashes.push({ x: p.x, y: p.y, a: p.aim, t: 0, max: 0.26, heavy: crit, side: g.swingSide })
  for (const e of g.enemies) {
    if (e.hp <= 0 || !isVisible(g, e) || !inSwing(g, e.x, e.y, e.r)) continue
    const d = Math.max(dist(e.x, e.y, p.x, p.y), 1)
    if (!e.boss) { e.vx += ((e.x - p.x) / d) * tuning.swingKnock * 2; e.vy += ((e.y - p.y) / d) * tuning.swingKnock * 2; e.lunge = 0 }
    burst(g, e.x, e.y, 5, '#ffd9a8', 150, 0.28)
    damageEnemy(g, e, base * (crit ? tuning.critMult : 1), crit)
  }
}

// Fim do [E]: meia-lua larga no ponto de chegada, que fere quem o corte da passagem não pegou.
function dashSweep(g: Game) {
  const p = g.player, a = Math.atan2(p.dashDy, p.dashDx)
  p.atk = 0
  g.fx.slashes.push({ x: p.x, y: p.y, a, t: 0, max: 0.42, heavy: true, big: true, side: g.swingSide })
  g.fx.shake = Math.max(g.fx.shake, 2.5)
  const prev = g.swingNow
  g.swingNow = { x: p.x, y: p.y, a, reach: 140, arc: 1.5, dmg: 0 }
  for (const e of g.enemies) {
    if (e.hp <= 0 || p.dashHit.has(e.id) || !inSwing(g, e.x, e.y, e.r)) continue
    p.dashHit.add(e.id)
    if (damageEnemy(g, e, tuning.dashDamage * g.perks.damage * 2, true)) { p.cd.e = 0; float(g, p.x, p.y - 30, 'RESET', '#fff0c8') }
  }
  g.swingNow = prev
}

// Estocada de lança do Sombra: acerta à frente dele; o Escudo da Fé bloqueia, repele e solta faíscas roxas.
function spearThrust(g: Game, e: Enemy, ux: number, uy: number, d: number) {
  const p = g.player, bx = e.x + ux * 56, by = e.y + uy * 56
  if (d > tuning.spearReach + p.r + 16) return
  if (p.shield > 0 && inShieldArc(g, e.x, e.y, tuning.spearReach + 60)) {
    e.vx -= ux * 320; e.vy -= uy * 320
    burst(g, bx, by, 12, '#b26bff', 220, 0.45); burst(g, bx, by, 18, '#ffb347', 300, 0.5)
    chargeUlt(g, 3); g.fx.shake = Math.max(g.fx.shake, 1.5)
    if (g.fx.flashes.length < 6) g.fx.flashes.push({ x: bx, y: by, a: Math.atan2(-uy, -ux), t: 0, max: 0.3, purple: true })
    return
  }
  hurtPlayer(g, 11); burst(g, bx, by, 6, '#b26bff', 160, 0.3)
}

function castPulse(g: Game) {
  const p = g.player
  g.pulse = { t: 0, x: p.x, y: p.y }; g.fogClear = 3.2; p.cast = 0.35
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
  g.fx.slashes.push({ x: p.x, y: p.y, a: dir, t: 0, max: 0.3, heavy: true })
}

function castNova(g: Game) {
  const p = g.player
  p.ult = 0; p.invuln = Math.max(p.invuln, 1); p.cast = 0.35
  g.nova = { t: 0, x: p.x, y: p.y }; g.projectiles = g.projectiles.filter(b => b.from === 'player')
  for (const e of g.enemies) {
    if (dist(e.x, e.y, p.x, p.y) > tuning.novaRadius + e.r) continue
    e.armor = 0; e.revealed = 3
    if (g.fx.pillars.length < 10) g.fx.pillars.push({ x: e.x, y: e.y, t: -0.08 * g.fx.pillars.length, max: 0.9 })
    if (e.boss?.finisher) { e.boss.minHp = 0; e.hp = Math.min(e.hp, 1) }
    damageEnemy(g, e, tuning.novaDamage * g.perks.damage, false)
  }
  burst(g, p.x, p.y, 70, '#ffd27a', 420, 0.9, 3)
  g.fx.shake = 4
  float(g, p.x, p.y - 20, 'CONSUMADO', '#ffe08a')
}

function tryAbilities(g: Game) {
  const p = g.player, w = g.want
  if (g.blocked && (w.c || w.q || w.e || w.x)) { float(g, p.x, p.y - 28, 'SILÊNCIO', '#c9a8ff'); w.c = w.q = w.e = w.x = false; return }
  if (w.x && g.ultLocked && p.ult >= tuning.ultMax) { float(g, p.x, p.y - 28, 'SELADO', '#c9c0d8'); w.x = false }
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
  g.lights = f.stage === 'defend' ? [{ x: f.altar.x, y: f.altar.y, r: 360 }] : []
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

export function finish(g: Game, won: boolean) {
  if (g.phase === 'won' || g.phase === 'lost') return
  g.phase = won ? 'won' : 'lost'
  g.result = { mode: g.mode, wave: g.mode === 'vigilia' ? Math.max(0, g.wave - (won ? 0 : 1)) : 0, kills: g.kills, seconds: g.time, won, phase: g.story?.phase.id }
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
    if (p.dashT <= 0) dashSweep(g)
  } else if (mv > 0.01) {
    const s = p.speed * Math.min(1, mv) / mv
    p.x += g.input.moveX * s * dt; p.y += g.input.moveY * s * dt
  }
  if (g.wind.x || g.wind.y) { p.x += g.wind.x * dt; p.y += g.wind.y * dt }
  pushOut(g, p, p.r)
  // fase da animação do Portador (só leitura para o desenho)
  p.walk += ((p.dashT > 0 ? 0 : Math.min(1, mv)) - p.walk) * Math.min(1, dt * 10); p.stride += p.walk * dt * 13; p.atk += dt; p.cast = Math.max(0, p.cast - dt)
  p.facing += ((Math.cos(p.aim) > 0 ? -1 : 1) - p.facing) * Math.min(1, dt * 16)

  // golpe de espada: arco curto à frente do Portador (no celular, só golpeia quando há alvo ao alcance)
  p.fireCd -= dt
  g.swingNow = null
  const inReach = !!target && dist(target.x, target.y, p.x, p.y) < tuning.swingReach + target.r + 40
  const wantsFire = g.input.assist ? inReach : g.input.fire
  if (wantsFire && p.fireCd <= 0 && p.dashT <= 0) swing(g)

  if (g.mode === 'vigilia') updateWaves(g, dt); else if (g.mode === 'farol') updateFarol(g, dt); else g.hook?.(g, dt)
  if (g.phase !== 'playing') return

  updateEnemies(g, dt)
  updateProjectiles(g, dt)
  g.enemies = g.enemies.filter(e => e.hp > 0)
  for (const q of g.particles) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt }
  g.particles = g.particles.filter(q => q.life > 0)
  for (const f of g.floats) { f.y -= 26 * dt; f.life -= dt }
  g.fx.shake = Math.max(0, g.fx.shake - dt * 16)
  for (const s of g.fx.slashes) s.t += dt
  for (const f of g.fx.flashes) f.t += dt
  for (const q of g.fx.pillars) { if (q.t < 0 && q.t + dt >= 0) g.fx.shake = Math.max(g.fx.shake, 3); q.t += dt }
  for (const c of g.fx.corpses) c.t += dt
  g.fx.pillars = g.fx.pillars.filter(q => q.t < q.max); g.fx.corpses = g.fx.corpses.filter(c => c.t < c.max)
  g.fx.slashes = g.fx.slashes.filter(s => s.t < s.max); g.fx.flashes = g.fx.flashes.filter(f => f.t < f.max)
  g.floats = g.floats.filter(f => f.life > 0)
  if (p.hp <= 0) finish(g, false)
}

function updateEnemies(g: Game, dt: number) {
  const p = g.player, f = g.farol
  const beacon = g.mode === 'farol' && f.stage === 'defend' && f.hp > 0 ? f.altar : null
  for (const e of g.enemies) {
    e.hit = Math.max(0, e.hit - dt); e.revealed = Math.max(0, e.revealed - dt); e.cd -= dt; e.wob += dt * 4
    if (e.boss) continue
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
      if (e.kind === 'sombra' && tgt === p) {
        const lg = e.lunge ?? 0
        if (lg > 0) { mx = 0; my = 0; e.lunge = lg - dt; if (e.lunge <= 0) spearThrust(g, e, dx / d, dy / d, d) }
        else { if (d < 84) { mx = 0; my = 0 } if (d < tuning.spearReach && e.cd <= 0) { e.lunge = tuning.spearWindup; e.cd = 1.9 } }
      }
      if (e.kind === 'brutamontes' && e.cd <= 0) {
        e.cd = 3.2
        for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + e.wob; g.projectiles.push({ x: e.x, y: e.y, vx: Math.cos(a) * 250, vy: Math.sin(a) * 250, r: 6, dmg: 8, from: 'enemy', life: 2.2, crit: false, reflected: false }) }
      }
    }
    e.walking = mx !== 0 || my !== 0
    e.x += (mx * e.speed + e.vx) * dt; e.y += (my * e.speed + e.vy) * dt
    e.vx *= 0.9; e.vy *= 0.9
    pushOut(g, e, e.r)
    // contato
    const reach = e.r + (tgt === p ? p.r : 34)
    if (e.kind !== 'dardo' && dist(e.x, e.y, tgt.x, tgt.y) < reach + 2) {
      const dps = e.kind === 'brutamontes' ? 24 : e.kind === 'fantasma' ? 12 : e.kind === 'clone' ? 4 : 9
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
        burst(g, b.x, b.y, 16, '#ffb347', 300, 0.5); burst(g, b.x, b.y, 10, '#b26bff', 220, 0.4); chargeUlt(g, 3)
        if (g.fx.flashes.length < 6) g.fx.flashes.push({ x: b.x, y: b.y, a: Math.atan2(b.vy, b.vx), t: 0, max: 0.3, purple: true })
        continue
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
  story: { label: string; objective: string; boss: { name: string; hp: number; max: number } | null; ultLocked: boolean } | null
  mode: Mode; stage: 'advance' | 'plant' | 'defend' | null; timeLeft: number; plant: number; beaconHp: number; defendLeft: number; enemies: number; hurt: boolean
}
export function hudSnapshot(g: Game): Hud {
  const p = g.player, f = g.farol
  return {
    hp: Math.ceil(p.hp), maxHp: p.maxHp, ap: Math.ceil(p.ap), maxAp: p.maxAp, time: g.time, kills: g.kills, score: g.score, wave: g.wave,
    cd: { ...p.cd }, cdMax: { c: p.cdMax.c * p.cdScale.c, q: p.cdMax.q * p.cdScale.q, e: p.cdMax.e * p.cdScale.e }, ult: Math.floor(p.ult), shield: p.shield,
    story: g.story?.hud ?? null, mode: g.mode, stage: g.mode === 'farol' ? f.stage : null, timeLeft: Math.max(0, f.timeLeft), plant: f.plant, beaconHp: Math.ceil(f.hp), defendLeft: Math.max(0, f.defendLeft), enemies: g.enemies.length + g.queue.length, hurt: p.flash > 0,
  }
}
