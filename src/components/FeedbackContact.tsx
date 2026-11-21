import { useEffect,useState } from 'react'
import { supabase } from '../lib/supabase'
import { createFeedbackRepository,feedbackMessage } from '../profiles/feedback'
const repository=createFeedbackRepository(supabase)
export function FeedbackContact({userId,phone}:{userId:string;phone:string|null}) {
 const [expanded,setExpanded]=useState(false)
 return <section><h3>Contato para feedback</h3><p>A autorização é opcional. Você pode permitir ou retirar o contato individual pelo WhatsApp para solicitar feedback sobre o Coram. Não há envio automático de mensagens.</p><button className="button secondary" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>Gerenciar autorização de feedback</button>{expanded&&<Choice key={userId+':'+(phone??'')} userId={userId} phone={phone}/>}</section>
}
function Choice({userId,phone}:{userId:string;phone:string|null}) {
 const [ready,setReady]=useState(false),[allowed,setAllowed]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[attempt,setAttempt]=useState(0)
 useEffect(()=>{let active=true;repository.load(userId).then(data=>{if(active){setAllowed(data?.allowed??false);setReady(true);setError('')}},()=>{if(active)setError(feedbackMessage())});return()=>{active=false}},[userId,attempt])
 if(!ready)return <div>{error?<><p role="alert">{error}</p><button onClick={()=>{setError('');setAttempt(v=>v+1)}}>Tentar novamente</button></>:<p role="status">Consultando autorização…</p>}</div>
 return <form onSubmit={async event=>{event.preventDefault();if(pending)return;setPending(true);setError('');setMessage('');try{const result=await repository.save(userId,phone,allowed);setAllowed(result.allowed);setMessage(result.allowed?'Autorização de feedback salva.':'Autorização de feedback retirada.')}catch{setError(feedbackMessage())}finally{setPending(false)}}}>
 {!phone&&<p>Preencha e salve seu WhatsApp no perfil para autorizar contato. Você pode retirar a autorização mesmo sem número.</p>}
 <label className="contact-choice"><input type="checkbox" checked={allowed} disabled={(!phone&&!allowed)||pending} onChange={event=>{setAllowed(event.target.checked);setMessage('')}}/>Autorizo contato individual pelo WhatsApp para solicitar feedback sobre o Coram (opcional).</label>
 <button className="button secondary" disabled={pending}>{pending?'Salvando autorização…':'Salvar autorização de feedback'}</button>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}
 </form>
}
