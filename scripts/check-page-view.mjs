import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const compileCjs = async (relPath) => {
  const source = await readFile(new URL(relPath, import.meta.url), 'utf8')
  return ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText
}

const jsonRequestMod = { exports: {} }
new Function('exports', await compileCjs('../src/utils/jsonRequest.ts'))(jsonRequestMod.exports)

const pageViewMod = { exports: {} }
new Function('require', 'exports', await compileCjs('../src/utils/pageViewSession.ts'))(
  (id) => {
    if (id === './jsonRequest') return jsonRequestMod.exports
    throw new Error(`Unexpected import: ${id}`)
  },
  pageViewMod.exports,
)

const { PAGE_VIEW_TIMEOUT_MS, createPageViewSession } = pageViewMod.exports
const { JsonRequestTimeoutError } = jsonRequestMod.exports

const originalFetch = globalThis.fetch
const deadline = setTimeout(() => {
  console.error('Page view checks exceeded 5 seconds')
  process.exit(1)
}, 5_000)

const okJson = (payload) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  json: async () => payload,
})
const never = () => new Promise(() => {})
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const createHarness = (overrides = {}) => {
  let pageView = -1
  let wsConnects = 0
  const errors = []
  const session = createPageViewSession({
    url: '/api/ismismcube/page_view',
    onPageView: (count) => {
      pageView = count
    },
    onConnectWs: () => {
      wsConnects++
    },
    onError: (error) => {
      errors.push(error)
    },
    ...overrides,
  })
  return {
    session,
    get pageView() { return pageView },
    get wsConnects() { return wsConnects },
    errors,
  }
}

let cases = 0

try {
  // 1. Default timeout constant matches jsonRequest's 15s bound.
  assert.equal(PAGE_VIEW_TIMEOUT_MS, 15_000)
  cases++

  // 2. Success updates pageView, connects WS, and allows at most one POST per session.
  {
    let fetchCalls = 0
    globalThis.fetch = async (input, init) => {
      fetchCalls++
      assert.equal(input, '/api/ismismcube/page_view')
      assert.equal(init.method, 'POST')
      assert.ok(init.signal instanceof AbortSignal)
      return okJson({ page_view: 42 })
    }
    const h = createHarness()
    const first = await h.session.start()
    const second = await h.session.start()
    assert.deepEqual(first, { status: 'ok', pageView: 42 })
    assert.deepEqual(second, { status: 'ok', pageView: 42 })
    assert.equal(fetchCalls, 1)
    assert.equal(h.pageView, 42)
    assert.equal(h.wsConnects, 1)
    assert.equal(h.errors.length, 0)
    cases++
  }

  // 3. offline:true writes pageView when present and never starts WS.
  {
    globalThis.fetch = async () => okJson({ page_view: 77, offline: true })
    const h1 = createHarness()
    assert.deepEqual(await h1.session.start(), { status: 'offline', pageView: 77 })
    assert.equal(h1.pageView, 77)
    assert.equal(h1.wsConnects, 0)

    globalThis.fetch = async () => okJson({ offline: true })
    const h2 = createHarness()
    assert.deepEqual(await h2.session.start(), { status: 'offline', pageView: null })
    assert.equal(h2.pageView, -1)
    assert.equal(h2.wsConnects, 0)

    globalThis.fetch = async () => okJson({ page_view: 88, offline: false })
    const h3 = createHarness()
    assert.deepEqual(await h3.session.start(), { status: 'ok', pageView: 88 })
    assert.equal(h3.pageView, 88)
    assert.equal(h3.wsConnects, 1)
    cases += 3
  }

  // 4. Normal failures fall back to WS without automatic retry.
  {
    const failures = [
      async () => { throw new Error('network down') },
      async () => ({ ok: false, status: 500, statusText: 'Server Error', json: never }),
      async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => { throw new SyntaxError('invalid json') },
      }),
    ]
    for (const failingFetch of failures) {
      let fetchCalls = 0
      globalThis.fetch = async () => {
        fetchCalls++
        return failingFetch()
      }
      const h = createHarness()
      const res = await h.session.start()
      assert.equal(res.status, 'error')
      assert.equal(h.pageView, -1)
      assert.equal(h.wsConnects, 1)
      assert.equal(h.errors.length, 1)
      await h.session.start()
      assert.equal(fetchCalls, 1)
      assert.equal(h.wsConnects, 1)
      cases++
    }
  }

  // 5. Fetch hang & body hang both time out, fall back to WS, and ignore late results.
  for (const stage of ['fetch', 'body']) {
    let finish
    let fetchCalls = 0
    let bodyReads = 0
    let internalSignal
    const late = new Promise((resolve) => { finish = resolve })
    globalThis.fetch = async (_input, init) => {
      fetchCalls++
      internalSignal = init.signal
      if (stage === 'fetch') return late
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: () => {
          bodyReads++
          return late
        },
      }
    }
    const h = createHarness({ timeoutMs: 15 })
    const res = await h.session.start()
    assert.equal(res.status, 'error')
    assert.ok(res.error instanceof JsonRequestTimeoutError)
    assert.equal(internalSignal.aborted, true)
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 1)
    assert.equal(h.errors.length, 1)

    finish(stage === 'fetch'
      ? okJson({ page_view: 999, offline: true })
      : { page_view: 555, offline: true })
    await delay(10)
    assert.equal(fetchCalls, 1)
    assert.equal(bodyReads, stage === 'body' ? 1 : 0)
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 1)
    cases++
  }

  // 6. Unmount cancel during fetch or body aborts and never writes pageView or connects WS, even on late result.
  for (const stage of ['fetch', 'body']) {
    let finish
    let internalSignal
    const late = new Promise((resolve) => { finish = resolve })
    globalThis.fetch = async (_input, init) => {
      internalSignal = init.signal
      return stage === 'fetch' ? late : { ok: true, status: 200, statusText: 'OK', json: () => late }
    }
    const h = createHarness()
    const pending = h.session.start()
    await delay(0)
    h.session.cancel('component unmounted')
    const res = await pending
    assert.deepEqual(res, { status: 'cancelled' })
    assert.equal(h.session.isCancelled(), true)
    assert.equal(internalSignal.aborted, true)
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 0)
    assert.equal(h.errors.length, 0)

    finish(stage === 'fetch' ? okJson({ page_view: 321 }) : { page_view: 321 })
    await delay(10)
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 0)
    assert.equal(h.errors.length, 0)
    cases++
  }

  // 7. Cancel before start never invokes fetch or connects WS.
  {
    globalThis.fetch = () => { throw new Error('fetch must not run after cancel') }
    const h = createHarness()
    h.session.cancel('unmounted before page_view')
    assert.deepEqual(await h.session.start(), { status: 'cancelled' })
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 0)
    assert.equal(h.errors.length, 0)
    cases++
  }

  // 8. Late resolution from a requester that ignores abort still does not write pageView or connect WS after cancel.
  {
    let resolveLate
    const h = createHarness({
      requestJson: () => new Promise((resolve) => { resolveLate = resolve }),
    })
    const pending = h.session.start()
    h.session.cancel('component unmounted')
    resolveLate({ page_view: 777 })
    const res = await pending
    assert.deepEqual(res, { status: 'cancelled' })
    assert.equal(h.pageView, -1)
    assert.equal(h.wsConnects, 0)
    assert.equal(h.errors.length, 0)
    cases++
  }

  // 9. A fresh mount session can POST once even after a previous mount session was cancelled.
  {
    let fetchCalls = 0
    globalThis.fetch = async () => {
      fetchCalls++
      return okJson({ page_view: 100 })
    }
    const remount = createHarness()
    assert.deepEqual(await remount.session.start(), { status: 'ok', pageView: 100 })
    assert.equal(fetchCalls, 1)
    assert.equal(remount.pageView, 100)
    assert.equal(remount.wsConnects, 1)
    cases++
  }

  for (const value of [null, {}, [], '42', -1, -2.5, 1.5, NaN, Infinity]) {
    let displayed = 77, requests = 0, ws = 0
    globalThis.fetch = async (_url, init) => { requests++; assert.equal(init.method, 'POST'); return okJson({ page_view: value }) }
    const session = createPageViewSession({ url: '/mock', onPageView: count => { displayed = count }, onConnectWs: () => { ws++ } })
    assert.deepEqual(await session.start(), { status: 'ok', pageView: null })
    await session.start()
    assert.equal(displayed, 77, 'invalid visit counts never replace a previous valid display')
    assert.equal(requests, 1); assert.equal(ws, 1)
    cases++
  }
  {
    globalThis.fetch = async () => okJson({ page_view: 0 })
    const h = createHarness(); await h.session.start(); assert.equal(h.pageView, 0)
    globalThis.fetch = async () => okJson({ page_view: -1, offline: true })
    const offline = createHarness()
    assert.deepEqual(await offline.session.start(), { status: 'offline', pageView: null })
    assert.equal(offline.pageView, -1); assert.equal(offline.wsConnects, 0)
    cases++
  }
  console.log(`Page view checks passed (${cases} cases; no network)`)
} finally {
  clearTimeout(deadline)
  globalThis.fetch = originalFetch
}
