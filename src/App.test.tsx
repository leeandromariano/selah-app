import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from './lib/supabase'
import App from './App'
import { libraryBoundary, olderPublications } from './test/libraryBoundary'
import { adminBoundary, editorialFixture } from './test/adminBoundary'
import { openMenu, openMenuPanel } from './test/menu'

describe('fluxos locais do Selah', () => {
  it('espera a sessão antes de mostrar navegação ou conteúdo privado', async () => {
    let finish!: (value: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void
    vi.mocked(supabase.auth.getSession).mockReturnValue(new Promise(resolve => { finish = resolve }))
    location.hash = 'minha-jornada'
    render(<App />)
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
    expect(screen.queryByText('Minha Jornada')).not.toBeInTheDocument()
    finish({ data: { session: null }, error: null })
    expect(await screen.findByRole('heading', { name: 'Que bom te ver de novo' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
  })
  it.each([['Pessoa fictícia', 'Bem-vindo, Pessoa fictícia!'], ['', 'Que bom ter você aqui.']])('saúda nome cadastrado ou usa fallback', async (name, greeting) => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader', user_metadata: { name } } } }, error: null } as never)
    libraryBoundary(olderPublications)
    location.hash = 'inicio'
    render(<App />)
    expect(await screen.findByRole('heading', { name: greeting })).toBeVisible()
    await openMenu()
    expect(screen.queryByRole('link', { name: 'Painel administrativo' })).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()
  })
  it('mostra o convite para instalar o app só no fim da página Início', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    libraryBoundary(olderPublications)
    location.hash = 'inicio'
    render(<App />)
    const install = await screen.findByRole('button', { name: 'Instalar app' })
    const main = screen.getByRole('main')
    expect(main.lastElementChild).toContainElement(install)
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Abrir menu' }))
    await userEvent.setup().click(screen.getByRole('link', { name: 'Minha Jornada' }))
    expect(await screen.findByRole('heading', { name: /Minha Jornada/ })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Instalar app' })).not.toBeInTheDocument()
  })
  it('Minhas aberturas fica dentro de Minha Jornada e não é mais item do menu', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    libraryBoundary(olderPublications)
    location.hash = 'minha-jornada'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Minha Jornada' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Minhas aberturas' })).toBeVisible()
    const nav = await openMenu()
    expect(within(nav).queryByRole('link', { name: 'Minhas aberturas' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Ver minhas aberturas e conclusões' })).not.toBeInTheDocument()
  })
  describe('menu hambúrguer', () => {
    async function signedIn() {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
      libraryBoundary(olderPublications)
      location.hash = 'inicio'
      render(<App />)
      await screen.findByRole('heading', { name: /Que bom ter|Bem-vindo/ })
      return screen.getByRole('button', { name: 'Abrir menu' })
    }
    it('começa fechado e lista as páginas do leitor ao abrir', async () => {
      const toggle = await signedIn()
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
      await userEvent.setup().click(toggle)
      const nav = await screen.findByRole('navigation', { name: 'Navegação principal' })
      expect(within(nav).getAllByRole('link').map(l => l.textContent)).toEqual(['Início', 'Devocionais', 'Bíblia', 'Bereia', 'Minha Jornada'])
      expect(screen.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute('aria-expanded', 'true')
    })
    it('fecha com Esc e ao escolher uma página', async () => {
      const user = userEvent.setup()
      await signedIn()
      await openMenu()
      await user.keyboard('{Escape}')
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
      await openMenu()
      await user.click(screen.getByRole('link', { name: 'Bíblia' }))
      expect(location.hash).toBe('#biblia')
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
    })
    it('sem sessão a gaveta traz só marca, aparência e voltar, sem navegação nem avisos de ambiente', async () => {
      vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null })
      location.hash = 'login'
      render(<App />)
      await screen.findByRole('heading', { name: 'Que bom te ver de novo' })
      await openMenuPanel()
      expect(screen.getByRole('group', { name: 'Aparência' })).toBeVisible()
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
      expect(screen.queryByText(/homologação|STAGING|Ambiente local|informações fictícias|Conteúdo e administração no ambiente/i)).not.toBeInTheDocument()
    })
    it('o botão Voltar fecha a gaveta e a barra lateral fixa não existe mais', async () => {
      const user = userEvent.setup()
      await signedIn()
      await openMenu()
      expect(document.querySelector('aside.sidebar')).toBeNull()
      await user.click(screen.getByRole('button', { name: 'Voltar' }))
      expect(screen.queryByRole('navigation', { name: 'Navegação principal' })).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Abrir menu' })).toHaveAttribute('aria-expanded', 'false')
    })
  })
  it('busca publicação anterior por referência sem diferenciar maiúsculas e recupera resultado vazio', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    libraryBoundary(olderPublications)
    window.location.hash = 'historico'
    const user = userEvent.setup()
    render(<App />)
    await user.type(await screen.findByRole('searchbox', { name: /Buscar por/ }), 'JOÃO')
    expect(screen.getByRole('status')).toHaveTextContent('1 devocional encontrado')
    expect(screen.getByRole('heading', { name: 'Paz em meio ao caminho' })).toBeVisible()
    await user.type(screen.getByRole('searchbox'), ' inexistente')
    expect(screen.getByRole('status')).toHaveTextContent('0 devocionais encontrados')
    expect(screen.getByText(/Nenhum devocional encontrado/)).toBeVisible()
    await user.clear(screen.getByRole('searchbox'))
    expect(screen.getByRole('heading', { name: 'O extraordinário no simples' })).toBeVisible()
  })

  it('registra abertura e restaura histórico ao remontar, sem marcar conclusão', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-reader' } } }, error: null } as never)
    const { historyQuery } = libraryBoundary(olderPublications)
    window.location.hash = 'historico'
    const user = userEvent.setup()
    const view = render(<App />)
    await user.click(await screen.findByRole('button', { name: /Paz em meio ao caminho/ }))
    expect(await screen.findByRole('article')).toBeVisible()
    expect(supabase.rpc).not.toHaveBeenCalledWith('complete_devotional',expect.anything())
    expect(historyQuery.insert).toHaveBeenCalledWith({ devotional_id: olderPublications[0].id })
    expect(screen.queryByRole('button', { name: /Marcar como lido/ })).not.toBeInTheDocument()
    view.unmount()
    location.hash = 'minhas-leituras'
    render(<App />)
    // link antigo cai em Minha Jornada, que agora traz o histórico de aberturas
    expect(await screen.findByRole('heading', { name: 'Minha Jornada' })).toBeVisible()
    expect(await screen.findByRole('heading', { name: 'Minhas aberturas' })).toBeVisible()
    expect((await screen.findAllByText(olderPublications[0].title)).length).toBeGreaterThan(0)
    expect(screen.getByText(/Uma abertura não significa leitura concluída/)).toBeVisible()
  })

  it('edita conteúdo administrativo e restaura a resposta persistida ao remontar', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'fictional-admin' } } }, error: null } as never)
    const table = adminBoundary()
    window.location.hash = 'admin'
    const user = userEvent.setup()
    const view = render(<App />)
    await screen.findAllByRole('button', { name: 'Editar' })
    const main = screen.getByRole('main')
    await user.click(within(main).getByRole('button', { name: 'Editar' }))
    expect(screen.getByLabelText('Título')).toHaveValue(editorialFixture.title)
    await user.clear(screen.getByLabelText('Título'))
    await user.type(screen.getByLabelText('Título'), 'Mensagem Revisada')
    await user.click(screen.getByRole('button', { name: 'Salvar devocional' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Rascunho salvo')
    expect(table.update).toHaveBeenCalledWith(expect.objectContaining({ title: 'Mensagem Revisada' }))
    view.unmount()
    render(<App />)
    expect(await screen.findByText('Mensagem Revisada')).toBeVisible()
  })
})
