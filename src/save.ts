import { CARD_LIST, DEFAULT_DECK, MAX_LEVEL, isCardId } from './cards.ts'

export interface SaveData {
  relics: number
  wins: number
  losses: number
  draws: number
  deck: string[]
  levels: Record<string, number>
  keepLevel: number
  mute: boolean
  seenTip: boolean
}

const KEY = 'amberkeep-save-v1'

export function defaultSave(): SaveData {
  return {
    relics: 90,
    wins: 0,
    losses: 0,
    draws: 0,
    deck: [...DEFAULT_DECK],
    levels: Object.fromEntries(CARD_LIST.map((card) => [card.id, 1])),
    keepLevel: 1,
    mute: false,
    seenTip: false,
  }
}

function clampLevel(value: unknown): number {
  const number = typeof value === 'number' ? Math.round(value) : 1
  return Math.min(MAX_LEVEL, Math.max(1, Number.isFinite(number) ? number : 1))
}

function whole(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0
}

export function loadSave(): SaveData {
  const base = defaultSave()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<SaveData>
    if (!parsed || typeof parsed !== 'object') return base
    const levels = { ...base.levels }
    if (parsed.levels && typeof parsed.levels === 'object') {
      for (const card of CARD_LIST) levels[card.id] = clampLevel(parsed.levels[card.id])
    }
    let deck = base.deck
    if (Array.isArray(parsed.deck)) {
      const unique: string[] = []
      for (const id of parsed.deck) {
        if (typeof id === 'string' && isCardId(id) && !unique.includes(id)) unique.push(id)
      }
      if (unique.length === 8) deck = unique
    }
    return {
      relics: typeof parsed.relics === 'number' && parsed.relics >= 0 ? Math.floor(parsed.relics) : base.relics,
      wins: whole(parsed.wins),
      losses: whole(parsed.losses),
      draws: whole(parsed.draws),
      deck,
      levels,
      keepLevel: clampLevel(parsed.keepLevel ?? 1),
      mute: parsed.mute === true,
      seenTip: parsed.seenTip === true,
    }
  } catch {
    return base
  }
}

export function saveSave(data: SaveData) {
  localStorage.setItem(KEY, JSON.stringify(data))
}

export function rewardFor(winner: 'player' | 'enemy' | 'draw', crowns: number): number {
  if (winner === 'draw') return 22
  if (winner === 'player') return 40 + 12 * Math.max(0, crowns)
  return 16
}

export function aiLevelForWins(wins: number): number {
  return Math.min(MAX_LEVEL, 1 + Math.floor(wins / 2))
}
