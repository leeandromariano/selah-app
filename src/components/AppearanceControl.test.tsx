import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { AppearanceControl } from './AppearanceControl'
import { consistencyFixture } from '../test/consistencyBoundary'

describe('seletor de aparência acessível', () => {
  it('oferece Claro/Escuro/Sistema e pode ser usado por teclado sem sessão', async () => {
    const user=userEvent.setup();render(<AppearanceControl />)
    const select=screen.getByRole('combobox',{name:'Aparência'})
    expect(select).toHaveValue('dark')
    expect(screen.getAllByRole('option').map(option=>option.textContent)).toEqual(['Claro','Escuro','Sistema'])
    await user.tab();expect(select).toHaveFocus()
    await user.selectOptions(select,'dark')
    expect(document.documentElement).toHaveAttribute('data-theme','dark')
    expect(screen.getByRole('option',{name:'Escuro',selected:true})).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('troca aparência preserva mês, rota e preferência ao renovar sessão, sair e entrar', async () => {
    const session={user:{id:'appearance-fiction'}}
    vi.mocked(supabase.rpc).mockImplementation((name,args)=>name==='get_my_consistency' ? {abortSignal:async()=>({data:consistencyFixture({month:(args as {p_month:string|null}).p_month??'2026-10-01',first_month:'2026-09-01',status:'interrupted',total_days:1,total_devotionals:1,best_streak:1,last_completed_day:'2026-09-10'}),error:null})} as never : Promise.resolve({data:null,error:{code:'42501'}}) as never)
    vi.mocked(supabase.auth.getSession).mockResolvedValue({data:{session},error:null} as never)
    location.hash='minha-jornada';const user=userEvent.setup();render(<App />)
    await screen.findByRole('table')
    await user.click(screen.getByRole('button',{name:'Mês anterior'}))
    await screen.findByRole('table',{name:'setembro de 2026'})
    await user.selectOptions(screen.getByRole('combobox',{name:'Aparência'}),'dark')
    const before=vi.mocked(supabase.rpc).mock.calls.length
    await user.selectOptions(screen.getByRole('combobox',{name:'Aparência'}),'light')
    expect(supabase.rpc).toHaveBeenCalledTimes(before)
    expect(location.hash).toBe('#minha-jornada')
    expect(screen.getByRole('table',{name:'setembro de 2026'})).toBeVisible()
    await user.selectOptions(screen.getByRole('combobox',{name:'Aparência'}),'dark')
    act(()=>{vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('TOKEN_REFRESHED',session as never)})
    expect(screen.getByRole('combobox',{name:'Aparência'})).toHaveValue('dark')
    act(()=>{vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT',null)})
    expect(screen.getByRole('combobox',{name:'Aparência'})).toHaveValue('dark')
    act(()=>{vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_IN',{user:{id:'other-fiction'}} as never)})
    expect(screen.getByRole('combobox',{name:'Aparência'})).toHaveValue('dark')
    expect(localStorage.getItem('selah.appearance.v1')).toBe('dark')
  })
  it('informa seleção somente nesta aba quando escrita falha', async () => {
    const spy=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked')})
    try {
      render(<AppearanceControl />)
      fireEvent.change(screen.getByRole('combobox',{name:'Aparência'}),{target:{value:'dark'}})
      expect(screen.getByRole('status')).toHaveTextContent('Sua escolha vale nesta aba')
      expect(screen.getByRole('combobox',{name:'Aparência'})).toHaveAccessibleDescription(/não permitiu salvá-la/)
      expect(document.documentElement.dataset.theme).toBe('dark')
    } finally {spy.mockRestore()}
  })
})
