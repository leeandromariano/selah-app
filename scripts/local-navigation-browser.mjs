// Chromium UI regression with a synthetic Supabase module intercepted at the
// browser boundary. No account, credential, database or OWNER provisioning.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

if (process.argv.length !== 2) throw Error('No arguments accepted')
const origin = 'http://127.0.0.1:5173', debug = 'http://127.0.0.1:9229'
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!executable) throw Error('Installed Chromium unavailable')
let occupied = false
try { await fetch(debug + '/json/version', { signal: AbortSignal.timeout(1000) }); occupied = true } catch { /* own port only */ }
if (occupied) throw Error('Debug port occupied; existing browser refused')
const profile = resolve('node_modules/.cache/selah-navigation-browser', randomUUID())
mkdirSync(profile, { recursive: true })
const child = spawn(executable, ['--headless=new', '--no-first-run', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9229', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let socket, sequence = 0, passed = 0
const pending = new Map()
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout')) }, 15000)
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value) }, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
async function check(expression, label) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(expression)) { passed++; console.log('PASS ' + label); return }
    await sleep(100)
  }
  throw Error(label)
}
const mock = `
const session = { user: { id: 'synthetic-navigation' } }; let callback;
window.__ownerAllowed = true;
window.addEventListener('focus', () => callback?.('SIGNED_IN', { ...session }));
window.__renew = () => callback?.('TOKEN_REFRESHED', { ...session });
const query = { select(){return this}, eq(){return this}, lte(){return this}, order(){return this}, range:async()=>({data:[],error:null}) };
export const supabase = {
 auth: { getSession:async()=>({data:{session},error:null}), onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){callback=null}}}}}, signOut:async()=>({error:null}) },
 from:()=>query,
 rpc(name,args){
  if(name==='devotional_open_counts')return Promise.resolve({data:[],error:null});
  if(name==='get_owner_community')return {abortSignal:async()=>window.__ownerAllowed ? {data:{server_today:'2026-10-28',time_zone:'America/Sao_Paulo',page:0,size:25,total_readers:0,completed_today:0,matched_readers:0,readers:[]},error:null} : {data:null,error:{code:'42501'}}};
  if(name==='get_my_consistency') return {abortSignal:async()=>{
   const month=args.p_month??'2026-10-01'; await new Promise(r=>setTimeout(r,150));
   const count=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
   return {data:{server_now:'2026-10-28T15:00:00Z',server_today:'2026-10-28',time_zone:'America/Sao_Paulo',month,current_month:'2026-10-01',first_month:'2026-01-01',current_streak:0,best_streak:0,total_days:0,total_devotionals:0,today_completed:false,last_completed_day:null,status:'empty',days:Array.from({length:count},(_,i)=>({date:month.slice(0,8)+String(i+1).padStart(2,'0'),completions:0}))},error:null};
  }};
  return Promise.resolve({data:[],error:null});
 }
};`
try {
  let target
  for (let i = 0; i < 50; i++) {
    try { target = (await (await fetch(debug + '/json/list')).json()).find(t => t.url === 'about:blank'); if (target) break } catch { /* startup */ }
    await sleep(100)
  }
  const url = new URL(target.webSocketDebuggerUrl)
  if (url.protocol !== 'ws:' || url.host !== '127.0.0.1:9229' || !url.pathname.startsWith('/devtools/page/')) throw Error('Nonlocal debugger refused')
  socket = new WebSocket(url)
  await new Promise(r => socket.addEventListener('open', r, { once: true }))
  socket.addEventListener('message', async event => {
    const m = JSON.parse(String(event.data))
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(Error('CDP failed')); else p?.resolve(m.result) }
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params, u = new URL(request.url)
      try {
        if (u.origin === origin && u.pathname === '/src/lib/supabase.ts') await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(mock).toString('base64') })
        else await send(u.origin === origin ? 'Fetch.continueRequest' : 'Fetch.failRequest', u.origin === origin ? { requestId } : { requestId, errorReason: 'BlockedByClient' })
      } catch { /* closing */ }
    }
  })
  await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  await send('Page.navigate', { url: origin + '/#inicio' })
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='outubro de 2026'`, 'calendar loads synthetic current month')
  await evaluate(`document.querySelector('[aria-label="Mês anterior"]').click();document.querySelector('[aria-label="Mês anterior"]').click()`)
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='agosto de 2026'`, 'two rapid clicks accumulate through delayed responses')
  const tab = await send('Target.createTarget', { url: 'about:blank' })
  await send('Target.activateTarget', { targetId: tab.targetId }); await sleep(300)
  await send('Target.activateTarget', { targetId: target.id }); await send('Page.bringToFront')
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='agosto de 2026'`, 'tab loss and return preserve selected month')
  await evaluate(`document.querySelector('[aria-label="Próximo mês"]').focus()`)
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='setembro de 2026'`, 'keyboard advances one month')
  await send('Page.reload')
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='outubro de 2026'`, 'calendar reload starts at server current month')
  await check(`document.querySelector('[aria-label="Próximo mês"]')?.disabled`, 'future navigation blocked')
  await evaluate(`location.hash='admin/comunidade'`)
  await check(`Boolean(document.querySelector('.community-summary')) && !document.querySelector('.community [role="alert"]')`, 'community deep link opens with authorized synthetic response')
  await send('Target.activateTarget', { targetId: tab.targetId }); await sleep(300)
  await send('Target.activateTarget', { targetId: target.id }); await send('Page.bringToFront')
  await evaluate(`window.__renew()`)
  await check(`Boolean(document.querySelector('.community-summary')) && location.hash==='#admin/comunidade'`, 'focus plus session renewal preserve community route')
  await send('Page.reload')
  await check(`Boolean(document.querySelector('.community-summary'))`, 'refresh restores community section')
  await evaluate(`window.__ownerAllowed=false;window.__renew()`)
  await check(`Boolean(document.querySelector('.community [role="alert"]')) && !document.querySelector('.community table')`, 'OWNER revocation blocks data after renewal')
  console.log(passed + ' Chromium navigation checks passed; synthetic boundary, no backend access.')
} catch (error) { console.error('Navigation Chromium failed: ' + error.message); process.exitCode = 1 }
finally {
  try { if (socket?.readyState === WebSocket.OPEN) await send('Browser.close') } catch { /* own instance */ }
  socket?.close(); if (child.exitCode === null) child.kill()
}
