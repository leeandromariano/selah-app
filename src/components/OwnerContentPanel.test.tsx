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
  const loadVerse = vi.fn(async (location: { book: string }) => { if (location.book !== 'joao') throw Error('offline'); return { verses: [{ number: 16, text: 'Alfa beta gama delta épsilon.' }], copyright: 'Texto fictício.', fumsToken: 'token' } })
  render(<OwnerContentPanel repo={repo as never} loadVerse={loadVerse as never} reportVerse={async () => {}} />)
  return repo
}

describe('Perguntas dos jogos (owner)', () => {
  it('lista as perguntas com a resposta certa em destaque', async () => {
    const repo = setup()
    const list = await screen.findByRole('list', { name: 'Itens' })
    expect(within(list).getByText('Pergunta fictícia de teste?')).toBeVisible()
    expect(within(list).getByText(/Beta/)).toHaveTextContent('(resposta certa)')
    expect(within(list).getByText(/4 respostas/)).toBeVisible()
    expect(repo.list).toHaveBeenCalledWith('quiz', '', '', 0)
  })
  it('mostra a página atual e o total de páginas', async () => {
    const repo = { list: vi.fn(async (game: string) => ({ game, total: 45, page: 0, size: 20, items: [item] })), save: vi.fn(), remove: vi.fn() }
    render(<OwnerContentPanel repo={repo as never} />)
    expect(await screen.findByText('Página 1 de 3')).toBeVisible()
  })
  it('filtra por nível e troca de jogo', async () => {
    const repo = setup([item, who])
    const user = userEvent.setup()
    await screen.findByRole('list', { name: 'Itens' })
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
    expect(await screen.findByText(/4 respostas de leitores a este item foram zeradas/)).toBeVisible()
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
    expect(await screen.findByText(/Excluído\. 4 respostas/)).toBeVisible()
  })
  it('edita uma carta do Tá na Bíblia: veredito, explicação e aviso ao mudar o veredito', async () => {
    const card: ContentItem = { id: '33333333-3333-4333-8333-333333333333', game: 'claims', prompt: 'Carta fictícia de teste', reference: '', active: true, answers_count: 2, verdict: 'invencao', explanation: 'Explicação fictícia longa.' }
    const repo = setup([card], { item: card, answers_reset: 2 })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Tá na Bíblia ou Tá Amarrado?' }))
    expect(await screen.findByText('Carta fictícia de teste')).toBeVisible()
    expect(screen.getByLabelText('Veredito')).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Editar: Carta/ }))
    await user.selectOptions(screen.getByLabelText('Veredito'), 'biblia')
    await user.click(screen.getByLabelText(/Entendo e quero continuar/))
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalledWith('claims', card.id, expect.objectContaining({ verdict: 'biblia', explanation: 'Explicação fictícia longa.' }))
  })
  it('cria um acontecimento da Linha do Tempo com era e posição', async () => {
    const event: ContentItem = { id: '44444444-4444-4444-8444-444444444444', game: 'timeline', prompt: 'Acontecimento fictício', reference: 'Gênesis 1:1', active: true, answers_count: 0, era: 'Origens', position: 1 }
    const repo = setup([event], { item: event, answers_reset: 0 })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Linha do Tempo' }))
    expect(await screen.findByText('1º · Acontecimento fictício')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Novo acontecimento' }))
    await user.type(screen.getByLabelText('Acontecimento'), 'Outro acontecimento')
    await user.type(screen.getByLabelText('Era'), 'Patriarcas')
    await user.clear(screen.getByLabelText(/Posição na linha do tempo/))
    await user.type(screen.getByLabelText(/Posição na linha do tempo/), '7')
    await user.type(screen.getByLabelText('Referência bíblica'), 'Gênesis 12:1')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalledWith('timeline', null, expect.objectContaining({ prompt: 'Outro acontecimento', era: 'Patriarcas', position: 7, reference: 'Gênesis 12:1' }))
  })
  it('no Versículo Oculto, carrega o texto e deixa escolher as palavras tocando nelas', async () => {
    const repo = setup([], { item: { id: '55555555-5555-4555-8555-555555555555', game: 'verse', prompt: 'João 3:16', reference: 'João 3:16', active: true, answers_count: 0, seq: 1, blanks: [{ index: 2, answer: 'beta', prev: 'Alfa' }, { index: 4, answer: 'delta', prev: 'gama' }] }, answers_reset: 0 })
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Versículo Oculto' }))
    await user.click(await screen.findByRole('button', { name: 'Novo versículo' }))
    expect(screen.getByRole('button', { name: 'Carregar texto do versículo' })).toBeDisabled()
    await user.type(screen.getByLabelText('Referência do versículo'), 'João 3:16')
    await user.click(screen.getByRole('button', { name: 'Carregar texto do versículo' }))
    await user.click(await screen.findByRole('button', { name: 'beta' }))
    await user.click(screen.getByRole('button', { name: 'delta' }))
    expect(screen.getByText(/Escondidas:/)).toHaveTextContent('beta, delta')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(repo.save).toHaveBeenCalledWith('verse', null, expect.objectContaining({ reference: 'João 3:16', blanks: [{ index: 2, answer: 'beta', prev: 'Alfa' }, { index: 4, answer: 'delta', prev: 'gama' }] }))
  })
  it('no Versículo Oculto, limita a 3 palavras e avisa se o texto não carregar', async () => {
    setup([])
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Versículo Oculto' }))
    await user.click(await screen.findByRole('button', { name: 'Novo versículo' }))
    await user.type(screen.getByLabelText('Referência do versículo'), 'João 3:16')
    await user.click(screen.getByRole('button', { name: 'Carregar texto do versículo' }))
    for (const word of ['Alfa', 'beta', 'gama']) await user.click(await screen.findByRole('button', { name: word }))
    expect(screen.getByRole('button', { name: 'delta' })).toBeDisabled()
    await user.clear(screen.getByLabelText('Referência do versículo'))
    await user.type(screen.getByLabelText('Referência do versículo'), 'Salmos 1:1')
    expect(screen.getByText(/Escondidas:/)).toHaveTextContent('nenhuma ainda')
    await user.click(screen.getByRole('button', { name: 'Carregar texto do versículo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o texto')
  })
  it('mostra erro de acesso com opção de repetir', async () => {
    const repo = { list: vi.fn().mockRejectedValueOnce(Error('x')).mockResolvedValue({ game: 'quiz', total: 0, page: 0, size: 20, items: [] }), save: vi.fn(), remove: vi.fn() }
    render(<OwnerContentPanel repo={repo as never} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Acesso exclusivo do proprietário')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Repetir consulta' }))
    expect(await screen.findByText('Nada encontrado.')).toBeVisible()
  })
})
