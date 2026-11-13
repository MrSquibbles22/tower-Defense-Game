import { aiDecision } from './ai.ts'
import {
  ARENA_H,
  ARENA_W,
  BRIDGES,
  BRIDGE_HALF,
  RIVER_BOT,
  RIVER_TOP,
  TOWERS,
  clampArena,
  crossesWater,
  dist,
  inWater,
  laneOf,
} from './board.ts'
import { CARDS, DEFAULT_DECK, statMult, towerStats, type CardDef } from './cards.ts'

export type Side = 'player' | 'enemy'
export type Lane = 'left' | 'right'

export interface Unit {
  id: number
  side: Side
  cardId: string
  kind: 'troop' | 'building'
  x: number
  y: number
  hp: number
  maxHp: number
  damage: number
  hitSpeed: number
  speed: number
  range: number
  sight: number
  hitsAir: boolean
  hitsGround: boolean
  buildingsOnly: boolean
  flying: boolean
  fords: boolean
  splash: number
  radius: number
  attackCd: number
  attackAnim: number
  spawn: number
  alive: boolean
  lane: Lane
  bridge: number | null
  crossing: boolean
  faceY: number
  lifetime: number
  age: number
  spawnEvery: number
  spawnLeft: number
  summonId: string
  summonCount: number
  color: string
  shot: string
  arc: number
  hitFlash: number
  targetId: number | null
  mass: number
}

export interface Tower {
  id: number
  side: Side
  role: 'king' | 'princess'
  lane: Lane | 'center'
  x: number
  y: number
  hp: number
  maxHp: number
  damage: number
  hitSpeed: number
  range: number
  radius: number
  attackCd: number
  attackAnim: number
  alive: boolean
  awake: boolean
  hitFlash: number
  pendingText: number
  textCd: number
  targetId: number | null
}

export interface Projectile {
  id: number
  side: Side
  x: number
  y: number
  sx: number
  sy: number
  tx: number
  ty: number
  targetId: number | null
  speed: number
  damage: number
  splash: number
  hitsAir: boolean
  hitsGround: boolean
  color: string
  arc: number
  alive: boolean
}

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  color: string
  size: number
  grav: number
}

export interface Ring {
  x: number
  y: number
  life: number
  max: number
  radius: number
  color: string
}

export interface FloatText {
  x: number
  y: number
  text: string
  life: number
  max: number
  color: string
  big: boolean
}

export interface Slash {
  x: number
  y: number
  life: number
  max: number
  face: number
  color: string
}

export interface GameEvent {
  type: 'deploy' | 'crown' | 'wake' | 'horn' | 'overtime' | 'end' | 'spell'
  side?: Side
  cardId?: string
  text?: string
}

export interface BattleOptions {
  playerDeck: string[]
  enemyDeck: string[]
  playerLevels: Record<string, number>
  enemyLevel: number
  playerTowerLevel: number
  rivalName: string
  rng?: () => number
}

const FORMATIONS = [
  [{ x: 0, y: 0 }],
  [
    { x: -0.28, y: 0.08 },
    { x: 0.28, y: -0.06 },
  ],
  [
    { x: 0, y: -0.22 },
    { x: -0.34, y: 0.18 },
    { x: 0.34, y: 0.16 },
  ],
]

function fillDeck(deck: string[]): string[] {
  const clean = deck.filter((id) => CARDS[id])
  const source = clean.length > 0 ? clean : DEFAULT_DECK
  const filled: string[] = []
  while (filled.length < 8) filled.push(source[filled.length % source.length]!)
  return filled
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = items.slice()
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = copy[i]!
    copy[i] = copy[j]!
    copy[j] = swap
  }
  return copy
}

export class Battle {
  time = 0
  phase: 'regulation' | 'overtime' = 'regulation'
  warmup = 1.05
  winner: Side | 'draw' | null = null
  crowns = { player: 0, enemy: 0 }
  playerElixir = 5
  enemyElixir = 5
  playerHand: string[]
  playerQueue: string[]
  enemyHand: string[]
  enemyQueue: string[]
  units: Unit[] = []
  towers: Tower[] = []
  projectiles: Projectile[] = []
  particles: Particle[] = []
  rings: Ring[] = []
  texts: FloatText[] = []
  slashes: Slash[] = []
  events: GameEvent[] = []
  shake = 0
  finishTimer = 0
  rivalName: string
  playerLevels: Record<string, number>
  enemyLevel: number
  aiThink = 2.8
  aiEnabled = true
  plays = { player: 0, enemy: 0 }
  reason: 'king' | 'crowns' | 'overtime' | 'tiebreak' | 'draw' | 'forfeit' | null = null
  private nextId = 1
  private rng: () => number

  constructor(options: BattleOptions) {
    this.rng = options.rng ?? Math.random
    this.rivalName = options.rivalName
    this.playerLevels = options.playerLevels
    this.enemyLevel = options.enemyLevel
    const player = shuffle(fillDeck(options.playerDeck), this.rng)
    const enemy = shuffle(fillDeck(options.enemyDeck), this.rng)
    this.playerHand = player.slice(0, 4)
    this.playerQueue = player.slice(4)
    this.enemyHand = enemy.slice(0, 4)
    this.enemyQueue = enemy.slice(4)
    this.addTower('player', 'king', 'center', options.playerTowerLevel)
    this.addTower('player', 'princess', 'left', options.playerTowerLevel)
    this.addTower('player', 'princess', 'right', options.playerTowerLevel)
    this.addTower('enemy', 'king', 'center', options.enemyLevel)
    this.addTower('enemy', 'princess', 'left', options.enemyLevel)
    this.addTower('enemy', 'princess', 'right', options.enemyLevel)
  }

  private addTower(side: Side, role: 'king' | 'princess', lane: Lane | 'center', level: number) {
    const spot = TOWERS[side][lane === 'center' ? 'king' : lane]
    const stats = towerStats(level, role)
    this.towers.push({
      id: this.nextId++,
      side,
      role,
      lane,
      x: spot.x,
      y: spot.y,
      hp: stats.hp,
      maxHp: stats.hp,
      damage: stats.damage,
      hitSpeed: stats.hitSpeed,
      range: stats.range,
      radius: stats.radius,
      attackCd: stats.hitSpeed * 0.4,
      attackAnim: 0,
      alive: true,
      awake: role === 'princess',
      hitFlash: 0,
      pendingText: 0,
      textCd: 0,
      targetId: null,
    })
  }

  update(dt: number) {
    let left = Math.max(0, Math.min(0.5, dt))
    while (left > 0.0001) {
      const step = Math.min(0.05, left)
      this.step(step)
      left -= step
    }
  }

  private step(step: number) {
    this.updateFx(step)
    this.shake = Math.max(0, this.shake - step * 1.7)
    if (this.winner) {
      this.finishTimer = Math.max(0, this.finishTimer - step)
      return
    }
    if (this.warmup > 0) {
      this.warmup -= step
      if (this.warmup <= 0) this.pushEvent({ type: 'horn' })
      return
    }

    this.time += step
    this.regen(step)
    this.aiThink -= step
    if (this.aiEnabled && this.aiThink <= 0) {
      this.aiThink = 0.48 + this.rng() * 0.32
      const move = aiDecision(this, this.rng)
      if (move) this.play('enemy', move.handIndex, move.x, move.y)
    }

    const unitCount = this.units.length
    for (let i = 0; i < unitCount; i++) this.updateUnit(this.units[i]!, step)
    for (const tower of this.towers) this.updateTower(tower, step)
    const shotCount = this.projectiles.length
    for (let i = 0; i < shotCount; i++) this.updateProjectile(this.projectiles[i]!, step)
    this.separate()
    this.rescueFromWater()
    this.cleanup()
    this.checkClock()
  }

  private regen(step: number) {
    const rate = this.phase === 'overtime' ? 1 / 1.4 : 1 / 2.8
    this.playerElixir = Math.min(10, this.playerElixir + rate * step)
    this.enemyElixir = Math.min(10, this.enemyElixir + rate * step)
  }

  private updateFx(step: number) {
    for (const particle of this.particles) {
      particle.life -= step
      particle.x += particle.vx * step
      particle.y += particle.vy * step
      particle.vy += particle.grav * step
    }
    this.particles = this.particles.filter((particle) => particle.life > 0)
    if (this.particles.length > 260) this.particles.splice(0, this.particles.length - 260)
    for (const ring of this.rings) ring.life -= step
    this.rings = this.rings.filter((ring) => ring.life > 0)
    for (const text of this.texts) text.life -= step
    this.texts = this.texts.filter((text) => text.life > 0).slice(-24)
    for (const slash of this.slashes) slash.life -= step
    this.slashes = this.slashes.filter((slash) => slash.life > 0)
  }

  canPlace(side: Side, cardId: string, x: number, y: number): boolean {
    const card = CARDS[cardId]
    if (!card) return false
    if (x < 0.55 || x > ARENA_W - 0.55 || y < 0.45 || y > ARENA_H - 0.45) return false
    if (card.kind === 'spell') return true
    const building = card.kind === 'building'
    const onSide = side === 'player'
      ? y >= (building ? 17.75 : 17.2) && y <= 31.15
      : y <= (building ? 14.25 : 14.8) && y >= 0.85
    if (!onSide || inWater(x, y)) return false
    const body = card.radius || 0.4
    for (const tower of this.towers) {
      if (!tower.alive || tower.side !== side) continue
      if (dist(x, y, tower.x, tower.y) < tower.radius + body * 0.45 + 0.18) return false
    }
    for (const unit of this.units) {
      if (!unit.alive || unit.kind !== 'building' || unit.side !== side) continue
      if (dist(x, y, unit.x, unit.y) < unit.radius + body + 0.12) return false
    }
    return true
  }

  play(side: Side, handIndex: number, x: number, y: number): boolean {
    if (this.winner || this.warmup > 0) return false
    const hand = side === 'player' ? this.playerHand : this.enemyHand
    const queue = side === 'player' ? this.playerQueue : this.enemyQueue
    const cardId = hand[handIndex]
    if (!cardId) return false
    const card = CARDS[cardId]
    if (!card) return false
    const elixir = side === 'player' ? this.playerElixir : this.enemyElixir
    if (card.cost > elixir + 1e-4) return false
    if (!this.canPlace(side, cardId, x, y)) return false
    if (side === 'player') this.playerElixir -= card.cost
    else this.enemyElixir -= card.cost
    const played = hand[handIndex]!
    hand[handIndex] = queue.shift()!
    queue.push(played)
    const level = side === 'player' ? this.playerLevels[cardId] ?? 1 : this.enemyLevel
    this.summonCard(side, card, x, y, level, true)
    this.plays[side] += 1
    this.pushEvent({ type: card.kind === 'spell' ? 'spell' : 'deploy', side, cardId })
    return true
  }

  forceSummon(side: Side, cardId: string, x: number, y: number): Unit | null {
    const card = CARDS[cardId]
    if (!card || card.kind === 'spell') return null
    const level = side === 'player' ? this.playerLevels[cardId] ?? 1 : this.enemyLevel
    return this.makeUnit(side, card, x, y, level, 0)
  }

  hurt(id: number, amount: number, source: Side) {
    const target = this.entity(id)
    if (target) this.inflict(target, amount, source)
  }

  forfeit() {
    if (this.winner) return
    this.winner = 'enemy'
    this.reason = 'forfeit'
    this.finishTimer = 0.35
    this.pushEvent({ type: 'end', side: 'enemy' })
  }

  private summonCard(side: Side, card: CardDef, x: number, y: number, level: number, fromHand: boolean) {
    if (card.kind === 'spell') {
      this.castSpell(side, card, x, y, level)
      return
    }
    const formation = FORMATIONS[Math.min(card.count, 3) - 1] ?? FORMATIONS[0]!
    const count = Math.max(1, card.count)
    for (let i = 0; i < count; i++) {
      const offset = formation[i] ?? { x: 0, y: 0 }
      const spot = clampArena(x + offset.x, y + offset.y)
      this.makeUnit(side, card, spot.x, spot.y, level, fromHand ? 0.42 : 0.2)
    }
  }

  private makeUnit(side: Side, card: CardDef, x: number, y: number, level: number, spawn: number): Unit {
    const mult = statMult(level)
    const nudged = this.nudgeOntoLand(side, card, x, y)
    const unit: Unit = {
      id: this.nextId++,
      side,
      cardId: card.id,
      kind: card.kind === 'building' ? 'building' : 'troop',
      x: nudged.x,
      y: nudged.y,
      hp: card.hp * mult,
      maxHp: card.hp * mult,
      damage: card.damage * mult,
      hitSpeed: card.hitSpeed,
      speed: card.speed,
      range: card.range,
      sight: card.sight,
      hitsAir: card.hitsAir,
      hitsGround: card.hitsGround,
      buildingsOnly: card.buildingsOnly,
      flying: card.flying,
      fords: card.fords,
      splash: card.splash,
      radius: card.radius,
      attackCd: card.hitSpeed * 0.45,
      attackAnim: 0,
      spawn,
      alive: true,
      lane: laneOf(x),
      bridge: null,
      crossing: false,
      faceY: side === 'player' ? -1 : 1,
      lifetime: card.lifetime,
      age: 0,
      spawnEvery: card.spawnEvery,
      spawnLeft: card.spawnEvery > 0 ? card.spawnEvery * 0.65 : 0,
      summonId: card.summonId,
      summonCount: card.summonCount,
      color: card.accent,
      shot: card.shot,
      arc: card.arc,
      hitFlash: 0,
      targetId: null,
      mass: Math.max(0.45, card.radius * 3.2),
    }
    this.units.push(unit)
    this.burst(unit.x, unit.y, unit.color, 6, 0.7, 0.28)
    return unit
  }

  private nudgeOntoLand(side: Side, card: CardDef, x: number, y: number): { x: number; y: number } {
    let spot = clampArena(x, y)
    if (card.flying || card.fords || card.kind === 'spell') return spot
    if (!inWater(spot.x, spot.y)) return spot
    spot = {
      x: spot.x,
      y: side === 'player' ? RIVER_BOT + 0.35 : RIVER_TOP - 0.35,
    }
    return clampArena(spot.x, spot.y)
  }

  private castSpell(side: Side, card: CardDef, x: number, y: number, level: number) {
    const amount = card.spellDamage * statMult(level)
    this.rings.push({
      x,
      y,
      life: 0.45,
      max: 0.45,
      radius: card.spellRadius,
      color: card.accent,
    })
    this.texts.push({
      x,
      y: y - 0.3,
      text: String(Math.round(amount)),
      life: 0.8,
      max: 0.8,
      color: side === 'player' ? '#ffe7a3' : '#e6dcff',
      big: false,
    })
    this.burst(x, y, card.accent, 18, 1.6, 0.4)
    this.shake = Math.max(this.shake, 0.18)
    for (const unit of this.units) this.spellHit(side, unit, x, y, card, amount)
    for (const tower of this.towers) this.spellHit(side, tower, x, y, card, amount)
  }

  private spellHit(side: Side, target: Unit | Tower, x: number, y: number, card: CardDef, amount: number) {
    if (!target.alive || target.side === side) return
    const flying = 'flying' in target && target.flying
    if (flying && !card.spellHitsAir) return
    if (!flying && !card.spellHitsAir && !card.hitsGround && card.kind === 'spell') return
    if (dist(target.x, target.y, x, y) <= card.spellRadius + target.radius * 0.2) {
      this.inflict(target, amount, side)
    }
  }

  private updateUnit(unit: Unit, step: number) {
    if (!unit.alive) return
    unit.age += step
    unit.hitFlash = Math.max(0, unit.hitFlash - step)
    unit.attackAnim = Math.max(0, unit.attackAnim - step)
    if (unit.lifetime > 0 && unit.age >= unit.lifetime) {
      unit.alive = false
      this.burst(unit.x, unit.y, unit.color, 8, 0.8, 0.35)
      return
    }
    if (unit.spawn > 0) {
      unit.spawn -= step
      return
    }
    if (unit.spawnEvery > 0) {
      unit.spawnLeft -= step
      if (unit.spawnLeft <= 0) {
        unit.spawnLeft = unit.spawnEvery
        this.spawnFrom(unit)
      }
    }
    if (unit.speed <= 0) {
      this.attackStationary(unit, step)
      return
    }

    let target = this.resolveTarget(unit)
    const objective = this.objective(unit)
    if (!target && objective && this.inReach(unit, objective)) target = objective
    if (target) unit.targetId = target.id
    else unit.targetId = null

    const goal = target ?? objective
    if (target && this.inReach(unit, target)) {
      unit.faceY = target.y < unit.y ? -1 : 1
      this.tryAttack(unit, target, step)
      return
    }
    if (!goal) return
    unit.faceY = goal.y < unit.y ? -1 : 1
    const waypoint = this.waypoint(unit, goal.x, goal.y)
    this.stepToward(unit, waypoint.x, waypoint.y, step)
  }

  private spawnFrom(den: Unit) {
    const card = CARDS[den.summonId]
    if (!card) return
    const friendly = this.units.filter((unit) => unit.alive && unit.side === den.side).length
    if (friendly >= 28) return
    const level = den.side === 'player' ? this.playerLevels[card.id] ?? 1 : this.enemyLevel
    const forward = den.side === 'player' ? -0.55 : 0.55
    const spot = clampArena(den.x + (this.rng() - 0.5) * 0.4, den.y + forward)
    this.makeUnit(den.side, card, spot.x, spot.y, level, 0.15)
  }

  private attackStationary(unit: Unit, step: number) {
    if (unit.damage <= 0) return
    const target = this.nearestTarget(unit, unit.range + 0.2)
    if (!target) {
      unit.targetId = null
      return
    }
    unit.targetId = target.id
    unit.faceY = target.y < unit.y ? -1 : 1
    this.tryAttack(unit, target, step)
  }

  private tryAttack(unit: Unit, target: Unit | Tower, step: number) {
    unit.attackCd -= step
    if (unit.attackCd > 0) return
    unit.attackCd = unit.hitSpeed
    unit.attackAnim = 0.2
    if (unit.range > 1.35) {
      this.projectiles.push({
        id: this.nextId++,
        side: unit.side,
        x: unit.x,
        y: unit.y - 0.2,
        sx: unit.x,
        sy: unit.y - 0.2,
        tx: target.x,
        ty: target.y,
        targetId: target.id,
        speed: unit.arc > 0.6 ? 6.4 : 10.5,
        damage: unit.damage,
        splash: unit.splash,
        hitsAir: unit.hitsAir,
        hitsGround: unit.hitsGround,
        color: unit.shot,
        arc: unit.arc,
        alive: true,
      })
      return
    }
    this.slashes.push({
      x: target.x,
      y: target.y,
      life: 0.16,
      max: 0.16,
      face: unit.faceY,
      color: unit.shot,
    })
    if (unit.splash > 0) this.splashAt(unit.side, target.x, target.y, unit.splash, unit.damage, unit.hitsAir, unit.hitsGround)
    else this.inflict(target, unit.damage, unit.side)
  }

  private updateTower(tower: Tower, step: number) {
    tower.hitFlash = Math.max(0, tower.hitFlash - step)
    tower.attackAnim = Math.max(0, tower.attackAnim - step)
    tower.textCd = Math.max(0, tower.textCd - step)
    if (tower.pendingText > 0 && tower.textCd <= 0) {
      this.texts.push({
        x: tower.x + (tower.side === 'player' ? 0.2 : -0.2),
        y: tower.y - tower.radius - 0.15,
        text: String(Math.round(tower.pendingText)),
        life: 0.7,
        max: 0.7,
        color: tower.side === 'player' ? '#e6dcff' : '#ffe7a3',
        big: false,
      })
      tower.pendingText = 0
      tower.textCd = 0.42
    }
    if (!tower.alive) return
    if (tower.role === 'king' && !tower.awake) return
    const target = this.nearestTargetForTower(tower)
    tower.targetId = target ? target.id : null
    if (!target) return
    tower.attackCd -= step
    if (tower.attackCd > 0) return
    tower.attackCd = tower.hitSpeed
    tower.attackAnim = 0.16
    this.projectiles.push({
      id: this.nextId++,
      side: tower.side,
      x: tower.x,
      y: tower.y - tower.radius * 0.2,
      sx: tower.x,
      sy: tower.y - tower.radius * 0.2,
      tx: target.x,
      ty: target.y,
      targetId: target.id,
      speed: 11,
      damage: tower.damage,
      splash: 0,
      hitsAir: true,
      hitsGround: true,
      color: tower.side === 'player' ? '#ffe3a1' : '#d9d0ff',
      arc: 0.22,
      alive: true,
    })
  }

  private updateProjectile(shot: Projectile, step: number) {
    if (!shot.alive) return
    const target = shot.targetId != null ? this.entity(shot.targetId) : null
    if (target && target.alive) {
      shot.tx = target.x
      shot.ty = target.y
    }
    const dx = shot.tx - shot.x
    const dy = shot.ty - shot.y
    const remaining = Math.hypot(dx, dy)
    const travel = shot.speed * step
    if (remaining <= Math.max(0.22, travel)) {
      shot.x = shot.tx
      shot.y = shot.ty
      shot.alive = false
      this.impact(shot, target)
      return
    }
    shot.x += (dx / remaining) * travel
    shot.y += (dy / remaining) * travel
  }

  private impact(shot: Projectile, target: Unit | Tower | null) {
    if (shot.splash > 0) {
      this.splashAt(shot.side, shot.x, shot.y, shot.splash, shot.damage, shot.hitsAir, shot.hitsGround)
      return
    }
    if (target && target.alive && target.side !== shot.side) this.inflict(target, shot.damage, shot.side)
  }

  private splashAt(side: Side, x: number, y: number, radius: number, amount: number, hitsAir: boolean, hitsGround: boolean) {
    const hit = (target: Unit | Tower) => {
      if (!target.alive || target.side === side) return
      const flying = 'flying' in target && target.flying
      if (flying && !hitsAir) return
      if (!flying && !hitsGround) return
      if (dist(target.x, target.y, x, y) <= radius + target.radius * 0.35) this.inflict(target, amount, side)
    }
    for (const unit of this.units) hit(unit)
    for (const tower of this.towers) hit(tower)
  }

  private inflict(target: Unit | Tower, amount: number, source: Side) {
    if (!target.alive || amount <= 0 || target.side === source) return
    target.hp -= amount
    target.hitFlash = 0.14
    if ('role' in target) {
      target.pendingText += amount
      if (target.role === 'king') this.wake(target.side)
    }
    if (target.hp <= 0) {
      target.hp = 0
      target.alive = false
      if ('role' in target) this.killTower(target, source)
      else {
        this.burst(target.x, target.y, target.color, 12, 1.4, 0.45)
        if (target.kind === 'troop') this.grantKillElixir(source, target.x, target.y)
      }
    }
  }

  private grantKillElixir(side: Side, x: number, y: number) {
    const before = side === 'player' ? this.playerElixir : this.enemyElixir
    const after = Math.min(10, before + 1)
    if (after - before < 0.05) return
    if (side === 'player') this.playerElixir = after
    else this.enemyElixir = after
    this.texts.push({
      x,
      y: y - 0.55,
      text: '+1',
      life: 0.75,
      max: 0.75,
      color: '#ffe7a3',
      big: false,
    })
  }

  private killTower(tower: Tower, source: Side) {
    this.burst(tower.x, tower.y, '#e7d7bc', tower.role === 'king' ? 40 : 26, 2.4, 0.75)
    this.shake = Math.max(this.shake, tower.role === 'king' ? 1 : 0.62)
    this.texts.push({
      x: tower.x,
      y: tower.y - 0.4,
      text: tower.role === 'king' ? 'KEEP' : 'CROWN',
      life: 1.35,
      max: 1.35,
      color: source === 'player' ? '#ffe7a3' : '#e4d9ff',
      big: true,
    })
    if (tower.role === 'king') {
      this.crowns[source] = 3
      this.end(source, 'king')
      return
    }
    this.crowns[source] += 1
    this.wake(tower.side)
    this.pushEvent({ type: 'crown', side: source })
    if (this.phase === 'overtime') this.end(source, 'overtime')
  }

  private wake(side: Side) {
    const king = this.towers.find((tower) => tower.side === side && tower.role === 'king')
    if (!king || king.awake) return
    king.awake = true
    if (king.hp <= 0) return
    this.rings.push({ x: king.x, y: king.y, life: 0.6, max: 0.6, radius: 1.8, color: '#ffe7a3' })
    this.pushEvent({ type: 'wake', side })
  }

  private end(winner: Side | 'draw', reason: 'king' | 'crowns' | 'overtime' | 'tiebreak' | 'draw') {
    if (this.winner) return
    this.winner = winner
    this.reason = reason
    this.finishTimer = 1.25
    this.pushEvent({ type: 'end', side: winner === 'draw' ? undefined : winner })
  }

  private checkClock() {
    if (this.winner) return
    if (this.phase === 'regulation' && this.time >= 180) {
      if (this.crowns.player !== this.crowns.enemy) {
        this.end(this.crowns.player > this.crowns.enemy ? 'player' : 'enemy', 'crowns')
      } else {
        this.phase = 'overtime'
        this.pushEvent({ type: 'overtime' })
        this.texts.push({
          x: 9,
          y: 16,
          text: 'SUDDEN DEATH',
          life: 1.5,
          max: 1.5,
          color: '#ffe7a3',
          big: true,
        })
      }
      return
    }
    if (this.phase === 'overtime' && this.time >= 240) {
      const playerDealt = this.kingMissing('enemy')
      const enemyDealt = this.kingMissing('player')
      if (Math.abs(playerDealt - enemyDealt) <= 1) this.end('draw', 'draw')
      else this.end(playerDealt > enemyDealt ? 'player' : 'enemy', 'tiebreak')
    }
  }

  private kingMissing(side: Side): number {
    const king = this.towers.find((tower) => tower.side === side && tower.role === 'king')
    if (!king) return 0
    return king.maxHp - king.hp
  }

  private resolveTarget(unit: Unit): Unit | Tower | null {
    const current = unit.targetId != null ? this.entity(unit.targetId) : null
    if (current && !this.validTarget(unit, current)) unit.targetId = null
    else if (current && dist(unit.x, unit.y, current.x, current.y) > unit.sight + 3.4) unit.targetId = null
    const nearest = this.nearestTarget(unit, unit.sight)
    if (!unit.targetId) return nearest
    if (!current) return nearest
    if (nearest && dist(unit.x, unit.y, nearest.x, nearest.y) < dist(unit.x, unit.y, current.x, current.y) * 0.62) {
      return nearest
    }
    return current.alive ? current : nearest
  }

  private nearestTarget(unit: Unit, radius: number): Unit | Tower | null {
    let best: Unit | Tower | null = null
    let bestDist = radius
    const consider = (target: Unit | Tower) => {
      if (!this.validTarget(unit, target)) return
      const d = dist(unit.x, unit.y, target.x, target.y)
      if (d < bestDist) {
        best = target
        bestDist = d
      }
    }
    for (const other of this.units) consider(other)
    for (const tower of this.towers) consider(tower)
    return best
  }

  private nearestTargetForTower(tower: Tower): Unit | null {
    let best: Unit | null = null
    let bestDist = tower.range + 0.15
    for (const unit of this.units) {
      if (!unit.alive || unit.side === tower.side || unit.spawn > 0.25) continue
      const d = dist(tower.x, tower.y, unit.x, unit.y)
      if (d < bestDist) {
        best = unit
        bestDist = d
      }
    }
    return best
  }

  private validTarget(unit: Unit, target: Unit | Tower): boolean {
    if (!target.alive || target.side === unit.side || target.id === unit.id) return false
    const flying = 'flying' in target && target.flying
    const structure = 'role' in target || ('kind' in target && target.kind === 'building')
    if (unit.buildingsOnly && !structure) return false
    if (flying && !unit.hitsAir) return false
    if (!flying && !unit.hitsGround) return false
    return true
  }

  private objective(unit: Unit): Tower | null {
    const foes = this.towers.filter((tower) => tower.alive && tower.side !== unit.side)
    const princess = foes.find((tower) => tower.role === 'princess' && tower.lane === unit.lane)
    if (princess) return princess
    return foes.find((tower) => tower.role === 'king') ?? foes[0] ?? null
  }

  private inReach(unit: Unit, target: Unit | Tower): boolean {
    const reach = unit.range <= 1.35
      ? unit.range + target.radius + unit.radius * 0.15
      : unit.range + target.radius * 0.25
    return dist(unit.x, unit.y, target.x, target.y) <= reach
  }

  private waypoint(unit: Unit, goalX: number, goalY: number): { x: number; y: number } {
    if (unit.flying || unit.fords) return { x: goalX, y: goalY }
    const goalIsAbove = goalY < 16
    const onGoalSide = goalIsAbove ? unit.y <= RIVER_TOP : unit.y >= RIVER_BOT
    if (onGoalSide && !inWater(unit.x, unit.y) && !crossesWater(unit.x, unit.y, goalX, goalY)) {
      unit.bridge = null
      unit.crossing = false
      return { x: goalX, y: goalY }
    }
    const bridge = this.lockBridge(unit, goalX)
    const exitY = goalIsAbove ? RIVER_TOP - 0.36 : RIVER_BOT + 0.36
    const entryY = goalIsAbove ? RIVER_BOT + 0.28 : RIVER_TOP - 0.28
    const inChannel = unit.y < RIVER_BOT && unit.y > RIVER_TOP
    if (Math.hypot(unit.x - bridge, unit.y - entryY) < 0.16 || inChannel || inWater(unit.x, unit.y)) unit.crossing = true
    if (unit.crossing) return { x: bridge, y: exitY }
    return { x: bridge, y: entryY }
  }

  private lockBridge(unit: Unit, goalX: number): number {
    if (unit.bridge != null) return unit.bridge
    const score = (bridge: number) => Math.abs(unit.x - bridge) + Math.abs(goalX - bridge) * 0.45
    const left = BRIDGES[0]
    const right = BRIDGES[1]
    unit.bridge = score(left) <= score(right) ? left : right
    return unit.bridge
  }

  private stepToward(unit: Unit, x: number, y: number, step: number) {
    const dx = x - unit.x
    const dy = y - unit.y
    const d = Math.hypot(dx, dy)
    if (d < 0.015) return
    const travel = Math.min(d, unit.speed * step)
    unit.x += (dx / d) * travel
    unit.y += (dy / d) * travel
    const spot = clampArena(unit.x, unit.y)
    unit.x = spot.x
    unit.y = spot.y
  }

  private separate() {
    const bodies = this.units.filter((unit) => unit.alive && !unit.flying)
    for (let i = 0; i < bodies.length; i++) {
      const unit = bodies[i]!
      if (unit.kind === 'building') continue
      let pushX = 0
      let pushY = 0
      for (let j = 0; j < bodies.length; j++) {
        if (i === j) continue
        const other = bodies[j]!
        let dx = unit.x - other.x
        let dy = unit.y - other.y
        let d = Math.hypot(dx, dy)
        const minDist = unit.radius + other.radius * (other.kind === 'building' ? 0.85 : 0.72)
        if (d < 0.001) {
          dx = 0.02
          dy = 0
          d = 0.02
        }
        if (d >= minDist) continue
        const weight = other.mass / (unit.mass + other.mass)
        const push = ((minDist - d) / minDist) * weight
        pushX += (dx / d) * push
        pushY += (dy / d) * push
      }
      for (const tower of this.towers) {
        if (!tower.alive) continue
        let dx = unit.x - tower.x
        let dy = unit.y - tower.y
        let d = Math.hypot(dx, dy)
        const minDist = unit.radius * 0.4 + tower.radius
        if (d < 0.001) {
          dx = 0.02
          dy = 0.02
          d = 0.03
        }
        if (d >= minDist) continue
        const push = (minDist - d) / minDist
        pushX += (dx / d) * push
        pushY += (dy / d) * push
      }
      if (unit.attackAnim > 0) {
        pushX *= 0.2
        pushY *= 0.2
      }
      unit.x += Math.max(-0.07, Math.min(0.07, pushX * 0.45))
      unit.y += Math.max(-0.07, Math.min(0.07, pushY * 0.45))
    }
  }

  private rescueFromWater() {
    for (const unit of this.units) {
      if (!unit.alive || unit.flying || unit.fords || !inWater(unit.x, unit.y)) continue
      let bridge: number = BRIDGES[0]
      if (Math.abs(unit.x - BRIDGES[1]) < Math.abs(unit.x - bridge)) bridge = BRIDGES[1]
      if (Math.abs(unit.x - bridge) <= BRIDGE_HALF + 0.4) {
        unit.x += Math.sign(bridge - unit.x || 1) * 0.08
      } else {
        unit.y = unit.y < 16 ? RIVER_TOP - 0.2 : RIVER_BOT + 0.2
      }
    }
  }

  private cleanup() {
    this.units = this.units.filter((unit) => unit.alive)
    this.projectiles = this.projectiles.filter((shot) => shot.alive)
  }

  private entity(id: number): Unit | Tower | null {
    return this.units.find((unit) => unit.id === id) ?? this.towers.find((tower) => tower.id === id) ?? null
  }

  private burst(x: number, y: number, color: string, count: number, speed: number, life: number) {
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2
      const velocity = speed * (0.35 + this.rng() * 0.75)
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        life: life * (0.6 + this.rng() * 0.5),
        max: life,
        color,
        size: 0.06 + this.rng() * 0.08,
        grav: 0.35,
      })
    }
  }

  private pushEvent(event: GameEvent) {
    this.events.push(event)
    if (this.events.length > 24) this.events.shift()
  }

  drainEvents(): GameEvent[] {
    return this.events.splice(0, this.events.length)
  }
}
