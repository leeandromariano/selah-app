import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from '../App'
import { supabase } from '../lib/supabase'
import { AuthForm } from './AuthForm'
describe('transparência de consistência', () => {
  it('política pública explica acesso OWNER sem consultar ou exibir ranking', async () => {
    location.hash = 'privacidade'
    render(<App />)
    expect(await screen.findByRole('heading', { name: 'Privacidade no Coram' })).toBeVisible()
    expect(screen.getByText(/O ranking é administrativo, não público/)).toHaveTextContent('PUBLISHER')
    expect(screen.getByText(/O WhatsApp é um dado separado/)).toHaveTextContent('não será reutilizada')
    expect(screen.getByText(/O uso por menores de idade/)).toBeVisible()
    expect(screen.getByRole('heading', { name: 'Cápsula de oração' })).toBeVisible()
    expect(screen.getByText(/Os pedidos de oração e os testemunhos/)).toHaveTextContent('só você os vê')
    expect(screen.getByRole('heading', { name: 'Bereia (jogos e quiz)' })).toBeVisible()
    expect(screen.queryByText(/Página não encontrada/)).not.toBeInTheDocument()
    expect(supabase.rpc).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })
  it('cadastro oferece somente checkbox separado para feedback e não exibe aviso longo', () => {
    render(<AuthForm register />)
    expect(screen.queryByText(/Conclusões geram métricas individuais|O cadastro exige nome|ranking é administrativo/)).not.toBeInTheDocument()
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'Política de privacidade' })).toHaveAttribute('href', '#privacidade')
    expect(screen.getByRole('checkbox')).toHaveAccessibleName(/WhatsApp.*opcional/)
  })
})
