import { useEffect, useState } from 'react'
import type { Publication } from '../devotionals/repository'
import { createPrivateResponseRepository, responseBody } from '../devotionals/privateResponses'
import { supabase } from '../lib/supabase'
import { DevotionalPassage } from './DevotionalPassage'
import { LegacyDevotionalPassage } from './LegacyDevotionalPassage'
import { ReadingProgress } from './ReadingProgress'

const responses = createPrivateResponseRepository(supabase)
const steps = ['A Palavra', 'A Real', 'Prática Coram Deo', 'Oração e resposta'] as const

export function GuidedDevotional({ item, userId, onCompleted }: { item: Publication; userId: string; onCompleted: () => void }) {
  const [step, setStep] = useState(0)
  const [body, setBody] = useState('')
  const [savedBody, setSavedBody] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    let active = true
    responses.get(userId, item.id).then(result => {
      if (active) { setBody(result?.body ?? ''); setSavedBody(result?.body ?? ''); setLoading(false) }
    }).catch(() => { if (active) { setError('Não foi possível carregar sua resposta pessoal.'); setLoading(false) } })
    return () => { active = false }
  }, [userId, item.id])
  async function save() {
    if (saving) return
    setError(''); setNotice('')
    let validated: string
    try { validated = responseBody(body) } catch (cause) { setError((cause as Error).message); return }
    setSaving(true)
    try {
      const result = await responses.save(userId, item.id, validated)
      setBody(result.body); setSavedBody(result.body); setNotice('Sua resposta foi salva na sua conta.')
    } catch { setError('Não foi possível salvar sua resposta. Tente novamente.') }
    finally { setSaving(false) }
  }
  return <div className="guided-devotional">
    <nav className="guided-steps" aria-label="Etapas do devocional">{steps.map((label, index) => <button key={label} type="button" aria-current={step === index ? 'step' : undefined} data-complete={index < step ? 'true' : undefined} onClick={() => setStep(index)}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>)}</nav>
    <section className="guided-panel" aria-label={steps[step]}>
      <div className="eyebrow">{String(step + 1).padStart(2, '0')} / 04 · VIVER CORAM DEO</div>
      <h2>{steps[step]}</h2>
      {step === 0 && <>{item.bible_selection ? <DevotionalPassage key={`${item.id}:${item.reading_revision}`} selection={item.bible_selection} reference={item.bible_reference} /> : <LegacyDevotionalPassage reference={item.bible_reference} text={item.bible_text} />}<p className="guided-intro">Leia com calma. O que essa Palavra revela hoje?</p></>}
      {step === 1 && <>{item.content.split(/\n\s*\n/).map((text, index) => <p key={index}>{text}</p>)}{item.reflection_question && <div className="reflection"><div className="eyebrow">PARA REFLETIR</div><h3>{item.reflection_question}</h3></div>}</>}
      {step === 2 && <p>{item.practical_challenge}</p>}
      {step === 3 && <><p>{item.prayer_prompt}</p><label className="guided-response">Minha resposta pessoal<textarea aria-label="Minha resposta pessoal" maxLength={500} disabled={loading || saving} value={body} onChange={event => { setBody(event.target.value); setNotice('') }} placeholder="Escreva em uma frase o que você leva para hoje." /></label><p className="muted">Só você pode ver esta resposta. Ela fica no seu histórico pessoal.</p><button type="button" className="button primary" disabled={loading || saving || !body.trim() || body.trim() === savedBody} onClick={() => void save()}>{saving ? 'Salvando…' : 'Salvar resposta'}</button>{loading && <p role="status">Carregando sua resposta…</p>}{error && <p role="alert" className="info">{error}</p>}{notice && <p role="status" className="success">{notice}</p>}</>}
    </section>
    <div className="guided-navigation"><button type="button" className="button secondary" disabled={step === 0} onClick={() => setStep(value => value - 1)}>Voltar</button>{step < 3 && <button type="button" className="button primary" onClick={() => setStep(value => value + 1)}>Continuar →</button>}</div>
    <div hidden={step !== 3}><ReadingProgress devotionalId={item.id} revision={item.reading_revision} onCompleted={onCompleted} /></div>
  </div>
}
