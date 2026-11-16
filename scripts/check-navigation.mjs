import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue'
import ts from 'typescript'

const deadline = setTimeout(() => { console.error('Navigation checks exceeded 5 seconds'); process.exit(1) }, 5000)
const require = createRequire(import.meta.url)
globalThis.HTMLElement = class {}
let modalOpen = false
globalThis.document = {
  body: {},
  activeElement: null,
  querySelector: selector => (selector === '[aria-modal="true"]' && modalOpen ? {} : null),
}
document.activeElement = document.body
const connect = (node, value) => { node.isConnected = value; node.children.forEach(child => connect(child, value)) }
function node(type, text = '') {
  const value = Object.assign(new HTMLElement(), { type, text, props: {}, parent: null, children: [], isConnected: false,
    focus() { document.activeElement = value },
  })
  return markRaw(value)
}
function detach(child) {
  // Removing an ancestor also removes its focused descendant from the document.
  for (let active = document.activeElement; active; active = active.parent) {
    if (active === child) {
      document.activeElement = document.body
      break
    }
  }
  if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
  child.parent = null
  connect(child, false)
}
const { createApp } = createRenderer({
  createElement: node, createText: text => node('#text', text), createComment: text => node('#comment', text),
  patchProp: (el, key, _prev, value) => { el.props[key] = value },
  insert(child, parent, anchor) {
    if (child.parent) detach(child)
    child.parent = parent
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    connect(child, parent.isConnected)
  },
  remove: detach, setText: (el, text) => { el.text = text },
  setElementText(el, text) { [...el.children].forEach(detach); el.children = []; el.text = text },
  parentNode: el => el.parent,
  nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
})
const source = fs.readFileSync(new URL('../src/components/CubeNavigation.vue', import.meta.url), 'utf8')
const { descriptor } = parse(source)
const compiled = compileScript(descriptor, { id: 'navigation-check', inlineTemplate: true })
const code = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const mod = { exports: {} }
new Function('require', 'module', 'exports', code)(require, mod, mod.exports)
const Component = mod.exports.default
const all = (root, predicate) => [ ...(predicate(root) ? [root] : []), ...root.children.flatMap(child => all(child, predicate)) ]
const buttons = root => all(root, el => el.type === 'button')
const toggleButton = root => all(root, el => el.type === 'button' && el.props.class === 'cube_nav_toggle')[0]
const panelBody = root => all(root, el => el.props.class === 'cube_nav_body')[0]
const panelButtons = root => { const body = panelBody(root); return body ? buttons(body) : [] }
const text = el => (el.text + el.children.map(text).join('')).trim()
const tick = async () => { await nextTick(); await nextTick(); await nextTick() }
const click = el => { el.focus(); el.props.onClick({ currentTarget: el }) }
const keydown = (el, key) => {
  let stopped = false
  const event = { key, preventDefault() {}, stopPropagation() { stopped = true } }
  for (let cur = el; cur && !stopped; cur = cur.parent) cur.props.onKeydown?.(event)
}

try {
  const state = reactive({ currentCode: '', nodes: null })
  const root = node('root'); root.isConnected = true
  const emitted = []
  const app = createApp({ render: () => h(Component, { ...state, onSelect(code) { emitted.push(code); state.currentCode = state.currentCode === code ? '' : code } }) })
  app.mount(root)
  const toggle = toggleButton(root)
  assert.ok(toggle, 'renders stable toggle button')
  assert.equal(toggle.props['aria-expanded'], 'false', 'collapsed by default')
  assert.ok(toggle.props['aria-controls'], 'toggle exposes aria-controls')
  assert.equal(buttons(root).length, 1, 'collapsed nav has no hidden tabbable controls')
  assert.equal(panelBody(root), undefined, 'collapsed nav omits panel body')
  assert.match(text(toggle), /节点导航：节点数据加载中/)

  click(toggle); await tick()
  assert.equal(toggle.props['aria-expanded'], 'true')
  assert.equal(panelBody(root)?.props.id, toggle.props['aria-controls'])
  assert.equal(panelButtons(root).length, 4)
  assert.ok(panelButtons(root).every(el => el.props.disabled), 'loading roots are disabled')

  click(toggle); await tick()
  assert.equal(toggle.props['aria-expanded'], 'false', 'toggle click collapses panel')
  assert.equal(buttons(root).length, 1)
  assert.ok(document.activeElement === toggle, 'explicit toggle collapse keeps focus on stable toggle')

  state.nodes = Object.fromEntries(['1', '2', '3', '4', '1-1', '1-2', '1-1-1', '1-1-1-1'].map(code => [code, { ch_name: `名称${code}` }]))
  state.nodes.introduction = []
  await tick()
  assert.equal(toggle.props['aria-expanded'], 'false')
  assert.match(text(toggle), /节点导航：请选择场域入口/)
  state.currentCode = '1-1-1'; await tick()
  assert.equal(toggle.props['aria-expanded'], 'false')
  assert.match(text(toggle), /节点导航：1-1-1 名称1-1-1/, 'collapsed toggle shows current code and name')
  state.currentCode = ''; await tick()

  click(toggle); await tick()
  const firstRoot = panelButtons(root)[0]
  assert.match(text(firstRoot), /1 名称1/)
  firstRoot.focus()
  await tick()
  assert.equal(emitted.length, 0, 'focus alone does not select')
  click(firstRoot); await tick()
  assert.equal(state.currentCode, '1')
  assert.equal(toggle.props['aria-expanded'], 'true', 'route change does not force collapse')
  assert.match(text(toggle), /节点导航：1 名称1/)
  assert.ok(document.activeElement === firstRoot, 'persistent root keeps focus')
  assert.equal(panelButtons(root).length, 6)
  click(panelButtons(root).find(el => text(el).startsWith('下一级：1-1 '))); await tick()
  assert.equal(state.currentCode, '1-1')
  assert.equal(toggle.props['aria-expanded'], 'true', 'child navigation preserves expanded state')
  const current = all(root, el => el.props.class === 'cube_nav_current')[0]
  assert.ok(document.activeElement === current, 'removed child button focuses stable current label')
  assert.match(text(current), /当前：1-1 名称1-1/)
  click(panelButtons(root).find(el => text(el).startsWith('下一级：'))); await tick()
  click(panelButtons(root).find(el => text(el).startsWith('下一级：'))); await tick()
  assert.equal(state.currentCode, '1-1-1-1')
  assert.ok(!panelButtons(root).some(el => text(el).startsWith('下一级：')), 'leaf has no children')
  click(panelButtons(root).find(el => text(el).startsWith('上一级：'))); await tick()
  assert.equal(state.currentCode, '1-1-1')
  assert.ok(panelButtons(root).length <= 9)
  click(panelButtons(root)[0]); await tick()
  click(panelButtons(root)[0]); await tick()
  assert.equal(state.currentCode, '', 'same root activation is emitted for parent toggle semantics')
  assert.equal(toggle.props['aria-expanded'], 'true', 'toggling off root keeps panel expanded')

  state.currentCode = '1-1'; await tick()
  assert.equal(toggle.props['aria-expanded'], 'true', 'external route update preserves expanded state')
  const childBtn = panelButtons(root).find(el => text(el).startsWith('下一级：'))
  childBtn.focus()
  keydown(childBtn, 'Escape'); await tick()
  assert.equal(toggle.props['aria-expanded'], 'false', 'Escape collapses expanded panel')
  assert.equal(buttons(root).length, 1)
  assert.ok(document.activeElement === toggle, 'Escape collapse returns focus to stable toggle')

  click(toggle); await tick()
  click(panelButtons(root)[0]); await tick()
  click(panelButtons(root).find(el => text(el).startsWith('下一级：')))
  const outside = node('button'); outside.isConnected = true; outside.focus()
  await tick()
  assert.ok(document.activeElement === outside, 'late callback preserves externally moved focus')

  // Simulate async router update + fast modal drawer open / explicit collapse
  let asyncTarget = ''
  const asyncApp = createApp({ render: () => h(Component, { currentCode: state.currentCode, nodes: state.nodes, onSelect(code) { asyncTarget = code } }) })
  const asyncRoot = node('root'); asyncRoot.isConnected = true
  state.currentCode = '1'
  asyncApp.mount(asyncRoot)
  await tick()
  click(toggleButton(asyncRoot)); await tick()
  click(panelButtons(asyncRoot).find(el => text(el).startsWith('下一级：1-1 ')))
  modalOpen = true
  document.activeElement = document.body
  state.currentCode = asyncTarget
  await tick()
  assert.ok(document.activeElement === document.body, 'fast modal drawer open prevents focus steal')
  modalOpen = false

  state.currentCode = '1'; await tick()
  const asyncChild = panelButtons(asyncRoot).find(el => text(el).startsWith('下一级：1-1 '))
  click(asyncChild)
  keydown(asyncChild, 'Escape')
  state.currentCode = asyncTarget
  await tick()
  assert.equal(toggleButton(asyncRoot).props['aria-expanded'], 'false')
  assert.ok(document.activeElement === toggleButton(asyncRoot), 'explicit collapse wins over late async route focus')
  asyncApp.unmount()

  state.currentCode = 'invalid-code'
  await tick()
  assert.match(text(toggle), /节点导航：请选择场域入口/)
  assert.match(text(all(root, el => el.props.class === 'cube_nav_current')[0]), /请选择场域入口/)
  assert.equal(panelButtons(root).length, 4)

  state.currentCode = '1'
  await tick()
  click(panelButtons(root).find(el => text(el).startsWith('下一级：')))
  app.unmount(); await tick()
  assert.ok(document.activeElement === document.body, 'unmount invalidates pending focus')
  console.log('Navigation checks passed (mounted component; no network)')
} finally { clearTimeout(deadline) }
