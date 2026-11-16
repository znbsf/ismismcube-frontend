export interface AiTaskSession {
  signal: AbortSignal
  active: () => boolean
  cleanup: (callback: () => void) => void
  later: (callback: () => void, delay: number) => void
}

/** Invalidation precedes abort/cleanup, including synchronously fired callbacks. */
export function createAiTaskOwner() {
  let current: AiTaskSession | null = null
  let disposeCurrent: (() => void) | null = null
  let disposed = false
  const stop = () => {
    current = null
    const cleanup = disposeCurrent
    disposeCurrent = null
    cleanup?.()
  }
  const begin = (): AiTaskSession | null => {
    stop()
    if (disposed) return null
    const controller = new AbortController()
    const cleanups = new Set<() => void>()
    const session: AiTaskSession = {
      signal: controller.signal,
      active: () => current === session && !disposed,
      cleanup(callback) { if (session.active()) cleanups.add(callback); else callback() },
      later(callback, delay) {
        if (!session.active()) return
        const cleanup = () => clearTimeout(timer)
        const timer = setTimeout(() => {
          cleanups.delete(cleanup)
          if (session.active()) callback()
        }, delay)
        cleanups.add(cleanup)
      },
    }
    current = session
    disposeCurrent = () => {
      controller.abort()
      for (const cleanup of cleanups) cleanup()
      cleanups.clear()
    }
    return session
  }
  return { begin, stop, dispose() { disposed = true; stop() } }
}
