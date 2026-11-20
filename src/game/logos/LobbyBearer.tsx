import { useEffect, useRef, useState } from 'react'
import { Art3D } from './Art3D'

const SRC = '/assets/3d/logos/portador-luz.webp'
const ALT = 'O Portador da Luz, de capuz e armadura, com a espada em brasa'
const hash = (a: number, b: number) => { const k = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return k - Math.floor(k) }

// Portador do lobby, em camadas no mesmo canvas: (1) halo e raios girando ATRÁS do personagem e (2) o render 3D (fundo já removido, corpo 100% opaco,
// pedestal com as letras gregas), animado — respiração, balanço que cresce para cima (pés fixos), brilho da espada e brasas. Enquanto a imagem
// não carrega (ou sem canvas) vale o <img> estático; com "reduzir movimento" desenha um único quadro.
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
      const rays = ctx.createRadialGradient(hx, hy, rr * 0.1, hx, hy, rr); rays.addColorStop(0, 'rgba(255,190,110,.22)'); rays.addColorStop(1, 'rgba(255,120,40,0)')
      ctx.fillStyle = rays; ctx.beginPath()
      const rot = t * 0.07, n = 28
      for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2, w = (Math.PI / n) * 0.42; ctx.moveTo(hx, hy); ctx.arc(hx, hy, rr, a - w, a + w); ctx.lineTo(hx, hy) }
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      // 2) o Portador com o pedestal (parado), por cima, em mistura normal: nada do fundo atravessa o corpo
      ctx.save(); ctx.translate(OX, OY)
      ctx.drawImage(img, 0, feet, W, H - feet, 0, feet, W, H - feet)
      const breathe = 1 + Math.sin(t * 1.9) * 0.007
      for (let y = 0; y < feet; y += STEP) {
        const f = 1 - y / feet, sway = Math.sin(t * 1.3) * 3.4 * f * f + Math.sin(t * 0.7 + 1) * 1.3 * f
        const d0 = feet - (feet - y) * breathe, d1 = feet - (feet - Math.min(feet, y + STEP)) * breathe
        ctx.drawImage(img, 0, y, W, Math.min(STEP, feet - y), sway, d0, W, d1 - d0 + 0.8)
      }
      // brilho da lâmina e brasas, por cima do personagem
      ctx.globalCompositeOperation = 'lighter'
      const sx = W * 0.21, sy = H * 0.66, pulse = 0.14 + 0.09 * Math.sin(t * 5) + 0.03 * Math.sin(t * 13)
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
