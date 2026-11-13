import type { Battle, Side, Tower, Unit } from './battle.ts'
import { ARENA_H, ARENA_W, BRIDGE_HALF, BRIDGES, RIVER_BOT, RIVER_TOP, TOWERS, inWater } from './board.ts'
import { CARDS, towerStats } from './cards.ts'

export interface Preview {
  cardId: string
  x: number
  y: number
  valid: boolean
}

const INK = '#241910'
const SPECKS = Array.from({ length: 110 }, (_, index) => {
  const x = (index * 4.7 + 1.3) % ARENA_W
  const y = (index * 6.1 + 0.7) % ARENA_H
  if (y > RIVER_TOP - 0.2 && y < RIVER_BOT + 0.2) return null
  return { x, y, r: 0.08 + (index % 4) * 0.035, light: index % 2 === 0 }
})

export function renderArena(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  cssH: number,
  dpr: number,
  battle: Battle | null,
  time: number,
  preview: Preview | null,
  anchor: 'fill' | 'top',
) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#10241c'
  ctx.fillRect(0, 0, cssW, cssH)
  const availH = anchor === 'top' ? cssH * 0.64 : cssH
  const scale = Math.min(cssW / ARENA_W, availH / ARENA_H)
  const ox = (cssW - ARENA_W * scale) / 2
  const oy = anchor === 'top' ? 12 : (cssH - ARENA_H * scale) / 2
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
  if (battle && battle.shake > 0) {
    const mag = battle.shake * 0.16
    ctx.translate(Math.sin(time * 42) * mag, Math.cos(time * 36) * mag)
  }
  drawField(ctx, time)
  const towers = battle ? battle.towers : scenicTowers()
  const sprites: { y: number; draw: () => void }[] = towers.map((tower) => ({
    y: tower.y,
    draw: () => drawTower(ctx, tower, time),
  }))
  if (battle) {
    for (const unit of battle.units) {
      sprites.push({ y: unit.y, draw: () => drawUnit(ctx, unit, time) })
    }
  }
  sprites.sort((a, b) => a.y - b.y)
  for (const sprite of sprites) sprite.draw()
  if (battle) {
    for (const shot of battle.projectiles) drawShot(ctx, shot)
    for (const slash of battle.slashes) drawSlash(ctx, slash)
    for (const ring of battle.rings) drawRing(ctx, ring)
    for (const particle of battle.particles) drawParticle(ctx, particle)
    for (const text of battle.texts) drawFloat(ctx, text)
    if (preview) drawPreview(ctx, preview, time)
  }
}

function drawField(ctx: CanvasRenderingContext2D, time: number) {
  const grass = ctx.createLinearGradient(0, 0, 0, ARENA_H)
  grass.addColorStop(0, '#275f86')
  grass.addColorStop(0.18, '#2c6b48')
  grass.addColorStop(0.5, '#2f7a45')
  grass.addColorStop(0.82, '#347848')
  grass.addColorStop(1, '#8a5a32')
  ctx.fillStyle = grass
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  ctx.fillStyle = 'rgba(88, 70, 170, 0.16)'
  ctx.fillRect(0, 0, ARENA_W, RIVER_TOP)
  ctx.fillStyle = 'rgba(214, 150, 48, 0.13)'
  ctx.fillRect(0, RIVER_BOT, ARENA_W, ARENA_H - RIVER_BOT)

  for (const speck of SPECKS) {
    if (!speck) continue
    ctx.fillStyle = speck.light ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)'
    ctx.beginPath()
    ctx.ellipse(speck.x, speck.y, speck.r, speck.r * 0.7, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.fillStyle = 'rgba(196, 158, 104, 0.72)'
  for (const bridge of BRIDGES) {
  ctx.fillRect(bridge - 0.62, RIVER_BOT, 1.24, 7.6)
  ctx.fillRect(bridge - 0.62, 7.2, 1.24, RIVER_TOP - 7.2)
  }

  const river = ctx.createLinearGradient(0, RIVER_TOP, 0, RIVER_BOT)
  river.addColorStop(0, '#1a6d86')
  river.addColorStop(0.5, '#114e68')
  river.addColorStop(1, '#1a6d86')
  ctx.fillStyle = river
  ctx.fillRect(0, RIVER_TOP, ARENA_W, RIVER_BOT - RIVER_TOP)
  ctx.strokeStyle = 'rgba(255,255,255,0.28)'
  ctx.lineWidth = 0.045
  for (let band = 0; band < 4; band++) {
    ctx.beginPath()
    const base = RIVER_TOP + 0.32 + band * 0.42
    for (let x = 0; x <= ARENA_W; x += 0.35) {
      const y = base + Math.sin(x * 1.15 + time * 1.7 + band) * 0.07
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
  }

  for (const bridge of BRIDGES) drawBridge(ctx, bridge)
  drawReeds(ctx, time)

  for (let i = 0; i < 12; i++) {
    const x = (i * 2.6 + Math.sin(time * 0.35 + i) * 0.8 + 18) % 18
    const side = i % 2 === 0
    const y = side ? 19 + ((i * 1.7 + time * 0.12) % 10) : 1 + ((i * 1.4) % 10)
    ctx.fillStyle = `rgba(255, 214, 120, ${0.25 + Math.sin(time * 2 + i) * 0.15})`
    ctx.beginPath()
    ctx.arc(x, y, 0.05, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.strokeStyle = 'rgba(36, 25, 16, 0.35)'
  ctx.lineWidth = 0.08
  ctx.strokeRect(0.08, 0.08, ARENA_W - 0.16, ARENA_H - 0.16)
}

function drawBridge(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = '#8d6744'
  ctx.fillRect(x - BRIDGE_HALF, RIVER_TOP - 0.18, BRIDGE_HALF * 2, RIVER_BOT - RIVER_TOP + 0.36)
  ctx.fillStyle = '#6d4c30'
  for (let i = 0; i < 6; i++) ctx.fillRect(x - BRIDGE_HALF, RIVER_TOP + i * 0.34, BRIDGE_HALF * 2, 0.05)
  ctx.strokeStyle = '#e6d3b0'
  ctx.lineWidth = 0.045
  ctx.beginPath()
  ctx.moveTo(x - BRIDGE_HALF, RIVER_TOP - 0.05)
  ctx.lineTo(x - BRIDGE_HALF, RIVER_BOT + 0.05)
  ctx.moveTo(x + BRIDGE_HALF, RIVER_TOP - 0.05)
  ctx.lineTo(x + BRIDGE_HALF, RIVER_BOT + 0.05)
  ctx.stroke()
}

function drawReeds(ctx: CanvasRenderingContext2D, time: number) {
  const xs = [1.1, 2.5, 6.8, 8.1, 9.9, 11.5, 15.4, 16.7]
  ctx.strokeStyle = '#1e4d38'
  ctx.lineWidth = 0.05
  for (const x of xs) {
    for (const bank of [RIVER_TOP - 0.05, RIVER_BOT + 0.05]) {
      const lean = Math.sin(time * 1.4 + x) * 0.12
      ctx.beginPath()
      ctx.moveTo(x, bank)
      ctx.quadraticCurveTo(x + lean, bank - 0.35, x + lean * 1.4, bank - 0.7)
      ctx.stroke()
    }
  }
}

function scenicTowers(): Tower[] {
  const views: Tower[] = []
  const sides: Side[] = ['enemy', 'player']
  for (const side of sides) {
    const statsK = towerStats(1, 'king')
    const statsP = towerStats(1, 'princess')
    views.push(fakeTower(side, 'king', 'center', TOWERS[side].king, statsK, false))
    views.push(fakeTower(side, 'princess', 'left', TOWERS[side].left, statsP, true))
    views.push(fakeTower(side, 'princess', 'right', TOWERS[side].right, statsP, true))
  }
  return views
}

function fakeTower(
  side: Side,
  role: 'king' | 'princess',
  lane: 'left' | 'right' | 'center',
  spot: { x: number; y: number },
  stats: { hp: number; radius: number },
  awake: boolean,
): Tower {
  return {
    id: 0,
    side,
    role,
    lane,
    x: spot.x,
    y: spot.y,
    hp: stats.hp,
    maxHp: stats.hp,
    damage: 0,
    hitSpeed: 1,
    range: 1,
    radius: stats.radius,
    attackCd: 0,
    attackAnim: 0,
    alive: true,
    awake,
    hitFlash: 0,
    pendingText: 0,
    textCd: 0,
    targetId: null,
  }
}

function drawTower(ctx: CanvasRenderingContext2D, tower: Tower, time: number) {
  const team = tower.side === 'player' ? '#f0c36a' : '#c4b5ff'
  const roof = tower.side === 'player' ? '#8d3b2f' : '#3c3a78'
  ctx.save()
  ctx.translate(tower.x, tower.y)
  ctx.fillStyle = 'rgba(0,0,0,0.25)'
  ctx.beginPath()
  ctx.ellipse(0, tower.radius * 0.35, tower.radius * 1.05, tower.radius * 0.38, 0, 0, Math.PI * 2)
  ctx.fill()
  if (!tower.alive) {
    ctx.fillStyle = '#b7a48a'
    for (const [x, y, w, h] of [[-0.45, -0.2, 0.5, 0.28], [0.05, -0.05, 0.42, 0.22], [-0.1, 0.08, 0.36, 0.18]] as const) {
      ctx.fillRect(x, y, w, h)
    }
    ctx.restore()
    return
  }
  const king = tower.role === 'king'
  const w = king ? 1.55 : 1.15
  const h = king ? 2.15 : 1.55
  ctx.fillStyle = '#cbb892'
  roundRect(ctx, -w / 2, -h * 0.72, w, h * 0.86, 0.08)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.06
  ctx.stroke()
  ctx.fillStyle = 'rgba(90, 70, 48, 0.18)'
  for (let i = 0; i < 3; i++) ctx.fillRect(-w / 2, -h * 0.45 + i * 0.28, w, 0.03)
  ctx.fillStyle = roof
  ctx.beginPath()
  ctx.moveTo(-w / 2 - 0.12, -h * 0.72)
  ctx.lineTo(0, -h * 0.72 - (king ? 0.55 : 0.38))
  ctx.lineTo(w / 2 + 0.12, -h * 0.72)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#6b5138'
  roundRect(ctx, -0.16, -0.18, 0.32, 0.42, 0.04)
  ctx.fill()
  const window = tower.role === 'princess' || tower.awake ? '#ffe7a8' : '#2a241c'
  ctx.fillStyle = window
  ctx.beginPath()
  ctx.arc(-0.28, -0.55, 0.09, 0, Math.PI * 2)
  ctx.arc(0.28, -0.55, 0.09, 0, Math.PI * 2)
  ctx.fill()
  if (king && tower.awake) {
    ctx.fillStyle = 'rgba(255, 214, 120, 0.35)'
    ctx.beginPath()
    ctx.arc(0, -0.7, 0.55, 0, Math.PI * 2)
    ctx.fill()
  }
  if (king) {
    ctx.fillStyle = team
    ctx.beginPath()
    ctx.moveTo(-0.18, -h * 0.72 - 0.48)
    ctx.lineTo(0, -h * 0.72 - 0.78)
    ctx.lineTo(0.18, -h * 0.72 - 0.48)
    ctx.strokeStyle = INK
    ctx.lineWidth = 0.04
    ctx.fill()
    ctx.stroke()
  }
  const wave = Math.sin(time * 3 + tower.x) * 0.1
  ctx.strokeStyle = '#d7c4a3'
  ctx.lineWidth = 0.04
  ctx.beginPath()
  ctx.moveTo(w / 2 - 0.05, -h * 0.2)
  ctx.lineTo(w / 2 - 0.05, -h * 0.95)
  ctx.stroke()
  ctx.fillStyle = team
  ctx.beginPath()
  ctx.moveTo(w / 2 - 0.02, -h * 0.95)
  ctx.lineTo(w / 2 + 0.48, -h * 0.78 + wave)
  ctx.lineTo(w / 2 - 0.02, -h * 0.62)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.stroke()
  if (tower.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${tower.hitFlash * 2.2})`
    roundRect(ctx, -w / 2, -h * 0.72, w, h * 0.86, 0.08)
    ctx.fill()
  }
  ctx.restore()
  healthBar(ctx, tower.x, tower.y - (king ? 2.15 : 1.7), king ? 1.7 : 1.3, tower.hp / tower.maxHp)
}

function drawUnit(ctx: CanvasRenderingContext2D, unit: Unit, time: number) {
  const hover = unit.flying ? Math.sin(time * 6 + unit.id) * 0.08 : 0
  ctx.save()
  ctx.translate(unit.x, unit.y)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 0, unit.radius * 0.95, unit.radius * 0.36, 0, 0, Math.PI * 2)
  ctx.fill()
  if (unit.fords && inWater(unit.x, unit.y)) {
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 0.04
    ctx.beginPath()
    ctx.ellipse(0, 0, 0.28 + Math.sin(time * 6) * 0.04, 0.12, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.save()
  ctx.translate(0, hover)
  if (unit.faceY > 0) ctx.scale(1, -1)
  const scale = Math.max(0.78, unit.radius / 0.42)
  ctx.scale(scale, scale)
  if (unit.spawn > 0) {
    const born = 1 - unit.spawn / 0.45
    ctx.scale(Math.max(0.2, born), Math.max(0.2, born))
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, born)
  }
  const step = Math.sin(unit.age * Math.max(3, unit.speed) * 8)
  const swing = unit.attackAnim > 0 ? Math.sin((1 - unit.attackAnim / 0.2) * Math.PI) : 0
  drawCreature(ctx, unit.cardId, unit.side === 'player' ? '#f0c36a' : '#c4b5ff', step, swing)
  if (unit.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.7, unit.hitFlash * 3)})`
    ctx.beginPath()
    ctx.arc(0, -0.55, 0.55, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
  ctx.restore()
  if (unit.hp < unit.maxHp - 0.5 || unit.kind === 'building') {
    healthBar(ctx, unit.x, unit.y - unit.radius - 0.55, Math.max(0.7, unit.radius * 2), unit.hp / unit.maxHp)
  }
  if (unit.kind === 'building' && unit.lifetime > 0) {
    const left = Math.max(0, 1 - unit.age / unit.lifetime)
    ctx.fillStyle = 'rgba(20,16,12,0.45)'
    ctx.fillRect(unit.x - 0.35, unit.y + unit.radius * 0.45, 0.7, 0.06)
    ctx.fillStyle = '#f0c36a'
    ctx.fillRect(unit.x - 0.35, unit.y + unit.radius * 0.45, 0.7 * left, 0.06)
  }
}

function drawShot(ctx: CanvasRenderingContext2D, shot: Battle['projectiles'][number]) {
  const total = Math.hypot(shot.tx - shot.sx, shot.ty - shot.sy) || 1
  const traveled = Math.hypot(shot.x - shot.sx, shot.y - shot.sy)
  const lift = Math.sin(Math.min(1, traveled / total) * Math.PI) * shot.arc
  ctx.fillStyle = shot.color
  ctx.beginPath()
  ctx.arc(shot.x, shot.y - lift, shot.arc > 0.6 ? 0.16 : 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.03
  ctx.stroke()
}

function drawSlash(ctx: CanvasRenderingContext2D, slash: Battle['slashes'][number]) {
  const alpha = slash.life / slash.max
  ctx.save()
  ctx.translate(slash.x, slash.y)
  ctx.strokeStyle = slash.color
  ctx.globalAlpha = alpha
  ctx.lineWidth = 0.08
  ctx.beginPath()
  ctx.arc(0, 0, 0.28, -0.6, 1.4)
  ctx.stroke()
  ctx.restore()
}

function drawRing(ctx: CanvasRenderingContext2D, ring: Battle['rings'][number]) {
  const t = 1 - ring.life / ring.max
  ctx.beginPath()
  ctx.arc(ring.x, ring.y, ring.radius * (0.35 + t * 0.75), 0, Math.PI * 2)
  ctx.strokeStyle = ring.color
  ctx.globalAlpha = 1 - t
  ctx.lineWidth = 0.08
  ctx.stroke()
  ctx.globalAlpha = (1 - t) * 0.2
  ctx.fillStyle = ring.color
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Battle['particles'][number]) {
  ctx.globalAlpha = Math.max(0, particle.life / particle.max)
  ctx.fillStyle = particle.color
  ctx.beginPath()
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
}

function drawFloat(ctx: CanvasRenderingContext2D, text: Battle['texts'][number]) {
  const rise = (1 - text.life / text.max) * 0.45
  ctx.globalAlpha = Math.min(1, text.life * 2)
  ctx.font = `${text.big ? 0.95 : 0.42}px Fraunces, Georgia, serif`
  ctx.textAlign = 'center'
  ctx.lineWidth = text.big ? 0.08 : 0.05
  ctx.strokeStyle = 'rgba(20,14,10,0.85)'
  ctx.strokeText(text.text, text.x, text.y - rise)
  ctx.fillStyle = text.color
  ctx.fillText(text.text, text.x, text.y - rise)
  ctx.globalAlpha = 1
}

function drawPreview(ctx: CanvasRenderingContext2D, preview: Preview, time: number) {
  const card = CARDS[preview.cardId]
  if (!card) return
  ctx.save()
  ctx.globalAlpha = 0.85
  if (card.kind !== 'spell') {
    ctx.fillStyle = preview.valid ? 'rgba(240, 195, 106, 0.1)' : 'rgba(225, 91, 74, 0.12)'
    ctx.fillRect(0, RIVER_BOT, ARENA_W, ARENA_H - RIVER_BOT)
    ctx.strokeStyle = preview.valid ? 'rgba(240, 195, 106, 0.8)' : 'rgba(225, 91, 74, 0.85)'
    ctx.lineWidth = 0.06
    ctx.beginPath()
    ctx.moveTo(0.4, 17.15)
    ctx.lineTo(17.6, 17.15)
    ctx.stroke()
  }
  const color = preview.valid ? 'rgba(125, 206, 160, 0.9)' : 'rgba(225, 91, 74, 0.9)'
  if (card.kind === 'spell') {
    ctx.beginPath()
    ctx.arc(preview.x, preview.y, card.spellRadius, 0, Math.PI * 2)
    ctx.fillStyle = preview.valid ? 'rgba(255, 224, 138, 0.18)' : 'rgba(225, 91, 74, 0.16)'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.lineWidth = 0.07
    ctx.stroke()
  } else {
    const formation = card.count >= 3 ? [[0, -0.22], [-0.34, 0.18], [0.34, 0.16]] : card.count === 2 ? [[-0.28, 0.08], [0.28, -0.06]] : [[0, 0]]
    for (const [dx, dy] of formation) {
      ctx.save()
      ctx.translate(preview.x + (dx ?? 0), preview.y + (dy ?? 0))
      ctx.globalAlpha = 0.78
      const scale = Math.max(0.78, card.radius / 0.42)
      ctx.scale(scale, scale)
      drawCreature(ctx, card.id, '#f0c36a', Math.sin(time * 6), 0)
      ctx.restore()
    }
    ctx.strokeStyle = color
    ctx.lineWidth = 0.06
    ctx.beginPath()
    ctx.arc(preview.x, preview.y, 0.35, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()
}

function healthBar(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, pct: number) {
  const p = Math.max(0, Math.min(1, pct))
  ctx.fillStyle = 'rgba(20,14,10,0.72)'
  ctx.fillRect(x - width / 2, y, width, 0.12)
  ctx.fillStyle = p > 0.55 ? '#7dcea0' : p > 0.28 ? '#f0c36a' : '#e15b4a'
  ctx.fillRect(x - width / 2, y, width * p, 0.12)
}

export function drawPortrait(ctx: CanvasRenderingContext2D, cardId: string, w: number, h: number) {
  const card = CARDS[cardId]
  ctx.clearRect(0, 0, w, h)
  if (!card) return
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#fff8ec')
  sky.addColorStop(1, '#efd8b0')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = card.accent
  ctx.globalAlpha = 0.22
  ctx.beginPath()
  ctx.arc(w * 0.5, h * 0.46, w * 0.34, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  if (card.kind === 'spell') {
    drawSpellArt(ctx, card.id, w, h)
    return
  }
  ctx.save()
  ctx.translate(w / 2, h * 0.8)
  ctx.scale(w / 3.2, w / 3.2)
  drawCreature(ctx, card.id, '#f0c36a', 0.6, 0)
  ctx.restore()
}

function drawSpellArt(ctx: CanvasRenderingContext2D, id: string, w: number, h: number) {
  ctx.save()
  ctx.translate(w / 2, h * 0.48)
  if (id === 'quake') {
    ctx.strokeStyle = '#8d6a32'
    ctx.lineWidth = 4
    for (let i = 1; i <= 3; i++) {
      ctx.beginPath()
      ctx.arc(0, 8, 10 + i * 12, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.fillStyle = '#e6c27a'
    ctx.beginPath()
    ctx.moveTo(-10, -18)
    ctx.lineTo(0, -34)
    ctx.lineTo(10, -18)
    ctx.lineTo(8, 6)
    ctx.lineTo(-8, 6)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.stroke()
  } else {
    for (let i = 0; i < 7; i++) {
      const angle = (i / 7) * Math.PI * 2
      ctx.fillStyle = i % 2 ? '#fff1b8' : '#ffb703'
      ctx.beginPath()
      ctx.ellipse(Math.cos(angle) * 22, Math.sin(angle) * 16, 7, 4, angle, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#fff6d0'
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

export function drawCreature(ctx: CanvasRenderingContext2D, id: string, team: string, step: number, swing: number) {
  switch (id) {
    case 'nib':
      return drawNib(ctx, team, step)
    case 'darts':
      return drawDart(ctx, step)
    case 'squire':
      return drawSquire(ctx, team, step, swing)
    case 'ranger':
      return drawRanger(ctx, team, step, swing)
    case 'moth':
      return drawMoth(ctx, team, step)
    case 'monk':
      return drawMonk(ctx, team, step, swing)
    case 'lobber':
      return drawLobber(ctx, step, swing)
    case 'pike':
      return drawPike(ctx, team, step)
    case 'spire':
      return drawSpire(ctx, team)
    case 'den':
      return drawDen(ctx, team)
    case 'titan':
      return drawTitan(ctx, step)
    case 'tortoise':
      return drawTortoise(ctx, team, step)
    case 'hawk':
      return drawHawk(ctx, team, step, swing)
    default:
      return drawSquire(ctx, team, step, swing)
  }
}

function drawNib(ctx: CanvasRenderingContext2D, team: string, step: number) {
  leg(ctx, -0.1, step)
  leg(ctx, 0.1, -step)
  paint(ctx, '#ffe29a', () => roundRect(ctx, -0.16, -0.62, 0.32, 0.4, 0.08))
  ctx.fillStyle = '#fff6d2'
  ctx.beginPath()
  ctx.arc(0, -0.42, 0.08, 0, Math.PI * 2)
  ctx.fill()
  paint(ctx, team, () => {
    ctx.beginPath()
    ctx.moveTo(-0.1, -0.66)
    ctx.lineTo(0, -0.86)
    ctx.lineTo(0.1, -0.66)
    ctx.closePath()
  })
}

function drawDart(ctx: CanvasRenderingContext2D, step: number) {
  ctx.save()
  ctx.translate(0, step * 0.04)
  paint(ctx, '#ff6a3d', () => {
    ctx.beginPath()
    ctx.moveTo(0, -0.95)
    ctx.quadraticCurveTo(0.28, -0.4, 0.12, 0)
    ctx.quadraticCurveTo(0, 0.08, -0.12, 0)
    ctx.quadraticCurveTo(-0.28, -0.4, 0, -0.95)
  })
  ctx.fillStyle = '#ffe08a'
  ctx.beginPath()
  ctx.arc(0, -0.42, 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSquire(ctx: CanvasRenderingContext2D, team: string, step: number, swing: number) {
  leg(ctx, -0.12, step)
  leg(ctx, 0.12, -step)
  paint(ctx, '#8e99a8', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.48, 0.28, 0.32, 0, 0, Math.PI * 2)
  })
  paint(ctx, team, () => {
    ctx.beginPath()
    ctx.arc(-0.22, -0.5, 0.16, 0, Math.PI * 2)
  })
  paint(ctx, '#d7dde6', () => {
    ctx.beginPath()
    ctx.arc(0.02, -0.86, 0.16, 0, Math.PI * 2)
  })
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.05
  ctx.beginPath()
  ctx.moveTo(0.2, -0.35 - swing * 0.1)
  ctx.lineTo(0.28, -1.15 - swing * 0.25)
  ctx.stroke()
}

function drawRanger(ctx: CanvasRenderingContext2D, team: string, step: number, swing: number) {
  leg(ctx, -0.08, step)
  leg(ctx, 0.1, -step)
  paint(ctx, '#6d8f6a', () => roundRect(ctx, -0.16, -0.85, 0.32, 0.62, 0.1))
  paint(ctx, '#f4efe2', () => {
    ctx.beginPath()
    ctx.moveTo(0.05, -1.15)
    ctx.quadraticCurveTo(0.28, -0.85, 0.02, -0.72)
    ctx.closePath()
  })
  paint(ctx, '#f2e2c4', () => {
    ctx.beginPath()
    ctx.arc(0, -1.02, 0.13, 0, Math.PI * 2)
  })
  ctx.strokeStyle = team
  ctx.lineWidth = 0.05
  ctx.beginPath()
  ctx.arc(0.18, -0.7, 0.22, -1.2 + swing * 0.4, 1.2)
  ctx.stroke()
}

function drawMoth(ctx: CanvasRenderingContext2D, team: string, step: number) {
  const flap = 0.35 + step * 0.25
  ctx.fillStyle = 'rgba(215,246,255,0.92)'
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.05
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.ellipse(side * 0.34, -0.62, 0.28, flap, side * 0.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    ctx.beginPath()
    ctx.ellipse(side * 0.42, -0.28, 0.2, flap * 0.7, side * -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  paint(ctx, '#2b2140', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.48, 0.12, 0.28, 0, 0, Math.PI * 2)
  })
  ctx.fillStyle = team
  ctx.beginPath()
  ctx.arc(-0.04, -0.62, 0.035, 0, Math.PI * 2)
  ctx.arc(0.04, -0.62, 0.035, 0, Math.PI * 2)
  ctx.fill()
}

function drawMonk(ctx: CanvasRenderingContext2D, team: string, step: number, swing: number) {
  leg(ctx, -0.14, step)
  leg(ctx, 0.14, -step)
  paint(ctx, '#c4553a', () => {
    ctx.beginPath()
    ctx.moveTo(-0.32, -0.15)
    ctx.quadraticCurveTo(-0.36, -0.7, 0, -0.82)
    ctx.quadraticCurveTo(0.36, -0.7, 0.32, -0.15)
    ctx.closePath()
  })
  paint(ctx, '#f0d2b8', () => {
    ctx.beginPath()
    ctx.arc(0, -0.92, 0.14, 0, Math.PI * 2)
  })
  ctx.save()
  ctx.translate(0.32, -0.55)
  ctx.rotate(-0.8 + swing * 1.3)
  paint(ctx, '#9aa3ad', () => roundRect(ctx, -0.1, -0.42, 0.2, 0.28, 0.04))
  ctx.strokeStyle = team
  ctx.lineWidth = 0.05
  ctx.beginPath()
  ctx.moveTo(0, -0.14)
  ctx.lineTo(0, 0.2)
  ctx.stroke()
  ctx.restore()
}

function drawLobber(ctx: CanvasRenderingContext2D, step: number, swing: number) {
  leg(ctx, -0.1, step)
  leg(ctx, 0.12, -step)
  paint(ctx, '#6b4b34', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.42, 0.24, 0.28, 0, 0, Math.PI * 2)
  })
  paint(ctx, '#f1c7a0', () => {
    ctx.beginPath()
    ctx.arc(0.02, -0.78, 0.13, 0, Math.PI * 2)
  })
  ctx.save()
  ctx.translate(-0.02, -0.85 - swing * 0.2)
  paint(ctx, '#5c4636', () => {
    ctx.beginPath()
    ctx.moveTo(-0.12, 0)
    ctx.lineTo(0.12, 0)
    ctx.lineTo(0.08, -0.16)
    ctx.lineTo(-0.08, -0.16)
    ctx.closePath()
  })
  ctx.fillStyle = '#ff8a3d'
  ctx.beginPath()
  ctx.arc(0, -0.2, 0.07, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPike(ctx: CanvasRenderingContext2D, team: string, step: number) {
  ctx.save()
  ctx.translate(0, step * 0.03)
  paint(ctx, '#2f8f9c', () => {
    ctx.beginPath()
    ctx.moveTo(0, -1.15)
    ctx.quadraticCurveTo(0.22, -0.7, 0.16, -0.15)
    ctx.quadraticCurveTo(0, 0.02, -0.16, -0.15)
    ctx.quadraticCurveTo(-0.22, -0.7, 0, -1.15)
  })
  ctx.fillStyle = team
  ctx.beginPath()
  ctx.moveTo(-0.18, -0.35)
  ctx.lineTo(-0.38, -0.22)
  ctx.lineTo(-0.16, -0.18)
  ctx.fill()
  ctx.fillStyle = '#12343a'
  ctx.beginPath()
  ctx.arc(0.06, -0.78, 0.035, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawSpire(ctx: CanvasRenderingContext2D, team: string) {
  paint(ctx, '#2f6a3a', () => {
    ctx.beginPath()
    ctx.moveTo(0, -1.35)
    ctx.quadraticCurveTo(0.28, -0.7, 0.18, 0)
    ctx.lineTo(-0.18, 0)
    ctx.quadraticCurveTo(-0.28, -0.7, 0, -1.35)
  })
  ctx.strokeStyle = '#d7f5c4'
  ctx.lineWidth = 0.04
  for (const y of [-0.4, -0.7, -1]) {
    ctx.beginPath()
    ctx.moveTo(-0.22, y)
    ctx.lineTo(0.22, y - 0.08)
    ctx.stroke()
  }
  ctx.fillStyle = team
  ctx.beginPath()
  ctx.arc(0, -0.85, 0.08, 0, Math.PI * 2)
  ctx.fill()
}

function drawDen(ctx: CanvasRenderingContext2D, team: string) {
  paint(ctx, '#d7efe0', () => roundRect(ctx, -0.38, -0.55, 0.76, 0.5, 0.1))
  paint(ctx, '#ff8fb8', () => {
    ctx.beginPath()
    ctx.arc(0, -0.72, 0.28, 0, Math.PI * 2)
  })
  ctx.fillStyle = team
  ctx.beginPath()
  ctx.arc(0, -0.72, 0.1, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#6b4b34'
  roundRect(ctx, -0.1, -0.28, 0.2, 0.24, 0.04)
  ctx.fill()
}

function drawTitan(ctx: CanvasRenderingContext2D, step: number) {
  leg(ctx, -0.2, step)
  leg(ctx, 0.2, -step)
  paint(ctx, '#3f7a46', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.58, 0.46, 0.42, 0, 0, Math.PI * 2)
  })
  ctx.fillStyle = '#8fbf6a'
  ctx.beginPath()
  ctx.ellipse(-0.18, -0.75, 0.12, 0.08, -0.4, 0, Math.PI * 2)
  ctx.ellipse(0.16, -0.62, 0.1, 0.07, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f6e27a'
  ctx.beginPath()
  ctx.arc(-0.1, -0.62, 0.045, 0, Math.PI * 2)
  ctx.arc(0.1, -0.62, 0.045, 0, Math.PI * 2)
  ctx.fill()
}

function drawTortoise(ctx: CanvasRenderingContext2D, team: string, step: number) {
  ctx.save()
  ctx.translate(step * 0.03, 0)
  paint(ctx, '#6e8b4e', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.38, 0.48, 0.32, 0, 0, Math.PI * 2)
  })
  ctx.strokeStyle = '#dfe8c8'
  ctx.lineWidth = 0.035
  ctx.beginPath()
  ctx.moveTo(-0.2, -0.38)
  ctx.lineTo(0.2, -0.38)
  ctx.moveTo(0, -0.58)
  ctx.lineTo(0, -0.18)
  ctx.stroke()
  paint(ctx, team, () => {
    ctx.beginPath()
    ctx.arc(0, -0.78, 0.12, 0, Math.PI * 2)
  })
  ctx.fillStyle = '#6b5138'
  ctx.fillRect(-0.28, -0.08, 0.12, 0.08)
  ctx.fillRect(0.16, -0.08, 0.12, 0.08)
  ctx.restore()
}

function drawHawk(ctx: CanvasRenderingContext2D, team: string, step: number, swing: number) {
  const spread = 0.55 + Math.sin(step * Math.PI) * 0.12
  const lift = -0.85 - swing * 0.1
  ctx.fillStyle = '#f7f3ea'
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.05
  ctx.beginPath()
  ctx.moveTo(-0.1, -0.45)
  ctx.quadraticCurveTo(-spread, lift, -0.95, -0.55)
  ctx.quadraticCurveTo(-0.4, -0.4, -0.1, -0.3)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(0.1, -0.45)
  ctx.quadraticCurveTo(spread, lift, 0.95, -0.55)
  ctx.quadraticCurveTo(0.4, -0.4, 0.1, -0.3)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  paint(ctx, '#f4efe4', () => {
    ctx.beginPath()
    ctx.ellipse(0, -0.5, 0.16, 0.28, 0, 0, Math.PI * 2)
  })
  ctx.fillStyle = '#e07a3d'
  ctx.beginPath()
  ctx.moveTo(0, -0.78)
  ctx.lineTo(0.1, -0.68)
  ctx.lineTo(0, -0.64)
  ctx.fill()
  paint(ctx, team, () => {
    ctx.beginPath()
    ctx.moveTo(-0.12, -0.78)
    ctx.lineTo(-0.04, -0.98)
    ctx.lineTo(0.04, -0.8)
    ctx.lineTo(0.12, -1.02)
    ctx.lineTo(0.12, -0.74)
    ctx.closePath()
  })
}

function leg(ctx: CanvasRenderingContext2D, x: number, step: number) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 0.06
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, -0.2)
  ctx.lineTo(x + step * 0.08, 0.02)
  ctx.stroke()
}

function paint(ctx: CanvasRenderingContext2D, fill: string, draw: () => void) {
  draw()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 0.06
  ctx.strokeStyle = INK
  ctx.lineJoin = 'round'
  ctx.stroke()
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
