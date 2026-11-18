import type { SupabaseClient } from '@supabase/supabase-js'
import { pieceIds, type Armadura, type PieceId } from './rules'

export type LogosMode = 'vigilia' | 'farol'
export type LogosState = {
  sparks: number; xp: number; level: number
  vigilia_best_wave: number; vigilia_runs: number; farol_runs: number; farol_wins: number; kills_total: number
  armadura: Armadura
}
export type RunReport = { mode: LogosMode; wave: number; kills: number; seconds: number; won: boolean }
export type RunReward = { sparks: number; xp: number }

const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
type Rpc = Pick<SupabaseClient, 'rpc'>

// Mensagens do servidor que valem mostrar como estão (já em português).
const friendly = ['Centelhas insuficientes', 'Esta peça já está no nível máximo', 'Você jogou muitas partidas seguidas']

function parseState(value: unknown): LogosState {
  const v = value as Partial<LogosState> | null
  const a = v?.armadura as Partial<Record<PieceId, unknown>> | undefined
  if (!v || !count(v.sparks) || !count(v.xp) || !count(v.level) || !count(v.vigilia_best_wave) || !count(v.vigilia_runs) || !count(v.farol_runs) || !count(v.farol_wins) || !count(v.kills_total) || !a
    || pieceIds.some(id => typeof a[id] !== 'number' || !Number.isInteger(a[id]) || (a[id] as number) < 1 || (a[id] as number) > 5)) throw Error('Resposta inválida do servidor.')
  return {
    sparks: v.sparks, xp: v.xp, level: v.level, vigilia_best_wave: v.vigilia_best_wave, vigilia_runs: v.vigilia_runs, farol_runs: v.farol_runs, farol_wins: v.farol_wins, kills_total: v.kills_total,
    armadura: Object.fromEntries(pieceIds.map(id => [id, a[id] as number])) as Armadura,
  }
}

export function createLogosRepository(client: Rpc) {
  async function call(name: string, args: Record<string, unknown>, fallback: string) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) {
      const message = typeof error.message === 'string' ? error.message : ''
      throw Error(friendly.find(text => message.startsWith(text)) ? message : fallback)
    }
    return data as unknown
  }
  return {
    async lobby(): Promise<LogosState> { return parseState(await call('logos_lobby', {}, 'Não foi possível abrir o LOGOS agora. Verifique a conexão e tente de novo.')) },
    async upgrade(piece: PieceId): Promise<LogosState> {
      if (!pieceIds.includes(piece)) throw Error('Peça de armadura inválida.')
      return parseState(await call('logos_armadura_upgrade', { p_piece: piece }, 'Não foi possível aprimorar a peça agora. Tente de novo.'))
    },
    async finishRun(report: RunReport): Promise<LogosState & { reward: RunReward }> {
      const body = {
        p_mode: report.mode, p_wave: Math.max(0, Math.min(200, Math.floor(report.wave))), p_kills: Math.max(0, Math.floor(report.kills)),
        p_seconds: Math.max(5, Math.min(3600, Math.round(report.seconds))), p_won: report.won,
      }
      body.p_kills = Math.min(body.p_kills, 2000, body.p_seconds * 5)
      const data = await call('logos_run_finish', body, 'Não foi possível salvar a partida agora.') as { reward?: Partial<RunReward> } | null
      if (!data || !data.reward || !count(data.reward.sparks) || !count(data.reward.xp)) throw Error('Resposta inválida do servidor.')
      return { ...parseState(data), reward: { sparks: data.reward.sparks, xp: data.reward.xp } }
    },
  }
}
