export type AppearancePreference = 'light' | 'dark' | 'system'
export type AppearanceSnapshot = Readonly<{ preference: AppearancePreference; resolved: 'light' | 'dark'; persistent: boolean }>
export type AppearanceStore = {
  getSnapshot: () => AppearanceSnapshot
  subscribe: (listener: () => void) => () => void
  setPreference: (value: AppearancePreference) => void
  dispose: () => void
}
declare global { interface Window { selahAppearance: AppearanceStore } }
