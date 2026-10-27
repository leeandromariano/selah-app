// Classic, parser-blocking bootstrap: shared by first paint and the React UI.
// No session, user ID, network call, or sensitive information belongs here.
;(function () {
  if (window.selahAppearance) return
  var key = 'selah.appearance.v1'
  var listeners = new Set()
  var media = null
  try { media = window.matchMedia('(prefers-color-scheme: dark)') } catch { /* light fallback */ }
  function valid(value) { return value === 'light' || value === 'dark' || value === 'system' }
  function read() {
    try { var value = window.localStorage.getItem(key); return valid(value) ? value : 'system' }
    catch { return 'system' }
  }
  var preference = read()
  var persistent = true
  var snapshot
  function apply() {
    var resolved = preference === 'system' ? (media && media.matches ? 'dark' : 'light') : preference
    document.documentElement.dataset.theme = resolved
    document.documentElement.style.colorScheme = resolved
    if (!snapshot || snapshot.preference !== preference || snapshot.resolved !== resolved || snapshot.persistent !== persistent) {
      snapshot = Object.freeze({ preference: preference, resolved: resolved, persistent: persistent })
      listeners.forEach(function (listener) { listener() })
    }
  }
  function systemChanged() { if (preference === 'system') apply() }
  function storageChanged(event) {
    if (event.key !== key && event.key !== null) return
    try { if (event.storageArea && event.storageArea !== window.localStorage) return } catch { return }
    preference = valid(event.newValue) ? event.newValue : 'system'
    persistent = true
    apply()
  }
  window.selahAppearance = {
    getSnapshot: function () { return snapshot },
    subscribe: function (listener) { listeners.add(listener); return function () { listeners.delete(listener) } },
    setPreference: function (value) {
      if (!valid(value)) return
      preference = value
      try { window.localStorage.setItem(key, value); persistent = true } catch { persistent = false }
      apply()
    },
    // Useful for isolated tests; no page or auth lifecycle calls this.
    dispose: function () {
      window.removeEventListener('storage', storageChanged)
      if (media) {
        if (media.removeEventListener) media.removeEventListener('change', systemChanged)
        else if (media.removeListener) media.removeListener(systemChanged)
      }
      listeners.clear()
    },
  }
  if (media) {
    if (media.addEventListener) media.addEventListener('change', systemChanged)
    else if (media.addListener) media.addListener(systemChanged)
  }
  window.addEventListener('storage', storageChanged)
  apply()
})()
