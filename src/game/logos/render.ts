// CORAM // LOGOS: desenho da arena no canvas. Só lê o estado da simulação; nada aqui passa pelo React.
import { isVisible, tuning, type Enemy, type Game } from './sim'

const bossColor = { tentador: '#4a2c6a', sentinela: '#1d2233', acusador: '#4a2222', dragao: '#5a1a12' } as const

const ember = '#ff7a2e', gold = '#ffd9a8'

export type View = { w: number; h: number; scale: number; camX: number; camY: number }

// Inclinação tática 2.5D: a física segue em 2D puro; só o desenho achata o chão na vertical (0,82) e desenha as figuras em pé.
export const TILT = 0.82

export function makeView(g: Game, w: number, h: number): View {
  // câmera próxima, como no vídeo de referência: o Portador ocupa cerca de um terço da altura da tela
  const scale = Math.max(0.9, Math.min(2.3, (h / 720) * 1.65))
  const vw = w / scale, vh = h / (scale * TILT)
  const camX = vw >= g.w ? (g.w - vw) / 2 : Math.max(0, Math.min(g.w - vw, g.player.x - vw / 2))
  const camY = vh >= g.h ? (g.h - vh) / 2 : Math.max(0, Math.min(g.h - vh, g.player.y - vh / 2))
  return { w, h, scale, camX, camY }
}
export const toWorld = (v: View, sx: number, sy: number) => ({ x: sx / v.scale + v.camX, y: sy / (v.scale * TILT) + v.camY })

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

// Recorte dos sprites 3D num canvas fora da tela, feito uma única vez quando a imagem carrega (nada disso roda no loop de 60 fps):
// o fundo escuro ligado às bordas some (preenchimento a partir da borda, então a armadura escura por dentro é preservada) e, se pedido, corta a base e esmaece o pé.
export type Sprite = { src: CanvasImageSource; w: number; h: number }
type SpriteOpts = { key?: boolean; crop?: number; max?: number; gain?: number; contrast?: number }
const ENEMY_OPTS: SpriteOpts = { key: true, gain: 1.35 }
const PLAYER_OPTS: SpriteOpts = { crop: 0.8, max: 420, gain: 1.25, contrast: 1.08 }
// brilho e contraste aplicados uma única vez no recorte (nada disso roda no loop)
function lift(d: Uint8ClampedArray, gain: number, contrast: number) {
  for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; for (let c = 0; c < 3; c++) d[i + c] = Math.max(0, Math.min(255, ((d[i + c] / 255 - 0.5) * contrast + 0.5) * 255 * gain)) }
}
const spriteCache = new Map<string, Sprite | null>()

function floodKey(d: Uint8ClampedArray, w: number, h: number, thr = 46) {
  const seen = new Uint8Array(w * h), stack: number[] = []
  const dark = (i: number) => Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) < thr
  const push = (i: number) => { if (!seen[i] && dark(i)) { seen[i] = 1; stack.push(i) } }
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x) }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1) }
  while (stack.length) {
    const i = stack.pop() as number, x = i % w, y = (i / w) | 0
    d[i * 4 + 3] = 0
    if (x > 0) push(i - 1)
    if (x < w - 1) push(i + 1)
    if (y > 0) push(i - w)
    if (y < h - 1) push(i + w)
  }
  // borda macia: pixel escuro colado no fundo removido fica meio transparente
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x
    if (seen[i] || Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]) >= thr + 26) continue
    if (seen[i - 1] || seen[i + 1] || seen[i - w] || seen[i + w]) d[i * 4 + 3] = d[i * 4 + 3] >> 1
  }
}
function fadeBottom(d: Uint8ClampedArray, w: number, h: number, frac: number) {
  const rows = Math.max(1, Math.round(h * frac))
  for (let r = 0; r < rows; r++) { const y = h - rows + r, keep = 1 - ((r + 1) / rows) ** 1.5; for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] *= keep }
}

export function arenaSprite(name: string, opts: SpriteOpts = {}): Sprite | null {
  const img = arenaArt(name)
  if (!img) return null
  const cached = spriteCache.get(name)
  if (cached !== undefined) return cached ?? { src: img, w: img.naturalWidth, h: img.naturalHeight }
  let out: Sprite | null = null
  try {
    const crop = opts.crop ?? 1, k = Math.min(1, (opts.max ?? 512) / Math.max(img.naturalWidth, img.naturalHeight))
    const sw = img.naturalWidth, sh = Math.round(img.naturalHeight * crop), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k))
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const c = cv.getContext('2d', { willReadFrequently: true })
    if (c) {
      c.drawImage(img, 0, 0, sw, sh, 0, 0, w, h)
      const data = c.getImageData(0, 0, w, h)
      if (opts.key) floodKey(data.data, w, h)
      if (crop < 1) fadeBottom(data.data, w, h, 0.08)
      if (opts.gain) lift(data.data, opts.gain, opts.contrast ?? 1)
      c.putImageData(data, 0, 0); out = { src: cv, w, h }
    }
  } catch { out = null }
  spriteCache.set(name, out)
  return out ?? { src: img, w: img.naturalWidth, h: img.naturalHeight }
}

// Piso de pedra escura (#0D0E11): lajes irregulares com variação de tom determinística, juntas finas e vinheta radial sobre a arena inteira.
const hash2 = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n) }
function ground(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.fillStyle = '#0D0E11'; ctx.fillRect(0, 0, g.w, g.h)
  const tile = 80, p = g.player
  const x0 = Math.max(0, Math.floor(v.camX / tile) * tile), y0 = Math.max(0, Math.floor(v.camY / tile) * tile)
  const x1 = Math.min(g.w, v.camX + v.w / v.scale + tile), y1 = Math.min(g.h, v.camY + v.h / (v.scale * TILT) + tile)
  ctx.lineWidth = 1
  for (let x = x0; x <= x1; x += tile) for (let y = y0; y <= y1; y += tile) {
    const h = hash2(x / tile, y / tile)
    // lajes de obsidiana: duas tonalidades (#0D0E11 / #14161C) com variação por laje
    ctx.fillStyle = h > 0.5 ? `rgba(20,22,28,${0.55 + (h - 0.5) * 0.9})` : `rgba(0,0,0,${0.06 + (0.5 - h) * 0.3})`
    ctx.fillRect(x, y, tile, tile)
    if (h > 0.7) { // rachaduras: uma linha principal com um ramo, mais clara na borda
      const k = hash2(x * 0.37, y * 0.91)
      ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + h * 30, y + 6); ctx.lineTo(x + 30 + k * 26, y + tile * 0.5); ctx.lineTo(x + 18 + k * 30, y + tile - 6); ctx.moveTo(x + 30 + k * 26, y + tile * 0.5); ctx.lineTo(x + tile - 8, y + tile * 0.62); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + h * 30 + 2, y + 6); ctx.lineTo(x + 32 + k * 26, y + tile * 0.5); ctx.stroke()
    }
    if (h < 0.1) ruin(ctx, x, y, tile, hash2(y / tile, x / tile)) // lajes soltas e muros caídos, com contraste baixo
    else if (h < 0.26) rune(ctx, x + tile / 2, y + tile / 2, h, Math.hypot(p.x - x - tile / 2, p.y - y - tile / 2), g.time)
  }
  // juntas esculpidas: sulco escuro com um fio de luz no lado de baixo/direita
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,.6)'
  for (let x = x0; x <= x1; x += tile) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke() }
  for (let y = y0; y <= y1; y += tile) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke() }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.045)'
  for (let x = x0; x <= x1; x += tile) { ctx.beginPath(); ctx.moveTo(x + 2, y0); ctx.lineTo(x + 2, y1); ctx.stroke() }
  for (let y = y0; y <= y1; y += tile) { ctx.beginPath(); ctx.moveTo(x0, y + 2); ctx.lineTo(x1, y + 2); ctx.stroke() }
  const vg = ctx.createRadialGradient(g.w / 2, g.h / 2, Math.min(g.w, g.h) * 0.25, g.w / 2, g.h / 2, Math.hypot(g.w, g.h) * 0.52)
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, g.w, g.h)
}

// Runa geométrica gravada no piso: apagada de longe e acesa em laranja (rgba(255,85,0,.18)) quando o Portador passa perto.
function rune(ctx: CanvasRenderingContext2D, cx: number, cy: number, h: number, dist: number, t: number) {
  const near = Math.max(0, 1 - dist / 320), a = 0.05 + (0.18 - 0.05) * near * (0.85 + 0.15 * Math.sin(t * 3 + h * 40))
  ctx.save(); ctx.translate(cx, cy); ctx.strokeStyle = `rgba(255,85,0,${a})`; ctx.lineWidth = 1.6
  if (near > 0.05) { ctx.shadowColor = 'rgba(255,85,0,.6)'; ctx.shadowBlur = 8 * near }
  const kind = Math.floor(h * 100) % 3, r = 22
  ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke()
  ctx.beginPath()
  if (kind === 0) { ctx.moveTo(0, -r); ctx.lineTo(r, 0); ctx.lineTo(0, r); ctx.lineTo(-r, 0); ctx.closePath() }
  else if (kind === 1) { ctx.moveTo(0, -r); ctx.lineTo(r * 0.87, r * 0.5); ctx.lineTo(-r * 0.87, r * 0.5); ctx.closePath() }
  else { ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.moveTo(-r * 0.7, -r * 0.7); ctx.lineTo(r * 0.7, r * 0.7); ctx.moveTo(r * 0.7, -r * 0.7); ctx.lineTo(-r * 0.7, r * 0.7) }
  ctx.stroke(); ctx.restore()
}

// Muros quebrados nas bordas da arena: blocos de pedra com falhas (entulho no lugar) e a face da frente mais escura.
function walls(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const B = 44, bw = 72
  const vx0 = v.camX - 80, vx1 = v.camX + v.w / v.scale + 80, vy0 = v.camY - 80, vy1 = v.camY + v.h / (v.scale * TILT) + 80
  const block = (x: number, y: number, w: number, h: number, k: number) => {
    if (x > vx1 || x + w < vx0 || y > vy1 || y + h < vy0) return
    if (k > 0.8) { ctx.fillStyle = '#1b1c22'; for (let i = 0; i < 3; i++) { const a = hash2(x + i, y * 0.3), b = hash2(y + i, x * 0.3); ctx.beginPath(); ctx.moveTo(x + a * w, y + b * h); ctx.lineTo(x + a * w + 9, y + b * h + 3); ctx.lineTo(x + a * w + 4, y + b * h + 10); ctx.closePath(); ctx.fill() } return }
    const gr = ctx.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, '#2a2c34'); gr.addColorStop(1, '#17181d')
    ctx.fillStyle = gr; ctx.fillRect(x, y, w - 2, h)
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x, y + h - 10, w - 2, 10)
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w - 2, h)
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + w - 4, y + 2); ctx.stroke()
    if (k < 0.18) { ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(x + w * 0.3, y); ctx.lineTo(x + w * 0.45, y + h * 0.5); ctx.lineTo(x + w * 0.35, y + h); ctx.stroke() }
  }
  for (let x = 0; x < g.w; x += bw) {
    block(x, 0, bw, B - 4 + hash2(x, 1) * 8, hash2(x * 0.7, 3))
    block(x, g.h - B - 4 + hash2(x, 2) * 8, bw, B, hash2(x * 0.7, 9))
  }
  for (let y = B; y < g.h - B; y += bw) {
    block(0, y, B - 4 + hash2(3, y) * 8, bw, hash2(5, y * 0.7))
    block(g.w - B, y, B, bw, hash2(8, y * 0.7))
  }
  // oclusão ambiente: a base dos muros escurece o piso ao redor
  const ao = (x: number, y: number, w: number, h: number, gx: number, gy: number, gx2: number, gy2: number) => { const l = ctx.createLinearGradient(gx, gy, gx2, gy2); l.addColorStop(0, 'rgba(0,0,0,.55)'); l.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = l; ctx.fillRect(x, y, w, h) }
  ao(B, B, g.w - 2 * B, 80, 0, B, 0, B + 80); ao(B, g.h - B - 80, g.w - 2 * B, 80, 0, g.h - B, 0, g.h - B - 80); ao(B, B, 80, g.h - 2 * B, B, 0, B + 80, 0); ao(g.w - B - 80, B, 80, g.h - 2 * B, g.w - B, 0, g.w - B - 80, 0)
  ctx.strokeStyle = 'rgba(255,140,60,.22)'; ctx.lineWidth = 3; ctx.strokeRect(B, B, g.w - B * 2, g.h - B * 2)
}

// Braseiros de Luz: 4 a 6 pontos fixos nos cantos e nas bordas; luz volumétrica quente por baixo do cenário e chama e fagulhas no desenho em pé.
const brazierSpots = (g: Game): [number, number][] => [[110, 110], [g.w - 110, 110], [110, g.h - 110], [g.w - 110, g.h - 110], [g.w / 2, 86], [g.w / 2, g.h - 86]]
function brazierLights(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  brazierSpots(g).forEach(([x, y], i) => {
    if (x < v.camX - 320 || x > v.camX + v.w / v.scale + 320 || y < v.camY - 320 || y > v.camY + v.h / (v.scale * TILT) + 320) return
    const fl = 0.85 + 0.15 * Math.sin(g.time * 9 + i * 1.7) + 0.06 * Math.sin(g.time * 23 + i)
    const l = ctx.createRadialGradient(x, y, 6, x, y, 300); l.addColorStop(0, `rgba(255,140,50,${0.34 * fl})`); l.addColorStop(0.5, `rgba(255,95,20,${0.1 * fl})`); l.addColorStop(1, 'rgba(255,85,0,0)')
    ctx.fillStyle = l; ctx.beginPath(); ctx.arc(x, y, 300, 0, 7); ctx.fill()
  })
  ctx.restore()
}
// Pira de pedra: base e coluna de pedra escura com juntas, tigela de metal com aro, núcleo de brasa incandescente (#FF5500 -> #FFF2CC), halo suave no piso, chamas e faíscas subindo.
function brazierBodies(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const t = g.time
  brazierSpots(g).forEach(([x, y], i) => {
    if (x < v.camX - 80 || x > v.camX + v.w / v.scale + 80 || y < v.camY - 80 || y > v.camY + v.h / (v.scale * TILT) + 200) return
    const fl = 0.85 + 0.15 * Math.sin(t * 9 + i * 1.7) + 0.06 * Math.sin(t * 23 + i)
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.ellipse(x + 5, y + 5, 32, 13, 0, 0, 7); ctx.fill()
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const halo = ctx.createRadialGradient(x, y + 4, 4, x, y + 4, 120); halo.addColorStop(0, `rgba(255,130,45,${0.3 * fl})`); halo.addColorStop(1, 'rgba(255,85,0,0)')
    ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(x, y + 4, 120, 0, 7); ctx.fill(); ctx.restore()
    stand(ctx, x, y, () => {
      ctx.scale(1.5, 1.5)
      // base de pedra
      const base = ctx.createLinearGradient(0, -10, 0, 0); base.addColorStop(0, '#3a3c46'); base.addColorStop(1, '#17181d')
      ctx.fillStyle = base; ctx.beginPath(); ctx.moveTo(-19, 0); ctx.lineTo(19, 0); ctx.lineTo(14, -10); ctx.lineTo(-14, -10); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.2; ctx.stroke()
      // coluna com juntas
      const col = ctx.createLinearGradient(-9, 0, 9, 0); col.addColorStop(0, '#16171c'); col.addColorStop(0.45, '#3d3f4a'); col.addColorStop(1, '#17181d')
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(-9, -10); ctx.lineTo(9, -10); ctx.lineTo(7, -25); ctx.lineTo(-7, -25); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.moveTo(-8.5, -16); ctx.lineTo(8.5, -16); ctx.moveTo(-7.6, -21); ctx.lineTo(7.6, -21); ctx.moveTo(-1, -10); ctx.lineTo(-1.5, -16); ctx.moveTo(2, -16); ctx.lineTo(2.4, -21); ctx.stroke()
      // luz da brasa tingindo a pedra
      ctx.fillStyle = `rgba(255,110,30,${0.12 * fl})`; ctx.fillRect(-9, -25, 18, 15)
      // tigela de metal
      const bowl = ctx.createLinearGradient(0, -36, 0, -23); bowl.addColorStop(0, '#8a7458'); bowl.addColorStop(0.5, '#4a3b2e'); bowl.addColorStop(1, '#1d1612')
      ctx.fillStyle = bowl; ctx.beginPath(); ctx.moveTo(-21, -35); ctx.lineTo(21, -35); ctx.lineTo(13, -23); ctx.lineTo(-13, -23); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = 'rgba(255,170,90,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-17, -31); ctx.lineTo(17, -31); ctx.stroke()
      ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(0, -35, 21, 5, 0, 0, 7); ctx.fill()
      ctx.strokeStyle = '#b8935c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(0, -35, 21, 5, 0, 0, 7); ctx.stroke()
      // núcleo de brasa
      const core = ctx.createRadialGradient(0, -35.5, 1, 0, -35.5, 16); core.addColorStop(0, '#FFF2CC'); core.addColorStop(0.35, '#FFAA44'); core.addColorStop(0.7, '#FF5500'); core.addColorStop(1, 'rgba(120,28,0,0)')
      ctx.fillStyle = core; ctx.globalAlpha = 0.85 + 0.15 * fl; ctx.beginPath(); ctx.ellipse(0, -35.5, 16, 3.6, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1
      ctx.save(); ctx.globalCompositeOperation = 'lighter'
      for (let k = 0; k < 3; k++) {
        const ph = t * 7 + i * 2 + k * 2.1, hgt = 24 + 9 * Math.sin(ph), w = 10 - k * 2.5, sway = Math.sin(ph * 0.7) * 3
        const fg = ctx.createLinearGradient(0, -36, 0, -36 - hgt); fg.addColorStop(0, 'rgba(255,90,10,.95)'); fg.addColorStop(0.6, 'rgba(255,170,60,.8)'); fg.addColorStop(1, 'rgba(255,230,160,0)')
        ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-w, -36); ctx.quadraticCurveTo(-w * 0.3, -36 - hgt * 0.6, sway, -36 - hgt); ctx.quadraticCurveTo(w * 0.3, -36 - hgt * 0.5, w, -36); ctx.closePath(); ctx.fill()
      }
      // fagulhas subindo sem parar
      for (let k = 0; k < 7; k++) {
        const ph = (t * 0.55 + k / 7 + i * 0.13) % 1, sx = Math.sin((ph + k) * 6.3) * 12 * ph
        ctx.fillStyle = `rgba(255,${150 + k * 12},60,${1 - ph})`; ctx.beginPath(); ctx.arc(sx, -40 - ph * 120, 2.1 * (1 - ph) + 0.5, 0, 7); ctx.fill()
      }
      ctx.restore()
    })
  })
}

// Névoa escura que flui pelas bordas da tela: fora do campo de visão a arena some em fumaça.
function mist(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const t = g.time, R = Math.max(v.w, v.h) * 0.3
  for (let i = 0; i < 7; i++) {
    const edge = i % 2 ? 0.1 : 0.9, along = ((i * 0.173 + t * 0.012 * (i % 2 ? 1 : -1)) % 1 + 1) % 1
    const cx = (i % 4 < 2 ? along : edge) * v.w, cy = (i % 4 < 2 ? edge : along) * v.h + Math.sin(t * 0.4 + i) * 20
    const gr = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R); gr.addColorStop(0, 'rgba(10,10,20,.5)'); gr.addColorStop(1, 'rgba(10,10,20,0)')
    ctx.fillStyle = gr; ctx.fillRect(cx - R, cy - R, R * 2, R * 2)
  }
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
    if (d < 8 || d > 600) continue
    const ux = dx / d, uy = dy / d, nx = -uy, ny = ux, len = 240 + (600 - d) * 0.6
    const grad = ctx.createLinearGradient(o.x, o.y, o.x + ux * len, o.y + uy * len)
    const a = 0.88 * (1 - d / 680); grad.addColorStop(0, `rgba(0,0,0,${a})`); grad.addColorStop(1, 'rgba(0,0,0,0)')
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

// Círculo rúnico #FF5500 sob os pés do Portador: poça de luz aditiva nas lajes, anéis, marcas girando e hexagrama.
function runeCircle(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player, t = g.time, R = 92
  ctx.save(); ctx.translate(p.x, p.y + p.r * 0.5); ctx.globalCompositeOperation = 'lighter'
  const pool = ctx.createRadialGradient(0, 0, 6, 0, 0, R * 1.7); pool.addColorStop(0, 'rgba(255,85,0,.26)'); pool.addColorStop(0.6, 'rgba(255,85,0,.08)'); pool.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, R * 1.7, 0, 7); ctx.fill()
  ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 10; ctx.strokeStyle = 'rgba(255,100,20,.6)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke()
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,140,60,.38)'; ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, 7); ctx.stroke()
  ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,160,80,.5)'
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2 + t * 0.15, o = i % 2 ? 0.97 : 1.05; ctx.beginPath(); ctx.moveTo(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9); ctx.lineTo(Math.cos(a) * R * o, Math.sin(a) * R * o); ctx.stroke() }
  ctx.strokeStyle = 'rgba(255,150,70,.22)'
  for (const dir of [1, -1]) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + dir * t * 0.12 + (dir > 0 ? 0 : Math.PI / 3); ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * R * 0.72, Math.sin(a) * R * 0.72) } ctx.closePath(); ctx.stroke() }
  ctx.restore()
}

// Contorno violeta-carmesim dos inimigos (silhueta borrada gerada uma vez por imagem) para destacá-los do piso escuro.
const rimCache = new WeakMap<object, { cv: HTMLCanvasElement; pad: number } | null>()
function rimOf(sp: Sprite) {
  const hit = rimCache.get(sp.src)
  if (hit !== undefined) return hit
  let out: { cv: HTMLCanvasElement; pad: number } | null = null
  try {
    const pad = 40, cv = document.createElement('canvas'); cv.width = sp.w + pad * 2; cv.height = sp.h + pad * 2
    const c = cv.getContext('2d')
    if (c) { c.shadowColor = 'rgb(200,55,115)'; c.shadowBlur = 26; c.shadowOffsetX = cv.width; c.drawImage(sp.src, pad - cv.width, pad); out = { cv, pad } }
  } catch { out = null }
  rimCache.set(sp.src, out)
  return out
}

// Desenha em pé: desfaz a inclinação do chão para a figura não ficar achatada, com a origem nos pés.
const stand = (ctx: CanvasRenderingContext2D, x: number, y: number, fn: () => void) => { ctx.save(); ctx.translate(x, y); ctx.scale(1, 1 / TILT); fn(); ctx.restore() }

function enemySprite(e: Pick<Enemy, 'kind' | 'boss'>): Sprite | null {
  if (e.boss) {
    const n = e.boss.id === 'dragao' ? 'boss-dragao' : e.boss.id === 'acusador' ? 'inimigo-acusador' : e.boss.id === 'sentinela' ? 'inimigo-sentinela' : null
    return n ? arenaSprite(n, ENEMY_OPTS) : null
  }
  if (e.kind === 'dardo') return arenaSprite('inimigo-sentinela', ENEMY_OPTS)
  if (e.kind === 'brutamontes') return arenaSprite('inimigo-acusador', ENEMY_OPTS)
  if (e.kind === 'sombra' || e.kind === 'fantasma' || e.kind === 'clone') return arenaSprite('inimigo-sombra', ENEMY_OPTS)
  return null
}

function enemy(ctx: CanvasRenderingContext2D, g: Game, e: Enemy) {
  const vis = isVisible(g, e)
  const alpha = (vis ? (e.kind === 'clone' ? 0.8 : 1) : 0.16) * (e.boss || !behindPillar(g, e.x, e.y) ? 1 : 0.4)
  const toward = Math.atan2(g.player.y - e.y, g.player.x - e.x)
  const wob = Math.sin(e.wob) * 2
  const sprite = enemySprite(e)
  const sheet = !e.boss && (e.kind === 'sombra' || e.kind === 'fantasma' || e.kind === 'clone') ? arenaSheet('sombra-walk-sheet', 1.35) : null
  const pose = sheet ? { row: rowFor(Math.cos(toward), Math.sin(toward)), col: e.walking ? Math.floor(e.wob * 2.5) % 4 : 0 } : null
  const outlined = e.revealed > 0 && g.fogClear > 0
  ctx.save(); ctx.globalAlpha = alpha
  // sombra de contato no piso (no plano do chão, já achatada pela projeção)
  { const au = ctx.createRadialGradient(e.x, e.y - e.r * 0.05, e.r * 0.4, e.x, e.y - e.r * 0.05, e.r * 2.6); au.addColorStop(0, 'rgba(210,60,125,.35)'); au.addColorStop(1, 'rgba(210,60,125,0)'); ctx.fillStyle = au; ctx.beginPath(); ctx.ellipse(e.x, e.y - e.r * 0.05, e.r * 2.6, e.r * 1.6, 0, 0, 7); ctx.fill() }
  ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.beginPath(); ctx.ellipse(e.x + 2, e.y - e.r * 0.05, e.r * 1.3, e.r * 0.66, 0, 0, 7); ctx.fill()
  if (outlined) { ctx.strokeStyle = `rgba(255,110,30,${0.75 * Math.min(1, g.fogClear)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.5, e.r * 1.7, e.r * 0.95, 0, 0, 7); ctx.stroke() }
  if ((e.lunge ?? 0) > 0) { const k = 1 - (e.lunge as number) / tuning.spearWindup, L = tuning.spearReach * (0.45 + 0.55 * k); ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(190,120,255,${0.3 + 0.55 * k})`; ctx.lineWidth = 3 + 4 * k; ctx.shadowColor = '#9a4dff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(toward) * L, e.y + Math.sin(toward) * L); ctx.stroke(); ctx.restore() }
  if (e.boss?.dash && (e.boss.state === 'aim' || e.boss.state === 'strike') && e.boss.t < 0.85) { ctx.strokeStyle = 'rgba(255,70,50,.55)'; ctx.lineWidth = 6; ctx.setLineDash([14, 10]); ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.boss.dash.dx * 520, e.y + e.boss.dash.dy * 520); ctx.stroke(); ctx.setLineDash([]) }
  const feet = e.y + e.r * 0.5
  stand(ctx, e.x, feet, () => {
    let top: number
    if (sheet && pose) {
      // folha de animação: corre voltado para o Portador, parado fica no quadro neutro
      const hh = e.r * 6.4, ww = (hh * sheet.cw) / sheet.uh
      top = hh + 6
      ctx.save(); ctx.translate(0, wob * 0.2)
      const rim = rimOf({ src: sheet.frames[pose.row][pose.col], w: sheet.cw, h: sheet.ch })
      if (rim) { const kk = ww / sheet.cw, yy = -hh - (sheet.y0 + rim.pad) * kk; ctx.save(); ctx.globalAlpha = alpha * 0.9; for (let i = 0; i < 2; i++) ctx.drawImage(rim.cv, -ww / 2 - rim.pad * kk, yy, rim.cv.width * kk, rim.cv.height * kk); ctx.restore() }
      if (outlined) { ctx.shadowColor = '#ff7a2e'; ctx.shadowBlur = 16 }
      drawFrame(ctx, sheet, pose.row, pose.col, hh)
      if (e.hit > 0) { ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.55; drawFrame(ctx, sheet, pose.row, pose.col, hh) }
      ctx.restore()
    } else if (sprite) {
      const hh = e.r * (e.boss ? 6.6 : e.kind === 'brutamontes' ? 5.8 : 6.4), ww = hh * sprite.w / sprite.h
      top = hh + 6
      ctx.save(); ctx.translate(0, wob * 0.4)
      if (e.kind === 'dardo' || e.boss?.id === 'sentinela') { if (g.player.x < e.x) ctx.scale(-1, 1) }
      const rim = rimOf(sprite)
      if (rim) { const kk = ww / sprite.w; ctx.save(); ctx.globalAlpha = alpha * 0.9; ctx.drawImage(rim.cv, -ww / 2 - rim.pad * kk, -hh - rim.pad * kk, rim.cv.width * kk, rim.cv.height * kk); ctx.drawImage(rim.cv, -ww / 2 - rim.pad * kk, -hh - rim.pad * kk, rim.cv.width * kk, rim.cv.height * kk); ctx.restore() }
      if (outlined) { ctx.shadowColor = '#ff7a2e'; ctx.shadowBlur = 16 }
      ctx.drawImage(sprite.src, -ww / 2, -hh, ww, hh)
      if (e.hit > 0) { ctx.shadowBlur = 0; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha * 0.55; ctx.drawImage(sprite.src, -ww / 2, -hh, ww, hh) }
      ctx.restore()
    } else {
      top = e.r * 1.6 + 14
      ctx.translate(0, -e.r * 0.5)
      const body = e.boss ? bossColor[e.boss.id] : e.kind === 'clone' ? '#3b2a52' : e.kind === 'brutamontes' ? '#2a1330' : e.kind === 'fantasma' ? '#241a33' : e.kind === 'dardo' ? '#2b1a2a' : '#211724'
      const grad = ctx.createRadialGradient(-e.r * 0.3, -e.r * 0.3, 2, 0, 0, e.r + 4)
      grad.addColorStop(0, e.hit > 0 ? '#ffe1c2' : '#4a2e55'); grad.addColorStop(1, e.hit > 0 ? '#ff9d5c' : body)
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0, wob * 0.3, e.r + wob * 0.3, 0, 7); ctx.fill()
      if (e.boss || e.kind === 'brutamontes' || e.kind === 'dardo') { ctx.strokeStyle = '#120a16'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * e.r * 0.5, -e.r * 0.7); ctx.lineTo(s * e.r * 0.95, -e.r * 1.35); ctx.stroke() } }
      ctx.fillStyle = '#ff3a2a'; ctx.shadowColor = '#ff3a2a'; ctx.shadowBlur = 8
      const ex = Math.cos(toward) * e.r * 0.25, ey = Math.sin(toward) * e.r * 0.25
      ctx.beginPath(); ctx.arc(ex - e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.arc(ex + e.r * 0.3, ey - e.r * 0.15, 2.4, 0, 7); ctx.fill(); ctx.shadowBlur = 0
      ctx.translate(0, e.r * 0.5)
    }
    if (e.armor > 0) { ctx.strokeStyle = 'rgba(255,170,90,.8)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, -e.r * 0.5, e.r + 5, 0, (e.armor / e.maxArmor) * Math.PI * 2); ctx.stroke() }
    if (vis && e.hp < e.maxHp && e.hp > 0) { const w = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(-w / 2, -top, w, 4); ctx.fillStyle = '#ff5a3a'; ctx.fillRect(-w / 2, -top, w * (e.hp / e.maxHp), 4) }
  })
  ctx.restore()
}

// Portador em pé (render recortado, sem o pedestal), com aura brasa e sombra no chão. A espada do render fica à esquerda: espelha quando a mira aponta para a direita.
function player(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player, r = p.r
  const sprite = arenaSprite('portador-luz', PLAYER_OPTS)
  const sheet = arenaSheet('portador-walk-sheet', 1.25, 1.08)
  // linha pela direção do movimento (ou da mira, parado, golpeando ou no dash); quadro de corrida só enquanto anda, neutro parado
  const moving = p.walk > 0.05, face = p.dashT > 0 ? Math.atan2(p.dashDy, p.dashDx) : moving && p.atk > 0.5 ? p.lastMove : p.aim
  const pose = sheet ? { row: rowFor(Math.cos(face), Math.sin(face)), col: moving ? Math.floor((p.stride * 10) / 13) % 4 : 0 } : null
  const pulse = 1 + Math.sin(g.time * 4) * 0.08, aura = r * 4 * pulse
  const flip = Math.cos(p.aim) > 0
  const dir = { x: Math.cos(p.aim), y: Math.sin(p.aim) * TILT }, dl = Math.hypot(dir.x, dir.y) || 1
  // chão: sombra elíptica, aura #FF5500 e anel
  ctx.save(); ctx.translate(p.x, p.y)
  ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.ellipse(3, r * 0.7, r * 1.25, r * 0.62, 0, 0, 7); ctx.fill()
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, aura); glow.addColorStop(0, 'rgba(255,85,0,.5)'); glow.addColorStop(0.45, 'rgba(255,85,0,.2)'); glow.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, 0, aura, 0, 7); ctx.fill()
  ctx.strokeStyle = 'rgba(255,120,40,.4)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, r * 0.4, r * 1.6 * pulse, 0, 7); ctx.stroke()
  ctx.restore()
  // distorção de movimento do dash: imagens residuais e linhas de velocidade
  if (p.dashT > 0 && sprite) {
    const dn = Math.hypot(p.dashDx, p.dashDy) || 1, ux = p.dashDx / dn, uy = p.dashDy / dn
    for (let k = 5; k >= 1; k--) {
      const hh = r * 8.2, ww = hh * sprite.w / sprite.h
      stand(ctx, p.x - ux * 22 * k, p.y + r * 0.6 - uy * 22 * k, () => { ctx.globalAlpha = 0.36 / k; if (sheet && pose) drawFrame(ctx, sheet, pose.row, pose.col, hh); else { if (flip) ctx.scale(-1, 1); ctx.drawImage(sprite.src, -ww / 2, -hh, ww, hh) } })
    }
    ctx.save(); ctx.lineCap = 'round'
    for (let i = 0; i < 9; i++) {
      const off = (hash2(i, 4.2) - 0.5) * 46, len = 70 + hash2(i, 7.7) * 70, nx = -uy, ny = ux
      const sx = p.x + nx * off - ux * 18, sy = p.y + ny * off - uy * 18
      const lg = ctx.createLinearGradient(sx, sy, sx - ux * len, sy - uy * len); lg.addColorStop(0, 'rgba(255,170,90,.55)'); lg.addColorStop(1, 'rgba(255,85,0,0)')
      ctx.strokeStyle = lg; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - ux * len, sy - uy * len); ctx.stroke()
    }
    ctx.restore()
  }
  stand(ctx, p.x, p.y + r * 0.6, () => {
    const hh = r * 8.2
    if (sheet && pose) {
      const atkK = p.atk < 0.28 ? Math.sin((p.atk / 0.28) * Math.PI) : 0, dashing = p.dashT > 0, aimx = Math.cos(p.aim)
      const bob = -Math.abs(Math.sin(p.stride)) * 2.5 * p.walk + Math.sin(g.time * 2.1) * 0.8 * (1 - p.walk)
      ctx.save(); ctx.translate(aimx * (atkK * 12 + (dashing ? 8 : 0)), bob + Math.sin(p.aim) * atkK * 7); ctx.rotate(aimx * (atkK * 0.12 + (dashing ? 0.2 : 0)) - (p.flash > 0 ? aimx * 0.08 : 0))
      drawFrame(ctx, sheet, pose.row, pose.col, hh)
      if (p.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; drawFrame(ctx, sheet, pose.row, pose.col, hh) }
      ctx.restore()
    } else if (sprite) {
      // animação procedural do render: respiração parada, passos com balanço do corpo, inclinação para o lado do movimento,
      // avanço e giro do tronco ao golpear, mergulho no dash e recuo ao apanhar; troca de lado com giro suave
      const w = p.walk, st = p.stride, t = g.time, mvx = Math.cos(p.lastMove), aimx = Math.cos(p.aim)
      const atk = p.atk < 0.28 ? Math.sin((p.atk / 0.28) * Math.PI) : 0, dashing = p.dashT > 0
      const bob = -Math.abs(Math.sin(st)) * 6 * w + Math.sin(t * 2.1) * 1.1 * (1 - w)
      const lean = mvx * 0.1 * w + Math.sin(st) * 0.035 * w + aimx * (atk * 0.2 + (dashing ? 0.28 : 0)) - (p.flash > 0 ? aimx * 0.12 : 0)
      const sy = 1 + Math.sin(st * 2) * 0.022 * w + Math.sin(t * 2.1) * 0.008 * (1 - w) - atk * 0.04
      const sx = p.facing * (1 + atk * 0.05 + (dashing ? 0.12 : 0))
      const ww = hh * sprite.w / sprite.h, N = 10, legs = 0.3, body = hh * (1 - legs), srcBody = sprite.h * (1 - legs), srcStrip = srcBody / N
      const lift = [Math.max(0, Math.sin(st)) * 7 * w, Math.max(0, -Math.sin(st)) * 7 * w]
      const drawAll = () => {
        // tronco e capa: faixas que balançam mais embaixo e ficam para trás do movimento
        for (let i = 0; i < N; i++) {
          const f = (i + 0.5) / N, off = (Math.sin(t * 2.4 + f * 3.1) * 0.9 - mvx * w * 6) * f
          ctx.save(); ctx.translate(off, 0); ctx.scale(sx, sy)
          ctx.drawImage(sprite.src, 0, i * srcStrip, sprite.w, srcStrip + 1, -ww / 2, -hh + (i * body) / N, ww, body / N + 0.8)
          ctx.restore()
        }
        // pernas: cada metade sobe e avança na sua vez
        for (let side = 0; side < 2; side++) {
          ctx.save(); ctx.translate(0, 0); ctx.scale(sx, sy); ctx.translate((side ? 1 : -1) * Math.sin(st) * 2.5 * w, -lift[side])
          ctx.drawImage(sprite.src, (sprite.w / 2) * side, srcBody, sprite.w / 2, sprite.h - srcBody, -ww / 2 + (ww / 2) * side, -hh + body, ww / 2, hh - body)
          ctx.restore()
        }
      }
      ctx.save(); ctx.translate(Math.cos(p.aim) * (atk * 12 + (dashing ? 8 : 0)), bob + Math.sin(p.aim) * atk * 7); ctx.rotate(lean)
      drawAll()
      if (p.flash > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.5; drawAll() }
      ctx.restore()
    } else {
      // reserva sem a imagem: token vetorial visto de cima (capuz off-white, ombreiras e lâmina brasa)
      ctx.translate(0, -r * 0.6); ctx.rotate(Math.atan2(dir.y, dir.x))
      const hit = p.flash > 0
      for (const side of [-1, 1]) { ctx.fillStyle = hit ? '#ffb1a0' : '#9aa1ad'; ctx.beginPath(); ctx.ellipse(-1, side * r * 0.92, r * 0.62, r * 0.4, side * 0.25, 0, 7); ctx.fill() }
      ctx.fillStyle = hit ? '#ffb1a0' : '#F4F1EA'; ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, 7); ctx.fill()
      ctx.fillStyle = '#2a1f17'; ctx.beginPath(); ctx.ellipse(r * 0.32, 0, r * 0.3, r * 0.26, 0, 0, 7); ctx.fill()
      ctx.rotate(-Math.atan2(dir.y, dir.x)); ctx.translate(0, r * 0.6)
      const len = 40 + 4 * Math.sin(g.time * 9), ux = dir.x / dl, uy = dir.y / dl
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 18; ctx.strokeStyle = '#FF5500'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(0, -hh * 0.46); ctx.lineTo(ux * len, -hh * 0.46 + uy * len); ctx.stroke(); ctx.restore()
    }
    // CONSUMADO: a espada se ergue em chama (o resto do tempo a espada é a do próprio render)
    if (g.nova && g.nova.t < 0.8) {
      const hx = (flip ? 1 : -1) * hh * 0.17, hy = -hh * 0.46, len = 170 * (1 - g.nova.t * 0.3)
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 18
      ctx.strokeStyle = '#FF5500'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - len); ctx.stroke()
      ctx.shadowBlur = 0; ctx.strokeStyle = '#FFD1A3'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx, hy - len + 2); ctx.stroke()
      ctx.restore()
    }
  })
}

// Escudo da Fé: parede curva de vidro fosco (arco no chão + arco elevado), borda dupla laranja incandescente e hexágonos sutis.
function shieldArc(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  if (p.shield <= 0) return
  const fade = Math.min(1, p.shield / 0.6), r = tuning.shieldRadius, a = tuning.shieldArc, H = 34, n = 22, t = g.time
  const pt = (i: number, lift: number) => { const ang = p.aim - a + (2 * a * i) / n; return [p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r - lift] as const }
  ctx.save()
  const frost = ctx.createLinearGradient(p.x, p.y - H, p.x, p.y + r)
  frost.addColorStop(0, `rgba(255,214,170,${0.34 * fade})`); frost.addColorStop(1, `rgba(255,120,50,${0.12 * fade})`)
  ctx.fillStyle = frost; ctx.beginPath()
  for (let i = 0; i <= n; i++) { const [x, y] = pt(i, 0); ctx[i ? 'lineTo' : 'moveTo'](x, y) }
  for (let i = n; i >= 0; i--) { const [x, y] = pt(i, H); ctx.lineTo(x, y) }
  ctx.closePath(); ctx.fill()
  // hexágonos / runas pequenas na face
  ctx.strokeStyle = `rgba(255,220,180,${0.32 * fade})`; ctx.lineWidth = 1
  for (let i = 2; i < n; i += 4) {
    const [x, y] = pt(i, H * 0.5), s = 6 + (i % 3)
    ctx.beginPath(); for (let k = 0; k < 6; k++) { const ang = (Math.PI / 3) * k + t * 0.3; const px = x + Math.cos(ang) * s, py = y + Math.sin(ang) * s * 0.9; ctx[k ? 'lineTo' : 'moveTo'](px, py) } ctx.closePath(); ctx.stroke()
  }
  // borda dupla incandescente (base e topo): laranja larga por fora, creme fina por dentro
  for (const lift of [0, H]) {
    ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 16
    ctx.strokeStyle = `rgba(255,85,0,${0.95 * fade})`; ctx.lineWidth = 4; ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(i, lift); ctx[i ? 'lineTo' : 'moveTo'](x, y) } ctx.stroke()
    ctx.shadowBlur = 0; ctx.strokeStyle = `rgba(255,214,170,${fade})`; ctx.lineWidth = 1.6; ctx.beginPath(); for (let i = 0; i <= n; i++) { const [x, y] = pt(i, lift); ctx[i ? 'lineTo' : 'moveTo'](x, y) } ctx.stroke()
  }
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
  // o campo de visão é um círculo no chão: com a inclinação ele vira elipse na tela
  const hole = (x: number, y: number, rad: number, inner: number) => {
    f.save(); f.translate((x - v.camX) * v.scale, (y - v.camY) * v.scale * TILT); f.scale(1, TILT)
    const gr = f.createRadialGradient(0, 0, rad * inner, 0, 0, rad); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)')
    f.fillStyle = gr; f.beginPath(); f.arc(0, 0, rad, 0, 7); f.fill(); f.restore()
  }
  hole(g.player.x, g.player.y, radius, 0.35)
  // faróis acesos (e o Farol cravado) iluminam a própria área
  for (const l of g.lights) hole(l.x, l.y, l.r * v.scale, 0.2)
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
    ctx.globalAlpha = f.stage === 'advance' ? 0.72 : 1; { const th = 170, tw = th * tower.naturalWidth / tower.naturalHeight; ctx.save(); ctx.scale(1, 1 / TILT); ctx.drawImage(tower, -tw / 2, -th + 14, tw, th); ctx.restore() }; ctx.globalAlpha = 1
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

// Efeitos de habilidade e de golpe, todos no plano do chão (a projeção os achata sozinha).
function vfx(ctx: CanvasRenderingContext2D, g: Game) {
  const p = g.player
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'
  // rastro da espada e do [E]: faixa flamejante em camadas (brasa larga, corpo #FF5500, núcleo #FFF3D1) com cauda que apaga e fumaça e faíscas na ponta
  for (const s of g.fx.slashes) {
    const k = s.t / s.max, big = !!s.big, r0 = big ? 128 : s.heavy ? 108 : 98, sweep = big ? 1.75 : 1.2
    const head = -sweep + 2 * sweep * Math.min(1, k * 2.6), tail = -sweep + 2 * sweep * Math.max(0, (k - 0.16) * 1.4)
    ctx.save(); ctx.translate(p.x + (s.x - p.x) * 0.5, p.y + (s.y - p.y) * 0.5); ctx.rotate(s.a); ctx.scale(1, s.side ?? 1)
    ctx.globalAlpha = Math.min(1, 1.6 * (1 - k * k))
    for (const [inner, col, blur] of [[0.48, 'rgba(255,85,0,.4)', 30], [0.7, '#FF5500', 22], [0.88, '#FFF3D1', 8]] as const) {
      ctx.fillStyle = col; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = blur
      ctx.beginPath(); ctx.arc(0, 0, r0, tail, head); ctx.arc(-r0 * 0.14 * (inner / 0.7), 0, r0 * inner, head, tail, true); ctx.closePath(); ctx.fill()
    }
    // feixe luminoso da lâmina, do corpo até a ponta do arco, sincronizado com o corte
    { const bl = ctx.createLinearGradient(0, 0, Math.cos(head) * r0, Math.sin(head) * r0); bl.addColorStop(0, 'rgba(255,85,0,0)'); bl.addColorStop(0.55, '#FF5500'); bl.addColorStop(1, '#FFF3D1')
      ctx.strokeStyle = bl; ctx.lineCap = 'round'; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 16; ctx.lineWidth = 6 * (1 - k * 0.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(head) * r0, Math.sin(head) * r0); ctx.stroke() }
    ctx.shadowBlur = 0
    // fumaça na ponta do corte (tom escuro, fora do modo aditivo)
    ctx.globalCompositeOperation = 'source-over'
    for (let i = 0; i < 3; i++) { const d = r0 + 6 + k * 34 + i * 9, a = head - i * 0.05; ctx.fillStyle = `rgba(70,52,46,${0.28 * (1 - k)})`; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 7 + k * 16 + i * 3, 0, 7); ctx.fill() }
    ctx.globalCompositeOperation = 'lighter'
    // faíscas e riscos de velocidade soltos pelo corte
    ctx.fillStyle = '#ffb870'; ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,190,120,.8)'
    for (let i = 0; i < 7; i++) {
      const a = tail + (head - tail) * (i / 7), d = r0 + 6 + k * 34 + hash2(i, s.a) * 12
      ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, 2.4 * (1 - k), 0, 7); ctx.fill()
      if (i % 2 === 0) { ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r0 - 4), Math.sin(a) * (r0 - 4)); ctx.lineTo(Math.cos(a) * (d + 14), Math.sin(a) * (d + 14)); ctx.stroke() }
    }
    ctx.restore()
  }
  // [C] Pulso de Revelação: onda de choque dupla com anel de refração
  if (g.pulse) {
    const k = g.pulse.t / tuning.pulseTime, R = tuning.pulseRadius
    ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 14
    ctx.strokeStyle = `rgba(255,214,160,${1 - k})`; ctx.lineWidth = 7 * (1 - k) + 1; ctx.beginPath(); ctx.arc(g.pulse.x, g.pulse.y, R * k, 0, 7); ctx.stroke()
    const k2 = Math.max(0, (k - 0.16) / 0.84)
    if (k2 > 0) { ctx.strokeStyle = `rgba(255,85,0,${0.8 * (1 - k2)})`; ctx.lineWidth = 4 * (1 - k2) + 1; ctx.beginPath(); ctx.arc(g.pulse.x, g.pulse.y, R * k2, 0, 7); ctx.stroke() }
    ctx.shadowBlur = 0
    const rf = ctx.createRadialGradient(g.pulse.x, g.pulse.y, R * k * 0.72, g.pulse.x, g.pulse.y, R * k); rf.addColorStop(0, 'rgba(255,170,100,0)'); rf.addColorStop(1, `rgba(255,170,100,${0.26 * (1 - k)})`)
    ctx.fillStyle = rf; ctx.beginPath(); ctx.arc(g.pulse.x, g.pulse.y, R * k, 0, 7); ctx.fill()
  }
  // clarão de rebote do Escudo: bola de luz e faíscas na direção em que o tiro voltou
  for (const f of g.fx.flashes) {
    const k = f.t / f.max
    const gr = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 46 * (1 + k)); gr.addColorStop(0, `rgba(255,244,214,${1 - k})`); gr.addColorStop(0.4, `${f.purple ? 'rgba(170,90,255,' : 'rgba(255,140,50,'}${0.7 * (1 - k)})`); gr.addColorStop(1, 'rgba(255,85,0,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(f.x, f.y, 46 * (1 + k), 0, 7); ctx.fill()
    ctx.strokeStyle = `rgba(255,214,160,${1 - k})`; ctx.lineWidth = 2
    for (let i = 0; i < 9; i++) { const a = f.a + (i - 4) * 0.17, l0 = 10 + k * 30, l1 = l0 + 22 + hash2(i, f.a) * 26; ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * l0, f.y + Math.sin(a) * l0); ctx.lineTo(f.x + Math.cos(a) * l1, f.y + Math.sin(a) * l1); ctx.stroke() }
  }
  ctx.restore()
}

// [X] CONSUMADO: explosão radial dourada e brasa, ondas concêntricas e raios de luz verticais (os raios são desenhados em pé).
function nova(ctx: CanvasRenderingContext2D, g: Game) {
  if (!g.nova) return
  const n = g.nova, k = n.t / tuning.novaTime, r = tuning.novaRadius * Math.min(1, k * 1.5)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, Math.max(r, 1)); grad.addColorStop(0, `rgba(255,236,170,${0.85 * (1 - k)})`); grad.addColorStop(0.6, `rgba(255,120,30,${0.45 * (1 - k)})`); grad.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, 7); ctx.fill()
  for (let i = 0; i < 3; i++) { const rr = r * (1 - i * 0.22); if (rr <= 0) continue; ctx.strokeStyle = `rgba(255,${224 - i * 30},${150 - i * 30},${(1 - k) * (1 - i * 0.28)})`; ctx.lineWidth = (8 - i * 2) * (1 - k) + 1; ctx.beginPath(); ctx.arc(n.x, n.y, rr, 0, 7); ctx.stroke() }
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + k * 0.6, rad = r * (0.55 + 0.4 * hash2(i, 3.3)), x = n.x + Math.cos(a) * rad, y = n.y + Math.sin(a) * rad
    stand(ctx, x, y, () => {
      const hh = 210 * (1 - k * 0.55) * (0.7 + 0.5 * hash2(i, 8.1)), lg = ctx.createLinearGradient(0, 0, 0, -hh); lg.addColorStop(0, `rgba(255,210,120,${0.75 * (1 - k)})`); lg.addColorStop(1, 'rgba(255,140,40,0)')
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(0, -hh); ctx.lineTo(7, 0); ctx.closePath(); ctx.fill()
    })
  }
  stand(ctx, n.x, n.y, () => { const hh = 420 * (1 - k * 0.4), lg = ctx.createLinearGradient(0, 0, 0, -hh); lg.addColorStop(0, `rgba(255,236,170,${0.9 * (1 - k)})`); lg.addColorStop(1, 'rgba(255,180,60,0)'); ctx.fillStyle = lg; const bw = 24 * (1 - k * 0.5); ctx.beginPath(); ctx.moveTo(-bw, 0); ctx.lineTo(-bw * 0.2, -hh); ctx.lineTo(bw * 0.2, -hh); ctx.lineTo(bw, 0); ctx.closePath(); ctx.fill() })
  ctx.restore()
}

// Números flutuantes: dano comum em laranja, crítico maior com "estouro" de escala, contorno escuro para ler sobre qualquer piso.
function floatTexts(ctx: CanvasRenderingContext2D, g: Game) {
  ctx.textAlign = 'center'; ctx.lineJoin = 'round'
  for (const f of g.floats) {
    const crit = f.text.includes('CRÍTICO'), age = 0.9 - f.life, pop = Math.max(0.15, 1 - Math.exp(-age * 11) * Math.cos(age * 30))
    stand(ctx, f.x, f.y, () => {
      if (pop < 0.3) return
      ctx.translate(0, crit ? -104 : -94); ctx.globalAlpha = Math.min(1, f.life * 2.2); ctx.font = `800 ${Math.round((crit ? 19 : 14) * pop)}px "Plus Jakarta Sans", Inter, sans-serif`
      ctx.lineWidth = 4 * Math.min(1, pop); ctx.strokeStyle = 'rgba(8,6,10,.85)'; ctx.strokeText(f.text, 0, 0)
      ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0)
    })
  }
  ctx.globalAlpha = 1
}

// Versão em brasa do sprite (silhueta alaranjada com rachaduras de luz), gerada uma vez por imagem.
const emberCache = new WeakMap<object, HTMLCanvasElement | null>()
function emberOf(sp: Sprite): HTMLCanvasElement | null {
  const hit = emberCache.get(sp.src)
  if (hit !== undefined) return hit
  let out: HTMLCanvasElement | null = null
  try {
    const cv = document.createElement('canvas'); cv.width = sp.w; cv.height = sp.h
    const c = cv.getContext('2d')
    if (c) {
      c.drawImage(sp.src, 0, 0)
      c.globalCompositeOperation = 'source-atop'
      const lg = c.createLinearGradient(0, 0, 0, sp.h); lg.addColorStop(0, 'rgba(255,200,120,.75)'); lg.addColorStop(1, 'rgba(255,85,0,.55)')
      c.fillStyle = lg; c.fillRect(0, 0, sp.w, sp.h)
      c.fillStyle = 'rgba(255,230,170,.5)'
      for (let i = 0; i < 26; i++) { c.fillRect(hash2(i, 1.7) * sp.w, hash2(i, 5.3) * sp.h, 2 + hash2(i, 9.1) * 8, 1.5) }
      out = cv
    }
  } catch { out = null }
  emberCache.set(sp.src, out)
  return out
}

// Corpos em brasa: o inimigo abatido fica deitado no chão, com a armadura ainda incandescente, e esmaece até sumir.
function corpses(ctx: CanvasRenderingContext2D, g: Game) {
  for (const c of g.fx.corpses) {
    const k = c.t / c.max, fade = k < 0.08 ? k / 0.08 : k > 0.65 ? (1 - k) / 0.35 : 1
    const sprite = enemySprite({ kind: c.kind })
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.translate(c.x, c.y); ctx.rotate((c.flip ? Math.PI / 2 : -Math.PI / 2) + c.a); ctx.globalAlpha = fade * 0.92
    if (sprite) { const hh = c.r * (c.kind === 'brutamontes' ? 5.8 : 6.4), ww = hh * sprite.w / sprite.h; ctx.drawImage(sprite.src, -ww / 2, -hh * 0.55, ww, hh); const em = emberOf(sprite); if (em) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = Math.min(1, fade * (0.55 + 0.25 * Math.sin(g.time * 4 + c.x)) + Math.max(0, 1 - c.t / 0.5) * 0.9); ctx.drawImage(em, -ww / 2, -hh * 0.55, ww, hh) } }
    else { ctx.fillStyle = '#1b1320'; ctx.beginPath(); ctx.ellipse(0, 0, c.r * 2, c.r, 0, 0, 7); ctx.fill() }
    ctx.restore()
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const gl = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, c.r * 3.4); gl.addColorStop(0, `rgba(255,110,30,${0.34 * fade})`); gl.addColorStop(1, 'rgba(255,85,0,0)')
    ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 3.4, 0, 7); ctx.fill()
    for (let i = 0; i < 12; i++) {
      const x = c.x + (hash2(i, c.x * 0.01) - 0.5) * c.r * 4.4, y = c.y + (hash2(i + 9, c.y * 0.01) - 0.5) * c.r * 1.8 - ((g.time * 14 + i * 7) % 26) * (i % 3 === 0 ? 1 : 0)
      ctx.globalAlpha = fade * (0.35 + 0.65 * Math.abs(Math.sin(g.time * 5 + i * 1.7))); ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6a1f'
      ctx.beginPath(); ctx.arc(x, y, 1.6 + (i % 3) * 0.7, 0, 7); ctx.fill()
    }
    ctx.restore()
  }
}

// [X] CONSUMADO: coluna de luz que cai do alto sobre cada inimigo atingido, com anéis e pétalas de luz no chão e fagulhas subindo.
function lightPillars(ctx: CanvasRenderingContext2D, g: Game) {
  for (const q of g.fx.pillars) {
    if (q.t < 0) continue
    const k = q.t / q.max, a = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8, R = 50 + 46 * Math.min(1, k * 1.7)
    ctx.save(); ctx.globalCompositeOperation = 'lighter'
    const gr = ctx.createRadialGradient(q.x, q.y, 4, q.x, q.y, R); gr.addColorStop(0, `rgba(255,236,170,${0.8 * a})`); gr.addColorStop(0.55, `rgba(255,120,30,${0.4 * a})`); gr.addColorStop(1, 'rgba(255,85,0,0)')
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, R, 0, 7); ctx.fill()
    ctx.lineWidth = 3; ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 14
    for (const [m, col] of [[1, '#ffd27a'], [0.7, '#FF5500']] as const) { ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.beginPath(); ctx.arc(q.x, q.y, R * m, 0, 7); ctx.stroke() }
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = '#ffe9b0'
    for (let i = 0; i < 14; i++) { const an = (i / 14) * Math.PI * 2 + k, l0 = R * 0.25, l1 = R * (0.8 + 0.2 * hash2(i, q.x * 0.01)); ctx.beginPath(); ctx.moveTo(q.x + Math.cos(an) * l0, q.y + Math.sin(an) * l0); ctx.lineTo(q.x + Math.cos(an) * l1, q.y + Math.sin(an) * l1); ctx.stroke() }
    ctx.globalAlpha = 0.5 * (1 - k); ctx.lineWidth = 6; ctx.strokeStyle = '#ffcf8a'; ctx.beginPath(); ctx.arc(q.x, q.y, R * (0.8 + 1.3 * k), 0, 7); ctx.stroke()
    ctx.globalAlpha = 1
    stand(ctx, q.x, q.y, () => {
      const hh = 560, w = 30 * (1 - k * 0.35), lg = ctx.createLinearGradient(0, 0, 0, -hh); lg.addColorStop(0, `rgba(255,236,170,${0.95 * a})`); lg.addColorStop(0.6, `rgba(255,170,60,${0.6 * a})`); lg.addColorStop(1, 'rgba(255,140,40,0)')
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(-w * 1.3, 0); ctx.lineTo(-w * 0.12, -hh); ctx.lineTo(w * 0.12, -hh); ctx.lineTo(w * 1.3, 0); ctx.closePath(); ctx.fill()
      ctx.fillStyle = `rgba(255,255,240,${0.9 * a})`; ctx.fillRect(-w * 0.16, -hh * 0.8, w * 0.32, hh * 0.8)
      ctx.fillStyle = '#ffd27a'
      for (let i = 0; i < 9; i++) { ctx.globalAlpha = a * (1 - ((k * 3 + i / 9) % 1)); ctx.beginPath(); ctx.arc((hash2(i, q.y * 0.01) - 0.5) * 70, -((k * 260 + i * 41) % 240), 2.2, 0, 7); ctx.fill() }
    })
    ctx.restore()
  }
}

// ---------- folhas de animação 4x4 (Portador e Sombra) ----------
// Cada folha tem 4 linhas de direção (0 baixo, 1 esquerda, 2 direita, 3 cima) e 4 quadros de corrida por linha. No carregamento cada célula é
// recortada para um canvas fora da tela, com o fundo escuro ligado às bordas removido e o brilho ajustado; o loop só desenha o quadro certo.
export type Sheet = { frames: HTMLCanvasElement[][]; cw: number; ch: number; y0: number; uh: number }
const sheetCache = new Map<string, Sheet | null>()
export const rowFor = (dx: number, dy: number) => (dy > Math.abs(dx) ? 0 : dx < -Math.abs(dy) ? 1 : dx > Math.abs(dy) ? 2 : 3)
export function arenaSheet(name: string, gain = 1, contrast = 1): Sheet | null {
  const cached = sheetCache.get(name)
  if (cached !== undefined) return cached
  const img = arenaArt(name)
  if (!img) return null
  let out: Sheet | null = null
  try {
    const sw = img.naturalWidth / 4, sh = img.naturalHeight / 4, k = Math.min(1, 320 / sw), cw = Math.round(sw * k), ch = Math.round(sh * k)
    let top = ch, bottom = 0
    const frames: HTMLCanvasElement[][] = []
    for (let row = 0; row < 4; row++) {
      frames.push([])
      for (let col = 0; col < 4; col++) {
        const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch
        const c = cv.getContext('2d', { willReadFrequently: true })
        if (!c) throw new Error('canvas')
        c.drawImage(img, col * sw, row * sh, sw, sh, 0, 0, cw, ch)
        const data = c.getImageData(0, 0, cw, ch)
        floodKey(data.data, cw, ch)
        if (gain !== 1 || contrast !== 1) lift(data.data, gain, contrast)
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x += 2) if (data.data[(y * cw + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bottom) bottom = y; break }
        c.putImageData(data, 0, 0); frames[row].push(cv)
      }
    }
    if (bottom <= top) throw new Error('vazia')
    out = { frames, cw, ch, y0: top, uh: bottom - top + 1 }
  } catch { out = null }
  sheetCache.set(name, out)
  return out
}
// Desenha um quadro com os pés na origem e a altura da figura igual a hh (sem espelhar: as linhas já têm as poses de cada lado).
function drawFrame(ctx: CanvasRenderingContext2D, sh: Sheet, row: number, col: number, hh: number) {
  const ww = (hh * sh.cw) / sh.uh
  ctx.drawImage(sh.frames[row][col], 0, sh.y0, sh.cw, sh.uh, -ww / 2, -hh, ww, hh)
}

// Vinheta e alerta de dano: tela inteira.
function vignette(ctx: CanvasRenderingContext2D, g: Game, v: View) {
  const vg = ctx.createRadialGradient(v.w / 2, v.h / 2, Math.min(v.w, v.h) * 0.35, v.w / 2, v.h / 2, Math.max(v.w, v.h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, g.player.flash > 0 ? 'rgba(160,20,10,.5)' : 'rgba(0,0,0,.55)')
  ctx.fillStyle = vg; ctx.fillRect(0, 0, v.w, v.h)
}

// Pré-aquecimento: carrega as imagens da arena e gera, uma por vez e fora do caminho do combate, os recortes, contornos e versões em brasa,
// para o primeiro inimigo ou abate não custar um quadro perdido.
export function warmArena() {
  const jobs: (() => boolean)[] = []
  for (const n of ['inimigo-sombra', 'inimigo-sentinela', 'inimigo-acusador', 'boss-dragao']) jobs.push(() => { const sp = arenaSprite(n, ENEMY_OPTS); if (!sp) return false; rimOf(sp); emberOf(sp); return true })
  jobs.push(() => !!arenaSprite('portador-luz', PLAYER_OPTS))
  jobs.push(() => !!arenaSheet('portador-walk-sheet', 1.25, 1.08))
  jobs.push(() => !!arenaSheet('sombra-walk-sheet', 1.35))
  let i = 0, tries = 0
  const tick = () => { if (i >= jobs.length || tries++ > 80) return; if (jobs[i]()) i++; setTimeout(tick, 50) }
  setTimeout(tick, 0)
}

export function render(ctx: CanvasRenderingContext2D, g: Game, v: View, fogLayer?: HTMLCanvasElement | OffscreenCanvas) {
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.fillStyle = '#0c0a0d'; ctx.fillRect(0, 0, v.w, v.h)
  // micro-tremor de câmera em abates e impactos pesados (2 a 4 px)
  const sh = Math.min(4, g.fx.shake), ox = sh ? (Math.random() - 0.5) * 2 * sh : 0, oy = sh ? (Math.random() - 0.5) * 2 * sh : 0
  ctx.setTransform(v.scale, 0, 0, v.scale * TILT, -v.camX * v.scale + ox, -v.camY * v.scale * TILT + oy)
  ground(ctx, g, v)
  walls(ctx, g, v)
  playerLight(ctx, g)
  runeCircle(ctx, g)
  brazierLights(ctx, g, v)
  castShadows(ctx, g)
  altar(ctx, g)
  storyLayer(ctx, g)
  corpses(ctx, g)
  for (const o of g.obstacles) pillar(ctx, o.x, o.y, o.r, g.player)
  brazierBodies(ctx, g, v)
  // névoa de borda e vinheta ficam por baixo dos personagens, que mantêm o brilho; a névoa de visão do Farol continua por cima
  { const T = ctx.getTransform(); ctx.setTransform(1, 0, 0, 1, 0, 0); mist(ctx, g, v); vignette(ctx, g, v); ctx.setTransform(T) }
  // personagens ordenados por profundidade (quem está mais embaixo na tela fica na frente)
  const actors: { y: number; draw: () => void }[] = g.enemies.map(e => ({ y: e.y, draw: () => enemy(ctx, g, e) }))
  actors.push({ y: g.player.y, draw: () => player(ctx, g) })
  actors.sort((a, b) => a.y - b.y)
  for (const a of actors) a.draw()
  ctx.save(); ctx.globalCompositeOperation = 'lighter'
  for (const q of g.particles) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.color; ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, 7); ctx.fill() }
  ctx.restore(); ctx.globalAlpha = 1
  for (const b of g.projectiles) {
    const friendly = b.from === 'player'
    ctx.strokeStyle = friendly ? (b.crit || b.reflected ? '#fff0c8' : gold) : '#b26bff'; ctx.lineWidth = friendly ? 4 : 3; ctx.lineCap = 'round'; ctx.shadowColor = friendly ? ember : '#8a3bff'; ctx.shadowBlur = 10
    ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x - b.vx * 0.022, b.y - b.vy * 0.022); ctx.stroke()
    // trilha de partículas: pontos que encolhem e esmaecem atrás do projétil, com leve tremor
    ctx.shadowBlur = 0; ctx.fillStyle = friendly ? (b.crit || b.reflected ? '#fff0c8' : '#ffc27a') : '#c99bff'
    for (let i = 1; i <= 5; i++) {
      const k = i / 5, j = hash2(i + Math.floor(g.time * 30), b.x * 0.01 + b.y * 0.013)
      ctx.globalAlpha = 0.7 * (1 - k); ctx.beginPath(); ctx.arc(b.x - b.vx * 0.022 * (1 + k * 2.4) + (j - 0.5) * 5, b.y - b.vy * 0.022 * (1 + k * 2.4) + (j - 0.5) * 5, 2.6 * (1 - k * 0.7), 0, 7); ctx.fill()
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 10
  }
  ctx.shadowBlur = 0
  shieldArc(ctx, g)
  vfx(ctx, g)
  nova(ctx, g)
  lightPillars(ctx, g)
  floatTexts(ctx, g)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  if (fogLayer) fog(g, v, fogLayer, ctx)
  if (g.nova && g.nova.t / tuning.novaTime < 0.35) { ctx.fillStyle = `rgba(255,225,150,${0.28 * (1 - g.nova.t / (tuning.novaTime * 0.35))})`; ctx.fillRect(0, 0, v.w, v.h) }
  if (g.story?.storm?.on) { ctx.strokeStyle = 'rgba(255,225,170,.16)'; ctx.lineWidth = 2; const a = g.story.storm.dir; for (let i = 0; i < 46; i++) { const x = ((i * 137 + g.time * 420 * Math.cos(a)) % v.w + v.w) % v.w, y = ((i * 91 + g.time * 420 * Math.sin(a)) % v.h + v.h) % v.h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 46, y + Math.sin(a) * 46); ctx.stroke() } }
  const target = storyTarget(g)
  if (target) {
    const px = (g.player.x - v.camX) * v.scale, py = (g.player.y - v.camY) * v.scale * TILT, d = Math.hypot(target.x - g.player.x, target.y - g.player.y)
    if (d > 140) {
      const a = Math.atan2((target.y - g.player.y) * TILT, target.x - g.player.x), r = 70 * v.scale
      ctx.save(); ctx.translate(px + Math.cos(a) * r, py + Math.sin(a) * r); ctx.rotate(a)
      ctx.fillStyle = `rgba(255,190,120,${0.6 + 0.3 * Math.sin(g.time * 5)})`; ctx.shadowColor = '#ff7a2e'; ctx.shadowBlur = 10
      ctx.beginPath(); ctx.moveTo(12 * v.scale, 0); ctx.lineTo(-8 * v.scale, 8 * v.scale); ctx.lineTo(-3 * v.scale, 0); ctx.lineTo(-8 * v.scale, -8 * v.scale); ctx.closePath(); ctx.fill(); ctx.restore()
    }
  }
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
  ctx.fillStyle = '#ff3d6e'; ctx.shadowColor = '#ff3d6e'; ctx.shadowBlur = 5; for (const e of g.enemies) if (isVisible(g, e) || e.revealed > 0) ctx.fillRect(ox + e.x * s - 2, oy + e.y * s - 2, 4, 4); ctx.shadowBlur = 0
  ctx.shadowColor = '#FF5500'; ctx.shadowBlur = 8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + g.player.x * s, oy + g.player.y * s, 3.6, 0, 7); ctx.fill(); ctx.strokeStyle = '#FF5500'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ox + g.player.x * s, oy + g.player.y * s, 6.5, 0, 7); ctx.stroke(); ctx.shadowBlur = 0
}
