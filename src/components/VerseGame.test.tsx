import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VerseGame } from './VerseGame'
import type { VerseState } from '../verse/repository'

// Texto fictício, só para testar a mecânica (não é texto bíblico). A referência real é só um endereço.
const chapter = { verses: [{ number: 16, text: 'Alfa beta gama delta épsilon zeta.' }], copyright: 'Texto fictício de teste.', fumsToken: 'token' }
const blanks = [{ index: 2, length: 4, prev: 'alfa' }, { index: 5, length: 7, prev: 'delta' }]
const base: VerseState = { number: 5, reference: 'João 3:16', max_attempts: 4, blanks, attempts: [], finished: false, solved: false, streak: 0, answers: null }
function setup(initial: VerseState = base, guess = vi.fn()) {
  const repository = { today: vi.fn().mockResolvedValue(initial), guess } as never
  const load = vi.fn().mockResolvedValue(chapter), report = vi.fn().mockResolvedValue(undefined)
  render(<VerseGame repository={repository} load={load} report={report} />)
  return { load, report, guess }
}

describe('Versículo Oculto', () => {
  it('mostra o versículo com as palavras escondidas e busca o texto em ARA', async () => {
    const { load, report } = setup()
    expect(await screen.findByLabelText('Palavra escondida 1, 4 letras')).toBeVisible()
    expect(screen.queryByText('beta')).not.toBeInTheDocument()
    expect(screen.getByText(/Livro: João/)).toBeVisible()
    expect(load).toHaveBeenCalledWith({ translation: 'ara', book: 'joao', chapter: 3 })
    expect(report).toHaveBeenCalledWith('token')
  })
  it('marca as palavras certas, mantém as erradas escondidas e mostra a grade', async () => {
    const guess = vi.fn().mockResolvedValue({ ...base, attempts: [{ results: [true, false] }], results: [true, false] })
    setup(base, guess)
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Palavra 1/), 'beta')
    await user.type(screen.getByLabelText(/Palavra 2/), 'errada')
    await user.click(screen.getByRole('button', { name: /Tentar \(1 de 4\)/ }))
    expect(guess).toHaveBeenCalledWith(['beta', 'errada'])
    expect(await screen.findByText('beta')).toBeVisible()
    expect(screen.getByLabelText('Palavra escondida 2, 7 letras')).toBeVisible()
    expect(screen.getByRole('list', { name: 'Suas tentativas' })).toHaveTextContent('🟧⬛')
    expect(screen.queryByLabelText(/Palavra 1/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Tentar \(2 de 4\)/ })).toBeVisible()
  })
  it('exige todas as palavras antes de enviar', async () => {
    const { guess } = setup()
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText(/Palavra 1/), 'beta')
    await user.click(screen.getByRole('button', { name: /Tentar/ }))
    expect(guess).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('Preencha todas as palavras')
  })
  it('ao terminar, revela o texto, a referência e a grade para compartilhar sem spoiler', async () => {
    setup({ ...base, finished: true, solved: true, streak: 2, attempts: [{ results: [true, false] }, { results: [true, true] }], answers: ['beta', 'épsilon'] })
    expect(await screen.findByText(/Você acertou em 2 tentativas/)).toBeVisible()
    expect(screen.getByText('beta')).toBeVisible()
    expect(screen.getByRole('link', { name: 'João 3:16' })).toBeVisible()
    expect(screen.getByText(/2 dias seguidos/)).toBeVisible()
    const share = screen.getByLabelText('Resultado para compartilhar')
    expect(share).toHaveTextContent('Versículo Oculto #5 2/4')
    expect(share).toHaveTextContent('🟧⬛')
    expect(share).not.toHaveTextContent('beta')
    expect(share).not.toHaveTextContent('João')
  })
  it('copia o resultado quando o aparelho não tem compartilhamento nativo', async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    setup({ ...base, finished: true, solved: false, attempts: Array(4).fill({ results: [false, false] }), answers: ['beta', 'épsilon'] })
    await user.click(await screen.findByRole('button', { name: 'Compartilhar resultado' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#5 X/4')))
    expect(await screen.findByText(/Resultado copiado/)).toBeVisible()
  })
  it('mostra erro e permite tentar de novo quando o texto bíblico não carrega', async () => {
    const repository = { today: vi.fn().mockResolvedValue(base), guess: vi.fn() } as never
    const load = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(chapter)
    render(<VerseGame repository={repository} load={load} report={vi.fn().mockResolvedValue(undefined)} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o versículo de hoje')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByLabelText('Palavra escondida 1, 4 letras')).toBeVisible()
  })
  it('recusa o desafio quando o texto não bate com as palavras escondidas', async () => {
    const repository = { today: vi.fn().mockResolvedValue({ ...base, blanks: [{ index: 2, length: 12, prev: 'alfa' }, blanks[1]] }), guess: vi.fn() } as never
    render(<VerseGame repository={repository} load={vi.fn().mockResolvedValue(chapter)} report={vi.fn().mockResolvedValue(undefined)} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o versículo de hoje')
  })
})
