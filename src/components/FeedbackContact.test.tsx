import {render,screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe,expect,it,vi} from 'vitest'
import {supabase} from '../lib/supabase'
import {FeedbackContact} from './FeedbackContact'
function mock(allowed=false){const value={user_id:'reader',allowed,decided_at:'2026-10-26T10:00:00Z',purpose_version:'feedback-v1'},q={select:vi.fn(),eq:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data:value,error:null})};q.select.mockReturnValue(q);q.eq.mockReturnValue(q);vi.mocked(supabase.from).mockReturnValue(q as never);vi.mocked(supabase.rpc).mockResolvedValue({data:{...value,allowed:!allowed},error:null} as never);return q}
describe('escolha de feedback no perfil',()=>{
 it('não consulta enquanto fechado; escolha separada pode ser autorizada e retirada',async()=>{
  const q=mock(),user=userEvent.setup(),view=render(<FeedbackContact userId="reader" phone="+5511999990000"/>)
  expect(supabase.from).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Gerenciar autorização de feedback'}))
  const checkbox=await screen.findByRole('checkbox');expect(checkbox).not.toBeChecked()
  await user.click(checkbox);await user.click(screen.getByRole('button',{name:'Salvar autorização de feedback'}))
  expect(await screen.findByRole('status')).toHaveTextContent('Autorização de feedback salva')
  q.maybeSingle.mockResolvedValue({data:{user_id:'reader',allowed:true},error:null})
  vi.mocked(supabase.rpc).mockResolvedValue({data:{user_id:'reader',allowed:false},error:null} as never)
  view.unmount();render(<FeedbackContact userId="reader" phone="+5511999990000"/>);await user.click(screen.getByRole('button',{name:'Gerenciar autorização de feedback'}))
  await user.click(await screen.findByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Salvar autorização de feedback'}))
  expect(await screen.findByRole('status')).toHaveTextContent('retirada')
 })
 it('negação não habilita alteração nem exibe número/diagnóstico privado',async()=>{
  const q=mock();q.maybeSingle.mockResolvedValue({data:null,error:{code:'42501',message:'private +123456789'}} as never)
  const user=userEvent.setup();render(<FeedbackContact userId="reader" phone="+5511999990000"/>);await user.click(screen.getByRole('button',{name:'Gerenciar autorização de feedback'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();expect(screen.queryByText(/123456789/)).not.toBeInTheDocument()
 })
 it('legado sem número não recebe opt-in implícito e pode retirar autorização',async()=>{
  mock(true);const user=userEvent.setup();render(<FeedbackContact userId="reader" phone={null}/>);await user.click(screen.getByRole('button',{name:'Gerenciar autorização de feedback'}))
  await user.click(await screen.findByRole('checkbox'));await user.click(screen.getByRole('button',{name:'Salvar autorização de feedback'}))
  expect(supabase.rpc).toHaveBeenCalledWith('set_feedback_contact',{p_user_id:'reader',p_expected_phone:null,p_allowed:false})
  expect(await screen.findByRole('status')).toHaveTextContent('retirada')
 })
})
