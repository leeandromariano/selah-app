import { useState } from 'react'
import { displayDate } from '../devotionals/repository'
import { supabase } from '../lib/supabase'
import { completeDevotionalNow } from '../reading/instantCompletion'

// Conclusão do devocional direto, sem tempo mínimo: o leitor conclui quando quiser. O servidor decide usuário, data e horário.
export function DevotionalCompletion({ devotionalId, completedAt, onCompleted, onCompletedNow, complete = completeDevotionalNow }: {
  devotionalId: string; completedAt: string | null; onCompleted: () => void; onCompletedNow?: () => void; complete?: typeof completeDevotionalNow
}) {
  const [doneAt, setDoneAt] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // A lista de conclusões pode chegar depois da tela: vale a que vier primeiro.
  const concludedAt = doneAt ?? completedAt
  async function conclude() {
    if (saving || concludedAt) return
    setSaving(true); setError('')
    try {
      const result = await complete(supabase, devotionalId)
      if (typeof navigator.vibrate === 'function') navigator.vibrate([45, 55, 45])
      setDoneAt(result.completed_at); onCompleted(); onCompletedNow?.()
    } catch { setError('Não foi possível concluir agora. Tente novamente.') }
    finally { setSaving(false) }
  }
  return <section className="reading-progress" aria-label="Conclusão do devocional" aria-busy={saving}>
    <h2>Sua leitura</h2>
    <p role="status" aria-live="polite">{concludedAt ? `Devocional concluído em ${displayDate(concludedAt)}, horário de Brasília.` : 'Quando terminar a leitura, conclua o devocional. A conclusão é uma escolha sua.'}</p>
    {error && <p className="info" role="alert">{error}</p>}
    {!concludedAt && <div className="actions"><button className="button primary" disabled={saving} onClick={() => void conclude()}>{saving ? 'Salvando conclusão…' : 'Concluir devocional'}</button></div>}
  </section>
}
