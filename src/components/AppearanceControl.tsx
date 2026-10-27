import { useId, useSyncExternalStore } from 'react'
import type { AppearancePreference } from '../appearance/store'

export function AppearanceControl() {
  const store = window.selahAppearance
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const note = useId()
  return <div className="appearance-control">
    <label>Aparência<select value={state.preference} aria-describedby={!state.persistent ? note : undefined} onChange={event => store.setPreference(event.target.value as AppearancePreference)}>
      <option value="light">Claro</option><option value="dark">Escuro</option><option value="system">Sistema</option>
    </select></label>
    {!state.persistent && <small id={note} role="status">Sua escolha vale nesta aba. O navegador não permitiu salvá-la.</small>}
  </div>
}
