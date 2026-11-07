import { describe, expect, it, vi } from 'vitest'
import { fetchApiChapter } from './apiClient'
import { supabase } from '../lib/supabase'

describe('cliente bíblico', () => {
  it('consulta o servidor da aplicação sem enviar uma chave no navegador', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { copyright: 'Exemplo fictício', content: [{ type: 'tag', name: 'para', items: [{ type: 'tag', name: 'verse', attrs: { number: '1' } }, { type: 'text', text: 'Texto fictício.' }] }] }, meta: { fumsToken: 'ficticio' } }))
    const chapter = await fetchApiChapter({ translation: 'ara', book: 'joao', chapter: 3 }, fetcher)
    expect(fetcher).toHaveBeenCalledWith('/api/bible?translation=ara&book=joao&chapter=3', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
    expect(chapter.verses[0].text).toBe('Texto fictício.')
  })
  it('não mostra uma resposta de erro como texto bíblico', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ error: 'erro' }, { status: 503 }))
    await expect(fetchApiChapter({ translation: 'nvt', book: 'genesis', chapter: 1 }, fetcher)).rejects.toThrow('Não foi possível')
  })
  it('em STAGING envia a sessão somente à rota da mesma origem', async () => {
    vi.stubEnv('MODE', 'staging')
    try {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { access_token: 'fictional-token' } }, error: null } as never)
      const fetcher = vi.fn().mockResolvedValue(Response.json({ data: { copyright: 'Exemplo fictício', content: [{ type: 'tag', name: 'para', items: [{ type: 'tag', name: 'verse', attrs: { number: '1' } }, { type: 'text', text: 'Texto fictício.' }] }] }, meta: { fumsToken: 'ficticio' } }))
      await fetchApiChapter({ translation: 'ara', book: 'joao', chapter: 3 }, fetcher)
      expect(fetcher).toHaveBeenCalledWith('/api/bible?translation=ara&book=joao&chapter=3', { credentials: 'same-origin', headers: { Accept: 'application/json', Authorization: 'Bearer fictional-token' } })
    } finally { vi.unstubAllEnvs() }
  })
})
