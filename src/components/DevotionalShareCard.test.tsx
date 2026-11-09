import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DevotionalShareCard } from './DevotionalShareCard'

describe('exportação do card devocional', () => {
  it('does not create a card from a free-text reference that could contain licensed content', () => {
    render(<DevotionalShareCard id="fiction" title="Paz" reference="Texto bíblico copiado" link="https://coram.example" />)
    expect(screen.queryByRole('button', { name: 'Criar card do devocional' })).not.toBeInTheDocument()
  })
  it('offers both formats and three solid themes without placing scripture text in the preview', () => {
    render(<DevotionalShareCard id="fiction" title="Paz para hoje" reference="João 14:27" link="https://coram.example/#leitura/fiction" />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar card do devocional' }))
    expect(screen.getByRole('img', { name: /Prévia do card Obsidian para post/ })).toHaveTextContent('Paz para hoje')
    expect(screen.getByRole('img')).toHaveTextContent('João 14:27')
    expect(screen.getByRole('img')).toHaveTextContent('https://coram.example/#leitura/fiction')
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'story' } })
    fireEvent.change(screen.getByLabelText('Tema'), { target: { value: 'paper' } })
    expect(screen.getByRole('img', { name: /Prévia do card Papel Cru para story/ })).toHaveClass('story', 'paper')
    expect(screen.getByRole('option', { name: 'Brasa' })).toBeInTheDocument()
  })
  it('reports PNG generation failure without claiming a download', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar card do devocional' }))
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Não foi possível gerar o card')
  })
  it('downloads a PNG using the selected dimensions', async () => {
    const context = { fillRect: vi.fn(), strokeRect: vi.fn(), fillText: vi.fn(), measureText: vi.fn((text: string) => ({ width: text.length * 20 })) }
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['fictional png'], { type: 'image/png' })))
    const createObjectURL = vi.fn().mockReturnValue('blob:fictional-card')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<DevotionalShareCard id="fiction" title="Paz" reference="João 14:27" link="https://coram.example" />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar card do devocional' }))
    fireEvent.change(screen.getByLabelText('Formato'), { target: { value: 'story' } })
    fireEvent.click(screen.getByRole('button', { name: 'Baixar PNG' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Card PNG preparado para salvar')
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1080, 1920)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
  })
})
