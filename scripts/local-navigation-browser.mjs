// Chromium UI regression with a synthetic Supabase module intercepted at the
// browser boundary. No account, credential, database or OWNER provisioning.
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'

const appearanceRun = process.argv.length === 3 && process.argv[2] === '--appearance'
const remindersRun = process.argv.length === 3 && process.argv[2] === '--reminders'
const discussionRun = process.argv.length === 3 && process.argv[2] === '--discussion'
const readingLayoutRun = process.argv.length === 3 && process.argv[2] === '--reading-layout'
const rewardsRun = process.argv.length === 3 && process.argv[2] === '--rewards'
const bibleRun = process.argv.length === 3 && process.argv[2] === '--bible'
const readingPositionRun = process.argv.length === 3 && process.argv[2] === '--reading-position'
if (process.argv.length !== 2 && !appearanceRun && !remindersRun && !discussionRun && !readingLayoutRun && !rewardsRun && !bibleRun && !readingPositionRun) throw Error('Only local UI regression modes are accepted')
const origin = `http://127.0.0.1:${readingPositionRun ? 5179 : 5173}`, debug = 'http://127.0.0.1:9229'
const executable = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync)
if (!executable) throw Error('Installed Chromium unavailable')
let occupied = false
try { await fetch(debug + '/json/version', { signal: AbortSignal.timeout(1000) }); occupied = true } catch { /* own port only */ }
if (occupied) throw Error('Debug port occupied; existing browser refused')
const profile = resolve('node_modules/.cache/selah-navigation-browser', randomUUID())
mkdirSync(profile, { recursive: true })
const child = spawn(executable, ['--headless=new', '--no-first-run', '--disable-extensions', '--disable-sync', '--disable-background-networking', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=9229', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
const sleep = ms => new Promise(r => setTimeout(r, ms))
let socket, sequence = 0, passed = 0, holdMain = false, heldMain, workerRegistration
const pending = new Map()
function send(method, params = {}) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout')) }, 15000)
    pending.set(id, { method, resolve: value => { clearTimeout(timer); resolve(value) }, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value
async function reloadPage() {
  const before=await evaluate('performance.timeOrigin')
  await send('Page.reload')
  for(let i=0;i<100;i++) {
    try {
      if(await evaluate(`performance.timeOrigin!==${before} && Boolean(document.querySelector('.appearance-control select'))`))return
    } catch { /* navigation may invalidate the old execution context */ }
    await sleep(100)
  }
  throw Error('Reload did not mount a new document')
}
async function check(expression, label) {
  for (let i = 0; i < 60; i++) {
    if (await evaluate(expression)) { passed++; console.log('PASS ' + label); return }
    await sleep(100)
  }
  throw Error(label)
}
const mock = `
const session = { user: { id: 'synthetic-navigation', user_metadata: {} } }; let callback, currentSession=session;
window.__ownerAllowed = true;
window.addEventListener('focus', () => callback?.(currentSession?'SIGNED_IN':'SIGNED_OUT', currentSession?{...currentSession}:null));
window.__renew = () => callback?.('TOKEN_REFRESHED', currentSession?{...currentSession}:null);
const query = { select(){return this}, eq(){return this}, lte(){return this}, order(){return this}, range:async()=>({data:[],error:null}) };
const content={id:'theme-fiction',title:'Uma pausa fictícia',bible_reference:'Referência fictícia',bible_text:'Texto fictício para verificar aparência.',content:'Reflexão fictícia para testar legibilidade e cores.',reflection_question:'Uma pergunta fictícia?',publish_at:new Date().toISOString(),reading_revision:1,status:'published',author_id:session.user.id,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
window.__themeSignIn=()=>{currentSession=session;callback?.('SIGNED_IN',session)};
if (${remindersRun || discussionRun || readingLayoutRun || readingPositionRun}) content.id='10000000-0000-4000-8000-000000000001';
if (${readingPositionRun}) {content.content=Array.from({length:60},(_,i)=>'Parágrafo fictício '+i+' com palavras suficientes para testar a retomada de leitura no navegador.').join('\\n\\n');window.__sharingBeforeCompletion=true;window.__layoutCredit=0;window.__openingWrites=0;}
window.__otherReader=()=>{currentSession={user:{id:'synthetic-other-reader'}};callback?.('SIGNED_IN',currentSession)};
const reminderState=()=>JSON.parse(localStorage.getItem('__fiction_reminder_'+currentSession?.user.id)||'null')||{enabled:false,mode:'simulation',vapid_public_key:null,device:null,last:null};
const reflections=new Map(),reactions=new Map();let reportOpen=false;
if (${readingLayoutRun}) reflections.set('layout-fiction-author',{id:'30000000-0000-4000-8000-000000000001',body:'PALAVRA'.repeat(140),state:'approved',version:2});
if (${readingLayoutRun}) {window.__sharingBeforeCompletion=true;window.__layoutCredit=59999;}
const discussionSnapshot=page=>({reaction:reactions.get(currentSession?.user.id)||null,own:reflections.get(currentSession?.user.id)||null,page,total:Array.from(reflections.values()).filter(c=>c.state==='approved').length,comments:Array.from(reflections.entries()).filter(([,c])=>c.state==='approved').map(([who,c])=>({id:c.id,body:c.body,username:${readingLayoutRun}?'u'+'m'.repeat(23):'leitor_ficticio',day:'2026-10-28',own:who===currentSession?.user.id,reported:reportOpen}))});
const rewardKey=()=>'__fiction_reward_'+currentSession?.user.id;
const rewards=()=>({server_today:'2026-10-28',time_zone:'America/Sao_Paulo',week_start:'2026-10-26',badges:[3,7,14,30,60,100].map(days=>({days,unlocked:currentSession?.user.id===session.user.id&&days<=7})),challenges:JSON.parse(localStorage.getItem(rewardKey())||'[]')});
export const loginMethod = 'local';
export const environmentName = 'DEV';
export const supabase = {
 auth: { getSession:async()=>({data:{session:currentSession},error:null}), onAuthStateChange(fn){callback=fn;return {data:{subscription:{unsubscribe(){callback=null}}}}}, signOut:async()=>{currentSession=null;callback?.('SIGNED_OUT',null);return {error:null}} },
 from:(table)=>({...query,select(){return this},eq(){return this},lte(){return this},order(){return this},insert(){window.__openingWrites++;return this},single:async()=>({data:null,error:{code:'42501'}}),maybeSingle:async()=>({data:null,error:null}),range:async()=>({data:table==='devotionals'?(${readingPositionRun}?[content]:[content,{...content,id:'theme-previous',title:'Pausa anterior fictícia',publish_at:new Date(Date.now()-86400000).toISOString()}]):table==='devotional_views'&&${readingPositionRun}?[{id:'20000000-0000-4000-8000-000000000001',devotional_id:content.id,opened_at:new Date().toISOString()}]:[],error:null})}),
 rpc(name,args){
  if(name==='get_my_journey_rewards')return {abortSignal:async()=>window.__rewardError?{data:null,error:{code:'42501'}}:{data:rewards(),error:null}};
  if(name==='start_my_personal_challenge')return {abortSignal:async()=>{if(!rewards().challenges.length)localStorage.setItem(rewardKey(),JSON.stringify([{week_start:'2026-10-26',target:args.p_target,days:1,status:'active'}]));return {data:rewards(),error:null}}};
  if(name==='cancel_my_personal_challenge')return {abortSignal:async()=>{localStorage.setItem(rewardKey(),JSON.stringify(rewards().challenges.map(c=>({...c,status:'cancelled'}))));return {data:rewards(),error:null}}};
  if(name==='get_my_discussion_access')return {abortSignal:async()=>({data:window.__ownerAllowed,error:null})};
  if(name==='get_devotional_discussion')return {abortSignal:async()=>{
    if(window.__layoutLoading)await new Promise(resolve=>{window.__releaseLayout=resolve});
    if(window.__layoutError)return {data:null,error:{code:'42501'}};
    const data=discussionSnapshot(args.p_page);if(window.__layoutEmpty){data.comments=[];data.total=0;}
    return {data,error:null};
  }};
  if(name==='set_my_devotional_reaction')return {abortSignal:async()=>{reactions.set(currentSession.user.id,args.p_value);return {data:null,error:null}}};
  if(name==='save_my_devotional_comment')return {abortSignal:async()=>{if(window.__discussionRate)return {data:null,error:{code:'P0429'}};const old=reflections.get(currentSession.user.id);reflections.set(currentSession.user.id,{id:old?.id||crypto.randomUUID(),body:args.p_body,state:'pending',version:(old?.version||0)+1});return {data:null,error:null}}};
  if(name==='remove_my_devotional_comment')return {abortSignal:async()=>{const old=reflections.get(currentSession.user.id);reflections.set(currentSession.user.id,{...old,body:'',state:'removed',version:old.version+1});return {data:null,error:null}}};
  if(name==='report_devotional_comment')return {abortSignal:async()=>{reportOpen=true;return {data:null,error:null}}};
  if(name==='get_owner_discussion')return {abortSignal:async()=>window.__ownerAllowed?{data:{queue:args.p_queue,page:args.p_page,total:args.p_queue==='history'?1:Array.from(reflections.values()).filter(c=>args.p_queue==='reports'?reportOpen&&c.state==='approved':c.state==='pending').length,items:args.p_queue==='history'?[{id:1,action:'approve',reason:'reviewed',version:2,day:'2026-10-28',actor:'owner_ficticio',title:'Devocional fictício'}]:Array.from(reflections.values()).filter(c=>args.p_queue==='reports'?reportOpen&&c.state==='approved':c.state==='pending').map(c=>({...c,username:'leitor_ficticio',day:'2026-10-28',title:'Devocional fictício',available:true,reports:reportOpen?[{reason:'contact',day:'2026-10-28'}]:[]}))},error:null}:{data:null,error:{code:'42501'}}};
  if(name==='moderate_devotional_comment')return {abortSignal:async()=>{if(!window.__ownerAllowed)return {data:null,error:{code:'42501'}};for(const [who,c]of reflections)if(c.id===args.p_comment)reflections.set(who,{...c,state:args.p_action==='approve'?'approved':args.p_action==='hide'?'hidden':'rejected',version:c.version+1});reportOpen=false;return {data:null,error:null}}};
  if(name==='get_my_reminders')return {abortSignal:async()=>({data:reminderState(),error:null})};
  if(name==='save_my_reminders')return {abortSignal:async()=>{const state=reminderState();state.enabled=args.p_enabled;state.device={id:args.p_device,binding:'20000000-0000-4000-8000-000000000001',mode:'simulation',state:args.p_subscription?'active':state.device?.state||'inactive',permission:args.p_permission,time:args.p_time,timezone:args.p_timezone,expires_at:null};localStorage.setItem('__fiction_reminder_'+currentSession?.user.id,JSON.stringify(state));return {data:state,error:null}}};
  if(name==='revoke_my_push_device')return {abortSignal:async()=>{const state=reminderState();if(state.device)state.device.state='revoked';localStorage.setItem('__fiction_reminder_'+currentSession?.user.id,JSON.stringify(state));return {data:null,error:null}}};
  if(name==='devotional_open_counts')return Promise.resolve({data:[],error:null});
  if(name==='complete_devotional'){window.__sharingBeforeCompletion=false;window.__completedCalls=(window.__completedCalls||0)+1;}
  if(['get_my_reading_state','complete_devotional','start_reading'].includes(name))return {abortSignal:async()=>({data:{status:window.__sharingBeforeCompletion?((window.__layoutCredit??60000)<60000?'paused':'ready'):'completed',devotional_id:args.p_devotional_id,revision:1,credited_ms:window.__sharingBeforeCompletion?(window.__layoutCredit??60000):60000,revision_changed:false,...(window.__sharingBeforeCompletion?{}:{completed_at:'2026-10-28T15:00:00Z',completed_day:'2026-10-28'})},error:null})};
  if(name==='get_owner_community')return {abortSignal:async()=>window.__ownerAllowed ? {data:{server_today:'2026-10-28',time_zone:'America/Sao_Paulo',page:0,size:25,total_readers:1,completed_today:0,matched_readers:1,readers:[{username:'leitor_tema',current_streak:0,best_streak:0,total_days:0,status:'empty'}]},error:null} : {data:null,error:{code:'42501'}}};
  if(name==='get_my_consistency') return {abortSignal:async()=>{
   const month=args.p_month??'2026-10-01'; await new Promise(r=>setTimeout(r,150));
   const count=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
   const filled=Boolean(window.__journeyFilled);
   return {data:{server_now:'2026-10-28T15:00:00Z',server_today:'2026-10-28',time_zone:'America/Sao_Paulo',month,current_month:'2026-10-01',first_month:'2026-01-01',current_streak:filled?2:0,best_streak:filled?2:0,total_days:filled?2:0,total_devotionals:filled?3:0,today_completed:filled,last_completed_day:filled?'2026-10-28':null,status:filled?'completed_today':'empty',days:Array.from({length:count},(_,i)=>({date:month.slice(0,8)+String(i+1).padStart(2,'0'),completions:filled&&month==='2026-10-01'?(i===27?2:i===26?1:0):0}))},error:null};
  }};
  return Promise.resolve({data:[],error:null});
 }
};`
function renderedContrast() {
  const color = value => {
    const n=value.match(/[\d.]+/g)?.map(Number)??[0,0,0]
    return [n[0],n[1],n[2],n[3]??1]
  }
  const blend=(front,back)=>front.slice(0,3).map((v,i)=>v*front[3]+back[i]*(1-front[3])).concat(1)
  const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[0.2126,0.7152,0.0722][i],0)
  const ratio=(a,b)=>(Math.max(lum(a),lum(b))+0.05)/(Math.min(lum(a),lum(b))+0.05)
  const failures=[]
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT)
  let node
  while((node=walker.nextNode())) {
    const el=node.parentElement
    if(!node.textContent.trim()||!el||el.closest('script,style,[disabled],[aria-hidden="true"],.sr-only'))continue
    const rect=el.getBoundingClientRect(),style=getComputedStyle(el)
    if(!el.getClientRects().length||rect.bottom<0||style.visibility==='hidden')continue
    const chain=[];for(let p=el;p;p=p.parentElement)chain.unshift(p)
    let bg=color(getComputedStyle(document.documentElement).backgroundColor)
    for(const p of chain)bg=blend(color(getComputedStyle(p).backgroundColor),bg)
    const fg=blend(color(style.color),bg),value=ratio(fg,bg)
    const size=parseFloat(style.fontSize),large=size>=24||(size>=18.66&&Number(style.fontWeight)>=700)
    if(value<(large?3:4.5))failures.push({tag:el.tagName,classes:el.className,ratio:Number(value.toFixed(2))})
  }
  return failures
}
async function appearanceChecks() {
  const choose=async value=>evaluate(`(()=>{const select=document.querySelector('.appearance-control select');select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`)
  const media=async (scheme,motion='no-preference')=>send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:scheme},{name:'prefers-reduced-motion',value:motion}]})
  await media('light')
  const init=await send('Page.addScriptToEvaluateOnNewDocument',{source:"localStorage.setItem('selah.appearance.v1','dark')"})
  holdMain=true
  await send('Page.navigate',{url:origin+'/#login'})
  await check(`document.documentElement.dataset.theme==='dark' && getComputedStyle(document.documentElement).backgroundColor==='rgb(21, 18, 27)' && document.querySelector('#root')?.childElementCount===0`, 'dark palette and native scheme apply before React, with main module held')
  if(!heldMain)throw Error('Main module was not held; prepaint check invalid')
  holdMain=false;await send('Fetch.continueRequest',{requestId:heldMain});await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:init.identifier})
  await check(`document.querySelector('.appearance-control select')?.value==='dark'`, 'selector restores initial saved preference')
  await choose('light');await media('dark')
  await check(`document.documentElement.dataset.theme==='light'`, 'explicit light beats dark device')
  await choose('dark');await media('light')
  await check(`document.documentElement.dataset.theme==='dark'`, 'explicit dark beats light device')
  await choose('system')
  await check(`document.documentElement.dataset.theme==='light'`, 'system resolves light')
  await media('dark')
  await check(`document.documentElement.dataset.theme==='dark' && localStorage.getItem('selah.appearance.v1')==='system'`, 'system updates live without saving resolved mode')
  await choose('dark');await reloadPage()
  await check(`document.querySelector('.appearance-control select')?.value==='dark'`, 'preference survives real refresh')
  await send('Page.bringToFront')
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
  await evaluate(`document.querySelector('.appearance-control select').focus()`)
  await check(`getComputedStyle(document.activeElement).outlineStyle==='solid' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3`, 'keyboard focus is visibly outlined')
  await choose('system');await evaluate(`document.querySelector('.appearance-control select').focus()`)
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38})
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowUp',code:'ArrowUp',windowsVirtualKeyCode:38})
  await check(`document.querySelector('.appearance-control select')?.value==='dark'`, 'native selector accepts keyboard choice')
  await evaluate(`Array.from(document.querySelectorAll('header button')).find(b=>b.textContent==='Sair').click()`)
  await check(`document.querySelector('input[name="identifier"]') && document.querySelector('.appearance-control select')?.value==='dark'`, 'logout retains device preference')
  await evaluate(`window.__themeSignIn()`)
  await check(`document.querySelector('header a[href="#perfil"]') && document.querySelector('.appearance-control select')?.value==='dark'`, 'synthetic login retains device preference')
  const routes=[['inicio','.hero'],['historico','.card'],['leitura/theme-fiction','.reading-progress'],['minhas-leituras','.completion-history'],['minha-jornada','.journey-history'],['admin/comunidade','.community-summary'],['perfil','input[name="name"]'],['privacidade','h1'],['login','input[name="identifier"]'],['cadastro','input[name="confirm"]'],['recuperar-senha','.auth-card'],['nova-senha','main [role="alert"]']]
  for(const theme of ['light','dark']) {
    await choose(theme)
    for(const [page,selector] of routes) {
      await evaluate(`location.hash=${JSON.stringify(page)}`)
      await check(`Boolean(document.querySelector(${JSON.stringify(selector)})) && document.documentElement.dataset.theme===${JSON.stringify(theme)}`,theme+' covers '+page)
      const failures=await evaluate('('+renderedContrast.toString()+')()')
      if(failures.length)throw Error('Rendered contrast '+theme+'/'+page+': '+JSON.stringify(failures.slice(0,3)))
      passed++;console.log('PASS rendered text contrast '+theme+'/'+page)
      if(page==='admin/comunidade') {
        await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Novo devocional')).click()`)
        await check(`Boolean(document.querySelector('.editor textarea')) && Boolean(document.querySelector('.community table'))`,theme+' editor and populated community table share theme')
        const editor=await evaluate('('+renderedContrast.toString()+')()')
        if(editor.length)throw Error('Editor contrast '+theme+': '+JSON.stringify(editor.slice(0,3)))
        passed++;console.log('PASS editor and table contrast '+theme)
      }
      if(page==='cadastro') {
        await evaluate(`document.querySelector('form').requestSubmit()`)
        await check(`Boolean(document.querySelector('.field-error'))`,theme+' shows native form validation errors')
        const errors=await evaluate('('+renderedContrast.toString()+')()')
        if(errors.length)throw Error('Form error contrast '+theme+': '+JSON.stringify(errors.slice(0,3)))
        passed++;console.log('PASS form error text contrast '+theme)
      }
      if(page==='login') {
        const point=await evaluate(`(()=>{const b=document.querySelector('.auth-submit');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`)
        await send('Input.dispatchMouseEvent',{type:'mouseMoved',...point})
        await check(`document.querySelector('.auth-submit').matches(':hover') && getComputedStyle(document.querySelector('.auth-submit')).transitionProperty==='transform'`,theme+' button hover has no palette transition')
        const hovered=await evaluate('('+renderedContrast.toString()+')()')
        if(hovered.length)throw Error('Hovered contrast '+theme)
        passed++;console.log('PASS hovered button contrast '+theme)
        await evaluate(`document.querySelector('.auth-submit').disabled=true`)
        await check(`Number(getComputedStyle(document.querySelector('.auth-submit')).opacity)<=0.7 && getComputedStyle(document.querySelector('.auth-submit')).transform==='none'`,theme+' disabled styling remains distinct without hover movement (synthetic attribute)')
        await evaluate(`document.querySelector('.auth-submit').disabled=false`)
      }
      if(['inicio','minha-jornada','admin/comunidade','login','leitura/theme-fiction'].includes(page)) {
        await evaluate('document.activeElement?.blur();window.scrollTo(0,0)')
        writeFileSync(resolve(profile,'appearance-'+theme+'-'+page.replaceAll('/','-')+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
      }
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    for(const [page,selector] of routes.filter(([page])=>['login','historico','leitura/theme-fiction','admin/comunidade','minha-jornada'].includes(page))) {
      await evaluate(`location.hash=${JSON.stringify(page)}`)
      await check(`Boolean(document.querySelector(${JSON.stringify(selector)})) && document.documentElement.scrollWidth<=innerWidth`,theme+' fits mobile '+page+' and selector')
    }
    writeFileSync(resolve(profile,'appearance-'+theme+'-mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
  }
  await media('dark','reduce')
  await check(`getComputedStyle(document.querySelector('.button')).transitionDuration==='0s'`, 'reduced motion removes button transitions')
  await evaluate(`localStorage.setItem('selah.appearance.v1','corrupted')`);await reloadPage()
  await check(`document.querySelector('.appearance-control select')?.value==='system' && document.documentElement.dataset.theme==='dark'`, 'corrupt storage safely falls back to system')
  await evaluate(`localStorage.removeItem('selah.appearance.v1')`);await reloadPage()
  await check(`document.querySelector('.appearance-control select')?.value==='system'`, 'absent storage uses system')
  const denied=await send('Page.addScriptToEvaluateOnNewDocument',{source:"Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked for synthetic test')}})"})
  await reloadPage()
  await check(`document.querySelector('.appearance-control select')?.value==='system'`, 'blocked storage does not prevent app mount')
  await choose('light')
  await check(`document.documentElement.dataset.theme==='light' && document.querySelector('.appearance-control [role="status"]')?.textContent.includes('nesta aba')`, 'blocked storage still permits in-memory explicit choice')
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:denied.identifier})
  console.log(`${passed} Chromium appearance checks passed. Synthetic backend; screenshots in ignored profile: ${profile}`)
}
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
    if (m.method === 'ServiceWorker.workerRegistrationUpdated') workerRegistration=m.params.registrations.find(r=>r.scopeURL===origin+'/')?.registrationId??workerRegistration
    if (m.id) { const p = pending.get(m.id); pending.delete(m.id); if (m.error) p?.reject(Error('CDP failed: ' + p.method)); else p?.resolve(m.result) }
    if (m.method === 'Fetch.requestPaused') {
      const { requestId, request } = m.params, u = new URL(request.url)
      try {
        if (holdMain && u.origin === origin && u.pathname === '/src/main.tsx') heldMain=requestId
        else if (u.origin === origin && u.pathname === '/src/lib/supabase.ts') await send('Fetch.fulfillRequest', { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'application/javascript' }], body: Buffer.from(mock).toString('base64') })
        else await send(u.origin === origin ? 'Fetch.continueRequest' : 'Fetch.failRequest', u.origin === origin ? { requestId } : { requestId, errorReason: 'BlockedByClient' })
      } catch { /* closing */ }
    }
  })
  await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
  if (readingPositionRun) {
    const id='10000000-0000-4000-8000-000000000001'
    for(const [width,height,mobile] of [[390,844,true],[1280,900,false]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile})
      await send('Page.navigate',{url:origin+'/#leitura/'+id})
      await check(`Boolean(document.querySelector('article.reading'))`, 'fictional reading renders at '+width+'px')
      await check(`document.documentElement.scrollWidth<=innerWidth`, 'reading fits viewport at '+width+'px')
      await evaluate('window.scrollTo(0,900)')
      await check(`window.scrollY>500 && Object.keys(localStorage).some(k=>k.startsWith('selah.reading-position.v1:'))`, 'scroll position is saved at '+width+'px')
      const previous=await evaluate('window.scrollY')
      await evaluate(`location.hash='minha-jornada'`)
      await check(`Boolean(document.querySelector('.journey-last a[href$="/retomar"]'))`, 'journey offers resume at '+width+'px')
      await evaluate(`document.querySelector('.journey-last a[href$="/retomar"]').click()`)
      await check(`Boolean(document.querySelector('article.reading')) && Math.abs(window.scrollY-${previous})<35`, 'saved position restored at '+width+'px')
      await check(`window.__openingWrites===0`, 'resume does not record another opening at '+width+'px')
      writeFileSync(resolve(profile,'reading-position-'+width+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'))
      await evaluate(`location.hash='historico'`)
      await check(`Boolean(document.querySelector('.search'))`, 'normal navigation leaves reader at '+width+'px')
      await evaluate(`location.hash='leitura/${id}'`)
      await check(`Boolean(document.querySelector('article.reading')) && window.scrollY===0`, 'normal reading does not restore at '+width+'px')
    }
    console.log(passed+' Chromium reading-position checks passed; fully simulated backend, no database access. Screenshots: '+profile)
  } else if (bibleRun) {
    await send('Page.navigate', { url: origin + '/#biblia/demonstracao/joao/3/16-17' })
    await check(`Boolean(document.querySelector('#bible-verse-16.highlighted') && document.querySelector('#bible-verse-17.highlighted'))`, 'fictional reference range highlighted')
    await check(`document.querySelectorAll('.bible-controls optgroup')[0].children.length===39 && document.querySelectorAll('.bible-controls optgroup')[1].children.length===27`, '66 books separated by testament')
    await check(`document.querySelector('.bible-reader').textContent.includes('Conteúdo fictício') && document.querySelector('.bible-reader option[value=nvi]').disabled`, 'demonstration identified and NVI unavailable')
    for (const theme of ['light','dark','system']) {
      await evaluate(`window.selahAppearance.setPreference('${theme}')`)
      for (const width of [1440,390]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width===390 })
        await check(`document.documentElement.scrollWidth<=innerWidth && Array.from(document.querySelectorAll('.bible-controls select,.bible-navigation button')).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`, 'bible controls fit '+theme+' viewport '+width)
        await check(`(${renderedContrast.toString()})().length===0`, 'rendered text contrast '+theme+' viewport '+width)
      }
    }
    await evaluate(`document.querySelector('.bible-navigation button:last-child').focus()`)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await evaluate(`document.querySelector('.bible-navigation button:last-child').focus()`)
    await check(`getComputedStyle(document.activeElement).outlineStyle!=='none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0`, 'chapter navigation keyboard focus visible')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await check(`location.hash==='#biblia/demonstracao/joao/4' && document.querySelector('.bible-reader').textContent.includes('Nenhum conteúdo disponível')`, 'keyboard navigates to empty chapter')
    await evaluate(`location.hash='biblia'`)
    await check(`document.querySelector('.bible-chapter h2')?.textContent.includes('João 4')`, 'selection retained in session')
    console.log(passed+' Chromium bible checks passed; fictional content, synthetic backend.')
  } else if (rewardsRun) {
    await send('Page.navigate', { url: origin + '/#minha-jornada' })
    await check(`document.querySelectorAll('.journey-badges li').length===6 && document.querySelectorAll('.badge-earned').length===2`, 'six server badges distinguish earned and next milestones')
    await check(`Boolean(document.querySelector('.journey-rewards select')) && !document.querySelector('.journey-challenges li')`, 'no automatic enrollment')
    await evaluate(`(()=>{const s=document.querySelector('.journey-rewards select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'5');s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Iniciar desafio').focus()`)
    await check(`getComputedStyle(document.activeElement).outlineStyle!=='none' && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0`, 'challenge start has visible keyboard focus')
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await check(`document.querySelector('.journey-challenges')?.textContent.includes('1 de 5 dias distintos') && document.querySelector('.journey-rewards progress')?.max===5`, 'keyboard voluntary enrollment and accessible progress')
    await reloadPage()
    await check(`location.hash==='#minha-jornada' && document.querySelector('.journey-challenges')?.textContent.includes('1 de 5 dias distintos')`, 'reload reloads private enrollment from simulated server')
    await check(`document.querySelector('[aria-label="Mês anterior"]')?.disabled===false`, 'calendar ready after independent reward response')
    await evaluate(`document.querySelector('[aria-label="Mês anterior"]').click()`)
    await check(`document.querySelector('.consistency-calendar h3')?.textContent==='setembro de 2026'`, 'reward section preserves calendar month navigation')
    await evaluate(`window.dispatchEvent(new Event('focus'));window.__renew()`)
    await check(`document.querySelector('.consistency-calendar h3')?.textContent==='setembro de 2026' && document.querySelector('.journey-challenges')?.textContent.includes('1 de 5 dias distintos')`, 'focus session renewal preserves month and private challenge')
    const rewardTab = await send('Target.createTarget', { url: 'about:blank' })
    await send('Target.activateTarget', { targetId: rewardTab.targetId })
    await check(`document.visibilityState==='hidden'`, 'active challenge loses visibility in real Chromium tab switch')
    await send('Target.activateTarget', { targetId: target.id }); await send('Page.bringToFront')
    await evaluate(`window.__renew()`)
    await check(`location.hash==='#minha-jornada' && document.querySelector('.consistency-calendar h3')?.textContent==='setembro de 2026' && document.querySelector('.journey-challenges')?.textContent.includes('1 de 5 dias distintos')`, 'active challenge and selected month survive tab return and session renewal')
    for (const theme of ['light','dark','system']) {
      await evaluate(`window.selahAppearance.setPreference('${theme}')`)
      for (const width of [1440,390]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width===390 })
        await check(`document.documentElement.scrollWidth<=innerWidth && Array.from(document.querySelectorAll('.journey-badges li,.journey-challenges li,.journey-rewards select')).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`, 'rewards fit '+theme+' viewport '+width)
        await check(`(${renderedContrast.toString()})().length===0`, 'rendered text contrast subset '+theme+' viewport '+width)
      }
    }
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Encerrar desafio').click()`)
    await check(`document.querySelector('.journey-challenges')?.textContent.includes('Encerrado por você') && !document.querySelector('.journey-rewards select')`, 'cancellation retains private history without penalty or restart')
    await evaluate(`window.__otherReader()`)
    await check(`!document.querySelector('.journey-challenges li') && document.querySelectorAll('.badge-earned').length===0 && Boolean(document.querySelector('.journey-rewards select'))`, 'account switch clears previous badges and enrollment')
    await evaluate(`window.__rewardError=true;window.dispatchEvent(new Event('focus'))`)
    await check(`document.querySelector('.journey-rewards [role="alert"]')?.textContent.includes('Não foi possível carregar')`, 'RPC denial gives safe retry error')
    await evaluate(`window.__rewardError=false;Array.from(document.querySelectorAll('.journey-rewards button')).find(b=>b.textContent==='Tentar novamente').click()`)
    await check(`!document.querySelector('.journey-rewards [role="alert"]')`, 'retry restores own data')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Sair').click()`)
    await check(`!document.querySelector('.journey-rewards')`, 'logout removes private rewards')
    console.log(passed+' Chromium reward checks passed; server boundary simulated, no database writes.')
  } else if (readingLayoutRun) {
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false})
    await send('Page.navigate',{url:origin+'/#leitura/10000000-0000-4000-8000-000000000001'})
    await check(`Boolean(document.querySelector('.discussion textarea'))`, 'reading layout loaded with synthetic authenticated content')
    await check(`document.querySelector('.reading-progress progress')?.value===59999 && Array.from(document.querySelectorAll('.reading-progress button')).find(b=>b.textContent==='Concluir devocional')?.disabled && !window.__completedCalls`, 'server-confirmed 59999 ms keeps visual progress and blocks completion')
    const boxes=await evaluate(`(()=>{const selectors=['article.reading','article blockquote','article .reflection','.reading-progress','[aria-label="Compartilhar devocional"]','.discussion'];return selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,left:r.left,width:r.width}})})()`)
    console.log('Reading column geometry: '+JSON.stringify(boxes))
    await check(`(()=>{const elements=['article.reading','article .reflection','.reading-progress','[aria-label="Compartilhar devocional"]','.discussion'].map(s=>document.querySelector(s).getBoundingClientRect());return elements.every(r=>Math.abs(r.width-elements[0].width)<1 && Math.abs(r.left-elements[0].left)<1)})()`, 'desktop reading cards have equal widths and left edges')
    const artifacts=resolve('node_modules/.cache/selah-reading-layout');mkdirSync(artifacts,{recursive:true})
    const aligned=`(()=>{const column=document.querySelector('.reading-column');const main=document.querySelector('main').getBoundingClientRect();if(!column)return false;const root=column.getBoundingClientRect();const boxes=['article.reading','article blockquote','article .reflection','.reading-progress','[aria-label="Compartilhar devocional"]','.discussion'].map(s=>document.querySelector(s).getBoundingClientRect());return root.width<=690 && Math.abs((root.left+root.right-main.left-main.right)/2)<1 && boxes.every(r=>Math.abs(r.left-root.left)<1 && Math.abs(r.width-root.width)<1)})()`
    const noOverflow=`(()=>{const column=document.querySelector('.reading-column').getBoundingClientRect();return document.documentElement.scrollWidth<=window.innerWidth && Array.from(document.querySelectorAll('.reading-column input,.reading-column textarea,.reading-column button,.reading-column .button,.reading-column .reflection-body,.reading-column .reflection-list strong')).every(el=>{const r=el.getBoundingClientRect();return r.left>=column.left-1 && r.right<=column.right+1})})()`
    const refresh=async()=>evaluate(`Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Atualizar reflexões').click()`)
    for(const [viewport,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:viewport==='mobile'})
      for(const theme of ['light','dark','system']) {
        await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:theme==='light'?'light':'dark'}]})
        await evaluate(`(()=>{const select=document.querySelector('.appearance-control select');select.value='${theme}';select.dispatchEvent(new Event('change',{bubbles:true}));})()`)
        await check(aligned,viewport+'/'+theme+' uses the same centered reading width for all cards')
        await check(`(()=>{const cards=['article blockquote','article .reflection','.reading-progress','[aria-label="Compartilhar devocional"]','.discussion'].map(s=>getComputedStyle(document.querySelector(s)));return cards.every(s=>s.paddingLeft===cards[0].paddingLeft && s.paddingRight===cards[0].paddingRight)})()`,viewport+'/'+theme+' card padding is consistent')
        await check(noOverflow,viewport+'/'+theme+' long text, username and controls remain inside the column')
        const contrast=await evaluate('('+renderedContrast.toString()+')()')
        if(contrast.length)throw Error('Reading layout contrast failed: '+JSON.stringify(contrast))
        passed++;console.log('PASS '+viewport+'/'+theme+' rendered text contrast')
        await evaluate(`document.activeElement?.blur();window.scrollTo(0,0)`)
        writeFileSync(resolve(artifacts,viewport+'-'+theme+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
      }
      await evaluate(`window.__layoutLoading=true`);await refresh()
      await check(`document.querySelector('.discussion')?.getAttribute('aria-busy')==='true'`,viewport+' loading state rendered')
      await check(aligned,viewport+' loading state preserves column alignment')
      await evaluate(`window.__layoutLoading=false;window.__releaseLayout()`)
      await check(`document.querySelector('.discussion')?.getAttribute('aria-busy')==='false'`,viewport+' loading finishes')
      await evaluate(`window.__layoutError=true`);await refresh()
      await check(`Boolean(document.querySelector('.discussion [role="alert"]'))`,viewport+' authorization error rendered')
      await check(aligned,viewport+' error state preserves column alignment')
      await evaluate(`window.__layoutError=false;window.__layoutEmpty=true`);await refresh()
      await check(`document.querySelector('.discussion')?.textContent.includes('Ainda não há reflexões aprovadas')`,viewport+' empty state rendered')
      await check(aligned,viewport+' empty state preserves column alignment')
      await evaluate(`window.__layoutEmpty=false`);await refresh()
      await check(`Boolean(document.querySelector('.reflection-body'))`,viewport+' populated state restored')
    }
    await check(`(()=>{const section=document.querySelector('.discussion'),text=section.textContent;return !text.includes('Sua reação é privada. Clique novamente') && !text.includes('Comentários aprovados serão visíveis a outros leitores') && !text.includes('Não publique telefone, e-mail, endereço, links de contato') && !text.includes('Uma reflexão principal por devocional; você pode editar ou remover a sua.') && !text.includes('Envios ficam pendentes de moderação.') && !text.includes('Reflexão enviada para moderação.') && section.querySelector('[id^="reflection-help-"]')?.textContent==='0/1000 caracteres'})()`, 'removed comment instructions absent and accessible character counter remains')
    await send('Page.bringToFront');await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
    await evaluate(`document.querySelector('.discussion textarea').focus()`)
    await check(`getComputedStyle(document.activeElement).outlineStyle==='solid'`, 'keyboard focus remains visible in the reading column')
    await check(`!document.querySelector('.reading-column').textContent.includes('O tempo mínimo registra permanência confirmada nesta página; não comprova compreensão.')`, 'reading explanation removed without replacement')
    await check(`!document.querySelector('.reading-column').textContent.includes('O histórico registra aberturas, sem comprovar conclusão da leitura.')`, 'opening-history explanation removed')
    await check(`(()=>{const text=document.querySelector('[aria-label="Compartilhar devocional"]').textContent;return !text.includes('Convide um amigo, se desejar.') && !text.includes('O link exige autenticação no Selah.') && !text.includes('Este endereço local funciona apenas neste ambiente;')})()`, 'sharing explanatory block removed while all three actions remain')
    await check(`document.querySelector('.discussion')?.textContent.includes('Comente aqui o que você aprendeu e refletiu com essa devocional.') && !document.querySelector('.discussion')?.textContent.includes('Uma conversa com respeito, no seu tempo.')`, 'comment subtitle matches requested literal text')
    await check(`!document.querySelector('.reading-column').textContent.includes('Sua reflexão será publicada após aprovação e poderá ser vista por outros leitores do Selah.')`, 'explicitly rejected extra warning absent')
    await evaluate(`window.__layoutCredit=60000;location.hash='historico'`)
    await check(`!document.querySelector('.reading-progress')`, 'reading unmounts for navigation without creating completion')
    await evaluate(`location.hash='leitura/10000000-0000-4000-8000-000000000001'`)
    await check(`document.querySelector('.reading-progress progress')?.value===60000 && !Array.from(document.querySelectorAll('.reading-progress button')).find(b=>b.textContent==='Concluir devocional')?.disabled && !window.__completedCalls`, 'server-confirmed 60000 ms enables choice without automatic completion')
    await check(`!document.querySelector('.reading-column').textContent.includes('Tempo confirmado: 60 de 60 segundos mínimos')`, 'numeric 60 of 60 caption absent')
    await evaluate(`Array.from(document.querySelectorAll('.reading-progress button')).find(b=>b.textContent==='Concluir devocional').click()`)
    await check(`window.__completedCalls===1 && document.querySelector('.reading-progress')?.textContent.includes('Devocional concluído')`, 'explicit completion still confirms successfully')
    console.log('Synthetic reading screenshots: '+artifacts)
    console.log(passed+' Chromium reading layout checks passed; synthetic backend.')
  } else if (discussionRun) {
    const read='leitura/10000000-0000-4000-8000-000000000001'
    const click=async label=>evaluate(`Array.from(document.querySelectorAll('button,a')).find(b=>b.textContent===${JSON.stringify(label)}).click()`)
    const draft=async text=>evaluate(`(()=>{const input=document.querySelector('.discussion textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,${JSON.stringify(text)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`)
    await send('Page.navigate',{url:origin+'/#'+read})
    await check(`Boolean(document.querySelector('.discussion textarea')) && document.querySelector('textarea')?.maxLength===1000`, 'published reading renders reflection with 1000 character limit')
    await click('Gostei');await check(`Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Gostei')?.getAttribute('aria-pressed')==='true'`, 'like selected')
    await click('Não gostei');await check(`Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Não gostei')?.getAttribute('aria-pressed')==='true'`, 'reaction switched to dislike')
    await click('Não gostei');await check(`document.querySelector('.discussion [aria-pressed=true]')===null`, 'selected reaction removed')
    const text='<img src=x onerror=alert(1)> Reflexão fictícia'
    await draft('Fé');await check(`document.querySelector('.discussion [id^="reflection-help-"]')?.textContent==='2/1000 caracteres'`, 'character counter updates while typing')
    await draft('x'.repeat(1000));await check(`document.querySelector('.discussion [id^="reflection-help-"]')?.textContent==='1000/1000 caracteres' && !Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Enviar para moderação')?.disabled`, '1000 characters remain eligible for submission')
    await draft('x'.repeat(1001));await check(`document.querySelector('.discussion [id^="reflection-help-"]')?.textContent==='1001/1000 caracteres' && Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Enviar para moderação')?.disabled`, 'scripted oversized input cannot use submit action')
    await draft(text);await click('Enviar para moderação')
    await check(`document.querySelector('.discussion')?.textContent.includes('Pendente de moderação') && !document.querySelector('.reflection-list li')`, 'new reflection stays pending and outside approved list')
    await check(`!document.querySelector('.discussion > [role="status"]') && !document.querySelector('.discussion').textContent.includes('Reflexão enviada para moderação.')`, 'successful submission shows own pending state without confirmation message')
    await evaluate(`window.__otherReader();location.hash=${JSON.stringify(read)}`)
    await check(`document.querySelector('.discussion textarea')?.value==='' && !document.querySelector('.discussion')?.textContent.includes('Pendente de moderação')`, 'account change hides prior private reflection')
    await evaluate(`window.__themeSignIn();location.hash='admin/moderacao'`)
    await check(`Boolean(document.querySelector('.moderation .reflection-body')) && !document.querySelector('.moderation img')`, 'Owner reviews malicious markup as escaped text')
    await click('Aprovar reflexão');await check(`document.querySelector('.moderation')?.textContent.includes('Nenhum item nesta fila')`, 'Owner approval removes pending item')
    await evaluate(`location.hash=${JSON.stringify(read)}`)
    await check(`document.querySelector('.discussion .reflection-body')?.textContent===${JSON.stringify(text)} && !document.querySelector('.discussion img,.discussion .reflection-body a')`, 'approved text is escaped with no automatic links or image execution')
    await draft('Texto fictício editado');await click('Enviar para moderação')
    await check(`!document.querySelector('.discussion .reflection-list li') && document.querySelector('.discussion')?.textContent.includes('Pendente de moderação')`, 'editing approved comment hides unreviewed replacement')
    await evaluate(`location.hash='admin/moderacao'`);await check(`Boolean(document.querySelector('.moderation .reflection-body'))`, 'edited reflection returns to Owner queue')
    await click('Rejeitar reflexão');await check(`document.querySelector('.moderation')?.textContent.includes('Nenhum item nesta fila')`, 'Owner can reject reflection')
    await evaluate(`location.hash=${JSON.stringify(read)}`);await check(`document.querySelector('.discussion')?.textContent.includes('Rejeitado')`, 'author sees own rejected state')
    await draft('Reflexão para denúncia');await click('Enviar para moderação');await check(`document.querySelector('.discussion')?.textContent.includes('Pendente de moderação')`, 'author can revise rejected text')
    await evaluate(`location.hash='admin/moderacao'`);await check(`Boolean(document.querySelector('.moderation .reflection-body'))`, 'resubmission pending')
    await click('Aprovar reflexão');await check(`document.querySelector('.moderation')?.textContent.includes('Nenhum item nesta fila')`, 'resubmission approved')
    await evaluate(`window.__otherReader();location.hash=${JSON.stringify(read)}`)
    await check(`Boolean(Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Denunciar reflexão'))`, 'reader may report approved reflection')
    await click('Denunciar reflexão');await click('Enviar denúncia');await check(`Array.from(document.querySelectorAll('.discussion button')).find(b=>b.textContent==='Denúncia registrada')?.disabled`, 'duplicate reporting disabled after recorded report')
    await evaluate(`window.__themeSignIn();location.hash='admin/moderacao'`);await check(`Boolean(document.querySelector('.moderation'))`, 'Owner moderation route restored')
    await click('Denúncias');await check(`document.querySelector('.moderation')?.textContent.includes('Denúncia: Dados de contato')`, 'Owner sees report category without reporter identity')
    await click('Ocultar reflexão');await check(`document.querySelector('.moderation')?.textContent.includes('Nenhum item nesta fila')`, 'Owner hides reported comment')
    await click('Histórico de ações');await check(`document.querySelector('.moderation')?.textContent.includes('Ação: Aprovada')`, 'moderation audit history displayed')
    const moderationTab=await send('Target.createTarget',{url:'about:blank'})
    await send('Target.activateTarget',{targetId:moderationTab.targetId})
    await check(`document.visibilityState==='hidden'`, 'moderation loses visibility during real Chromium tab switch')
    await send('Target.activateTarget',{targetId:target.id});await send('Page.bringToFront')
    await evaluate(`window.__renew()`)
    await check(`location.hash==='#admin/moderacao' && Boolean(document.querySelector('.moderation'))`, 'moderation route survives focus return and session renewal')
    await reloadPage();await check(`location.hash==='#admin/moderacao' && Boolean(document.querySelector('.moderation'))`, 'refresh preserves moderation route')
    await evaluate(`window.__ownerAllowed=false`);await click('Atualizar moderação');await check(`!document.querySelector('.moderation .reflection-body') && Boolean(document.querySelector('.moderation [role=alert]'))`, 'Owner revocation blocks queue without exposing cached text')
    await evaluate(`window.__themeSignIn();location.hash=${JSON.stringify(read)}`);await check(`Boolean(document.querySelector('.discussion textarea'))`, 'reader returns without changing reading rules')
    for(const theme of ['light','dark','system']) {
      await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await check(`Boolean(document.querySelector('.discussion textarea')) && document.querySelector('.appearance-control select')?.value==='${theme}'`, 'discussion usable in '+theme)
      const contrast=await evaluate('('+renderedContrast.toString()+')()')
      if(contrast.length)throw Error('Discussion text contrast failed: '+JSON.stringify(contrast))
      passed++;console.log('PASS discussion rendered text contrast '+theme)
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await check(`document.documentElement.scrollWidth<=window.innerWidth`, 'discussion fits mobile viewport')
    await send('Page.bringToFront')
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9})
    await evaluate(`document.querySelector('.discussion textarea').focus()`)
    await check(`getComputedStyle(document.activeElement).outlineStyle==='solid'`, 'reflection keyboard focus visible')
    await draft('Reflexão fictícia para revisão em tela pequena');await click('Enviar para moderação')
    await check(`document.querySelector('.discussion')?.textContent.includes('Pendente de moderação')`, 'mobile submission remains pending')
    await evaluate(`window.__ownerAllowed=true;location.hash='admin/moderacao'`)
    await check(`Boolean(document.querySelector('.moderation .reflection-body')) && document.documentElement.scrollWidth<=window.innerWidth`, 'populated Owner moderation fits mobile viewport')
    for(const theme of ['light','dark','system']) {
      await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await check(`Boolean(document.querySelector('.moderation .reflection-body')) && document.querySelector('.appearance-control select')?.value==='${theme}'`, 'Owner moderation usable in '+theme)
    }
    await evaluate(`location.hash='leitura/90000000-0000-4000-8000-000000000009'`)
    await check(`!document.querySelector('.discussion') && document.body.textContent.includes('Devocional não encontrado')`, 'unavailable publication cannot render discussion controls')
    console.log(passed+' Chromium discussion checks passed; synthetic integration, no backend mutation or external push.')
  } else if (remindersRun) {
    await send('ServiceWorker.enable')
    await send('Page.navigate',{url:origin+'/#configuracoes'})
    await check(`Boolean(document.querySelector('#reminder-heading')) && document.querySelector('input[type="checkbox"]')?.checked===false`, 'reminders open without automatic opt in')
    await check(`!localStorage.getItem('selah.reminder.device.synthetic-navigation')`, 'opening settings creates no device credential')
    await evaluate(`(()=>{const input=document.querySelector('input[type="time"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'09:17');input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('input[type="checkbox"]').click();})()`)
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Salvar preferências').click()`)
    await check(`document.body.textContent.includes('Preferências salvas')`, 'explicit save persists enabled time and timezone')
    await reloadPage()
    await check(`document.querySelector('input[type="time"]')?.value==='09:17' && document.querySelector('input[type="checkbox"]')?.checked`, 'refresh preserves own settings')
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent.includes('Cadastrar dispositivo fictício')).click()`)
    await check(`document.body.textContent.includes('active (dispositivo fictício')`, 'test enrollment is explicitly labeled simulation')
    await evaluate(`window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));window.__renew()`)
    await check(`location.hash==='#configuracoes' && document.querySelector('input[type="time"]')?.value==='09:17'`, 'focus and renewed session preserve settings')
    for(const theme of ['light','dark','system']) {
      await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await check(`document.querySelector('#reminder-heading')?.textContent==='Lembretes' && document.querySelector('.appearance-control select')?.value==='${theme}'`, 'reminders usable in '+theme+' mode')
    }
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await check(`document.documentElement.scrollWidth<=window.innerWidth`, 'reminders fit narrow viewport')
    await evaluate(`window.__sharingBeforeCompletion=true;location.hash='leitura/10000000-0000-4000-8000-000000000001'`)
    await check(`Boolean(document.querySelector('[aria-label="Compartilhar devocional"] button')) && Boolean(document.querySelector('article.reading')) && !window.__completedCalls`, 'normal published reading offers sharing before valid completion')
    await check(`Boolean(document.querySelector('article.reading').compareDocumentPosition(document.querySelector('[aria-label="Compartilhar devocional"]')) & Node.DOCUMENT_POSITION_FOLLOWING)`, 'share actions follow the full reading article')
    await check(`document.documentElement.scrollWidth<=window.innerWidth`, 'share section fits mobile viewport')
    await send('Browser.grantPermissions',{origin,permissions:['clipboardReadWrite','clipboardSanitizedWrite']})
    await send('Page.bringToFront')
    await send('Runtime.evaluate',{expression:`Array.from(document.querySelectorAll('[aria-label="Compartilhar devocional"] button')).find(b=>b.textContent==='Copiar link').click()`,userGesture:true})
    await check(`document.querySelector('[aria-label="Compartilhar devocional"] [role="status"]')?.textContent==='Link copiado.' && !window.__completedCalls`, 'copying a real browser link does not conclude reading')
    await check(`(async()=>await navigator.clipboard.readText()===location.origin+'/#leitura/10000000-0000-4000-8000-000000000001')()`, 'clipboard contains only the actual internal publication route')
    await check(`(()=>{const a=document.querySelector('[aria-label="Compartilhar devocional"] a');const u=new URL(a.href);return u.origin==='https://wa.me' && u.searchParams.get('text').includes(location.origin+'/#leitura/10000000-0000-4000-8000-000000000001') && a.rel.includes('noopener')})()`, 'WhatsApp is an explicit safe link without automatic contact messages')
    for(const theme of ['light','dark','system']) {
      await evaluate(`(()=>{const s=document.querySelector('.appearance-control select');s.value='${theme}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`)
      await check(`Array.from(document.querySelectorAll('[aria-label="Compartilhar devocional"] button')).some(b=>b.textContent==='Compartilhar' && !b.disabled)`, 'share action available in '+theme+' mode')
    }
    await evaluate(`Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Concluir devocional').click()`)
    await check(`window.__completedCalls===1 && document.querySelector('.reading-progress')?.textContent.includes('Devocional concluído') && document.querySelectorAll('[aria-label="Compartilhar devocional"]').length===1`, 'voluntary valid completion preserves one share section')
    await evaluate(`location.hash=document.querySelector('[aria-label="Compartilhar devocional"] input').value.split('#')[1]`)
    await check(`Boolean(document.querySelector('article.reading')) && Boolean(document.querySelector('[aria-label="Compartilhar devocional"]'))`, 'copied link navigates to the published reading')
    await evaluate(`location.hash='leitura/10000000-0000-4000-8000-000000000001/compartilhar'`)
    await check(`Boolean(document.querySelector('[aria-label="Compartilhar devocional"]')) && Array.from(document.querySelectorAll('[aria-label="Compartilhar devocional"] button')).some(b=>b.textContent==='Compartilhar')`, 'share deep link opens published content with sharing action')
    await check(`document.querySelector('[aria-label="Compartilhar devocional"] input')?.value===location.origin+'/#leitura/10000000-0000-4000-8000-000000000001'`, 'shared link contains only published content id')
    await evaluate(`location.hash='leitura/90000000-0000-4000-8000-000000000009/compartilhar'`)
    await check(`!document.querySelector('[aria-label="Compartilhar devocional"]') && document.body.textContent.includes('Devocional não encontrado')`, 'unavailable content never creates share controls')
    await evaluate(`window.__otherReader();location.hash='configuracoes'`)
    await check(`document.querySelector('input[type="checkbox"]')?.checked===false && !document.body.textContent.includes('active (dispositivo fictício')`, 'account change does not expose former account device settings')
    // Exercise the SW on a same-origin static document. The application's account
    // bridge correctly clears bindings for the unconfigured second reader; it
    // must not race this separately injected test-only binding.
    await send('Page.navigate',{url:origin+'/appearance.js'})
    await check(`!document.querySelector('.app') && document.body?.textContent.includes('setPreference')`, 'service worker harness uses static same-origin document without account bridge')
    await send('Browser.grantPermissions',{origin,permissions:['notifications']})
    await evaluate(`(async()=>{await navigator.serviceWorker.register('/selah-sw.js',{scope:'/'});await navigator.serviceWorker.ready;window.__swMessage=async(type,binding)=>{const r=await navigator.serviceWorker.getRegistration('/');return new Promise(resolve=>{const c=new MessageChannel();c.port1.onmessage=e=>resolve(e.data);r.active.postMessage({type,binding},[c.port2]);});};return await window.__swMessage('bind','20000000-0000-4000-8000-000000000001');})()`)
    if (!workerRegistration) throw Error('Local service worker registration unavailable')
    const payload={v:1,kind:'reading',binding:'20000000-0000-4000-8000-000000000001',day:new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),devotional:'10000000-0000-4000-8000-000000000001'}
    await send('ServiceWorker.deliverPushMessage',{origin,registrationId:workerRegistration,data:JSON.stringify(payload)})
    await check(`(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return (await r.getNotifications()).some(n=>n.title==='Seu momento com Deus está esperando!')})()`, 'actual local service worker displays CDP-injected reading notification without push provider')
    await evaluate(`window.__swMessage('clear')`)
    await check(`(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return (await r.getNotifications()).length===0})()`, 'clearing account binding closes local notifications')
    await send('ServiceWorker.deliverPushMessage',{origin,registrationId:workerRegistration,data:JSON.stringify(payload)})
    await sleep(400)
    await check(`(async()=>{const r=await navigator.serviceWorker.getRegistration('/');return (await r.getNotifications()).length===0})()`, 'unbound service worker rejects queued old-account notification')
    console.log(passed+' Chromium reminder checks passed; simulated integration, no provider delivery.')
  } else if (appearanceRun) {
    await appearanceChecks()
  } else {
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
  await reloadPage()
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='outubro de 2026'`, 'calendar reload starts at server current month')
  await check(`document.querySelector('[aria-label="Próximo mês"]')?.disabled`, 'future navigation blocked')
  await evaluate(`document.querySelector('nav a[href="#minha-jornada"]').click()`)
  await check(`document.querySelector('h1')?.textContent==='Minha Jornada' && document.querySelector('nav a[href="#minha-jornada"]')?.getAttribute('aria-current')==='page'`, 'journey opens through navigation with active link')
  await check(`document.querySelector('.journey-history')?.textContent.includes('Ainda não há conclusões neste mês')`, 'journey monthly empty state uses server response')
  await evaluate(`document.querySelector('[aria-label="Mês anterior"]').click();document.querySelector('[aria-label="Mês anterior"]').click()`)
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='agosto de 2026' && document.querySelector('.journey-history')?.textContent.includes('agosto de 2026')`, 'journey calendar and monthly history move together')
  await send('Target.activateTarget', { targetId: tab.targetId })
  await check(`document.visibilityState==='hidden'`, 'journey loses visibility in real tab switch')
  await send('Target.activateTarget', { targetId: target.id }); await send('Page.bringToFront')
  await evaluate(`window.__renew()`)
  await check(`document.querySelector('.consistency-calendar h3')?.textContent==='agosto de 2026' && location.hash==='#minha-jornada'`, 'journey keeps selected month after focus and session renewal')
  await reloadPage()
  await check(`document.querySelector('h1')?.textContent==='Minha Jornada' && document.querySelector('.consistency-calendar h3')?.textContent==='outubro de 2026'`, 'journey refresh keeps route and resets month to server current')
  await evaluate(`window.__journeyFilled=true;window.dispatchEvent(new Event('focus'))`)
  await check(`document.querySelectorAll('.journey-history li').length===2 && document.querySelector('.journey-history li')?.textContent.includes('2 devocionais concluídos') && document.querySelector('.journey-history dl')?.textContent.includes('Devocionais concluídos no mês3')`, 'journey distinguishes two completed days from three texts in real rendered history')
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await evaluate(`document.activeElement?.blur();window.scrollTo(0,0)`)
  writeFileSync(resolve(profile,'journey-desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await check(`document.documentElement.scrollWidth<=window.innerWidth`, 'journey fits mobile viewport without horizontal overflow')
  writeFileSync(resolve(profile,'journey-mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'))
  console.log('Synthetic journey screenshots stored in ignored profile: '+profile)
  await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
  await evaluate(`location.hash='admin/comunidade'`)
  await check(`Boolean(document.querySelector('.community-summary')) && !document.querySelector('.community [role="alert"]')`, 'community deep link opens with authorized synthetic response')
  await send('Target.activateTarget', { targetId: tab.targetId }); await sleep(300)
  await send('Target.activateTarget', { targetId: target.id }); await send('Page.bringToFront')
  await evaluate(`window.__renew()`)
  await check(`Boolean(document.querySelector('.community-summary')) && location.hash==='#admin/comunidade'`, 'focus plus session renewal preserve community route')
  await reloadPage()
  await check(`Boolean(document.querySelector('.community-summary'))`, 'refresh restores community section')
  await evaluate(`window.__ownerAllowed=false;window.__renew()`)
  await check(`Boolean(document.querySelector('.community [role="alert"]')) && !document.querySelector('.community table')`, 'OWNER revocation blocks data after renewal')
  console.log(passed + ' Chromium navigation checks passed; synthetic boundary, no backend access.')
  }
} catch (error) { console.error('Navigation Chromium failed: ' + error.message); process.exitCode = 1 }
finally {
  try { if (socket?.readyState === WebSocket.OPEN) await send('Browser.close') } catch { /* own instance */ }
  socket?.close(); if (child.exitCode === null) child.kill()
}
