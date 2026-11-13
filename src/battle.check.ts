import { Battle } from './battle.ts'
import { ARENA_W, inWater } from './board.ts'
import { CARD_LIST, DEFAULT_DECK, RIVALS } from './cards.ts'

let fails = 0

function check(name: string, cond: boolean, extra = '') {
  if (!cond) {
    fails += 1
    console.error('FAIL', name, extra)
  } else {
    console.log('ok', name)
  }
}

function fresh() {
  const battle = new Battle({
    playerDeck: [...DEFAULT_DECK],
    enemyDeck: [...RIVALS[0].deck],
    playerLevels: Object.fromEntries(CARD_LIST.map((card) => [card.id, 1])),
    enemyLevel: 1,
    playerTowerLevel: 1,
    rivalName: 'Test',
    rng: () => 0.5,
  })
  battle.warmup = 0
  battle.aiEnabled = false
  return battle
}

function step(battle: Battle, seconds: number) {
  const frames = Math.round(seconds * 60)
  for (let i = 0; i < frames; i++) battle.update(1 / 60)
}

function setHand(battle: Battle, hand: string[], queue: string[]) {
  battle.playerHand.splice(0, battle.playerHand.length, ...hand)
  battle.playerQueue.splice(0, battle.playerQueue.length, ...queue)
}

const deckBattle = fresh()
check('arena width', ARENA_W === 18)
check('opening elixir', Math.abs(deckBattle.playerElixir - 5) < 0.001)
check('four card hand', deckBattle.playerHand.length === 4 && deckBattle.playerQueue.length === 4)
check('kings sleep', deckBattle.towers.filter((tower) => tower.role === 'king' && !tower.awake).length === 2)

const cycle = fresh()
cycle.playerElixir = 10
setHand(cycle, ['squire', 'spark', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
check('squire deploys on your bank', cycle.play('player', 0, 4.5, 22))
check('elixir spent', Math.abs(cycle.playerElixir - 7) < 0.05)
check('played card cycled', cycle.playerHand[0] === 'titan' && cycle.playerQueue[3] === 'squire')
check('troop cannot deploy across the river', cycle.play('player', 0, 9, 8) === false)
check('failed deploy spends nothing', Math.abs(cycle.playerElixir - 7) < 0.05)
setHand(cycle, ['spark', 'squire', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
cycle.playerElixir = 10
check('spark can land on the far bank', cycle.play('player', 0, 9, 8))
check('spell spent 2', Math.abs(cycle.playerElixir - 8) < 0.05)

const path = fresh()
path.playerElixir = 10
setHand(path, ['squire', 'spark', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
check('path squire placed', path.play('player', 0, 4.5, 22))
let wet = false
let previousY = 30
let movedDown = false
for (let i = 0; i < 12 * 60; i++) {
  path.update(1 / 60)
  const squire = path.units.find((unit) => unit.cardId === 'squire')
  if (!squire) break
  if (inWater(squire.x, squire.y)) wet = true
  if (i > 8 * 60 && squire.y < previousY - 0.2) movedDown = true
  previousY = squire.y
}
const walker = path.units.find((unit) => unit.cardId === 'squire')
check('squire stays out of the water', wet === false)
check('squire crossed the bridge', !!walker && walker.y < 15 && Math.abs(walker.x - 4.5) < 1.6, walker ? `${walker.x.toFixed(2)},${walker.y.toFixed(2)}` : 'dead')
check('squire kept walking toward the gate', movedDown || (!!walker && walker.y < 12))

const ford = fresh()
ford.playerElixir = 10
setHand(ford, ['pike', 'squire', 'moth', 'spark'], ['titan', 'spire', 'monk', 'ranger'])
check('pike placed off the bridge', ford.play('player', 0, 9, 20))
let forded = false
for (let i = 0; i < 5 * 60; i++) {
  ford.update(1 / 60)
  const pike = ford.units.find((unit) => unit.cardId === 'pike')
  if (pike && inWater(pike.x, pike.y)) forded = true
}
const pike = ford.units.find((unit) => unit.cardId === 'pike')
check('pike fords the river', forded, pike ? `${pike.x.toFixed(2)},${pike.y.toFixed(2)}` : 'missing')
check('pike did not detour onto a bridge mouth', !!pike && pike.y < 15 && pike.x > 9.5 && pike.x < 13.2, pike ? `${pike.x.toFixed(2)},${pike.y.toFixed(2)}` : 'missing')

const flyer = fresh()
const moth = flyer.forceSummon('player', 'moth', 9, 22)
check('moth summoned', !!moth)
step(flyer, 6)
const flown = flyer.units.find((unit) => unit.cardId === 'moth')
check('moth flew across instead of queueing at a bridge', !!flown && flown.y < 15 && flown.x > 10 && flown.x < 13, flown ? `${flown.x.toFixed(2)},${flown.y.toFixed(2)}` : 'missing')

const air = fresh()
const enemyMoth = air.forceSummon('enemy', 'moth', 9.2, 18.2)
const monk = air.forceSummon('player', 'monk', 9.2, 18.9)
check('air duel spawned', !!enemyMoth && !!monk)
if (enemyMoth && monk) {
  enemyMoth.attackCd = 0
  monk.attackCd = 0
  const mothHp = enemyMoth.maxHp
  step(air, 1.2)
  const mothNow = air.units.find((unit) => unit.id === enemyMoth.id)
  const monkNow = air.units.find((unit) => unit.id === monk.id)
  check('monk cannot strike a moth', !!mothNow && Math.abs(mothNow.hp - mothHp) < 0.1, mothNow ? String(mothNow.hp) : 'gone')
  check('moth can strike the monk', !!monkNow && monkNow.hp < monk.maxHp - 10, monkNow ? String(monkNow.hp) : 'gone')
}

const volley = fresh()
volley.playerElixir = 6
setHand(volley, ['spark', 'squire', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
const nibs = [volley.forceSummon('enemy', 'nib', 9, 12), volley.forceSummon('enemy', 'nib', 9.3, 12.1), volley.forceSummon('enemy', 'nib', 8.7, 11.9)]
check('spark cast', volley.play('player', 0, 9, 12))
check('spark removes the nibs', nibs.every((nib) => nib && !volley.units.some((unit) => unit.id === nib.id && unit.alive)))
check('a spell pays 1 elixir for each troop it fells', Math.abs(volley.playerElixir - 7) < 0.001, volley.playerElixir.toFixed(2))

const bell = fresh()
bell.playerElixir = 10
setHand(bell, ['quake', 'squire', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
const sky = bell.forceSummon('enemy', 'moth', 9.2, 10.1)
const ground = bell.forceSummon('enemy', 'squire', 9, 10)
check('quake cast', bell.play('player', 0, 9, 10))
check('quake misses the moth', !!sky && sky.alive && sky.hp === sky.maxHp)
check('quake hits the squire', !!ground && ground.hp < ground.maxHp)

const gates = fresh()
const enemyKing = gates.towers.find((tower) => tower.side === 'enemy' && tower.role === 'king')
const enemyGate = gates.towers.find((tower) => tower.side === 'enemy' && tower.role === 'princess' && tower.lane === 'left')
check('gates found', !!enemyKing && !!enemyGate && enemyKing.awake === false)
if (enemyGate && enemyKing) {
  gates.hurt(enemyGate.id, enemyGate.hp, 'player')
  check('a fallen gate is a crown', gates.crowns.player === 1 && gates.winner == null)
  check('the keep wakes when a gate falls', enemyKing.awake === true)
  gates.hurt(enemyKing.id, enemyKing.hp, 'player')
  check('the keep itself is three crowns', gates.winner === 'player' && gates.crowns.player === 3 && gates.reason === 'king')
}

const clock = fresh()
clock.time = 179.9
step(clock, 0.2)
check('tied crowns open sudden death', clock.phase === 'overtime' && clock.winner == null)
const overtimeGate = clock.towers.find((tower) => tower.side === 'enemy' && tower.role === 'princess')
if (overtimeGate) clock.hurt(overtimeGate.id, overtimeGate.hp, 'player')
check('the next tower ends sudden death', clock.winner === 'player' && clock.reason === 'overtime')

const timed = fresh()
timed.time = 179.9
timed.crowns.player = 1
step(timed, 0.2)
check('more crowns win when the clock ends', timed.winner === 'player' && timed.reason === 'crowns')

const regen = fresh()
regen.playerElixir = 0
step(regen, 2.8)
check('elixir refills', regen.playerElixir > 0.9 && regen.playerElixir < 1.2, regen.playerElixir.toFixed(2))

const bounty = fresh()
bounty.playerElixir = 4
bounty.enemyElixir = 4
const foe = bounty.forceSummon('enemy', 'squire', 9, 10)
const ally = bounty.forceSummon('player', 'squire', 9, 22)
const den = bounty.forceSummon('enemy', 'den', 9, 8)
if (!foe || !ally || !den) throw new Error('summon failed')
const beforeKill = bounty.playerElixir
bounty.hurt(foe.id, foe.hp, 'player')
check('killing an enemy troop pays 1 elixir', Math.abs(bounty.playerElixir - (beforeKill + 1)) < 0.001, bounty.playerElixir.toFixed(2))
check('the kill is marked', bounty.texts.some((text) => text.text === '+1'))
const enemyBefore = bounty.enemyElixir
bounty.hurt(ally.id, ally.hp, 'enemy')
check('the violet keep is paid for a kill too', Math.abs(bounty.enemyElixir - (enemyBefore + 1)) < 0.001)
check('a kill does not pay the side that lost the troop', Math.abs(bounty.playerElixir - (beforeKill + 1)) < 0.001)
const buildingBefore = bounty.playerElixir
bounty.hurt(den.id, den.hp, 'player')
check('destroying a building pays nothing', Math.abs(bounty.playerElixir - buildingBefore) < 0.001)
const swarm = fresh()
swarm.playerElixir = 2
const swarmNibs = ['nib', 'nib', 'nib'].map((id, index) => swarm.forceSummon('enemy', id, 8 + index, 10))
for (const nib of swarmNibs) {
  if (!nib) throw new Error('nib missing')
  swarm.hurt(nib.id, nib.hp, 'player')
}
check('each troop in a swarm pays 1', Math.abs(swarm.playerElixir - 5) < 0.001, swarm.playerElixir.toFixed(2))
const capped = fresh()
capped.playerElixir = 10
const extra = capped.forceSummon('enemy', 'nib', 9, 10)
if (!extra) throw new Error('nib missing')
capped.hurt(extra.id, extra.hp, 'player')
check('kill elixir still stops at ten', Math.abs(capped.playerElixir - 10) < 0.001)
check('a full bar shows no extra +1', capped.texts.every((text) => text.text !== '+1'))
const expired = fresh()
expired.playerElixir = 3
const spire = expired.forceSummon('enemy', 'spire', 9, 8)
if (!spire) throw new Error('spire missing')
spire.lifetime = 0.05
spire.age = 0
step(expired, 0.2)
check('a building that times out pays nothing', Math.abs(expired.playerElixir - 3) > 0.01 && expired.playerElixir < 3.2, expired.playerElixir.toFixed(2))
const rush = fresh()
rush.phase = 'overtime'
rush.playerElixir = 0
step(rush, 1.4)
check('sudden death refills twice as fast', rush.playerElixir > 0.9 && rush.playerElixir < 1.25, rush.playerElixir.toFixed(2))

const ai = fresh()
ai.aiEnabled = true
step(ai, 22)
check('violet keep plays cards', ai.plays.enemy > 0, String(ai.plays.enemy))

const solo = fresh()
solo.playerElixir = 10
setHand(solo, ['squire', 'spark', 'moth', 'pike'], ['titan', 'spire', 'monk', 'ranger'])
solo.play('player', 0, 4.5, 22)
const gate = solo.towers.find((tower) => tower.side === 'enemy' && tower.lane === 'left' && tower.role === 'princess')
step(solo, 28)
check('one squire cannot fell a gate', !!gate && gate.hp > 2000, gate ? String(Math.round(gate.hp)) : 'missing')

if (fails > 0) throw new Error(`${fails} checks failed`)
console.log('all checks passed')
