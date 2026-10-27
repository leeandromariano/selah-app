// Fallback when the in-app connector is unavailable: installed Chromium,
// a NEW isolated profile, fixed loopback targets, no personal browser storage.
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { prepareLocalScript } from './local-environment.mjs'
import { readingAccount, seedReadingContent, sleep } from './reading-local-fixtures.mjs'
import { seedConsistency } from './consistency-local-fixtures.mjs'
const local=prepareLocalScript()
const executable=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!executable) { console.error('Installed Chromium unavailable; browser checks NOT executed.'); process.exit(1) }
const debug='http://127.0.0.1:9228'
try { await fetch(debug+'/json/version',{redirect:'error',signal:AbortSignal.timeout(1000)}); console.error('Debug port occupied; existing browser will not be accessed.'); process.exit(1) } catch { /* own instance only */ }
const profile=resolve('node_modules/.cache/selah-reading-browser',randomUUID())
mkdirSync(profile,{recursive:true})
const child=spawn(executable,['--headless=new','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-sync','--disable-background-networking','--disable-component-update','--disable-domain-reliability','--disable-client-side-phishing-detection','--disable-features=MediaRouter,OptimizationHints','--metrics-recording-only','--remote-debugging-address=127.0.0.1','--remote-debugging-port=9228','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'})
let socket,sequence=0,passed=0,stage='browser setup', ownerFixture
const pending=new Map(), endpoints=new Set()
function check(ok,label) { stage=label; if(!ok)throw Error('Browser check failed'); passed++; console.log('PASS '+label) }
function send(method,params={}) {
  const id=++sequence
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Browser command timed out'))},15000)
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}})
    socket.send(JSON.stringify({id,method,params}))
  })
}
const evaluate=async expression=>(await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value
async function waitFor(expression,seconds=15) {
  for(let i=0;i<seconds*4;i++) {
    try { if(await evaluate(expression))return true } catch(error) { if(error.code!=='DOCUMENT_CHANGED')throw error }
    await sleep(250)
  }
  return false
}
const progress='Number(document.querySelector("progress")?.value ?? -1)'
const conclude='Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Concluir devocional")'
try {
  child.on('error',()=>{})
  let tabs
  for(let i=0;i<40;i++) {
    if(child.exitCode!==null)throw Error('Isolated browser unavailable')
    try { tabs=await(await fetch(debug+'/json/list',{redirect:'error',signal:AbortSignal.timeout(1000)})).json();if(tabs.length)break } catch { /* startup */ }
    await sleep(250)
  }
  const target=tabs?.find(t=>t.type==='page'&&t.url==='about:blank')
  if(!target)throw Error('Isolated target unavailable')
  const url=new URL(target.webSocketDebuggerUrl)
  if(url.protocol!=='ws:'||url.hostname!=='127.0.0.1'||url.port!=='9228'||!url.pathname.startsWith('/devtools/page/')||url.username||url.password||url.search||url.hash)throw Error('Non-local debug target refused')
  socket=new WebSocket(url.href)
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})})
  socket.addEventListener('message',async event=>{
    const message=JSON.parse(String(event.data))
    if(message.id) {
      const item=pending.get(message.id);pending.delete(message.id)
      if(message.error) {
        const changed=/Execution context was destroyed|Cannot find context|Inspected target navigated/.test(message.error.message||'')
        item?.reject(Object.assign(Error('Browser command failed'),{code:changed?'DOCUMENT_CHANGED':'BROWSER_COMMAND_FAILED'}))
      } else item?.resolve(message.result)
    }
    if(message.method==='Fetch.requestPaused') {
      const {requestId,request}=message.params, targetUrl=new URL(request.url)
      const allowed=['http://127.0.0.1:5173','http://127.0.0.1:54321'].includes(targetUrl.origin)
      try { await send(allowed?'Fetch.continueRequest':'Fetch.failRequest',allowed?{requestId}:{requestId,errorReason:'BlockedByClient'}) } catch { /* closing */ }
    }
    if(message.method==='Network.requestWillBeSent') {
      const targetUrl=new URL(message.params.request.url)
      if(targetUrl.port==='54321')endpoints.add(targetUrl.pathname)
    }
  })
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*'}]})
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
  const account=await readingAccount(local), ids=seedReadingContent(local,account.id)
  seedConsistency(local,account.id,{offsets:[-2,-1],dates:['2018-12-31','2019-01-01','2019-01-02','2019-01-03','2019-01-04']})
  check(Boolean(account.id),'fictitious browser account confirmed via Mailpit')
  async function login(identifier) {
    if(!await waitFor('Boolean(document.querySelector("input[name=identifier]"))'))throw Error('Login form unavailable')
    await evaluate(`(()=>{const values=${JSON.stringify({identifier,password:account.password})};for(const[name,value]of Object.entries(values)){const input=document.querySelector('input[name='+name+']');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('form').requestSubmit();})()`)
    if(!await waitFor(`Boolean(document.querySelector('header a[href="#perfil"]'))`))throw Error('Browser login failed')
  }
  await send('Page.navigate',{url:local.frontend+'/#login'})
  await login('@'+account.username.toUpperCase())
  check(true,'official browser form authenticates @username with uppercase letters')
  check(await waitFor(`document.querySelector('.consistency-current strong')?.textContent==='2' && document.querySelector('.consistency-message')?.textContent.includes('Ainda pode manter')`),'browser shows backend pending streak from two prior civil days')
  check(await evaluate(`Array.from(document.querySelectorAll('.consistency-totals>div')).find(d=>d.textContent.includes('Recorde pessoal'))?.textContent.includes('5 dias')`),'browser separates historical record from current streak')
  const firstMonth=await evaluate(`document.querySelector('.consistency-calendar h3').textContent`)
  await evaluate(`document.querySelector('button[aria-label="Mês anterior"]').click()`)
  check(await waitFor(`document.querySelector('.consistency-calendar h3')?.textContent!==${JSON.stringify(firstMonth)} && document.querySelector('.consistency-current strong')?.textContent==='2'`),'previous month loads without editing streak')
  await evaluate(`document.querySelector('button[aria-label="Próximo mês"]').focus()`)
  check(await evaluate(`document.activeElement===document.querySelector('button[aria-label="Próximo mês"]')`),'calendar navigation receives keyboard focus')
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  check(await waitFor(`document.querySelector('.consistency-calendar h3')?.textContent===${JSON.stringify(firstMonth)}`),'keyboard navigation returns to current month')
  await evaluate(`document.querySelector('.consistency').scrollIntoView({block:'start'})`)
  const desktopScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  writeFileSync(resolve(profile,'consistency-desktop.png'),Buffer.from(desktopScreenshot.data,'base64'))
  await send('Page.navigate',{url:local.frontend+'/#leitura/'+ids[0]});await send('Page.bringToFront')
  check(await waitFor('Boolean(document.querySelector("progress")) && document.hasFocus() && document.visibilityState==="visible"'),'visible focused reader starts with real authenticated RPC')
  check(await evaluate(`Boolean(${conclude}?.disabled)`),'completion initially disabled')
  check(await waitFor(progress+'>=5000',20),'first real server checkpoint persists at least five seconds')
  const beforeHide=await evaluate(progress)
  const hiddenTab=await send('Target.createTarget',{url:'about:blank'})
  await send('Target.activateTarget',{targetId:hiddenTab.targetId})
  check(await waitFor('document.visibilityState==="hidden"'),'switching real tabs makes reading document hidden')
  await sleep(12000)
  check(await evaluate(progress+'==='+beforeHide),'hidden tab receives no additional confirmed time')
  check(await evaluate('document.querySelector(".reading-progress [role=status]")?.textContent.includes("Leitura pausada")'),'hidden reader shows paused state')
  await send('Target.activateTarget',{targetId:target.id});await send('Page.bringToFront')
  check(await waitFor(progress+'>'+beforeHide,20),'returning to real tab resumes confirmation')
  const beforeReload=await evaluate(progress), oldDocument=await evaluate('performance.timeOrigin')
  await send('Page.reload')
  if(!await waitFor('performance.timeOrigin!=='+oldDocument+' && Boolean(document.querySelector("progress"))'))throw Error('Reload unavailable')
  await waitFor('document.querySelector(".reading-progress")?.getAttribute("aria-busy")==="false"')
  await evaluate('Array.from(document.querySelectorAll("button")).find(b=>b.textContent==="Continuar leitura aqui")?.click()')
  check(await waitFor(progress+'>='+beforeReload),'page reload restores confirmed progress from PostgreSQL')
  console.log('Waiting for sixty confirmed seconds in real browser, without changing clocks or database progress.')
  check(await waitFor(progress+'===60000',90),'browser accumulated sixty thousand server-validated milliseconds')
  check(await evaluate(`Boolean(${conclude} && !${conclude}.disabled) && !document.querySelector('.reading-progress [role=status]')?.textContent.includes('Devocional concluído')`),'sixty seconds enables button without automatic completion')
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
  check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'reader layout fits mobile viewport without horizontal overflow')
  await evaluate(`${conclude}.focus();${conclude}.scrollIntoView({block:'center'});`)
  check(await evaluate(`document.activeElement===${conclude}`),'completion control receives keyboard focus')
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  check(await waitFor('document.querySelector(".reading-progress [role=status]")?.textContent.includes("Devocional concluído")'),'explicit keyboard action persists voluntary completion')
  const completedDocument=await evaluate('performance.timeOrigin')
  await send('Page.reload')
  check(await waitFor('performance.timeOrigin!=='+completedDocument+' && document.querySelector(".reading-progress [role=status]")?.textContent.includes("Devocional concluído")'),'real page reload preserves completion')
  await evaluate('document.querySelector(".reading-progress").scrollIntoView({block:"center"})')
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  writeFileSync(resolve(profile,'reading-mobile.png'),Buffer.from(screenshot.data,'base64'))
  console.log('Mobile screenshot stored only in ignored browser cache.')
  await evaluate('Array.from(document.querySelectorAll("header button")).find(b=>b.textContent==="Sair").click()')
  await login(account.email)
  await send('Page.navigate',{url:local.frontend+'/#leitura/'+ids[0]})
  check(await waitFor('document.querySelector(".reading-progress [role=status]")?.textContent.includes("Devocional concluído")'),'logout and new email login preserve completion')
  await send('Page.navigate',{url:local.frontend+'/#minhas-leituras'})
  check(await waitFor('document.querySelector(".completion-history")?.textContent.includes("Leitura fictícia 1")'),'personal history lists completion separately from openings')
  check(await waitFor(`document.querySelector('.consistency-current strong')?.textContent==='3' && document.querySelector('.consistency-today')?.textContent.includes('concluído')`),'real sixty-second conclusion advances streak after new login')
  check(await evaluate(`Array.from(document.querySelectorAll('.consistency-totals>div')).find(d=>d.textContent.includes('Dias com conclusões'))?.textContent.endsWith('8') && Array.from(document.querySelectorAll('.consistency-totals>div')).find(d=>d.textContent.includes('Devocionais concluídos'))?.textContent.endsWith('8')`),'browser totals distinguish persisted completed days and texts')
  check(await evaluate(`document.querySelector('.consistency-calendar time[aria-current="date"]')?.getAttribute('aria-label').includes('1 devocional concluído') && document.querySelector('.calendar-today')?.textContent.includes('✓')`),'today uses accessible text, checkmark and outline')
  check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'consistency calendar fits mobile viewport without horizontal overflow')
  await evaluate(`document.querySelector('.consistency').scrollIntoView({block:'start'})`)
  const mobileScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  writeFileSync(resolve(profile,'consistency-mobile.png'),Buffer.from(mobileScreenshot.data,'base64'))
  check(endpoints.has('/rest/v1/rpc/get_my_consistency'),'browser obtains metrics only from authenticated local RPC')
  check(endpoints.has('/rest/v1/rpc/checkpoint_reading')&&endpoints.has('/rest/v1/rpc/pause_reading')&&endpoints.has('/rest/v1/rpc/complete_devotional'),'browser used real server checkpoint, pause and completion RPCs')
  if(!/\b0\b/.test(local.psql('begin read only; select count(*) from private.app_owner; rollback;')))throw Error('Existing owner retained; browser grant refused')
  ownerFixture=account.id
  local.psql(`begin; insert into private.app_owner(user_id) values('${ownerFixture}'); insert into private.admin_users(user_id) values('${ownerFixture}'); commit;`)
  await send('Page.navigate',{url:local.frontend+'/#admin'})
  await send('Page.reload')
  check(await waitFor(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Comunidade e ofensivas')`),'browser revalidates editorial access after explicit synthetic server grant')
  await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Comunidade e ofensivas').click()`)
  check(await waitFor(`Boolean(document.querySelector('.community table'))`),'OWNER dashboard loads real administrative RPC')
  await evaluate(`(()=>{const input=document.querySelector('.community input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(account.username)});input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()})()`)
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r'})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13})
  check(await waitFor(`document.querySelectorAll('.community tbody tr').length===1 && document.querySelector('.community tbody')?.textContent.includes(${JSON.stringify(account.username)})`),'OWNER searches individual reader using keyboard')
  check(await evaluate(`document.querySelector('.community tbody')?.textContent.includes('Concluído hoje')`),'OWNER sees real completed-today status')
  check(await evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'OWNER table scrolls inside mobile layout')
  await evaluate(`document.querySelector('.community').scrollIntoView({block:'start'})`)
  const ownerScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  writeFileSync(resolve(profile,'community-mobile.png'),Buffer.from(ownerScreenshot.data,'base64'))
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
  const ownerDesktop=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})
  writeFileSync(resolve(profile,'community-desktop.png'),Buffer.from(ownerDesktop.data,'base64'))
  check(endpoints.has('/rest/v1/rpc/get_owner_community'),'OWNER dashboard obtains only authenticated community projection')
  console.log(`${passed} isolated Chromium reading checks passed. No storage, tokens, passwords or personal browser data inspected/printed.`)
} catch {
  console.error(`Reading browser stopped at ${stage}; ${passed} checks passed; remaining checks NOT executed.`)
  if(socket?.readyState===WebSocket.OPEN)try { console.error('Safe reader state: '+JSON.stringify(await evaluate('({visible:document.visibilityState,focus:document.hasFocus(),progress:Number(document.querySelector("progress")?.value??-1),status:document.querySelector(".reading-progress [role=status]")?.textContent,error:Boolean(document.querySelector(".reading-progress [role=alert]"))})'))) } catch { /* no account diagnostics */ }
  process.exitCode=1
} finally {
  if(ownerFixture)local.psql(`begin; delete from private.app_owner where user_id='${ownerFixture}'; delete from private.admin_users where user_id='${ownerFixture}'; commit;`)
  try { if(socket?.readyState===WebSocket.OPEN)await send('Browser.close') } catch { /* own instance only */ }
  socket?.close();if(child.exitCode===null)child.kill()
}
