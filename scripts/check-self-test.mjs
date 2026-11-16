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
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
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
let modalOpen = false
globalThis.document = { body: { isConnected: true }, activeElement: null,
  querySelector: selector => selector === '[aria-modal="true"]' && modalOpen ? {} : null }
document.activeElement = document.body
globalThis.getComputedStyle = () => ({ visibility: 'visible' })
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
    focus() { document.activeElement = el },
    getClientRects() { return el.isConnected ? [{ width: 100, height: 24 }] : [] },
    contains(target) { return all(el, child => child === target).length > 0 },
    querySelectorAll() { return all(el, child => ['button', 'input', 'a', 'select', 'textarea'].includes(child.type) && !child.props.disabled) },
  })
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

function component(relative, mocks = {}) {
  const { descriptor } = parse(fs.readFileSync(path.join(repoRoot, relative), 'utf8'))
  const script = compileScript(descriptor, { id: relative, inlineTemplate: true })
  const mod = { exports: {} }
  new Function('require', 'module', 'exports', compile(script.content))(
    id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id), mod, mod.exports)
  return mod.exports.default
}
const format = loadModule('src/utils/ismFormat.ts')
const HighlightText = component('src/components/HighlightText.vue', { '../utils/ismFormat': format })
const EvidenceMarker = { setup(_props, { slots }) { return () => h('div', slots.default?.()) } }
const AxisAnatomy = component('src/components/AxisAnatomy.vue', {
  '../utils/ismFormat': format,
  '../utils/axisStructure': loadModule('src/utils/axisStructure.ts'),
  '../utils/evidence': loadModule('src/utils/evidence.ts'),
  './HighlightText.vue': HighlightText, './EvidenceMarker.vue': EvidenceMarker
})
const text = el => el.text + el.children.map(text).join('')
const byClass = (root, name) => all(root, el => String(el.props.class ?? '').split(' ').includes(name))
const tick = async () => { await nextTick(); await nextTick(); await nextTick() }
const click = el => { assert.ok(el && !el.props.disabled, 'reveal button must be enabled'); el.focus(); return el.props.onClick({ currentTarget: el }) }
const normal = { ch_name: '四轴节点', axis_list: ['场域论1：第一轴正文', '本体论1：第二轴正文', '认识论1：第三轴正文', '目的论1：第四轴正文'], feature_list: [] }
const fallback = { ch_name: '旧格式节点', axis_list: ['旧格式原样说明'], feature_list: [] }
function mount(code = '1-1-1-1') {
  document.activeElement = document.body
  const nodes = { '1-1-1-1': normal, '1-1-1-2': normal, '2': fallback }
  const state = reactive({ code, selfTest: true, query: '', getNode: code => nodes[code] ?? null, axisEvidence: () => null })
  const root = node('root'); root.isConnected = true
  const app = createApp({ render: () => h(AxisAnatomy, { ...state }) })
  app.mount(root)
  return { state, root, app }
}
const deadline = setTimeout(() => { console.error('Self-test checks exceeded 5 seconds'); process.exit(1) }, 5000)
try {
  {
    const f = mount()
    const card = byClass(f.root, 'axis_detail_card')[0]
    assert.equal(card.props.tabindex, '-1')
    assert.equal(card.props.role, 'region')
    assert.ok(card.props['aria-label'].includes('1-1-1-1') && card.props['aria-label'].includes('场域论'))
    const reveal = byClass(card, 'self_test_reveal_btn')[0]
    await click(reveal); await tick()
    assert.ok(document.activeElement === card, 'single reveal focuses its stable corresponding card')
    assert.ok(text(card).includes('第一轴正文'))
    assert.equal(byClass(card, 'self_test_reveal_btn').length, 0)
    assert.equal(byClass(f.root, 'self_test_reveal_btn').length, 3)
    // Automatic resets never move focus and retain existing code/selfTest behavior.
    const external = node('button'); external.isConnected = true; external.focus()
    f.state.code = '1-1-1-2'; await tick()
    assert.equal(byClass(f.root, 'self_test_reveal_btn').length, 4)
    assert.ok(document.activeElement === external)
    f.state.selfTest = false; await tick()
    assert.equal(byClass(f.root, 'self_test_reveal_btn').length, 0)
    assert.ok(document.activeElement === external)
    f.state.selfTest = true; await tick()
    assert.equal(byClass(f.root, 'self_test_reveal_btn').length, 4)
    f.app.unmount()
  }
  {
    const f = mount('2'), card = byClass(f.root, 'axis_detail_card')[0]
    await click(byClass(card, 'self_test_reveal_btn')[0]); await tick()
    assert.ok(document.activeElement === card, 'fallback row has the same focus handoff')
    assert.ok(text(card).includes('旧格式原样说明'))
    assert.ok(card.props['aria-label'].includes('场域论'))
    f.app.unmount()
  }
  for (const reason of ['code', 'selfTest', 'external', 'unmount', 'hidden', 'modal']) {
    const f = mount(), card = byClass(f.root, 'axis_detail_card')[0]
    const pending = click(byClass(card, 'self_test_reveal_btn')[0])
    let external = null
    if (reason === 'code') f.state.code = '1-1-1-2'
    if (reason === 'selfTest') f.state.selfTest = false
    if (reason === 'external') { external = node('button'); external.isConnected = true; external.focus() }
    if (reason === 'unmount') f.app.unmount()
    if (reason === 'hidden') card.getClientRects = () => []
    if (reason === 'modal') modalOpen = true
    await pending; await tick()
    assert.ok(document.activeElement !== card, `${reason} invalidates pending reveal focus`)
    if (external) assert.ok(document.activeElement === external, 'external focus is never stolen')
    modalOpen = false
    if (reason !== 'unmount') f.app.unmount()
  }
  {
    const f = mount(), cards = byClass(f.root, 'axis_detail_card')
    const first = click(byClass(cards[0], 'self_test_reveal_btn')[0])
    const second = click(byClass(cards[1], 'self_test_reveal_btn')[0])
    await first; await second; await tick()
    assert.ok(document.activeElement === cards[1], 'latest explicit reveal owns pending focus')
    f.app.unmount()
  }
  {
    const f = mount()
    const pending = click(byClass(f.root, 'self_test_reveal_btn')[0])
    const allButton = byClass(f.root, 'self_test_reveal_all_btn')[0]
    click(allButton)
    await pending; await tick()
    assert.equal(byClass(f.root, 'self_test_reveal_btn').length, 0)
    assert.equal(allButton.props.disabled, true)
    assert.ok(document.activeElement === allButton, 'all-reveal keeps the existing native disabled-button focus behavior')
    f.app.unmount()
  }
  console.log('Self-test checks passed (actual AxisAnatomy, per-row focus and late guards; no network)')
} finally { clearTimeout(deadline) }
