import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { GuidedDevotional } from './GuidedDevotional'
import type { Publication } from '../devotionals/repository'

vi.mock('./ReadingProgress', () => ({ ReadingProgress: () => <div>Progresso preservado</div> }))

const item: Publication = { id: '20000000-0000-4000-8000-000000000001', title: 'Um dia', bible_reference: 'João 1:1', bible_text: 'Texto de teste', content: 'A reflexão publicada.', reflection_question: 'O que mudou?', practical_challenge: 'Faça uma pausa.', prayer_prompt: 'Ore e responda.', publish_at: '2026-11-08T12:00:00Z', reading_revision: 1 }

describe('devocional guiado', () => {
  it('troca de etapa com deslize horizontal sem confundir rolagem, toque curto ou edição da resposta', () => {
    render(<GuidedDevotional item={item} userId="reader" onCompleted={vi.fn()} />)
    function swipe(name: string, start: [number, number], end: [number, number], target?: HTMLElement) {
      const element = target ?? screen.getByRole('region', { name })
      fireEvent.touchStart(element, { touches: [{ clientX: start[0], clientY: start[1] }] })
      fireEvent.touchEnd(element, { changedTouches: [{ clientX: end[0], clientY: end[1] }] })
    }
    swipe('A Palavra', [260, 100], [230, 100])
    swipe('A Palavra', [260, 100], [150, 240])
    expect(screen.getByRole('region', { name: 'A Palavra' })).toBeVisible()
    swipe('A Palavra', [260, 100], [130, 115])
    expect(screen.getByRole('region', { name: 'A Real' })).toBeVisible()
    swipe('A Real', [130, 100], [260, 110])
    expect(screen.getByRole('region', { name: 'A Palavra' })).toBeVisible()
    swipe('A Palavra', [130, 100], [260, 110])
    expect(screen.getByRole('region', { name: 'A Palavra' })).toBeVisible()
    swipe('A Palavra', [260, 100], [130, 110])
    swipe('A Real', [260, 100], [130, 110])
    swipe('Prática Coram Deo', [260, 100], [130, 110])
    expect(screen.getByRole('region', { name: 'Oração e resposta' })).toBeVisible()
    const textarea = screen.getByRole('textbox', { name: 'Minha resposta pessoal' })
    swipe('Oração e resposta', [260, 100], [130, 110], textarea)
    swipe('Oração e resposta', [260, 100], [130, 110])
    expect(screen.getByRole('region', { name: 'Oração e resposta' })).toBeVisible()
  })

  it('a frase central e o compartilhar ficam só no fim da última tela, deixando as outras etapas limpas', () => {
    const phrased = { ...item, share_phrase: '  A frase central fictícia do devocional.  ', author_name: 'Autora Fictícia' } as Publication
    render(<GuidedDevotional item={phrased} userId='reader' onCompleted={vi.fn()} />)
    const closing = () => ({ frase: screen.queryByText('A frase central fictícia do devocional.'), compartilhar: screen.queryByRole('region', { name: 'Compartilhar devocional' }) })
    for (const etapa of ['A Palavra', 'A Real', 'Prática Coram Deo']) {
      expect(screen.getByRole('region', { name: etapa })).toBeVisible()
      expect(closing().frase, etapa).not.toBeInTheDocument(); expect(closing().compartilhar, etapa).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    }
    expect(screen.getByRole('region', { name: 'Oração e resposta' })).toBeVisible()
    expect(closing().frase).toBeVisible()
    expect(screen.getByText('A FRASE DO DEVOCIONAL')).toBeVisible()
    expect(closing().compartilhar).toBeVisible()
    expect(screen.getByRole('button', { name: 'Compartilhar no Instagram' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(closing().frase).not.toBeInTheDocument(); expect(closing().compartilhar).not.toBeInTheDocument()
  })
  it('sem frase central, a última tela mostra só o compartilhar', () => {
    render(<GuidedDevotional item={{ ...item, share_phrase: null } as Publication} userId='reader' onCompleted={vi.fn()} />)
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: /Continuar/ }))
    expect(screen.queryByText('A FRASE DO DEVOCIONAL')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Compartilhar devocional' })).toBeVisible()
  })
  it('mostra as quatro etapas autorais e salva a resposta privada na conta', async () => {
    const user = userEvent.setup()
    const row = { source_devotional_id: item.id, devotional_id: item.id, body: 'Vou fazer uma pausa.', updated_at: '2026-11-08T14:00:00Z' }
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), insert: vi.fn(), single: vi.fn().mockResolvedValue({ data: row, error: null }) }
    for (const method of ['select', 'eq', 'insert'] as const) query[method].mockReturnValue(query)
    vi.mocked(supabase.from).mockReturnValue(query as never)
    render(<GuidedDevotional item={item} userId="reader" onCompleted={vi.fn()} />)
    expect(screen.getByText('Texto de teste')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /02A Real/ }))
    expect(screen.getByRole('button', { name: /01A Palavra/ })).toHaveAttribute('data-complete', 'true')
    expect(screen.getByText('A reflexão publicada.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /03Prática Coram Deo/ }))
    expect(screen.getByText('Faça uma pausa.')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /04Oração e resposta/ }))
    expect(screen.getByText('Ore e responda.')).toBeVisible()
    await user.type(screen.getByRole('textbox', { name: 'Minha resposta pessoal' }), row.body)
    await user.click(screen.getByRole('button', { name: 'Salvar resposta' }))
    expect(await screen.findByText('Sua resposta foi salva na sua conta.')).toBeVisible()
    expect(query.insert).toHaveBeenCalledWith({ source_devotional_id: item.id, devotional_id: item.id, body: row.body })
  })
})
