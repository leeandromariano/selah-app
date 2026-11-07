import { describe, expect, it, vi } from 'vitest'
import { hostedBibleGateway } from './hostedGateway'

const origin = 'https://example.invalid'
const endpoint = `${origin}/api/bible?translation=nvt&book=genesis&chapter=1`
const request = (headers: Record<string, string> = {}) => new Request(endpoint, { headers })
const options = () => ({
  apiKey: 'fictional-secret', supabaseUrl: 'https://abcdefghijklmnopqrst.supabase.co', supabasePublicKey: 'fictional-public', siteOrigin: origin,
  quota: { consume: vi.fn().mockResolvedValue(true) },
  fetcher: vi.fn().mockResolvedValueOnce(Response.json({ id: '00000000-0000-4000-8000-000000000001' })).mockResolvedValueOnce(Response.json({ data: 'conteúdo fictício' })),
  now: new Date('2026-11-07T12:00:00Z'),
})
describe('acesso hospedado à Bíblia', () => {
  it('recusa configuração incompleta, origem externa e sessão ausente', async () => {
    expect((await hostedBibleGateway(request(), {})).status).toBe(503)
    expect((await hostedBibleGateway(request({ origin: 'https://other.invalid' }), options())).status).toBe(403)
    expect((await hostedBibleGateway(request(), options())).status).toBe(401)
  })
  it('nega token inválido sem chamar o provedor ou consumir cota', async () => {
    const config = options()
    config.fetcher.mockReset().mockResolvedValue(Response.json({}, { status: 401 }))
    expect((await hostedBibleGateway(request({ authorization: 'Bearer fictional-token' }), config)).status).toBe(401)
    expect(config.fetcher).toHaveBeenCalledOnce()
    expect(config.quota.consume).not.toHaveBeenCalled()
  })
  it('valida usuário, aplica limites e consulta o provedor sem enviar o token de usuário a ele', async () => {
    const config = options()
    const result = await hostedBibleGateway(request({ authorization: 'Bearer fictional-token' }), config)
    expect(result.status).toBe(200)
    expect(config.quota.consume).toHaveBeenCalledTimes(2)
    expect(config.fetcher.mock.calls[1][1].headers).toEqual({ 'api-key': 'fictional-secret', Accept: 'application/json' })
  })
  it('falha fechado quando o limite foi atingido', async () => {
    const config = options()
    config.quota.consume.mockResolvedValue(false)
    expect((await hostedBibleGateway(request({ authorization: 'Bearer fictional-token' }), config)).status).toBe(429)
    expect(config.fetcher).toHaveBeenCalledOnce()
  })
})
