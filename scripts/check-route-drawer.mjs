import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const moduleCache = new Map()
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function loadModule(relative) {
  const full = path.resolve(repoRoot, relative)
  if (moduleCache.has(full)) return moduleCache.get(full)
  const mod = { exports: {} }
  moduleCache.set(full, mod.exports)
  new Function('require', 'module', 'exports', compile(fs.readFileSync(full, 'utf8')))(id =>
    id.startsWith('.') ? loadModule(path.relative(repoRoot, path.resolve(path.dirname(full), `${id}.ts`))) : require(id),
  mod, mod.exports)
  return mod.exports
}

globalThis.HTMLElement = class {}
let confirmResult = false
let confirmCount = 0
const confirmMessages = []
const listeners = new Map()
globalThis.window = {
  confirm(message) { confirmCount++; confirmMessages.push(message); return confirmResult },
  addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
  removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
}
globalThis.document = { body: {}, activeElement: null, documentElement: { style: { overflow: '' } }, querySelector: () => null }
document.activeElement = document.body
globalThis.getComputedStyle = () => ({ visibility: 'visible' })
const disk = new Map()
let failRead = false
let failWrite = false
globalThis.localStorage = {
  getItem: key => { if (failRead) throw Error('read blocked'); return disk.get(key) ?? null },
  setItem(key, value) { if (failWrite) throw Error('write blocked'); disk.set(key, String(value)) },
  removeItem(key) { if (failWrite) throw Error('write blocked'); disk.delete(key) },
}
const connect = (el, value) => { el.isConnected = value; el.children.forEach(child => connect(child, value)) }
function detach(el) {
  for (let active = document.activeElement; active; active = active.parent) {
    if (active === el) { document.activeElement = document.body; break }
  }
  if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
  el.parent = null
  connect(el, false)
}
const all = (root, predicate) => [ ...(predicate(root) ? [root] : []), ...root.children.flatMap(child => all(child, predicate)) ]
function node(type, text = '') {
  const el = Object.assign(new HTMLElement(), { type, text, props: {}, parent: null, children: [], isConnected: false,
    hiddenForTest: false,
    focus() { document.activeElement = el },
    getClientRects() { return el.isConnected && !el.hiddenForTest ? [{ width: 100, height: 24 }] : [] },
    contains(target) { return all(el, child => child === target).length > 0 },
    querySelectorAll() { return all(el, child => ['button', 'input', 'a', 'select', 'textarea'].includes(child.type) && !child.props.disabled) },
  })
  Object.defineProperty(el, 'disabled', { get: () => Boolean(el.props.disabled) })
  return markRaw(el)
}
const { createApp } = createRenderer({
  createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
  patchProp: (el, key, _old, value) => { el.props[key] = value },
  insert(el, parent, anchor) {
    if (el.parent) detach(el)
    el.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
    connect(el, parent.isConnected)
  },
  remove: detach, setText: (el, text) => { el.text = text },
  setElementText(el, text) { [...el.children].forEach(detach); el.text = text },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
const progress = loadModule('src/utils/routeProgress.ts')
const config = loadModule('src/config/readingRoute.ts')
const { descriptor } = parse(fs.readFileSync(path.join(repoRoot, 'src/components/ReadingRoute.vue'), 'utf8'))
const component = { exports: {} }
const script = compileScript(descriptor, { id: 'route-drawer-check', inlineTemplate: true })
new Function('require', 'module', 'exports', compile(script.content))(id =>
  id === '../utils/routeProgress' ? progress : id === '../config/readingRoute' ? config : require(id),
component, component.exports)
const Component = component.exports.default
const guideDescriptor = parse(fs.readFileSync(path.join(repoRoot, 'src/components/CodeGuide.vue'), 'utf8')).descriptor
const guide = { exports: {} }
const guideScript = compileScript(guideDescriptor, { id: 'guide-focus-check', inlineTemplate: true,
  templateOptions: { compilerOptions: { hoistStatic: false } } })
new Function('require', 'module', 'exports', compile(guideScript.content))(require, guide, guide.exports)
const CodeGuide = guide.exports.default
const searchDescriptor = parse(fs.readFileSync(path.join(repoRoot, 'src/components/SearchResults.vue'), 'utf8')).descriptor
const search = { exports: {} }
const searchScript = compileScript(searchDescriptor, { id: 'search-focus-check', inlineTemplate: true,
  templateOptions: { compilerOptions: { hoistStatic: false } } })
new Function('require', 'module', 'exports', compile(searchScript.content))(id =>
  id === './HighlightText.vue' ? { setup: () => () => null } : id.startsWith('../utils/') ? loadModule(`src/utils/${id.split('/').at(-1)}.ts`) : require(id),
search, search.exports)
const SearchResults = search.exports.default
const text = el => (el.text + el.children.map(text).join('')).trim()
const byClass = (root, name) => all(root, el => String(el.props.class ?? '').split(' ').includes(name))
const click = el => { assert.ok(el && !el.props.disabled, 'target button must be enabled'); el.focus(); el.props.onClick({ currentTarget: el }) }
const tick = async () => { await nextTick(); await nextTick(); await nextTick() }
const key = (name, shiftKey = false) => { for (const fn of [...(listeners.get('keydown') ?? [])]) fn({ key: name, shiftKey, preventDefault() {} }) }

const deadline = setTimeout(() => { console.error('Route drawer checks exceeded 5 seconds'); process.exit(1) }, 5000)
try {
  progress.loadRouteProgress()
  const root = node('root'); root.isConnected = true
  const trigger = node('button'); trigger.isConnected = true; trigger.focus()
  document.querySelector = selector => selector === '#route_button' ? trigger : null
  const state = reactive({ open: false, currentCode: '', getNode: code => ({ ch_name: `名称${code}` }), fallbackFocusSelector: '#route_button' })
  const jumps = []
  const app = createApp({ render: () => h(Component, { ...state, onClose() { state.open = false }, onJump(code) { jumps.push(code) } }) })
  app.mount(root)
  state.open = true
  await tick()
  let close = byClass(root, 'drawer_close_btn')[0]
  assert.ok(document.activeElement === close, 'opening focuses close button')
  assert.equal(document.documentElement.style.overflow, 'hidden')
  const first = progress.ROUTE_STEPS_FLAT[0]
  const second = progress.ROUTE_STEPS_FLAT[1]
  click(byClass(root, 'continue_btn')[0])
  assert.equal(jumps.at(-1), first.step.code)
  assert.equal(progress.routeDoneIds.value.length, 0, 'continue does not complete a step')
  const checkbox = byClass(root, 'step_checkbox')[0]
  checkbox.props.onChange()
  await tick()
  click(byClass(root, 'continue_btn')[0])
  assert.equal(jumps.at(-1), second.step.code)
  assert.deepEqual([...progress.routeDoneIds.value], [first.stepId])
  const reset = byClass(root, 'reset_btn')[0]
  confirmResult = false
  click(reset); await tick()
  assert.equal(confirmCount, 1)
  assert.deepEqual([...progress.routeDoneIds.value], [first.stepId], 'cancel reset keeps progress')
  confirmResult = true
  click(reset); await tick()
  close = byClass(root, 'drawer_close_btn')[0]
  assert.equal(progress.routeDoneIds.value.length, 0)
  assert.ok(document.activeElement === close, 'accepted reset moves focus from disabled reset to close')
  const panel = all(root, el => el.props.role === 'dialog')[0]
  const focusables = panel.querySelectorAll()
  focusables.at(-1).focus(); key('Tab')
  assert.ok(document.activeElement === focusables[0], 'Tab wraps inside drawer')
  key('Tab', true)
  assert.ok(document.activeElement === focusables.at(-1), 'Shift+Tab wraps inside drawer')

  // Write failure exposes explicit retry without altering check intent, and distinguishes save vs read error.
  failWrite = true
  checkbox.props.onChange()
  await tick()
  assert.equal(progress.routeProgressStorageError.value, true)
  assert.equal(progress.routeProgressErrorKind.value, 'write')
  assert.ok(text(byClass(root, 'storage_error_notice')[0]).includes('进度保存失败'))
  let retryBtn = byClass(root, 'storage_retry_btn')[0]
  assert.equal(text(retryBtn), '重试保存')
  failWrite = false
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, JSON.stringify({ done: [second.stepId] }))
  click(retryBtn); await tick()
  assert.equal(progress.routeProgressStorageError.value, false)
  assert.equal(progress.routeProgressErrorKind.value, null)
  assert.deepEqual(
    JSON.parse(disk.get(progress.ROUTE_PROGRESS_STORAGE_KEY)).done.slice().sort(),
    [first.stepId, second.stepId].sort()
  )
  assert.ok(document.activeElement === close, 'successful retry moves focus to close button')

  // Corrupted storage with doneCount === 0 keeps reset enabled, preserves raw data on cancel, and recovers on confirm.
  confirmResult = true
  click(reset); await tick()
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, '{broken')
  progress.loadRouteProgress()
  await tick()
  assert.equal(progress.routeDoneIds.value.length, 0)
  assert.equal(progress.routeProgressStorageError.value, true)
  assert.equal(progress.routeProgressErrorKind.value, 'read')
  assert.ok(text(byClass(root, 'storage_error_notice')[0]).includes('进度读取失败'))
  assert.equal(text(byClass(root, 'storage_retry_btn')[0]), '重试读取')
  assert.equal(Boolean(reset.props.disabled), false, 'reset stays enabled on storage error even when doneCount is 0')
  confirmResult = false
  click(reset); await tick()
  assert.equal(disk.get(progress.ROUTE_PROGRESS_STORAGE_KEY), '{broken', 'cancelled reset must not delete corrupted data')
  assert.ok(confirmMessages.at(-1).includes('存储读取异常'), 'corrupt reset confirmation explains the unreadable data')
  confirmResult = true
  click(reset); await tick()
  assert.equal(disk.has(progress.ROUTE_PROGRESS_STORAGE_KEY), false, 'confirmed reset clears corrupted storage')
  assert.equal(progress.routeProgressStorageError.value, false)
  assert.equal(progress.routeProgressErrorKind.value, null)
  assert.equal(Boolean(reset.props.disabled), true)
  assert.ok(document.activeElement === close)

  // Read failure with pending toggle retries reading and saving once storage is repaired.
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, '{broken')
  progress.loadRouteProgress()
  await tick()
  checkbox.props.onChange()
  await tick()
  assert.equal(progress.routeProgressErrorKind.value, 'read')
  assert.equal(progress.routeProgressHasPending.value, true)
  assert.equal(disk.get(progress.ROUTE_PROGRESS_STORAGE_KEY), '{broken')
  retryBtn = byClass(root, 'storage_retry_btn')[0]
  assert.equal(text(retryBtn), '重试读取并保存')
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, JSON.stringify({ done: [second.stepId] }))
  click(retryBtn); await tick()
  assert.equal(progress.routeProgressStorageError.value, false)
  assert.deepEqual(
    JSON.parse(disk.get(progress.ROUTE_PROGRESS_STORAGE_KEY)).done.slice().sort(),
    [first.stepId, second.stepId].sort()
  )
  assert.ok(document.activeElement === close)

  // Read-only retry must preserve a still-broken raw value, then adopt repaired
  // external progress without manufacturing a pending save or resetting it.
  progress.resetRouteProgress()
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, '{broken-read-only')
  progress.loadRouteProgress()
  await tick()
  retryBtn = byClass(root, 'storage_retry_btn')[0]
  assert.equal(text(retryBtn), '重试读取')
  click(retryBtn); await tick()
  assert.equal(disk.get(progress.ROUTE_PROGRESS_STORAGE_KEY), '{broken-read-only')
  assert.equal(progress.routeProgressHasPending.value, false)
  assert.equal(progress.routeProgressErrorKind.value, 'read')
  disk.set(progress.ROUTE_PROGRESS_STORAGE_KEY, JSON.stringify({ done: [second.stepId] }))
  click(byClass(root, 'storage_retry_btn')[0]); await tick()
  assert.deepEqual([...progress.routeDoneIds.value], [second.stepId])
  assert.equal(progress.routeProgressStorageError.value, false)
  assert.equal(progress.routeProgressHasPending.value, false)
  assert.ok(document.activeElement === close, 'successful read-only retry restores stable close focus')

  key('Escape'); await tick()
  assert.equal(state.open, false)
  assert.ok(document.activeElement === trigger, 'close returns focus to opener')
  assert.equal(document.documentElement.style.overflow, '')
  app.unmount()
  assert.equal(listeners.get('keydown')?.size ?? 0, 0, 'unmount removes keyboard listener')
  for (const [Name, Drawer, closeClass] of [['route', Component, 'drawer_close_btn'], ['guide', CodeGuide, 'guide_close_btn'], ['search', SearchResults, 'drawer_close_btn']]) {
    for (const scenario of ['normal', 'external-close', 'external-open', 'hidden-opener', 'disabled-opener', 'hidden-fallback', 'reopen', 'unmount']) {
      const root = node('root'); root.isConnected = true
      const opener = node('button'); opener.isConnected = true
      const fallback = node('button'); fallback.isConnected = true
      const external = node('input'); external.isConnected = true
      document.querySelector = () => fallback
      opener.focus()
      const state = reactive({ open: false, currentCode: '', getNode: code => ({ ch_name: code }), fallbackFocusSelector: '#fallback',
        query: '', results: [], totalNodes: 0, ismLoaded: true, ismLoadError: '', enrichStatus: 'ready', enrichError: '', coursesStatus: 'ready', coursesError: '' })
      const app = createApp({ render: () => h(Drawer, { ...state, onClose() { state.open = false } }) })
      app.mount(root)
      state.open = true
      if (scenario === 'external-open') { await nextTick(); external.focus() }
      await tick()
      const close = byClass(root, closeClass)[0]
      if (scenario === 'external-open') {
        assert.ok(document.activeElement === external, `${Name} opening preserves external focus`)
        app.unmount(); continue
      }
      assert.ok(document.activeElement === close)
      assert.equal(document.documentElement.style.overflow, 'hidden')
      const panel = all(root, el => el.props.role === 'dialog')[0]
      const focusables = panel.querySelectorAll()
      focusables.at(-1).focus(); key('Tab'); assert.ok(document.activeElement === focusables[0], `${Name} Tab wraps`)
      key('Tab', true); assert.ok(document.activeElement === focusables.at(-1), `${Name} Shift+Tab wraps`)
      if (scenario === 'hidden-opener') opener.hiddenForTest = true
      if (scenario === 'disabled-opener') opener.props.disabled = true
      if (scenario === 'hidden-fallback') { opener.hiddenForTest = true; fallback.hiddenForTest = true }
      click(close)
      if (scenario === 'external-close') external.focus()
      if (scenario === 'unmount') { app.unmount(); external.focus() }
      if (scenario === 'reopen') { await nextTick(); state.open = true }
      await tick()
      if (scenario === 'external-close' || scenario === 'unmount') assert.ok(document.activeElement === external, `${Name} late close never steals external focus`)
      else if (scenario === 'hidden-opener' || scenario === 'disabled-opener') assert.ok(document.activeElement === fallback, `${Name} invalid opener uses visible enabled fallback`)
      else if (scenario === 'hidden-fallback') assert.ok(document.activeElement === document.body, `${Name} hidden fallback is not focused`)
      else if (scenario === 'reopen') {
        const reopened = byClass(root, closeClass)[0]
        assert.ok(document.activeElement === reopened, `${Name} reopened drawer keeps focus inside`)
        assert.equal(document.documentElement.style.overflow, 'hidden')
      } else assert.ok(document.activeElement === opener, `${Name} ordinary close restores opener`)
      if (scenario !== 'unmount') app.unmount()
      assert.equal(listeners.get('keydown')?.size ?? 0, 0)
    }
  }
  {
    const root = node('root'); root.isConnected = true
    const routeOpener = node('button'); routeOpener.isConnected = true
    const guideOpener = node('button'); guideOpener.isConnected = true
    const external = node('input'); external.isConnected = true
    document.querySelector = selector => selector === '#route' ? routeOpener : selector === '#guide' ? guideOpener : null
    document.querySelectorAll = () => all(root, el => el.props['aria-modal'] === 'true')
    const state = reactive({ route: false, guide: false, search: false })
    const app = createApp({ render: () => h('div', [
      h(Component, { open: state.route, currentCode: '', getNode: code => ({ ch_name: code }), fallbackFocusSelector: '#route', onClose() { state.route = false } }),
      h(CodeGuide, { open: state.guide, fallbackFocusSelector: '#guide', onClose() { state.guide = false } }),
      h(SearchResults, { open: state.search, query: '', results: [], totalNodes: 0, currentCode: '', ismLoaded: true,
        ismLoadError: '', enrichStatus: 'ready', enrichError: '', coursesStatus: 'ready', coursesError: '',
        fallbackFocusSelector: '#guide', onClose() { state.search = false } }),
    ]) })
    app.mount(root)
    routeOpener.focus(); state.route = true; await tick()
    for (const [from, to, panelClass] of [['route', 'guide', 'guide_modal_panel'], ['guide', 'route', 'route_drawer_panel'],
      ['route', 'search', 'search_drawer_panel'], ['search', 'guide', 'guide_modal_panel']]) {
      state[from] = false; state[to] = true; await tick()
      const panel = byClass(root, panelClass)[0]
      assert.ok(panel.contains(document.activeElement), `${from}→${to} close restoration yields to the new modal`)
      assert.equal(document.documentElement.style.overflow, 'hidden')
    }
    state.guide = false; external.focus(); await tick()
    assert.ok(document.activeElement === external, 'switch protection retains ordinary external-focus guard')
    app.unmount()
    delete document.querySelectorAll
  }
  for (const resource of ['courses', 'enrich']) {
    const root = node('root'); root.isConnected = true
    const outside = node('input'); outside.isConnected = true
    const state = reactive({ open: false, query: 'test', results: [], totalNodes: 0, currentCode: '', ismLoaded: true,
      ismLoadError: '', enrichStatus: 'ready', enrichError: '', coursesStatus: 'ready', coursesError: '' })
    const status = resource + 'Status'; state[status] = 'error'
    let retries = 0
    const retry = () => { retries++; state[status] = 'loading' }
    const app = createApp({ render: () => h(SearchResults, { ...state, onRetryCourses: retry, onRetryEnrichments: retry }) })
    app.mount(root); state.open = true; await tick()
    let button = byClass(root, 'retry_btn')[0]; click(button)
    const panel = byClass(root, 'search_drawer_panel')[0]
    assert.ok(document.activeElement === panel, 'search retry immediately hands focus to panel')
    await tick(); assert.ok(document.activeElement === panel, 'loading keeps search retry focus')
    state[status] = 'ready'; await tick(); assert.ok(document.activeElement === panel, 'success keeps panel focus')
    state[status] = 'error'; await tick(); button = byClass(root, 'retry_btn')[0]
    outside.focus(); button.props.onClick({ currentTarget: button }); await tick()
    assert.ok(document.activeElement === outside, 'programmatic retry preserves external focus')
    state[status] = 'error'; await tick(); click(byClass(root, 'retry_btn')[0]); outside.focus()
    state[status] = 'error'; await tick(); assert.ok(document.activeElement === outside, 'reerror does not steal external focus')
    state.open = false; await tick(); app.unmount(); await tick()
    assert.ok(document.activeElement === outside, 'close/unmount has no late retry focus')
    assert.equal(retries, 3)
  }
  console.log('Route drawer checks passed (mounted component; no network)')
} finally { clearTimeout(deadline) }
