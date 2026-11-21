export type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

// O navegador dispara `beforeinstallprompt` uma única vez e possivelmente antes de a tela inicial
// montar; por isso o evento é capturado no carregamento do módulo e guardado aqui.
let deferred: InstallEvent | null = null
let installed = false
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(listener => listener())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferred = event as InstallEvent; emit() })
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit() })
}

export function subscribeInstall(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Entrega o convite guardado e o descarta: o navegador só permite usá-lo uma vez. */
export function takeInstallPrompt() {
  const event = deferred
  deferred = null
  if (event) emit()
  return event
}

export const hasInstallPrompt = () => deferred !== null

export function isAppInstalled() {
  return installed || window.matchMedia?.('(display-mode: standalone)').matches === true || (navigator as { standalone?: boolean }).standalone === true
}

export function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** Uso exclusivo de testes: descarta o evento capturado e o estado de instalação. */
export function resetInstallState() { deferred = null; installed = false; emit() }
