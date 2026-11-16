export class JsonRequestTimeoutError extends Error {
  public readonly timeoutMs: number

  constructor(timeoutMs: number) {
    super(`JSON request timed out after ${timeoutMs}ms`)
    this.timeoutMs = timeoutMs
    this.name = 'JsonRequestTimeoutError'
  }
}

export class JsonRequestAbortedError extends Error {
  public readonly reason?: unknown

  constructor(reason?: unknown) {
    super('JSON request was cancelled')
    this.reason = reason
    this.name = 'JsonRequestAbortedError'
  }
}

export interface JsonRequestOptions extends Omit<RequestInit, 'signal'> {
  signal?: AbortSignal
  timeoutMs?: number
}

/** Bounds both the request and JSON body read, even if fetch ignores abort. */
export function fetchJsonWithTimeout<T>(
  input: RequestInfo | URL,
  { timeoutMs = 15_000, signal, ...init }: JsonRequestOptions = {},
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return Promise.reject(new RangeError('timeoutMs must be a positive finite number'))
  }

  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController()
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
    const fail = (error: unknown, abort = false) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
      if (abort) controller.abort(error)
    }
    const onAbort = () => fail(new JsonRequestAbortedError(signal?.reason), true)

    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    timer = setTimeout(() => fail(new JsonRequestTimeoutError(timeoutMs), true), timeoutMs)

    // Handle synchronous mock failures as well as both asynchronous stages.
    Promise.resolve().then(async () => {
      if (settled) return
      const response = await fetch(input, { ...init, signal: controller.signal })
      if (settled) return
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`.trim())
      const result = await response.json() as T
      if (settled) return
      settled = true
      cleanup()
      resolve(result)
    }).catch(error => fail(error))
  })
}
