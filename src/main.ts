import '@fontsource/fraunces/600.css'
import '@fontsource/outfit/400.css'
import '@fontsource/outfit/500.css'
import '@fontsource/outfit/700.css'
import { Battle, type GameEvent } from './battle.ts'
import { drawPortrait, renderArena, type Preview } from './draw.ts'
import { Sfx } from './audio.ts'
import {
  CARDS,
  CARD_LIST,
  DEFAULT_DECK,
  MAX_LEVEL,
  RIVALS,
  cardUpgradeCost,
  keepUpgradeCost,
  speedLabel,
  statMult,
  tagsOf,
  type CardDef,
} from './cards.ts'
import { aiLevelForWins, loadSave, rewardFor, saveSave, type SaveData } from './save.ts'
import './style.css'

const HELP = [
  'You and the violet keep each guard a keep and two gate towers. Destroying the keep wins at once.',
  'Elixir refills on its own, up to ten. The gem on a card is what it spends. Felling an enemy troop pays 1 elixir.',
  'Four cards sit in your hand. Playing one draws the next, and the card you played cycles to the back.',
  'Drag a card up from the hand onto your bank — the amber half, below the river. The troop lands above your thumb. You can also tap a card, then tap the field. Spells can land anywhere.',
  'Most troops have to take a bridge. Gale moths and crown hawks fly over. The river pike fords and runs for towers.',
  'A pebble squire cannot hit a moth. Quill rangers, moths, hawks, thorn spires, and spark volley can reach the air.',
  'Gate towers shoot anything that steps onto their bank. The keep sleeps until a gate falls or the keep itself is hit.',
  'After three minutes, the side with more towers wins. A tie becomes sudden death: elixir runs twice as fast, and the next tower decides it. If that minute also ends even, the keep that took less damage wins.',
  'Each level adds a tenth to health and damage. The violet keep grows stronger as you win. On a keyboard, 1–4 selects a card, Esc puts it back, P pauses, and M mutes.',
]

const THUMB_LIFT = 92
const PHONE_LANDSCAPE = '(orientation: landscape) and (max-height: 520px)'

interface InstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

interface RivalSnapshot {
  name: string
  deck: string[]
  level: number
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

function paintCard(canvas: HTMLCanvasElement, cardId: string) {
  canvas.width = 200
  canvas.height = 150
  const ctx = canvas.getContext('2d')
  if (ctx) drawPortrait(ctx, cardId, canvas.width, canvas.height)
}

class App {
  private save: SaveData
  private sfx = new Sfx()
  private screen: 'menu' | 'collection' | 'battle' = 'menu'
  private battle: Battle | null = null
  private rival: RivalSnapshot | null = null
  private manualPause = false
  private autoPaused = false
  private selected: number | null = null
  private tapMode = false
  private preview: Preview | null = null
  private drag: { index: number; x: number; y: number; moved: boolean; button: HTMLButtonElement } | null = null
  private installPrompt: InstallPrompt | null = null
  private phoneLandscape = window.matchMedia(PHONE_LANDSCAPE)
  private handSig = ''
  private resultShown = false
  private granted = false
  private bannerUntil = 0
  private bannerText = ''
  private lastShake = 0
  private decor = 0
  private timeScale = 1
  private detailId = DEFAULT_DECK[0] ?? 'squire'

  private menu: HTMLElement
  private collection: HTMLElement
  private battleScreen: HTMLElement
  private modal: HTMLElement
  private menuRecord: HTMLElement
  private menuRival: HTMLElement
  private arena: HTMLCanvasElement
  private menuCanvas: HTMLCanvasElement
  private bannerEl: HTMLElement
  private tip: HTMLElement
  private clockNum: HTMLElement
  private clockLabel: HTMLElement
  private clock: HTMLElement
  private enemyCrowns: HTMLElement
  private playerCrowns: HTMLElement
  private elixirNum: HTMLElement
  private doubleElix: HTMLElement
  private pips: HTMLElement
  private fills: HTMLElement[] = []
  private cardsEl: HTMLElement
  private nextCanvas: HTMLCanvasElement
  private nextCost: HTMLElement
  private ghost: HTMLElement
  private ghostCanvas: HTMLCanvasElement
  private ghostCost: HTMLElement
  private muteBtn: HTMLButtonElement
  private installBtn: HTMLButtonElement
  private installNote: HTMLElement

  constructor() {
    this.save = loadSave()
    this.sfx.setMuted(this.save.mute)
    const root = document.querySelector('#app')
    if (!root) throw new Error('Missing app root')
    this.menu = el('section', 'screen')
    this.menu.id = 'menu'
    this.collection = el('section', 'screen collection')
    this.collection.hidden = true
    this.battleScreen = el('section', 'screen battle')
    this.battleScreen.hidden = true
    this.modal = el('div', 'modal')
    this.modal.hidden = true
    this.menuCanvas = el('canvas')
    this.menuCanvas.id = 'menu-canvas'
    this.menuRecord = el('p', 'record')
    this.menuRival = el('p', 'rival-line')
    const menuUi = el('div', 'menu-ui')
    const title = el('h1', undefined, 'Amberkeep')
    const tag = el('p', 'tag', 'Two keeps. One river. Summon a hand, hold the bridges, and crack the keep across the water.')
    const actions = el('div', 'menu-actions')
    const play = el('button', 'btn', 'Battle')
    play.type = 'button'
    play.addEventListener('click', () => this.startBattle(false))
    const collection = el('button', 'btn secondary', 'Collection')
    collection.type = 'button'
    collection.addEventListener('click', () => this.show('collection'))
    const help = el('button', 'btn secondary', 'How to play')
    help.type = 'button'
    help.addEventListener('click', () => this.openHelp())
    const install = el('button', 'btn secondary', 'Add to home screen')
    install.type = 'button'
    install.hidden = true
    install.addEventListener('click', () => void this.installApp())
    actions.append(play, collection, help, install)
    const installNote = el('p', 'install-note', 'In Safari, tap Share, then Add to Home Screen. Amberkeep opens full screen.')
    installNote.hidden = !this.showIosInstallHint()
    menuUi.append(title, tag, this.menuRival, this.menuRecord, actions, installNote)
    this.installBtn = install
    this.installNote = installNote
    this.menu.append(this.menuCanvas, menuUi)

    this.arena = el('canvas')
    this.arena.id = 'arena'
    const stage = el('div', 'stage')
    this.bannerEl = el('div', 'banner')
    this.bannerEl.hidden = true
    this.tip = el('div', 'tip')
    const tipText = el('p', undefined, 'Drag a card up from your hand. It lands above your thumb, on your side of the river. Troops take the bridges. Moths fly. The pike fords.')
    const tipBtn = el('button', 'btn small', 'Got it')
    tipBtn.type = 'button'
    tipBtn.addEventListener('click', () => this.dismissTip())
    this.tip.append(tipText, tipBtn)
    stage.append(this.arena)

    this.muteBtn = el('button', 'icon-btn', this.save.mute ? 'Unmute' : 'Mute')
    this.muteBtn.type = 'button'
    this.muteBtn.addEventListener('click', () => this.toggleMute())
    this.enemyCrowns = el('div', 'crowns theirs')
    this.playerCrowns = el('div', 'crowns mine')
    for (const row of [this.enemyCrowns, this.playerCrowns]) {
      for (let i = 0; i < 3; i++) row.append(crownIcon())
    }
    this.clock = el('div', 'clock')
    this.clockNum = el('strong', undefined, '3:00')
    this.clockLabel = el('span')
    this.clock.append(this.clockNum, this.clockLabel)
    const pauseBtn = el('button', 'icon-btn', 'Pause')
    pauseBtn.type = 'button'
    pauseBtn.addEventListener('click', () => this.togglePause())
    const topbar = el('header', 'topbar')
    topbar.append(this.muteBtn, this.enemyCrowns, this.clock, this.playerCrowns, pauseBtn)

    this.pips = el('div', 'pips')
    for (let i = 0; i < 10; i++) {
      const pip = el('span', 'pip')
      const fill = el('span')
      pip.append(fill)
      this.pips.append(pip)
      this.fills.push(fill)
    }
    this.elixirNum = el('strong', undefined, '5')
    this.doubleElix = el('span', 'double', '×2')
    this.doubleElix.hidden = true
    const elixir = el('div', 'elixir')
    elixir.append(this.pips, this.elixirNum, this.doubleElix)

    this.nextCanvas = el('canvas')
    this.nextCost = el('span', 'cost', '0')
    const next = el('div', 'next-card')
    next.append(el('span', undefined, 'Next'), this.nextCanvas, this.nextCost)
    this.cardsEl = el('div', 'cards')
    this.cardsEl.addEventListener('pointerdown', (event) => this.onCardDown(event))
    const hand = el('div', 'hand')
    hand.append(next, this.cardsEl)
    const hud = el('footer', 'hud')
    hud.append(this.tip, elixir, hand)
    this.battleScreen.append(topbar, this.bannerEl, stage, hud)

    this.ghost = el('div')
    this.ghost.id = 'ghost'
    this.ghost.hidden = true
    this.ghostCanvas = el('canvas')
    this.ghostCost = el('span', 'cost', '0')
    this.ghost.append(this.ghostCanvas, this.ghostCost)

    const turn = el('div', 'turn')
    turn.append(el('strong', undefined, 'Turn your phone upright'))
    turn.append(el('span', undefined, 'Amberkeep plays in portrait, with the hand at the bottom.'))
    root.append(this.menu, this.collection, this.battleScreen, this.modal, this.ghost)
    document.body.append(turn)
    this.arena.addEventListener('pointerdown', (event) => this.onArenaDown(event))
    this.arena.addEventListener('pointermove', (event) => this.onArenaMove(event))
    window.addEventListener('keydown', (event) => this.onKey(event))
    window.addEventListener('pointerdown', () => this.sfx.resume())
    window.addEventListener('contextmenu', (event) => event.preventDefault())
    document.addEventListener('gesturestart', ((event: Event) => event.preventDefault()) as EventListener)
    document.addEventListener('visibilitychange', () => {
      this.autoPaused = document.hidden
    })
    this.fitShell()
    window.addEventListener('resize', this.fitShell)
    window.visualViewport?.addEventListener('resize', this.fitShell)
    window.addEventListener('beforeinstallprompt', (event) => this.offerInstall(event))
    this.registerApp()
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('fast')) this.timeScale = 8
    if (import.meta.env.DEV) (window as unknown as { amber: App }).amber = this
    this.refreshMenu()
    requestAnimationFrame((now) => this.frame(now))
  }

  private show(screen: 'menu' | 'collection' | 'battle') {
    this.screen = screen
    this.menu.hidden = screen !== 'menu'
    this.collection.hidden = screen !== 'collection'
    this.battleScreen.hidden = screen !== 'battle'
    if (screen !== 'battle') this.sfx.stopDrone()
    if (screen === 'menu') this.refreshMenu()
    if (screen === 'collection') this.renderCollection()
    this.closeModal()
  }

  private refreshMenu() {
    const rival = RIVALS[this.save.wins % RIVALS.length] ?? RIVALS[0]
    const level = aiLevelForWins(this.save.wins)
    this.menuRival.textContent = `Next rival · ${rival.name} · level ${level}`
    const draws = this.save.draws ? ` · ${this.save.draws} draws` : ''
    this.menuRecord.textContent = `${this.save.wins} wins · ${this.save.losses} losses${draws} · ${this.save.relics} relics`
  }

  private startBattle(rematch: boolean) {
    if (this.save.deck.length !== 8) {
      this.show('collection')
      return
    }
    const fromWins = RIVALS[this.save.wins % RIVALS.length] ?? RIVALS[0]
    const rival = rematch && this.rival
      ? this.rival
      : { name: fromWins.name, deck: [...fromWins.deck], level: aiLevelForWins(this.save.wins) }
    this.rival = rival
    this.battle = new Battle({
      playerDeck: [...this.save.deck],
      enemyDeck: [...rival.deck],
      playerLevels: { ...this.save.levels },
      enemyLevel: rival.level,
      playerTowerLevel: this.save.keepLevel,
      rivalName: rival.name,
    })
    this.resultShown = false
    this.granted = false
    this.manualPause = false
    this.selected = null
    this.tapMode = false
    this.preview = null
    this.handSig = ''
    this.lastShake = 0
    this.tip.hidden = this.save.seenTip
    this.show('battle')
    this.sfx.startDrone()
    this.banner(`${rival.name} · level ${rival.level}\nHold the bridges.`, 10000)
  }

  private frame = (now: number) => {
    const prev = this.frameNow ?? now
    this.frameNow = now
    const dt = Math.min(0.05, (now - prev) / 1000)
    this.decor += dt
    if (this.screen === 'menu') {
      const fit = this.buffer(this.menuCanvas)
      const ctx = this.menuCanvas.getContext('2d')
      if (ctx && fit.w > 0) renderArena(ctx, fit.w, fit.h, fit.dpr, null, this.decor, null, 'top')
    }
    if (this.screen === 'battle' && this.battle) {
      const running = !this.manualPause && !this.autoPaused && !this.phoneLandscape.matches
      if (running) this.battle.update(dt * this.timeScale)
      this.fitArena()
      const fit = this.buffer(this.arena)
      const ctx = this.arena.getContext('2d')
      if (ctx && fit.w > 0) renderArena(ctx, fit.w, fit.h, fit.dpr, this.battle, this.decor, this.preview, 'fill')
      this.syncHud()
      this.readEvents()
      if (this.battle.winner && this.battle.finishTimer <= 0 && !this.resultShown) this.showResult()
    }
    requestAnimationFrame(this.frame)
  }

  private frameNow = 0

  private buffer(canvas: HTMLCanvasElement) {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const bw = Math.max(1, Math.round(w * dpr))
    const bh = Math.max(1, Math.round(h * dpr))
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw
      canvas.height = bh
    }
    return { w, h, dpr }
  }

  private fitArena() {
    const stage = this.arena.parentElement
    if (!stage) return
    const aw = stage.clientWidth
    const ah = stage.clientHeight
    let w = aw
    let h = (w * 32) / 18
    if (h > ah) {
      h = ah
      w = (h * 18) / 32
    }
    this.arena.style.width = `${Math.max(1, w)}px`
    this.arena.style.height = `${Math.max(1, h)}px`
  }

  private syncHud() {
    const battle = this.battle
    if (!battle) return
    const remaining = battle.phase === 'overtime' ? Math.max(0, 60 - (battle.time - 180)) : Math.max(0, 180 - battle.time)
    const total = Math.max(0, Math.ceil(remaining - 1e-4))
    this.clockNum.textContent = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
    this.clockLabel.textContent = battle.phase === 'overtime' ? 'Sudden death' : ''
    this.clock.classList.toggle('sudden', battle.phase === 'overtime')
    this.clock.classList.toggle('urgent', battle.phase === 'regulation' && remaining < 30)
    this.paintCrowns(this.playerCrowns, battle.crowns.player)
    this.paintCrowns(this.enemyCrowns, battle.crowns.enemy)
    const elixir = battle.playerElixir
    this.fills.forEach((fill, index) => {
      fill.style.width = `${Math.max(0, Math.min(1, elixir - index)) * 100}%`
    })
    this.elixirNum.textContent = String(Math.floor(elixir))
    this.pips.classList.toggle('leaking', elixir >= 9.95)
    this.doubleElix.hidden = battle.phase !== 'overtime'
    const sig = `${battle.playerHand.join(',')}>${battle.playerQueue[0] ?? ''}`
    if (sig !== this.handSig) {
      this.handSig = sig
      this.cardsEl.replaceChildren()
      battle.playerHand.forEach((id, index) => this.cardsEl.append(this.cardButton(id, index)))
      const upcoming = battle.playerQueue[0]
      if (upcoming) {
        paintCard(this.nextCanvas, upcoming)
        this.nextCost.textContent = String(CARDS[upcoming]?.cost ?? 0)
      }
    }
    this.cardsEl.querySelectorAll('button.card').forEach((node) => {
      const button = node as HTMLButtonElement
      const index = Number(button.dataset.index)
      const card = CARDS[battle.playerHand[index] ?? '']
      button.classList.toggle('selected', this.selected === index)
      button.classList.toggle('broke', !card || card.cost > battle.playerElixir + 1e-4)
    })
    if (battle.warmup > 0) {
      this.bannerEl.hidden = false
      this.bannerEl.textContent = `${battle.rivalName} · level ${battle.enemyLevel}\nHold the bridges.`
    } else if (performance.now() > this.bannerUntil) {
      this.bannerEl.hidden = true
    }
    if (battle.shake > this.lastShake + 0.04) this.sfx.hit()
    this.lastShake = battle.shake
  }

  private cardButton(id: string, index: number) {
    const card = CARDS[id]
    const button = el('button', 'card')
    button.type = 'button'
    button.dataset.index = String(index)
    const canvas = el('canvas')
    paintCard(canvas, id)
    const cost = el('span', 'cost', String(card?.cost ?? 0))
    const name = el('span', 'cname', card?.name ?? id)
    button.append(cost, canvas, name)
    return button
  }

  private paintCrowns(row: HTMLElement, count: number) {
    row.querySelectorAll('.crown').forEach((mark, index) => mark.classList.toggle('on', index < count))
  }

  private readEvents() {
    const battle = this.battle
    if (!battle) return
    for (const event of battle.drainEvents()) this.onEvent(event)
  }

  private onEvent(event: GameEvent) {
    const battle = this.battle
    if (!battle) return
    if (event.type === 'horn') {
      this.sfx.horn()
      this.banner('The bridges are open.', 1300)
    } else if ((event.type === 'deploy' || event.type === 'spell') && event.side === 'enemy') {
      const name = CARDS[event.cardId ?? '']?.name ?? 'a card'
      this.banner(`${battle.rivalName} played ${name}.`, 1400)
      if (event.type === 'spell') this.sfx.spell()
      else this.sfx.deploy()
    } else if (event.type === 'deploy') this.sfx.deploy()
    else if (event.type === 'spell') this.sfx.spell()
    else if (event.type === 'wake') {
      this.sfx.wake()
      this.banner(event.side === 'player' ? 'Your keep wakes.' : 'The violet keep wakes.', 1500)
    } else if (event.type === 'crown') {
      this.sfx.crown()
      this.banner(event.side === 'player' ? 'Crown taken.' : 'They took a crown.', 1500)
    } else if (event.type === 'overtime') {
      this.sfx.horn()
      this.banner('Sudden death. Elixir runs twice as fast.', 1800)
    }
  }

  private banner(text: string, ms: number) {
    this.bannerText = text
    this.bannerUntil = performance.now() + ms
    this.bannerEl.hidden = false
    this.bannerEl.textContent = this.bannerText
  }

  private onCardDown(event: PointerEvent) {
    if (!this.battle || this.manualPause || this.battle.winner) return
    const button = (event.target as Element | null)?.closest('button.card')
    if (!(button instanceof HTMLButtonElement)) return
    const index = Number(button.dataset.index)
    const card = CARDS[this.battle.playerHand[index] ?? '']
    if (!card) return
    if (this.battle.warmup > 0) {
      this.sfx.deny()
      this.banner('Wait for the horn.', 900)
      return
    }
    if (card.cost > this.battle.playerElixir) {
      this.sfx.deny()
      this.shake(button)
      this.banner('Not enough elixir.', 900)
      return
    }
    if (event.cancelable) event.preventDefault()
    try {
      button.setPointerCapture(event.pointerId)
    } catch {
      /* The pointer can already be gone on a very fast tap. */
    }
    this.drag = { index, x: event.clientX, y: event.clientY, moved: false, button }
    this.selected = index
    paintCard(this.ghostCanvas, card.id)
    this.ghostCost.textContent = String(card.cost)
    window.addEventListener('pointermove', this.onPointerMove, { passive: false })
    window.addEventListener('pointerup', this.onPointerUp)
    window.addEventListener('pointercancel', this.onPointerUp)
  }

  private aimFrom(clientX: number, clientY: number) {
    return { x: clientX, y: clientY - THUMB_LIFT }
  }

  private placeGhost(aim: { x: number; y: number }) {
    this.ghost.hidden = false
    this.ghost.style.transform = `translate(${aim.x - 37}px, ${aim.y - 62}px)`
  }

  private onPointerMove = (event: PointerEvent) => {
    const drag = this.drag
    const battle = this.battle
    if (!drag || !battle) return
    if (event.cancelable) event.preventDefault()
    if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 12) drag.moved = true
    if (!drag.moved) return
    drag.button.classList.add('dragging')
    const aim = this.aimFrom(event.clientX, event.clientY)
    this.placeGhost(aim)
    const tile = this.tileAt(aim.x, aim.y)
    const cardId = battle.playerHand[drag.index]
    if (!tile || !cardId) {
      this.preview = null
      return
    }
    this.preview = { cardId, x: tile.x, y: tile.y, valid: battle.canPlace('player', cardId, tile.x, tile.y) }
  }

  private onPointerUp = (event: PointerEvent) => {
    const drag = this.drag
    this.drag = null
    this.ghost.hidden = true
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointercancel', this.onPointerUp)
    if (!drag) return
    drag.button.classList.remove('dragging')
    try {
      if (drag.button.hasPointerCapture(event.pointerId)) drag.button.releasePointerCapture(event.pointerId)
    } catch {
      /* The pointer was already released. */
    }
    if (drag.moved) {
      const aim = this.aimFrom(event.clientX, event.clientY)
      const tile = this.tileAt(aim.x, aim.y)
      if (tile) this.tryPlay(drag.index, tile.x, tile.y)
      this.selected = null
      this.tapMode = false
      this.preview = null
      return
    }
    if (this.tapMode && this.selected === drag.index) {
      this.selected = null
      this.tapMode = false
      this.preview = null
      return
    }
    this.selected = drag.index
    this.tapMode = true
  }

  private onArenaDown(event: PointerEvent) {
    if (!this.tapMode || this.selected == null || this.drag) return
    const tile = this.tileAt(event.clientX, event.clientY)
    if (!tile) return
    this.tryPlay(this.selected, tile.x, tile.y)
  }

  private onArenaMove(event: PointerEvent) {
    if (!this.tapMode || this.selected == null || this.drag || !this.battle) return
    const tile = this.tileAt(event.clientX, event.clientY)
    const cardId = this.battle.playerHand[this.selected]
    if (!tile || !cardId) {
      this.preview = null
      return
    }
    this.preview = { cardId, x: tile.x, y: tile.y, valid: this.battle.canPlace('player', cardId, tile.x, tile.y) }
  }

  private tryPlay(index: number, x: number, y: number) {
    const battle = this.battle
    if (!battle || this.manualPause || battle.winner) return
    const cardId = battle.playerHand[index]
    const card = cardId ? CARDS[cardId] : undefined
    if (!card) return
    if (battle.warmup > 0) {
      this.sfx.deny()
      this.banner('Wait for the horn.', 900)
      return
    }
    if (card.cost > battle.playerElixir) {
      this.sfx.deny()
      this.banner('Not enough elixir.', 900)
      return
    }
    if (!battle.canPlace('player', card.id, x, y)) {
      this.sfx.deny()
      this.banner(card.kind === 'spell' ? 'Keep the spell inside the field.' : 'Deploy on your bank, below the river.', 1100)
      return
    }
    if (!battle.play('player', index, x, y)) {
      this.sfx.deny()
      return
    }
    this.bannerUntil = 0
    this.bannerEl.hidden = true
    this.selected = null
    this.tapMode = false
    this.preview = null
    this.dismissTip()
  }

  private tileAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.arena.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null
    return {
      x: ((clientX - rect.left) / rect.width) * 18,
      y: ((clientY - rect.top) / rect.height) * 32,
    }
  }

  private shake(button: HTMLButtonElement) {
    button.classList.remove('deny')
    void button.offsetWidth
    button.classList.add('deny')
  }

  private fitShell = () => {
    const height = window.visualViewport?.height ?? window.innerHeight
    document.documentElement.style.setProperty('--app-h', `${Math.round(height)}px`)
  }

  private showIosInstallHint() {
    const ua = navigator.userAgent
    const ios = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    return ios && !standalone
  }

  private offerInstall(event: Event) {
    const phone = window.matchMedia('(max-width: 760px), (pointer: coarse)').matches
    if (!phone) return
    event.preventDefault()
    this.installPrompt = event as InstallPrompt
    this.installBtn.hidden = false
    this.installNote.hidden = true
  }

  private async installApp() {
    const prompt = this.installPrompt
    if (!prompt) return
    await prompt.prompt()
    const choice = await prompt.userChoice
    this.installPrompt = null
    if (choice.outcome === 'accepted') this.installBtn.hidden = true
  }

  private registerApp() {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    window.addEventListener('load', () => {
      void navigator.serviceWorker.register('./sw.js').catch(() => {
        /* A failed install leaves the game playable online. */
      })
    })
  }

  private dismissTip() {
    if (this.save.seenTip) {
      this.tip.hidden = true
      return
    }
    this.save.seenTip = true
    saveSave(this.save)
    this.tip.hidden = true
  }

  private onKey(event: KeyboardEvent) {
    if (this.screen !== 'battle') return
    if (event.key === 'm' || event.key === 'M') this.toggleMute()
    if (event.key === 'p' || event.key === 'P') this.togglePause()
    if (!this.modal.hidden) return
    if (event.key === 'Escape') {
      this.selected = null
      this.tapMode = false
      this.preview = null
    }
    if (event.key >= '1' && event.key <= '4' && this.battle) {
      const index = Number(event.key) - 1
      const card = CARDS[this.battle.playerHand[index] ?? '']
      if (!card || card.cost > this.battle.playerElixir) {
        this.sfx.deny()
        this.banner('Not enough elixir.', 800)
        return
      }
      this.selected = index
      this.tapMode = true
    }
  }

  private toggleMute() {
    this.save.mute = !this.save.mute
    this.sfx.setMuted(this.save.mute)
    saveSave(this.save)
    this.muteBtn.textContent = this.save.mute ? 'Unmute' : 'Mute'
    this.sfx.click()
  }

  private togglePause() {
    if (!this.battle || this.battle.winner) return
    this.manualPause = !this.manualPause
    if (this.manualPause) this.openPause()
    else this.closeModal()
  }

  private openPause() {
    this.modal.dataset.kind = 'pause'
    this.fillModal((sheet) => {
      sheet.append(el('h2', undefined, 'Time is held'))
      sheet.append(el('p', undefined, 'The river will wait. Forfeit counts as a loss.'))
      const actions = el('div', 'actions')
      const resume = el('button', 'btn', 'Resume')
      resume.type = 'button'
      resume.addEventListener('click', () => this.togglePause())
      const give = el('button', 'btn danger', 'Forfeit')
      give.type = 'button'
      give.addEventListener('click', () => {
        this.manualPause = false
        this.closeModal()
        this.battle?.forfeit()
      })
      actions.append(resume, give)
      sheet.append(actions)
    }, false)
  }

  private showResult() {
    const battle = this.battle
    if (!battle || !battle.winner) return
    this.resultShown = true
    if (!this.granted) {
      this.granted = true
      const gain = rewardFor(battle.winner, battle.winner === 'player' ? battle.crowns.player : battle.crowns.enemy)
      this.save.relics += gain
      if (battle.winner === 'player') this.save.wins += 1
      else if (battle.winner === 'draw') this.save.draws += 1
      else this.save.losses += 1
      saveSave(this.save)
      if (battle.winner === 'player') this.sfx.win()
      else if (battle.winner === 'draw') this.sfx.draw()
      else this.sfx.lose()
    }
    const copy = resultCopy(battle)
    this.modal.dataset.kind = 'result'
    this.fillModal((sheet) => {
      sheet.append(el('h2', undefined, copy.title))
      sheet.append(el('p', undefined, copy.body))
      sheet.append(crownLine('Violet keep', battle.crowns.enemy))
      sheet.append(crownLine('Amberkeep', battle.crowns.player))
      const gain = rewardFor(battle.winner ?? 'draw', battle.winner === 'player' ? battle.crowns.player : battle.crowns.enemy)
      sheet.append(el('p', undefined, `+${gain} relics. You now hold ${this.save.relics}.`))
      const actions = el('div', 'actions')
      const again = el('button', 'btn', 'Rematch')
      again.type = 'button'
      again.addEventListener('click', () => this.startBattle(true))
      const cards = el('button', 'btn secondary', 'Collection')
      cards.type = 'button'
      cards.addEventListener('click', () => this.show('collection'))
      const menu = el('button', 'btn secondary', 'Menu')
      menu.type = 'button'
      menu.addEventListener('click', () => this.show('menu'))
      actions.append(again, cards, menu)
      sheet.append(actions)
    }, false)
  }

  private openHelp() {
    this.modal.dataset.kind = 'help'
    this.fillModal((sheet) => {
      sheet.append(el('h2', undefined, 'How to play'))
      const body = el('div', 'sheet-body')
      const list = el('ul', 'help-list')
      for (const line of HELP) list.append(el('li', undefined, line))
      body.append(list)
      sheet.append(body)
      const close = el('button', 'btn', 'Back to the keep')
      close.type = 'button'
      close.addEventListener('click', () => this.closeModal())
      const actions = el('div', 'actions')
      actions.append(close)
      sheet.append(actions)
    }, true)
  }

  private fillModal(build: (sheet: HTMLElement) => void, dismiss: boolean) {
    this.modal.replaceChildren()
    const dim = el('div', 'modal-dim')
    const sheet = el('div', 'sheet')
    if (dismiss) {
      dim.addEventListener('pointerdown', (event) => {
        if (event.target === dim) this.closeModal()
      })
    }
    build(sheet)
    dim.append(sheet)
    this.modal.append(dim)
    this.modal.hidden = false
  }

  private closeModal() {
    this.modal.hidden = true
    this.modal.replaceChildren()
    delete this.modal.dataset.kind
  }

  private renderCollection() {
    this.collection.replaceChildren()
    const sticky = el('div', 'sticky')
    const row = el('div', 'top-row')
    const back = el('button', 'btn small secondary', 'Back')
    back.type = 'button'
    back.addEventListener('click', () => this.show('menu'))
    row.append(back, el('h2', undefined, 'Collection'), el('span', 'relics', `${this.save.relics} relics`))
    const keep = el('div', 'keep-row')
    keep.append(el('span', undefined, `Your keep · level ${this.save.keepLevel}`))
    const keepBtn = el('button', 'btn small', this.save.keepLevel >= MAX_LEVEL ? 'Keep maxed' : `Raise keep · ${keepUpgradeCost(this.save.keepLevel)}`)
    keepBtn.type = 'button'
    keepBtn.disabled = this.save.keepLevel >= MAX_LEVEL || this.save.relics < keepUpgradeCost(this.save.keepLevel)
    keepBtn.addEventListener('click', () => {
      const cost = keepUpgradeCost(this.save.keepLevel)
      if (this.save.keepLevel >= MAX_LEVEL || this.save.relics < cost) return
      this.save.relics -= cost
      this.save.keepLevel += 1
      saveSave(this.save)
      this.renderCollection()
    })
    keep.append(keepBtn)
    const deck = [...this.save.deck]
    const average = deck.length ? deck.reduce((sum, id) => sum + (CARDS[id]?.cost ?? 0), 0) / deck.length : 0
    const bar = el('div', 'deck-bar')
    bar.append(el('span', undefined, `Deck ${deck.length}/8 · elixir ${average.toFixed(1)}`))
    const actions = el('div')
    const suggest = el('button', 'btn small secondary', 'Suggested')
    suggest.type = 'button'
    suggest.addEventListener('click', () => {
      this.save.deck = [...DEFAULT_DECK]
      saveSave(this.save)
      this.renderCollection()
    })
    const fight = el('button', 'btn small', deck.length === 8 ? 'Battle' : 'Choose 8')
    fight.type = 'button'
    fight.disabled = deck.length !== 8
    fight.addEventListener('click', () => this.startBattle(false))
    actions.append(suggest, fight)
    bar.append(actions)
    const slots = el('div', 'slots')
    for (let i = 0; i < 8; i++) {
      const id = deck[i]
      const slot = el('button', 'slot')
      slot.type = 'button'
      if (id && CARDS[id]) {
        const canvas = el('canvas')
        paintCard(canvas, id)
        slot.append(canvas, el('span', undefined, CARDS[id].name))
        slot.addEventListener('click', () => this.toggleCard(id))
      }
      slots.append(slot)
    }
    sticky.append(row, keep, bar, slots)
    const detail = this.detailPanel(this.detailId)
    const grid = el('div', 'grid')
    for (const card of CARD_LIST) {
      const tile = el('button', deck.includes(card.id) ? 'tile in' : 'tile')
      tile.type = 'button'
      const canvas = el('canvas')
      paintCard(canvas, card.id)
      const meta = el('div', 'meta')
      meta.append(document.createTextNode(`${card.cost} · ${card.name}`))
      const level = this.save.levels[card.id] ?? 1
      meta.append(el('small', undefined, `Level ${level} · ${tagsOf(card).join(' · ') || card.tagline}`))
      tile.append(canvas, meta)
      tile.addEventListener('click', () => this.toggleCard(card.id))
      grid.append(tile)
    }
    this.collection.append(sticky, detail, grid)
  }

  private toggleCard(id: string) {
    this.detailId = id
    const deck = this.save.deck
    const index = deck.indexOf(id)
    if (index >= 0) deck.splice(index, 1)
    else if (deck.length < 8) deck.push(id)
    else this.bannerText = 'Deck is full. Remove a card first.'
    saveSave(this.save)
    this.renderCollection()
    if (deck.length >= 8 && this.bannerText.startsWith('Deck is full') && index < 0 && !deck.includes(id)) {
      const note = this.collection.querySelector('.deck-bar span')
      if (note) note.textContent = 'Deck is full. Remove a card first.'
    }
  }

  private detailPanel(id: string) {
    const card = CARDS[id] ?? CARD_LIST[0]
    if (!card) return el('div', 'detail')
    const level = this.save.levels[card.id] ?? 1
    const panel = el('div', 'detail')
    const head = el('div', 'detail-head')
    head.append(el('h3', undefined, card.name))
    const dots = el('span', 'levels')
    for (let i = 1; i <= MAX_LEVEL; i++) dots.append(el('i', i <= level ? 'on' : ''))
    head.append(dots)
    panel.append(head)
    panel.append(el('div', 'tags', `${card.cost} elixir · ${tagsOf(card).join(' · ') || card.tagline}`))
    panel.append(el('p', undefined, card.detail))
    panel.append(el('p', undefined, statLine(card, level)))
    const cost = cardUpgradeCost(level)
    const button = el('button', 'btn', level >= MAX_LEVEL ? 'Max level' : `Raise to level ${level + 1} · ${cost} relics`)
    button.type = 'button'
    button.disabled = level >= MAX_LEVEL || this.save.relics < cost
    button.addEventListener('click', () => {
      if (level >= MAX_LEVEL || this.save.relics < cost) return
      this.save.relics -= cost
      this.save.levels[card.id] = level + 1
      saveSave(this.save)
      this.renderCollection()
    })
    panel.append(button)
    return panel
  }
}

function statLine(card: CardDef, level: number): string {
  const mult = statMult(level)
  if (card.kind === 'spell') {
    const air = card.spellHitsAir ? 'Hits ground and air.' : 'Hits ground. Flyers slip over it.'
    return `${Math.round(card.spellDamage * mult)} damage in a ${card.spellRadius.toFixed(1)} radius. ${air}`
  }
  const count = card.count > 1 ? `${card.count} fighters, ` : ''
  const hp = card.hp > 0 ? `${count}${Math.round(card.hp * mult)} health each` : 'A rooted building'
  const damage = card.damage > 0 ? `${Math.round(card.damage * mult)} damage every ${card.hitSpeed.toFixed(2)}s` : 'Buds a lantern nib'
  const reach = card.hitsAir && !card.flying ? 'Hits ground and air.' : card.flying ? 'Flies over the river.' : card.buildingsOnly ? 'Ignores soldiers and hunts buildings.' : 'Hits ground.'
  return `${hp}. ${damage}. ${speedLabel(card.speed)}. ${reach}`
}

function crownIcon() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', '0 0 24 16')
  svg.setAttribute('class', 'crown')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M1.8 14.2 4.4 5.4 8.3 9.1 12 1.4 15.7 9.1 19.6 5.4 22.2 14.2Z')
  svg.append(path)
  return svg
}

function crownLine(label: string, count: number) {
  const row = el('div', 'result-crowns')
  row.append(el('span', 'who', `${label} · ${count}`))
  const marks = el('span', 'marks')
  for (let i = 0; i < 3; i++) {
    const icon = crownIcon()
    if (i < count) icon.classList.add('on')
    marks.append(icon)
  }
  row.append(marks)
  return row
}

function resultCopy(battle: Battle): { title: string; body: string } {
  if (battle.reason === 'forfeit') return { title: 'You left the field', body: 'The violet keep is still flying.' }
  if (battle.winner === 'draw') return { title: 'The river stills', body: 'Neither keep gave way.' }
  const you = battle.winner === 'player'
  if (battle.reason === 'king') {
    return you
      ? { title: 'The violet keep falls', body: 'You brought the keep down. That is three crowns.' }
      : { title: 'Amberkeep has fallen', body: 'The violet keep broke through to yours.' }
  }
  if (battle.reason === 'tiebreak') {
    return you
      ? { title: 'The lighter wound', body: 'Sudden death ran out. Your keep took less damage.' }
      : { title: 'The deeper wound', body: 'Sudden death ran out. Your keep took the heavier blow.' }
  }
  if (battle.reason === 'overtime') {
    return you
      ? { title: 'Taken in sudden death', body: 'The next tower was yours.' }
      : { title: 'Lost in sudden death', body: 'The violet keep took the next tower.' }
  }
  return you
    ? { title: 'Amber holds', body: `You took ${battle.crowns.player} to their ${battle.crowns.enemy}.` }
    : { title: 'The field is violet', body: `They took ${battle.crowns.enemy} to your ${battle.crowns.player}.` }
}

new App()
