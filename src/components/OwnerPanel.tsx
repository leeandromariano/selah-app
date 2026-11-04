import { CommunityPanel } from './CommunityPanel'
import { ModerationPanel } from './ModerationPanel'
import { Heading } from './UI'

export function OwnerPanel({ page }: { page: string }) {
  return <>
    <Heading eyebrow="CUIDANDO DA COMUNIDADE" title="Painel OWNER" description="Acompanhe a comunidade e modere reflexões." />
    <div className="actions">
      <a className="button secondary" href="#owner/comunidade" aria-current={page === 'owner/comunidade' ? 'page' : undefined}>Comunidade e ofensivas</a>
      <a className="button secondary" href="#owner/moderacao" aria-current={page === 'owner/moderacao' ? 'page' : undefined}>Moderação de reflexões</a>
      <a className="button secondary" href="#admin">Gerenciar devocionais</a>
    </div>
    {page === 'owner/comunidade' && <CommunityPanel />}
    {page === 'owner/moderacao' && <ModerationPanel />}
  </>
}
