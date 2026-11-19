import { useState } from 'react'
import { BibleReference } from '../../components/BibleReference'
import type { PhaseDef } from './campaign'
import type { PhaseResult } from './repository'
import { levelFromXp } from './rules'
import { renderFragmentCard } from './fragmentCard'

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const romans = ['I', 'II', 'III', 'IV']

export type StoryResultProps = {
  phase: PhaseDef; won: boolean; kills: number; seconds: number; saved: PhaseResult | null; error: string
  nextPhase: PhaseDef | null; onNext: () => void; onAgain: () => void; onExit: () => void
}

// Tela de Vitória da campanha: fragmento desbloqueado à esquerda, resumo e recompensas à direita.
export function StoryResult({ phase, won, kills, seconds, saved, error, nextPhase, onNext, onAgain, onExit }: StoryResultProps) {
  const [note, setNote] = useState('')
  const reward = saved?.reward
  const before = saved && reward ? levelFromXp(saved.xp - reward.xp) : null
  const after = saved ? levelFromXp(saved.xp) : null
  const isNew = saved?.fragment?.is_new ?? false
  const share = async () => {
    setNote('Preparando o card…')
    try {
      const blob = await renderFragmentCard({ reference: phase.reference, theme: phase.theme, phaseName: `${phase.name} · Ato ${romans[phase.act - 1]}`, label: `Ato ${romans[phase.act - 1]} · Fase ${phase.index} concluída`, host: location.host })
      const file = new File([blob], 'fragmento-logos.png', { type: 'image/png' })
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: `Fragmento ${phase.reference} no CORAM // LOGOS` }); setNote('') }
      else { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'fragmento-logos.png'; link.click(); setNote('Imagem salva. Compartilhe nos Stories.') }
    } catch (e) { setNote(e instanceof Error && e.name !== 'AbortError' ? e.message : '') }
  }
  return <div className="lg-overlay lg-story-result" role="dialog" aria-modal="true" aria-label="Resultado da fase" data-won={won ? 'true' : 'false'}>
    <p className="lg-story-eyebrow">ATO {romans[phase.act - 1]} · FASE {phase.index} {won ? 'CONCLUÍDA' : 'NÃO CONCLUÍDA'}</p>
    <h2>{won ? <>VITÓRIA // <em>ESTÁ CONSUMADO</em></> : 'AS TREVAS RESISTIRAM'}</h2>
    <div className="lg-story-body">
      {won && <article className="lg-fragment-card" aria-label="Fragmento desbloqueado">
        <small>{isNew || !saved ? 'FRAGMENTO DESBLOQUEADO' : 'FRAGMENTO JÁ COLETADO'}</small>
        <span className="lg-fragment-mark" aria-hidden="true">†</span>
        <strong>{phase.reference}</strong>
        <p>{phase.theme}</p>
        <span className="lg-fragment-read"><BibleReference reference={phase.reference} /></span>
        <footer>CORAM // MINHA JORNADA<br />LOGOS-{String(phase.id).padStart(2, '0')}</footer>
      </article>}
      <dl className="lg-story-stats">
        <div><dt>Resumo da partida</dt><dd>{phase.name}</dd></div>
        <div className="lg-reward"><dt>Recompensa de fase</dt><dd>{reward ? `+${reward.sparks} Centelhas` : error ? '—' : 'Salvando…'}</dd></div>
        <div><dt>Experiência</dt><dd>{reward ? `+${reward.xp} XP${before !== null && after !== null && after > before ? ` · Nível ${before} → ${after}` : ''}` : error ? '—' : 'Salvando…'}</dd></div>
        <div><dt>Tempo</dt><dd>{clock(seconds)}</dd></div>
        {won && <div><dt>Minha Jornada</dt><dd>{saved ? (isNew ? 'Fragmento salvo ✓' : 'Já estava salvo ✓') : error ? 'Não salvo' : 'Salvando…'}</dd></div>}
        <div><dt>Inimigos purificados</dt><dd>{kills}</dd></div>
      </dl>
    </div>
    {error && <p className="lg-error" role="alert">{error}</p>}
    {note && <p className="lg-note" role="status">{note}</p>}
    <div className="lg-actions">
      {won && <button type="button" className="lg-secondary" onClick={() => void share()}>Compartilhar nos Stories</button>}
      {won && nextPhase && <button type="button" className="lg-primary" onClick={onNext}>Próxima fase →</button>}
      <button type="button" className={won && nextPhase ? 'lg-secondary' : 'lg-primary'} onClick={onAgain}>{won ? 'Jogar de novo' : 'Tentar de novo'}</button>
      <button type="button" className="lg-secondary" onClick={onExit}>Voltar à campanha</button>
    </div>
  </div>
}
