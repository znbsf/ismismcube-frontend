export const STREAM_LENGTH_NOTICE = '\n\n【输出因长度限制结束，可调整问题后继续。】'

/** Counts nonempty text deltas, never model tokens or a guessed token budget. */
export function createAiStreamStatus(now: () => number = Date.now) {
  let startedAt: number | null = null
  let fragments = 0
  let rate = 0
  let ended = false
  const reset = () => {
    startedAt = null
    fragments = 0
    rate = 0
    ended = false
  }
  return {
    reset,
    record(content: unknown) {
      if (ended || typeof content !== 'string' || content.length === 0) return
      const time = now()
      if (startedAt === null) startedAt = time
      fragments++
      const seconds = (time - startedAt) / 1000
      rate = seconds > 0 ? fragments / seconds : 0
    },
    /** Invoke after consuming this chunk's delta. DONE passes no reason. */
    finish(reason?: unknown): string {
      if (ended) return ''
      ended = true
      return reason === 'length' ? STREAM_LENGTH_NOTICE : ''
    },
    snapshot: () => ({ fragments, fragmentsPerSecond: rate, ended }),
  }
}
