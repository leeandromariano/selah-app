// CORAM // LOGOS: desenho da arena no canvas. Só lê o estado da simulação; nada aqui passa pelo React.
import { isVisible, tuning, type Enemy, type Game } from './sim'

const ember = '#ff7a2e', gold = '#ffd9a8', cream = '#f5e6c8'

export type View = { w: number; h: number; scale: number; camX: number; camY: number }

export function makeView(g: Game, w: number, h: number): View {
  const scale = Math.max(0.55, Math.min(1.35, h / 720))
  const vw = w / scale, vh = h / scale
  const camX = vw >= g.w ? (g.w - vw) / 2 : Math.max(0, Math.min(g.w - vw, g.player.x - vw / 2))
  const camY = vh >= g.h ? (g.h - vh) / 2 : Math.max(0, Math.min(g.h - vh, g.player.y - vh / 2))
  return { w, h, scale, camX, camY }
}
export const toWorld = (v: View, sx: number, sy: number) => ({ x: sx / v.scale + v.camX, y: sy / v.scale + v.camY })

function ground(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.fillStyle = '#15110f'; ctx.fillRect(0, 0, g.w, g.h)
  const tile = 80
  const x0 = Math.max(0, Math.floor(v.camX / tile) * tile), y0 = Math.max(0, Math.floor(v.camY / tile) * tile)
  const x1 = Math.min(g.w, v.camX + v.w / v.scale + tile), y1 = Math.min(g.h, v.camY + v.h / v.scale + tile)
  ctx.lineWidth = 1
  for (let x = x0; x <= x1; x += tile) for (let y = y0; y <= y1; y += tile) {
    const shade = ((x / tile + y / tile) & 1) ? 'rgba(255,255,255,.028)' : 'rgba(0,0,0,.16)'
    ctx.fillStyle = shade; ctx.fillRect(x, y, tile, tile)
  }
  ctx.strokeStyle = 'rgba(255,140,60,.07)'; ctx.strokeRect(1, 1, g.w - 2, g.h - 2)
  ctx.strokeStyle = 'rgba(255,140,60,.35)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, g.w, g.h)
}

function pillar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(x + 8, y + 10, r, r * 0.82, 0, 0, 7); ctx.fill()
  const grad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r)
  grad.addColorStop(0, '#6b5f55'); grad.addColorStop(1, '#2c2622')
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
  ctx.strokeStyle = 'rgba(255,170,100,.25)'; ctx.lineWidth = 2; ctx.stroke()
}

function enemy(ctx: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const vis = isVisible(g, e)
  const alpha = vis ? 1 : 0.16
  ctx.save(); ctx.globalAlpha = alpha; ctx.translate(e.x, e.y)
  const toward = Math.atan2(g.player.y - e.y, g.player.x - e.x)
  const wob = Math.sin(e.wob) * 2
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(4, e.r * 0.7, e.r, e.r * 0.5, 0, 0, 7); ctx.fill()
  const body = e.kind === 'brutamontes' ? '#2a1330' : e.kind === 'fantasma' ? '#241a33' : e.kind === 'dardo' ? '#2b1a2a' : '#211724'
  const grad = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r + 4)
  grad.addColorStop(0, e.hit > 0 ? '#ffe1c2' : '#4a2e55'); grad.addColorStop(1, e.hit > 0 ? '#ff9d5c' : body)
  ctx.fillStyle = grad
  ctx.beginPath(); ctx.arc(0, wob * 0.3, e.r + wob * 0.3, 0, 7); ctx.fill()
  if (e.kind === 'brutamontes' || e.kind === 'dardo') { // chifres
    ctx.strokeStyle = '#120a16'; ctx.lineWidth = 4; ctx.lineCap = 'round'
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * e.r * 0.5, -e.r * 0.7); ctx.lineTo(s * e.r * 0.95, -e.r * 1.35); ctx.stroke() }
  }
  if (e.armor > 0) { ctx.strokeStyle = 'rgba(255,170,90,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, e.r + 5, 0, (e.armor / e.maxArmor) * Math.PI * 2); ctx.stroke() }
  ctx.fillStyle = '#ff3a2a'; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 8
  const ex = Math.cos(toward) * e.r * 0.25, ey = Math.sin(toward) * e.r * 0.25
  ctx.beginPath(); ctx.arc(ex - e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.arc(ex + e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.fill()
  ctx.restore()
  if (vis && e.hp < e.maxHp && e.hp > 0) { const w = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w, 4); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(e.x - w / 2, e.y - e.r - 14, w * (e.hp / e.maxHp), 4) }
}

function player(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  ctx.save(); ctx.translate(p.x, p.y)
  if (p.dashT > 0) { ctx.strokeStyle = 'rgba(255,190,120,.5)'; ctx.lineWidth = p.r * 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-p.dashDx * 0.07, -p.dashDy * 0.07); ctx.stroke() }
  ctx.fillStyle = 'rgba(0,0,0,.4)'; ctx.beginPath(); ctx.ellipse(4, p.r * 0.75, p.r, p.r * 0.5, 0, 0, 7); ctx.fill()
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, p.r * 2.6); glow.addColorStop(0, 'rgba(255,160,70,.35)'); glow.addColorStop(1, 'rgba(255,160,70,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, p.r * 2.6, 0, 7); ctx.fill()
  ctx.rotate(p.aim)
  // espada em brasa
  ctx.strokeStyle = ember; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.shadowColor = ember; ctx.shadowBlur = 14
  ctx.beginPath(); ctx.moveTo(p.r * 0.4, 6); ctx.lineTo(p.r + 26, 4); ctx.stroke()
  ctx.strokeStyle = gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.r * 0.5, 6); ctx.lineTo(p.r + 24, 4); ctx.stroke(); ctx.shadowBlur = 0
  // corpo: capa creme e capuz
  ctx.fillStyle = p.flash > 0 ? '#ffb1a0' : cream; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill()
  ctx.fillStyle = '#b08a5a'; ctx.beginPath(); ctx.arc(-3, 0, p.r * 0.62, 0, 7); ctx.fill()
  ctx.fillStyle = '#3a2a1c'; ctx.beginPath(); ctx.arc(p.r * 0.28, 0, p.r * 0.34, 0, 7); ctx.fill()
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
  if (g.mode !== 'farol') return
  const f = layer.getContext('2d') as CanvasRenderingContext2D | null
  if (!f) return
  const clear = g.fogClear > 0 ? tuning.farol.wideVision * Math.min(1, g.fogClear / 0.5 + 0.0) : tuning.farol.vision
  const radius = Math.max(tuning.farol.vision, clear) * v.scale
  f.clearRect(0, 0, layer.width, layer.height)
  f.fillStyle = 'rgba(12,8,18,0.93)'; f.fillRect(0, 0, v.w, v.h)
  f.globalCompositeOperation = 'destination-out'
  const px = (g.player.x - v.camX) * v.scale, py = (g.player.y - v.camY) * v.scale
  const grad = f.createRadialGradient(px, py, radius * 0.35, px, py, radius); grad.addColorStop(0, 'rgba(0,0,0,1)'); grad.addColorStop(1, 'rgba(0,0,0,0)')
  f.fillStyle = grad; f.beginPath(); f.arc(px, py, radius, 0, 7); f.fill()
  // o Farol cravado ilumina a própria área
  if (g.farol.stage === 'defend') { const ax = (g.farol.altar.x - v.camX) * v.scale, ay = (g.farol.altar.y - v.camY) * v.scale, ar = 360 * v.scale; const lg = f.createRadialGradient(ax, ay, ar * 0.2, ax, ay, ar); lg.addColorStop(0, 'rgba(0,0,0,1)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); f.fillStyle = lg; f.beginPath(); f.arc(ax, ay, ar, 0, 7); f.fill() }
  f.globalCompositeOperation = 'source-over'
  ctx.drawImage(layer as CanvasImageSource, 0, 0, v.w, v.h)
}

function altar(ctx: CanvasRenderingContext2D, g: Game) {
  if (g.mode !== 'farol') return
  const f = g.farol, { x, y } = f.altar, t = g.time
  ctx.save(); ctx.translate(x, y)
  ctx.strokeStyle = f.stage === 'advance' ? 'rgba(255,140,60,.55)' : 'rgba(255,214,150,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 20
  ctx.beginPath(); ctx.arc(0, 0, 95, 0, 7); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#2d2520'; ctx.beginPath(); ctx.rect(-34, -12, 68, 40); ctx.fill(); ctx.strokeStyle = 'rgba(255,170,100,.4)'; ctx.lineWidth = 2; ctx.stroke()
  if (f.stage === 'plant') { ctx.strokeStyle = gold; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 80, -Math.PI / 2, -Math.PI / 2 + (f.plant / tuning.farol.plant) * Math.PI * 2); ctx.stroke() }
  if (f.stage === 'defend') {
    const hp = f.hp / tuning.farol.beaconHp
    const glow = ctx.createRadialGradient(0, -34, 4, 0, -34, 120); glow.addColorStop(0, `rgba(255,220,150,${0.55 * hp + 0.2})`); glow.addColorStop(1, 'rgba(255,160,70,0)')
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -34, 120, 0, 7); ctx.fill()
    ctx.fillStyle = gold; ctx.shadowColor = ember; ctx.shadowBlur = 24
    ctx.beginPath(); ctx.moveTo(0, -78 + Math.sin(t * 6) * 2); ctx.lineTo(14, -34); ctx.lineTo(0, -12); ctx.lineTo(-14, -34); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(-40, 38, 80, 6); ctx.fillStyle = hp > 0.35 ? '#ffc067' : '#ff5a3a'; ctx.fillRect(-40, 38, 80 * hp, 6)
  }
  ctx.restore()
}

export function render(ctx: CanvasRenderingContext2D, g: Game, v: View, fogLayer?: HTMLCanvasElement | OffscreenCanvas) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0c0a0d'; ctx.fillRect(0, 0, v.w, v.h)
  ctx.setTransform(v.scale, 0, 0, v.scale, -v.camX * v.scale, -v.camY * v.scale)
  ground(ctx, g, v)
  altar(ctx, g)
  for (const o of g.obstacles) pillar(ctx, o.x, o.y, o.r)
  // ondas do Pulso e do Consumado
  if (g.pulse) { const k = g.pulse.t / tuning.pulseTime; ctx.strokeStyle = `rgba(255,214,160,${1 - k})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.beginPath(); ctx.arc(g.pulse.x, g.pulse.y, tuning.pulseRadius * k, 0, 7); ctx.stroke() }
  for (const e of g.enemies) enemy(ctx, g, e)
  for (const q of g.particles) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill() }
  ctx.globalAlpha = 1
  for (const b of g.projectiles) {
    const friendly = b.from === 'player'
    ctx.strokeStyle = friendly ? (b.crit || b.reflected ? '#fff0c8' : gold) : '#ff5a3a'; ctx.lineWidth = friendly ? 4 : 3; ctx.lineCap = 'round'; ctx.shadowColor = friendly ? ember : '#ff3a2a'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke()
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
  ctx.fillStyle = '#ff4a3a'; for (const e of g.enemies) if (isVisible(g, e) || e.revealed > 0) ctx.fillRect(ox + e.x * s - 1.5, oy + e.y * s - 1.5, 3, 3)
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + g.player.x * s, oy + g.player.y * s, 3.2, 0, 7); ctx.fill()
}
