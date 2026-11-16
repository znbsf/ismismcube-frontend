export interface ScrollAnimationElement {
  scrollTop: number
  readonly scrollHeight: number
  readonly clientHeight: number
  readonly isConnected: boolean
}

interface ScrollAnimationOptions {
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (id: number) => void
  now?: () => number
  isActive?: () => boolean
}

interface Animation {
  frameId: number | null
}

/** One cancellable animation per element, scoped to one mounted page. */
export function createScrollAnimationOwner(options: ScrollAnimationOptions = {}) {
  const requestFrame = options.requestFrame ?? (typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis) : null)
  const cancelFrame = options.cancelFrame ?? (typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame.bind(globalThis) : null)
  const now = options.now ?? (() => typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now())
  const isActive = options.isActive ?? (() => true)
  const animations = new Map<ScrollAnimationElement, Animation>()
  let disposed = false

  const alive = (element: ScrollAnimationElement) => !disposed && isActive() && element.isConnected
  const cancel = (element: ScrollAnimationElement) => {
    const previous = animations.get(element)
    if (!previous) return
    // Invalidate before cancellation, including already queued callbacks.
    animations.delete(element)
    if (previous.frameId !== null) cancelFrame?.(previous.frameId)
    previous.frameId = null
  }
  const maximum = (element: ScrollAnimationElement) => Math.max(0, element.scrollHeight - element.clientHeight)
  const clamp = (value: number, max: number) => Math.min(max, Math.max(0, value))

  return {
    animate(
      element: ScrollAnimationElement,
      target: number | (() => number),
      duration = 1000,
      onComplete?: () => void
    ): boolean {
      cancel(element)
      if (!requestFrame || !cancelFrame || !alive(element) || !Number.isFinite(duration) || duration < 0) return false
      const startedAt = now()
      const initialMaximum = maximum(element)
      if (!Number.isFinite(startedAt) || !Number.isFinite(initialMaximum) || !Number.isFinite(element.scrollTop)) return false
      const startTop = clamp(element.scrollTop, initialMaximum)
      const animation: Animation = { frameId: null }
      const owns = () => animations.get(element) === animation && alive(element)
      const frame = () => {
        if (!owns()) {
          if (animations.get(element) === animation) cancel(element)
          return
        }
        animation.frameId = null
        let endTop: number
        let time: number
        try {
          endTop = typeof target === 'function' ? target() : target
          time = now()
        } catch {
          cancel(element)
          return
        }
        const max = maximum(element)
        if (!owns()) return // A target getter may itself replace/cancel this animation.
        if (!Number.isFinite(endTop) || !Number.isFinite(max) || !Number.isFinite(time)) {
          cancel(element)
          return
        }
        const progress = duration === 0 ? 1 : clamp((time - startedAt) / duration, 1)
        const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2
        element.scrollTop = clamp(startTop + (clamp(endTop, max) - startTop) * ease, max)
        if (!owns()) return
        if (progress < 1) {
          animation.frameId = requestFrame(frame)
        } else {
          // Release first: completion may start a new stage for this element.
          animations.delete(element)
          if (alive(element)) onComplete?.()
        }
      }
      animations.set(element, animation)
      animation.frameId = requestFrame(frame)
      return true
    },
    cancel,
    dispose(): void {
      disposed = true
      for (const element of [...animations.keys()]) cancel(element)
    }
  }
}
