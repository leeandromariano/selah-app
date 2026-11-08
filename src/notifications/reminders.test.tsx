import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { createReminderRepository } from './repository'
import { deviceKey, notificationPermission } from './device'
import { ShareDevotional } from '../components/ShareDevotional'
import { devotionalShareLink } from './sharing'
import App from '../App'

const id = '10000000-0000-4000-8000-000000000001'
const binding = '20000000-0000-4000-8000-000000000001'
const snapshot = { enabled: false, mode: 'simulation', vapid_public_key: null, device: null, last: null }
function rpc(data: unknown = snapshot) { vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data, error: null }) } as never) }
describe('preferências e privacidade de lembretes', () => {
  it('não cria credencial sem ação e separa dispositivos entre contas', () => {
    expect(deviceKey('fiction-a')).toBeNull()
    const a = deviceKey('fiction-a', true), b = deviceKey('fiction-b', true)
    expect(a).not.toEqual(b); expect(deviceKey('fiction-a')).toEqual(a)
    expect(a?.secret).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
  it('storage bloqueado não ativa inscrição órfã', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw Error('blocked') })
    expect(() => deviceKey('fiction', true)).toThrow('armazenamento')
    expect(deviceKey('fiction')).toBeNull()
  })
  it('valor corrompido é ignorado sem inscrição automática', () => {
    localStorage.setItem('selah.reminder.device.fiction', '{')
    expect(deviceKey('fiction')).toBeNull()
  })
  it('consulta RPC própria sem argumento de proprietário', async () => {
    rpc(); const key = { id, secret: 'A'.repeat(43) }
    await createReminderRepository(supabase).get(key)
    expect(supabase.rpc).toHaveBeenCalledWith('get_my_reminders', { p_device: id, p_secret: key.secret })
  })
  it('persiste horário e fuso sem contadores de conclusão', async () => {
    rpc(); await createReminderRepository(supabase).save({ id, secret: 'A'.repeat(43) }, { enabled: true, time: '09:17', timezone: 'Asia/Tokyo', permission: 'denied', simulated: true })
    expect(supabase.rpc).toHaveBeenCalledWith('save_my_reminders', expect.objectContaining({ p_time: '09:17', p_timezone: 'Asia/Tokyo', p_permission: 'denied', p_subscription: null }))
  })
  it('erros de backend não expõem endpoints ou detalhes', async () => {
    vi.mocked(supabase.rpc).mockReturnValue({ abortSignal: async () => ({ data: null, error: { message: 'endpoint sensitive' } }) } as never)
    await expect(createReminderRepository(supabase).get(null)).rejects.toThrow('Não foi possível')
  })
  it('navegador incompatível informa indisponibilidade', () => { expect(notificationPermission()).toBe('unavailable') })
  it('configurações sem sessão não consultam preferências', async () => {
    location.hash = 'configuracoes'; render(<App />)
    expect(await screen.findByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalledWith('get_my_reminders', expect.anything())
  })
  it('configurações carregam sem opt-in e alteração de horário é explícita', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fiction-settings' } } }, error: null } as never)
    vi.mocked(supabase.rpc).mockImplementation(name => name === 'devotional_open_counts' ? Promise.resolve({ error: { code: '42501' } }) as never : name === 'get_my_publisher_access' ? Promise.resolve({ data: false, error: null }) as never : { abortSignal: async () => ({ data: snapshot, error: null }) } as never)
    location.hash = 'configuracoes'; render(<App />)
    const checkbox = await screen.findByRole('checkbox')
    expect(checkbox).not.toBeChecked()
    expect(screen.getByText(/navegador não oferece/)).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalledWith('save_my_reminders', expect.anything())
    fireEvent.change(screen.getByLabelText('Horário neste dispositivo'), { target: { value: '09:17' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar preferências' }))
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledWith('save_my_reminders', expect.objectContaining({ p_time: '09:17', p_enabled: false })))
  })
  it.each(['denied', 'default'])('permissão %s só muda por ação voluntária e negação bloqueia inscrição', async permission => {
    const request = vi.fn().mockResolvedValue('granted')
    vi.stubGlobal('Notification', { permission, requestPermission: request })
    vi.stubGlobal('isSecureContext', true)
    vi.stubGlobal('PushManager', function () {})
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: { getRegistration: vi.fn().mockResolvedValue(undefined) } })
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fiction-permission-' + permission } } }, error: null } as never)
    vi.mocked(supabase.rpc).mockImplementation(name => name === 'devotional_open_counts' ? Promise.resolve({ error: { code: '42501' } }) as never : name === 'get_my_publisher_access' ? Promise.resolve({ data: false, error: null }) as never : { abortSignal: async () => ({ data: { ...snapshot, enabled: true }, error: null }) } as never)
    location.hash = 'configuracoes'; render(<App />)
    await screen.findByRole('checkbox')
    expect(request).not.toHaveBeenCalled()
    if (permission === 'denied') {
      expect(screen.getByRole('button', { name: 'Cadastrar dispositivo fictício (sem envio)' })).toBeDisabled()
      expect(screen.queryByRole('button', { name: 'Permitir notificações neste navegador' })).not.toBeInTheDocument()
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Permitir notificações neste navegador' }))
      await waitFor(() => expect(request).toHaveBeenCalledOnce())
      expect(await screen.findByText('concedida')).toBeVisible()
    }
  })
  it('compartilhamento nunca inclui consulta, credenciais ou parâmetros privados', () => {
    expect(devotionalShareLink(id, 'http://localhost:5173/anything?token=secret')).toBe('http://localhost:5173/#leitura/' + id)
    expect(devotionalShareLink('javascript:alert(1)', 'http://localhost')).toBeNull()
    expect(devotionalShareLink(id, 'https://user:password@example.invalid')).toBeNull()
  })
  it('compartilhar não envia automaticamente para contatos', async () => {
    const share = vi.fn(), copy = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, share, clipboard: { writeText: copy } })
    render(<ShareDevotional id={id} />)
    expect(share).not.toHaveBeenCalled(); expect(copy).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Abrir WhatsApp para compartilhar' })).toHaveAttribute('rel', 'noopener noreferrer')
    fireEvent.click(screen.getByRole('button', { name: 'Copiar link' }))
    await screen.findByText('Link copiado.'); expect(copy).toHaveBeenCalledOnce()
    expect(share).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar' }))
    await screen.findByText('Compartilhamento aberto por sua escolha.')
    expect(share).toHaveBeenCalledWith({ title: 'Coram', text: expect.stringContaining('exige uma conta'), url: location.origin + '/#leitura/' + id })
  })
})
describe('protocolo real do service worker', () => {
  function protocol() {
    const context = vm.createContext({})
    vm.runInContext(readFileSync('public/push-protocol.js', 'utf8'), context)
    const raw = context.SelahPush
    return { ...raw, notification: (payload: unknown, binding: string) => raw.notification(payload, binding, '2026-10-28T15:00:00Z') }
  }
  it.each(['reading', 'share'])('gera texto estático e destino interno para %s', kind => {
    const message = protocol().notification({ v: 1, kind, binding, day: '2026-10-28', devotional: id, title: 'injection' }, binding)
    expect(message.title).not.toContain('injection'); expect(message.path).toBe('/#leitura/' + id + (kind === 'share' ? '/compartilhar' : ''))
  })
  it('outro binding ou rota maliciosa não gera notificação', () => {
    const p = protocol()
    expect(p.notification({ v: 1, kind: 'reading', binding, day: '2026-10-28', devotional: id }, id)).toBeNull()
    expect(p.notification({ v: 1, kind: 'share', binding, day: '2026-10-28', devotional: '//evil.invalid' }, binding)).toBeNull()
    expect(p.safePath('https://evil.invalid')).toBe(false); expect(p.safePath('/#admin')).toBe(false)
  })
  it('payload de prova só abre configurações', () => {
    expect(protocol().notification({ v: 1, kind: 'verify', binding, proof: id }, binding).path).toBe('/#configuracoes')
  })
  it('dia recebido após a meia-noite de Brasília é descartado', () => {
    expect(protocol().notification({ v: 1, kind: 'reading', binding, day: '2026-10-27', devotional: id }, binding)).toBeNull()
  })
})
