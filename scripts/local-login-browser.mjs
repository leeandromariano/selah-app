// Fallback for an unavailable browser connector. Uses installed Chromium with a
// NEW isolated profile, never personal profiles/cookies/storage. No installation.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepareLocalScript, localUrl } from './local-environment.mjs'
const local = prepareLocalScript()
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!executable) { console.error('Installed Chromium unavailable; browser checks NOT executed.'); process.exit(1) }
const debug = 'http://127.0.0.1:9227'
try { await fetch(debug + '/json/version', { redirect: 'error', signal: AbortSignal.timeout(1000) }); console.error('Debug port occupied; existing browser will not be accessed.'); process.exit(1) } catch { /* own instance only */ }
const profile = resolve('node_modules/.cache/selah-login-browser', randomUUID())
mkdirSync(profile, { recursive: true })
const child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--disable-client-side-phishing-detection', '--disable-features=MediaRouter,OptimizationHints', '--metrics-recording-only', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9227', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
let socket, passed = 0, stage = 'browser setup', sequence = 0
const pending = new Map(), endpoints = new Set()
function check(ok, label) { stage = label; if (!ok) throw Error('Browser check failed'); passed++; console.log('PASS ' + label) }
const pause = ms => new Promise(r => setTimeout(r, ms))
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('Browser command timed out')) }, 15000)
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject: error => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
async function waitFor(expression) {
  for (let i = 0; i < 80; i++) {
    try { if (await evaluate(expression)) return true }
    catch (error) { if (error.code !== 'DOCUMENT_CHANGED') throw error }
    await pause(150)
  }
  return false
}
function showOwnUsername(username) {
  // Re-rendering during session restoration may replace a collapsed panel.
  // Ensure the desired state, never toggle an already expanded panel closed.
  return waitFor(`(() => {
    const button=Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Consultar meu username');
    if(button?.getAttribute('aria-expanded')==='false')button.click();
    return Boolean(document.querySelector('header a[href="#perfil"]')) && document.body.innerText.includes(${JSON.stringify(username)});
  })()`)
}
try {
  child.on('error', () => {})
  let tabs
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw Error('Isolated browser unavailable')
    try { tabs = await (await fetch(debug + '/json/list', { redirect: 'error', signal: AbortSignal.timeout(1000) })).json(); if (tabs.length) break } catch { /* startup */ }
    await pause(250)
  }
  const target = tabs?.find(tab => tab.type === 'page' && tab.url === 'about:blank')
  if (!target) throw Error('Isolated target unavailable')
  const debuggerUrl = new URL(target.webSocketDebuggerUrl)
  if (debuggerUrl.protocol !== 'ws:' || debuggerUrl.hostname !== '127.0.0.1' || debuggerUrl.port !== '9227' || !debuggerUrl.pathname.startsWith('/devtools/page/') || debuggerUrl.username || debuggerUrl.password || debuggerUrl.search || debuggerUrl.hash) throw Error('Non-local debug target refused')
  socket = new WebSocket(debuggerUrl.href)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }) })
  socket.addEventListener('message', async event => {
    const message = JSON.parse(String(event.data))
    if (message.id) {
      const item = pending.get(message.id); pending.delete(message.id)
      if (message.error) {
        const changed = /Execution context was destroyed|Cannot find context|Inspected target navigated/.test(message.error.message || '')
        item?.reject(Object.assign(Error(changed ? 'Document changed' : 'Browser command failed'), { code: changed ? 'DOCUMENT_CHANGED' : 'BROWSER_COMMAND_FAILED' }))
      } else item?.resolve(message.result)
    }
    if (message.method === 'Fetch.requestPaused') {
      const { requestId, request } = message.params
      const url = new URL(request.url)
      const allowed = ['http://127.0.0.1:5173', 'http://127.0.0.1:54321'].includes(url.origin)
      try { await send(allowed ? 'Fetch.continueRequest' : 'Fetch.failRequest', allowed ? { requestId } : { requestId, errorReason: 'BlockedByClient' }) } catch { /* closing */ }
    }
    if (message.method === 'Network.requestWillBeSent') {
      const url = new URL(message.params.request.url)
      if (url.port === '54321') endpoints.add(url.pathname)
    }
  })
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
  await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  const account = { email: `selah-browser-${randomUUID()}@example.invalid`, username: 'u' + randomUUID().replaceAll('-', '').slice(0, 20), password: `Fiction-${randomUUID()}!` }
  const result = await local.client().auth.signUp({ email: account.email, password: account.password, options: { emailRedirectTo: local.frontend, data: { username: account.username, whatsapp: '+5511999990000' } } })
  check(!result.error && !result.data.session, 'new fictitious browser account requires confirmation')
  let link
  for (let i = 0; i < 20 && !link; i++) {
    const list = await (await local.fetch(local.mail + '/api/v1/messages')).json()
    const item = list.messages?.find(m => m.To?.some(to => to.Address === account.email))
    if (item) { const content = await (await local.fetch(local.mail + '/api/v1/message/' + item.ID)).json(); link = ((content.Text || content.HTML).match(/https?:\/\/[^\s"<>]+/g) || []).map(x => x.replaceAll('&amp;', '&')).find(x => x.includes('/auth/v1/verify?')) }
    if (!link) await pause(500)
  }
  if (!link) throw Error('Local confirmation unavailable')
  const confirmation = await local.fetch(link)
  check(Boolean(new URLSearchParams(localUrl(confirmation.headers.get('location'), 'frontend').hash.slice(1)).get('access_token')), 'browser fixture confirmed through local Mailpit')
  await send('Page.navigate', { url: local.frontend + '/#login' })
  check(await waitFor("Boolean(document.querySelector('input[name=identifier]'))"), 'single user-or-email form opens in Chromium')
  async function login(identifier, secret = account.password) {
    await evaluate(`(() => { const values = ${JSON.stringify({ identifier, password: secret })}; for (const [name,value] of Object.entries(values)) { const input=document.querySelector('input[name='+name+']'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); } document.querySelector('form').requestSubmit(); })()`)
  }
  await login('@' + account.username.toUpperCase())
  check(await waitFor("Boolean(document.querySelector('header a[href=\"#perfil\"]'))"), '@username and password authenticate through the real browser form')
  await send('Page.navigate', { url: local.frontend + '/#perfil' })
  if (!await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Consultar meu username')")) throw Error('Profile unavailable')
  check(await showOwnUsername(account.username), 'own permanent username loads from PostgreSQL in browser')
  const reloadDocumentTime = await evaluate('performance.timeOrigin')
  // Regression: exercise reload with delayed local responses. The old test
  // clicked once while restoration re-rendered the panel, then observed it closed.
  await send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: -1, uploadThroughput: -1 })
  await send('Page.reload')
  check(await waitFor(`performance.timeOrigin !== ${reloadDocumentTime}`), 'reload created a fresh document before session assertions')
  if (!await waitFor("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Consultar meu username')")) throw Error('Profile unavailable after reload')
  check(await showOwnUsername(account.username), 'session and own profile persist after real page reload')
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  await evaluate("Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Sair').click()")
  check(await waitFor("Boolean(document.querySelector('input[name=identifier]')) && !document.querySelector('header a[href=\"#perfil\"]')"), 'logout removes authenticated navigation and returns to login')
  const signedOutDocumentTime = await evaluate('performance.timeOrigin')
  await send('Page.reload')
  if (!await waitFor(`performance.timeOrigin !== ${signedOutDocumentTime}`)) throw Error('Signed-out document did not reload')
  check(await waitFor("Boolean(document.querySelector('input[name=identifier]')) && !document.querySelector('header a[href=\"#perfil\"]')"), 'reload after logout does not restore revoked browser session')
  await login(account.email)
  check(await waitFor("Boolean(document.querySelector('header a[href=\"#perfil\"]'))"), 'email and same password still authenticate in browser')
  await evaluate("Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Sair').click()")
  if (!await waitFor("Boolean(document.querySelector('input[name=identifier]'))")) throw Error('Logout unavailable')
  await login(account.username, 'incorrect-fiction-password')
  check(await waitFor("document.querySelector('[role=alert]')?.textContent.includes('Usuário, e-mail ou senha inválidos')"), 'incorrect password has generic Portuguese error in browser')
  check(endpoints.has('/functions/v1/password-login') && endpoints.has('/auth/v1/user') && endpoints.has('/auth/v1/logout'), 'browser used server login and official session/logout API')
  console.log(`${passed} isolated Chromium browser checks passed. Synthetic account retained; no storage or tokens inspected or printed.`)
} catch {
  console.error(`Browser validation stopped at ${stage}; ${passed} checks passed. Remaining checks NOT executed.`)
  if (socket?.readyState === WebSocket.OPEN) {
    try { console.error('Safe browser state: ' + JSON.stringify(await evaluate("({ signedIn: Boolean(document.querySelector('header a[href=\"#perfil\"]')), usernameExpanded: Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Consultar meu username')?.getAttribute('aria-expanded'), loginForm: Boolean(document.querySelector('input[name=identifier]')) })"))) } catch { /* no account diagnostics */ }
  }
  process.exitCode = 1
} finally {
  try { if (socket?.readyState === WebSocket.OPEN) await send('Browser.close') } catch { /* own instance only */ }
  socket?.close()
  if (child.exitCode === null) child.kill()
}
