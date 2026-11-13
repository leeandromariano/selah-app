import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DevotionalShareCard } from './DevotionalShareCard'

const link = 'https://coram.example/#leitura/fiction'
const context = () => ({ fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 20 })) })
function downloadStubs() {
  vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['fictional png'], { type: 'image/png' })))
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL: vi.fn().mockReturnValue('blob:fictional-card'), revokeObjectURL: vi.fn() }))
  return vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
}

describe('compartilhar o card devocional', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('não cria o card com referência em texto livre, que poderia conter texto licenciado', () => {
    render(<DevotionalShareCard id="fiction" title="Paz" reference="Texto bíblico copiado" link="https://coram.example" />)
    expect(screen.queryByRole('button', { name: 'Compartilhar no Instagram' })).not.toBeInTheDocument()
  })
  it('só tem o botão do Instagram: sem legenda, prévia, download, tema ou formato', () => {
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    expect(screen.getByRole('button', { name: 'Compartilhar no Instagram' })).toHaveClass('primary')
    expect(screen.getByRole('button')).toBeVisible()
    for (const removed of ['Copiar legenda', 'Prévia e download', 'Baixar PNG', 'Story', 'Feed']) expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tema')).not.toBeInTheDocument()
  })
  it('mostra a prévia da imagem que será compartilhada, com a frase central, antes de tocar no botão', async () => {
    const ctx = context()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    render(<DevotionalShareCard id="fiction" title="Paz" phrase="Hoje posso descansar." author="Autora Fictícia" reference="João 14:27" link={link} />)
    const preview = await screen.findByRole('img', { name: 'Prévia da imagem que será compartilhada' })
    expect(preview).toBeVisible()
    expect(screen.getByText('Esta é a imagem que será compartilhada.')).toBeVisible()
    expect((preview as HTMLCanvasElement).width).toBe(1080); expect((preview as HTMLCanvasElement).height).toBe(1920)
    expect(ctx.fillText.mock.calls.some(call => String(call[0]).includes('Hoje'))).toBe(true)
    expect(ctx.fillText.mock.calls.some(call => call[0] === 'Autora Fictícia')).toBe(true)
    expect(screen.getByRole('button', { name: 'Compartilhar no Instagram' })).toBeEnabled()
  })
  it('sem como desenhar a imagem, a prévia não aparece (e nada quebra)', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(screen.queryByText('Esta é a imagem que será compartilhada.')).not.toBeVisible()
    expect(screen.getByRole('button', { name: 'Compartilhar no Instagram' })).toBeVisible()
  })
  it('a prévia não existe quando a referência não é válida', () => {
    render(<DevotionalShareCard id="fiction" title="Paz" reference="Texto livre" link="https://coram.example" />)
    expect(screen.queryByRole('img', { name: /Prévia/ })).not.toBeInTheDocument()
  })
  it('compartilha direto o PNG de Story (1080 × 1920) com o autor e o link, e avisa o que o chamou', async () => {
    const ctx = context(), onShared = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ZmFrZQ==')
    const canShare = vi.fn().mockReturnValue(true), share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, canShare, share })
    render(<DevotionalShareCard id="fiction" title="Paz" phrase="Hoje posso descansar." author="Autora Fictícia" reference="João 14:27" link={link} onShared={onShared} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no Instagram' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Imagem enviada ao menu de compartilhamento')
    const file = canShare.mock.calls[0][0].files[0] as File
    expect(file).toMatchObject({ name: 'coram-devocional-fiction-story.png', type: 'image/png' })
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ files: [file], text: 'Hoje posso descansar.\n\nLeia no Coram: ' + link }))
    expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920)
    expect(ctx.fillText.mock.calls.some(call => call[0] === 'Autora Fictícia')).toBe(true)
    expect(onShared).toHaveBeenCalledOnce()
  })
  it('baixa o PNG quando o navegador não compartilha arquivos, sem fechar a janela', async () => {
    const onShared = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, canShare: vi.fn().mockReturnValue(false), share: vi.fn() })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context() as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ZmFrZQ==')
    const click = downloadStubs()
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" onShared={onShared} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no Instagram' }))
    expect(await screen.findByRole('status')).toHaveTextContent('O PNG foi baixado')
    expect(click).toHaveBeenCalledOnce(); expect(navigator.share).not.toHaveBeenCalled(); expect(onShared).not.toHaveBeenCalled()
  })
  it('baixa o PNG quando a API nativa de compartilhar não existe', async () => {
    vi.stubGlobal('navigator', { ...navigator, share: undefined, canShare: undefined })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context() as never)
    const click = downloadStubs()
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no Instagram' }))
    expect(await screen.findByRole('status')).toHaveTextContent('O PNG foi baixado')
    expect(click).toHaveBeenCalledOnce()
  })
  it('cancelar o compartilhamento não fecha a janela nem afirma sucesso', async () => {
    const onShared = vi.fn()
    vi.stubGlobal('navigator', { ...navigator, canShare: vi.fn().mockReturnValue(true), share: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')) })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context() as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,ZmFrZQ==')
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" onShared={onShared} />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no Instagram' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Compartilhamento cancelado')
    expect(onShared).not.toHaveBeenCalled()
  })
  it('falha ao gerar a imagem avisa, sem afirmar download nem compartilhamento', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    fireEvent.click(screen.getByRole('button', { name: 'Compartilhar no Instagram' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi possível compartilhar a imagem')
  })
})
