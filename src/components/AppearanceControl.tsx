import { useId, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import type { AppearancePreference } from '../appearance/store'

const icon = (children: ReactNode) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
const options: { value: AppearancePreference; label: string; icon: ReactNode }[] = [
  { value: 'light', label: 'Claro', icon: icon(<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>) },
  { value: 'dark', label: 'Escuro', icon: icon(<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />) },
  { value: 'system', label: 'Sistema', icon: icon(<><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></>) },
]

export function AppearanceControl() {
  const store = window.selahAppearance
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const note = useId()
  return <div className="appearance-control">
    <div className="appearance-options" role="group" aria-label="Aparência" aria-describedby={!state.persistent ? note : undefined}>
      {options.map(option => <button key={option.value} type="button" className="appearance-option" aria-label={option.label} title={option.label} aria-pressed={state.preference === option.value} onClick={() => store.setPreference(option.value)}>{option.icon}</button>)}
    </div>
    {!state.persistent && <small id={note} role="status">Sua escolha vale nesta aba. O navegador não permitiu salvá-la.</small>}
  </div>
}
