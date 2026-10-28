import type { SupabaseClient } from '@supabase/supabase-js'
export type CommentState = 'pending' | 'approved' | 'rejected' | 'hidden' | 'removed'
export type OwnComment = { id: string; body: string; state: CommentState; version: number }
export type Reflection = { id: string; body: string; username: string; day: string; own: boolean; reported: boolean }
export type Discussion = { reaction: 'like' | 'dislike' | null; own: OwnComment | null; comments: Reflection[]; page: number; total: number }
export type Queue = 'pending' | 'reports' | 'history'
export type ModerationItem = { id: string; body: string; state: CommentState; version: number; username: string | null; day: string; title: string; available: boolean; reports: { reason: string; day: string }[] }
export type AuditItem = { id: number; action: string; reason: string | null; version: number; day: string; actor: string | null; title: string }
export type Moderation = { queue: Queue; page: number; total: number; items: (ModerationItem | AuditItem)[] }
export const stateLabels: Record<CommentState, string> = { pending: 'Pendente de moderação', approved: 'Aprovado', rejected: 'Rejeitado', hidden: 'Oculto', removed: 'Removido' }
export const reasonLabels = { contact: 'Dados de contato', harassment: 'Assédio', threat: 'Ameaça', exposure: 'Exposição pessoal', spam: 'Spam', other: 'Outro problema' }
export const auditLabels: Record<string, string> = { submit: 'Enviada para moderação', approve: 'Aprovada', reject: 'Rejeitada', hide: 'Oculta', remove: 'Removida' }
export function discussionMessage(error: unknown) {
  const code = (error as { code?: string })?.code
  if (code === 'P0429') return 'Aguarde antes de enviar novamente. Há um limite para proteger a comunidade.'
  if (code === '40001') return 'Esta reflexão mudou. Atualize a seção antes de tentar novamente; seu texto foi preservado.'
  if (code === '42501') return 'Sua sessão não autoriza esta ação ou o conteúdo não está disponível.'
  if (code === '22023') return 'Confira o texto (1 a 1000 caracteres) e os dados da ação.'
  return 'Não foi possível confirmar a operação. Atualize a seção para verificar o resultado antes de repetir.'
}
export function createDiscussionRepository(client: Pick<SupabaseClient, 'rpc'>) {
  async function call(name: string, args: Record<string, unknown> = {}) {
    const { data, error } = await client.rpc(name, args).abortSignal(AbortSignal.timeout(12000))
    if (error) throw error
    return data
  }
  return {
    async read(id: string, page = 0): Promise<Discussion> {
      const data = await call('get_devotional_discussion', { p_devotional: id, p_page: page }) as Discussion
      if (!data || !Array.isArray(data.comments) || !Number.isSafeInteger(data.total) || data.total < 0 || data.page !== page
        || ![null, 'like', 'dislike'].includes(data.reaction) || (data.own && !Object.hasOwn(stateLabels, data.own.state))) throw Error('Invalid discussion response')
      return data
    },
    async react(id: string, value: Discussion['reaction']) { await call('set_my_devotional_reaction', { p_devotional: id, p_value: value }) },
    async save(id: string, body: string, version: number) { await call('save_my_devotional_comment', { p_devotional: id, p_body: body, p_version: version }) },
    async remove(id: string, version: number) { await call('remove_my_devotional_comment', { p_devotional: id, p_version: version }) },
    async report(id: string, reason: string) { await call('report_devotional_comment', { p_comment: id, p_reason: reason }) },
    async ownerAccess() { return await call('get_my_discussion_access') === true },
    async queue(queue: Queue, page: number): Promise<Moderation> {
      const data = await call('get_owner_discussion', { p_queue: queue, p_page: page }) as Moderation
      if (!data || data.queue !== queue || data.page !== page || !Array.isArray(data.items) || !Number.isSafeInteger(data.total) || data.total < 0) throw Error('Invalid moderation response')
      return data
    },
    async moderate(id: string, version: number, action: string, reason: string) { await call('moderate_devotional_comment', { p_comment: id, p_version: version, p_action: action, p_reason: reason }) },
  }
}
