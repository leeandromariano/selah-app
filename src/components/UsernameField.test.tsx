import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { UsernameField } from './UsernameField'
function mock(data: unknown = null) {
 const q={select:vi.fn(),eq:vi.fn(),insert:vi.fn(),maybeSingle:vi.fn().mockResolvedValue({data,error:null}),single:vi.fn().mockResolvedValue({data:{user_id:'reader',username:'pessoa_01'},error:null})}
 for(const m of ['select','eq','insert'] as const)q[m].mockReturnValue(q)
 vi.mocked(supabase.from).mockReturnValue(q as never)
 return q
}
describe('username no perfil',()=>{
 it('mostra username existente sem oferecer alteração ou login personalizado',async()=>{
  const q=mock({user_id:'reader',username:'pessoa_01'}),user=userEvent.setup()
  render(<UsernameField userId="reader" />)
  expect(supabase.from).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button',{name:'Consultar meu username'}))
  expect(await screen.findByRole('status')).toHaveTextContent('pessoa_01')
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(q.insert).not.toHaveBeenCalled()
 })
 it('conta legada pode reservar; duplicidade mostra erro sem email nem falso sucesso',async()=>{
  const q=mock(),user=userEvent.setup()
  q.single.mockResolvedValueOnce({data:null,error:{code:'23505',message:'other@example.invalid'}} as never)
  render(<UsernameField userId="reader" />)
  await user.click(screen.getByRole('button',{name:'Consultar meu username'}))
  const input=await screen.findByLabelText('Username')
  await user.type(input,' Pessoa_01 ')
  await user.click(screen.getByRole('button',{name:'Reservar username'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('em uso')
  expect(screen.queryByText(/other@example/)).not.toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Reservar username'}))
  expect(await screen.findByRole('status')).toHaveTextContent('pessoa_01')
  expect(q.insert).toHaveBeenCalledWith({user_id:'reader',username:'pessoa_01'})
 })
 it('negação de leitura não vira perfil sem username',async()=>{
  const q=mock(),user=userEvent.setup()
  q.maybeSingle.mockResolvedValue({data:null,error:{code:'42501'}} as never)
  render(<UsernameField userId="reader" />)
  await user.click(screen.getByRole('button',{name:'Consultar meu username'}))
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
  expect(screen.queryByLabelText('Username')).not.toBeInTheDocument()
  expect(q.insert).not.toHaveBeenCalled()
 })
})
