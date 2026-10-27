import {describe,expect,it,vi} from 'vitest'
import {createFeedbackRepository,feedbackMessage} from './feedback'
function mock(){const value={user_id:'reader',allowed:false,decided_at:'2026-10-26T10:00:00Z',purpose_version:'feedback-v1'};const q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:value,error:null})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);const rpc=vi.fn().mockResolvedValue({data:value,error:null});return {q,rpc,value,repo:createFeedbackRepository({from:vi.fn().mockReturnValue(q),rpc} as never)}}
describe('autorização separada de contato',()=>{
 it('consulta própria e salva por RPC com identidade/número esperados e sem timestamps fornecidos',async()=>{
  const {q,rpc,repo,value}=mock()
  expect(await repo.load('reader')).toEqual(value)
  expect(q.eq).toHaveBeenCalledWith('user_id','reader')
  await repo.save('reader','+5511999990000',true)
  expect(rpc).toHaveBeenCalledWith('set_feedback_contact',{p_user_id:'reader',p_expected_phone:'+5511999990000',p_allowed:true})
  await repo.save('reader',null,false)
  expect(rpc).toHaveBeenCalledWith('set_feedback_contact',{p_user_id:'reader',p_expected_phone:null,p_allowed:false})
 })
 it('recusa resposta alheia, erros e zero linhas sem expor dados privados',async()=>{
  const {rpc,repo}=mock()
  await expect(repo.load('other')).rejects.toMatchObject({code:'42501'})
  await expect(repo.save('other',null,false)).rejects.toMatchObject({code:'42501'})
  rpc.mockResolvedValueOnce({data:null,error:{code:'42501',message:'private other phone'}})
  await expect(repo.save('reader',null,false)).rejects.toMatchObject({code:'42501'})
  rpc.mockResolvedValueOnce({data:[],error:null})
  await expect(repo.save('reader',null,false)).rejects.toMatchObject({code:'42501'})
  expect(feedbackMessage()).not.toContain('private')
 })
})
