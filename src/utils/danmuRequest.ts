export class DanmuTimeoutError extends Error {
  constructor() { super('Danmu response timed out'); this.name = 'DanmuTimeoutError' }
}

/** Wait only for acknowledgement headers; successful empty/204 bodies are valid. */
export function postDanmu(url: string, content: string, { signal, timeoutMs = 15_000 }: {
  signal?: AbortSignal; timeoutMs?: number
} = {}): Promise<void> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return Promise.reject(new RangeError('Invalid timeout'))
  return new Promise((resolve, reject) => {
    const controller = new AbortController()
    let settled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const cleanup = () => { if (timer !== undefined) clearTimeout(timer); signal?.removeEventListener('abort', abort) }
    const fail = (error: unknown, cancel = false) => {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
      if (cancel) controller.abort(error)
    }
    const abort = () => fail(new DOMException('Request cancelled', 'AbortError'), true)
    if (signal?.aborted) { abort(); return }
    signal?.addEventListener('abort', abort, { once: true })
    timer = setTimeout(() => fail(new DanmuTimeoutError(), true), timeoutMs)
    Promise.resolve().then(async () => {
      if (settled) return
      const response = await fetch(url, { method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      if (settled) return
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      settled = true
      cleanup()
      resolve()
    }).catch(error => fail(error))
  })
}
