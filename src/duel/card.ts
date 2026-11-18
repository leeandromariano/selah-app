import type { DuelPlayer } from './repository'
import { playerName, secondsText, verdict, verdictText } from './share'

// Card de placar para os Stories (1080 × 1920), desenhado em canvas: não depende de nenhum serviço externo.
export const cardSize = { width: 1080, height: 1920 }
export type CardData = { theme: string; size: number; me: DuelPlayer; rival: DuelPlayer | null; host: string }

// Só o que o desenho usa, para poder testar sem navegador.
export type CardContext = {
  fillStyle: unknown; strokeStyle: unknown; lineWidth: number; font: string; textAlign: string; textBaseline: string
  fillRect(x: number, y: number, w: number, h: number): void; fillText(text: string, x: number, y: number, maxWidth?: number): void
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): { addColorStop(offset: number, color: string): void }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): { addColorStop(offset: number, color: string): void }
  beginPath(): void; arc(x: number, y: number, r: number, a0: number, a1: number): void; fill(): void; stroke(): void
}
const sans = "'Plus Jakarta Sans', Inter, system-ui, sans-serif"

function scoreColumn(ctx: CardContext, x: number, player: DuelPlayer, size: number, lead: boolean) {
  ctx.textAlign = 'center'
  ctx.fillStyle = lead ? '#ff7a33' : '#f4f1ea'
  ctx.font = `800 220px ${sans}`
  ctx.fillText(`${player.correct}`, x, 960)
  ctx.fillStyle = '#9a968e'
  ctx.font = `700 52px ${sans}`
  ctx.fillText(`de ${size}`, x, 1030)
  ctx.fillStyle = '#f4f1ea'
  ctx.font = `800 54px ${sans}`
  ctx.fillText(playerName(player), x, 1130, 420)
  ctx.fillStyle = '#9a968e'
  ctx.font = `600 42px ${sans}`
  ctx.fillText(secondsText(player.total_ms), x, 1196)
}

export function drawDuelCard(ctx: CardContext, data: CardData) {
  const { width, height } = cardSize
  const bg = ctx.createLinearGradient(0, 0, 0, height)
  bg.addColorStop(0, '#15161a'); bg.addColorStop(1, '#0b0c0e')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)
  const glow = ctx.createRadialGradient(width / 2, 980, 40, width / 2, 980, 760)
  glow.addColorStop(0, 'rgba(255,85,0,0.34)'); glow.addColorStop(1, 'rgba(255,85,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#ff7a33'; ctx.font = `800 40px ${sans}`
  ctx.fillText('BEREIA · DUELO RELÂMPAGO', width / 2, 220)
  ctx.fillStyle = '#f4f1ea'; ctx.font = `800 84px ${sans}`
  ctx.fillText('⚡ Duelo bíblico', width / 2, 340)
  ctx.fillStyle = '#9a968e'; ctx.font = `600 44px ${sans}`
  ctx.fillText(data.theme, width / 2, 410, 920)

  const { me, rival } = data
  if (rival) {
    const result = verdict(me, rival)
    ctx.fillStyle = '#f4f1ea'; ctx.font = `800 96px ${sans}`
    ctx.fillText(verdictText[result], width / 2, 640, 960)
    scoreColumn(ctx, 300, me, data.size, result !== 'lose')
    scoreColumn(ctx, 780, rival, data.size, result === 'lose')
    ctx.fillStyle = '#9a968e'; ctx.font = `800 64px ${sans}`
    ctx.fillText('×', width / 2, 930)
  } else {
    ctx.fillStyle = '#f4f1ea'; ctx.font = `800 80px ${sans}`
    ctx.fillText('Fiz o meu. E você?', width / 2, 640, 960)
    scoreColumn(ctx, width / 2, me, data.size, true)
  }

  ctx.fillStyle = '#f4f1ea'; ctx.font = `800 70px ${sans}`
  ctx.fillText('Aceita o desafio?', width / 2, 1560)
  ctx.fillStyle = '#ff7a33'; ctx.font = `700 46px ${sans}`
  ctx.fillText(`${data.host}  ·  Bereia`, width / 2, 1640, 940)
  ctx.fillStyle = '#6d6a63'; ctx.font = `600 34px ${sans}`
  ctx.fillText('Menos rotina. Mais presença.', width / 2, 1780)
}

export function renderDuelCard(data: CardData): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = cardSize.width; canvas.height = cardSize.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(Error('Seu navegador não consegue gerar a imagem.'))
  drawDuelCard(ctx as unknown as CardContext, data)
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(Error('Não foi possível gerar a imagem.'))), 'image/png'))
}
