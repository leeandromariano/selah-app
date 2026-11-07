type FumsWindow = Window & { fums?: (action: string, token: string) => void }
let tracker: Promise<void> | undefined

function loadTracker(): Promise<void> {
  if (tracker) return tracker
  tracker = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://pkg.api.bible/fumsV3.min.js'
    script.async = true
    script.onload = () => typeof (window as FumsWindow).fums === 'function' ? resolve() : reject(Error('Registro de uso indisponível'))
    script.onerror = () => { script.remove(); reject(Error('Registro de uso indisponível')) }
    document.head.appendChild(script)
  }).catch(error => { tracker = undefined; throw error })
  return tracker
}

// Called only when a licensed chapter is actually displayed; no user ID is sent.
export async function reportBibleView(token: string): Promise<void> {
  if (!token.trim()) throw Error('Registro de uso indisponível')
  await loadTracker()
  ;(window as FumsWindow).fums!('trackView', token)
}
