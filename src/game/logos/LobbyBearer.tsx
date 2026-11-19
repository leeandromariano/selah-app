import { useEffect, useRef, useState } from 'react'
import { Art3D } from './Art3D'

const SRC = '/assets/3d/logos/portador-luz.webp'
const ALT = 'O Portador da Luz, de capuz e armadura, com a espada em brasa'
const hash = (a: number, b: number) => { const k = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return k - Math.floor(k) }

// Portador do lobby: o mesmo render 3D, animado em canvas — respiração, balanço do corpo que cresce para cima (os pés ficam fixos),
// brilho pulsante da espada com brasas subindo e anel de runas do pedestal respirando. Enquanto a imagem não carrega (ou se o canvas
// faltar) vale o <img> estático; com "reduzir movimento" desenha um único quadro.
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
    const W = (cv.width = img.naturalWidth), H = (cv.height = img.naturalHeight)
    const feet = Math.round(H * 0.8), STEP = 6
    const still = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const draw = (now: number) => {
      const t = now / 1000
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1
      ctx.drawImage(img, 0, feet, W, H - feet, 0, feet, W, H - feet) // pedestal parado
      ctx.clearRect(0, 0, W, feet)
      const breathe = 1 + Math.sin(t * 1.9) * 0.007
      for (let y = 0; y < feet; y += STEP) {
        const f = 1 - y / feet, sway = Math.sin(t * 1.3) * 3.4 * f * f + Math.sin(t * 0.7 + 1) * 1.3 * f
        const d0 = feet - (feet - y) * breathe, d1 = feet - (feet - Math.min(feet, y + STEP)) * breathe
        ctx.drawImage(img, 0, y, W, Math.min(STEP, feet - y), sway, d0, W, d1 - d0 + 0.8)
      }
      ctx.globalCompositeOperation = 'lighter'
      // brilho da lâmina
      const sx = W * 0.27, sy = H * 0.62, pulse = 0.16 + 0.1 * Math.sin(t * 5) + 0.04 * Math.sin(t * 13)
      const g = ctx.createRadialGradient(sx, sy, 4, sx, sy, W * 0.2); g.addColorStop(0, `rgba(255,150,60,${pulse})`); g.addColorStop(1, 'rgba(255,85,0,0)')
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, W * 0.2, 0, 7); ctx.fill()
      // brasas subindo da espada
      for (let i = 0; i < 18; i++) {
        const p = (t * 0.32 + i / 18) % 1, x = sx + (hash(i, 1) - 0.5) * W * 0.2 + Math.sin(p * 6 + i) * 14, y = sy - p * H * 0.36
        ctx.globalAlpha = Math.min(1, (1 - p) * 1.4) * 0.9; ctx.fillStyle = i % 2 ? '#ffb347' : '#ff6a1f'; ctx.beginPath(); ctx.arc(x, y, 1.6 + hash(i, 2) * 2.2, 0, 7); ctx.fill()
      }
      // anel de runas do pedestal
      ctx.globalAlpha = 0.22 + 0.14 * Math.sin(t * 2.2); ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 3
      ctx.beginPath(); ctx.ellipse(W * 0.5, H * 0.905, W * 0.3, H * 0.065, 0, 0, 7); ctx.stroke()
      ctx.globalAlpha = 1
      if (!still) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [img])

  if (!img) return <Art3D name="portador-luz" alt={ALT} fallback={fallback} />
  return <canvas ref={ref} className="lg-art logos-3d-cutout" role="img" aria-label={ALT} />
}
