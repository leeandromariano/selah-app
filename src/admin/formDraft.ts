import { useEffect, useState } from 'react'
import type { DevotionalInput } from './repository'

// Rascunho do formulário de devocional guardado neste aparelho enquanto o formulário está aberto: sobrevive a trocar de aba,
// de tela ou a o celular recarregar a página. Some ao salvar, publicar, cancelar ou sair da conta.
const PREFIX = 'coram.devocional-rascunho.'
export type FormDraft<T> = { editing: T; date: string }

function read<T extends DevotionalInput>(key: string): FormDraft<T> | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null') as FormDraft<T> | null
    const e = value?.editing
    if (!e || typeof e !== 'object' || typeof e.title !== 'string' || typeof e.content !== 'string' || typeof e.status !== 'string' || typeof value.date !== 'string') return null
    return { editing: e, date: value.date }
  } catch { return null }
}

export function useFormDraft<T extends DevotionalInput>(scope: 'admin' | 'publicador', userId: string) {
  const key = `${PREFIX}${scope}.${userId}`
  const [recovered] = useState(() => read<T>(key))
  const [editing, setEditing] = useState<T | null>(recovered?.editing ?? null)
  const [date, setDate] = useState(recovered?.date ?? '')
  useEffect(() => {
    // armazenamento indisponível (navegação privada, cota cheia): o formulário segue funcionando, só não é guardado
    try { if (editing) localStorage.setItem(key, JSON.stringify({ editing, date })); else localStorage.removeItem(key) } catch { /* sem armazenamento */ }
  }, [key, editing, date])
  return { editing, setEditing, date, setDate, recovered: recovered !== null }
}

export function clearFormDrafts() {
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key) } catch { /* sem armazenamento */ }
}
