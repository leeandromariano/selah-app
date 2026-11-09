export type CardFormat = 'post' | 'story'
export type CardTheme = 'obsidian' | 'paper' | 'ember'

const themes = {
  obsidian: { background: '#0D0E11', text: '#F4F1EA', accent: '#FF5500', subtle: '#C5C2BB' },
  paper: { background: '#F4F1EA', text: '#0D0E11', accent: '#B63D00', subtle: '#4B4A47' },
  ember: { background: '#FF5500', text: '#0D0E11', accent: '#0D0E11', subtle: '#202022' },
} as const

export const cardDimensions = { post: { width: 1080, height: 1350 }, story: { width: 1080, height: 1920 } } as const

function lines(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const words = text.trim().split(/\s+/)
  const output: string[] = []
  let line = ''
  for (const word of words) {
    if (ctx.measureText(word).width > width) {
      if (line) { output.push(line); line = '' }
      for (const char of word) {
        if (line && ctx.measureText(line + char).width > width) { output.push(line); line = char }
        else line += char
      }
      continue
    }
    const next = line ? `${line} ${word}` : word
    if (line && ctx.measureText(next).width > width) { output.push(line); line = word }
    else line = next
  }
  if (line) output.push(line)
  return output
}

export function drawDevotionalCard(ctx: CanvasRenderingContext2D, options: { title: string; reference: string; url: string; format: CardFormat; theme: CardTheme }) {
  const { width, height } = cardDimensions[options.format]
  const palette = themes[options.theme]
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = palette.accent
  ctx.fillRect(84, 84, 90, 10)
  ctx.font = '600 26px "JetBrains Mono", monospace'
  ctx.fillText('CORAM  /  DEVOCIONAL', 84, 145)

  const reference = options.reference.trim().slice(0, 200)
  ctx.font = '600 30px "JetBrains Mono", monospace'
  const referenceLines = lines(ctx, reference.toLocaleUpperCase('pt-BR'), width - 220).slice(0, 3)
  ctx.strokeStyle = palette.accent
  ctx.lineWidth = 2
  ctx.strokeRect(84, 260, width - 168, 72 + (referenceLines.length - 1) * 43)
  referenceLines.forEach((line, index) => ctx.fillText(line, 108, 308 + index * 43))

  ctx.fillStyle = palette.text
  const availableWidth = width - 168
  let size = options.format === 'story' ? 112 : 100
  let titleLines: string[] = []
  do {
    ctx.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`
    titleLines = lines(ctx, options.title, availableWidth)
    if (titleLines.length <= 7 && titleLines.every(line => ctx.measureText(line).width <= availableWidth)) break
    size -= 4
  } while (size >= 48)
  const lineHeight = size * 1.12
  const titleBlock = titleLines.length * lineHeight
  const top = Math.max(470, Math.min((height - titleBlock) / 2, height - titleBlock - 330))
  titleLines.forEach((line, index) => ctx.fillText(line, 84, top + index * lineHeight))

  ctx.fillStyle = palette.accent
  ctx.fillRect(84, height - 270, 110, 8)
  ctx.fillStyle = palette.text
  ctx.font = '800 52px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('MENOS ROTINA.', 84, height - 190)
  ctx.font = 'italic 52px "Instrument Serif", Georgia, serif'
  ctx.fillText('mais presença.', 84, height - 125)
  ctx.fillStyle = palette.subtle
  ctx.font = '800 48px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('C', 84, height - 62)
  ctx.font = '800 25px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('CORAM', 145, height - 69)
  const url = options.url.trim()
  ctx.font = '500 20px "JetBrains Mono", monospace'
  ctx.fillText(url, 350, height - 70, width - 434)
}
