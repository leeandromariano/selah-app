import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GuidedDevotional } from './GuidedDevotional'
import type { Publication } from '../devotionals/repository'

vi.mock('./DiscussionSection', () => ({ DiscussionSection: () => <section aria-label="Deixe seu comentário"><h2>Deixe seu comentário</h2></section> }))

const item = { id: '20000000-0000-4000-8000-000000000001', title: 'Um dia', bible_reference: 'João 1:1', bible_text: 'Texto de teste', content: 'A reflexão publicada.', reflection_question: 'O que mudou?', practical_challenge: 'Faça uma pausa.', prayer_prompt: 'Ore por paz.', share_phrase: '  A frase central fictícia do devocional.  ', author_name: 'Autora Fictícia', publish_at: '2026-11-08T12:00:00Z', reading_revision: 1 } as Publication
const done = { completed_at: '2026-11-13T12:00:00Z', completed_day: '2026-11-13' }
const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
function goToPrayer() { click(/Continuar/); click(/Continuar/); click(/Continuar/) }

describe('devocional em etapas', () => {
  it('tem cinco etapas, numeradas, e nenhuma delas tem contagem de tempo', () => {
    render(<GuidedDevotional item={item} onCompleted={vi.fn()} complete={vi.fn()} />)
    expect(screen.getAllByRole('button').filter(b => /^0\d/.test(b.textContent ?? '')).map(b => b.textContent)).toEqual(['01A Palavra', '02A Real', '03Coram Deo na Prática', '04Oração', '05Para lembrar'])
    expect(screen.getByText('01 / 05 · VIVER CORAM DEO')).toBeVisible()
    expect(screen.getByText('Texto de teste')).toBeVisible()
    for (const removed of [/Concluir devocional/, /Salvar resposta/]) expect(screen.queryByRole('button', { name: removed })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Progresso de leitura' })).not.toBeInTheDocument()
  })
  it('passa pelas etapas: Palavra, Real (com "Para refletir"), Coram Deo na Prática e Oração, sem campo de resposta pessoal', () => {
    render(<GuidedDevotional item={item} onCompleted={vi.fn()} complete={vi.fn()} />)
    click(/Continuar/)
    expect(screen.getByRole('region', { name: 'A Real' })).toBeVisible()
    expect(screen.getByRole('button', { name: /01A Palavra/ })).toHaveAttribute('data-complete', 'true')
    expect(screen.getByText('A reflexão publicada.')).toBeVisible(); expect(screen.getByText('O que mudou?')).toBeVisible()
    click(/Continuar/)
    expect(screen.getByRole('region', { name: 'Coram Deo na Prática' })).toBeVisible(); expect(screen.getByText('Faça uma pausa.')).toBeVisible()
    click(/Continuar/)
    expect(screen.getByRole('region', { name: 'Oração' })).toBeVisible(); expect(screen.getByText('Ore por paz.')).toBeVisible()
    expect(screen.queryByRole('textbox', { name: 'Minha resposta pessoal' })).not.toBeInTheDocument()
  })
  it('o comentário ("Deixe seu comentário") fica só na etapa Oração', () => {
    render(<GuidedDevotional item={item} onCompleted={vi.fn()} complete={vi.fn()} />)
    for (const etapa of ['A Palavra', 'A Real', 'Coram Deo na Prática']) { expect(screen.getByRole('region', { name: etapa })).toBeVisible(); expect(screen.queryByRole('heading', { name: 'Deixe seu comentário' })).not.toBeInTheDocument(); click(/Continuar/) }
    expect(screen.getByRole('heading', { name: 'Deixe seu comentário' })).toBeVisible()
  })
  it('na Oração o botão é "Continuar e concluir": conclui sem tempo mínimo e abre "Para lembrar"', async () => {
    const complete = vi.fn().mockResolvedValue(done), onCompleted = vi.fn()
    render(<GuidedDevotional item={item} onCompleted={onCompleted} complete={complete} />)
    goToPrayer()
    expect(complete).not.toHaveBeenCalled()
    click('Continuar e concluir')
    expect(await screen.findByRole('region', { name: 'Para lembrar' })).toBeVisible()
    expect(complete).toHaveBeenCalledOnce(); expect(complete.mock.calls[0][1]).toBe(item.id)
    expect(onCompleted).toHaveBeenCalledOnce()
    expect(screen.getByRole('status')).toHaveTextContent('Devocional concluído.')
    expect(screen.queryByRole('button', { name: /Continuar/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para a tela inicial do Coram' })).toHaveAttribute('href', '#inicio')
  })
  it('o botão "Ir para a tela inicial do Coram" só existe na última etapa', async () => {
    render(<GuidedDevotional item={item} alreadyCompleted onCompleted={vi.fn()} complete={vi.fn()} />)
    expect(screen.queryByRole('link', { name: 'Ir para a tela inicial do Coram' })).not.toBeInTheDocument()
    click(/05Para lembrar/)
    expect(await screen.findByRole('link', { name: 'Ir para a tela inicial do Coram' })).toBeVisible()
    click('Voltar')
    expect(screen.queryByRole('link', { name: 'Ir para a tela inicial do Coram' })).not.toBeInTheDocument()
  })
  it('"Para lembrar" traz a frase central e o compartilhar; as outras etapas ficam limpas', async () => {
    render(<GuidedDevotional item={item} onCompleted={vi.fn()} complete={vi.fn().mockResolvedValue(done)} />)
    const closing = () => ({ frase: screen.queryByText('A frase central fictícia do devocional.'), compartilhar: screen.queryByRole('region', { name: 'Compartilhar devocional' }) })
    for (const etapa of ['A Palavra', 'A Real', 'Coram Deo na Prática', 'Oração']) {
      expect(screen.getByRole('region', { name: etapa })).toBeVisible()
      expect(closing().frase, etapa).not.toBeInTheDocument(); expect(closing().compartilhar, etapa).not.toBeInTheDocument()
      if (etapa === 'Oração') click('Continuar e concluir'); else click(/Continuar/)
    }
    expect(await screen.findByText('A FRASE DO DEVOCIONAL')).toBeVisible()
    expect(closing().frase).toBeVisible(); expect(closing().compartilhar).toBeVisible()
    expect(screen.getByRole('button', { name: 'Compartilhar no Instagram' })).toBeVisible()
  })
  it('sem frase central, "Para lembrar" mostra só o compartilhar', async () => {
    render(<GuidedDevotional item={{ ...item, share_phrase: null } as Publication} onCompleted={vi.fn()} complete={vi.fn().mockResolvedValue(done)} />)
    goToPrayer(); click('Continuar e concluir')
    expect(await screen.findByRole('region', { name: 'Compartilhar devocional' })).toBeVisible()
    expect(screen.queryByText('A FRASE DO DEVOCIONAL')).not.toBeInTheDocument()
  })
  it('se a conclusão falhar, avisa, fica na Oração e não conta como concluído', async () => {
    const onCompleted = vi.fn()
    render(<GuidedDevotional item={item} onCompleted={onCompleted} complete={vi.fn().mockRejectedValue(Error('x'))} />)
    goToPrayer(); click('Continuar e concluir')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível concluir agora')
    expect(screen.getByRole('region', { name: 'Oração' })).toBeVisible(); expect(onCompleted).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Continuar e concluir' })).toBeEnabled()
  })
  it('devocional já concluído não conclui de novo e o botão volta a ser "Continuar"', async () => {
    const complete = vi.fn()
    render(<GuidedDevotional item={item} alreadyCompleted onCompleted={vi.fn()} complete={complete} />)
    goToPrayer()
    expect(screen.queryByRole('button', { name: 'Continuar e concluir' })).not.toBeInTheDocument()
    click(/Continuar/)
    expect(await screen.findByRole('region', { name: 'Para lembrar' })).toBeVisible()
    expect(complete).not.toHaveBeenCalled()
  })
  it('ir direto à etapa "Para lembrar" também conclui, uma única vez', async () => {
    const complete = vi.fn().mockResolvedValue(done), onCompleted = vi.fn()
    render(<GuidedDevotional item={item} onCompleted={onCompleted} complete={complete} />)
    click(/05Para lembrar/)
    expect(await screen.findByRole('region', { name: 'Para lembrar' })).toBeVisible()
    click(/04Oração/); click(/05Para lembrar/)
    await waitFor(() => expect(screen.getByRole('region', { name: 'Para lembrar' })).toBeVisible())
    expect(complete).toHaveBeenCalledOnce(); expect(onCompleted).toHaveBeenCalledOnce()
  })
  it('troca de etapa com deslize horizontal, mas o deslize não conclui o devocional', async () => {
    const complete = vi.fn().mockResolvedValue(done)
    render(<GuidedDevotional item={item} onCompleted={vi.fn()} complete={complete} />)
    function swipe(name: string, start: [number, number], end: [number, number]) {
      const element = screen.getByRole('region', { name })
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
    swipe('A Palavra', [260, 100], [130, 110]); swipe('A Real', [260, 100], [130, 110]); swipe('Coram Deo na Prática', [260, 100], [130, 110])
    expect(screen.getByRole('region', { name: 'Oração' })).toBeVisible()
    swipe('Oração', [260, 100], [130, 110])
    expect(screen.getByRole('region', { name: 'Oração' })).toBeVisible()
    expect(complete).not.toHaveBeenCalled()
    swipe('Oração', [130, 100], [260, 110])
    expect(screen.getByRole('region', { name: 'Coram Deo na Prática' })).toBeVisible()
  })
})
