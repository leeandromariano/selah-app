// CORAM // LOGOS: controles. Teclado e mouse no computador; analógico flutuante e botões no celular. Escreve direto no estado da simulação.
import type { Game } from './sim'
import { toWorld, type View } from './render'

const keyMap: Record<string, 'c' | 'q' | 'e' | 'x'> = { KeyC: 'c', KeyQ: 'q', KeyE: 'e', KeyX: 'x' }

export type Joystick = { active: boolean; ox: number; oy: number; x: number; y: number }
export const joystickRadius = 56

// Teclado + mouse. `getView` devolve a câmera atual para converter o ponteiro em posição no mundo.
export function bindDesktop(canvas: HTMLCanvasElement, getGame: () => Game, getView: () => View) {
  const keys = new Set<string>()
  const move = () => {
    const g = getGame()
    const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)
    const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
    const n = Math.hypot(x, y) || 1
    g.input.moveX = x / n; g.input.moveY = y / n
  }
  const down = (e: KeyboardEvent) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    const tag = (e.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA') return
    const ability = keyMap[e.code]
    if (ability) { getGame().want[ability] = true; e.preventDefault() }
    else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) { keys.add(e.code); move(); e.preventDefault() }
  }
  const up = (e: KeyboardEvent) => { if (keys.delete(e.code)) move() }
  const aim = (e: PointerEvent) => {
    if (e.pointerType === 'touch') return
    const r = canvas.getBoundingClientRect(), k = r.width ? canvas.width / r.width : 1, g = getGame(), p = toWorld(getView(), (e.clientX - r.left) * k, (e.clientY - r.top) * k)
    g.input.aimX = p.x - g.player.x; g.input.aimY = p.y - g.player.y
  }
  const press = (e: PointerEvent) => { if (e.pointerType === 'touch') return; aim(e); if (e.button === 0) getGame().input.fire = true }
  const release = (e: PointerEvent) => { if (e.button === 0) getGame().input.fire = false }
  const blur = () => { keys.clear(); move(); getGame().input.fire = false }
  const noMenu = (e: Event) => e.preventDefault()
  window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', blur)
  canvas.addEventListener('pointermove', aim); canvas.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); canvas.addEventListener('contextmenu', noMenu)
  return () => {
    window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur)
    canvas.removeEventListener('pointermove', aim); canvas.removeEventListener('pointerdown', press); window.removeEventListener('pointerup', release); canvas.removeEventListener('contextmenu', noMenu)
  }
}

// Analógico virtual: nasce onde o dedo toca na metade esquerda da tela. Só mexe no estado; o desenho fica a cargo do componente.
export function bindJoystick(zone: HTMLElement, getGame: () => Game, onChange: (stick: Joystick) => void) {
  const stick: Joystick = { active: false, ox: 0, oy: 0, x: 0, y: 0 } // ox/oy em coordenadas da tela
  let id = -1
  const emit = () => { const r = zone.getBoundingClientRect(); onChange({ active: stick.active, ox: stick.ox - r.left, oy: stick.oy - r.top, x: stick.x, y: stick.y }) }
  const drag = (e: PointerEvent) => {
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy, d = Math.hypot(dx, dy), k = d > joystickRadius ? joystickRadius / d : 1
    stick.x = dx * k; stick.y = dy * k
    const g = getGame(); g.input.moveX = stick.x / joystickRadius; g.input.moveY = stick.y / joystickRadius; g.input.assist = true
  }
  const down = (e: PointerEvent) => {
    if (id !== -1) return
    id = e.pointerId; zone.setPointerCapture?.(id)
    stick.active = true; stick.ox = e.clientX; stick.oy = e.clientY; stick.x = 0; stick.y = 0
    getGame().input.assist = true; emit()
  }
  const move = (e: PointerEvent) => { if (e.pointerId === id) { drag(e); emit() } }
  const end = (e: PointerEvent) => {
    if (e.pointerId !== id) return
    id = -1; stick.active = false; stick.x = stick.y = 0
    const g = getGame(); g.input.moveX = 0; g.input.moveY = 0; emit()
  }
  zone.addEventListener('pointerdown', down); zone.addEventListener('pointermove', move); zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end)
  return () => { zone.removeEventListener('pointerdown', down); zone.removeEventListener('pointermove', move); zone.removeEventListener('pointerup', end); zone.removeEventListener('pointercancel', end) }
}
