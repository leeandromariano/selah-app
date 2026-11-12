export type Mode = 'geral' | 'leitores' | 'bereia' | 'reflexoes' | 'conteudo'
export const modes: { id: Mode; label: string; route: string; hint: string }[] = [
  { id: 'geral', label: 'Visão geral', route: 'owner', hint: 'Tudo num só lugar' },
  { id: 'leitores', label: 'Leitores', route: 'owner/comunidade', hint: 'Crescimento e constância' },
  { id: 'bereia', label: 'Bereia', route: 'owner/bereia', hint: 'Quiz e jogos' },
  { id: 'reflexoes', label: 'Reflexões', route: 'owner/moderacao', hint: 'Moderação' },
  { id: 'conteudo', label: 'Conteúdo', route: 'owner/perguntas', hint: 'Perguntas e devocionais' },
]
export function modeForPage(page: string): Mode {
  if (page === 'owner/comunidade') return 'leitores'
  if (page === 'owner/bereia') return 'bereia'
  if (page === 'owner/moderacao') return 'reflexoes'
  if (page === 'owner/perguntas' || page === 'owner/publicadores') return 'conteudo'
  return 'geral'
}
