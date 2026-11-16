// Active editors flush synchronously before the App checks in-memory-only state.
const flushers = new Set<() => void>()

export function registerNotesLeaveFlusher(flush: () => void): () => void {
  flushers.add(flush)
  return () => { flushers.delete(flush) }
}

export function flushNotesBeforeLeave(): void {
  for (const flush of [...flushers]) flush()
}
