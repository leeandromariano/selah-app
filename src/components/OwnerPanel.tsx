import { CommunityPanel } from './CommunityPanel'
import { ModerationPanel } from './ModerationPanel'
import { Heading } from './UI'
import { PublisherManagement } from './PublisherManagement'

export function OwnerPanel({ page }: { page: string }) {
  return <>
    <Heading eyebrow="CUIDANDO DA COMUNIDADE" title="Painel OWNER" description="Gerencie os devocionais, autores, a comunidade e a moderação." />
    <div className="actions">
      <a className="button secondary" href="#owner/comunidade" aria-current={page === 'owner/comunidade' ? 'page' : undefined}>Comunidade e ofensivas</a>
      <a className="button secondary" href="#owner/moderacao" aria-current={page === 'owner/moderacao' ? 'page' : undefined}>Moderação de reflexões</a>
      <a className="button secondary" href="#admin">Gerenciar devocionais</a>
      <a className="button secondary" href="#owner/publicadores" aria-current={page === 'owner/publicadores' ? 'page' : undefined}>Gerenciar PUBLICADORES</a>
    </div>
    {page === 'owner/comunidade' && <CommunityPanel />}
    {page === 'owner/moderacao' && <ModerationPanel />}
    {page === 'owner/publicadores' && <PublisherManagement />}
  </>
}
