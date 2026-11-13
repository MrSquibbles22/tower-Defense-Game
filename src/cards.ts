export interface CardDef {
  id: string
  name: string
  cost: number
  kind: 'troop' | 'building' | 'spell'
  tagline: string
  detail: string
  count: number
  hp: number
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
  lifetime: number
  spawnEvery: number
  summonId: string
  summonCount: number
  spellRadius: number
  spellDamage: number
  spellHitsAir: boolean
  accent: string
  shot: string
  arc: number
}

function troop(partial: Omit<CardDef, 'lifetime' | 'spawnEvery' | 'summonId' | 'summonCount' | 'spellRadius' | 'spellDamage' | 'spellHitsAir'> & Partial<CardDef>): CardDef {
  return {
    lifetime: 0,
    spawnEvery: 0,
    summonId: '',
    summonCount: 0,
    spellRadius: 0,
    spellDamage: 0,
    spellHitsAir: false,
    ...partial,
  }
}

export const CARD_LIST: CardDef[] = [
  troop({
    id: 'nib',
    name: 'Lantern Nib',
    cost: 1,
    kind: 'troop',
    tagline: 'Swarm',
    detail: 'Three tiny lanterns. Cheap, fragile, and quick to replace.',
    count: 3,
    hp: 68,
    damage: 68,
    hitSpeed: 1,
    speed: 1.35,
    range: 0.55,
    sight: 5.2,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.28,
    accent: '#ffcf70',
    shot: '#ffcf70',
    arc: 0,
  }),
  troop({
    id: 'darts',
    name: 'Cinder Darts',
    cost: 2,
    kind: 'troop',
    tagline: 'Swift swarm',
    detail: 'A very fast trio that swarms anything standing on the ground.',
    count: 3,
    hp: 112,
    damage: 50,
    hitSpeed: 0.75,
    speed: 1.9,
    range: 0.5,
    sight: 5.4,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.3,
    accent: '#ff6a3d',
    shot: '#ff6a3d',
    arc: 0,
  }),
  troop({
    id: 'squire',
    name: 'Pebble Squire',
    cost: 3,
    kind: 'troop',
    tagline: 'Fighter',
    detail: 'A steady stone soldier with a shield and a short spear.',
    count: 1,
    hp: 780,
    damage: 98,
    hitSpeed: 1.1,
    speed: 1.05,
    range: 0.75,
    sight: 5.6,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.48,
    accent: '#9aa6b5',
    shot: '#f0c36a',
    arc: 0,
  }),
  troop({
    id: 'ranger',
    name: 'Quill Ranger',
    cost: 3,
    kind: 'troop',
    tagline: 'Hits air',
    detail: 'Shoots a long way and can pick flyers out of the sky.',
    count: 1,
    hp: 290,
    damage: 96,
    hitSpeed: 1.05,
    speed: 1,
    range: 5,
    sight: 6.4,
    hitsAir: true,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.4,
    accent: '#dfe7c8',
    shot: '#efe6c4',
    arc: 0.18,
  }),
  troop({
    id: 'moth',
    name: 'Gale Moth',
    cost: 3,
    kind: 'troop',
    tagline: 'Air',
    detail: 'Flies over the river and stings both ground and sky.',
    count: 1,
    hp: 240,
    damage: 80,
    hitSpeed: 1,
    speed: 1.45,
    range: 2.45,
    sight: 5.6,
    hitsAir: true,
    hitsGround: true,
    buildingsOnly: false,
    flying: true,
    fords: false,
    splash: 0,
    radius: 0.4,
    accent: '#d7f6ff',
    shot: '#9fd8ff',
    arc: 0.05,
  }),
  troop({
    id: 'monk',
    name: 'Anvil Monk',
    cost: 4,
    kind: 'troop',
    tagline: 'Splash',
    detail: 'Slow hammer swings that splash the ground around the target.',
    count: 1,
    hp: 1020,
    damage: 145,
    hitSpeed: 1.25,
    speed: 0.95,
    range: 0.85,
    sight: 5.5,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 1.15,
    radius: 0.55,
    accent: '#e07a4a',
    shot: '#e07a4a',
    arc: 0,
  }),
  troop({
    id: 'lobber',
    name: 'Ember Lobber',
    cost: 4,
    kind: 'troop',
    tagline: 'Ground splash',
    detail: 'Lobs flaming pots that burst on ground troops and towers.',
    count: 1,
    hp: 330,
    damage: 135,
    hitSpeed: 2.15,
    speed: 0.7,
    range: 5.4,
    sight: 6.5,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 1.3,
    radius: 0.44,
    accent: '#ff8a3d',
    shot: '#ffb15a',
    arc: 1.15,
  }),
  troop({
    id: 'pike',
    name: 'River Pike',
    cost: 4,
    kind: 'troop',
    tagline: 'Fords · siege',
    detail: 'Slips through the water and hunts towers, ignoring soldiers.',
    count: 1,
    hp: 880,
    damage: 180,
    hitSpeed: 1.35,
    speed: 1.68,
    range: 0.7,
    sight: 4.6,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: true,
    flying: false,
    fords: true,
    splash: 0,
    radius: 0.44,
    accent: '#3e9aaa',
    shot: '#7fd0dc',
    arc: 0,
  }),
  troop({
    id: 'spire',
    name: 'Thorn Spire',
    cost: 3,
    kind: 'building',
    tagline: 'Turret',
    detail: 'A rooted turret. It shoots anything that steps into its reach, then withers.',
    count: 1,
    hp: 920,
    damage: 80,
    hitSpeed: 0.8,
    speed: 0,
    range: 6.2,
    sight: 6.2,
    hitsAir: true,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.72,
    lifetime: 30,
    accent: '#3f8f55',
    shot: '#b6e38a',
    arc: 0.12,
  }),
  troop({
    id: 'den',
    name: 'Bloom Den',
    cost: 4,
    kind: 'building',
    tagline: 'Spawner',
    detail: 'A flower hut that keeps budding lantern nibs until it is cut down.',
    count: 1,
    hp: 840,
    damage: 0,
    hitSpeed: 1,
    speed: 0,
    range: 0,
    sight: 0,
    hitsAir: false,
    hitsGround: false,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.78,
    lifetime: 24,
    spawnEvery: 3.5,
    summonId: 'nib',
    summonCount: 1,
    accent: '#ff8fb8',
    shot: '#ff8fb8',
    arc: 0,
  }),
  troop({
    id: 'titan',
    name: 'Moss Titan',
    cost: 5,
    kind: 'troop',
    tagline: 'Tank',
    detail: 'A huge, slow body that soaks the tower fire so others can walk in behind.',
    count: 1,
    hp: 2680,
    damage: 155,
    hitSpeed: 1.5,
    speed: 0.56,
    range: 0.9,
    sight: 5.8,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0.74,
    accent: '#6eaf62',
    shot: '#c6e39a',
    arc: 0,
  }),
  troop({
    id: 'tortoise',
    name: 'Bell Tortoise',
    cost: 5,
    kind: 'troop',
    tagline: 'Siege',
    detail: 'Crawls the bridges toward towers and cleaves whatever stands beside them.',
    count: 1,
    hp: 2400,
    damage: 195,
    hitSpeed: 1.55,
    speed: 0.48,
    range: 0.85,
    sight: 5.2,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: true,
    flying: false,
    fords: false,
    splash: 0.7,
    radius: 0.76,
    accent: '#d7b15a',
    shot: '#f0d48a',
    arc: 0,
  }),
  troop({
    id: 'hawk',
    name: 'Crown Hawk',
    cost: 5,
    kind: 'troop',
    tagline: 'Air bruiser',
    detail: 'A flying bruiser that hunts troops and towers and ignores the river.',
    count: 1,
    hp: 980,
    damage: 165,
    hitSpeed: 1.15,
    speed: 1.32,
    range: 1.15,
    sight: 6,
    hitsAir: true,
    hitsGround: true,
    buildingsOnly: false,
    flying: true,
    fords: false,
    splash: 0,
    radius: 0.5,
    accent: '#f4efe4',
    shot: '#f0c36a',
    arc: 0,
  }),
  troop({
    id: 'spark',
    name: 'Spark Volley',
    cost: 2,
    kind: 'spell',
    tagline: 'Spell',
    detail: 'A quick burst that hits ground and air in a small circle.',
    count: 1,
    hp: 0,
    damage: 0,
    hitSpeed: 0,
    speed: 0,
    range: 0,
    sight: 0,
    hitsAir: true,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0,
    spellRadius: 2.05,
    spellDamage: 170,
    spellHitsAir: true,
    accent: '#ffe08a',
    shot: '#ffe08a',
    arc: 0,
  }),
  troop({
    id: 'quake',
    name: 'Quake Bell',
    cost: 4,
    kind: 'spell',
    tagline: 'Ground spell',
    detail: 'A wide ground shock. Flyers slip over the ring, towers do not.',
    count: 1,
    hp: 0,
    damage: 0,
    hitSpeed: 0,
    speed: 0,
    range: 0,
    sight: 0,
    hitsAir: false,
    hitsGround: true,
    buildingsOnly: false,
    flying: false,
    fords: false,
    splash: 0,
    radius: 0,
    spellRadius: 3.15,
    spellDamage: 350,
    spellHitsAir: false,
    accent: '#e6c27a',
    shot: '#e6c27a',
    arc: 0,
  }),
]

export const CARDS: Record<string, CardDef> = Object.fromEntries(CARD_LIST.map((card) => [card.id, card]))

export const DEFAULT_DECK = ['squire', 'ranger', 'moth', 'monk', 'pike', 'titan', 'spire', 'spark']

export const RIVALS = [
  {
    name: 'Thorn Pact',
    deck: ['titan', 'pike', 'ranger', 'monk', 'darts', 'spire', 'moth', 'spark'],
  },
  {
    name: 'Bell Procession',
    deck: ['tortoise', 'hawk', 'lobber', 'squire', 'nib', 'den', 'ranger', 'quake'],
  },
  {
    name: 'Hawk Vigil',
    deck: ['titan', 'hawk', 'darts', 'monk', 'moth', 'spire', 'lobber', 'spark'],
  },
] as const

export function isCardId(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CARDS, id)
}

export function statMult(level: number): number {
  return 1 + (Math.max(1, level) - 1) * 0.1
}

export function speedLabel(speed: number): string {
  if (speed <= 0) return 'Rooted'
  if (speed < 0.65) return 'Slow'
  if (speed < 0.95) return 'Plodding'
  if (speed < 1.2) return 'Steady'
  if (speed < 1.55) return 'Quick'
  return 'Swift'
}

export function tagsOf(card: CardDef): string[] {
  const tags: string[] = []
  if (card.kind === 'spell') tags.push('Spell')
  if (card.kind === 'building') tags.push('Building')
  if (card.count > 1) tags.push('Swarm')
  if (card.flying) tags.push('Air')
  if (card.fords) tags.push('Fords')
  if (card.buildingsOnly) tags.push('Siege')
  if (card.splash > 0) tags.push('Splash')
  if (card.kind === 'spell' && card.spellRadius > 2.4) tags.push('Wide')
  if (card.hitsAir && card.kind === 'troop' && !card.flying) tags.push('Hits air')
  if (card.kind === 'building' && card.hitsAir) tags.push('Hits air')
  return tags
}

export function towerStats(level: number, role: 'king' | 'princess') {
  const mult = statMult(level)
  if (role === 'king') {
    return { hp: 4500 * mult, damage: 104 * mult, hitSpeed: 0.95, range: 8.15, radius: 1.58 }
  }
  return { hp: 2860 * mult, damage: 94 * mult, hitSpeed: 0.8, range: 7.65, radius: 1.28 }
}

export function cardUpgradeCost(level: number): number {
  return 25 * level
}

export function keepUpgradeCost(level: number): number {
  return 40 * level
}

export const MAX_LEVEL = 5
