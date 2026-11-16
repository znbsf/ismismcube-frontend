import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import * as Vue from 'vue'
import { parse, compileScript } from 'vue/compiler-sfc'

const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const requestSource = compile(fs.readFileSync(new URL('../src/utils/jsonRequest.ts', import.meta.url), 'utf8'))
const descriptor = parse(fs.readFileSync(new URL('../src/pages/notice/notice.vue', import.meta.url), 'utf8')).descriptor
const componentSource = compile(compileScript(descriptor, { id: 'notice-check', inlineTemplate: true,
  templateOptions: { compilerOptions: { hoistStatic: false } } }).content)
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
const tick = async () => { for (let i = 0; i < 12; i++) await Vue.nextTick() }
const response = value => ({ ok: true, json: async () => value })
const text = el => el.text + el.children.map(text).join('')

function fixture() {
  const requests = [], timers = new Map(), errors = [], refs = []
  let clock = 0, nextTimer = 0
  const setTimeout = (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms }); return id }
  const clearTimeout = id => timers.delete(id)
  const fetch = (url, init) => { const request = deferred(); requests.push({ ...request, url, init }); return request.promise }
  const requestModule = { exports: {} }
  new Function('exports', 'fetch', 'setTimeout', 'clearTimeout', requestSource)(requestModule.exports, fetch, setTimeout, clearTimeout)
  const component = { exports: {} }
  const vue = { ...Vue, ref(value) { const ref = Vue.ref(value); refs.push(ref); return ref } }
  new Function('require', 'exports', componentSource)(id => id === 'vue' ? vue : id === '../../utils/jsonRequest'
    ? requestModule.exports : { buildApiUrl: path => `/api${path}` }, component.exports)
  const node = (type, value = '') => Vue.markRaw({ type, text: value, props: {}, children: [], parent: null })
  const { createApp } = Vue.createRenderer({
    createElement: node, createText: value => node('#text', value), createComment: value => node('#comment', value),
    patchProp(el, key, _old, value) { el.props[key] = value },
    insert(el, parent, anchor) {
      if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
      el.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
    },
    remove(el) { if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1); el.parent = null },
    setText(el, value) { el.text = value },
    setElementText(el, value) { el.children = []; el.text = value },
    parentNode: el => el.parent,
    nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  })
  const root = node('root'), app = createApp(component.exports.default)
  app.config.errorHandler = error => errors.push(error)
  app.mount(root)
  return { app, root, requests, timers, errors, count: refs[0],
    elapse(ms) {
      clock += ms
      for (const [id, timer] of [...timers]) if (timer.at <= clock) { timers.delete(id); timer.fn() }
    },
  }
}

for (const value of [0, 1234, -1, -2, 1.5, null, undefined, {}, [], '123', NaN, Infinity]) {
  const f = fixture(); await tick()
  assert.equal(f.requests.length, 1)
  assert.equal(f.requests[0].init.method, 'GET', 'notice only reads the counter; no visit increment POST')
  assert.equal(f.requests[0].url, '/api/ismismcube/page_view')
  f.requests[0].resolve(response({ page_view: value })); await tick()
  const expected = typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 ? value : -1
  assert.equal(f.count.value, expected)
  assert.ok(text(f.root).includes(expected === -1 ? '-' : expected.toLocaleString()))
  assert.equal(f.errors.length, 0, 'invalid counter payload never crashes the actual component render')
  assert.equal(f.timers.size, 0)
  f.app.unmount()
}
for (const payload of [null, {}, [], 'wrong']) {
  const f = fixture(); await tick(); f.requests[0].resolve(response(payload)); await tick()
  assert.equal(f.count.value, -1); assert.equal(f.errors.length, 0); f.app.unmount()
}
for (const stage of ['headers', 'body']) {
  for (const ending of ['timeout', 'unmount']) {
    for (const late of ['resolve', 'reject']) {
      const f = fixture(), body = deferred(); await tick()
      if (stage === 'body') { f.requests[0].resolve({ ok: true, json: () => body.promise }); await tick() }
      if (ending === 'timeout') {
        f.elapse(14999); await tick(); assert.equal(f.requests[0].init.signal.aborted, false)
        f.elapse(1); await tick()
      } else f.app.unmount()
      assert.equal(f.requests[0].init.signal.aborted, true)
      assert.equal(f.timers.size, 0)
      const pending = stage === 'body' ? body : f.requests[0]
      if (late === 'reject') pending.reject(Error('late mocked request error'))
      else pending.resolve(stage === 'body' ? { page_view: 999 } : response({ page_view: 999 }))
      await tick()
      assert.equal(f.count.value, -1, 'late values cannot replace the placeholder after deadline/unmount')
      assert.equal(f.requests.length, 1, 'no automatic retry')
      assert.equal(f.errors.length, 0)
      if (ending === 'timeout') f.app.unmount()
    }
  }
}
console.log('Notice checks passed (actual mounted component, GET validation/deadline/unmount; no network)')
