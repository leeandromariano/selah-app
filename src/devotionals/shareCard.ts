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

export function drawDevotionalCard(ctx: CanvasRenderingContext2D, options: { title: string; phrase?: string | null; author?: string | null; reference: string; url: string; format: CardFormat; theme: CardTheme }) {
  const { width, height } = cardDimensions[options.format]
  const palette = themes[options.theme]
  ctx.fillStyle = palette.background
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = palette.accent
  ctx.fillRect(84, 84, 90, 10)
  ctx.font = '600 26px "JetBrains Mono", monospace'
  ctx.fillText('CORAM  /  FRASE DO DEVOCIONAL', 84, 145)

  const feed = options.format === 'post'
  const referenceY = feed ? 200 : 260
  const minTop = feed ? 395 : 470
  const reference = options.reference.trim().slice(0, 200)
  ctx.font = '600 30px "JetBrains Mono", monospace'
  const referenceLines = lines(ctx, reference.toLocaleUpperCase('pt-BR'), width - 220).slice(0, 3)
  ctx.strokeStyle = palette.accent
  ctx.lineWidth = 2
  ctx.strokeRect(84, referenceY, width - 168, 72 + (referenceLines.length - 1) * 43)
  referenceLines.forEach((line, index) => ctx.fillText(line, 108, referenceY + 48 + index * 43))

  ctx.fillStyle = palette.text
  const availableWidth = width - 168
  const stackTop = height - 335
  const phrase = options.phrase?.trim() || options.title.trim()
  const showTitle = Boolean(options.phrase?.trim() && options.phrase.trim() !== options.title.trim())
  ctx.font = '600 26px "JetBrains Mono", monospace'
  const titleLines = showTitle ? lines(ctx, options.title.trim(), availableWidth).slice(0, 2) : []
  const authorName = options.author?.trim().slice(0, 120) ?? ''
  ctx.font = '600 30px "Plus Jakarta Sans", sans-serif'
  const authorLines = authorName ? lines(ctx, authorName, availableWidth) : []
  const authorText = authorLines.length > 1 ? authorLines[0] + '…' : authorLines[0] ?? ''
  const titleSpace = titleLines.length ? titleLines.length * 34 + 20 : 0
  const limit = stackTop - 40 - titleSpace - 20
  let size = feed ? 100 : 112
  let phraseLines: string[] = []
  let authorGap = 0
  const fits = () => {
    authorGap = authorText ? Math.round(size * 0.3) + 44 : 0
    return phraseLines.length <= 7 && phraseLines.every(line => ctx.measureText(line).width <= availableWidth)
      && minTop + (phraseLines.length - 1) * size * 1.12 + authorGap <= limit
  }
  do {
    ctx.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`
    phraseLines = lines(ctx, phrase, availableWidth)
    if (fits()) break
    size -= 4
  } while (size >= 44)
  if (!fits()) throw Error('Frase longa demais para o card')
  const lineHeight = size * 1.12
  const phraseBlock = phraseLines.length * lineHeight
  const top = Math.max(minTop, Math.min((height - phraseBlock - authorGap) / 2, limit - authorGap - (phraseLines.length - 1) * lineHeight))
  ctx.fillStyle = palette.text
  ctx.font = `800 ${size}px "Plus Jakarta Sans", sans-serif`
  phraseLines.forEach((line, index) => ctx.fillText(line, 84, top + index * lineHeight))

  if (authorText) {
    // Nome do autor, pequeno, logo abaixo da frase central.
    ctx.fillStyle = palette.subtle
    ctx.font = '600 30px "Plus Jakarta Sans", sans-serif'
    ctx.fillText(authorText, 84, top + (phraseLines.length - 1) * lineHeight + authorGap, availableWidth)
  }
  if (titleLines.length) {
    ctx.fillStyle = palette.subtle
    ctx.font = '600 26px "JetBrains Mono", monospace'
    titleLines.forEach((line, index) => ctx.fillText(line, 84, stackTop - 40 - (titleLines.length - 1) * 34 + index * 34))
  }

  ctx.fillStyle = palette.accent
  ctx.fillRect(84, stackTop, 110, 8)
  ctx.fillStyle = palette.text
  ctx.font = '800 52px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('MENOS ROTINA.', 84, height - 262)
  ctx.font = 'italic 52px "Instrument Serif", Georgia, serif'
  ctx.fillText('mais presença.', 84, height - 197)
  ctx.fillStyle = palette.subtle
  ctx.font = '800 25px "Plus Jakarta Sans", sans-serif'
  ctx.fillText('CORAM', 84, height - 140)
  // O link tem a própria linha na base, com a largura toda; não divide altura com a frase de marca.
  const url = options.url.trim()
  ctx.font = '500 19px "JetBrains Mono", monospace'
  const urlLines = lines(ctx, url, width - 168)
  const urlTop = height - 50 - (urlLines.length - 1) * 25
  ctx.fillText('ACESSE O APP:', 84, urlTop - 30)
  urlLines.forEach((line, index) => ctx.fillText(line, 84, urlTop + index * 25, width - 168))
}

