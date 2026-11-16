import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import { compileScript, parse } from 'vue/compiler-sfc'
import { createRenderer, h, markRaw, nextTick, reactive } from 'vue'

const require = createRequire(import.meta.url)
const { descriptor } = parse(fs.readFileSync(new URL('../src/components/adaptiveTextarea.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'adaptive-textarea-check', inlineTemplate: true })
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText
const mod = { exports: {} }
new Function('require', 'module', 'exports', compiled)(require, mod, mod.exports)
const Component = mod.exports.default
const tick = async () => { await nextTick(); await nextTick(); await nextTick() }

function fixture(withObserver = true) {
  const layout = { width: 744, height: 220, cap: Infinity, heightCap: Infinity, boxSizing: 'border-box', writes: 0 }
  const frames = new Map(), windowListeners = new Map(), observers = []
  let id = 0
  globalThis.HTMLElement = class {}
  const px = (value, axis = 'width') => {
    if (!value || value === 'auto') return 0
    if (value === 'none') return Infinity
    if (String(value).endsWith('%')) return parseFloat(value) * (axis === 'height' ? layout.height : layout.width) / 100
    if (String(value).endsWith('rem')) return parseFloat(value) * 16
    return parseFloat(value) || 0
  }
  const connect = (el, value) => { el.isConnected = value; el.children.forEach(child => connect(child, value)) }
  const detach = el => {
    if (el.parent) el.parent.children.splice(el.parent.children.indexOf(el), 1)
    el.parent = null; connect(el, false)
  }
  const node = type => {
    const listeners = new Map()
    const el = {
      type, tagName: type.toUpperCase(), parent: null, children: [], props: {}, text: '', value: '', composing: false,
      selectionStart: 0, selectionEnd: 0, isConnected: false,
      style: new Proxy({}, {
        get: (target, key) => target[key] ?? '',
        set(target, key, value) {
          layout.writes++
          target[key] = value
          return true
        }
      }),
      get parentElement() { return this.parent }, get parentNode() { return this.parent },
      get placeholder() { return this.props.placeholder ?? '' },
      get clientWidth() { return type === 'textarea' ? Math.max(0, this.getBoundingClientRect().width - 2) : layout.width },
      get clientHeight() {
        if (type !== 'textarea') return layout.height
        const borderBox = layout.boxSizing === 'border-box'
        const desired = this.style.height === 'auto' || !this.style.height ? (borderBox ? 30 : 20) : px(this.style.height, 'height')
        const min = px(this.style.minHeight, 'height')
        const max = px(this.style.maxHeight ?? 'none', 'height')
        const cssHeight = Math.min(layout.heightCap, Math.max(min, Math.min(desired, max)))
        return Math.max(0, cssHeight + (borderBox ? -2 : 8))
      },
      get scrollHeight() {
        if (type !== 'textarea') return layout.height
        const width = Math.max(1, this.clientWidth - 8)
        const lines = String(this.value || this.placeholder || '').split('\n')
          .reduce((count, line) => count + Math.max(1, Math.ceil(Array.from(line).length * 10 / width)), 0)
        return Math.max(this.clientHeight, lines * 20 + 8)
      },
      getBoundingClientRect() {
        if (this.style.left === '-99999px') return { width: px(this.style.width), height: px(this.style.height, 'height') }
        if (type !== 'textarea') return { width: layout.width, height: layout.height }
        const borderBox = layout.boxSizing === 'border-box'
        const extra = borderBox ? 0 : 10
        const wanted = px(this.style.width || `${layout.width}px`) + extra
        const max = px(this.style.maxWidth || '100%') + extra
        const min = px(this.style.minWidth || '0px') + extra
        return { width: Math.min(layout.width, layout.cap, Math.max(min, Math.min(wanted, max))), height: this.clientHeight + 2 }
      },
      appendChild(child) { child.parent = this; this.children.push(child); connect(child, this.isConnected); return child },
      removeChild(child) { detach(child); return child },
      addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn) },
      removeEventListener(type, fn) { listeners.get(type)?.delete(fn) },
      dispatch(type, extra = {}) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type, target: this, currentTarget: this, ...extra }) },
      dispatchEvent(event) { this.dispatch(event.type); return true }
    }
    Object.setPrototypeOf(el, HTMLElement.prototype)
    return markRaw(el)
  }
  globalThis.document = {
    body: node('body'), activeElement: null,
    createElement(type) {
      if (type === 'canvas') return { getContext: () => ({ font: '', measureText: text => ({ width: Array.from(text).length * 10 }) }) }
      return node(type)
    }
  }
  globalThis.getComputedStyle = el => ({
    font: '16px sans-serif', boxSizing: layout.boxSizing,
    paddingLeft: '4px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px',
    borderLeftWidth: '1px', borderRightWidth: '1px', borderTopWidth: '1px', borderBottomWidth: '1px',
    minWidth: el.style.minWidth || '0px', maxWidth: el.style.maxWidth || '100%',
    minHeight: el.style.minHeight || '0px', maxHeight: el.style.maxHeight || 'none'
  })
  globalThis.requestAnimationFrame = fn => { const key = id++; frames.set(key, fn); return key }
  globalThis.cancelAnimationFrame = key => frames.delete(key)
  globalThis.window = {
    addEventListener(type, fn) { if (!windowListeners.has(type)) windowListeners.set(type, new Set()); windowListeners.get(type).add(fn) },
    removeEventListener(type, fn) { windowListeners.get(type)?.delete(fn) }
  }
  globalThis.ResizeObserver = withObserver ? class {
    constructor(callback) { this.callback = callback; this.targets = new Set(); this.disconnected = false; observers.push(this) }
    observe(el) { this.targets.add(el) }
    disconnect() { this.targets.clear(); this.disconnected = true }
  } : undefined
  const { createApp } = createRenderer({
    createElement: node, createText: text => Object.assign(node('#text'), { text }), createComment: () => node('#comment'),
    patchProp(el, key, old, value) {
      if (/^on[A-Z]/.test(key)) {
        const event = key.slice(2).toLowerCase()
        if (typeof old === 'function') el.removeEventListener(event, old)
        if (typeof value === 'function') el.addEventListener(event, value)
      }
      el.props[key] = value
      if (key === 'style') Object.assign(el.style, value)
      if (key === 'value') el.value = String(value)
      if (key === 'disabled' || key === 'readonly') el[key] = value
    },
    insert(el, parent, anchor) {
      if (el.parent) detach(el)
      el.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, el)
      connect(el, parent.isConnected)
    },
    remove: detach, setText: (el, text) => { el.text = text },
    setElementText(el, text) { [...el.children].forEach(detach); el.text = text },
    parentNode: el => el.parent, nextSibling: el => el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null
  })
  const state = reactive({ modelValue: '字'.repeat(120), minHeight: '30px', maxHeight: '100px', minWidth: '0px', maxWidth: '100%' })
  const emitted = []
  const root = node('root'); root.isConnected = true
  const app = createApp({ render: () => h('div', {}, [h(Component, { ...state, 'onUpdate:modelValue': value => { emitted.push(value); state.modelValue = value } })]) })
  app.mount(root)
  const textarea = root.children[0].children.find(el => el.type === 'textarea')
  return {
    layout, frames, observers, state, emitted, textarea, root, app,
    frame() { const pending = [...frames.entries()]; for (const [key, fn] of pending) { frames.delete(key); fn(0) } },
    notify() { observers.forEach(observer => observer.callback([])) },
    resizeWindow() { for (const fn of [...(windowListeners.get('resize') ?? [])]) fn() },
    resizeListenerCount: () => windowListeners.get('resize')?.size ?? 0
  }
}

const deadline = setTimeout(() => { console.error('Adaptive textarea checks exceeded 5 seconds'); process.exit(1) }, 5000)
try {
  {
    // Root browser regression: the first wide input starts from an empty,
    // animated textarea rather than from already populated mount props.
    const f = fixture()
    f.state.modelValue = ''
    await tick(); f.frame()
    f.textarea.style.transitionProperty = 'all'
    f.textarea.value = '字'.repeat(120)
    f.textarea.dispatch('input')
    await tick(); f.frame()
    assert.equal(f.textarea.value.length, 120)
    assert.ok(f.textarea.scrollHeight <= f.textarea.clientHeight + 1, 'first wide input must not clip while overflow is hidden')
    assert.equal(f.textarea.style.overflowY, 'hidden')
    assert.equal(f.textarea.style.transitionProperty, 'all')
    f.notify()
    assert.equal(f.frames.size, 0)
    f.app.unmount()
  }
  {
    const f = fixture()
    await tick(); f.frame()
    const value = f.textarea.value
    const initialHeight = f.textarea.clientHeight
    assert.equal(f.textarea.style.overflowY, 'hidden')
    assert.equal(f.observers[0].targets.size, 2)
    f.textarea.selectionStart = 5; f.textarea.selectionEnd = 9
    f.layout.width = 168
    f.notify(); f.notify()
    assert.equal(f.frames.size, 1, 'container callbacks coalesce to one pending frame')
    f.frame()
    assert.ok(f.textarea.clientHeight > initialHeight)
    assert.ok(f.textarea.scrollHeight > f.textarea.clientHeight)
    assert.equal(f.textarea.style.overflowY, 'auto', 'narrow layout exposes capped draft through native vertical scroll')
    assert.equal(f.textarea.value, value)
    assert.equal(f.textarea.selectionStart, 5); assert.equal(f.textarea.selectionEnd, 9)
    for (let i = 0; i < 3; i++) f.notify()
    assert.equal(f.frames.size, 0, 'notifications from own height change do not create a resize loop')
    f.layout.width = 744
    f.notify(); f.frame()
    assert.equal(f.textarea.clientHeight, initialHeight)
    assert.equal(f.textarea.style.overflowY, 'hidden')
    assert.equal(f.textarea.value, value)
    // Real used textarea width, rather than parent/canvas request, controls wrapping.
    f.layout.cap = 120
    f.notify(); f.frame()
    assert.equal(f.textarea.getBoundingClientRect().width, 120)
    assert.equal(f.textarea.style.overflowY, 'auto')
    // Further flex height restriction still permits vertical scrolling.
    f.layout.heightCap = 50
    f.resizeWindow(); f.frame()
    assert.equal(f.textarea.style.overflowY, 'auto')
    // Prop changes resize even when no new input occurs.
    f.state.maxHeight = '60px'; await tick()
    assert.equal(f.frames.size, 1)
    f.frame()
    assert.equal(f.textarea.value, value)
    f.app.unmount()
    assert.equal(f.resizeListenerCount(), 0)
    assert.ok(f.observers.every(observer => observer.disconnected))
    assert.equal(f.frames.size, 0)
  }
  {
    const f = fixture()
    f.layout.boxSizing = 'content-box'
    f.layout.width = 168
    f.layout.height = 100
    f.state.maxHeight = '50%'
    await tick(); f.frame()
    assert.equal(f.textarea.clientHeight, 58, 'percentage maxHeight resolves against container height, with content-box padding')
    assert.equal(f.textarea.style.overflowY, 'auto')
    f.app.unmount()
  }
  {
    const f = fixture(false)
    await tick(); f.frame()
    f.layout.width = 168
    f.resizeWindow(); f.frame()
    assert.equal(f.textarea.style.overflowY, 'auto', 'window resize is a fallback without ResizeObserver')
    f.textarea.value = '中文输入草稿'
    f.textarea.dispatch('compositionstart')
    f.textarea.dispatch('input', { isComposing: true })
    await tick(); f.frame()
    assert.equal(f.textarea.value, '中文输入草稿', 'measurement never rewrites composing text')
    f.textarea.dispatch('compositionend')
    await tick(); f.frame()
    assert.equal(f.emitted.at(-1), '中文输入草稿')
    f.textarea.value += '\n第二行'
    f.textarea.dispatch('input'); await tick(); f.frame()
    assert.equal(f.emitted.at(-1), '中文输入草稿\n第二行')
    f.app.unmount()
  }
  {
    const f = fixture()
    await tick()
    const staleFrame = [...f.frames.values()][0], observer = f.observers[0]
    f.app.unmount()
    const writes = f.layout.writes
    staleFrame(0); observer.callback([]); f.resizeWindow()
    assert.equal(f.layout.writes, writes, 'retained callbacks after unmount cannot write layout')
    assert.equal(f.frames.size, 0)
    assert.equal(f.resizeListenerCount(), 0)
    assert.equal(observer.disconnected, true)
  }
  console.log('Adaptive textarea checks passed (actual component, controlled geometry/resize/IME/teardown; no network)')
} finally { clearTimeout(deadline) }
