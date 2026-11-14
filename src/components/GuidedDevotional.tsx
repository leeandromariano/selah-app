import { useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import type { Publication } from '../devotionals/repository'
import { completeDevotionalNow } from '../reading/instantCompletion'
import { supabase } from '../lib/supabase'
import { DevotionalPassage } from './DevotionalPassage'
import { DiscussionSection } from './DiscussionSection'
import { LegacyDevotionalPassage } from './LegacyDevotionalPassage'
import { PrayerCapsuleForm } from './PrayerCapsuleForm'
import { ShareDevotional } from './ShareDevotional'

const steps = ['A Palavra', 'A Real', 'Coram Deo na Prática', 'Oração', 'Para lembrar'] as const
const prayerStep = 3
const lastStep = steps.length - 1
const swipeThreshold = 64

function blocksSwipe(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, summary, .devotional-chapter'))
}

// Devocional em etapas. Sem tempo mínimo: o devocional é concluído ao chegar em "Para lembrar" (pelo botão "Continuar e concluir").
export function GuidedDevotional({ item, alreadyCompleted = false, onCompleted, complete = completeDevotionalNow }: {
  item: Publication; alreadyCompleted?: boolean; onCompleted: () => void; complete?: typeof completeDevotionalNow
}) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<'forward' | 'backward' | null>(null)
  const [done, setDone] = useState(alreadyCompleted)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState('')
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  async function navigate(target: number) {
    if (target < 0 || target > lastStep || target === step || finishing) return
    setError('')
    if (target === lastStep && !done) {
      setFinishing(true)
      try { await complete(supabase, item.id); setDone(true); onCompleted() }
      catch { setError('Não foi possível concluir agora. Tente novamente.'); return }
      finally { setFinishing(false) }
    }
    setDirection(target > step ? 'forward' : 'backward')
    setStep(target)
  }
  function startSwipe(event: TouchEvent<HTMLElement>) {
    if (event.touches.length !== 1 || blocksSwipe(event.target)) { touchStart.current = null; return }
    touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  function finishSwipe(event: TouchEvent<HTMLElement>) {
    const start = touchStart.current
    touchStart.current = null
    if (!start || event.changedTouches.length !== 1 || blocksSwipe(event.target) || window.getSelection()?.toString()) return
    const deltaX = event.changedTouches[0].clientX - start.x
    const deltaY = event.changedTouches[0].clientY - start.y
    if (Math.abs(deltaX) < swipeThreshold || Math.abs(deltaX) <= Math.abs(deltaY) * 1.25) return
    // Concluir é uma ação deliberada: o deslize não passa da Oração para "Para lembrar" (só o botão ou a etapa).
    if (step === prayerStep && deltaX < 0 && !done) return
    void navigate(step + (deltaX < 0 ? 1 : -1))
  }
  return <div className="guided-devotional">
    <nav className="guided-steps" aria-label="Etapas do devocional">{steps.map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined} data-complete={index < step ? 'true' : undefined} onClick={() => void navigate(index)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}</nav>
    <section key={step} className="guided-panel" aria-label={steps[step]} data-direction={direction ?? undefined} onTouchStart={startSwipe} onTouchEnd={finishSwipe} onTouchCancel={() => { touchStart.current = null }} onTouchMove={event => { if (event.touches.length !== 1) touchStart.current = null }}>
      <div className="eyebrow">{String(step + 1).padStart(2, '0')} / {String(steps.length).padStart(2, '0')} · VIVER CORAM DEO</div>
      <h2>{steps[step]}</h2>
      {step === 0 && <>{item.bible_selection ? <DevotionalPassage key={`${item.id}:${item.reading_revision}`} selection={item.bible_selection} reference={item.bible_reference} inlineChapter /> : <LegacyDevotionalPassage reference={item.bible_reference} text={item.bible_text} />}<p className="guided-intro">Leia com calma. O que essa Palavra revela hoje?</p></>}
      {step === 1 && <>{item.content.split(/\n\s*\n/).map((text, index) => <p key={index}>{text}</p>)}{item.reflection_question && <div className="reflection"><div className="eyebrow">PARA REFLETIR</div><h3>{item.reflection_question}</h3></div>}</>}
      {step === 2 && <p>{item.practical_challenge}</p>}
      {step === prayerStep && <><p>{item.prayer_prompt}</p><PrayerCapsuleForm devotionalId={item.id} /><DiscussionSection devotionalId={item.id} /></>}
      {step === lastStep && <>{item.share_phrase?.trim() && <figure className="guided-phrase"><figcaption className="eyebrow">A FRASE DO DEVOCIONAL</figcaption><blockquote>{item.share_phrase.trim()}</blockquote></figure>}<ShareDevotional id={item.id} title={item.title} phrase={item.share_phrase} author={item.author_name} reference={item.bible_reference} />{done && <p role="status" className="success">Devocional concluído.</p>}</>}
    </section>
    <p className="guided-swipe-hint">Deslize para o lado para mudar de etapa.</p>
    {error && <p role="alert" className="info">{error}</p>}
    <div className="guided-navigation"><button type="button" className="button secondary" disabled={step === 0 || finishing} onClick={() => void navigate(step - 1)}>Voltar</button>{step === lastStep && <a className="button primary" href="#inicio">Ir para a tela inicial do Coram</a>}{step < lastStep && <button type="button" className="button primary" disabled={finishing} onClick={() => void navigate(step + 1)}>{step === prayerStep && !done ? (finishing ? 'Concluindo…' : 'Continuar e concluir') : 'Continuar →'}</button>}</div>
  </div>
}
