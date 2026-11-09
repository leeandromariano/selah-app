import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BibleReader } from './BibleReader'
import { BibleReference } from './BibleReference'
import { demoProvider } from '../bible/provider'
import { reportBibleView } from '../bible/fums'

vi.mock('../bible/fums', () => ({ reportBibleView: vi.fn().mockResolvedValue(undefined) }))

describe('leitor bíblico demonstrativo', () => {
  it('exibe navegação, versículos fictícios, livro e capítulo', async () => {
    render(<BibleReader page="biblia/demonstracao/genesis/1" source={demoProvider} />)
    expect(screen.getByRole('status')).toHaveTextContent('Carregando')
    expect(await screen.findByText(/Texto fictício para demonstrar o primeiro/)).toBeVisible()
    expect(screen.getByRole('heading', { name: /Gênesis 1/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /Capítulo anterior/ })).toBeDisabled()
    expect(screen.queryByRole('option', { name: /Nova Versão Internacional/ })).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Antigo Testamento' }).querySelectorAll('option')).toHaveLength(39)
    expect(screen.getByRole('group', { name: 'Novo Testamento' }).querySelectorAll('option')).toHaveLength(27)
    fireEvent.change(screen.getByLabelText('Livro'), { target: { value: 'salmos' } })
    expect(location.hash).toBe('#biblia/demonstracao/salmos/1')
  })
  it('abre referência direta e livros por grupo sem consulta por tema fictícia', async () => {
    render(<BibleReader page="biblia/demonstracao/genesis/1" source={demoProvider} />)
    await screen.findByText(/Texto fictício para demonstrar o primeiro/)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Ir para uma passagem' }), { target: { value: 'João 3 16' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir passagem' }))
    expect(location.hash).toBe('#biblia/demonstracao/joao/3/16')
    fireEvent.change(screen.getByRole('searchbox', { name: 'Ir para uma passagem' }), { target: { value: 'ansiedade' } })
    fireEvent.click(screen.getByRole('button', { name: 'Abrir passagem' }))
    expect(screen.getByRole('alert')).toHaveTextContent('referência completa')
    expect(location.hash).toBe('#biblia/demonstracao/joao/3/16')
    fireEvent.click(screen.getByText('Explorar livros por categoria'))
    expect(screen.getByRole('button', { name: 'Salmos' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Salmos' }))
    expect(location.hash).toBe('#biblia/demonstracao/salmos/1')
  })
  it('destaca intervalo, sinaliza ausência e trata rota inválida ou versão indisponível', async () => {
    const view = render(<BibleReader page="biblia/demonstracao/joao/3/16-17" source={demoProvider} />)
    await screen.findByText(/navegação por versículo/)
    await waitFor(() => expect(document.getElementById('bible-verse-16')).toHaveClass('highlighted'))
    expect(document.getElementById('bible-verse-17')).toHaveClass('highlighted')
    view.rerender(<BibleReader page="biblia/demonstracao/joao/4/99" source={demoProvider} />)
    expect(await screen.findByText(/Nenhum conteúdo disponível/)).toBeVisible()
    expect(screen.getByText(/versículo solicitado não está disponível/)).toBeVisible()
    view.rerender(<BibleReader page="biblia/nvi/joao/3" />)
    expect(screen.getByRole('alert')).toHaveTextContent('indisponível')
    view.rerender(<BibleReader page="biblia/../../3" />)
    expect(screen.getByRole('alert')).toHaveTextContent('inválido')
  })
  it('oferece apenas traduções reais no seletor local', () => {
    render(<BibleReader page="biblia/nvt/genesis/1" />)
    expect(screen.queryByRole('option', { name: /Conteúdo demonstrativo/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: /Nova Versão Internacional/ })).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Nova Versão Transformadora' })).toBeInTheDocument()
  })
  it('permite selecionar versões disponíveis e recuperar erro do provedor', async () => {
    const chapter = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue([{ number: 1, text: 'Exemplo alternativo' }])
    const source = { translations: [...demoProvider.translations, { ...demoProvider.translations[0], id: 'outro', name: 'Outro exemplo' }], chapter }
    render(<BibleReader page="biblia/demonstracao/genesis/1" source={source} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível')
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    await screen.findByText('Exemplo alternativo')
    fireEvent.change(screen.getByLabelText('Tradução'), { target: { value: 'outro' } })
    expect(location.hash).toBe('#biblia/outro/genesis/1')
  })
  it('referências preservam texto até existir provedor autorizado que valide passagem', async () => {
    const view = render(<BibleReference reference="João 3:16" />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    const source = { ...demoProvider, translations: [{ ...demoProvider.translations[0], licensedText: true }], supportsReference: () => true }
    view.rerender(<BibleReference reference="João 3:16" source={source} />)
    await waitFor(() => expect(screen.getByRole('link')).toHaveAttribute('href', '#biblia/demonstracao/joao/3/16'))
    view.rerender(<BibleReference reference="Jo 3:16" source={source} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
  it('apresenta capítulo autorizado somente após registrar a visualização e mostra a atribuição', async () => {
    const chapterDetails = vi.fn().mockResolvedValue({ verses: [{ number: 1, text: 'Texto bíblico fictício.' }], copyright: 'Atribuição fictícia', fumsToken: 'token-ficticio' })
    const source = { ...demoProvider, translations: [{ ...demoProvider.translations[0], id: 'nvt', name: 'NVT' }], chapterDetails }
    render(<BibleReader page="biblia/nvt/genesis/1" source={source} />)
    expect(await screen.findByText('Texto bíblico fictício.')).toBeVisible()
    expect(screen.getByText('Atribuição fictícia')).toBeVisible()
    expect(reportBibleView).toHaveBeenCalledWith('token-ficticio')
  })
  it('destaca e reconhece referências dentro de versículos agrupados', async () => {
    const chapterDetails = vi.fn().mockResolvedValue({ verses: [{ number: 9, endNumber: 10, text: 'Texto agrupado fictício.' }], copyright: 'Atribuição fictícia', fumsToken: 'token-ficticio' })
    const source = { ...demoProvider, translations: [{ ...demoProvider.translations[0], id: 'ntlh', name: 'NTLH' }], chapterDetails }
    render(<BibleReader page="biblia/ntlh/esdras/1/10" source={source} />)
    expect(await screen.findByText('Texto agrupado fictício.')).toBeVisible()
    expect(document.getElementById('bible-verse-9')).toHaveClass('highlighted')
    expect(screen.queryByText(/versículo solicitado não está disponível/)).not.toBeInTheDocument()
  })
})
