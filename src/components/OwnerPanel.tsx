import { OwnerDashboard } from './OwnerDashboard'

// Painel OWNER em formato de dashboard: a área escolhida muda os indicadores e o detalhamento na mesma tela.
export function OwnerPanel({ page }: { page: string }) {
  return <OwnerDashboard page={page} />
}
