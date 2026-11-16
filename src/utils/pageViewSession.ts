import {
  JsonRequestAbortedError,
  fetchJsonWithTimeout,
  type JsonRequestOptions
} from './jsonRequest'

export const PAGE_VIEW_TIMEOUT_MS = 15_000

export interface PageViewPayload {
  page_view?: unknown
  offline?: unknown
}

export type PageViewJsonRequester = <T>(
  input: RequestInfo | URL,
  options?: JsonRequestOptions,
) => Promise<T>

export interface PageViewSessionOptions {
  url: RequestInfo | URL
  timeoutMs?: number
  onPageView: (pageView: number) => void
  onConnectWs: () => void
  onError?: (error: unknown) => void
  requestJson?: PageViewJsonRequester
}

export type PageViewSessionResult =
  | { status: 'ok'; pageView: number | null }
  | { status: 'offline'; pageView: number | null }
  | { status: 'error'; error: unknown }
  | { status: 'cancelled' }

export interface PageViewSession {
  start: () => Promise<PageViewSessionResult>
  cancel: (reason?: unknown) => void
  isCancelled: () => boolean
  hasStarted: () => boolean
}

/**
 * Manages at most one bounded POST /page_view request per component mount,
 * handling offline mode, fallback WebSocket startup, and unmount cancellation.
 */
export function createPageViewSession(options: PageViewSessionOptions): PageViewSession {
  const {
    url,
    timeoutMs = PAGE_VIEW_TIMEOUT_MS,
    onPageView,
    onConnectWs,
    onError,
    requestJson = fetchJsonWithTimeout,
  } = options

  let cancelled = false
  let started = false
  let controller: AbortController | null = null
  let runPromise: Promise<PageViewSessionResult> | null = null

  const cancel = (reason: unknown = 'component unmounted') => {
    if (cancelled) return
    cancelled = true
    const activeController = controller
    controller = null
    activeController?.abort(reason)
  }

  const start = (): Promise<PageViewSessionResult> => {
    if (runPromise) return runPromise
    if (cancelled) {
      return Promise.resolve({ status: 'cancelled' })
    }

    started = true
    const activeController = new AbortController()
    controller = activeController

    const isActive = () => !cancelled && !activeController.signal.aborted

    runPromise = (async (): Promise<PageViewSessionResult> => {
      try {
        const data = await requestJson<PageViewPayload>(url, {
          method: 'POST',
          signal: activeController.signal,
          timeoutMs,
        })
        if (controller === activeController) {
          controller = null
        }
        if (!isActive()) {
          return { status: 'cancelled' }
        }

        let nextPageView: number | null = null
        let offline = false
        if (data !== null && typeof data === 'object' && !Array.isArray(data)) {
          if (typeof data.page_view === 'number' && Number.isFinite(data.page_view) && Number.isInteger(data.page_view) && data.page_view >= 0) {
            nextPageView = data.page_view
            onPageView(nextPageView)
          }
          if (data.offline === true) {
            offline = true
          }
        }

        if (!isActive()) {
          return { status: 'cancelled' }
        }
        if (offline) {
          return { status: 'offline', pageView: nextPageView }
        }

        onConnectWs()
        return { status: 'ok', pageView: nextPageView }
      } catch (error) {
        if (controller === activeController) {
          controller = null
        }
        if (!isActive() || error instanceof JsonRequestAbortedError) {
          return { status: 'cancelled' }
        }
        onError?.(error)
        if (!isActive()) {
          return { status: 'cancelled' }
        }
        onConnectWs()
        return { status: 'error', error }
      }
    })()

    return runPromise
  }

  return {
    start,
    cancel,
    isCancelled: () => cancelled,
    hasStarted: () => started,
  }
}
