import { useEffect, useRef, useState } from 'react'
import { Art3D } from './Art3D'

const SRC = '/assets/3d/logos/portador-luz.webp'
const ALT = 'O Portador da Luz, de capuz e armadura, com a espada em brasa'
const hash = (a: number, b: number) => { const k = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return k - Math.floor(k) }
// Inscrição do anel do pedestal, lida de frente: nomes do vocabulário do jogo e da fé, separados por losangos.
const WORDS = ['ΛΟΓΟΣ', 'ΘΕΟΣ', 'ΠΙΣΤΙΣ', 'ΧΑΡΙΣ', 'ΦΩΣ', 'ΑΓΑΠΗ', 'ΖΩΗ', 'ΑΛΗΘΕΙΑ']
const SLOTS = WORDS.flatMap(w => [...w, '◆'])

// Portador do lobby, em camadas no mesmo canvas: (1) halo e raios girando ATRÁS do personagem, (2) o render 3D com o pedestal original,
// animado — respiração, balanço que cresce para cima (pés fixos), brilho da espada e brasas —, cujo anel de runas foi regravado com letras
// gregas que brilham em onda. Enquanto a imagem não carrega (ou sem canvas) vale o <img> estático; com "reduzir movimento" desenha um quadro.
export function LobbyBearer({ fallback }: { fallback: React.ReactNode }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = new Image()
    el.decoding = 'async'
    el.onload = () => setImg(el)
    el.src = SRC
    return () => { el.onload = null }
  }, [])

  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d')
    if (!img || !cv || !ctx) return
    const W = img.naturalWidth, H = img.naturalHeight
    const OX = Math.round(W * 0.12), OY = Math.round(H * 0.02)
    const CW = (cv.width = W + OX * 2), CH = (cv.height = H + OY + Math.round(H * 0.02))
    const feet = Math.round(H * 0.8), STEP = 6
    // anel do pedestal pintado no render (medido na imagem): centro, raios externo/interno e faixa das letras
    const px = W * 0.586, py = H * 0.836, rxo = W * 0.3, ryo = H * 0.059, rxi = W * 0.222, ryi = H * 0.047, rxm = (rxo + rxi) / 2, rym = (ryo + ryi) / 2
    // recorte que protege as botas (o anel é regravado por baixo delas)
    const boots = (c: CanvasRenderingContext2D) => { c.ellipse(W * 0.485, H * 0.79, W * 0.085, H * 0.055, 0, 0, 7); c.moveTo(W * 0.78, H * 0.811); c.ellipse(W * 0.72, H * 0.811, W * 0.06, H * 0.055, 0, 0, 7) }
    const letters = (c: CanvasRenderingContext2D, hot: boolean) => {
      const step = (Math.PI * 2) / SLOTS.length
      c.font = `700 ${Math.round(W * 0.036)}px "Cinzel", "Trajan Pro", "Times New Roman", serif`; c.textAlign = 'center'; c.textBaseline = 'middle'
      SLOTS.forEach((s, j) => {
        const th = Math.PI / 2 - (j - 2) * step // ΛΟΓΟΣ (letra central) de frente, lido da esquerda para a direita
        const x = px + rxm * Math.cos(th), y = py + rym * Math.sin(th)
        c.save(); c.translate(x, y); c.rotate(Math.atan2(-rym * Math.cos(th), rxm * Math.sin(th))); c.scale(1, 0.66)
        if (hot) { c.shadowColor = '#ff8a3d'; c.shadowBlur = 14; c.fillStyle = '#ffe2b0'; c.fillText(s, 0, 0); c.fillText(s, 0, 0) }
        else { c.fillStyle = 'rgba(255,148,66,.95)'; c.shadowColor = '#ff6a1f'; c.shadowBlur = 7; c.fillText(s, 0, 0) }
        c.restore()
      })
    }
    // figura com o anel regravado: pedra lisa por cima das runas antigas (menos nas botas) e as letras gregas no lugar
    const fig = document.createElement('canvas'); fig.width = W; fig.height = H
    const fc = fig.getContext('2d')
    const hotL = document.createElement('canvas'); hotL.width = W; hotL.height = H
    const hc = hotL.getContext('2d')
    if (!fc || !hc) return
    fc.drawImage(img, 0, 0)
    fc.save(); fc.beginPath(); fc.rect(0, 0, W, H); boots(fc); fc.clip('evenodd')
    const band = fc.createRadialGradient(px, py - ryo * 0.3, rxi * 0.4, px, py, rxo)
    band.addColorStop(0, '#5a524c'); band.addColorStop(1, '#3d3733')
    fc.fillStyle = band; fc.beginPath(); fc.ellipse(px, py, rxo + 5, ryo + 2, 0, 0, 7); fc.ellipse(px, py, rxi - 4, ryi - 1, 0, 0, 7, true); fc.fill('evenodd')
    fc.strokeStyle = 'rgba(0,0,0,.3)'; fc.lineWidth = 2
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2 + 0.2; fc.beginPath(); fc.moveTo(px + Math.cos(a) * rxi, py + Math.sin(a) * ryi); fc.lineTo(px + Math.cos(a) * rxo, py + Math.sin(a) * ryo); fc.stroke() }
    fc.shadowColor = '#ff6a1f'; fc.shadowBlur = 8; fc.strokeStyle = 'rgba(255,160,80,.9)'; fc.lineWidth = 2.2
    for (const [a, b] of [[rxi, ryi], [rxo, ryo]]) { fc.beginPath(); fc.ellipse(px, py, a, b, 0, 0, 7); fc.stroke() }
    fc.shadowBlur = 0; letters(fc, false)
    fc.restore()
    letters(hc, true)

    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const draw = (now: number) => {
      const t = now / 1000
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.clearRect(0, 0, CW, CH)
      // 1) halo e raios girando, atrás de tudo
      const hx = OX + W * 0.58, hy = OY + H * 0.46, rr = Math.min(CW * 0.5, CH * 0.5)
      ctx.globalCompositeOperation = 'lighter'
      const halo = ctx.createRadialGradient(hx, hy, 10, hx, hy, rr); halo.addColorStop(0, 'rgba(255,170,80,.34)'); halo.addColorStop(0.5, 'rgba(255,100,20,.13)'); halo.addColorStop(1, 'rgba(255,85,0,0)')
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(hx, hy, rr, 0, 7); ctx.fill()
      const rays = ctx.createRadialGradient(hx, hy, rr * 0.1, hx, hy, rr); rays.addColorStop(0, 'rgba(255,190,110,.26)'); rays.addColorStop(1, 'rgba(255,120,40,0)')
      ctx.fillStyle = rays; ctx.beginPath()
      const rot = t * 0.07, n = 28
      for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.42; ctx.moveTo(hx, hy); ctx.arc(hx, hy, rr, a - w, a + w); ctx.lineTo(hx, hy) }
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      // 2) o Portador com o pedestal original
      ctx.save(); ctx.translate(OX, OY)
      ctx.drawImage(fig, 0, feet, W, H - feet, 0, feet, W, H - feet)
      const breathe = 1 + Math.sin(t * 1.9) * 0.007
      for (let y = 0; y < feet; y += STEP) {
        const f = 1 - y / feet, sway = Math.sin(t * 1.3) * 3.4 * f * f + Math.sin(t * 0.7 + 1) * 1.3 * f
        const d0 = feet - (feet - y) * breathe, d1 = feet - (feet - Math.min(feet, y + STEP)) * breathe
        ctx.drawImage(fig, 0, y, W, Math.min(STEP, feet - y), sway, d0, W, d1 - d0 + 0.8)
      }
      // onda de brilho que percorre as letras (fora das botas)
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); boots(ctx); ctx.clip('evenodd')
      ctx.globalCompositeOperation = 'lighter'; ctx.translate(px, py); ctx.scale(1, ryo / rxo)
      const sweep = t * 0.9
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, rxo * 1.1, sweep, sweep + 0.9); ctx.closePath(); ctx.clip()
      ctx.setTransform(1, 0, 0, 1, OX, OY); ctx.globalAlpha = 0.9; ctx.drawImage(hotL, 0, 0)
      ctx.restore()
      // brilho da lâmina e brasas, por cima do personagem
      ctx.globalCompositeOperation = 'lighter'
      const sx = W * 0.27, sy = H * 0.62, pulse = 0.16 + 0.1 * Math.sin(t * 5) + 0.04 * Math.sin(t * 13)
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, W * 0.2); g.addColorStop(0, `rgba(255,150,60,${pulse})`); g.addColorStop(1, 'rgba(255,85,0,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, W * 0.2, 0, 7); ctx.fill()
      for (let i = 0; i < 18; i++) {
        const p = (t * 0.32 + i / 18) % 1, x = sx + (hash(i, 1) - 0.5) * W * 0.2 + Math.sin(p * 6 + i) * 14, y = sy - p * H * 0.36
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.4) * 0.9; ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6a1f'; ctx.beginPath(); ctx.arc(x, y, 1.6 + hash(i, 2) * 2.2, 0, 7); ctx.fill()
      }
      ctx.restore()
      if (!still) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [img])

  if (!img) return <Art3D name="portador-luz" alt={ALT} fallback={fallback} />
  return <canvas ref={ref} className="lg-lobby-art" role="img" aria-label={ALT} />
}
