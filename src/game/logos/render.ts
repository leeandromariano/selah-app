// CORAM // LOGOS: desenho da arena no canvas. Só lê o estado da simulação; nada aqui passa pelo React.
import { isVisible, tuning, type Enemy, type Game } from './sim'

const bossColor = { tentador: '#4a2c6a', sentinela: '#1d2233', acusador: '#4a2222', dragao: '#5a1a12' } as const

const ember = '#ff7a2e', gold = '#ffd9a8'

export type View = { w: number; h: number; scale: number; camX: number; camY: number }

export function makeView(g: Game, w: number, h: number): View {
  const scale = Math.max(0.55, Math.min(1.35, h / 720))
  const vw = w / scale, vh = h / scale
  const camX = vw >= g.w ? (g.w - vw) / 2 : Math.max(0, Math.min(g.w - vw, g.player.x - vw / 2))
  const camY = vh >= g.h ? (g.h - vh) / 2 : Math.max(0, Math.min(g.h - vh, g.player.y - vh / 2))
  return { w, h, scale, camX, camY }
}
export const toWorld = (v: View, sx: number, sy: number) => ({ x: sx / v.scale + v.camX, y: sy / v.scale + v.camY })

// Arte 3D da arena (public/assets/3d/logos): carrega uma vez e só entrega quando está pronta. Se o arquivo faltar, devolve null e o desenho de reserva é usado.
const artCache = new Map<string, HTMLImageElement | null>()
export function arenaArt(name: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null
  let img = artCache.get(name)
  if (img === undefined) {
    const el = new Image()
    el.decoding = 'async'
    el.onerror = () => { artCache.set(name, null) }
    el.src = `/assets/3d/logos/${name}.webp`
    artCache.set(name, el); img = el
  }
  return img && img.complete && img.naturalWidth > 0 ? img : null
}

// Piso de pedra escura (#0D0E11): lajes irregulares com variação de tom determinística, juntas finas e vinheta radial sobre a arena inteira.
const hash2 = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n) }
function ground(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.fillStyle = '#0D0E11'; ctx.fillRect(0, 0, g.w, g.h)
  const tile = 80
  const x0 = Math.max(0, Math.floor(v.camX / tile) * tile), y0 = Math.max(0, Math.floor(v.camY / tile) * tile)
  const x1 = Math.min(g.w, v.camX + v.w / v.scale + tile), y1 = Math.min(g.h, v.camY + v.h / v.scale + tile)
  ctx.lineWidth = 1
  for (let x = x0; x <= x1; x += tile) for (let y = y0; y <= y1; y += tile) {
    const h = hash2(x / tile, y / tile)
    ctx.fillStyle = h > 0.5 ? `rgba(255,255,255,${0.012 + (h - 0.5) * 0.05})` : `rgba(0,0,0,${0.06 + (0.5 - h) * 0.3})`
    ctx.fillRect(x, y, tile, tile)
    if (h > 0.7) { // rachaduras: uma linha principal com um ramo, mais clara na borda
      const k = hash2(x * 0.37, y * 0.91)
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + h * 30, y + 6); ctx.lineTo(x + 30 + k * 26, y + tile * 0.5); ctx.lineTo(x + 18 + k * 30, y + tile - 6); ctx.moveTo(x + 30 + k * 26, y + tile * 0.5); ctx.lineTo(x + tile - 8, y + tile * 0.62); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + h * 30 + 2, y + 6); ctx.lineTo(x + 32 + k * 26, y + tile * 0.5); ctx.stroke()
    }
    if (h < 0.1) ruin(ctx, x, y, tile, hash2(y / tile, x / tile)) // lajes soltas e muros caídos, com contraste baixo
  }
  ctx.strokeStyle = 'rgba(0,0,0,.45)'
  for (let x = x0; x <= x1; x += tile) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke() }
  for (let y = y0; y <= y1; y += tile) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke() }
  const vg = ctx.createRadialGradient(g.w / 2, g.h / 2, Math.min(g.w, g.h) * 0.25, g.w / 2, g.h / 2, Math.hypot(g.w, g.h) * 0.52)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, g.w, g.h)
  ctx.strokeStyle = 'rgba(255,140,60,.07)'; ctx.strokeRect(1, 1, g.w - 2, g.h - 2)
  ctx.strokeStyle = 'rgba(255,140,60,.35)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, g.w, g.h)
}

// Entulho de ruína: pedaços de muro caído (pedra mais clara, face de cima e lateral) e cascalho ao redor.
function ruin(ctx: CanvasRenderingContext2D, x: number, y: number, tile: number, k: number) {
  const w = 34 + k * 26, h = 14 + k * 8, ox = x + 10 + k * 20, oy = y + 28 + k * 16
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(ox + 4, oy + h, w, 6)
  ctx.fillStyle = '#23242b'; ctx.fillRect(ox, oy, w, h)
  ctx.fillStyle = '#2f3038'; ctx.fillRect(ox, oy, w, 4)
  ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, w, h)
  ctx.beginPath(); ctx.moveTo(ox + w * 0.4, oy); ctx.lineTo(ox + w * 0.4 + 3, oy + h); ctx.moveTo(ox + w * 0.75, oy); ctx.lineTo(ox + w * 0.75 - 2, oy + h); ctx.stroke()
  ctx.fillStyle = '#1b1c21'
  for (let i = 0; i < 4; i++) { const a = hash2(k * 9 + i, i * 3.1), b = hash2(i * 7.7, k * 5); ctx.beginPath(); ctx.moveTo(x + a * tile, y + b * tile); ctx.lineTo(x + a * tile + 6, y + b * tile + 2); ctx.lineTo(x + a * tile + 3, y + b * tile + 7); ctx.closePath(); ctx.fill() }
}

// Sombras projetadas: cada pilar perto do Portador joga uma sombra para longe da luz dele; a sombra esmaece com a distância.
function castShadows(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  for (const o of g.obstacles) {
    const dx = o.x - p.x, dy = o.y - p.y, d = Math.hypot(dx, dy)
    if (d < 8 || d > 520) continue
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, len = 150 + (520 - d) * 0.45
    const grad = ctx.createLinearGradient(o.x, o.y, o.x + ux * len, o.y + uy * len)
    const a = 0.62 * (1 - d / 560); grad.addColorStop(0, `rgba(0,0,0,${a})`); grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad; ctx.beginPath()
    ctx.moveTo(o.x + nx * o.r, o.y + ny * o.r); ctx.lineTo(o.x + nx * o.r * 1.25 + ux * len, o.y + ny * o.r * 1.25 + uy * len)
    ctx.lineTo(o.x - nx * o.r * 1.25 + ux * len, o.y - ny * o.r * 1.25 + uy * len); ctx.lineTo(o.x - nx * o.r, o.y - ny * o.r); ctx.closePath(); ctx.fill()
  }
}

// O pilar bloqueia a linha de visão entre o Portador e o alvo?
function behindPillar(g: Game, x: number, y: number) {
  const p = g.player, vx = x - p.x, vy = y - p.y, L2 = vx * vx + vy * vy
  if (L2 < 1) return false
  for (const o of g.obstacles) {
    const t = Math.max(0, Math.min(1, ((o.x - p.x) * vx + (o.y - p.y) * vy) / L2))
    if (t <= 0 || t >= 1) continue
    if (Math.hypot(p.x + vx * t - o.x, p.y + vy * t - o.y) < o.r * 0.9 && Math.hypot(o.x - p.x, o.y - p.y) < Math.sqrt(L2)) return true
  }
  return false
}

// Luz quente do Portador sobre a pedra: sobe um pouco a claridade ao redor dele.
function playerLight(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player, r = 230 + Math.sin(g.time * 3) * 8
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const l = ctx.createRadialGradient(p.x, p.y, 8, p.x, p.y, r); l.addColorStop(0, 'rgba(255,140,60,.22)'); l.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = l; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.restore()
}

// Coluna de pedra vista de cima: base escura, tambor com o lado voltado para a luz do Portador mais claro, anéis de junta, rachaduras e uma lasca quebrada.
function pillar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, light: { x: number; y: number }) {
  const dx = light.x - x, dy = light.y - y, d = Math.max(1, Math.hypot(dx, dy)), lx = dx / d, ly = dy / d, near = Math.max(0, 1 - d / 380)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 10, r * 1.08, r * 0.9, 0, 0, 7); ctx.fill()
  ctx.fillStyle = '#17181d'; ctx.beginPath(); ctx.arc(x, y, r * 1.06, 0, 7); ctx.fill()
  const grad = ctx.createRadialGradient(x + lx * r * 0.45, y + ly * r * 0.45, 2, x, y, r)
  grad.addColorStop(0, near > 0 ? `rgb(${95 + near * 90},${86 + near * 55},${78 + near * 30})` : '#5a5d66'); grad.addColorStop(1, '#25262d')
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, 7); ctx.stroke()
  const k = hash2(x * 0.013, y * 0.017)
  ctx.beginPath(); ctx.moveTo(x - r * 0.2, y - r * 0.95 * (0.6 + k * 0.3)); ctx.lineTo(x + r * 0.05, y - r * 0.2); ctx.lineTo(x - r * 0.3, y + r * 0.55); ctx.stroke()
  ctx.fillStyle = '#0D0E11'; ctx.beginPath(); ctx.moveTo(x + r * 0.55, y + r * 0.7); ctx.lineTo(x + r * 0.95, y + r * 0.25); ctx.lineTo(x + r * 0.9, y + r * 0.75); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = `rgba(255,${150 + near * 40},100,${0.12 + near * 0.35})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, Math.atan2(ly, lx) - 1.1, Math.atan2(ly, lx) + 1.1); ctx.stroke()
}

function enemy(ctx: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const vis = isVisible(g, e)
  const alpha = (vis ? (e.kind === 'clone' ? 0.8 : 1) : 0.16) * (e.boss || !behindPillar(g, e.x, e.y) ? 1 : 0.4)
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(e.x, e.y)
  const toward = Math.atan2(g.player.y - e.y, g.player.x - e.x)
  const wob = Math.sin(e.wob) * 2
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(4, e.r * 0.7, e.r, e.r * 0.5, 0, 0, 7); ctx.fill()
  const body = e.boss ? bossColor[e.boss.id] : e.kind === 'clone' ? '#3b2a52' : e.kind === 'brutamontes' ? '#2a1330' : e.kind === 'fantasma' ? '#241a33' : e.kind === 'dardo' ? '#2b1a2a' : '#211724'
  // arte 3D: Dragão e Acusador (chefes) e a sombra encapuzada (inimigos comuns); sem o arquivo, volta ao círculo
  const sprite = e.boss?.id === 'dragao' ? arenaArt('boss-dragao') : e.boss?.id === 'acusador' ? arenaArt('inimigo-acusador') : e.boss?.id === 'sentinela' ? arenaArt('inimigo-sentinela') : !e.boss && (e.kind === 'sombra' || e.kind === 'fantasma' || e.kind === 'clone') ? arenaArt('inimigo-sombra') : null
  if (sprite) {
    const size = e.r * (e.boss ? 5.4 : 4.2)
    ctx.drawImage(sprite, -size / 2, -size / 2 - e.r * 0.25 + wob * 0.4, size, size)
    if (e.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,170,100,.45)'; ctx.beginPath(); ctx.arc(0, 0, e.r, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over' }
  } else {
    const grad = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r + 4)
    grad.addColorStop(0, e.hit > 0 ? '#ffe1c2' : '#4a2e55'); grad.addColorStop(1, e.hit > 0 ? '#ff9d5c' : body)
    ctx.fillStyle = grad
    ctx.beginPath(); ctx.arc(0, wob * 0.3, e.r + wob * 0.3, 0, 7); ctx.fill()
  }
  if (e.boss?.dash && (e.boss.state === 'aim' || e.boss.state === 'strike') && e.boss.t < 0.85) { ctx.strokeStyle = 'rgba(255,70,50,.55)'; ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(e.boss.dash.dx * 520, e.boss.dash.dy * 520); ctx.stroke(); ctx.setLineDash([]) }
  if (!sprite && (e.boss || e.kind === 'brutamontes' || e.kind === 'dardo')) { // chifres
    ctx.strokeStyle = '#120a16'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * e.r * 0.5, -e.r * 0.7); ctx.lineTo(s * e.r * 0.95, -e.r * 1.35); ctx.stroke() }
  }
  if (e.armor > 0) { ctx.strokeStyle = 'rgba(255,170,90,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, e.r + 5, 0, (e.armor / e.maxArmor) * Math.PI * 2); ctx.stroke() }
  ctx.fillStyle = '#ff3a2a'; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 8
  const ex = Math.cos(toward) * e.r * 0.25, ey = Math.sin(toward) * e.r * 0.25
  if (!sprite) { ctx.beginPath(); ctx.arc(ex - e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.arc(ex + e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.fill() }
  ctx.restore()
  if (vis && e.hp < e.maxHp && e.hp > 0) { const w = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 4); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * (e.hp / e.maxHp), 4) }
}

function player(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  ctx.save(); ctx.translate(p.x, p.y)
  if (p.dashT > 0) { ctx.strokeStyle = 'rgba(255,190,120,.5)'; ctx.lineWidth = p.r * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.dashDx * 0.07, -p.dashDy * 0.07); ctx.stroke() }
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(4, p.r * 0.75, p.r, p.r * 0.5, 0, 0, 7); ctx.fill()
  const pulse = 1 + Math.sin(g.time * 4) * 0.08, aura = p.r * 3.6 * pulse
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, aura); glow.addColorStop(0, 'rgba(255,170,80,.55)'); glow.addColorStop(0.45, 'rgba(255,130,50,.22)'); glow.addColorStop(1, 'rgba(255,120,40,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, aura, 0, 7); ctx.fill()
  ctx.strokeStyle = 'rgba(255,170,90,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, p.r * 1.55 * pulse, 0, 7); ctx.stroke()
  ctx.rotate(p.aim)
  const r = p.r, hit = p.flash > 0
  // rastro luminoso da lâmina: leque que esmaece atrás da ponta, com brilho pulsante
  const trail = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r + 40)
  trail.addColorStop(0, 'rgba(255,85,0,0)'); trail.addColorStop(0.7, `rgba(255,85,0,${0.2 + 0.08 * Math.sin(g.time * 9)})`); trail.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = trail; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r + 40, -0.55, 0.12); ctx.closePath(); ctx.fill()
  // lâmina incandescente (#FF5500) apontando para a mira, com núcleo claro e guarda
  ctx.lineCap = 'round'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 20
  ctx.strokeStyle = '#FF5500'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(r * 0.7, 7); ctx.lineTo(r + 34, 3); ctx.stroke()
  ctx.shadowBlur = 0; ctx.strokeStyle = '#FFD9A8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(r * 0.9, 6.5); ctx.lineTo(r + 32, 3.4); ctx.stroke()
  ctx.strokeStyle = '#B9BFC9'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(r * 0.82, 1); ctx.lineTo(r * 0.82, 13); ctx.stroke()
  // ombreiras metálicas dos dois lados
  for (const side of [-1, 1]) {
    const sg = ctx.createLinearGradient(0, side * r * 0.4, 0, side * r * 1.3); sg.addColorStop(0, '#d7dce4'); sg.addColorStop(1, '#4a505c')
    ctx.fillStyle = hit ? '#ffb1a0' : sg; ctx.beginPath(); ctx.ellipse(-1, side * r * 0.92, r * 0.62, r * 0.4, side * 0.25, 0, 7); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1.2; ctx.stroke()
  }
  // capuz off-white (#F4F1EA) com a ponta caída para trás, sombra do rosto na frente e emblema brasa
  ctx.fillStyle = hit ? '#ffb1a0' : '#F4F1EA'; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill()
  ctx.beginPath(); ctx.moveTo(-r * 0.5, -r * 0.5); ctx.lineTo(-r * 1.25, 0); ctx.lineTo(-r * 0.5, r * 0.5); ctx.closePath(); ctx.fill()
  ctx.fillStyle = '#C9C2B2'; ctx.beginPath(); ctx.arc(-r * 0.12, 0, r * 0.52, 0, 7); ctx.fill()
  ctx.fillStyle = '#2a1f17'; ctx.beginPath(); ctx.ellipse(r * 0.32, 0, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill()
  ctx.fillStyle = '#FF5500'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(-r * 0.2, 0, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0
  ctx.restore()
}

function shieldArc(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  if (p.shield <= 0) return
  const fade = Math.min(1, p.shield / 0.6)
  ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.aim)
  const r = tuning.shieldRadius, a = tuning.shieldArc
  const grad = ctx.createRadialGradient(0, 0, r - 24, 0, 0, r + 6); grad.addColorStop(0, 'rgba(255,150,60,0)'); grad.addColorStop(1, `rgba(255,170,90,${0.5 * fade})`)
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, 0, r + 6, -a, a); ctx.arc(0, 0, r - 24, a, -a, true); ctx.closePath(); ctx.fill()
  ctx.strokeStyle = `rgba(255,214,160,${0.95 * fade})`; ctx.lineWidth = 3; ctx.shadowColor = ember; ctx.shadowBlur = 16
  ctx.beginPath(); ctx.arc(0, 0, r, -a, a); ctx.stroke()
  ctx.restore()
}

function fog(g: Game, v: View, layer: HTMLCanvasElement | OffscreenCanvas, ctx: CanvasRenderingContext2D) {
  if (g.fogRadius <= 0) return
  const f = layer.getContext('2d') as CanvasRenderingContext2D | null
  if (!f) return
  const clear = g.fogClear > 0 ? tuning.farol.wideVision * Math.min(1, g.fogClear / 0.5) : 0
  const radius = Math.max(g.fogRadius, clear) * v.scale
  f.clearRect(0, 0, layer.width, layer.height)
  f.fillStyle = g.fogTone === 'sand' ? 'rgba(122,88,50,0.9)' : 'rgba(12,8,18,0.93)'; f.fillRect(0, 0, v.w, v.h)
  f.globalCompositeOperation = 'destination-out'
  const px = (g.player.x - v.camX) * v.scale, py = (g.player.y - v.camY) * v.scale
  const grad = f.createRadialGradient(px, py, radius * 0.35, px, py, radius); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
  f.fillStyle = grad; f.beginPath(); f.arc(px, py, radius, 0, 7); f.fill()
  // faróis acesos (e o Farol cravado) iluminam a própria área
  for (const l of g.lights) { const lx = (l.x - v.camX) * v.scale, ly = (l.y - v.camY) * v.scale, lr = l.r * v.scale; const lg = f.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = lg; f.beginPath(); f.arc(lx, ly, lr, 0, 7); f.fill() }
  f.globalCompositeOperation = 'source-over'
  ctx.drawImage(layer as CanvasImageSource, 0, 0, v.w, v.h)
}

function altar(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.mode !== 'farol') return
  const f = g.farol, { x, y } = f.altar, t = g.time
  ctx.save(); ctx.translate(x, y)
  ctx.strokeStyle = f.stage === 'advance' ? 'rgba(255,140,60,.55)' : 'rgba(255,214,150,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 20
  ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.stroke(); ctx.setLineDash([])
  const tower = arenaArt('farol'), lit = f.stage === 'defend' ? f.hp / tuning.farol.beaconHp : f.stage === 'plant' ? 0.45 : 0.25
  if (tower) {
    // aura luminosa atrás do Farol: mais forte quando ele está cravado
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const ar = 150 + Math.sin(t * 3) * 8, aura = ctx.createRadialGradient(0, -40, 10, 0, -40, ar); aura.addColorStop(0, `rgba(255,170,80,${0.15 + 0.4 * lit})`); aura.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = aura; ctx.beginPath(); ctx.arc(0, -40, ar, 0, 7); ctx.fill(); ctx.restore()
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(6, 26, 46, 14, 0, 0, 7); ctx.fill()
    ctx.globalAlpha = f.stage === 'advance' ? 0.72 : 1; { const th = 170, tw = th * tower.naturalWidth / tower.naturalHeight; ctx.drawImage(tower, -tw / 2, -th + 14, tw, th) }; ctx.globalAlpha = 1
  } else {
    ctx.fillStyle = '#2d2520'; ctx.beginPath(); ctx.rect(-34, -12, 68, 40); ctx.fill(); ctx.strokeStyle = 'rgba(255,170,100,.4)'; ctx.lineWidth = 2; ctx.stroke()
  }
  if (f.stage === 'plant') { ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 80, -Math.PI / 2, -Math.PI / 2 + (f.plant / tuning.farol.plant) * Math.PI * 2); ctx.stroke() }
  if (f.stage === 'defend') {
    const hp = f.hp / tuning.farol.beaconHp
    const glow = ctx.createRadialGradient(0, -34, 4, 0, -34, 120); glow.addColorStop(0, `rgba(255,220,150,${0.55 * hp + 0.2})`); glow.addColorStop(1, 'rgba(255,160,70,0)')
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -34, 120, 0, 7); ctx.fill()
    if (!tower) {
      ctx.fillStyle = gold; ctx.shadowColor = ember; ctx.shadowBlur = 24
      ctx.beginPath(); ctx.moveTo(0, -78 + Math.sin(t * 6) * 2); ctx.lineTo(14, -34); ctx.lineTo(0, -12); ctx.lineTo(-14, -34); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0
    }
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-40, 38, 80, 6); ctx.fillStyle = hp > 0.35 ? '#ffc067' : '#ff5a3a'; ctx.fillRect(-40, 38, 80 * hp, 6)
  }
  ctx.restore()
}

// O próximo objetivo da fase com lugar no mapa: Farol da vez, torre ou selo mais perto.
export function storyTarget(g: Game): { x: number; y: number } | null {
  const st = g.story
  if (!st) return null
  const beacon = st.phase.objectives.some(o => o.kind === 'beacons') ? st.beacons.find(b => !b.lit) : undefined
  if (beacon) return beacon
  const list = [...st.towers.filter(t => !t.down), ...st.seals.filter(s => !s.broken)]
  const p = g.player
  return list.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] ?? null
}

function storyLayer(ctx: CanvasRenderingContext2D, g: Game) {
  const st = g.story
  if (!st) return
  const t = g.time
  for (const z of st.zones) {
    ctx.save(); ctx.translate(z.x, z.y)
    ctx.fillStyle = z.warm > 0 ? 'rgba(150,100,230,.08)' : 'rgba(130,70,220,.2)'; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.fill()
    ctx.strokeStyle = z.warm > 0 ? 'rgba(200,170,255,.5)' : 'rgba(190,150,255,.75)'; ctx.lineWidth = 3; ctx.setLineDash([12, 10]); ctx.lineDashOffset = -t * 18; ctx.beginPath(); ctx.arc(0, 0, z.r, 0, 7); ctx.stroke(); ctx.setLineDash([])
    ctx.fillStyle = 'rgba(210,180,255,.8)'; ctx.font = '700 12px "Plus Jakarta Sans", Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('SILÊNCIO', 0, 4)
    ctx.restore()
  }
  const next = st.beacons.find(b => !b.lit)
  for (const b of st.beacons) {
    ctx.save(); ctx.translate(b.x, b.y)
    ctx.fillStyle = '#2d2520'; ctx.beginPath(); ctx.arc(0, 8, 22, 0, 7); ctx.fill()
    if (b.lit) { const gl = ctx.createRadialGradient(0, -14, 2, 0, -14, 90); gl.addColorStop(0, 'rgba(255,225,160,.8)'); gl.addColorStop(1, 'rgba(255,150,60,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, -14, 90, 0, 7); ctx.fill(); ctx.fillStyle = '#ffd9a8'; ctx.beginPath(); ctx.moveTo(0, -42 + Math.sin(t * 7) * 2); ctx.lineTo(10, -14); ctx.lineTo(0, 2); ctx.lineTo(-10, -14); ctx.closePath(); ctx.fill() }
    else { ctx.strokeStyle = b === next ? `rgba(255,190,120,${0.5 + 0.4 * Math.sin(t * 5)})` : 'rgba(150,130,120,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 80, 0, 7); ctx.stroke(); ctx.fillStyle = 'rgba(120,100,90,.8)'; ctx.fillRect(-6, -22, 12, 26)
      if (b.progress > 0) { ctx.strokeStyle = '#ffd9a8'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 66, -Math.PI / 2, -Math.PI / 2 + (b.progress / 2) * Math.PI * 2); ctx.stroke() } }
    ctx.restore()
  }
  for (const tw of st.towers) {
    ctx.save(); ctx.translate(tw.x, tw.y)
    ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(8, 14, 30, 16, 0, 0, 7); ctx.fill()
    ctx.fillStyle = tw.down ? '#3a332e' : '#4a3f38'; ctx.fillRect(-20, -30, 40, 46)
    if (!tw.down) { ctx.fillStyle = '#ff7a2e'; ctx.shadowColor = '#ff7a2e'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(0, -34, 9 + Math.sin(t * 6), 0, 7); ctx.fill(); ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-22, 22, 44, 5); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(-22, 22, 44 * (tw.hp / tw.maxHp), 5) }
    ctx.restore()
  }
  for (const sl of st.seals) {
    ctx.save(); ctx.translate(sl.x, sl.y)
    ctx.strokeStyle = sl.broken ? 'rgba(160,140,130,.3)' : '#ffb36b'; ctx.lineWidth = sl.broken ? 2 : 4; ctx.shadowColor = '#ff8a3a'; ctx.shadowBlur = sl.broken ? 0 : 16
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(18, 0); ctx.moveTo(0, -18); ctx.lineTo(0, 18); ctx.stroke(); ctx.shadowBlur = 0
    if (!sl.broken) { ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-24, 38, 48, 5); ctx.fillStyle = '#ffb36b'; ctx.fillRect(-24, 38, 48 * (sl.hp / sl.maxHp), 5) }
    ctx.restore()
  }
  for (const tg of st.telegraphs) { const k = 1 - tg.t / tg.max; ctx.fillStyle = `rgba(255,70,40,${0.12 + 0.2 * k})`; ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,110,70,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * k, 0, 7); ctx.stroke() }
}

export function render(ctx: CanvasRenderingContext2D, g: Game, v: View, fogLayer?: HTMLCanvasElement | OffscreenCanvas) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0c0a0d'; ctx.fillRect(0, 0, v.w, v.h)
  ctx.setTransform(v.scale, 0, 0, v.scale, -v.camX * v.scale, -v.camY * v.scale)
  ground(ctx, g, v)
  playerLight(ctx, g)
  castShadows(ctx, g)
  altar(ctx, g)
  storyLayer(ctx, g)
  for (const o of g.obstacles) pillar(ctx, o.x, o.y, o.r, g.player)
  // ondas do Pulso e do Consumado
  if (g.pulse) { const k = g.pulse.t / tuning.pulseTime; ctx.strokeStyle = `rgba(255,214,160,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(g.pulse.x, g.pulse.y, tuning.pulseRadius * k, 0, 7); ctx.stroke() }
  for (const e of g.enemies) enemy(ctx, g, e)
  for (const q of g.particles) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill() }
  ctx.globalAlpha = 1
  for (const b of g.projectiles) {
    const friendly = b.from === 'player'
    ctx.strokeStyle = friendly ? (b.crit || b.reflected ? '#fff0c8' : gold) : '#ff5a3a'; ctx.lineWidth = friendly ? 4 : 3; ctx.lineCap = 'round'; ctx.shadowColor = friendly ? ember : '#ff3a2a'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke()
    // trilha de partículas: pontos que encolhem e esmaecem atrás do projétil, com leve tremor
    ctx.shadowBlur = 0; ctx.fillStyle = friendly ? (b.crit || b.reflected ? '#fff0c8' : '#ffc27a') : '#ff7a5a'
    for (let i = 1; i <= 5; i++) {
      const k = i / 5, j = hash2(i + Math.floor(g.time * 30), b.x * 0.01 + b.y * 0.013)
      ctx.globalAlpha = 0.7 * (1 - k); ctx.beginPath(); ctx.arc(b.x - b.vx * 0.022 * (1 + k * 2.4) + (j - 0.5) * 5, b.y - b.vy * 0.022 * (1 + k * 2.4) + (j - 0.5) * 5, 2.6 * (1 - k * 0.7), 0, 7); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 10
  }
  ctx.shadowBlur = 0
  player(ctx, g)
  shieldArc(ctx, g)
  if (g.nova) {
    const k = g.nova.t / tuning.novaTime, r = tuning.novaRadius * Math.min(1, k * 1.5)
    const grad = ctx.createRadialGradient(g.nova.x, g.nova.y, 0, g.nova.x, g.nova.y, Math.max(r, 1)); grad.addColorStop(0, `rgba(255,236,170,${0.85 * (1 - k)})`); grad.addColorStop(0.6, `rgba(255,150,60,${0.45 * (1 - k)})`); grad.addColorStop(1, 'rgba(255,120,40,0)')
    ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(g.nova.x, g.nova.y, r, 0, 7); ctx.fill()
    ctx.strokeStyle = `rgba(255,224,150,${1 - k})`; ctx.lineWidth = 8 * (1 - k) + 1; ctx.beginPath(); ctx.arc(g.nova.x, g.nova.y, r, 0, 7); ctx.stroke()
  }
  for (const f of g.floats) { ctx.globalAlpha = Math.min(1, f.life * 2); ctx.fillStyle = f.color; ctx.font = '700 14px "Plus Jakarta Sans", Inter, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y) }
  ctx.globalAlpha = 1
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (fogLayer) fog(g, v, fogLayer, ctx)
  if (g.story?.storm?.on) { ctx.strokeStyle = 'rgba(255,225,170,.16)'; ctx.lineWidth = 2; const a = g.story.storm.dir; for (let i = 0; i < 46; i++) { const x = ((i * 137 + g.time * 420 * Math.cos(a)) % v.w + v.w) % v.w, y = ((i * 91 + g.time * 420 * Math.sin(a)) % v.h + v.h) % v.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 46, y + Math.sin(a) * 46); ctx.stroke() } }
  const target = storyTarget(g)
  if (target) {
    const px = (g.player.x - v.camX) * v.scale, py = (g.player.y - v.camY) * v.scale, d = Math.hypot(target.x - g.player.x, target.y - g.player.y)
    if (d > 140) {
      const a = Math.atan2(target.y - g.player.y, target.x - g.player.x), r = 64 * v.scale
      ctx.save(); ctx.translate(px + Math.cos(a) * r, py + Math.sin(a) * r); ctx.rotate(a)
      ctx.fillStyle = `rgba(255,190,120,${0.6 + 0.3 * Math.sin(g.time * 5)})`; ctx.shadowColor = '#ff7a2e'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(12 * v.scale, 0); ctx.lineTo(-8 * v.scale, 8 * v.scale); ctx.lineTo(-3 * v.scale, 0); ctx.lineTo(-8 * v.scale, -8 * v.scale); ctx.closePath(); ctx.fill(); ctx.restore()
    }
  }
  // vinheta e alerta de dano
  const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, g.player.flash > 0 ? 'rgba(160,20,10,.5)' : 'rgba(0,0,0,.55)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h)
}

// Minimapa: mesmo estado, escala pequena.
export function renderMinimap(ctx: CanvasRenderingContext2D, g: Game, w: number, h: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h)
  const s = Math.min(w / g.w, h / g.h), ox = (w - g.w * s) / 2, oy = (h - g.h * s) / 2
  ctx.fillStyle = 'rgba(14,11,14,.85)'; ctx.fillRect(ox, oy, g.w * s, g.h * s)
  ctx.fillStyle = 'rgba(120,100,90,.7)'; for (const o of g.obstacles) { ctx.beginPath(); ctx.arc(ox + o.x * s, oy + o.y * s, Math.max(1.5, o.r * s), 0, 7); ctx.fill() }
  if (g.mode === 'farol') { ctx.fillStyle = g.farol.stage === 'defend' ? '#ffd9a8' : ember; ctx.beginPath(); ctx.arc(ox + g.farol.altar.x * s, oy + g.farol.altar.y * s, 4, 0, 7); ctx.fill() }
  if (g.story) {
    for (const b of g.story.beacons) { ctx.fillStyle = b.lit ? '#ffd9a8' : ember; ctx.beginPath(); ctx.arc(ox + b.x * s, oy + b.y * s, b.lit ? 4 : 3, 0, 7); ctx.fill() }
    ctx.fillStyle = '#ff9a52'; for (const t of g.story.towers) if (!t.down) ctx.fillRect(ox + t.x * s - 3, oy + t.y * s - 3, 6, 6)
    ctx.strokeStyle = '#ffb36b'; for (const sl of g.story.seals) if (!sl.broken) { ctx.beginPath(); ctx.arc(ox + sl.x * s, oy + sl.y * s, 4, 0, 7); ctx.stroke() }
    ctx.fillStyle = 'rgba(160,100,230,.45)'; for (const z of g.story.zones) { ctx.beginPath(); ctx.arc(ox + z.x * s, oy + z.y * s, z.r * s, 0, 7); ctx.fill() }
  }
  ctx.fillStyle = '#ff4a3a'; for (const e of g.enemies) if (isVisible(g, e) || e.revealed > 0) ctx.fillRect(ox + e.x * s - 1.5, oy + e.y * s - 1.5, 3, 3)
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + g.player.x * s, oy + g.player.y * s, 3.2, 0, 7); ctx.fill()
}
