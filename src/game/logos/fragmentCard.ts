// Card do Fragmento Bíblico para os Stories (1080 × 1920), desenhado em canvas: não depende de serviço externo e não cita versículo, só a referência.
export const fragmentCardSize = { width: 1080, height: 1920 }
export type FragmentCardData = { reference: string; theme: string; phaseName: string; label: string; host: string }

export type FragmentContext = {
  fillStyle: unknown; strokeStyle: unknown; lineWidth: number; font: string; textAlign: string; textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void; strokeRect(x: number, y: number, w: number, h: number): void; fillText(text: string, x: number, y: number, maxWidth?: number): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(offset: number, color: string): void }
  measureText(text: string): { width: number }
}
const sans = "'Plus Jakarta Sans', Inter, system-ui, sans-serif"
const serif = "Literata, Georgia, serif"

// Quebra o texto em linhas que cabem na largura.
export function wrapLines(ctx: Pick<FragmentContext, 'measureText'>, text: string, maxWidth: number): string[] {
  const lines: string[] = []; let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word
    if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = word } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export function drawFragmentCard(ctx: FragmentContext, data: FragmentCardData) {
  const { width: w, height: h } = fragmentCardSize
  const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1a1210'); bg.addColorStop(1, '#0b090c')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(w / 2, 820, 40, w / 2, 820, 760); glow.addColorStop(0, 'rgba(255,122,46,.38)'); glow.addColorStop(1, 'rgba(255,122,46,0)')
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#ff7a2e'; ctx.lineWidth = 6; ctx.strokeRect(120, 360, w - 240, 1000)
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ff9a52'; ctx.font = `800 44px ${sans}`; ctx.fillText('CORAM // LOGOS', w / 2, 250)
  ctx.fillStyle = '#a89c90'; ctx.font = `700 38px ${sans}`; ctx.fillText(data.label.toUpperCase(), w / 2, 450)
  ctx.fillStyle = '#ff7a2e'; ctx.font = `800 64px ${sans}`; ctx.fillText('FRAGMENTO DESBLOQUEADO', w / 2, 620, w - 300)
  ctx.fillStyle = '#f3ebe0'; ctx.font = `800 120px ${sans}`; ctx.fillText(data.reference, w / 2, 860, w - 280)
  ctx.fillStyle = '#ffd9a8'; ctx.font = `italic 500 56px ${serif}`
  wrapLines(ctx, data.theme, w - 360).slice(0, 4).forEach((line, i) => ctx.fillText(line, w / 2, 1000 + i * 78))
  ctx.fillStyle = '#a89c90'; ctx.font = `700 40px ${sans}`; ctx.fillText(data.phaseName, w / 2, 1290, w - 300)
  ctx.fillStyle = '#6f655b'; ctx.font = `600 36px ${sans}`; ctx.fillText(data.host, w / 2, 1760)
}

export function renderFragmentCard(data: FragmentCardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = fragmentCardSize.width; canvas.height = fragmentCardSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(Error('Seu navegador não conseguiu desenhar o card.'))
  drawFragmentCard(ctx as unknown as FragmentContext, data)
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(Error('Não foi possível criar a imagem.'))), 'image/png'))
}
