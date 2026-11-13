export const ARENA_W = 18
export const ARENA_H = 32
export const RIVER_TOP = 15.05
export const RIVER_BOT = 16.95
export const BRIDGES = [4.5, 13.5] as const
export const BRIDGE_HALF = 1.22

export const TOWERS = {
  player: {
    king: { x: 9, y: 29.35 },
    left: { x: 4.5, y: 25.35 },
    right: { x: 13.5, y: 25.35 },
  },
  enemy: {
    king: { x: 9, y: 2.65 },
    left: { x: 4.5, y: 6.65 },
    right: { x: 13.5, y: 6.65 },
  },
} as const

export function inWater(x: number, y: number): boolean {
  if (y < RIVER_TOP || y > RIVER_BOT) return false
  return !BRIDGES.some((bridge) => Math.abs(x - bridge) <= BRIDGE_HALF)
}

export function crossesWater(x1: number, y1: number, x2: number, y2: number): boolean {
  const steps = 8
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    if (inWater(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return true
  }
  return false
}

export function clampArena(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(0.45, Math.min(ARENA_W - 0.45, x)),
    y: Math.max(0.4, Math.min(ARENA_H - 0.4, y)),
  }
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.hypot(dx, dy)
}

export function laneOf(x: number): 'left' | 'right' {
  return x < 9 ? 'left' : 'right'
}
