// CORAM // LOGOS, Modo História: 4 Atos e 16 fases. Os textos de tema são nossos; dos versículos só se guarda a referência.
export type ObjectiveKind = 'kills' | 'survive' | 'beacons' | 'towers' | 'seals' | 'boss'
export type BossId = 'tentador' | 'sentinela' | 'acusador' | 'dragao'
export type Objective = { kind: ObjectiveKind; target: number; label: string }
export type Layout = { beacons?: [number, number][]; towers?: [number, number][]; seals?: [number, number][]; zones?: [number, number][] }
export type Hazards = { storm?: boolean; dark?: boolean; lockUlt?: boolean }
export type Spawn = { rate: number; cap: number; mix: [string, number][] }
export type Difficulty = 'Introdutória' | 'Tática' | 'Elite' | 'Lendária'

export type PhaseDef = {
  id: number; act: 1 | 2 | 3 | 4; index: 1 | 2 | 3 | 4; name: string; difficulty: Difficulty
  objectives: Objective[]; spawn: Spawn; hazards: Hazards; layout: Layout; boss?: BossId
  reference: string; theme: string; brief: string
}
export type Act = { id: 1 | 2 | 3 | 4; name: string; subtitle: string; reference: string; mechanic: string }

export const acts: Act[] = [
  { id: 1, name: 'O Deserto', subtitle: 'Tempestades de areia e os clones do Tentador', reference: 'Mateus 4', mechanic: 'Tempestades de areia reduzem a visão e empurram você. Clones ilusórios somem com um golpe.' },
  { id: 2, name: 'O Vale das Sombras', subtitle: 'Escuridão densa e Faróis de Luz', reference: 'Salmos 23', mechanic: 'A escuridão encobre quase tudo. Acenda os Faróis na ordem certa e use o Pulso para revelar o que se esconde.' },
  { id: 3, name: 'Fortaleza do Acusador', subtitle: 'Torres de dardos e zonas de silêncio', reference: 'Efésios 6', mechanic: 'Torres disparam dardos inflamados (o Escudo reflete). Em zonas de silêncio nenhuma habilidade funciona.' },
  { id: 4, name: 'O Gólgota — Consumado', subtitle: 'Selos, trevas e o Dragão em três fases', reference: 'Colossenses 2', mechanic: 'O CONSUMADO fica selado: quebre os selos para liberá-lo. Só ele encerra a batalha final.' },
]

const obj = (kind: ObjectiveKind, target: number, label: string): Objective => ({ kind, target, label })
const mix = (...pairs: [string, number][]): [string, number][] => pairs

export const phases: PhaseDef[] = [
  // Ato I — O Deserto
  { id: 1, act: 1, index: 1, name: 'A Primeira Tentação', difficulty: 'Introdutória', objectives: [obj('kills', 12, 'Purificar 12 inimigos')], spawn: { rate: 1.8, cap: 8, mix: mix(['sombra', 1]) }, hazards: {}, layout: {}, reference: 'Mateus 4:4', theme: 'A Palavra sustenta quando a fome aperta.', brief: 'Aqueça os movimentos: as primeiras sombras chegam do deserto.' },
  { id: 2, act: 1, index: 2, name: 'Vento de Areia', difficulty: 'Introdutória', objectives: [obj('survive', 60, 'Sobreviver 60 segundos')], spawn: { rate: 2.2, cap: 8, mix: mix(['sombra', 3], ['dardo', 1]) }, hazards: { storm: true }, layout: {}, reference: 'Isaías 43:2', theme: 'Há presença no meio da travessia.', brief: 'Tempestades de areia vêm em ondas. Use o Pulso para enxergar mais longe.' },
  { id: 3, act: 1, index: 3, name: 'Miragens', difficulty: 'Introdutória', objectives: [obj('kills', 15, 'Purificar 15 inimigos')], spawn: { rate: 1.5, cap: 10, mix: mix(['sombra', 3], ['clone', 2], ['fantasma', 1]) }, hazards: { storm: true }, layout: {}, reference: 'Mateus 4:7', theme: 'Não se põe Deus à prova.', brief: 'Nem tudo que se move é real: clones do Tentador somem com um golpe e não contam.' },
  { id: 4, act: 1, index: 4, name: 'O Tentador', difficulty: 'Tática', objectives: [obj('boss', 1, 'Derrotar o Tentador')], spawn: { rate: 4, cap: 5, mix: mix(['sombra', 1]) }, hazards: { storm: true }, layout: {}, boss: 'tentador', reference: 'Mateus 4:10', theme: 'Só a Deus se serve.', brief: 'O Tentador esconde-se atrás de clones. Derrube as miragens e golpeie o verdadeiro.' },
  // Ato II — O Vale das Sombras
  { id: 5, act: 2, index: 1, name: 'O Primeiro Farol', difficulty: 'Tática', objectives: [obj('beacons', 1, 'Acender 1 Farol de Luz')], spawn: { rate: 2.2, cap: 8, mix: mix(['sombra', 2], ['fantasma', 1]) }, hazards: { dark: true }, layout: { beacons: [[1050, 600]] }, reference: 'Salmos 119:105', theme: 'A Palavra é lâmpada para o caminho.', brief: 'Na escuridão, siga o brilho: fique perto do Farol até ele acender.' },
  { id: 6, act: 2, index: 2, name: 'Vale Adentro', difficulty: 'Tática', objectives: [obj('beacons', 2, 'Acender 2 Faróis de Luz')], spawn: { rate: 1.9, cap: 10, mix: mix(['sombra', 2], ['dardo', 1], ['fantasma', 1]) }, hazards: { dark: true }, layout: { beacons: [[800, 330], [1350, 880]] }, reference: 'Salmos 23:1', theme: 'O Pastor conduz.', brief: 'Os Faróis só acendem na ordem: o próximo pulsa mais forte.' },
  { id: 7, act: 2, index: 3, name: 'A Travessia', difficulty: 'Tática', objectives: [obj('beacons', 3, 'Acender 3 Faróis de Luz'), obj('boss', 1, 'Derrotar o Sentinela das Sombras')], spawn: { rate: 2.6, cap: 8, mix: mix(['sombra', 2], ['fantasma', 2]) }, hazards: { dark: true }, layout: { beacons: [[650, 820], [1150, 330], [1700, 620]] }, boss: 'sentinela', reference: 'Salmos 23:4', theme: 'Sem medo, mesmo no vale.', brief: 'O Sentinela só pode ser ferido quando revelado: use o Pulso de Revelação.' },
  { id: 8, act: 2, index: 4, name: 'A Sombra da Morte', difficulty: 'Elite', objectives: [obj('survive', 75, 'Sobreviver 75 segundos'), obj('kills', 20, 'Purificar 20 inimigos')], spawn: { rate: 1.3, cap: 12, mix: mix(['sombra', 2], ['fantasma', 2], ['dardo', 1]) }, hazards: { dark: true }, layout: { beacons: [[1000, 600]] }, reference: 'Salmos 27:1', theme: 'O Senhor é a minha luz.', brief: 'Uma legião inteira cerca o vale. O Farol do centro já está aceso: use-o.' },
  // Ato III — Fortaleza do Acusador
  { id: 9, act: 3, index: 1, name: 'Torres de Dardos', difficulty: 'Elite', objectives: [obj('towers', 2, 'Destruir 2 torres')], spawn: { rate: 3, cap: 6, mix: mix(['sombra', 2], ['dardo', 1]) }, hazards: {}, layout: { towers: [[1000, 300], [1450, 900]] }, reference: 'Efésios 6:16', theme: 'A fé apaga os dardos inflamados.', brief: 'Torres lançam dardos: o Escudo da Fé os devolve contra elas.' },
  { id: 10, act: 3, index: 2, name: 'Zona de Silêncio', difficulty: 'Elite', objectives: [obj('kills', 15, 'Purificar 15 inimigos')], spawn: { rate: 1.6, cap: 10, mix: mix(['sombra', 2], ['dardo', 2], ['brutamontes', 0.2]) }, hazards: {}, layout: { zones: [[900, 400], [1300, 800], [1650, 450]] }, reference: 'Romanos 8:1', theme: 'Nenhuma condenação.', brief: 'Dentro das zonas roxas nenhuma habilidade funciona: lute com os feixes de luz.' },
  { id: 11, act: 3, index: 3, name: 'Muralha de Fogo', difficulty: 'Elite', objectives: [obj('towers', 3, 'Destruir 3 torres')], spawn: { rate: 2.4, cap: 8, mix: mix(['sombra', 2], ['dardo', 1], ['fantasma', 1]) }, hazards: {}, layout: { towers: [[900, 250], [1350, 600], [1000, 950]], zones: [[1150, 420], [1150, 800]] }, reference: 'Isaías 54:17', theme: 'Nenhuma arma forjada prosperará.', brief: 'Torres e zonas de silêncio juntas: escolha bem quando usar suas habilidades.' },
  { id: 12, act: 3, index: 4, name: 'O Acusador', difficulty: 'Lendária', objectives: [obj('boss', 1, 'Derrotar o Acusador')], spawn: { rate: 5, cap: 5, mix: mix(['sombra', 1], ['dardo', 1]) }, hazards: {}, layout: { towers: [[1000, 250]] }, boss: 'acusador', reference: 'Apocalipse 12:10', theme: 'O acusador é lançado fora.', brief: 'O Acusador se protege com armadura e lança zonas de silêncio sobre você. O CONSUMADO quebra a armadura.' },
  // Ato IV — O Gólgota
  { id: 13, act: 4, index: 1, name: 'A Subida', difficulty: 'Lendária', objectives: [obj('survive', 60, 'Sobreviver 60 segundos'), obj('kills', 15, 'Purificar 15 inimigos')], spawn: { rate: 1.2, cap: 12, mix: mix(['sombra', 2], ['dardo', 1], ['fantasma', 1], ['brutamontes', 0.2]) }, hazards: {}, layout: {}, reference: 'Mateus 16:24', theme: 'Seguir é tomar a cruz.', brief: 'O caminho até o monte é cheio de sombras. Aguente firme.' },
  { id: 14, act: 4, index: 2, name: 'Os Selos', difficulty: 'Lendária', objectives: [obj('seals', 3, 'Quebrar 3 selos')], spawn: { rate: 2, cap: 9, mix: mix(['sombra', 2], ['dardo', 1]) }, hazards: { lockUlt: true }, layout: { seals: [[1000, 330], [1300, 800], [700, 800]] }, reference: 'Colossenses 2:15', theme: 'Os principados foram expostos.', brief: 'O CONSUMADO está selado. Quebre os 3 selos com os feixes de luz para liberá-lo.' },
  { id: 15, act: 4, index: 3, name: 'Trevas ao Meio-Dia', difficulty: 'Lendária', objectives: [obj('survive', 60, 'Sobreviver 60 segundos'), obj('kills', 25, 'Purificar 25 inimigos')], spawn: { rate: 1, cap: 14, mix: mix(['sombra', 2], ['fantasma', 2], ['dardo', 1], ['brutamontes', 0.3]) }, hazards: { dark: true }, layout: { beacons: [[1000, 600]] }, reference: 'Romanos 8:37', theme: 'Mais que vencedores.', brief: 'A escuridão cai de novo. Fique perto do Farol e resista.' },
  { id: 16, act: 4, index: 4, name: 'Consumado', difficulty: 'Lendária', objectives: [obj('boss', 1, 'Derrotar o Dragão')], spawn: { rate: 4, cap: 6, mix: mix(['sombra', 1], ['dardo', 1]) }, hazards: {}, layout: { seals: [[1000, 330], [1300, 800], [700, 800]] }, boss: 'dragao', reference: 'João 19:30', theme: 'Está consumado.', brief: 'O Dragão tem três fases. Quebre os selos e finalize com o CONSUMADO.' },
]

export const phaseById = (id: number) => phases.find(p => p.id === id)
export const isBossPhase = (p: PhaseDef) => p.id === 4 || p.id === 7 || p.id === 12 || p.id === 16
// Mesma conta do servidor: vitória rende 100 + 10 por fase (+100 nas de chefe); repetir rende 30%.
export function rewardFor(p: PhaseDef, repeat = false) {
  const sparks = 100 + 10 * (p.id - 1) + (isBossPhase(p) ? 100 : 0), xp = 60 + 10 * p.id
  return repeat ? { sparks: Math.floor((sparks * 3) / 10), xp: Math.floor((xp * 3) / 10) } : { sparks, xp }
}
export const nextPhase = (cleared: number[]) => phases.find(p => !cleared.includes(p.id))
export const isUnlocked = (p: PhaseDef, cleared: number[]) => p.id === 1 || cleared.includes(p.id - 1)
