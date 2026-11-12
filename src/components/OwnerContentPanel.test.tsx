import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { OwnerContentPanel } from './OwnerContentPanel'
import type { ContentItem } from '../owner/content'

const id = '11111111-1111-4111-8111-111111111111'
const item: ContentItem = { id, game: 'quiz', prompt: 'Pergunta fictícia de teste?', options: ['Alfa', 'Beta', 'Gama', 'Delta'], correct_index: 1, reference: 'João 3:16', active: true, answers_count: 4, testament: 'novo', level: 2 }
const who: ContentItem = { id: '22222222-2222-4222-8222-222222222222', game: 'who', prompt: 'Frase fictícia de teste.', options: ['A1', 'B1', 'C1', 'D1'], correct_index: 0, reference: 'Gênesis 4:9', active: true, answers_count: 0, mode: 'base', context: 'Contexto fictício bem explicado.' }
function setup(items: ContentItem[] = [item], saved: unknown = { item, answers_reset: 0 }) {
  const repo = {
    list: vi.fn(async (game: string) => ({ game, total: items.length, page: 0, size: 20, items: items.filter(entry => entry.game === game) })),
    save: vi.fn(async () => saved),
    remove: vi.fn(async () => ({ answers_removed: 4 })),
  }
  render(<OwnerContentPanel repo={repo as never} />)
  return repo
}

describe('Perguntas dos jogos (owner)', () => {
  it('lista as perguntas com a resposta certa em destaque', async () => {
    const repo = setup()
    const list = await screen.findByRole('list', { name: 'Perguntas' })
    expect(within(list).getByText('Pergunta fictícia de teste?')).toBeVisible()
    expect(within(list).getByText(/Beta/)).toHaveTextContent('(resposta certa)')
    expect(within(list).getByText(/4 respostas/)).toBeVisible()
    expect(repo.list).toHaveBeenCalledWith('quiz', '', '', 0)
  })
  it('filtra por nível e troca de jogo', async () => {
    const repo = setup([item, who])
    const user = userEvent.setup()
    await screen.findByRole('list', { name: 'Perguntas' })
    await user.selectOptions(screen.getByLabelText('Nível'), '3')
    expect(repo.list).toHaveBeenLastCalledWith('quiz', '', '3', 0)
    await user.click(screen.getByRole('button', { name: 'Quem disse isso?' }))
    expect(await screen.findByText('Frase fictícia de teste.')).toBeVisible()
    expect(screen.getByLabelText('Modo')).toBeVisible()
  })
  it('ao editar, a resposta certa acompanha a alternativa e mostra o texto atual', async () => {
    setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Editar: Pergunta/ }))
    expect(screen.getByText(/B — Beta/)).toBeVisible()
    await user.clear(screen.getByLabelText('Alternativa B'))
    await user.type(screen.getByLabelText('Alternativa B'), 'Beta nova')
    expect(screen.getByText(/B — Beta nova/)).toBeVisible()
    await user.click(screen.getByLabelText('Marcar a alternativa C como resposta certa'))
    expect(screen.getByText(/C — Gama/)).toBeVisible()
  })
  it('exige confirmar o zeramento das respostas quando muda alternativa ou resposta certa', async () => {
    const repo = setup([item], { item, answers_reset: 4 })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Editar: Pergunta/ }))
    await user.click(screen.getByLabelText('Marcar a alternativa A como resposta certa'))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Confirme que as respostas')
    expect(repo.save).not.toHaveBeenCalled()
    await user.click(screen.getByLabelText(/Entendo e quero continuar/))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalledWith('quiz', id, expect.objectContaining({ correct_index: 0 }))
    expect(await screen.findByText(/4 respostas de leitores a esta pergunta foram zeradas/)).toBeVisible()
  })
  it('editar só o texto da pergunta não pede confirmação', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Editar: Pergunta/ }))
    expect(screen.queryByLabelText(/Entendo e quero continuar/)).not.toBeInTheDocument()
    await user.type(screen.getByLabelText('Pergunta'), ' Mais um pouco.')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalled()
  })
  it('mostra o erro de validação sem enviar ao servidor', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nova pergunta' }))
    await user.type(screen.getByLabelText('Pergunta'), 'Uma pergunta nova?')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('4 alternativas')
    expect(repo.save).not.toHaveBeenCalled()
  })
  it('cria uma pergunta nova completa', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Nova pergunta' }))
    await user.type(screen.getByLabelText('Pergunta'), 'Uma pergunta nova?')
    for (const [letter, text] of [['A', 'um'], ['B', 'dois'], ['C', 'três'], ['D', 'quatro']]) await user.type(screen.getByLabelText(`Alternativa ${letter}`), text)
    await user.click(screen.getByLabelText('Marcar a alternativa D como resposta certa'))
    await user.type(screen.getByLabelText('Referência bíblica'), 'Mateus 5:1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalledWith('quiz', null, expect.objectContaining({ prompt: 'Uma pergunta nova?', options: ['um', 'dois', 'três', 'quatro'], correct_index: 3, reference: 'Mateus 5:1' }))
  })
  it('pede confirmação antes de excluir e informa quantas respostas saem junto', async () => {
    const repo = setup()
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /Excluir: Pergunta/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('4 respostas de leitores')
    expect(repo.remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Sim, excluir' }))
    expect(repo.remove).toHaveBeenCalledWith('quiz', id)
    expect(await screen.findByText(/Excluída\. 4 respostas/)).toBeVisible()
  })
  it('mostra erro de acesso com opção de repetir', async () => {
    const repo = { list: vi.fn().mockRejectedValueOnce(Error('x')).mockResolvedValue({ game: 'quiz', total: 0, page: 0, size: 20, items: [] }), save: vi.fn(), remove: vi.fn() }
    render(<OwnerContentPanel repo={repo as never} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo do proprietário')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByText('Nada encontrado.')).toBeVisible()
  })
})
