export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Safely wraps synchronous or microtask DOM state updates in `document.startViewTransition`
 * when supported and motion is allowed; executes directly otherwise.
 */
export async function runViewTransition(update: () => void | Promise<void>): Promise<void> {
  if (
    typeof document === 'undefined' ||
    typeof (document as Document & { startViewTransition?: unknown }).startViewTransition !== 'function' ||
    prefersReducedMotion()
  ) {
    await update()
    return
  }

  try {
    const transition = (
      document as Document & {
        startViewTransition: (cb: () => void | Promise<void>) => { finished: Promise<void> }
      }
    ).startViewTransition(update)
    await transition.finished
  } catch {
    // Ignore interrupted transitions (AbortError) or environments rejecting ViewTransitions.
  }
}
