import { describe, expect, it } from 'vitest'
import { applyBlessing, createGame, damageEnemy, enemyKinds, hudSnapshot, isVisible, mulberry32, tuning, update, type EnemyKind, type Game } from './sim'
import { emptyArmadura, levelFromXp, perksFor, upgradeCost } from './rules'

const newGame = (mode: 'vigilia' | 'farol' = 'vigilia', seed = 7) => createGame(mode, emptyArmadura(), mulberry32(seed))
function add(g: Game, kind: EnemyKind, x: number, y: number) {
  const k = enemyKinds[kind]
  g.enemies.push({ id: g.nextId++, kind, x, y, vx: 0, vy: 0, hp: k.hp, maxHp: k.hp, r: k.r, speed: k.speed, cd: 99, armor: k.armor, maxArmor: k.armor, revealed: 0, hit: 0, wob: 0 })
  return g.enemies[g.enemies.length - 1]
}
const run = (g: Game, seconds: number) => { for (let i = 0; i < seconds * 60; i++) update(g, 1 / 60) }
const calm = (g: Game) => { g.breather = 999; g.queue = []; g.enemies = [] }

describe('LOGOS: regras da armadura', () => {
  it('nível 1 de tudo é o básico; cada nível melhora a peça', () => {
    const base = perksFor(emptyArmadura())
    expect(base).toMatchObject({ maxHp: 100, maxAp: 20, speed: 1, shieldSeconds: 4, damage: 1 })
    const top = perksFor({ cinturao: 5, coraca: 5, sandalias: 5, escudo: 5, capacete: 5, espada: 5 })
    expect(top.maxHp).toBe(140); expect(top.maxAp).toBe(60); expect(top.shieldSeconds).toBe(6)
    expect(top.speed).toBeCloseTo(1.16); expect(top.damage).toBeCloseTo(1.4); expect(top.ultCharge).toBeCloseTo(1.4)
    expect(perksFor({ ...emptyArmadura(), cinturao: 99 }).maxHp).toBe(140)
  })
  it('o custo de aprimorar é 100 vezes o nível e para no máximo', () => {
    expect([1, 2, 3, 4].map(upgradeCost)).toEqual([100, 200, 300, 400])
    expect(upgradeCost(5)).toBeNull()
  })
  it('300 de experiência por nível', () => { expect([0, 299, 300, 900].map(levelFromXp)).toEqual([1, 1, 2, 4]) })
})

describe('LOGOS: movimento e disparo', () => {
  it('WASD move na velocidade do jogador e a arena segura nas bordas', () => {
    const g = newGame(); calm(g)
    const x0 = g.player.x
    g.input.moveX = 1; run(g, 1)
    expect(g.player.x - x0).toBeGreaterThan(200); expect(g.player.x - x0).toBeLessThan(260)
    g.input.moveX = 1; g.breather = 999; run(g, 10)
    expect(g.player.x).toBeLessThanOrEqual(g.w - g.player.r + 0.001)
  })
  it('o clique golpeia com a espada: fere quem está à frente, ao alcance, e ignora quem está atrás ou longe', () => {
    const g = newGame(); calm(g)
    const front = add(g, 'sombra', g.player.x + 90, g.player.y), behind = add(g, 'sombra', g.player.x - 90, g.player.y), far = add(g, 'sombra', g.player.x + 260, g.player.y)
    for (const e of [front, behind, far]) e.speed = 0
    g.input.fire = true; g.input.aimX = 1; g.input.aimY = 0
    run(g, 0.2)
    expect(front.hp).toBeLessThan(front.maxHp)
    expect(behind.hp).toBe(behind.maxHp); expect(far.hp).toBe(far.maxHp)
  })
  it('o golpe alterna o lado, deixa um arco de corte e abate deixa um corpo em brasa', () => {
    const g = newGame(); calm(g)
    const e = add(g, 'sombra', g.player.x + 80, g.player.y); e.speed = 0; e.hp = 5
    g.input.fire = true; g.input.aimX = 1; g.input.aimY = 0
    run(g, 0.1)
    expect(g.fx.slashes.length).toBeGreaterThan(0)
    expect(g.enemies.includes(e)).toBe(false); expect(g.fx.corpses).toHaveLength(1); expect(g.fx.corpses[0].kind).toBe('sombra')
    const side = g.swingSide; g.player.fireCd = 0; run(g, 0.05); expect(g.swingSide).toBe(-side)
    run(g, 7); expect(g.fx.corpses).toHaveLength(0)
  })
  it('no celular a mira é assistida: acerta o inimigo mais próximo sem apontar', () => {
    const g = newGame(); calm(g)
    const e = add(g, 'sombra', g.player.x, g.player.y - 110); e.speed = 0; e.hp = e.maxHp = 300
    const out = add(g, 'sombra', g.player.x + 600, g.player.y); out.speed = 0
    g.input.assist = true; g.input.fire = true
    run(g, 0.6)
    expect(e.hp).toBeLessThan(e.maxHp); expect(out.hp).toBe(out.maxHp)
    expect(g.player.aim).toBeCloseTo(-Math.PI / 2, 1)
  })
  it('no celular não ataca sozinho: só golpeia pelo botão, e um toque rápido dá um golpe', () => {
    const g = newGame(); calm(g)
    const e = add(g, 'sombra', g.player.x, g.player.y - 90); e.speed = 0; e.hp = e.maxHp = 300
    g.input.assist = true
    run(g, 1)
    expect(e.hp).toBe(e.maxHp)
    g.input.tap = true
    run(g, 0.1)
    const once = e.hp
    expect(once).toBeLessThan(e.maxHp)
    e.x = g.player.x; e.y = g.player.y - 90
    run(g, 1)
    expect(e.hp).toBe(once)
  })
  it('inimigo oculto só é alvo depois do Pulso ou de chegar perto', () => {
    const g = newGame(); calm(g)
    const ghost = add(g, 'fantasma', g.player.x + 230, g.player.y); ghost.speed = 0
    expect(isVisible(g, ghost)).toBe(false)
    g.input.assist = true
    run(g, 0.5)
    expect(ghost.hp).toBe(ghost.maxHp)
    g.want.c = true; run(g, 0.05)
    expect(ghost.revealed).toBeGreaterThan(0); expect(isVisible(g, ghost)).toBe(true)
  })
})

describe('LOGOS: habilidades', () => {
  it('[C] Pulso de Revelação empurra e revela, e entra em recarga', () => {
    const g = newGame(); calm(g)
    const near = add(g, 'sombra', g.player.x + 100, g.player.y); near.speed = 0
    const far = add(g, 'fantasma', g.player.x + 900, g.player.y); far.speed = 0
    g.want.c = true; run(g, 0.3)
    expect(near.x).toBeGreaterThan(g.player.x + 100); expect(near.revealed).toBeGreaterThan(0)
    expect(far.revealed).toBe(0)
    expect(g.player.cd.c).toBeGreaterThan(10)
    const before = g.player.cd.c; g.want.c = true; run(g, 0.05)
    expect(g.player.cd.c).toBeLessThan(before)
  })
  it('[Q] Escudo de Vidro reflete o projétil inimigo e o devolve mais forte', () => {
    const g = newGame(); calm(g)
    g.player.aim = 0; g.input.aimX = 1; g.input.aimY = 0
    g.want.q = true; run(g, 0.05)
    expect(g.player.shield).toBeGreaterThan(3.5)
    g.projectiles.push({ x: g.player.x + 120, y: g.player.y, vx: -330, vy: 0, r: 6, dmg: 10, from: 'enemy', life: 3, crit: false, reflected: false })
    const hp = g.player.hp + g.player.ap
    run(g, 0.5)
    expect(g.player.hp + g.player.ap).toBe(hp)
    const back = g.projectiles.find(b => b.reflected)
    expect(back?.from).toBe('player'); expect(back!.vx).toBeGreaterThan(0); expect(back!.dmg).toBeGreaterThan(20)
  })
  it('sem o escudo, o mesmo projétil machuca (primeiro a armadura, depois a vida)', () => {
    const g = newGame(); calm(g)
    g.projectiles.push({ x: g.player.x + 60, y: g.player.y, vx: -330, vy: 0, r: 6, dmg: 10, from: 'enemy', life: 3, crit: false, reflected: false })
    run(g, 0.4)
    expect(g.player.ap).toBe(g.player.maxAp - 10); expect(g.player.hp).toBe(g.player.maxHp)
  })
  it('o escudo não protege por trás', () => {
    const g = newGame(); calm(g)
    g.player.aim = 0; g.input.aimX = 1; g.input.aimY = 0
    g.want.q = true; run(g, 0.05)
    g.projectiles.push({ x: g.player.x - 100, y: g.player.y, vx: 330, vy: 0, r: 6, dmg: 10, from: 'enemy', life: 3, crit: false, reflected: false })
    run(g, 0.5)
    expect(g.player.ap).toBeLessThan(g.player.maxAp)
  })
  it('[E] Dash fere com crítico e, se abater, zera a recarga na hora', () => {
    const g = newGame(); calm(g)
    g.input.aimX = 1; g.input.aimY = 0
    const weak = add(g, 'sombra', g.player.x + 120, g.player.y); weak.speed = 0; weak.hp = 10
    const x0 = g.player.x
    g.want.e = true; run(g, 0.3)
    expect(g.player.x - x0).toBeGreaterThan(250)
    expect(g.enemies.includes(weak)).toBe(false); expect(g.kills).toBe(1)
    expect(g.player.cd.e).toBe(0)
  })
  it('[E] termina com uma meia-lua que fere quem ficou no ponto de chegada', () => {
    const g = newGame(); calm(g)
    g.input.aimX = 1; g.input.aimY = 0
    const end = add(g, 'brutamontes', g.player.x + 340, g.player.y); end.speed = 0
    g.want.e = true; run(g, 0.3)
    expect(g.fx.slashes.some(s => s.big)).toBe(true); expect(end.hp).toBeLessThan(end.maxHp)
  })
  it('o Sombra avisa a estocada de lança antes de ferir, e o Escudo da Fé a bloqueia', () => {
    const open = newGame(); calm(open)
    const a = add(open, 'sombra', open.player.x + 70, open.player.y); a.speed = 0; a.cd = 0
    open.input.aimX = -1; open.input.aimY = 0
    run(open, 0.2)
    expect(a.lunge ?? 0).toBeGreaterThan(0); expect(open.player.ap).toBe(open.player.maxAp)
    run(open, 0.5)
    expect(open.player.ap).toBeLessThan(open.player.maxAp)
    const g = newGame(); calm(g)
    const b = add(g, 'sombra', g.player.x + 70, g.player.y); b.speed = 0; b.cd = 0
    g.input.aimX = 1; g.input.aimY = 0; g.want.q = true
    run(g, 0.9)
    expect(g.player.ap).toBe(g.player.maxAp); expect(g.player.ult).toBeGreaterThan(2)
  })
  it('[X] faz uma coluna de luz cair sobre cada inimigo atingido', () => {
    const g = newGame(); calm(g)
    for (let i = 0; i < 3; i++) add(g, 'sombra', g.player.x + 100 + i * 60, g.player.y).speed = 0
    g.player.ult = 100; g.want.x = true; run(g, 0.05)
    expect(g.fx.pillars).toHaveLength(3)
  })
  it('[E] Dash que não abate mantém a recarga', () => {
    const g = newGame(); calm(g)
    g.input.aimX = 1; g.input.aimY = 0
    const tough = add(g, 'brutamontes', g.player.x + 120, g.player.y); tough.speed = 0
    g.want.e = true; run(g, 0.3)
    expect(g.player.cd.e).toBeGreaterThan(5)
  })
  it('[X] CONSUMADO só dispara com a carga cheia, limpa a arena e quebra a armadura do chefe', () => {
    const g = newGame(); calm(g)
    const boss = add(g, 'brutamontes', g.player.x + 200, g.player.y); boss.speed = 0
    const weak = add(g, 'sombra', g.player.x - 150, g.player.y); weak.speed = 0
    g.want.x = true; run(g, 0.1)
    expect(weak.hp).toBe(weak.maxHp)
    g.player.ult = 100; g.want.x = true; run(g, 0.1)
    expect(g.player.ult).toBeLessThan(20); expect(boss.armor).toBe(0)
    expect(g.enemies.includes(weak)).toBe(false); expect(boss.hp).toBeLessThan(boss.maxHp)
  })
  it('abates e dano carregam o CONSUMADO; o Capacete acelera a carga', () => {
    const a = newGame(); calm(a); const e = add(a, 'sombra', 0, 0); damageEnemy(a, e, 999)
    const b = createGame('vigilia', { ...emptyArmadura(), capacete: 5 }, mulberry32(1)); calm(b); const f = add(b, 'sombra', 0, 0); damageEnemy(b, f, 999)
    expect(a.player.ult).toBeGreaterThan(5); expect(b.player.ult).toBeGreaterThan(a.player.ult)
  })
})

describe('LOGOS: Vigília na Arena', () => {
  it('as ondas começam sozinhas e a Bênção aparece a cada 3 ondas', () => {
    const g = newGame(); g.player.invuln = 1e9
    run(g, 2.5)
    expect(g.wave).toBe(1); expect(g.queue.length + g.enemies.length).toBeGreaterThan(0)
    for (let w = 1; w <= 3; w++) { g.queue = []; g.enemies = []; run(g, 0.2); if (w < 3) { expect(g.phase).toBe('playing'); g.breather = 0.01; run(g, 0.1) } }
    expect(g.phase).toBe('blessing'); expect(g.offer).toHaveLength(3)
    expect(new Set(g.offer).size).toBe(3)
    const pick = g.offer[0]
    applyBlessing(g, 'nao-existe' as never); expect(g.phase).toBe('blessing')
    applyBlessing(g, pick); expect(g.phase).toBe('playing'); expect(g.offer).toHaveLength(0)
    g.breather = 0.01; run(g, 0.2); expect(g.wave).toBe(4)
  })
  it('as bênçãos mudam os atributos', () => {
    const g = newGame(); g.phase = 'blessing'; g.offer = ['folego', 'luz', 'passos']
    const d = g.player.damage, s = g.player.speed
    applyBlessing(g, 'luz'); expect(g.player.damage).toBeCloseTo(d * 1.2)
    g.phase = 'blessing'; g.offer = ['passos']; applyBlessing(g, 'passos'); expect(g.player.speed).toBeCloseTo(s * 1.12)
    g.phase = 'blessing'; g.offer = ['folego']; g.player.hp = 50; applyBlessing(g, 'folego'); expect(g.player.maxHp).toBe(125); expect(g.player.hp).toBe(105)
  })
  it('a cada 5 ondas vem um chefe com armadura', () => {
    const g = newGame(); g.wave = 4; g.breather = 0.01; g.queue = []; g.enemies = []
    run(g, 0.1)
    expect(g.wave).toBe(5); expect(g.queue).toContain('brutamontes')
  })
  it('morrer encerra a partida com o resultado (ondas completas, abates, segundos)', () => {
    const g = newGame(); g.wave = 3; g.kills = 12; g.time = 100; calm(g)
    g.player.hp = 1; g.player.ap = 0
    add(g, 'sombra', g.player.x, g.player.y).speed = 0
    run(g, 1)
    expect(g.phase).toBe('lost'); expect(g.result).toMatchObject({ mode: 'vigilia', wave: 2, won: false, kills: 12 })
    expect(g.result!.seconds).toBeGreaterThan(100)
  })
})

describe('LOGOS: Protocolo Farol', () => {
  it('começa na névoa com 90 segundos e o altar do outro lado do mapa', () => {
    const g = newGame('farol')
    expect(g.farol.timeLeft).toBe(tuning.farol.limit); expect(g.farol.stage).toBe('advance')
    expect(g.farol.altar.x).toBeGreaterThan(g.player.x + 1500)
  })
  it('cravar o Farol exige ficar 3 segundos no altar; depois são 35 de defesa e a vitória', () => {
    const g = newGame('farol'); g.player.invuln = 1e9; g.farol.hp = 1e9
    g.player.x = g.farol.altar.x; g.player.y = g.farol.altar.y
    g.obstacles = []
    run(g, 1); expect(g.farol.stage).toBe('plant')
    run(g, 2.2); expect(g.farol.stage).toBe('defend')
    run(g, 20); expect(g.phase).toBe('playing')
    run(g, 16)
    expect(g.phase).toBe('won'); expect(g.result).toMatchObject({ mode: 'farol', won: true })
  })
  it('sair do altar interrompe o plantio', () => {
    const g = newGame('farol'); g.player.invuln = 1e9; g.obstacles = []
    g.player.x = g.farol.altar.x; g.player.y = g.farol.altar.y
    run(g, 1.5); g.player.x = g.farol.altar.x - 400; run(g, 2)
    expect(g.farol.stage).toBe('advance'); expect(g.farol.plant).toBeLessThan(1)
  })
  it('perder o tempo de avanço (90 s) é derrota', () => {
    const g = newGame('farol'); g.player.invuln = 1e9
    run(g, 91)
    expect(g.phase).toBe('lost'); expect(g.result?.won).toBe(false)
  })
  it('se o Farol cair durante a defesa, é derrota', () => {
    const g = newGame('farol'); g.player.invuln = 1e9; g.obstacles = []
    g.player.x = g.farol.altar.x; g.player.y = g.farol.altar.y
    run(g, 3.5); expect(g.farol.stage).toBe('defend')
    g.farol.hp = 0; run(g, 0.1)
    expect(g.phase).toBe('lost')
  })
  it('o HUD recebe o estado do Farol e da vigília', () => {
    const f = hudSnapshot(newGame('farol')); expect(f).toMatchObject({ mode: 'farol', stage: 'advance', timeLeft: 90, beaconHp: 100 })
    const v = hudSnapshot(newGame('vigilia')); expect(v).toMatchObject({ mode: 'vigilia', stage: null, wave: 0 })
  })
})
