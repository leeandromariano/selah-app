import { afterEach, describe, expect, it, vi } from 'vitest'
import { reportBibleView } from './fums'

afterEach(() => { document.querySelectorAll('script[src="https://pkg.api.bible/fumsV3.min.js"]').forEach(script => script.remove()); delete (window as Window & { fums?: unknown }).fums })

describe('registro de visualização bíblica', () => {
  it('envia o token apenas após carregar o rastreador, sem identificação de usuário', async () => {
    const report = vi.fn()
    const pending = reportBibleView('token-ficticio')
    const script = document.querySelector('script[src="https://pkg.api.bible/fumsV3.min.js"]')
    expect(script).not.toBeNull()
    expect(report).not.toHaveBeenCalled()
    ;(window as Window & { fums?: unknown }).fums = report
    script!.dispatchEvent(new Event('load'))
    await pending
    expect(report).toHaveBeenCalledExactlyOnceWith('trackView', 'token-ficticio')
  })
  it('não carrega o rastreador para token vazio', async () => {
    await expect(reportBibleView('')).rejects.toThrow()
    expect(document.querySelector('script[src="https://pkg.api.bible/fumsV3.min.js"]')).toBeNull()
  })
})
