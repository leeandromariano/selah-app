import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Bars, StackedBars } from './DashboardCharts'

const bars = [{ label: '2026-11-10', value: 0 }, { label: '2026-11-11', value: 13 }, { label: '2026-11-12', value: 5 }]
const days = ['2026-11-10', '2026-11-11', '2026-11-12']

describe('gráficos do dashboard', () => {
  it('mostra o valor da coluna ao passar o mouse e esconde ao sair', async () => {
    render(<Bars data={bars} label="Jogadas por dia" />)
    const user = userEvent.setup()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    await user.hover(screen.getByRole('button', { name: '11/11: 13' }))
    expect(within(screen.getByRole('status')).getByText('13')).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('11/11')
    await user.unhover(screen.getByRole('button', { name: '11/11: 13' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('um toque fixa o valor da coluna e outro toque solta', async () => {
    render(<Bars data={bars} label="Jogadas por dia" />)
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: '12/11: 5' }))
    await user.unhover(screen.getByRole('button', { name: '12/11: 5' }))
    expect(screen.getByRole('status')).toHaveTextContent('5')
    await user.click(screen.getByRole('button', { name: '12/11: 5' }))
    await user.unhover(screen.getByRole('button', { name: '12/11: 5' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
  it('mostra também o valor zero e permite ver pelo teclado', async () => {
    render(<Bars data={bars} label="Jogadas por dia" />)
    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole('status')).toHaveTextContent('10/11')
    expect(screen.getByRole('status')).toHaveTextContent('0')
  })
  it('nas colunas empilhadas, o balão traz cada série e o total do dia', async () => {
    render(<StackedBars label="Atividade por dia" days={days} series={[
      { name: 'Conclusões', color: '#f50', values: [0, 4, 1] }, { name: 'Aberturas', color: '#74f', values: [1, 6, 2] }, { name: 'Jogos', color: '#1b9', values: [0, 3, 0] }]} />)
    const user = userEvent.setup()
    expect(screen.getByRole('group', { name: /Atividade por dia: Conclusões 5, Aberturas 9, Jogos 3/ })).toBeVisible()
    await user.hover(screen.getByRole('button', { name: /11\/11: Conclusões 4, Aberturas 6, Jogos 3/ }))
    const tip = screen.getByRole('status')
    expect(tip).toHaveTextContent('Conclusões4')
    expect(tip).toHaveTextContent('Aberturas6')
    expect(tip).toHaveTextContent('Jogos3')
    expect(tip).toHaveTextContent('Total13')
  })
})
