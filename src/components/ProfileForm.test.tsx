import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Session } from '@supabase/supabase-js'
import App from '../App'
import { supabase } from '../lib/supabase'

const id = '10000000-0000-4000-8000-000000000001'
const saved = { id, name: 'Pessoa Fictícia', phone: '+5511999990000', age_range: '25_34', instagram: '@ficticio', created_at: '2026-10-26T10:00:00Z', updated_at: '2026-10-26T10:00:00Z' }
const session = { user: { id, user_metadata: { role: 'admin', profile: { name: 'Rascunho Fictício', phone: null, age_range: '18_24', instagram: null, id: 'forged', role: 'admin' } } } } as unknown as Session

function mockTable(data: typeof saved | null = saved) {
  const table = {
    select: vi.fn(), eq: vi.fn(), insert: vi.fn(), update: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
    single: vi.fn().mockResolvedValue({ data: saved, error: null }),
  }
  for (const method of ['select', 'eq', 'insert', 'update'] as const) table[method].mockReturnValue(table)
  vi.mocked(supabase.from).mockReturnValue(table as never)
  return table
}
function open() {
  location.hash = 'perfil'
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null })
  return render(<App />)
}

describe('perfil do leitor', () => {
  it('conta nova não pode remover o WhatsApp obrigatório ao editar',async()=>{
    const table=mockTable({...saved,whatsapp_required:true} as never),user=userEvent.setup()
    open()
    await user.clear(await screen.findByLabelText('WhatsApp (obrigatório)'))
    await user.click(screen.getByRole('button',{name:'Salvar perfil'}))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe WhatsApp com')
    expect(table.update).not.toHaveBeenCalled()
  })
  it('novo perfil permite contatos opcionais e nome vazio, sem perguntar faixa etária', async () => {
    const table = mockTable(null)
    table.single.mockResolvedValueOnce({ data: { ...saved, name: null, phone: null, age_range: null, instagram: null }, error: null } as never)
    location.hash = 'perfil'
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id, user_metadata: {} } } }, error: null } as never)
    const user = userEvent.setup()
    render(<App />)
    expect(await screen.findByLabelText('Nome de exibição (opcional)')).toHaveValue('')
    expect(screen.queryByLabelText(/Faixa etária/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText('WhatsApp (preenchimento posterior)')).toHaveValue('')
    expect(screen.getByLabelText('Instagram (opcional)')).toHaveValue('')
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Perfil salvo')
    expect(table.insert).toHaveBeenCalledWith({ id, name: null, phone: null, age_range: null, instagram: null })
  })
  it('bloqueia visitante sem consultar o banco', async () => {
    location.hash = 'perfil'
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Entre na sua conta')
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('carrega perfil do próprio id, prioriza banco e preserva edição ao remontar', async () => {
    const table = mockTable()
    const user = userEvent.setup()
    const view = open()
    expect(await screen.findByLabelText('Nome de exibição (opcional)')).toHaveValue(saved.name)
    expect(table.eq).toHaveBeenCalledWith('id', id)
    expect(screen.getAllByRole('textbox')).toHaveLength(3)
    await user.clear(screen.getByLabelText('Nome de exibição (opcional)'))
    await user.type(screen.getByLabelText('Nome de exibição (opcional)'), 'Nome Atualizado')
    const updated = { ...saved, name: 'Nome Atualizado' }
    table.single.mockResolvedValueOnce({ data: updated, error: null })
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Perfil salvo')
    expect(table.update).toHaveBeenCalledWith({ name: updated.name, phone: saved.phone, age_range: saved.age_range, instagram: saved.instagram })
    // Boundary simulates persisted database response; real persistence is checked by HTTP.
    table.maybeSingle.mockResolvedValue({ data: updated, error: null })
    view.unmount()
    open()
    expect(await screen.findByLabelText('Nome de exibição (opcional)')).toHaveValue(updated.name)
  })

  it('perfil ausente usa apenas rascunho permitido e cria explicitamente com id da sessão', async () => {
    const table = mockTable(null)
    const user = userEvent.setup()
    open()
    expect(await screen.findByText(/perfil ainda não foi criado/)).toBeVisible()
    expect(screen.getByLabelText('Nome de exibição (opcional)')).toHaveValue('Rascunho Fictício')
    expect(table.insert).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Perfil salvo')
    expect(table.insert).toHaveBeenCalledWith({ id, name: 'Rascunho Fictício', phone: null, age_range: '18_24', instagram: null })
  })

  it('erro de autorização na carga bloqueia formulário e permite nova tentativa', async () => {
    const table = mockTable()
    table.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    const user = userEvent.setup()
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem autorização')
    expect(screen.queryByRole('button', { name: 'Salvar perfil' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByLabelText('Nome de exibição (opcional)')).toHaveValue(saved.name)
    expect(table.insert).not.toHaveBeenCalled()
  })

  it('falha de conexão não é tratada como perfil ausente nem permite criação', async () => {
    const table = mockTable()
    table.maybeSingle.mockRejectedValueOnce(new Error('offline'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('Verifique sua conexão')
    expect(screen.queryByLabelText('Nome de exibição (opcional)')).not.toBeInTheDocument()
    expect(table.insert).not.toHaveBeenCalled()
  })

  it('negação ao salvar mantém os campos e não anuncia sucesso', async () => {
    const table = mockTable()
    table.single.mockResolvedValueOnce({ data: null, error: { code: '42501' } })
    const user = userEvent.setup()
    open()
    await screen.findByLabelText('Nome de exibição (opcional)')
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não tem autorização')
    expect(screen.getByLabelText('Nome de exibição (opcional)')).toHaveValue(saved.name)
    expect(screen.queryByText('Perfil salvo com sucesso.')).not.toBeInTheDocument()
  })

  it('limpa campos opcionais como null e bloqueia envio repetido durante gravação', async () => {
    const table = mockTable()
    let finish!: (value: unknown) => void
    table.single.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const user = userEvent.setup()
    open()
    await screen.findByLabelText('Nome de exibição (opcional)')
    await user.clear(screen.getByLabelText('WhatsApp (preenchimento posterior)'))
    await user.clear(screen.getByLabelText('Instagram (opcional)'))
    await user.selectOptions(screen.getByLabelText('Faixa etária (opcional)'), '')
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    const pending = screen.getByRole('button', { name: 'Salvando…' })
    expect(pending).toBeDisabled()
    await user.click(pending)
    expect(table.update).toHaveBeenCalledTimes(1)
    expect(table.update).toHaveBeenCalledWith({ name: saved.name, phone: null, age_range: null, instagram: null })
    await act(async () => { finish({ data: { ...saved, phone: null, instagram: null, age_range: null }, error: null }) })
    expect(screen.getByRole('status')).toHaveTextContent('Perfil salvo')
  })

  it('não mostra dados de consulta atrasada após encerrar a sessão', async () => {
    const table = mockTable()
    let finish!: (value: unknown) => void
    table.maybeSingle.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    open()
    await screen.findByText('Carregando seu perfil…')
    act(() => { vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0]('SIGNED_OUT', null) })
    await act(async () => { finish({ data: saved, error: null }) })
    expect(screen.queryByLabelText('Nome de exibição (opcional)')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Entre na sua conta')
  })

  it('recusa telefone inválido antes de enviar ao banco', async () => {
    const table = mockTable()
    const user = userEvent.setup()
    open()
    await screen.findByLabelText('Nome de exibição (opcional)')
    await user.clear(screen.getByLabelText('WhatsApp (preenchimento posterior)'))
    await user.type(screen.getByLabelText('WhatsApp (preenchimento posterior)'), '123')
    await user.click(screen.getByRole('button', { name: 'Salvar perfil' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe celular com DDD')
    expect(table.update).not.toHaveBeenCalled()
  })
})
