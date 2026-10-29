import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { DiscussionSection } from './DiscussionSection'
import { ModerationPanel } from './ModerationPanel'
import type { Discussion, Moderation } from '../discussion/repository'
import { createDiscussionRepository } from '../discussion/repository'
import { libraryBoundary, olderPublications } from '../test/libraryBoundary'
import App from '../App'
const id=olderPublications[0].id
function boundary(initial: Partial<Discussion> = {}) {
  let data: Discussion={reaction:null,own:null,comments:[],page:0,total:0,...initial}
  vi.mocked(supabase.rpc).mockImplementation((name,args)=>({abortSignal:async()=>{
    const p=args as {p_value:Discussion['reaction'];p_body:string;p_page:number}
    if(name==='get_devotional_discussion')return {data:{...data,page:p.p_page},error:null}
    if(name==='set_my_devotional_reaction')data={...data,reaction:p.p_value}
    if(name==='save_my_devotional_comment')data={...data,own:{id:'fiction-comment',body:p.p_body.trim(),state:'pending',version:(data.own?.version??0)+1}}
    if(name==='remove_my_devotional_comment')data={...data,own:{...data.own!,body:'',state:'removed',version:data.own!.version+1}}
    if(name==='report_devotional_comment')data={...data,comments:data.comments.map(c=>({...c,reported:true}))}
    return {data:null,error:null}
  }}) as never)
  return {get:()=>data,replace:(next:Discussion)=>{data=next}}
}
describe('reflexões e reações do leitor',()=>{
  it('permite gostar, trocar e remover sem concluir leitura',async()=>{
    boundary();render(<DiscussionSection devotionalId={id}/>);const user=userEvent.setup()
    const like=await screen.findByRole('button',{name:'Gostei'})
    await user.click(like);await waitFor(()=>expect(like).toHaveAttribute('aria-pressed','true'))
    const dislike=screen.getByRole('button',{name:'Não gostei'})
    await user.click(dislike);await waitFor(()=>expect(dislike).toHaveAttribute('aria-pressed','true'))
    expect(like).toHaveAttribute('aria-pressed','false')
    await user.click(dislike);await waitFor(()=>expect(dislike).toHaveAttribute('aria-pressed','false'))
    expect(supabase.rpc).not.toHaveBeenCalledWith('complete_devotional',expect.anything())
    expect(supabase.rpc).toHaveBeenCalledWith('set_my_devotional_reaction',{p_devotional:id,p_value:null})
  })
  it('envia como pendente sem os textos removidos ou confirmação substituta',async()=>{
    boundary();render(<DiscussionSection devotionalId={id}/>);await screen.findByRole('button',{name:'Gostei'})
    expect(screen.getByText('Comente aqui o que você aprendeu e refletiu com essa devocional.')).toBeVisible()
    expect(screen.queryByText('Uma conversa com respeito, no seu tempo. Reagir ou comentar não conclui sua leitura.')).not.toBeInTheDocument()
    expect(screen.queryByText('Sua reflexão será publicada após aprovação e poderá ser vista por outros leitores do Selah.')).not.toBeInTheDocument()
    for(const text of [
      'Uma reflexão principal por devocional; você pode editar ou remover a sua.',
      'Envios ficam pendentes de moderação. Após aprovação, a reflexão será visível a leitores autenticados.',
      'Reflexão enviada para moderação.',
    ])expect(screen.queryByText(text,{exact:false})).not.toBeInTheDocument()
    const counter=screen.getByText('0/1000 caracteres')
    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).toBe(counter.id)
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Reflexão fictícia'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar para moderação'}))
    await screen.findByText('Pendente de moderação')
    expect(screen.queryByText('Reflexão enviada para moderação.')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(supabase.rpc).toHaveBeenCalledWith('save_my_devotional_comment',{p_devotional:id,p_body:'Reflexão fictícia',p_version:0})
  })
  it('atualiza contador ao digitar, mantém limite e bloqueia envio acima de 1000',async()=>{
    const source=boundary();render(<DiscussionSection devotionalId={id}/>);await screen.findByRole('button',{name:'Gostei'})
    const user=userEvent.setup(),field=screen.getByRole('textbox'),submit=screen.getByRole('button',{name:'Enviar para moderação'})
    expect(field).toHaveAttribute('maxlength','1000')
    expect(screen.getByText('0/1000 caracteres')).toBeVisible()
    await user.type(field,'Fé');expect(screen.getByText('2/1000 caracteres')).toBeVisible()
    await user.clear(field);expect(screen.getByText('0/1000 caracteres')).toBeVisible()
    fireEvent.change(field,{target:{value:'a'.repeat(1000)}})
    expect(screen.getByText('1000/1000 caracteres')).toBeVisible();expect(submit).toBeEnabled()
    // Programmatic input can bypass native maxlength; the action still blocks it.
    fireEvent.change(field,{target:{value:'a'.repeat(1001)}})
    expect(screen.getByText('1001/1000 caracteres')).toBeVisible();expect(submit).toBeDisabled()
    await user.click(submit)
    expect(supabase.rpc).not.toHaveBeenCalledWith('save_my_devotional_comment',expect.anything())
    fireEvent.change(field,{target:{value:'a'.repeat(1000)}});await user.click(submit)
    await screen.findByText('Pendente de moderação')
    expect(source.get().own?.body).toHaveLength(1000)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('não mostra os três blocos explicativos removidos da seção',async()=>{
    boundary();const {container}=render(<DiscussionSection devotionalId={id}/>);await screen.findByRole('button',{name:'Gostei'})
    for(const text of [
      'Sua reação é privada. Clique novamente na opção marcada para removê-la. Não exibimos votos individuais ou placar.',
      'Comentários aprovados serão visíveis a outros leitores autenticados com seu username e a data aproximada. Não são confidenciais. Novos textos e edições passam por moderação.',
      'Não publique telefone, e-mail, endereço, links de contato ou dados de terceiros. Assédio, ameaças, spam e exposição pessoal não são permitidos. Você pode denunciar um comentário aprovado.',
    ])expect(container.textContent).not.toContain(text)
    expect(screen.getByRole('group',{name:'Sua reação privada'})).toBeVisible()
  })
  it('edição aprovada volta à moderação e remoção exige confirmação',async()=>{
    boundary({own:{id:'fiction',body:'Texto aprovado',state:'approved',version:2}})
    render(<DiscussionSection devotionalId={id}/>);await screen.findByText('Aprovado')
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Texto editado'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar para moderação'}));await screen.findByText('Pendente de moderação')
    fireEvent.click(screen.getByRole('button',{name:'Remover minha reflexão'}))
    expect(supabase.rpc).not.toHaveBeenCalledWith('remove_my_devotional_comment',expect.anything())
    fireEvent.click(screen.getByRole('button',{name:'Confirmar remoção'}));await screen.findByText('Removido')
    expect(screen.getByRole('textbox')).toHaveValue('')
  })
  it('HTML malicioso é texto, sem links automáticos, e denúncia duplicada fica desabilitada',async()=>{
    const body='<img src=x onerror=alert(1)> https://example.invalid'
    boundary({comments:[{id:'fiction-other',body,username:'leitor_ficticio',day:'2026-10-28',own:false,reported:false}],total:1})
    const {container}=render(<DiscussionSection devotionalId={id}/>);await screen.findByText(body)
    expect(container.querySelector('img,a,script')).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Denunciar reflexão'}))
    fireEvent.click(screen.getByRole('button',{name:'Enviar denúncia'}))
    expect(await screen.findByRole('button',{name:'Denúncia registrada'})).toBeDisabled()
  })
  it('erro de frequência preserva texto e permite consulta segura antes de repetir',async()=>{
    boundary();const initial=vi.mocked(supabase.rpc).getMockImplementation()!
    vi.mocked(supabase.rpc).mockImplementation((name,args)=>name==='save_my_devotional_comment'?{abortSignal:async()=>({data:null,error:{code:'P0429'}})} as never:initial(name,args))
    render(<DiscussionSection devotionalId={id}/>);await screen.findByRole('button',{name:'Gostei'})
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Rascunho fictício'}})
    fireEvent.click(screen.getByRole('button',{name:'Enviar para moderação'}));await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Aguarde')
    fireEvent.click(screen.getByRole('button',{name:'Atualizar reflexões'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Gostei'})).toBeEnabled())
    expect(screen.getByRole('textbox')).toHaveValue('Rascunho fictício')
  })
  it('limita campo e preserva rascunho quando atualiza a seção',async()=>{
    boundary();render(<DiscussionSection devotionalId={id}/>);await screen.findByRole('button',{name:'Gostei'})
    expect(screen.getByRole('textbox')).toHaveAttribute('maxlength','1000')
    fireEvent.change(screen.getByRole('textbox'),{target:{value:'Uma reflexão em edição'}})
    fireEvent.click(screen.getByRole('button',{name:'Atualizar reflexões'}))
    await waitFor(()=>expect(screen.getByRole('button',{name:'Gostei'})).toBeEnabled())
    expect(screen.getByRole('textbox')).toHaveValue('Uma reflexão em edição')
  })
  it('logout remove texto privado e resposta tardia da conta anterior é descartada',async()=>{
    libraryBoundary([olderPublications[0]])
    const initial=vi.mocked(supabase.rpc).getMockImplementation()!
    let finish!:(value:unknown)=>void
    vi.mocked(supabase.rpc).mockImplementation((name,args)=>name==='get_devotional_discussion'?{abortSignal:()=>new Promise(resolve=>{finish=resolve})} as never:initial(name,args))
    vi.mocked(supabase.auth.getSession).mockResolvedValue({data:{session:{user:{id:'fiction-a'}}},error:null} as never)
    location.hash='leitura/'+id;render(<App/>);await screen.findByText('Carregando reflexões…')
    act(()=>{vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT',null)})
    await act(async()=>finish({data:{reaction:null,own:{id:'secret',body:'Texto privado fictício',state:'pending',version:1},comments:[],page:0,total:0},error:null}))
    expect(screen.queryByText('Texto privado fictício')).not.toBeInTheDocument()
    expect(screen.queryByRole('button',{name:'Enviar para moderação'})).not.toBeInTheDocument()
    expect(screen.getByLabelText('Usuário ou e-mail')).toBeVisible()
  })
  it('repositório não aceita autoria ou estado de moderação do cliente',async()=>{
    boundary();await createDiscussionRepository(supabase).save(id,'texto',3)
    expect(supabase.rpc).toHaveBeenCalledWith('save_my_devotional_comment',{p_devotional:id,p_body:'texto',p_version:3})
  })
})
describe('painel de moderação',()=>{
  function queue() {
    let data:Moderation={queue:'pending',page:0,total:1,items:[{id:'fiction-comment',body:'Reflexão fictícia',state:'pending',version:3,username:'leitor_ficticio',day:'2026-10-28',title:'Devocional fictício',available:true,reports:[]}]}
    vi.mocked(supabase.rpc).mockImplementation((name,args)=>({abortSignal:async()=>{
      if(name==='moderate_devotional_comment'){data={...data,total:0,items:[]};return {data:null,error:null}}
      return {data:{...data,queue:(args as {p_queue:string}).p_queue},error:null}
    }}) as never)
  }
  it('aprova com versão esperada e mostra decisão auditada',async()=>{
    queue();render(<ModerationPanel/>);fireEvent.click(await screen.findByRole('button',{name:'Aprovar reflexão'}))
    await screen.findByText('Nenhum item nesta fila.')
    expect(supabase.rpc).toHaveBeenCalledWith('moderate_devotional_comment',{p_comment:'fiction-comment',p_version:3,p_action:'approve',p_reason:'reviewed'})
    expect(screen.getByRole('status')).toHaveTextContent('auditoria')
  })
  it('rejeita com motivo explícito',async()=>{
    queue();render(<ModerationPanel/>);fireEvent.click(await screen.findByRole('button',{name:'Rejeitar reflexão'}));await screen.findByText('Nenhum item nesta fila.')
    expect(supabase.rpc).toHaveBeenCalledWith('moderate_devotional_comment',expect.objectContaining({p_action:'reject',p_reason:'contact'}))
  })
  it('nega leitor e não mantém conteúdo após perda de autorização',async()=>{
    queue();render(<ModerationPanel/>);await screen.findByText('Reflexão fictícia')
    vi.mocked(supabase.rpc).mockReturnValue({abortSignal:async()=>({data:null,error:{code:'42501'}})} as never)
    fireEvent.click(screen.getByRole('button',{name:'Atualizar moderação'}));await screen.findByRole('alert')
    expect(screen.queryByText('Reflexão fictícia')).not.toBeInTheDocument()
  })
})
