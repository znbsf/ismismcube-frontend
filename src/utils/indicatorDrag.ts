export interface IndicatorDragOptions {
  window: Window
  document: Document
  getIndicator: () => HTMLElement | null
  getAdjuster: () => HTMLElement | null
  getRatio: () => number
  setRatio: (ratio: number) => void
  toggleOverview: () => void
}

export interface IndicatorDragController {
  start: (event: MouseEvent) => void
  cancel: () => void
  dispose: () => void
}

/** Owns only a mouse drag session; cancellation never commits the click. */
export function createIndicatorDrag(options: IndicatorDragOptions): IndicatorDragController {
  const { window: win, document: doc } = options
  let active = false
  let moved = false
  let disposed = false
  let restore: (() => void) | null = null
  const cancel = () => {
    active = false
    win.removeEventListener('mousemove', move)
    win.removeEventListener('mouseup', release)
    win.removeEventListener('blur', cancel)
    win.removeEventListener('pagehide', cancel)
    win.removeEventListener('pointercancel', cancel)
    doc.removeEventListener('visibilitychange', visibility)
    restore?.()
    restore = null
  }
  const geometry = () => {
    const indicator = options.getIndicator()
    const adjuster = options.getAdjuster()
    if (!indicator?.isConnected || !adjuster?.isConnected ||
      !Number.isFinite(adjuster.offsetHeight) || adjuster.offsetHeight <= 0) return null
    return { indicator, height: adjuster.offsetHeight }
  }
  const move = (event: MouseEvent) => {
    if (!active) return
    const target = geometry()
    if (!target) { cancel(); return }
    const movementX = Number.isFinite(event.movementX) ? event.movementX : 0
    if (!Number.isFinite(event.movementY) || (event.movementY === 0 && movementX === 0)) return
    moved = true
    const current = options.getRatio()
    const ratio = (Number.isFinite(current) ? current : 0) + event.movementY / target.height
    options.setRatio(Math.min(1, Math.max(0, ratio)))
  }
  const release = (event?: MouseEvent) => {
    if (!active || (event?.button != null && event.button !== 0)) return
    const click = !moved && Boolean(geometry())
    cancel()
    if (click) options.toggleOverview()
  }
  const visibility = () => {
    if (doc.visibilityState === 'hidden') cancel()
  }
  const start = (event: MouseEvent) => {
    if (disposed || event?.button !== 0 || active) return
    const target = geometry()
    const body = doc.body?.style
    const root = doc.documentElement?.style
    if (!target || !body || !root) return
    const handle = target.indicator.style
    const saved = { userSelect: body.userSelect, pointerEvents: body.pointerEvents,
      cursor: root.cursor, backgroundColor: handle.backgroundColor, handlePointerEvents: handle.pointerEvents }
    restore = () => {
      body.userSelect = saved.userSelect
      body.pointerEvents = saved.pointerEvents
      root.cursor = saved.cursor
      handle.backgroundColor = saved.backgroundColor
      handle.pointerEvents = saved.handlePointerEvents
    }
    active = true
    moved = false
    body.userSelect = 'none'
    body.pointerEvents = 'none'
    root.cursor = 'pointer'
    handle.pointerEvents = 'auto'
    handle.backgroundColor = 'gray'
    win.addEventListener('mousemove', move)
    win.addEventListener('mouseup', release)
    win.addEventListener('blur', cancel)
    win.addEventListener('pagehide', cancel)
    win.addEventListener('pointercancel', cancel)
    doc.addEventListener('visibilitychange', visibility)
  }
  return { start, cancel, dispose() { disposed = true; cancel() } }
}
