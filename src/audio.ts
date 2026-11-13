export class Sfx {
  muted = false
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private drone: { stop: () => void } | null = null
  private lastHit = 0

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.22
  }

  resume() {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    if (!this.ctx) {
      const ctx = new Ctx()
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.22
      master.connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  startDrone() {
    this.stopDrone()
    this.resume()
    if (!this.ctx || !this.master) return
    const ctx = this.ctx
    const gain = ctx.createGain()
    gain.gain.value = 0.045
    gain.connect(this.master)
    const nodes: OscillatorNode[] = []
    for (const freq of [146.83, 220]) {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      osc.start()
      nodes.push(osc)
    }
    this.drone = {
      stop: () => {
        const now = ctx.currentTime
        gain.gain.cancelScheduledValues(now)
        gain.gain.setValueAtTime(gain.gain.value, now)
        gain.gain.linearRampToValueAtTime(0, now + 0.2)
        for (const node of nodes) {
          try {
            node.stop(now + 0.22)
          } catch {
            /* already stopped */
          }
        }
      },
    }
  }

  stopDrone() {
    this.drone?.stop()
    this.drone = null
  }

  click() {
    this.tone(640, 0.04, 'triangle', 0.05)
  }

  deny() {
    this.tone(180, 0.08, 'square', 0.04)
    this.tone(120, 0.1, 'square', 0.03, 0.02)
    this.buzz([16, 36, 22])
  }

  deploy() {
    this.tone(520, 0.07, 'triangle', 0.07)
    this.tone(780, 0.09, 'sine', 0.05, 0.03)
    this.buzz(14)
  }

  spell() {
    this.tone(240, 0.16, 'sawtooth', 0.04, 0.08)
    this.tone(480, 0.12, 'triangle', 0.05)
    this.buzz([10, 24, 18])
  }

  hit() {
    const now = performance.now()
    if (now - this.lastHit < 70) return
    this.lastHit = now
    this.tone(190 + Math.random() * 80, 0.04, 'square', 0.03)
  }

  horn() {
    this.tone(392, 0.12, 'triangle', 0.07)
    this.tone(523, 0.18, 'triangle', 0.06, 0.08)
  }

  wake() {
    this.tone(660, 0.1, 'sine', 0.05)
    this.tone(880, 0.16, 'sine', 0.04, 0.06)
  }

  crown() {
    this.tone(523, 0.1, 'triangle', 0.07)
    this.tone(659, 0.14, 'triangle', 0.06, 0.08)
    this.tone(784, 0.2, 'sine', 0.05, 0.16)
    this.buzz([12, 28, 18])
  }

  win() {
    ;[523, 659, 784, 1046].forEach((freq, index) => this.tone(freq, 0.16, 'triangle', 0.06, index * 0.12))
  }

  lose() {
    ;[392, 349, 311, 262].forEach((freq, index) => this.tone(freq, 0.18, 'sine', 0.05, index * 0.12))
  }

  draw() {
    this.tone(440, 0.14, 'sine', 0.05)
    this.tone(554, 0.18, 'sine', 0.04, 0.1)
  }

  private buzz(pattern: number | number[]) {
    if (this.muted || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return
    navigator.vibrate(pattern)
  }

  private tone(freq: number, dur: number, type: OscillatorType, gainValue: number, delay = 0) {
    if (this.muted || !this.ctx || !this.master) return
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    const start = ctx.currentTime + delay
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, gainValue), start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(start)
    osc.stop(start + dur + 0.02)
  }
}
