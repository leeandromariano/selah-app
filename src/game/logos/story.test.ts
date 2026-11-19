import { describe, expect, it } from 'vitest'
import { acts, isBossPhase, isUnlocked, nextPhase, phaseById, phases, rewardFor } from './campaign'
import { createStoryGame } from './story'
import { damageEnemy, mulberry32, update, type Game } from './sim'
import { emptyArmadura } from './rules'

const start = (id: number, seed = 5) => { const g = createStoryGame(phaseById(id)!, emptyArmadura(), mulberry32(seed)); g.player.invuln = 1e9; g.obstacles = []; return g }
const run = (g: Game, seconds: number) => { for (let i = 0; i < seconds * 60; i++) update(g, 1 / 60) }
const quiet = (g: Game) => { g.story!.spawnCd = 1e9 }
const at = (g: Game, x: number, y: number) => { g.player.x = x; g.player.y = y }

describe('Campanha: dados', () => {
  it('são 4 Atos com 4 fases cada, em ordem, com referências distintas', () => {
    expect(phases).toHaveLength(16)
    expect(phases.map(p => p.id)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
    for (const a of acts) expect(phases.filter(p => p.act === a.id).map(p => p.index)).toEqual([1, 2, 3, 4])
    expect(new Set(phases.map(p => p.reference)).size).toBe(16)
    expect(phases[6].reference).toBe('Salmos 23:4')
  })
  it('cada objetivo tem o que precisa no mapa', () => {
    for (const p of phases) for (const o of p.objectives) {
      if (o.kind === 'beacons') expect(p.layout.beacons?.length ?? 0).toBeGreaterThanOrEqual(o.target)
      if (o.kind === 'towers') expect(p.layout.towers?.length ?? 0).toBeGreaterThanOrEqual(o.target)
      if (o.kind === 'seals') expect(p.layout.seals?.length ?? 0).toBeGreaterThanOrEqual(o.target)
      if (o.kind === 'boss') expect(p.boss).toBeTruthy()
    }
    expect(phases.filter(p => p.boss).map(p => p.id)).toEqual([4, 7, 12, 16])
    expect(phases.filter(isBossPhase).map(p => p.id)).toEqual([4, 7, 12, 16])
  })
  it('as fases abrem em ordem e o prêmio segue a conta do servidor', () => {
    expect(isUnlocked(phases[0], [])).toBe(true); expect(isUnlocked(phases[1], [])).toBe(false); expect(isUnlocked(phases[1], [1])).toBe(true)
    expect(nextPhase([1, 2])!.id).toBe(3); expect(nextPhase(phases.map(p => p.id))).toBeUndefined()
    expect(rewardFor(phases[0])).toEqual({ sparks: 100, xp: 70 })
    expect(rewardFor(phases[3])).toEqual({ sparks: 230, xp: 100 })
    expect(rewardFor(phases[0], true)).toEqual({ sparks: 30, xp: 21 })
  })
})

describe('Campanha: objetivos e gatilhos de arena', () => {
  it('abates: a fase termina em vitória e o resultado leva o número da fase', () => {
    const g = start(1); quiet(g)
    g.kills = 11; run(g, 0.2); expect(g.phase).toBe('playing')
    g.kills = 12; run(g, 0.2)
    expect(g.phase).toBe('won'); expect(g.result).toMatchObject({ mode: 'historia', won: true, phase: 1 })
  })
  it('sobreviver: conta o tempo e mostra quanto falta', () => {
    const g = start(2); quiet(g)
    run(g, 30); expect(g.story!.hud.objective).toMatch(/faltam (30|31)s/)
    run(g, 31); expect(g.phase).toBe('won')
  })
  it('tempestade de areia: chega, empurra, reduz a visão e passa; o Pulso abre a névoa', () => {
    const g = start(2); quiet(g)
    run(g, 4.5); expect(g.wind).toEqual({ x: 0, y: 0 }); expect(g.fogRadius).toBe(0)
    run(g, 1); expect(g.story!.storm!.on).toBe(true); expect(Math.hypot(g.wind.x, g.wind.y)).toBeCloseTo(55, 0); expect(g.fogRadius).toBe(245); expect(g.fogTone).toBe('sand')
    const x = g.player.x, y = g.player.y; run(g, 1); expect(Math.hypot(g.player.x - x, g.player.y - y)).toBeGreaterThan(20)
    g.want.c = true; run(g, 0.1); expect(g.fogClear).toBeGreaterThan(2)
    run(g, 10); expect(g.story!.storm!.on).toBe(false); expect(g.fogRadius).toBe(0)
  })
  it('clones das Miragens somem com um golpe e não contam como abate', () => {
    const g = start(3); quiet(g)
    g.enemies.push({ id: 99, kind: 'clone', x: 400, y: 400, vx: 0, vy: 0, hp: 10, maxHp: 10, r: 14, speed: 0, cd: 99, armor: 0, maxArmor: 0, revealed: 0, hit: 0, wob: 0 })
    expect(damageEnemy(g, g.enemies[0], 50)).toBe(true); expect(g.kills).toBe(0)
  })
  it('Faróis só acendem em ordem, depois de 2 segundos perto; a fase fecha ao acender todos', () => {
    const g = start(6); quiet(g)
    const [a, b] = g.story!.beacons
    expect(g.fogRadius).toBe(235)
    at(g, b.x, b.y); run(g, 3); expect(b.lit).toBe(false)
    at(g, a.x, a.y); run(g, 1); expect(a.lit).toBe(false); run(g, 1.3); expect(a.lit).toBe(true)
    expect(g.lights).toHaveLength(1); expect(g.story!.hud.objective).toContain('1/2')
    at(g, b.x, b.y); run(g, 2.3)
    expect(b.lit).toBe(true); expect(g.phase).toBe('won')
  })
  it('afastar-se do Farol faz o progresso cair', () => {
    const g = start(5); quiet(g); const [a] = g.story!.beacons
    at(g, a.x, a.y); run(g, 1.2); expect(a.progress).toBeGreaterThan(1)
    at(g, a.x + 600, a.y); run(g, 1); expect(a.progress).toBeLessThan(0.1)
  })
  it('zonas de silêncio bloqueiam as habilidades enquanto você está dentro', () => {
    const g = start(10); quiet(g); const z = g.story!.zones[0]
    at(g, z.x, z.y); run(g, 0.05); g.want.q = true; run(g, 0.1)
    expect(g.blocked).toBe(true); expect(g.player.shield).toBe(0); expect(g.player.cd.q).toBe(0)
    at(g, z.x + 400, z.y); run(g, 0.05); g.want.q = true; run(g, 0.1)
    expect(g.blocked).toBe(false); expect(g.player.shield).toBeGreaterThan(0)
  })
  it('torres disparam dardos; os feixes (e dardos refletidos) as destroem; todas caídas vence', () => {
    const g = start(9); quiet(g)
    const [t1, t2] = g.story!.towers
    at(g, t1.x - 300, t1.y); run(g, 2)
    expect(g.projectiles.some(b => b.from === 'enemy')).toBe(true)
    for (const t of [t1, t2]) g.projectiles.push({ x: t.x, y: t.y, vx: 0, vy: 0, r: 5, dmg: 500, from: 'player', life: 1, crit: false, reflected: false })
    run(g, 0.1)
    expect(t1.down && t2.down).toBe(true); expect(g.phase).toBe('won')
  })
  it('selos: o CONSUMADO fica trancado até quebrar os 3', () => {
    const g = start(14); quiet(g)
    expect(g.ultLocked).toBe(true); g.player.ult = 100; g.want.x = true; run(g, 0.1); expect(g.player.ult).toBeGreaterThanOrEqual(99)
    for (const s of g.story!.seals) g.projectiles.push({ x: s.x, y: s.y, vx: 0, vy: 0, r: 5, dmg: 999, from: 'player', life: 1, crit: false, reflected: false })
    run(g, 0.1)
    expect(g.story!.seals.every(s => s.broken)).toBe(true); expect(g.phase).toBe('won')
  })
})

describe('Campanha: chefes', () => {
  it('Tentador: nasce imune, cria clones; só fica vulnerável quando as miragens caem', () => {
    const g = start(4); quiet(g); const boss = g.story!.boss!
    expect(boss.boss!.invuln).toBe(true)
    run(g, 1.4); expect(boss.boss!.state).toBe('clones'); expect(g.enemies.filter(e => e.kind === 'clone')).toHaveLength(3)
    const hp = boss.hp; damageEnemy(g, boss, 100); expect(boss.hp).toBe(hp)
    for (const c of g.enemies.filter(e => e.kind === 'clone')) damageEnemy(g, c, 99)
    run(g, 0.1); expect(boss.boss!.state).toBe('volley'); expect(boss.boss!.invuln).toBe(false)
    damageEnemy(g, boss, 100); expect(boss.hp).toBe(hp - 100)
    damageEnemy(g, boss, 9999); run(g, 0.2)
    expect(g.phase).toBe('won'); expect(g.result?.phase).toBe(4)
  })
  it('Tentador: depois da rajada vem a investida avisada e o ciclo recomeça', () => {
    const g = start(4); quiet(g); const boss = g.story!.boss!
    g.player.invuln = 0; g.player.hp = 1e6; g.player.maxHp = 1e6
    run(g, 1.3); for (const c of g.enemies.filter(e => e.kind === 'clone')) damageEnemy(g, c, 99)
    const seen = new Set<string>()
    for (let i = 0; i < 60 * 14; i++) { update(g, 1 / 60); seen.add(boss.boss!.state) }
    expect(seen.has('aim')).toBe(true); expect(seen.has('charge')).toBe(true); expect(seen.has('rest')).toBe(true)
  })
  it('Sentinela: escondido e imune até o Pulso de Revelação; depois da investida fica exposto', () => {
    const g = start(7); quiet(g); const boss = g.story!.boss!
    run(g, 1.2); expect(boss.boss!.state).toBe('lurk'); expect(boss.boss!.hidden).toBe(true); expect(boss.boss!.invuln).toBe(true)
    const hp = boss.hp; damageEnemy(g, boss, 80); expect(boss.hp).toBe(hp)
    boss.x = g.player.x + 200; boss.y = g.player.y
    g.want.c = true; run(g, 0.15)
    expect(boss.revealed).toBeGreaterThan(0); expect(boss.boss!.invuln).toBe(false)
    damageEnemy(g, boss, 80); expect(boss.hp).toBe(hp - 80)
    const seen = new Set<string>(); for (let i = 0; i < 60 * 8; i++) { update(g, 1 / 60); seen.add(boss.boss!.state) }
    expect(seen.has('strike')).toBe(true); expect(seen.has('exposed')).toBe(true)
  })
  it('Sentinela + 3 Faróis: a fase só fecha com os dois objetivos', () => {
    const g = start(7); quiet(g)
    for (const b of g.story!.beacons) { b.lit = true }
    run(g, 0.2); expect(g.phase).toBe('playing'); expect(g.story!.hud.objective).toContain('Sentinela')
    damageEnemy(g, g.story!.boss!, 1e6); g.story!.boss!.boss!.invuln = false; damageEnemy(g, g.story!.boss!, 1e6); run(g, 0.2)
    expect(g.phase).toBe('won')
  })
  it('Acusador: armadura quebra com o CONSUMADO, atordoa, lança zona de silêncio e rearma', () => {
    const g = start(12); quiet(g); const boss = g.story!.boss!
    expect(boss.armor).toBe(160)
    run(g, 1.3); expect(boss.boss!.state).toBe('volley')
    at(g, boss.x - 200, boss.y); g.player.ult = 100; g.want.x = true; run(g, 0.2)
    expect(boss.armor).toBe(0); run(g, 0.2); expect(boss.boss!.state).toBe('stunned'); expect(boss.boss!.invuln).toBe(false)
    run(g, 6.6); expect(boss.boss!.state).toBe('volley'); expect(boss.armor).toBe(90)
    run(g, 6.5); expect(boss.boss!.state).toBe('accuse'); run(g, 0.2); expect(g.story!.zones.some(z => z.ttl < Infinity)).toBe(true)
  })
  it('Dragão: três fases, selos trancam o CONSUMADO e só ele dá o golpe final', () => {
    const g = start(16); quiet(g); const boss = g.story!.boss!
    run(g, 1.6); expect(boss.boss!.phase).toBe(1)
    damageEnemy(g, boss, 5000); expect(boss.hp).toBeCloseTo(boss.maxHp * 0.66, 0)
    run(g, 0.1); expect(boss.boss!.phase).toBe(2); expect(boss.boss!.invuln).toBe(true); expect(g.ultLocked).toBe(true); expect(g.story!.seals).toHaveLength(3)
    const hp = boss.hp; damageEnemy(g, boss, 100); expect(boss.hp).toBe(hp)
    for (const s of g.story!.seals) g.projectiles.push({ x: s.x, y: s.y, vx: 0, vy: 0, r: 5, dmg: 999, from: 'player', life: 1, crit: false, reflected: false })
    run(g, 0.1)
    expect(boss.boss!.phase).toBe(3); expect(g.ultLocked).toBe(false); expect(g.player.ult).toBeGreaterThanOrEqual(99); expect(boss.boss!.finisher).toBe(true)
    damageEnemy(g, boss, 99999); run(g, 0.1); expect(g.phase).toBe('playing'); expect(boss.hp).toBe(1)
    at(g, boss.x - 200, boss.y); g.want.x = true; run(g, 0.3)
    expect(g.phase).toBe('won'); expect(g.result).toMatchObject({ mode: 'historia', phase: 16, won: true })
  })
  it('morrer encerra a fase como derrota', () => {
    const g = start(1); quiet(g); g.player.invuln = 0; g.player.hp = 1; g.player.ap = 0
    g.enemies.push({ id: 5, kind: 'sombra', x: g.player.x, y: g.player.y, vx: 0, vy: 0, hp: 30, maxHp: 30, r: 14, speed: 0, cd: 99, armor: 0, maxArmor: 0, revealed: 0, hit: 0, wob: 0 })
    run(g, 1.5); expect(g.phase).toBe('lost'); expect(g.result).toMatchObject({ mode: 'historia', won: false, phase: 1 })
  })
})
