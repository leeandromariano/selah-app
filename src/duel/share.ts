import { quizLevels, quizModes } from '../quiz/repository'
import type { DuelPlayer, DuelResult } from './repository'

export const duelUrl = (origin: string, code: string) => `${origin}/#bereia/duelo/${code}`
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`
export const duelThemeName = (mode: DuelResult['mode'], level: DuelResult['level']) => `${quizModes.find(item => item.id === mode)?.name ?? ''} · ${quizLevels.find(item => item.id === level)?.name ?? ''}`
export const secondsText = (ms: number) => `${(ms / 1000).toFixed(ms >= 100000 ? 0 : 1).replace('.', ',')} s`
export const playerName = (player: Pick<DuelPlayer, 'username' | 'is_me'>) => (player.is_me ? 'Você' : player.username ? `@${player.username}` : 'Jogador')

// Quem eu enfrento no card: o criador (se eu entrei por um convite) ou, se criei o duelo, o melhor entre os outros.
export function rival(players: DuelPlayer[]): DuelPlayer | null {
  const me = players.find(player => player.is_me)
  if (!me) return null
  const others = players.filter(player => !player.is_me)
  return (me.is_creator ? others[0] : others.find(player => player.is_creator)) ?? null
}
// Resultado do meu lado: vence quem acerta mais; no empate, quem responde mais rápido.
export function verdict(me: DuelPlayer, other: DuelPlayer): 'win' | 'lose' | 'tie' {
  if (me.correct !== other.correct) return me.correct > other.correct ? 'win' : 'lose'
  if (me.total_ms !== other.total_ms) return me.total_ms < other.total_ms ? 'win' : 'lose'
  return 'tie'
}
export const verdictText = { win: 'Ganhei o duelo! 🏆', lose: 'Perdi dessa vez 😅', tie: 'Empate!' } as const

export function inviteMessage(url: string, theme: string, size: number, myScore?: number) {
  const score = myScore === undefined ? '' : ` Eu fiz ${myScore} de ${size}.`
  return `Duelo Relâmpago na Bereia! ⚡ ${size} perguntas bíblicas cronometradas (${theme}).${score} Consegue me superar? ${url}`
}
