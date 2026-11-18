// CORAM // LOGOS: regras que valem para o lobby, a armadura e a partida. O servidor confere custo e prêmio; aqui só se mostra e se aplica.
export const pieceIds = ['cinturao', 'coraca', 'sandalias', 'escudo', 'capacete', 'espada'] as const
export type PieceId = (typeof pieceIds)[number]
export type Armadura = Record<PieceId, number>
export const maxPieceLevel = 5

export type Piece = { id: PieceId; name: string; short: string; role: string; reference: string; description: string; stats: { label: string; base: number; perLevel: number; unit: '%' | 's' | '' }[] }

// Textos próprios; os versículos aparecem só como referência (Efésios 6:14-17), nunca citados de memória.
export const pieces: Record<PieceId, Piece> = {
  cinturao: { id: 'cinturao', name: 'Cinturão da Verdade', short: 'Cinturão', role: 'Vitalidade', reference: 'Efésios 6:14', description: 'A verdade segura o resto da armadura no lugar. Aumenta a vida máxima.', stats: [{ label: 'Vida máxima', base: 100, perLevel: 10, unit: '' }] },
  coraca: { id: 'coraca', name: 'Couraça da Justiça', short: 'Couraça', role: 'Proteção', reference: 'Efésios 6:14', description: 'Protege o coração. Dá pontos de armadura (AP) que absorvem o dano antes da vida.', stats: [{ label: 'Pontos de armadura', base: 20, perLevel: 10, unit: '' }] },
  sandalias: { id: 'sandalias', name: 'Sandálias da Paz', short: 'Sandálias', role: 'Mobilidade', reference: 'Efésios 6:15', description: 'Pés prontos para avançar. Aumenta a velocidade de movimento.', stats: [{ label: 'Velocidade', base: 0, perLevel: 4, unit: '%' }] },
  escudo: { id: 'escudo', name: 'Escudo da Fé', short: 'Escudo', role: 'Defesa', reference: 'Efésios 6:16', description: 'Apaga os dardos inflamados. O Escudo de Vidro dura mais e volta mais rápido.', stats: [{ label: 'Duração do escudo', base: 4, perLevel: 0.5, unit: 's' }, { label: 'Recarga mais rápida', base: 0, perLevel: 6, unit: '%' }] },
  capacete: { id: 'capacete', name: 'Capacete da Salvação', short: 'Capacete', role: 'Consumado', reference: 'Efésios 6:17', description: 'A certeza da vitória. A carga do CONSUMADO (X) enche mais depressa.', stats: [{ label: 'Carga do Consumado', base: 0, perLevel: 10, unit: '%' }] },
  espada: { id: 'espada', name: 'Espada do Espírito', short: 'Espada', role: 'Ataque', reference: 'Efésios 6:17', description: 'A Palavra de Deus. Aumenta o dano dos feixes de luz e a velocidade do Dash.', stats: [{ label: 'Dano', base: 0, perLevel: 10, unit: '%' }, { label: 'Velocidade do dash', base: 0, perLevel: 5, unit: '%' }] },
}

export const emptyArmadura = (): Armadura => ({ cinturao: 1, coraca: 1, sandalias: 1, escudo: 1, capacete: 1, espada: 1 })

// Custo para sair do nível atual para o próximo (o mesmo cálculo do servidor).
export const upgradeCost = (level: number) => (level >= maxPieceLevel ? null : 100 * level)

export const statValue = (piece: Piece, index: number, level: number) => { const s = piece.stats[index]; return s.base + s.perLevel * (level - 1) }

// Efeitos que a engine usa na partida.
export type Perks = { maxHp: number; maxAp: number; speed: number; shieldSeconds: number; shieldCooldown: number; ultCharge: number; damage: number; dashSpeed: number }
export function perksFor(armadura: Armadura): Perks {
  const lv = (id: PieceId) => Math.max(1, Math.min(maxPieceLevel, Math.floor(armadura[id] || 1))) - 1
  return {
    maxHp: 100 + 10 * lv('cinturao'),
    maxAp: 20 + 10 * lv('coraca'),
    speed: 1 + 0.04 * lv('sandalias'),
    shieldSeconds: 4 + 0.5 * lv('escudo'),
    shieldCooldown: 1 - 0.06 * lv('escudo'),
    ultCharge: 1 + 0.1 * lv('capacete'),
    damage: 1 + 0.1 * lv('espada'),
    dashSpeed: 1 + 0.05 * lv('espada'),
  }
}

export const xpPerLevel = 300
export const levelFromXp = (xp: number) => 1 + Math.floor(Math.max(0, xp) / xpPerLevel)
export const rankName = (level: number) => (level >= 40 ? 'Portador da Luz' : level >= 20 ? 'Vigia' : level >= 8 ? 'Sentinela' : 'Aprendiz')
