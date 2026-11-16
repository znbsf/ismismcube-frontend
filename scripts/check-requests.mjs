import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

const source = await readFile(new URL('../src/utils/jsonRequest.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText
const { fetchJsonWithTimeout, JsonRequestTimeoutError, JsonRequestAbortedError } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)

const originalFetch = globalThis.fetch
const deadline = setTimeout(() => {
  console.error('Request checks exceeded 5 seconds')
  process.exit(1)
}, 5_000)
const response = json => ({ ok: true, json })
const never = () => new Promise(() => {})
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let cases = 0

try {
  globalThis.fetch = async (_input, init) => {
    assert.equal(init.headers.accept, 'application/json')
    return response(async () => ({ value: 42 }))
  }
  assert.deepEqual(await fetchJsonWithTimeout('/mock', { headers: { accept: 'application/json' } }), { value: 42 })
  cases++

  globalThis.fetch = async () => ({ ok: false, status: 503, statusText: 'Unavailable', json: never })
  await assert.rejects(fetchJsonWithTimeout('/mock'), /HTTP 503 Unavailable/)
  cases++

  for (const stage of ['fetch', 'body']) {
    let internalSignal
    globalThis.fetch = async (_input, init) => {
      internalSignal = init.signal
      return stage === 'fetch' ? never() : response(never)
    }
    await assert.rejects(fetchJsonWithTimeout('/mock', { timeoutMs: 15 }), error =>
      error instanceof JsonRequestTimeoutError && error.timeoutMs === 15)
    assert.equal(internalSignal.aborted, true)
    cases++
  }

  for (const stage of ['fetch', 'body']) {
    const external = new AbortController()
    let internalSignal
    globalThis.fetch = async (_input, init) => {
      internalSignal = init.signal
      return stage === 'fetch' ? never() : response(never)
    }
    const pending = fetchJsonWithTimeout('/mock', { signal: external.signal })
    await delay(0)
    external.abort('user navigation')
    await assert.rejects(pending, error => error instanceof JsonRequestAbortedError && error.reason === 'user navigation')
    assert.equal(internalSignal.aborted, true)
    cases++
  }

  const cancelled = new AbortController()
  cancelled.abort('already gone')
  globalThis.fetch = () => { throw new Error('fetch must not run') }
  await assert.rejects(fetchJsonWithTimeout('/mock', { signal: cancelled.signal }), JsonRequestAbortedError)
  cases++

  for (const stage of ['fetch', 'body']) {
    let finish
    let bodyReads = 0
    const late = new Promise(resolve => { finish = resolve })
    globalThis.fetch = async () => stage === 'fetch' ? late : response(() => late)
    const pending = fetchJsonWithTimeout('/mock', { timeoutMs: 15 })
    await assert.rejects(pending, JsonRequestTimeoutError)
    finish(stage === 'fetch' ? response(async () => { bodyReads++; return 'late' }) : 'late')
    await delay(0)
    await assert.rejects(pending, JsonRequestTimeoutError)
    assert.equal(bodyReads, 0)
    cases++
  }

  globalThis.fetch = async () => response(async () => { throw new SyntaxError('bad JSON') })
  await assert.rejects(fetchJsonWithTimeout('/mock'), SyntaxError)
  await assert.rejects(fetchJsonWithTimeout('/mock', { timeoutMs: Infinity }), RangeError)
  cases += 2

  // Every terminal path removes its external listener and clears its timer.
  for (const outcome of ['success', 'failure', 'timeout', 'cancel']) {
    const external = new AbortController()
    const add = external.signal.addEventListener.bind(external.signal)
    const remove = external.signal.removeEventListener.bind(external.signal)
    const listeners = new Set()
    external.signal.addEventListener = (type, listener, options) => {
      if (type === 'abort') listeners.add(listener)
      return add(type, listener, options)
    }
    external.signal.removeEventListener = (type, listener, options) => {
      if (type === 'abort') listeners.delete(listener)
      return remove(type, listener, options)
    }
    let internalSignal
    globalThis.fetch = async (_input, init) => {
      internalSignal = init.signal
      if (outcome === 'failure') throw new Error('fetch failed')
      return outcome === 'success' ? response(async () => 'ok') : never()
    }
    const pending = fetchJsonWithTimeout('/mock', { timeoutMs: 15, signal: external.signal })
    const checked = outcome === 'success'
      ? pending.then(value => assert.equal(value, 'ok'))
      : assert.rejects(pending)
    await delay(0)
    if (outcome === 'cancel') external.abort()
    await checked
    assert.equal(listeners.size, 0, `${outcome} listener cleanup`)
    await delay(20)
    assert.equal(internalSignal.aborted, outcome === 'timeout' || outcome === 'cancel', `${outcome} timer cleanup`)
    cases++
  }
  console.log(`Request checks passed (${cases} cases; no network)`)
} finally {
  clearTimeout(deadline)
  globalThis.fetch = originalFetch
}
