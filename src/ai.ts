import type { Battle, Unit } from './battle.ts'
import { dist } from './board.ts'
import { CARDS, statMult, type CardDef } from './cards.ts'

export interface AiMove {
  handIndex: number
  x: number
  y: number
}

interface Option {
  handIndex: number
  id: string
  card: CardDef
}

export function aiDecision(battle: Battle, rng: () => number): AiMove | null {
  const playable: Option[] = []
  battle.enemyHand.forEach((id, handIndex) => {
    const card = CARDS[id]
    if (!card || card.cost > battle.enemyElixir + 1e-4) return
    playable.push({ handIndex, id, card })
  })
  if (!playable.length) return null

  const threats = battle.units.filter((unit) => unit.alive && unit.side === 'player' && unit.spawn <= 0 && unit.y < 17.25)
  const left = threats.filter((unit) => unit.x < 9)
  const right = threats.filter((unit) => unit.x >= 9)
  const leftScore = threatScore(left)
  const rightScore = threatScore(right)
  const bestScore = Math.max(leftScore, rightScore)
  const defendLane = bestScore < 0.7
    ? null
    : leftScore === rightScore
      ? (rng() < 0.5 ? 'left' : 'right')
      : leftScore > rightScore
        ? 'left'
        : 'right'

  const spell = bestSpell(battle, playable)
  if (spell) return { handIndex: spell.handIndex, x: spell.x, y: spell.y }

  if (defendLane) {
    const group = defendLane === 'left' ? left : right
    const defense = choose(playable, (card) => defensePriority(card, group))
    const placed = defense && place(battle, defense.option, defendLane, 'defend', group, rng)
    if (placed) return placed
  }

  if (battle.enemyElixir >= 6.2 || battle.enemyElixir >= 9.2) {
    const lane = weakerLane(battle, rng)
    const attack = choose(playable, (card) => attackPriority(card, battle, lane))
    if (attack && (attack.priority >= 40 || battle.enemyElixir >= 8.8)) {
      const placed = place(battle, attack.option, lane, 'attack', threats, rng)
      if (placed) return placed
    }
  }

  if (battle.enemyElixir >= 9.5) {
    const dump = [...playable].filter((option) => option.card.kind !== 'spell').sort((a, b) => a.card.cost - b.card.cost)[0]
    if (dump) {
      const lane = weakerLane(battle, rng)
      const placed = place(battle, dump, lane, 'attack', threats, rng)
      if (placed) return placed
    }
  }
  return null
}

function choose(options: Option[], score: (card: CardDef) => number): { option: Option; priority: number } | null {
  let best: { option: Option; priority: number } | null = null
  for (const option of options) {
    const priority = score(option.card)
    if (priority < 0) continue
    if (!best || priority > best.priority) best = { option, priority }
  }
  return best
}

function defensePriority(card: CardDef, threats: Unit[]): number {
  if (card.kind === 'spell' || threats.length === 0) return -1
  const allAir = threats.every((unit) => unit.flying)
  if (allAir && !card.hitsAir) return -1
  const swarm = threats.filter((unit) => unit.maxHp < 240).length >= 3 || threats.length >= 4
  const air = threats.some((unit) => unit.flying)
  const tank = threats.some((unit) => unit.maxHp > 1500)
  let score = 10
  if (air && card.hitsAir) score += 40
  if (swarm && (card.splash > 0 || card.id === 'darts' || card.id === 'spire')) score += 28
  if (tank && ['darts', 'nib', 'squire', 'monk', 'pike', 'moth'].includes(card.id)) score += 18
  if (card.kind === 'building') score += 6
  if (card.cost >= 5 && !tank && threats.length < 2) score -= 12
  return score
}

function attackPriority(card: CardDef, battle: Battle, lane: 'left' | 'right'): number {
  if (card.kind === 'spell') return -1
  const tank = onLane(battle, lane, ['titan', 'tortoise'])
  const siege = onLane(battle, lane, ['pike', 'tortoise'])
  const same = onLane(battle, lane, [card.id])
  if (!tank && (card.id === 'titan' || card.id === 'tortoise')) return 90
  if (!tank && card.id === 'hawk') return 78
  if (tank && !siege && (card.id === 'pike' || card.id === 'hawk')) return 84
  if (tank && ['ranger', 'moth', 'monk', 'lobber', 'darts'].includes(card.id)) return 70 - (same ? 12 : 0)
  if (!tank && card.id === 'pike') return 58
  if (!tank && ['moth', 'ranger', 'monk', 'squire'].includes(card.id)) return 48
  if (card.id === 'den') return 36
  if (card.id === 'darts') return 34
  if (card.id === 'spire') return tank ? 30 : 12
  if (card.id === 'nib') return 8
  return same ? 16 : 24
}

function onLane(battle: Battle, lane: 'left' | 'right', ids: string[]): boolean {
  return battle.units.some((unit) => unit.alive && unit.side === 'enemy' && unit.lane === lane && ids.includes(unit.cardId))
}

function place(
  battle: Battle,
  option: Option,
  lane: 'left' | 'right',
  intent: 'attack' | 'defend',
  threats: Unit[],
  rng: () => number,
): AiMove | null {
  const building = option.card.kind === 'building'
  const bridge = lane === 'left' ? 4.5 : 13.5
  const jitter = (rng() - 0.5) * 0.8
  const spots: { x: number; y: number }[] = []
  if (intent === 'defend' && threats.length) {
    const ax = threats.reduce((sum, unit) => sum + unit.x, 0) / threats.length
    const ay = threats.reduce((sum, unit) => sum + unit.y, 0) / threats.length
    const y = clamp(ay - 1.8, 4.3, building ? 13.2 : 13.6)
    const x = clamp(ax, 1.2, 16.8)
    if (building) {
      spots.push({ x: bridge + (lane === 'left' ? 1.7 : -1.7), y: 9 }, { x: bridge, y: 10.4 }, { x, y: Math.min(12.4, y) })
    } else {
      spots.push({ x, y }, { x: bridge + jitter, y: clamp(y, 8, 13.5) }, { x: clamp(x - 1.1, 1.2, 16.8), y }, { x: clamp(x + 1.1, 1.2, 16.8), y: Math.max(4.4, y - 0.5) })
    }
  } else if (building) {
    spots.push(
      { x: bridge + (lane === 'left' ? 1.7 : -1.7), y: 9.2 },
      { x: bridge + (lane === 'left' ? -1.5 : 1.5), y: 10.6 },
      { x: bridge, y: 11.4 },
    )
  } else {
    const front = option.card.hp > 1700 || option.card.buildingsOnly || option.card.speed < 0.7
    const y = front ? 13.4 : 11.8
    spots.push(
      { x: bridge + jitter, y },
      { x: bridge, y: y - 0.7 },
      { x: clamp(bridge + (lane === 'left' ? 1.3 : -1.3), 1.2, 16.8), y: y - 0.3 },
    )
  }
  for (const spot of spots) {
    const x = clamp(spot.x, 0.9, 17.1)
    const y = clamp(spot.y, 1, building ? 14.05 : 14.65)
    if (battle.canPlace('enemy', option.id, x, y)) return { handIndex: option.handIndex, x, y }
  }
  return null
}

function bestSpell(battle: Battle, options: Option[]): (Option & { x: number; y: number }) | null {
  let best: (Option & { x: number; y: number; value: number }) | null = null
  const foes = battle.units.filter((unit) => unit.alive && unit.side === 'player' && unit.spawn <= 0)
  for (const option of options) {
    if (option.card.kind !== 'spell') continue
    const damage = option.card.spellDamage * statMult(battle.enemyLevel)
    for (const center of foes) {
      let value = 0
      let hits = 0
      let kills = 0
      for (const unit of foes) {
        if (unit.flying && !option.card.spellHitsAir) continue
        if (dist(unit.x, unit.y, center.x, center.y) > option.card.spellRadius + unit.radius * 0.2) continue
        const card = CARDS[unit.cardId]
        if (!card) continue
        value += (card.cost / card.count) * (unit.hp / unit.maxHp)
        hits += 1
        if (unit.hp <= damage) kills += 1
      }
      for (const tower of battle.towers) {
        if (!tower.alive || tower.side !== 'player') continue
        if (dist(tower.x, tower.y, center.x, center.y) > option.card.spellRadius + tower.radius * 0.15) continue
        value += tower.hp <= damage * 1.15 ? 4.5 : 0.15
      }
      const worth = (hits >= 3 && value >= option.card.cost * 0.7)
        || (hits >= 2 && value >= option.card.cost * 0.95)
        || (kills >= 1 && value >= option.card.cost * 0.7)
      if (!worth) continue
      if (!best || value > best.value) best = { ...option, x: center.x, y: center.y, value }
    }
  }
  return best
}

function threatScore(units: Unit[]): number {
  let total = 0
  for (const unit of units) {
    const card = CARDS[unit.cardId]
    if (!card) continue
    const share = card.cost / Math.max(1, card.count)
    const depth = clamp((17.2 - unit.y) / 12, 0, 1.45)
    total += share * (0.4 + 0.6 * (unit.hp / unit.maxHp)) * (0.45 + depth)
  }
  return total
}

function weakerLane(battle: Battle, rng: () => number): 'left' | 'right' {
  const left = battle.towers.find((tower) => tower.side === 'player' && tower.lane === 'left')
  const right = battle.towers.find((tower) => tower.side === 'player' && tower.lane === 'right')
  if (left && !left.alive) return 'left'
  if (right && !right.alive) return 'right'
  if (!left || !right) return rng() < 0.5 ? 'left' : 'right'
  if (Math.abs(left.hp - right.hp) < 90) return rng() < 0.5 ? 'left' : 'right'
  return left.hp <= right.hp ? 'left' : 'right'
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
